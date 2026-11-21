import os
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import app.models as models
from app.database import get_db
from app.auth import create_access_token, get_current_user
from app.schemas import UserUpdate, UserResponse

logger = logging.getLogger("digital_krishi.auth")

router = APIRouter(prefix="/api/auth", tags=["Auth"])


class EmailLoginRequest(BaseModel):
    email: str


class OTPRequest(BaseModel):
    email: str


class OTPVerify(BaseModel):
    email: str
    otp: Optional[str] = None


def normalize_phone(phone: str) -> str:
    """Normalize phone to +91XXXXXXXXXX format."""
    phone = phone.strip().replace(" ", "")
    if not phone.startswith('+'):
        if len(phone) == 10:
            phone = '+91' + phone
        elif len(phone) == 12 and phone.startswith('91'):
            phone = '+' + phone
    return phone


def authenticate_email_user(email_raw: str, db: Session):
    """Directly authenticates or registers a user with just their email."""
    email = email_raw.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address.")

    user = db.query(models.User).filter(models.User.email == email).first()
    is_new_user = False
    if not user:
        import uuid
        user = models.User(
            email=email,
            phone=f"E-{uuid.uuid4().hex[:10]}",
            name="New Farmer",
            is_active=True,
            language="en",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        is_new_user = True

    token = create_access_token(data={"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "is_new_user": is_new_user,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "language": user.language,
            "location": user.location,
            "crop_preferences": user.crop_preferences,
            "avatar_url": user.avatar_url,
        }
    }


@router.post("/login")
async def email_login(req: EmailLoginRequest, db: Session = Depends(get_db)):
    """Direct email login without OTP or password."""
    return authenticate_email_user(req.email, db)


@router.post("/otp/send")
async def send_otp(req: OTPRequest, db: Session = Depends(get_db)):
    """OTP bypass - direct email login enabled."""
    return {
        "message": "OTP verification is disabled. You can log in directly with your email.",
        "email": req.email.strip().lower(),
    }


@router.post("/otp/verify")
async def verify_otp(req: OTPVerify, db: Session = Depends(get_db)):
    """Direct email login without OTP verification."""
    return authenticate_email_user(req.email, db)


@router.get("/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "phone": current_user.phone,
        "location": current_user.location,
        "language": current_user.language,
        "crop_preferences": current_user.crop_preferences,
        "avatar_url": current_user.avatar_url,
    }


@router.put("/profile", response_model=UserResponse)
def update_profile(
    update_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(current_user, key, value)
    db.commit()
    db.refresh(current_user)
    return current_user
