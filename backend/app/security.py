"""Rate limiting, request identity, and production startup checks."""
import os
import time
from collections import defaultdict
from typing import Dict, List, Tuple

from fastapi import Request
from fastapi.responses import JSONResponse

_WEAK_SECRETS = {
    "",
    "change-this-in-production",
    "change-this-to-a-long-random-secret-in-production",
    "digital-krishi-dev-secret-key-32chars-min-len",
    "your-secret-key",
}

# path prefix -> (max_hits, window_seconds)
_ROUTE_LIMITS: List[Tuple[str, int, int]] = [
    ("/api/auth/otp/send", 8, 600),
    ("/api/auth/otp/verify", 15, 600),
    ("/api/ai/chat", 20, 60),
    ("/api/upload", 12, 60),
    ("/api/disease/detect", 10, 60),
    ("/api/crop/predict", 10, 60),
]

_GLOBAL_LIMIT = 180
_GLOBAL_WINDOW = 60

_HITS: Dict[str, List[float]] = defaultdict(list)

_CACHE_HEADERS = (
    ("/api/weather", "public, max-age=300, stale-while-revalidate=60"),
    ("/api/news", "public, max-age=600, stale-while-revalidate=120"),
    ("/api/market", "public, max-age=300, stale-while-revalidate=60"),
    ("/api/schemes", "public, max-age=900, stale-while-revalidate=120"),
)


def environment() -> str:
    return os.getenv("ENVIRONMENT", "development").lower()


def is_production() -> bool:
    return environment() in {"production", "prod"}


def allow_demo_otp() -> bool:
    if is_production():
        return False
    return os.getenv("ALLOW_DEMO_OTP", "false").lower() in {"1", "true", "yes"}


def validate_runtime_config() -> None:
    secret = os.getenv("SECRET_KEY", "")
    db_url = os.getenv("DATABASE_URL", "sqlite:///krishi.db")
    if is_production():
        if secret in _WEAK_SECRETS or len(secret) < 32:
            raise RuntimeError(
                "Refusing to start: set a strong SECRET_KEY (32+ chars) in production."
            )
        if db_url.startswith("sqlite"):
            raise RuntimeError(
                "Refusing to start: SQLite is not durable on Vercel/Render. "
                "Set DATABASE_URL to PostgreSQL (for example Supabase)."
            )


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _prune(bucket: List[float], now: float, window: int) -> List[float]:
    cutoff = now - window
    return [t for t in bucket if t > cutoff]


def check_rate_limit(request: Request):
    if request.method == "OPTIONS":
        return None
    path = request.url.path
    if path in {"/health", "/"}:
        return None

    ip = client_ip(request)
    now = time.time()

    global_key = f"g:{ip}"
    _HITS[global_key] = _prune(_HITS[global_key], now, _GLOBAL_WINDOW)
    if len(_HITS[global_key]) >= _GLOBAL_LIMIT:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Please wait a moment."},
            headers={"Retry-After": "60"},
        )
    _HITS[global_key].append(now)

    for prefix, limit, window in _ROUTE_LIMITS:
        if path.startswith(prefix):
            key = f"{prefix}:{ip}"
            _HITS[key] = _prune(_HITS[key], now, window)
            if len(_HITS[key]) >= limit:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many attempts. Please try again later."},
                    headers={"Retry-After": str(window)},
                )
            _HITS[key].append(now)
            break
    return None


def apply_response_headers(request: Request, response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy", "camera=(), microphone=(), geolocation=(self)"
    )
    if request.method == "GET":
        for prefix, value in _CACHE_HEADERS:
            if request.url.path.startswith(prefix):
                response.headers.setdefault("Cache-Control", value)
                break
    return response
