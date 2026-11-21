"""
Community API Router — Farmer Knowledge Sharing Platform
=========================================================
Endpoints:
  POST   /community/posts                         create post
  GET    /community/posts/{post_id}               get single post
  PATCH  /community/posts/{post_id}               edit post (owner only)
  DELETE /community/posts/{post_id}               delete post (owner / admin)
  POST   /community/posts/{post_id}/like          toggle like
  POST   /community/posts/{post_id}/save          toggle bookmark
  POST   /community/posts/{post_id}/share         record share
  POST   /community/posts/{post_id}/view          record view / time‑spent
  GET    /community/posts/{post_id}/comments      list comments (with replies)
  POST   /community/posts/{post_id}/comments      add comment / reply
  DELETE /community/comments/{comment_id}         delete comment (owner only)
  POST   /community/follow/{user_id}              toggle follow
  GET    /community/feed/home                     home feed (followed + trending)
  GET    /community/feed/trending                 trending posts
  GET    /community/feed/latest                   latest posts
  GET    /community/feed/saved                    saved posts
  GET    /community/tags/trending                 trending tags
  POST   /community/ai/suggest-tags               AI tag suggestions
  POST   /community/admin/moderate/{post_id}      admin moderation
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, and_, or_
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel

from app.database import get_db
from app.auth import get_current_user
from app import models, schemas

router = APIRouter(prefix="/community", tags=["Community"])


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _build_post_response(
    post: models.CommunityPost,
    current_user: models.User,
    db: Session,
    liked_post_ids: Optional[set] = None,
    saved_post_ids: Optional[set] = None,
    following_user_ids: Optional[set] = None,
) -> schemas.PostResponse:
    """Convert ORM post → Pydantic PostResponse, injecting per‑user flags (O(1) if prefetched)."""
    tag_names = [pt.tag.name for pt in post.post_tags] if post.post_tags else []

    # Per‑user state: O(1) set lookup if batched, fallback to DB query if single post
    if liked_post_ids is not None:
        is_liked = post.id in liked_post_ids
    else:
        is_liked = db.query(models.PostLike).filter_by(
            post_id=post.id, user_id=current_user.id).first() is not None

    if saved_post_ids is not None:
        is_saved = post.id in saved_post_ids
    else:
        is_saved = db.query(models.PostSave).filter_by(
            post_id=post.id, user_id=current_user.id).first() is not None

    if following_user_ids is not None:
        is_following = post.user_id in following_user_ids
    else:
        is_following = db.query(models.UserFollow).filter_by(
            follower_id=current_user.id, following_id=post.user_id).first() is not None


    return schemas.PostResponse(
        id=post.id,
        caption=post.caption,
        content=post.content,
        media_type=post.media_type.value if hasattr(post.media_type, "value") else post.media_type,
        image_url=post.image_url,
        video_url=post.video_url,
        media_urls=post.media_urls,
        thumbnail_url=post.thumbnail_url,
        location=post.location,
        tags=tag_names,
        ai_tags=post.ai_tags,
        status=post.status.value if hasattr(post.status, "value") else post.status,
        likes_count=post.likes_count,
        comments_count=post.comments_count,
        shares_count=post.shares_count,
        saves_count=post.saves_count,
        views_count=post.views_count,
        created_at=post.created_at,
        updated_at=post.updated_at,
        user=schemas.PostAuthor(
            id=post.user.id,
            name=post.user.name,
            avatar_url=post.user.avatar_url,
            profile_photo=post.user.profile_photo,
            location=post.user.location,
        ),
        is_liked=is_liked,
        is_saved=is_saved,
        is_following_author=is_following,
    )


def _batch_build_post_responses(
    posts: List[models.CommunityPost],
    current_user: models.User,
    db: Session
) -> List[schemas.PostResponse]:
    """Batch-fetch interaction flags in 3 queries instead of 3xN queries (solves N+1 bottleneck)."""
    if not posts:
        return []
    post_ids = [p.id for p in posts]
    author_ids = [p.user_id for p in posts]

    liked_ids = {
        r[0] for r in db.query(models.PostLike.post_id).filter(
            models.PostLike.user_id == current_user.id,
            models.PostLike.post_id.in_(post_ids)
        ).all()
    }
    saved_ids = {
        r[0] for r in db.query(models.PostSave.post_id).filter(
            models.PostSave.user_id == current_user.id,
            models.PostSave.post_id.in_(post_ids)
        ).all()
    }
    following_ids = {
        r[0] for r in db.query(models.UserFollow.following_id).filter(
            models.UserFollow.follower_id == current_user.id,
            models.UserFollow.following_id.in_(author_ids)
        ).all()
    }

    return [
        _build_post_response(
            p,
            current_user,
            db,
            liked_post_ids=liked_ids,
            saved_post_ids=saved_ids,
            following_user_ids=following_ids,
        )
        for p in posts
    ]


def _sync_tags(post: models.CommunityPost, tag_names: List[str], db: Session):
    """Upsert tags and link them to a post."""
    # Remove old links
    db.query(models.PostTag).filter_by(post_id=post.id).delete()

    for raw in tag_names:
        name = raw.lower().strip().lstrip("#")
        if not name:
            continue
        tag = db.query(models.Tag).filter_by(name=name).first()
        if not tag:
            tag = models.Tag(name=name, post_count=1)
            db.add(tag)
            db.flush()
        else:
            tag.post_count = (tag.post_count or 0) + 1

        existing = db.query(models.PostTag).filter_by(
            post_id=post.id, tag_id=tag.id).first()
        if not existing:
            db.add(models.PostTag(post_id=post.id, tag_id=tag.id))


def _ai_suggest_tags(content: str, caption: str = "") -> schemas.AITagSuggestion:
    """
    Lightweight keyword extractor — replace with Gemini call for production.
    Scans caption + content for agriculture keywords and returns tag suggestions.
    Also flags obviously harmful phrases.
    """
    HARMFUL_WORDS = ["fake", "cheat", "scam", "poison", "kill crop", "destroy"]
    AGRO_KEYWORDS = {
        "wheat": ["wheat", "gehum", "गेहूं"],
        "rice": ["rice", "paddy", "dhan"],
        "corn": ["corn", "maize"],
        "organic": ["organic", "jaivik"],
        "fertilizer": ["fertilizer", "urea", "npk", "dap"],
        "pesticide": ["pesticide", "insecticide", "spray"],
        "irrigation": ["irrigation", "drip", "flood", "watering"],
        "soil": ["soil", "mitti", "clay", "loam"],
        "harvest": ["harvest", "kataai", "yield"],
        "sowing": ["sow", "sowing", "plantation", "nursery"],
        "disease": ["disease", "blight", "rot", "mold", "rust"],
        "tomato": ["tomato", "tamatar"],
        "onion": ["onion", "pyaz"],
        "cotton": ["cotton", "kapas"],
        "sugarcane": ["sugarcane", "ganna"],
    }

    combined = (caption + " " + content).lower()

    is_harmful = any(w in combined for w in HARMFUL_WORDS)
    harmful_reason = "Content may contain misleading farming information." if is_harmful else None

    suggested = [tag for tag, kws in AGRO_KEYWORDS.items()
                 if any(kw in combined for kw in kws)]
    return schemas.AITagSuggestion(
        suggested_tags=suggested[:6],
        is_harmful=is_harmful,
        harmful_reason=harmful_reason,
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Posts — CRUD
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/posts", response_model=schemas.FeedResponse)
def list_posts(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all active community posts (paginated). Used by the frontend communityApi.getPosts()."""
    q = (
        db.query(models.CommunityPost)
        .options(
            joinedload(models.CommunityPost.user),
            joinedload(models.CommunityPost.post_tags).joinedload(models.PostTag.tag)
        )
        .filter(models.CommunityPost.status == models.ContentStatus.ACTIVE)
        .order_by(desc(models.CommunityPost.created_at))
    )
    total = q.count()
    posts = q.offset(skip).limit(limit).all()
    page = (skip // limit) + 1 if limit else 1

    return schemas.FeedResponse(
        posts=_batch_build_post_responses(posts, current_user, db),
        total=total,
        page=page,
        page_size=limit,
        has_next=(skip + limit) < total,
    )


@router.post("/posts", response_model=schemas.PostResponse, status_code=status.HTTP_201_CREATED)
def create_post(
    payload: schemas.PostCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new community post with optional tags and media."""
    # AI content check
    ai_result = _ai_suggest_tags(payload.content or "", payload.caption or "")
    post_status = models.ContentStatus.FLAGGED if ai_result.is_harmful else models.ContentStatus.ACTIVE

    post = models.CommunityPost(
        user_id=current_user.id,
        caption=payload.caption,
        content=payload.content,
        media_type=models.PostMediaType(payload.media_type.value),
        image_url=payload.image_url,
        video_url=payload.video_url,
        media_urls=payload.media_urls,
        thumbnail_url=payload.thumbnail_url,
        location=payload.location,
        ai_tags=ai_result.suggested_tags,
        is_ai_checked=True,
        status=post_status,
        flag_reason=ai_result.harmful_reason,
    )
    db.add(post)
    db.flush()                          # get post.id before tag sync

    tags = payload.tags or ai_result.suggested_tags
    _sync_tags(post, tags, db)

    db.commit()
    db.refresh(post)

    # Eager load relationships for response build
    db.refresh(post)
    post = db.query(models.CommunityPost).options(
        joinedload(models.CommunityPost.user),
        joinedload(models.CommunityPost.post_tags).joinedload(models.PostTag.tag)
    ).filter_by(id=post.id).first()

    return _build_post_response(post, current_user, db)


@router.get("/posts/{post_id}", response_model=schemas.PostResponse)
def get_post(
    post_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(models.CommunityPost).options(
        joinedload(models.CommunityPost.user),
        joinedload(models.CommunityPost.post_tags).joinedload(models.PostTag.tag)
    ).filter(
        models.CommunityPost.id == post_id,
        models.CommunityPost.status != models.ContentStatus.REMOVED
    ).first()

    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return _build_post_response(post, current_user, db)


@router.patch("/posts/{post_id}", response_model=schemas.PostResponse)
def update_post(
    post_id: int,
    payload: schemas.PostUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Only the post owner can edit caption, content, location, or tags."""
    post = db.query(models.CommunityPost).filter_by(id=post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised to edit this post")

    if payload.caption is not None:
        post.caption = payload.caption
    if payload.content is not None:
        post.content = payload.content
    if payload.location is not None:
        post.location = payload.location
    if payload.tags is not None:
        _sync_tags(post, payload.tags, db)

    db.commit()
    db.refresh(post)

    post = db.query(models.CommunityPost).options(
        joinedload(models.CommunityPost.user),
        joinedload(models.CommunityPost.post_tags).joinedload(models.PostTag.tag)
    ).filter_by(id=post_id).first()
    return _build_post_response(post, current_user, db)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Owner can delete their post. (Admin can set is_admin=True via header if implemented.)"""
    post = db.query(models.CommunityPost).filter_by(id=post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised to delete this post")
    db.delete(post)
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
#  Engagement — Likes
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/posts/{post_id}/like", response_model=schemas.PostLikeResponse)
def toggle_like(
    post_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(models.CommunityPost).filter_by(id=post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = db.query(models.PostLike).filter_by(
        post_id=post_id, user_id=current_user.id).first()

    if existing:
        db.delete(existing)
        post.likes_count = max(0, (post.likes_count or 0) - 1)
        liked = False
    else:
        db.add(models.PostLike(post_id=post_id, user_id=current_user.id))
        post.likes_count = (post.likes_count or 0) + 1
        liked = True
    from sqlalchemy.exc import IntegrityError
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        liked = db.query(models.PostLike).filter_by(
            post_id=post_id, user_id=current_user.id).first() is not None

    return schemas.PostLikeResponse(
        id=post_id, post_id=post_id, user_id=current_user.id,
        liked=liked, new_count=post.likes_count
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Engagement — Saves / Bookmarks
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/posts/{post_id}/save", response_model=schemas.SaveResponse)
def toggle_save(
    post_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(models.CommunityPost).filter_by(id=post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = db.query(models.PostSave).filter_by(
        post_id=post_id, user_id=current_user.id).first()

    if existing:
        db.delete(existing)
        post.saves_count = max(0, (post.saves_count or 0) - 1)
        saved = False
    else:
        db.add(models.PostSave(post_id=post_id, user_id=current_user.id))
        post.saves_count = (post.saves_count or 0) + 1
        saved = True
    from sqlalchemy.exc import IntegrityError
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        saved = db.query(models.PostSave).filter_by(
            post_id=post_id, user_id=current_user.id).first() is not None

    return schemas.SaveResponse(post_id=post_id, saved=saved, new_count=post.saves_count)


# ─────────────────────────────────────────────────────────────────────────────
#  Engagement — Shares
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/posts/{post_id}/share", response_model=schemas.ShareResponse)
def record_share(
    post_id: int,
    payload: schemas.ShareCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(models.CommunityPost).filter_by(id=post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    db.add(models.PostShare(
        post_id=post_id, user_id=current_user.id,
        share_platform=payload.share_platform
    ))
    post.shares_count = (post.shares_count or 0) + 1
    db.commit()
    return schemas.ShareResponse(post_id=post_id, shares_count=post.shares_count)


# ─────────────────────────────────────────────────────────────────────────────
#  Engagement — View tracking
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/posts/{post_id}/view", status_code=status.HTTP_204_NO_CONTENT)
def track_view(
    post_id: int,
    payload: schemas.ViewTrack,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Record a view event.  Call this when the post scrolls into view on mobile
    (debounced), sending time_spent_seconds when the post scrolls out.
    """
    post = db.query(models.CommunityPost).filter_by(id=post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    db.add(models.PostView(
        post_id=post_id,
        user_id=current_user.id,
        time_spent_seconds=payload.time_spent_seconds,
    ))
    post.views_count = (post.views_count or 0) + 1
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
#  Comments (with nested replies)
# ─────────────────────────────────────────────────────────────────────────────

def _comment_to_schema(c: models.PostComment) -> schemas.CommentResponse:
    replies = [_comment_to_schema(r) for r in (c.replies or [])]
    return schemas.CommentResponse(
        id=c.id,
        post_id=c.post_id,
        parent_id=c.parent_id,
        content=c.content,
        likes_count=c.likes_count,
        created_at=c.created_at,
        user=schemas.PostAuthor(
            id=c.user.id, name=c.user.name,
            avatar_url=c.user.avatar_url, profile_photo=c.user.profile_photo,
            location=c.user.location,
        ),
        replies=replies,
    )


@router.get("/posts/{post_id}/comments", response_model=List[schemas.CommentResponse])
def list_comments(
    post_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns top-level comments with their replies nested inside."""
    offset = (page - 1) * page_size
    top_level = (
        db.query(models.PostComment)
        .options(
            joinedload(models.PostComment.user),
            joinedload(models.PostComment.replies).joinedload(models.PostComment.user)
        )
        .filter(
            models.PostComment.post_id == post_id,
            models.PostComment.parent_id.is_(None),
        )
        .order_by(models.PostComment.created_at.asc())
        .offset(offset).limit(page_size)
        .all()
    )
    return [_comment_to_schema(c) for c in top_level]


@router.post("/posts/{post_id}/comments", response_model=schemas.CommentResponse,
             status_code=status.HTTP_201_CREATED)
def add_comment(
    post_id: int,
    payload: schemas.CommentCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(models.CommunityPost).filter_by(id=post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if payload.parent_id:
        parent = db.query(models.PostComment).filter_by(
            id=payload.parent_id, post_id=post_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent comment not found")

    comment = models.PostComment(
        post_id=post_id,
        user_id=current_user.id,
        parent_id=payload.parent_id,
        content=payload.content,
    )
    db.add(comment)
    post.comments_count = (post.comments_count or 0) + 1
    db.commit()
    db.refresh(comment)

    # Reload with user
    comment = db.query(models.PostComment).options(
        joinedload(models.PostComment.user),
        joinedload(models.PostComment.replies)
    ).filter_by(id=comment.id).first()
    return _comment_to_schema(comment)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = db.query(models.PostComment).filter_by(id=comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorised")

    post = db.query(models.CommunityPost).filter_by(id=comment.post_id).first()
    if post:
        post.comments_count = max(0, (post.comments_count or 0) - 1)

    db.delete(comment)
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
#  Follow / Unfollow
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/follow/{target_user_id}", response_model=schemas.FollowResponse)
def toggle_follow(
    target_user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    target = db.query(models.User).filter_by(id=target_user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.query(models.UserFollow).filter_by(
        follower_id=current_user.id, following_id=target_user_id).first()

    from sqlalchemy.exc import IntegrityError

    if existing:
        db.delete(existing)
        following = False
    else:
        db.add(models.UserFollow(follower_id=current_user.id, following_id=target_user_id))
        following = True

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        following = True # Was already concurrently added

    followers_count = db.query(models.UserFollow).filter_by(
        following_id=target_user_id).count()

    return schemas.FollowResponse(
        target_user_id=target_user_id,
        following=following,
        followers_count=followers_count,
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Feed — Home (followed users + trending mix)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/feed/home", response_model=schemas.FeedResponse)
def home_feed(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns a mix of:
      - Posts from farmers the current user follows (70 %)
      - Trending posts not yet seen today (30 % fill-in)
    Paginated for infinite scroll.
    """
    offset = (page - 1) * page_size

    followed_ids = [
        row.following_id
        for row in db.query(models.UserFollow.following_id)
                     .filter_by(follower_id=current_user.id).all()
    ]

    base_q = (
        db.query(models.CommunityPost)
        .options(
            joinedload(models.CommunityPost.user),
            joinedload(models.CommunityPost.post_tags).joinedload(models.PostTag.tag)
        )
        .filter(models.CommunityPost.status == models.ContentStatus.ACTIVE)
    )

    if followed_ids:
        feed_q = base_q.filter(
            models.CommunityPost.user_id.in_(followed_ids)
        ).order_by(desc(models.CommunityPost.created_at))
    else:
        # New user — show trending
        feed_q = base_q.order_by(
            desc(models.CommunityPost.likes_count + models.CommunityPost.views_count)
        )

    total = feed_q.count()
    posts = feed_q.offset(offset).limit(page_size).all()

    return schemas.FeedResponse(
        posts=_batch_build_post_responses(posts, current_user, db),
        total=total,
        page=page,
        page_size=page_size,
        has_next=(offset + page_size) < total,
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Feed — Trending (likes + views weighted score)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/feed/trending", response_model=schemas.FeedResponse)
def trending_feed(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * page_size
    # Score = likes×3 + shares×2 + views×0.1
    score = (
        models.CommunityPost.likes_count * 3 +
        models.CommunityPost.shares_count * 2 +
        models.CommunityPost.views_count * 0.1
    )
    q = (
        db.query(models.CommunityPost)
        .options(
            joinedload(models.CommunityPost.user),
            joinedload(models.CommunityPost.post_tags).joinedload(models.PostTag.tag)
        )
        .filter(models.CommunityPost.status == models.ContentStatus.ACTIVE)
        .order_by(desc(score))
    )
    total = q.count()
    posts = q.offset(offset).limit(page_size).all()

    return schemas.FeedResponse(
        posts=_batch_build_post_responses(posts, current_user, db),
        total=total, page=page, page_size=page_size,
        has_next=(offset + page_size) < total,
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Feed — Latest
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/feed/latest", response_model=schemas.FeedResponse)
def latest_feed(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    tag: Optional[str] = Query(None, description="Filter by tag name"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * page_size
    q = (
        db.query(models.CommunityPost)
        .options(
            joinedload(models.CommunityPost.user),
            joinedload(models.CommunityPost.post_tags).joinedload(models.PostTag.tag)
        )
        .filter(models.CommunityPost.status == models.ContentStatus.ACTIVE)
        .order_by(desc(models.CommunityPost.created_at))
    )

    if tag:
        q = q.join(models.PostTag).join(models.Tag).filter(
            func.lower(models.Tag.name) == tag.lower().lstrip("#")
        )

    total = q.count()
    posts = q.offset(offset).limit(page_size).all()

    return schemas.FeedResponse(
        posts=_batch_build_post_responses(posts, current_user, db),
        total=total, page=page, page_size=page_size,
        has_next=(offset + page_size) < total,
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Feed — Saved / Bookmarked posts
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/feed/saved", response_model=schemas.FeedResponse)
def saved_feed(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * page_size
    saves = (
        db.query(models.PostSave)
        .filter_by(user_id=current_user.id)
        .order_by(desc(models.PostSave.created_at))
        .all()
    )
    saved_post_ids = [s.post_id for s in saves]
    total = len(saved_post_ids)
    page_ids = saved_post_ids[offset: offset + page_size]

    posts = []
    if page_ids:
        posts = (
            db.query(models.CommunityPost)
            .options(
                joinedload(models.CommunityPost.user),
                joinedload(models.CommunityPost.post_tags).joinedload(models.PostTag.tag)
            )
            .filter(models.CommunityPost.id.in_(page_ids))
            .all()
        )
        # Preserve save order
        id_map = {p.id: p for p in posts}
        posts = [id_map[pid] for pid in page_ids if pid in id_map]

    return schemas.FeedResponse(
        posts=_batch_build_post_responses(posts, current_user, db),
        total=total, page=page, page_size=page_size,
        has_next=(offset + page_size) < total,
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Tags — Trending
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/tags/trending", response_model=List[schemas.TagResponse])
def trending_tags(
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    tags = (db.query(models.Tag)
            .order_by(desc(models.Tag.post_count))
            .limit(limit).all())
    return [schemas.TagResponse(id=t.id, name=t.name, post_count=t.post_count) for t in tags]


# ─────────────────────────────────────────────────────────────────────────────
#  AI — Auto-suggest tags from content
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/ai/suggest-tags", response_model=schemas.AITagSuggestion)
def suggest_tags(
    payload: schemas.PostCreate,
    current_user: models.User = Depends(get_current_user),
):
    """
    Send post content (before submitting) to get AI tag suggestions
    and a harmful-content check.
    """
    return _ai_suggest_tags(payload.content or "", payload.caption or "")


# ─────────────────────────────────────────────────────────────────────────────
#  Admin — Moderate content
# ─────────────────────────────────────────────────────────────────────────────

class ModerationPayload(BaseModel):
    action: str          # "remove" | "flag" | "restore"
    reason: Optional[str] = None

@router.post("/admin/moderate/{post_id}", status_code=status.HTTP_200_OK)
def moderate_post(
    post_id: int,
    payload: ModerationPayload,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Admin endpoint — protect with role-based middleware in production.
    Actions: remove | flag | restore
    """
    post = db.query(models.CommunityPost).filter_by(id=post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    action_map = {
        "remove": models.ContentStatus.REMOVED,
        "flag": models.ContentStatus.FLAGGED,
        "restore": models.ContentStatus.ACTIVE,
    }
    if payload.action not in action_map:
        raise HTTPException(status_code=400, detail="Invalid action. Use remove|flag|restore")

    post.status = action_map[payload.action]
    post.flag_reason = payload.reason
    db.commit()
    return {"message": f"Post {post_id} status set to {payload.action}", "post_id": post_id}
