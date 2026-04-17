from app.database import SessionLocal
from app.models import User

db = SessionLocal()
try:
    print("Trying to add user...")
    user = User(
        email="test_crash@example.com",
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
