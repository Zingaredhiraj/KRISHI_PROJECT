from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Using AUTOCOMMIT for DDL commands
engine = create_engine(DATABASE_URL, isolation_level="AUTOCOMMIT")
with engine.connect() as conn:
    print("Dropping NOT NULL constraint on phone...")
    conn.execute(text("ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;"))
    print("Migration committed!")
