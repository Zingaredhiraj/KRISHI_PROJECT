import os
from pathlib import Path
from pydantic_settings import BaseSettings

# Resolve the absolute path of the backend directory
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "Digital Krishi ML API"
    
    # Model and Data Paths (dynamic, relative to backend root)
    MODEL_PATH: Path = BACKEND_ROOT / "model" / "plant_disease_model.keras"
    DISEASE_INFO_PATH: Path = BACKEND_ROOT / "data" / "disease_info.json"
    SOLUTIONS_PATH: Path = BACKEND_ROOT / "data" / "disease_solutions.json"
    DATASETS_DIR: Path = BACKEND_ROOT / "Datasets"
    UPLOAD_DIR: Path = BACKEND_ROOT / "uploads"
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
