from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
import app.models as models
from app.schemas import SchemeResponse
from app.auth import get_current_active_user
from typing import List, Optional

router = APIRouter(prefix="/api/schemes", tags=["Schemes"])

@router.get("", response_model=List[SchemeResponse])
def get_schemes(
    category: Optional[str] = None,  # State / Central
    status: Optional[str] = None,    # Current / Upcoming / Past
    state: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    query = db.query(models.GovernmentScheme).filter(models.GovernmentScheme.is_active == True)

    if search:
        search_term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                models.GovernmentScheme.title.ilike(search_term),
                models.GovernmentScheme.description.ilike(search_term),
                models.GovernmentScheme.eligibility.ilike(search_term)
            )
        )

    if category:
        query = query.filter(models.GovernmentScheme.category.ilike(f"%{category}%"))

    if status:
        query = query.filter(models.GovernmentScheme.status.ilike(f"%{status}%"))

    if state:
        query = query.filter(
            or_(
                models.GovernmentScheme.state_name.ilike(f"%{state}%"),
                models.GovernmentScheme.category == "Central"
            )
        )

    schemes = query.order_by(models.GovernmentScheme.created_at.desc()).offset(offset).limit(limit).all()
    return schemes


@router.post("/{scheme_id}/apply")
def apply_scheme(
    scheme_id: int,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    scheme = db.query(models.GovernmentScheme).filter(models.GovernmentScheme.id == scheme_id).first()
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")

    # Note: No dedicated application table exists yet. This endpoint is a placeholder
    # for client behavior and can be extended to store user applications.
    return {
        "message": "Application request received",
        "scheme_id": scheme.id,
        "scheme_title": scheme.title,
        "application_link": scheme.application_link,
        "user_id": current_user.id,
    }

@router.get("/{id}", response_model=SchemeResponse)
def get_scheme_by_id(id: int, db: Session = Depends(get_db)):
    scheme = db.query(models.GovernmentScheme).filter(models.GovernmentScheme.id == id).first()
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found")
    return scheme
