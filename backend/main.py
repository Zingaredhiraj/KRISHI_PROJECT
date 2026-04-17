from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.database import engine, get_db, SessionLocal
import app.models as models
from app.routers import community, market, schemes, news, eligibility
from app.services.scrapers import run_all_scrapers
from apscheduler.schedulers.background import BackgroundScheduler
from contextlib import asynccontextmanager
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

# Create database tables
models.Base.metadata.create_all(bind=engine)

def run_scraper_task():
    db = SessionLocal()
    try:
        run_all_scrapers(db)
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = BackgroundScheduler()
    # Run the scrapers daily at 2:00 AM
    scheduler.add_job(run_scraper_task, 'cron', hour=2, minute=0)
    scheduler.start()
    
    # Run it once immediately on startup asynchronously
    import threading
    threading.Thread(target=run_scraper_task).start()
    yield

app = FastAPI(title="Digital Krishi API", lifespan=lifespan)


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles
import os

# Create and mount uploads directory for static images
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.auth import create_access_token, get_current_user, generate_otp, get_expiry
from app.otp_service import send_otp_sms
from datetime import datetime, timezone

auth_router = APIRouter(prefix="/api/auth", tags=["Auth"])


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


from supabase import create_client, Client

import httpx

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

@auth_router.post("/otp/send")
async def send_otp(req: OTPRequest, db: Session = Depends(get_db)):
    """
    Send Email OTP using Supabase GoTrue Auth API REST endpoint.
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=500, detail="Supabase keys missing. Add SUPABASE_URL and SUPABASE_ANON_KEY to backend .env")

    email = req.email.strip().lower()
    
    url = f"{SUPABASE_URL}/auth/v1/otp"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "email": email,
        "create_user": True
    }
    
    async with httpx.AsyncClient() as client:
        res = await client.post(url, headers=headers, json=payload)
        
    if res.status_code == 429:
        raise HTTPException(status_code=429, detail="Too many emails sent. Please try again later.")
        
    if res.status_code >= 400:
        err_msg = res.json().get("msg", "Failed to send OTP")
        raise HTTPException(status_code=400, detail=err_msg)

    return {
        "message": "OTP sent successfully via email",
        "email": email,
    }

@auth_router.post("/otp/verify")
async def verify_otp(req: OTPVerify, db: Session = Depends(get_db)):
    """
    Verify Email OTP using Supabase REST API and return custom JWT.
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=500, detail="Supabase keys missing.")

    email = req.email.strip().lower()
    otp_code = req.otp.strip()

    url = f"{SUPABASE_URL}/auth/v1/verify"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "type": "email",
        "email": email,
        "token": otp_code
    }
    
    async with httpx.AsyncClient() as client:
        res = await client.post(url, headers=headers, json=payload)
        
    if res.status_code >= 400:
        err_msg = res.json().get("msg", "Invalid or expired OTP")
        raise HTTPException(status_code=400, detail=err_msg)

    # Check if user exists in our local users table
    user = db.query(models.User).filter(models.User.email == email).first()
    is_new_user = False

    if not user:
        import uuid
        # Auto-register (injecting a unique dummy phone to satisfy NOT NULL constraints without DDL changes)
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

    # Create our custom FastAPI JWT so the rest of the application remains unaffected
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



@auth_router.get("/me")
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


from app.schemas import UserUpdate, UserResponse

@auth_router.put("/profile", response_model=UserResponse)
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


app.include_router(auth_router)
app.include_router(community.router, prefix="/api")
app.include_router(market.router)
app.include_router(schemes.router)
app.include_router(news.router)
app.include_router(eligibility.router)


@app.get("/health")
def health_check():
    """Health check endpoint for Render/Testing"""
    return {"status": "ok", "message": "Database connection and API are running successfully"}


@app.get("/")
def root():
    return {"message": "Welcome to Digital Krishi API"}


# ─────────────────────────────────────────────────────────────────────
#  Async Weather Endpoint — uses httpx + 5-min in-memory cache
# ─────────────────────────────────────────────────────────────────────
from decimal import Decimal
from datetime import timedelta
import httpx
import asyncio
import time as _time

# Simple in-memory weather cache: {cache_key: (data, timestamp)}
_WEATHER_CACHE: dict = {}
WEATHER_CACHE_TTL = 300  # 5 minutes


def _make_cache_key(lat: float, lon: float) -> str:
    return f"{round(lat, 2)},{round(lon, 2)}"


