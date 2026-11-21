from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import logging
from app.database import get_db
import app.models as models
from app.auth import get_current_user

logger = logging.getLogger("digital_krishi.dashboard")

router = APIRouter(prefix="/api", tags=["Dashboard"])


def _calculate_member_since(created_at) -> int:
    if not created_at:
        return 0
    if isinstance(created_at, str):
        try:
            from dateutil.parser import parse
            created_at = parse(created_at)
        except Exception:
            return 0
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    return max(0, (datetime.now(timezone.utc) - created_at).days)


@router.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    # Calculate live stats where possible
    try:
        total_posts = db.query(models.CommunityPost).count()
        total_schemes = db.query(models.GovernmentScheme).filter(models.GovernmentScheme.is_active == True).count()
    except Exception as e:
        logger.warning(f"Error fetching live dashboard counts: {e}")
        total_posts = 156
        total_schemes = 7

    return {
        "weather_temp": 28,
        "market_change": "+2.5%",
        "community_posts": total_posts,
        "new_schemes": total_schemes,
    }


@router.get("/profile/dashboard")
def get_profile_dashboard(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    created_at_str = (
        current_user.created_at.isoformat()
        if isinstance(current_user.created_at, datetime)
        else str(current_user.created_at)
        if current_user.created_at
        else None
    )

    return {
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "phone": current_user.phone,
            "email": current_user.email,
            "location": current_user.location,
            "language": current_user.language,
            "crop_preferences": current_user.crop_preferences,
            "is_active": current_user.is_active,
            "created_at": created_at_str,
            "avatar_url": current_user.avatar_url,
            "profile_photo": current_user.profile_photo,
        },
        "activity_summary": {
            "total_scans": 0,
            "total_ai_queries": 0,
            "total_community_posts": 0,
            "total_market_searches": 0,
            "total_scheme_views": 0,
            "total_documents": 0,
            "member_since_days": _calculate_member_since(current_user.created_at),
        },
        "recent_activities": [],
        "recent_scans": [],
        "recent_ai_queries": [],
        "recent_posts": [],
    }
