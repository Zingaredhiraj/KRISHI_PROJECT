import requests
import os
from datetime import datetime, timezone
from sqlalchemy.orm import Session
import app.models as models
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("DATA_GOV_IN_API_KEY")
RESOURCE_ID = "9ef2731d-91b2-4eff-b927-f90b17b06a91"
BASE_URL = f"https://api.data.gov.in/resource/{RESOURCE_ID}"

# Mapping internal names to AGMARKNET commodity names
COMMODITY_MAPPING = {
    "Soybean": "Soyabean",
    "Wheat": "Wheat",
    "Harbhara": "Gram",
    "Vatane": "Peas",
    "Rice": "Paddy(Dhan)"
}

def fetch_mandi_prices_from_api(commodity_name: str, limit: int = 15):
    """
    Fetch data from data.gov.in API for a specific commodity.
    """
    if not API_KEY:
        print("DATA_GOV_IN_API_KEY not found in .env. Falling back to sample data.")
        return None

    params = {
        "api-key": API_KEY,
        "format": "json",
        "limit": limit,
        "filters[commodity]": commodity_name
    }

    try:
        response = requests.get(BASE_URL, params=params)
        response.raise_for_status()
        data = response.json()
        return data.get("records", [])
    except Exception as e:
        print(f"Error fetching data from API: {e}")
        return None

def sync_mandi_prices(db: Session):
    """
    Sync mandi prices for all configured crops.
    """
    synced_count = 0
    total_added = 0
    
    for display_name, api_name in COMMODITY_MAPPING.items():
        records = fetch_mandi_prices_from_api(api_name)
        
        if not records:
            # Generate sample data for demonstration if API is unavailable
            records = generate_sample_mandi_data(display_name, api_name)
        
        for rec in records:
            # Parse date safely
            arrival_date_str = rec.get("arrival_date")
            try:
                # Expected format: DD/MM/YYYY
                arrival_date = datetime.strptime(arrival_date_str, "%d/%m/%Y").date()
            except:
                arrival_date = datetime.now(timezone.utc).date()

            # Check if record already exists to prevent duplicates
            # Use (state, market, commodity, arrival_date) as a unique identifier
            existing = db.query(models.MarketPrice).filter(
                models.MarketPrice.state == rec.get("state"),
                models.MarketPrice.market == rec.get("market"),
                models.MarketPrice.crop == display_name,
                models.MarketPrice.date == arrival_date
            ).first()

            if not existing:
                new_price = models.MarketPrice(
                    state=rec.get("state", "India"),
                    district=rec.get("district", "Unknown"),
                    market=rec.get("market", "Unknown"),
                    crop=display_name,
                    min_price=rec.get("min_price"),
                    max_price=rec.get("max_price"),
                    modal_price=rec.get("modal_price"),
                    unit="Quintal",
                    date=arrival_date
                )
                db.add(new_price)
                total_added += 1
            
            synced_count += 1
    
    db.commit()
    return total_added

def generate_sample_mandi_data(display_name, api_name):
    """
    Generates realistic sample data for demo purposes.
    """
    import random
    from datetime import timedelta
    
    states = ["Maharashtra", "Punjab", "Madhya Pradesh", "Karnataka", "Uttar Pradesh"]
    districts = {
        "Maharashtra": ["Pune", "Nashik", "Nagpur", "Latur"],
        "Punjab": ["Ludhiana", "Amritsar", "Patiala"],
        "Madhya Pradesh": ["Indore", "Bhopal", "Ujjain"],
        "Karnataka": ["Dharwad", "Hubballi", "Belagavi"]
    }
    
    # Base prices for different crops
    base_prices = {
        "Soybean": 5200,
        "Wheat": 2400,
        "Harbhara": 4800,
        "Vatane": 4100,
        "Rice": 2800
    }
    
    base = base_prices.get(display_name, 3000)
    sample_records = []
    
    today = datetime.now(timezone.utc)
    
    for _ in range(8):
        state = random.choice(states)
        district = random.choice(districts.get(state, ["District A", "District B"]))
        market = district + " APMC"
        
        modal = base + random.randint(-300, 600)
        min_p = modal - random.randint(100, 400)
        max_p = modal + random.randint(100, 500)
        
        date_offset = random.randint(0, 3)
        arrival_date = (today - timedelta(days=date_offset)).strftime("%d/%m/%Y")
        
        sample_records.append({
            "state": state,
            "district": district,
            "market": market,
            "commodity": api_name,
            "min_price": min_p,
            "max_price": max_p,
            "modal_price": modal,
            "arrival_date": arrival_date
        })
        
    return sample_records
