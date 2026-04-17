from app.database import SessionLocal
from app.services.scrapers import run_all_scrapers
import app.models as models

def verify():
    db = SessionLocal()
    try:
        print("Starting manual scraper run...")
        run_all_scrapers(db)
        
        # Verify Market Prices
        market_count = db.query(models.MarketPrice).count()
        states = db.query(models.MarketPrice.state).distinct().all()
        print(f"Total Market Records: {market_count}")
        print(f"States found: {[s[0] for s in states]}")
        
        # Verify Schemes
        scheme_count = db.query(models.GovernmentScheme).count()
        categories = db.query(models.GovernmentScheme.category).distinct().all()
        statuses = db.query(models.GovernmentScheme.status).distinct().all()
        print(f"Total Schemes: {scheme_count}")
        print(f"Categories found: {[c[0] for c in categories]}")
        print(f"Statuses found: {[s[0] for s in statuses]}")
        
    finally:
        db.close()

if __name__ == "__main__":
    verify()
