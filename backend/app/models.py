from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Enum, DECIMAL, JSON, Date, BigInteger, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base
import enum
from datetime import datetime, timezone

class MessageType(str, enum.Enum):
    USER = "user"
    AI = "ai"

class NotificationType(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    SUCCESS = "success"

class ConsultationStatus(str, enum.Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"

class ActivityType(str, enum.Enum):
    DISEASE_SCAN = "disease_scan"
    AI_QUERY = "ai_query"
    MARKET_SEARCH = "market_search"
    COMMUNITY_POST = "community_post"
    COMMUNITY_LIKE = "community_like"
    COMMUNITY_COMMENT = "community_comment"
    PROFILE_UPDATE = "profile_update"
    SCHEME_VIEW = "scheme_view"
    DOCUMENT_UPLOAD = "document_upload"
    LOGIN = "login"

class PostMediaType(str, enum.Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    IMAGE_VIDEO = "image_video"  # multiple media

class ContentStatus(str, enum.Enum):
    ACTIVE = "active"
    FLAGGED = "flagged"    # AI-flagged for review
    REMOVED = "removed"   # Admin removed
    HIDDEN = "hidden"     # User hidden


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(15), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    email = Column(String(100), nullable=True)
    location = Column(String(100), nullable=True)
    language = Column(String(10), default="en")
    avatar_url = Column(String(255), nullable=True)
    profile_photo = Column(String(255), nullable=True)
    crop_preferences = Column(JSON, nullable=True)  # e.g. ["Wheat", "Rice", "Tomato"]
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete-orphan")
    disease_detections = relationship("DiseaseDetection", back_populates="user", cascade="all, delete-orphan")
    posts = relationship("CommunityPost", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("UserDocument", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    consultations = relationship("ExpertConsultation", back_populates="user", cascade="all, delete-orphan")
    activities = relationship("UserActivity", back_populates="user", cascade="all, delete-orphan")
    # Community social relationships
    post_likes = relationship("PostLike", back_populates="user", cascade="all, delete-orphan")
    post_comments = relationship("PostComment", back_populates="user", cascade="all, delete-orphan")
    post_saves = relationship("PostSave", back_populates="user", cascade="all, delete-orphan")
    post_shares = relationship("PostShare", back_populates="user", cascade="all, delete-orphan")
    following = relationship("UserFollow", foreign_keys="UserFollow.follower_id", back_populates="follower", cascade="all, delete-orphan")
    followers = relationship("UserFollow", foreign_keys="UserFollow.following_id", back_populates="following", cascade="all, delete-orphan")

class OTPVerification(Base):
    __tablename__ = "otp_verifications"
    
    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(15), index=True, nullable=False)
    otp = Column(String(6), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class WeatherData(Base):
    __tablename__ = "weather_data"
    
    id = Column(Integer, primary_key=True, index=True)
    location = Column(String(100), index=True, nullable=False)
    temperature = Column(DECIMAL(5, 2))
    condition = Column(String(50))
    humidity = Column(Integer)
    wind_speed = Column(DECIMAL(5, 2))
    forecast = Column(JSON)
    recorded_at = Column(DateTime, default=datetime.utcnow)

class MarketPrice(Base):
    __tablename__ = "market_prices"
    
    id = Column(Integer, primary_key=True, index=True)
    crop = Column(String(50), index=True, nullable=False)
    price = Column(DECIMAL(10, 2), nullable=False)
    unit = Column(String(20), nullable=False)
    market = Column(String(100), index=True, nullable=False)
    change_percent = Column(DECIMAL(5, 2))
    recorded_at = Column(DateTime, default=datetime.utcnow)

class PriceHistory(Base):
    __tablename__ = "price_history"
    
    id = Column(Integer, primary_key=True, index=True)
    crop = Column(String(50), nullable=False)
    market = Column(String(100), nullable=False)
    price = Column(DECIMAL(10, 2), nullable=False)
    recorded_date = Column(Date, nullable=False)

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(Enum(MessageType, values_callable=lambda x: [e.value for e in x]), nullable=False)
    content = Column(Text, nullable=False)
    image_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="chat_messages")

class DiseaseDetection(Base):
    __tablename__ = "disease_detections"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    image_url = Column(String(255), nullable=False)
    detected_disease = Column(String(100), nullable=True)
    confidence = Column(DECIMAL(5, 2), nullable=True)
    crop_type = Column(String(50), nullable=True)
    treatment = Column(Text, nullable=True)
    prevention = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="disease_detections")

# ─────────────────────────────────────────────
#  Tags
# ─────────────────────────────────────────────
class Tag(Base):
    """Global tag registry (e.g. #wheat, #organic)"""
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)  # stored lowercase, no #
    post_count = Column(Integer, default=0)     # denormalised counter
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    posts = relationship("PostTag", back_populates="tag", cascade="all, delete-orphan")


class PostTag(Base):
    """Many-to-many: post <-> tag"""
    __tablename__ = "post_tags"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False)
    tag_id = Column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (UniqueConstraint("post_id", "tag_id", name="uq_post_tag"),)

    post = relationship("CommunityPost", back_populates="post_tags")
    tag = relationship("Tag", back_populates="posts")


# ─────────────────────────────────────────────
#  Community Posts  (upgraded)
# ─────────────────────────────────────────────
class CommunityPost(Base):
    __tablename__ = "community_posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Content
    caption = Column(String(500), nullable=True)          # post heading / title
    content = Column(Text, nullable=True)                  # body text
    media_type = Column(
        Enum(PostMediaType, values_callable=lambda x: [e.value for e in x]),
        default=PostMediaType.TEXT, nullable=False
    )
    image_url = Column(String(500), nullable=True)         # primary image
    video_url = Column(String(500), nullable=True)         # primary video
    media_urls = Column(JSON, nullable=True)               # list of extra media URLs
    thumbnail_url = Column(String(500), nullable=True)     # video thumbnail

    # Meta
    location = Column(String(200), nullable=True)
    ai_tags = Column(JSON, nullable=True)                  # AI-suggested tags list
    is_ai_checked = Column(Boolean, default=False)         # harmful content check done
    status = Column(
        Enum(ContentStatus, values_callable=lambda x: [e.value for e in x]),
        default=ContentStatus.ACTIVE, nullable=False, index=True
    )
    flag_reason = Column(String(500), nullable=True)       # why it was flagged/removed

    # Counters (denormalised for fast feed queries)
    likes_count = Column(Integer, default=0, index=True)
    comments_count = Column(Integer, default=0)
    shares_count = Column(Integer, default=0)
    saves_count = Column(Integer, default=0)
    views_count = Column(BigInteger, default=0, index=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="posts")
    likes = relationship("PostLike", back_populates="post", cascade="all, delete-orphan")
    comments = relationship("PostComment", back_populates="post", cascade="all, delete-orphan")
    saves = relationship("PostSave", back_populates="post", cascade="all, delete-orphan")
    shares = relationship("PostShare", back_populates="post", cascade="all, delete-orphan")
    views = relationship("PostView", back_populates="post", cascade="all, delete-orphan")
    post_tags = relationship("PostTag", back_populates="post", cascade="all, delete-orphan")


# ─────────────────────────────────────────────
#  Likes
# ─────────────────────────────────────────────
class PostLike(Base):
    __tablename__ = "post_likes"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_post_like"),)

    post = relationship("CommunityPost", back_populates="likes")
    user = relationship("User", back_populates="post_likes")


# ─────────────────────────────────────────────
#  Comments  (with nested replies)
# ─────────────────────────────────────────────
class PostComment(Base):
    __tablename__ = "post_comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey("post_comments.id", ondelete="CASCADE"), nullable=True, index=True)
    content = Column(Text, nullable=False)
    likes_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    post = relationship("CommunityPost", back_populates="comments")
    user = relationship("User", back_populates="post_comments")
    replies = relationship("PostComment", back_populates="parent",
                           foreign_keys=[parent_id], cascade="all, delete-orphan")
    parent = relationship("PostComment", back_populates="replies",
                          remote_side=[id], foreign_keys=[parent_id])


# ─────────────────────────────────────────────
#  Saves / Bookmarks
# ─────────────────────────────────────────────
class PostSave(Base):
    __tablename__ = "post_saves"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_post_save"),)

    post = relationship("CommunityPost", back_populates="saves")
    user = relationship("User", back_populates="post_saves")


# ─────────────────────────────────────────────
#  Shares
# ─────────────────────────────────────────────
class PostShare(Base):
    __tablename__ = "post_shares"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    share_platform = Column(String(50), nullable=True)   # 'whatsapp', 'external', 'in_app'
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    post = relationship("CommunityPost", back_populates="shares")
    user = relationship("User", back_populates="post_shares")


# ─────────────────────────────────────────────
#  Views  (engagement / reach tracking)
# ─────────────────────────────────────────────
class PostView(Base):
    __tablename__ = "post_views"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    post_id = Column(Integer, ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # NULL = anonymous
    time_spent_seconds = Column(Integer, default=0)       # seconds user spent viewing
    viewed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    post = relationship("CommunityPost", back_populates="views")


# ─────────────────────────────────────────────
#  Follow / Unfollow
# ─────────────────────────────────────────────
class UserFollow(Base):
    """follower_id follows following_id"""
    __tablename__ = "user_follows"

    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    following_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("follower_id", "following_id", name="uq_user_follow"),)

    follower = relationship("User", foreign_keys=[follower_id], back_populates="following")
    following = relationship("User", foreign_keys=[following_id], back_populates="followers")

class GovernmentScheme(Base):
    __tablename__ = "government_schemes"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    title_hi = Column(String(200), nullable=True)
    title_ta = Column(String(200), nullable=True)
    title_te = Column(String(200), nullable=True)
    title_mr = Column(String(200), nullable=True)
    description = Column(Text, nullable=False)
    description_hi = Column(Text, nullable=True)
    description_ta = Column(Text, nullable=True)
    description_te = Column(Text, nullable=True)
    description_mr = Column(Text, nullable=True)
    eligibility = Column(Text, nullable=True)
    eligibility_hi = Column(Text, nullable=True)
    deadline = Column(Date, nullable=True)
    documents_required = Column(JSON, nullable=True)
    application_link = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class UserDocument(Base):
    __tablename__ = "user_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)
    file_url = Column(String(255), nullable=False)
    file_size = Column(String(20), nullable=True)
    document_type = Column(String(50), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="documents")

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(Enum(NotificationType, values_callable=lambda x: [e.value for e in x]), default=NotificationType.INFO)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="notifications")

class ExpertConsultation(Base):
    __tablename__ = "expert_consultations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    query = Column(Text, nullable=False)
    status = Column(Enum(ConsultationStatus, values_callable=lambda x: [e.value for e in x]), default=ConsultationStatus.PENDING)
    expert_id = Column(Integer, nullable=True)
    expert_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="consultations")


class UserActivity(Base):
    __tablename__ = "user_activities"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    activity_type = Column(Enum(ActivityType), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    activity_metadata = Column(JSON, nullable=True)  # Extra context (disease name, crop, confidence, etc.)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    user = relationship("User", back_populates="activities")