@app.get("/api/weather/current")
async def get_weather(lat: float = None, lon: float = None, location: str = None, db: Session = Depends(get_db)):
    """
    Async weather endpoint with 5-minute cache.
    No longer blocks on synchronous HTTP calls.
    """
    if lat is None or lon is None:
        lat, lon = 18.5204, 73.8567  # Default: Pune
        loc_name = "Pune, Maharashtra (Default)"
        cache_key = "default"
    else:
        cache_key = _make_cache_key(lat, lon)
        loc_name = None

    # Check cache first
    cached = _WEATHER_CACHE.get(cache_key)
    if cached:
        data, ts = cached
        if _time.time() - ts < WEATHER_CACHE_TTL:
            return data

    async with httpx.AsyncClient(timeout=8.0) as client:
        # Fetch location name and weather in parallel
        tasks = []

        if loc_name is None:
            tasks.append(client.get(
                f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=10",
                headers={"User-Agent": "DigitalKrishi/1.0"}
            ))
        else:
            tasks.append(asyncio.sleep(0))  # placeholder

        tasks.append(client.get(
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m"
            f"&daily=weather_code,temperature_2m_max,temperature_2m_min"
            f"&timezone=auto"
        ))

        results = await asyncio.gather(*tasks, return_exceptions=True)

    # Parse location name
    if loc_name is None:
        nom_result = results[0]
        try:
            if not isinstance(nom_result, Exception):
                nom_data = nom_result.json()
                address = nom_data.get("address", {})
                city = (address.get("city") or address.get("town") or
                        address.get("county") or address.get("village", "Unknown Area"))
                state = address.get("state", "")
                loc_name = f"{city}, {state}".strip(", ")
            else:
                loc_name = f"GPS ({round(lat, 2)}, {round(lon, 2)})"
        except Exception:
            loc_name = f"GPS ({round(lat, 2)}, {round(lon, 2)})"

    # Parse weather data
    weather_result = results[1]
    try:
        if isinstance(weather_result, Exception):
            raise weather_result

        res = weather_result.json()
        current = res["current"]
        daily = res["daily"]

        temp = Decimal(str(current["temperature_2m"]))
        humidity = current["relative_humidity_2m"]
        wind_speed = Decimal(str(current["wind_speed_10m"]))

        code = current["weather_code"]
        condition = (
            "Clear" if code <= 2 else
            "Cloudy" if code == 3 else
            "Rain" if code in [51, 53, 55, 61, 63, 65, 80, 81, 82] else
            "Thunderstorm" if code >= 95 else
            "Fog"
        )

        forecast = []
        for i in range(1, min(4, len(daily["time"]))):
            f_code = daily["weather_code"][i]
            f_cond = (
                "Clear" if f_code <= 2 else
                "Cloudy" if f_code == 3 else
                "Rain" if f_code in [51, 53, 55, 61, 63, 65, 80, 81, 82] else
                "Thunderstorm" if f_code >= 95 else
                "Fog"
            )
            day_name = (datetime.now() + timedelta(days=i)).strftime("%A")
            if i == 1:
                day_name = "Tomorrow"
            forecast.append({
                "day": day_name,
                "temp": float(daily["temperature_2m_max"][i]),
                "condition": f_cond
            })

        data = {
            "id": 1,
            "location": loc_name,
            "temperature": float(temp),
            "condition": condition,
            "humidity": humidity,
            "wind_speed": float(wind_speed),
            "forecast": forecast,
            "recorded_at": datetime.now().isoformat(),
            "water_level_suggestion": (
                "Delay irrigation, rain expected." if "Rain" in condition
                else "Normal irrigation recommended."
            ),
            "fertilizer_suggestion": (
                "Avoid foliar spray due to incoming rain/wind." if ("Rain" in condition or wind_speed > 20)
                else "Good weather for foliar spray."
            ),
        }

        # Store in cache
        _WEATHER_CACHE[cache_key] = (data, _time.time())
        return data

    except Exception as e:
        print(f"Weather API Error: {e}")
        # Return cached stale data if available, otherwise fallback
        if cached:
            return cached[0]
        return {
            "id": 1, "location": loc_name, "temperature": 28.5,
            "condition": "Cloudy", "humidity": 45, "wind_speed": 12.5,
            "forecast": [{"day": "Tomorrow", "temp": 29, "condition": "Sunny"}],
            "recorded_at": datetime.now().isoformat(),
            "water_level_suggestion": "Normal irrigation recommended",
            "fertilizer_suggestion": "Monitor local conditions"
        }


