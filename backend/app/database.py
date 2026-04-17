from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# ── Supabase PostgreSQL ────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Please add your Supabase PostgreSQL URL to the .env file.\n"
        "Example: DATABASE_URL=postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres"
    )

# SQLAlchemy 1.4+ requires "postgresql://" instead of "postgres://"
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,       # Detect stale connections automatically
    pool_recycle=300,         # Recycle connections every 5 min (Supabase idle timeout)
    pool_size=10,             # Increased from default 5 — handles concurrent requests
    max_overflow=20,          # Extra connections beyond pool_size when under load
    pool_timeout=30,          # Wait up to 30s for a connection before raising error
    connect_args={"sslmode": "require"} if not DATABASE_URL.startswith("sqlite") else {},  # Supabase requires SSL
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
