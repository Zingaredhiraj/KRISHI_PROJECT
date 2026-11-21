from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("digital_krishi.database")

# ── Database Connection (Dual-Mode: SQLite or Supabase PostgreSQL) ──
DATABASE_URL = os.getenv("DATABASE_URL")

# Default to local SQLite if DATABASE_URL is not set
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///krishi.db"
    logger.info("DATABASE_URL not set — falling back to local SQLite: %s", DATABASE_URL)

# SQLAlchemy 1.4+ requires "postgresql://" instead of "postgres://"
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if DATABASE_URL.startswith("sqlite"):
    # SQLite does not support QueuePool arguments (pool_size, max_overflow, sslmode)
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
else:
    # Supabase / PostgreSQL configuration with connection pooling
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,       # Detect stale connections automatically
        pool_recycle=300,         # Recycle connections every 5 min (Supabase idle timeout)
        pool_size=10,             # Handles concurrent requests
        max_overflow=20,          # Extra connections beyond pool_size when under load
        pool_timeout=30,          # Wait up to 30s for a connection before raising error
        connect_args={"sslmode": "require"} if "supabase.co" in DATABASE_URL else {},
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
