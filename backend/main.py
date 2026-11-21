import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import ORJSONResponse

from app.database import engine
from app.security import apply_response_headers, check_rate_limit, validate_runtime_config
import app.models as models
from app.routers import (
    auth,
    ai,
    weather,
    dashboard,
    ml,
    community,
    market,
    schemes,
    news,
    eligibility,
    misc,
)

# ── Structured Logging ─────────────────────────────────────────
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("digital_krishi")


# ── Lifespan Event Management ──────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    validate_runtime_config()
    models.Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized successfully.")

    # Guard scraper execution: only run if explicitly enabled
    if os.getenv("ENABLE_STARTUP_SCRAPER", "false").lower() == "true":
        logger.info("ENABLE_STARTUP_SCRAPER=true: Scheduling daily scrapers at 2:00 AM...")
        from apscheduler.schedulers.background import BackgroundScheduler
        from app.services.scrapers import run_all_scrapers
        from app.database import SessionLocal

        def run_scraper_task():
            db = SessionLocal()
            try:
                run_all_scrapers(db)
            finally:
                db.close()

        scheduler = BackgroundScheduler()
        scheduler.add_job(run_scraper_task, 'cron', hour=2, minute=0)
        scheduler.start()

    yield
    logger.info("Digital Krishi API shutting down.")


# ── FastAPI Application ────────────────────────────────────────
app = FastAPI(
    title="Digital Krishi API",
    version="2.0.0",
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

# ── Compression Middleware ────────────────────────────────────
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ── CORS Configuration ─────────────────────────────────────────
cors_env = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001"
)
allow_origins = [origin.strip() for origin in cors_env.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


@app.middleware("http")
async def protect_and_cache(request: Request, call_next):
    limited = check_rate_limit(request)
    if limited is not None:
        return apply_response_headers(request, limited)
    response = await call_next(request)
    return apply_response_headers(request, response)


# ── Static Uploads Mount ───────────────────────────────────────
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── Include Modular Routers ────────────────────────────────────
app.include_router(auth.router)
app.include_router(ai.router)
app.include_router(weather.router)
app.include_router(dashboard.router)
app.include_router(ml.router)
app.include_router(community.router, prefix="/api")
app.include_router(market.router)
app.include_router(schemes.router)
app.include_router(news.router)
app.include_router(eligibility.router)
app.include_router(misc.router)


# ── Health & Root ──────────────────────────────────────────────
@app.get("/health")
@app.get("/healthz")
def health_check():
    return {"status": "ok", "message": "Digital Krishi API is running smoothly"}


@app.get("/")
def root():
    return {"message": "Welcome to Digital Krishi API", "version": "2.0.0"}
