import os
import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import app.models as models
from app.database import get_db
from app.auth import create_access_token, get_current_user
from app.schemas import UserUpdate, UserResponse

router = APIRouter(prefix="/api/auth", tags=["Auth"])

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

class OTPRequest(BaseModel):
    email: str

class OTPVerify(BaseModel):
    email: str
    otp: str

def normalize_phone(phone: str) -> str:
    """Normalize phone to +91XXXXXXXXXX format."""
    phone = phone.strip().replace(" ", "")
    if not phone.startswith('+'):
        if len(phone) == 10:
            phone = '+91' + phone
        elif len(phone) == 12 and phone.startswith('91'):
            phone = '+' + phone
    return phone

@router.post("/otp/send")
async def send_otp(req: OTPRequest, db: Session = Depends(get_db)):
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=500, detail="Supabase keys missing. Add SUPABASE_URL and SUPABASE_ANON_KEY to backend .env")
    email = req.email.strip().lower()
    url = f"{SUPABASE_URL}/auth/v1/otp"
    headers = {"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"}
    payload = {"email": email, "create_user": True}
    
    async with httpx.AsyncClient() as client:
        res = await client.post(url, headers=headers, json=payload)
        
    if res.status_code == 429:
        raise HTTPException(status_code=429, detail="Too many emails sent. Please try again later.")
    if res.status_code >= 400:
        err_msg = res.json().get("msg", "Failed to send OTP")
        raise HTTPException(status_code=400, detail=err_msg)
    return {"message": "OTP sent successfully via email", "email": email}

@router.post("/otp/verify")
async def verify_otp(req: OTPVerify, db: Session = Depends(get_db)):
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=500, detail="Supabase keys missing.")
    email = req.email.strip().lower()
    otp_code = req.otp.strip()
    url = f"{SUPABASE_URL}/auth/v1/verify"
    headers = {"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"}
    payload = {"type": "email", "email": email, "token": otp_code}
    
    async with httpx.AsyncClient() as client:
        res = await client.post(url, headers=headers, json=payload)
        
    if res.status_code >= 400:
        err_msg = res.json().get("msg", "Invalid or expired OTP")
        raise HTTPException(status_code=400, detail=err_msg)
    
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
            "id": user.id, "name": user.name, "email": user.email,
            "phone": user.phone, "language": user.language, "location": user.location,
            "crop_preferences": user.crop_preferences, "avatar_url": user.avatar_url,
        }
    }

@router.get("/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id, "name": current_user.name, "email": current_user.email,
        "phone": current_user.phone, "location": current_user.location,
        "language": current_user.language, "crop_preferences": current_user.crop_preferences,
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
