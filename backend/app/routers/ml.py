from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
import app.models as models
from app.auth import get_current_user
from app.schemas import DiseaseDetectionCreate, CropPredictionRequest, CropPredictionResponse
from app.services.ml_service import ml_service
from datetime import datetime

router = APIRouter(prefix="/api", tags=["Machine Learning"])

@router.post("/disease/detect")
def detect_disease(
    req: DiseaseDetectionCreate,
    current_user: models.User = Depends(get_current_user),
):
    try:
        result = ml_service.predict(req.image_url, crop_hint=req.crop_hint)
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
            "detected_disease": "Detection Temporarily Unavailable",
            "confidence": 40.0,
            "crop_type": req.crop_hint or "Unidentified Crop",
            "treatment": "Unable to complete visual analysis at this time. Please retry in a moment.",
            "prevention": "Ensure good drainage and hygiene.",
            "created_at": datetime.now().isoformat()
        }

@router.post("/crop/predict", response_model=CropPredictionResponse)
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

@router.get("/disease/history")
def get_disease_history(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return []
