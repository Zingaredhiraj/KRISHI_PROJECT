from app.database import SessionLocal
from app.models import User
from uuid import uuid4

db = SessionLocal()
try:
    print("Trying to add user...")
    user = User(
        email=f"tester-{uuid4().hex[:6]}@example.com",
        name="New Farmer",
        is_active=True,
        language="en",
    )
    db.add(user)
    db.commit()
    print("Success")
except Exception as e:
    print(f"Exception: {e}")
finally:
    db.close()