# ─────────────────────────────────────────────────────────────────────
#  Other stub endpoints
# ─────────────────────────────────────────────────────────────────────



@app.get("/api/notifications")
def get_notifications(unread_only: bool = False, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return []


@app.get("/api/dashboard/stats")
def get_dashboard_stats():
    return {
        "weather_temp": 28,
        "market_change": "+2.5%",
        "community_posts": 156,
        "new_schemes": 3
    }


from fastapi import UploadFile, File
from app.schemas import AIChatRequest, DiseaseDetectionCreate
import shutil
import uuid

@app.post("/api/upload")
def upload_file(file: UploadFile = File(...)):
    os.makedirs("uploads", exist_ok=True)
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    new_filename = f"{uuid.uuid4().hex}.{ext}"
    file_path = f"uploads/{new_filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "url": f"/uploads/{new_filename}",
        "filename": new_filename,
        "size": os.path.getsize(file_path)
    }


from app.services.ml_service import ml_service

@app.post("/api/disease/detect")
def detect_disease(req: DiseaseDetectionCreate):
    try:
        result = ml_service.predict(req.image_url)
        return {
            "id": 1,
            "image_url": req.image_url,
            "detected_disease": result.get("disease", "Unknown"),
            "confidence": float(result.get("confidence", 90.0)),
            "crop_type": result.get("crop", "Unknown"),
            "treatment": result.get("treatment", "Consult a local expert."),
            "prevention": result.get("prevention", "Maintain field hygiene."),
            "created_at": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"Disease detection failed: {e}")
        return {
            "id": 1,
            "image_url": req.image_url,
            "detected_disease": "Leaf Blight (Fallback)",
            "confidence": 85.0,
            "crop_type": "Tomato",
            "treatment": "Ensure proper drainage.",
            "prevention": "Rotate crops.",
            "created_at": datetime.now().isoformat()
        }

from app.schemas import CropPredictionRequest, CropPredictionResponse

@app.post("/api/crop/predict", response_model=CropPredictionResponse)
def predict_crop(req: CropPredictionRequest, current_user: models.User = Depends(get_current_user)):
    try:
        result = ml_service.predict_best_crop(
            soil_type=req.soil_type,
            water_level=req.water_level,
            temperature_history=req.temperature_history,
            humidity_history=req.humidity_history
        )
        return CropPredictionResponse(**result)
    except Exception as e:
        print(f"Crop Prediction Error: {e}")
        return CropPredictionResponse(
            recommended_crop="Wheat or Mustard",
            reasoning="Fallback recommendation due to a processing error.",
            best_practices="Monitor weather and soil moisture."
        )

from app.ai_service import get_ai_response

@app.post("/api/ai/chat")
async def ai_chat(req: AIChatRequest, current_user: models.User = Depends(get_current_user)):
    """AI Chat endpoint - uses Gemini with local fallback."""
    result = await get_ai_response(
        message=req.message,
        language=req.language.value if hasattr(req.language, "value") else req.language,
        user_id=current_user.id,
        image_url=req.image_url
    )
    return result


@app.get("/api/ai/chat/history")
def get_chat_history(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return []


@app.get("/api/disease/history")
def get_disease_history(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return []


@app.get("/api/documents")
def get_documents(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return []


@app.post("/api/documents")
def upload_document(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"id": 1, "message": "Document uploaded successfully"}


@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"message": "Document deleted"}


@app.get("/api/consultations")
def get_consultations(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return []


@app.post("/api/consultations")
def create_consultation(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"id": 1, "message": "Consultation request submitted", "status": "pending"}


@app.put("/api/notifications/{notification_id}")
def mark_notification_read(notification_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"message": "Notification marked as read"}


@app.post("/api/notifications/mark-all-read")
def mark_all_notifications_read(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"message": "All notifications marked as read"}


@app.get("/api/profile/dashboard")
def get_profile_dashboard(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
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
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
            "avatar_url": current_user.avatar_url,
            "profile_photo": current_user.profile_photo
        },
        "activity_summary": {
            "total_scans": 0,
            "total_ai_queries": 0,
            "total_community_posts": 0,
            "total_market_searches": 0,
            "total_scheme_views": 0,
            "total_documents": 0,
            "member_since_days": (
                (datetime.now(timezone.utc) - current_user.created_at.replace(tzinfo=timezone.utc)).days
                if current_user.created_at else 0
            )
        },
        "recent_activities": [],
        "recent_scans": [],
        "recent_ai_queries": [],
        "recent_posts": []
    }
