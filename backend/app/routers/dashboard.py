from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.database import get_db
import app.models as models
from app.auth import get_current_user

router = APIRouter(prefix="/api", tags=["Dashboard"])

@router.get("/dashboard/stats")
def get_dashboard_stats():
    return {
        "weather_temp": 28,
        "market_change": "+2.5%",
        "community_posts": 156,
        "new_schemes": 3
    }

@router.get("/profile/dashboard")
def get_profile_dashboard(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {
        "user": {
            "id": current_user.id, "name": current_user.name, "phone": current_user.phone,
            "email": current_user.email, "location": current_user.location, "language": current_user.language,
            "crop_preferences": current_user.crop_preferences, "is_active": current_user.is_active,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
            "avatar_url": current_user.avatar_url, "profile_photo": current_user.profile_photo
        },
        "activity_summary": {
            "total_scans": 0, "total_ai_queries": 0, "total_community_posts": 0,
            "total_market_searches": 0, "total_scheme_views": 0, "total_documents": 0,
            "member_since_days": ((datetime.now(timezone.utc) - current_user.created_at.replace(tzinfo=timezone.utc)).days if current_user.created_at else 0)
        },
        "recent_activities": [],
        "recent_scans": [],
        "recent_ai_queries": [],
        "recent_posts": []
    }
