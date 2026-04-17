from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from app.database import get_db
import app.models as models
from app.schemas import EligibilityCheckRequest, EligibilityCheckResponse
from typing import List

router = APIRouter(prefix="/api/eligibility", tags=["Eligibility"])

@router.post("/check", response_model=EligibilityCheckResponse)
def check_eligibility(
    request: EligibilityCheckRequest,
    db: Session = Depends(get_db)
):
    """
    Check farmer eligibility against available government schemes.
    Filters by age, income, land size, category, and optionally state.
    """
    # Base query for active schemes
    query = db.query(models.GovernmentScheme).filter(models.GovernmentScheme.is_active == True)

    eligible_schemes = []
    all_active_schemes = query.all()

    for scheme in all_active_schemes:
        # 1. Check Age (if specified)
        if scheme.min_age and request.age < scheme.min_age:
            continue
        
        # 2. Check Income (if specified)
        if scheme.max_income and request.annual_income > scheme.max_income:
            continue
            
        # 3. Check Land Size (if specified)
        if scheme.min_land_acres and request.land_size_acres < scheme.min_land_acres:
            continue
            
        # 4. Check Category (if specified)
        if scheme.eligible_categories:
            allowed_cats = [c.strip().lower() for c in scheme.eligible_categories.split(",")]
            user_cat = request.category.strip().lower()
            if user_cat not in allowed_cats and "all" not in allowed_cats:
                continue
                
        # 5. Check State (if state-specific)
        if scheme.category == "State" and scheme.state_name:
            if request.state and scheme.state_name.lower() != request.state.lower():
                continue

        eligible_schemes.append(scheme)

    return {
        "eligible_schemes": eligible_schemes,
        "total_found": len(eligible_schemes)
    }
