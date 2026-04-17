import sys
import os

# Ensure app module can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine
from app.models import User, Base

# Create tables in case they don't exist yet
Base.metadata.create_all(bind=engine)

def create_test_user():
    db = SessionLocal()
    try:
        # Check if user already exists
        test_phone = "9876543210"
        existing_user = db.query(User).filter(User.phone == test_phone).first()
        
        if existing_user:
            print(f"✅ User already exists: {existing_user.name} (Phone: {existing_user.phone})")
            return
            
        print("Creating a new test user profile...")
        new_user = User(
            phone=test_phone,
            name="Ramesh Kumar",
            email="ramesh.farmer@example.com",
            location="Maharashtra, India",
            language="mr", # Marathi
            crop_preferences=["Wheat", "Cotton", "Sugarcane"],
            is_active=True
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        print(f"✅ Successfully inserted user profile into Supabase!")
        print(f"ID: {new_user.id}")
        print(f"Name: {new_user.name}")
        print(f"Location: {new_user.location}")
        print(f"Crops: {new_user.crop_preferences}")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error inserting user: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    create_test_user()
