from app.database import SessionLocal
from app.services.mandi_service import sync_mandi_prices
from app.services.scheme_service import seed_default_schemes

def main():
    db = SessionLocal()
    try:
        print("Starting seeding process...")
        
        # Seed Schemes
        seed_default_schemes(db)
        
        # Sync Mandi Prices
        added_prices = sync_mandi_prices(db)
        print(f"Mandi price synchronization complete. Added {added_prices} new records.")
        
        print("All data seeded successfully!")
    except Exception as e:
        print(f"Error seeding data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
