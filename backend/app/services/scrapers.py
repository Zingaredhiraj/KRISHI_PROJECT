"""
Scraper service for Digital Krishi.

Market Price Scraping Strategy (3-tier):
  1. Primary:   data.gov.in open-data REST API (structured JSON, free API key)
  2. Secondary: AGMARKNET HTML table scraping with BeautifulSoup
  3. Fallback:  Expanded static/mock data (30+ entries across Maharashtra)

Other scrapers: Government Schemes (india.gov.in), News (Krishi Jagran RSS).
"""

import time
import httpx
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session
from app.models import MarketPrice, GovernmentScheme, NewsArticle
from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation
import os
import random
import traceback

# ═══════════════════════════════════════════════════════════════════════
#  CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════
DATA_GOV_INDIA_API_KEY = os.getenv("DATA_GOV_INDIA_API_KEY", "")

# Target crops for Maharashtra dashboard
TARGET_CROPS = ["Soyabean", "Wheat", "Gram", "Peas", "Rice"]
# Friendly crop name mapping (AGMARKNET uses these commodity names)
CROP_DISPLAY_MAP = {
    "soyabean": "Soybean",
    "soybean": "Soybean",
    "wheat": "Wheat",
    "gram": "Harbhara",
    "gram (chana whole)": "Harbhara",
    "bengal gram(gram)(whole)": "Harbhara",
    "harbhara": "Harbhara",
    "chana": "Harbhara",
    "peas": "Vatane",
    "green peas": "Vatane",
    "vatane": "Vatane",
    "peas (green)": "Vatane",
    "rice": "Rice",
    "paddy(dhan)(common)": "Rice",
    "paddy": "Rice",
}

MAHARASHTRA_STATE = "Maharashtra"
TARGET_STATES = ["Maharashtra", "Punjab", "Uttar Pradesh", "Madhya Pradesh", "Karnataka", "Rajasthan", "Gujarat"]


def _safe_decimal(val) -> Decimal:
    """Safely convert a value to Decimal, return 0 if invalid."""
    try:
        if val is None:
            return Decimal("0")
        return Decimal(str(val).strip().replace(",", ""))
    except (InvalidOperation, ValueError):
        return Decimal("0")


def _normalize_crop(raw_crop: str) -> str:
    """Normalize crop name to one of our 5 target display names."""
    key = raw_crop.strip().lower()
    return CROP_DISPLAY_MAP.get(key, raw_crop.strip().title())


# ═══════════════════════════════════════════════════════════════════════
#  TIER 1: data.gov.in Open Data API
# ═══════════════════════════════════════════════════════════════════════
def _fetch_from_data_gov(db: Session) -> bool:
    """
    Fetch Maharashtra market prices from data.gov.in API.
    Resource: Daily Prices of Various Commodities from Various Markets
    Returns True if data was fetched successfully, False otherwise.
    """
    if not DATA_GOV_INDIA_API_KEY:
        print("Scraper [Tier-1]: No DATA_GOV_INDIA_API_KEY set, skipping data.gov.in.")
        return False

    try:
        # data.gov.in API for daily market prices
        # Resource ID for agricultural market prices
        resource_id = "9ef84268-d588-465a-a308-a864a43d0070"
        
        url = "https://api.data.gov.in/resource/" + resource_id
        
        for state in TARGET_STATES:
            for commodity in TARGET_CROPS:
                params = {
                    "api-key": DATA_GOV_INDIA_API_KEY,
                    "format": "json",
                    "limit": 20,
                    "filters[state]": state,
                    "filters[commodity]": commodity,
                }
                
                try:
                    response = httpx.get(url, params=params, timeout=15,
                                         headers={"User-Agent": "DigitalKrishi/1.0"})
                    
                    if response.status_code != 200:
                        continue
                    
                    data = response.json()
                    records = data.get("records", [])
                    
                    for rec in records:
                        district = rec.get("district", "").strip().title()
                        market = rec.get("market", "").strip().title()
                        commodity_name = _normalize_crop(rec.get("commodity", commodity))
                        min_price = _safe_decimal(rec.get("min_price"))
                        max_price = _safe_decimal(rec.get("max_price"))
                        modal_price = _safe_decimal(rec.get("modal_price"))
                        
                        arrival_date = rec.get("arrival_date", "")
                        try:
                            price_date = datetime.strptime(arrival_date, "%d/%m/%Y").date()
                        except (ValueError, TypeError):
                            price_date = datetime.now(timezone.utc).date()
                        
                        taluka = market.split("(")[0].strip() if "(" in market else market
                        
                        if modal_price <= 0:
                            continue
                        
                        existing = db.query(MarketPrice).filter(
                            MarketPrice.crop == commodity_name,
                            MarketPrice.market == market,
                            MarketPrice.date == price_date
                        ).first()
                        
                        if existing:
                            existing.min_price = min_price
                            existing.max_price = max_price
                            existing.modal_price = modal_price
                            existing.recorded_at = datetime.now(timezone.utc)
                        else:
                            db.add(MarketPrice(
                                state=state,
                                district=district,
                                taluka=taluka,
                                market=market,
                                crop=commodity_name,
                                min_price=min_price,
                                max_price=max_price,
                                modal_price=modal_price,
                                unit="Quintal",
                                date=price_date,
                                recorded_at=datetime.now(timezone.utc)
                            ))
                            count += 1
                except Exception as e:
                    print(f"Error fetching {commodity} for {state}: {e}")
                    continue
                
                time.sleep(0.2)
        
        db.commit()
        print(f"Scraper [Tier-1]: data.gov.in → inserted/updated {count} India records.")
        return count > 0

    except Exception as e:
        print(f"Scraper [Tier-1]: data.gov.in failed: {e}")
        traceback.print_exc()
        db.rollback()
        return False


# ═══════════════════════════════════════════════════════════════════════
#  TIER 2: AGMARKNET BeautifulSoup Scraper
# ═══════════════════════════════════════════════════════════════════════
def _fetch_from_agmarknet(db: Session) -> bool:
    """
    Scrape AGMARKNET (agmarknet.gov.in) for Maharashtra market prices.
    
    Algorithm:
      1. GET the search page → extract __VIEWSTATE + __EVENTVALIDATION
      2. POST with form data: state=Maharashtra, commodity=<crop>, date range
      3. Parse returned HTML table with BeautifulSoup
      4. Extract columns: District, Market, Commodity, Min/Max/Modal Price, Date
      5. Dedup and insert into DB
    
    Returns True if data was fetched, False otherwise.
    """
    try:
        base_url = "https://agmarknet.gov.in/SearchCmmMkt.aspx"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }

        # Step 1: GET the page to extract ASP.NET tokens
        with httpx.Client(timeout=20, follow_redirects=True) as client:
            get_resp = client.get(base_url, headers=headers)
            
            if get_resp.status_code != 200:
                print(f"Scraper [Tier-2]: AGMARKNET GET returned {get_resp.status_code}")
                return False
            
            soup = BeautifulSoup(get_resp.text, "html.parser")
            
            # Extract ASP.NET ViewState tokens
            viewstate = soup.find("input", {"id": "__VIEWSTATE"})
            viewstate_val = viewstate["value"] if viewstate else ""
            
            event_validation = soup.find("input", {"id": "__EVENTVALIDATION"})
            event_val = event_validation["value"] if event_validation else ""
            
            viewstate_gen = soup.find("input", {"id": "__VIEWSTATEGENERATOR"})
            viewstate_gen_val = viewstate_gen["value"] if viewstate_gen else ""
            
            if not viewstate_val:
                print("Scraper [Tier-2]: Could not extract __VIEWSTATE from AGMARKNET")
                return False
            
            count = 0
            today = datetime.now(timezone.utc)
            date_str = today.strftime("%d-%b-%Y")  # e.g., "03-Apr-2026"
            
            # Commodity codes on AGMARKNET for our target crops
            commodity_codes = {
                "Soyabean": "24",
                "Wheat": "1",
                "Gram": "11",
                "Peas": "46",
                "Rice": "57",
            }
            
            for crop_name, crop_code in commodity_codes.items():
                try:
                    # Step 2: POST form data for each crop
                    form_data = {
                        "__VIEWSTATE": viewstate_val,
                        "__VIEWSTATEGENERATOR": viewstate_gen_val,
                        "__EVENTVALIDATION": event_val,
                        "ctl00$cphBody$ddlCommodity": crop_code,
                        "ctl00$cphBody$ddlState": "MH",
                        "ctl00$cphBody$txtDate": date_str,
                        "ctl00$cphBody$btnSearch": "Search",
                    }
                    
                    post_resp = client.post(base_url, data=form_data, headers={
                        **headers,
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Referer": base_url,
                    })
                    
                    if post_resp.status_code != 200:
                        continue
                    
                    # Step 3: Parse HTML table
                    result_soup = BeautifulSoup(post_resp.text, "html.parser")
                    table = result_soup.find("table", {"id": "cphBody_GridPriceData"})
                    
                    if not table:
                        # Try alternative table IDs
                        table = result_soup.find("table", class_="tableagmark_new")
                    
                    if not table:
                        continue
                    
                    rows = table.find_all("tr")[1:]  # Skip header row
                    
                    for row in rows:
                        cols = row.find_all("td")
                        if len(cols) < 8:
                            continue
                        
                        try:
                            # Step 4: Extract column data
                            district = cols[1].get_text(strip=True).title()
                            market_name = cols[2].get_text(strip=True).title()
                            commodity = _normalize_crop(cols[3].get_text(strip=True))
                            min_price = _safe_decimal(cols[5].get_text(strip=True))
                            max_price = _safe_decimal(cols[6].get_text(strip=True))
                            modal_price = _safe_decimal(cols[7].get_text(strip=True))
                            
                            date_text = cols[8].get_text(strip=True) if len(cols) > 8 else date_str
                            try:
                                price_date = datetime.strptime(date_text, "%d %b %Y").date()
                            except ValueError:
                                try:
                                    price_date = datetime.strptime(date_text, "%d/%m/%Y").date()
                                except ValueError:
                                    price_date = today.date()
                            
                            taluka = market_name
                            
                            if modal_price <= 0:
                                continue
                            
                            # Step 5: Dedup on (crop, market, date)
                            existing = db.query(MarketPrice).filter(
                                MarketPrice.crop == commodity,
                                MarketPrice.market == market_name,
                                MarketPrice.date == price_date
                            ).first()
                            
                            if existing:
                                existing.min_price = min_price
                                existing.max_price = max_price
                                existing.modal_price = modal_price
                                existing.recorded_at = datetime.now(timezone.utc)
                            else:
                                db.add(MarketPrice(
                                    state=MAHARASHTRA_STATE,
                                    district=district,
                                    taluka=taluka,
                                    market=market_name,
                                    crop=commodity,
                                    min_price=min_price,
                                    max_price=max_price,
                                    modal_price=modal_price,
                                    unit="Quintal",
                                    date=price_date,
                                    recorded_at=datetime.now(timezone.utc)
                                ))
                                count += 1
                        
                        except (IndexError, ValueError) as row_err:
                            continue
                    
                    time.sleep(0.5)  # Rate limit
                    
                except Exception as crop_err:
                    print(f"Scraper [Tier-2]: AGMARKNET error for {crop_name}: {crop_err}")
                    continue
        
        db.commit()
        print(f"Scraper [Tier-2]: AGMARKNET → inserted/updated {count} records.")
        return count > 0

    except Exception as e:
        print(f"Scraper [Tier-2]: AGMARKNET scraping failed: {e}")
        traceback.print_exc()
        db.rollback()
        return False


# ═══════════════════════════════════════════════════════════════════════
#  TIER 3: Expanded Mock/Static Data — ALL 36 MAHARASHTRA DISTRICTS
# ═══════════════════════════════════════════════════════════════════════
def _insert_mock_market_prices(db: Session):
    """
    Insert realistic mock market price data for ALL 36 districts of Maharashtra.
    Each district has 2-5 talukas with prices for all 5 target crops distributed.
    Total: ~200+ entries for today + yesterday trend data.
    """
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)

    # ─── All 36 Maharashtra districts with talukas & APMC markets ───
    # Each entry: district, taluka, market, crop, min, max, modal
    crops_data = [
        # ═══ 1. Ahmednagar ═══
        {"district": "Ahmednagar", "taluka": "Rahuri", "market": "Rahuri APMC", "crop": "Harbhara", "min": 5000, "max": 5400, "modal": 5250, "date": today},
        {"district": "Ahmednagar", "taluka": "Shrirampur", "market": "Shrirampur APMC", "crop": "Wheat", "min": 2300, "max": 2550, "modal": 2450, "date": today},
        {"district": "Ahmednagar", "taluka": "Kopargaon", "market": "Kopargaon APMC", "crop": "Soybean", "min": 4350, "max": 4750, "modal": 4600, "date": today},
        {"district": "Ahmednagar", "taluka": "Sangamner", "market": "Sangamner APMC", "crop": "Rice", "min": 3200, "max": 3600, "modal": 3400, "date": today},
        {"district": "Ahmednagar", "taluka": "Shevgaon", "market": "Shevgaon APMC", "crop": "Vatane", "min": 3900, "max": 4250, "modal": 4100, "date": today},

        # ═══ 2. Akola ═══
        {"district": "Akola", "taluka": "Akola", "market": "Akola APMC", "crop": "Soybean", "min": 4350, "max": 4800, "modal": 4600, "date": today},
        {"district": "Akola", "taluka": "Akot", "market": "Akot APMC", "crop": "Harbhara", "min": 5100, "max": 5500, "modal": 5350, "date": today},
        {"district": "Akola", "taluka": "Murtizapur", "market": "Murtizapur APMC", "crop": "Wheat", "min": 2200, "max": 2450, "modal": 2350, "date": today},
        {"district": "Akola", "taluka": "Telhara", "market": "Telhara APMC", "crop": "Rice", "min": 3100, "max": 3500, "modal": 3300, "date": today},

        # ═══ 3. Amravati ═══
        {"district": "Amravati", "taluka": "Amravati", "market": "Amravati APMC", "crop": "Soybean", "min": 4400, "max": 4850, "modal": 4650, "date": today},
        {"district": "Amravati", "taluka": "Achalpur", "market": "Achalpur APMC", "crop": "Wheat", "min": 2250, "max": 2500, "modal": 2400, "date": today},
        {"district": "Amravati", "taluka": "Morshi", "market": "Morshi APMC", "crop": "Harbhara", "min": 5200, "max": 5600, "modal": 5400, "date": today},
        {"district": "Amravati", "taluka": "Chandur Bazar", "market": "Chandur Bazar APMC", "crop": "Vatane", "min": 3800, "max": 4200, "modal": 4050, "date": today},

        # ═══ 4. Aurangabad (Chhatrapati Sambhajinagar) ═══
        {"district": "Aurangabad", "taluka": "Aurangabad", "market": "Aurangabad APMC", "crop": "Soybean", "min": 4450, "max": 4850, "modal": 4700, "date": today},
        {"district": "Aurangabad", "taluka": "Paithan", "market": "Paithan APMC", "crop": "Harbhara", "min": 5150, "max": 5550, "modal": 5350, "date": today},
        {"district": "Aurangabad", "taluka": "Vaijapur", "market": "Vaijapur APMC", "crop": "Vatane", "min": 3700, "max": 4100, "modal": 3950, "date": today},
        {"district": "Aurangabad", "taluka": "Gangapur", "market": "Gangapur APMC", "crop": "Wheat", "min": 2200, "max": 2450, "modal": 2350, "date": today},
        {"district": "Aurangabad", "taluka": "Khuldabad", "market": "Khuldabad APMC", "crop": "Rice", "min": 3150, "max": 3550, "modal": 3400, "date": today},

        # ═══ 5. Beed ═══
        {"district": "Beed", "taluka": "Beed", "market": "Beed APMC", "crop": "Soybean", "min": 4300, "max": 4750, "modal": 4550, "date": today},
        {"district": "Beed", "taluka": "Georai", "market": "Georai APMC", "crop": "Harbhara", "min": 5150, "max": 5500, "modal": 5350, "date": today},
        {"district": "Beed", "taluka": "Majalgaon", "market": "Majalgaon APMC", "crop": "Wheat", "min": 2180, "max": 2400, "modal": 2300, "date": today},
        {"district": "Beed", "taluka": "Ambejogai", "market": "Ambejogai APMC", "crop": "Vatane", "min": 3850, "max": 4200, "modal": 4050, "date": today},

        # ═══ 6. Bhandara ═══
        {"district": "Bhandara", "taluka": "Bhandara", "market": "Bhandara APMC", "crop": "Rice", "min": 3150, "max": 3550, "modal": 3350, "date": today},
        {"district": "Bhandara", "taluka": "Tumsar", "market": "Tumsar APMC", "crop": "Rice", "min": 3300, "max": 3800, "modal": 3500, "date": today},
        {"district": "Bhandara", "taluka": "Pauni", "market": "Pauni APMC", "crop": "Soybean", "min": 4200, "max": 4600, "modal": 4400, "date": today},
        {"district": "Bhandara", "taluka": "Mohadi", "market": "Mohadi APMC", "crop": "Wheat", "min": 2150, "max": 2380, "modal": 2280, "date": today},

        # ═══ 7. Buldhana ═══
        {"district": "Buldhana", "taluka": "Buldhana", "market": "Buldhana APMC", "crop": "Soybean", "min": 4380, "max": 4820, "modal": 4620, "date": today},
        {"district": "Buldhana", "taluka": "Chikhli", "market": "Chikhli APMC", "crop": "Harbhara", "min": 5100, "max": 5480, "modal": 5300, "date": today},
        {"district": "Buldhana", "taluka": "Khamgaon", "market": "Khamgaon APMC", "crop": "Wheat", "min": 2220, "max": 2470, "modal": 2370, "date": today},
        {"district": "Buldhana", "taluka": "Malkapur", "market": "Malkapur APMC", "crop": "Vatane", "min": 3780, "max": 4180, "modal": 4000, "date": today},

        # ═══ 8. Chandrapur ═══
        {"district": "Chandrapur", "taluka": "Chandrapur", "market": "Chandrapur APMC", "crop": "Rice", "min": 3250, "max": 3700, "modal": 3500, "date": today},
        {"district": "Chandrapur", "taluka": "Warora", "market": "Warora APMC", "crop": "Soybean", "min": 4280, "max": 4680, "modal": 4500, "date": today},
        {"district": "Chandrapur", "taluka": "Bramhapuri", "market": "Bramhapuri APMC", "crop": "Wheat", "min": 2180, "max": 2420, "modal": 2320, "date": today},
        {"district": "Chandrapur", "taluka": "Mul", "market": "Mul APMC", "crop": "Harbhara", "min": 5050, "max": 5400, "modal": 5250, "date": today},

        # ═══ 9. Dhule ═══
        {"district": "Dhule", "taluka": "Dhule", "market": "Dhule APMC", "crop": "Wheat", "min": 2250, "max": 2500, "modal": 2400, "date": today},
        {"district": "Dhule", "taluka": "Shirpur", "market": "Shirpur APMC", "crop": "Harbhara", "min": 5100, "max": 5450, "modal": 5300, "date": today},
        {"district": "Dhule", "taluka": "Sakri", "market": "Sakri APMC", "crop": "Soybean", "min": 4300, "max": 4700, "modal": 4550, "date": today},

        # ═══ 10. Gadchiroli ═══
        {"district": "Gadchiroli", "taluka": "Gadchiroli", "market": "Gadchiroli APMC", "crop": "Rice", "min": 3200, "max": 3650, "modal": 3450, "date": today},
        {"district": "Gadchiroli", "taluka": "Desaiganj", "market": "Desaiganj APMC", "crop": "Soybean", "min": 4250, "max": 4650, "modal": 4480, "date": today},
        {"district": "Gadchiroli", "taluka": "Armori", "market": "Armori APMC", "crop": "Wheat", "min": 2150, "max": 2400, "modal": 2300, "date": today},

        # ═══ 11. Gondia ═══
        {"district": "Gondia", "taluka": "Gondia", "market": "Gondia APMC", "crop": "Rice", "min": 3300, "max": 3750, "modal": 3550, "date": today},
        {"district": "Gondia", "taluka": "Tirora", "market": "Tirora APMC", "crop": "Soybean", "min": 4320, "max": 4720, "modal": 4540, "date": today},
        {"district": "Gondia", "taluka": "Goregaon", "market": "Goregaon APMC", "crop": "Harbhara", "min": 5150, "max": 5500, "modal": 5350, "date": today},

        # ═══ 12. Hingoli ═══
        {"district": "Hingoli", "taluka": "Hingoli", "market": "Hingoli APMC", "crop": "Soybean", "min": 4400, "max": 4800, "modal": 4650, "date": today},
        {"district": "Hingoli", "taluka": "Sengaon", "market": "Sengaon APMC", "crop": "Harbhara", "min": 5200, "max": 5600, "modal": 5400, "date": today},
        {"district": "Hingoli", "taluka": "Kalamnuri", "market": "Kalamnuri APMC", "crop": "Wheat", "min": 2200, "max": 2450, "modal": 2350, "date": today},

        # ═══ 13. Jalgaon ═══
        {"district": "Jalgaon", "taluka": "Jalgaon", "market": "Jalgaon APMC", "crop": "Wheat", "min": 2280, "max": 2520, "modal": 2420, "date": today},
        {"district": "Jalgaon", "taluka": "Bhusawal", "market": "Bhusawal APMC", "crop": "Soybean", "min": 4350, "max": 4750, "modal": 4580, "date": today},
        {"district": "Jalgaon", "taluka": "Chopda", "market": "Chopda APMC", "crop": "Harbhara", "min": 5080, "max": 5480, "modal": 5300, "date": today},
        {"district": "Jalgaon", "taluka": "Amalner", "market": "Amalner APMC", "crop": "Vatane", "min": 3850, "max": 4200, "modal": 4050, "date": today},
        {"district": "Jalgaon", "taluka": "Pachora", "market": "Pachora APMC", "crop": "Rice", "min": 3100, "max": 3500, "modal": 3300, "date": today},

        # ═══ 14. Jalna ═══
        {"district": "Jalna", "taluka": "Jalna", "market": "Jalna APMC", "crop": "Soybean", "min": 4400, "max": 4800, "modal": 4650, "date": today},
        {"district": "Jalna", "taluka": "Ambad", "market": "Ambad APMC", "crop": "Harbhara", "min": 5050, "max": 5400, "modal": 5250, "date": today},
        {"district": "Jalna", "taluka": "Partur", "market": "Partur APMC", "crop": "Wheat", "min": 2200, "max": 2440, "modal": 2340, "date": today},
        {"district": "Jalna", "taluka": "Bhokardan", "market": "Bhokardan APMC", "crop": "Vatane", "min": 3800, "max": 4200, "modal": 4020, "date": today},

        # ═══ 15. Kolhapur ═══
        {"district": "Kolhapur", "taluka": "Kolhapur", "market": "Kolhapur APMC", "crop": "Rice", "min": 3400, "max": 3800, "modal": 3600, "date": today},
        {"district": "Kolhapur", "taluka": "Hatkanangle", "market": "Ichalkaranji APMC", "crop": "Vatane", "min": 3850, "max": 4250, "modal": 4050, "date": today},
        {"district": "Kolhapur", "taluka": "Shirol", "market": "Shirol APMC", "crop": "Wheat", "min": 2200, "max": 2450, "modal": 2350, "date": today},
        {"district": "Kolhapur", "taluka": "Gadhinglaj", "market": "Gadhinglaj APMC", "crop": "Soybean", "min": 4300, "max": 4700, "modal": 4520, "date": today},
        {"district": "Kolhapur", "taluka": "Kagal", "market": "Kagal APMC", "crop": "Harbhara", "min": 5050, "max": 5400, "modal": 5250, "date": today},

        # ═══ 16. Latur ═══
        {"district": "Latur", "taluka": "Latur", "market": "Latur APMC", "crop": "Soybean", "min": 4500, "max": 5000, "modal": 4800, "date": today},
        {"district": "Latur", "taluka": "Udgir", "market": "Udgir APMC", "crop": "Harbhara", "min": 5300, "max": 5700, "modal": 5500, "date": today},
        {"district": "Latur", "taluka": "Nilanga", "market": "Nilanga APMC", "crop": "Wheat", "min": 2250, "max": 2500, "modal": 2400, "date": today},
        {"district": "Latur", "taluka": "Ausa", "market": "Ausa APMC", "crop": "Vatane", "min": 3850, "max": 4250, "modal": 4080, "date": today},
        {"district": "Latur", "taluka": "Ahmedpur", "market": "Ahmedpur APMC", "crop": "Rice", "min": 3200, "max": 3600, "modal": 3420, "date": today},

        # ═══ 17. Mumbai City ═══
        {"district": "Mumbai City", "taluka": "Mumbai", "market": "Vashi APMC", "crop": "Rice", "min": 3500, "max": 4000, "modal": 3800, "date": today},
        {"district": "Mumbai City", "taluka": "Mumbai", "market": "Vashi APMC", "crop": "Wheat", "min": 2400, "max": 2700, "modal": 2580, "date": today},

        # ═══ 18. Mumbai Suburban ═══
        {"district": "Mumbai Suburban", "taluka": "Andheri", "market": "Andheri APMC", "crop": "Rice", "min": 3450, "max": 3900, "modal": 3700, "date": today},
        {"district": "Mumbai Suburban", "taluka": "Borivali", "market": "Borivali APMC", "crop": "Wheat", "min": 2380, "max": 2650, "modal": 2550, "date": today},

        # ═══ 19. Nagpur ═══
        {"district": "Nagpur", "taluka": "Nagpur", "market": "Nagpur APMC", "crop": "Wheat", "min": 2280, "max": 2480, "modal": 2400, "date": today},
        {"district": "Nagpur", "taluka": "Katol", "market": "Katol APMC", "crop": "Rice", "min": 3250, "max": 3650, "modal": 3450, "date": today},
        {"district": "Nagpur", "taluka": "Kamptee", "market": "Kamptee APMC", "crop": "Soybean", "min": 4250, "max": 4650, "modal": 4500, "date": today},
        {"district": "Nagpur", "taluka": "Ramtek", "market": "Ramtek APMC", "crop": "Harbhara", "min": 5100, "max": 5500, "modal": 5300, "date": today},
        {"district": "Nagpur", "taluka": "Umred", "market": "Umred APMC", "crop": "Vatane", "min": 3800, "max": 4200, "modal": 4050, "date": today},

        # ═══ 20. Nanded ═══
        {"district": "Nanded", "taluka": "Nanded", "market": "Nanded APMC", "crop": "Soybean", "min": 4420, "max": 4820, "modal": 4650, "date": today},
        {"district": "Nanded", "taluka": "Deglur", "market": "Deglur APMC", "crop": "Harbhara", "min": 5200, "max": 5600, "modal": 5420, "date": today},
        {"district": "Nanded", "taluka": "Mukhed", "market": "Mukhed APMC", "crop": "Wheat", "min": 2200, "max": 2450, "modal": 2350, "date": today},
        {"district": "Nanded", "taluka": "Kinwat", "market": "Kinwat APMC", "crop": "Rice", "min": 3150, "max": 3550, "modal": 3380, "date": today},

        # ═══ 21. Nandurbar ═══
        {"district": "Nandurbar", "taluka": "Nandurbar", "market": "Nandurbar APMC", "crop": "Wheat", "min": 2200, "max": 2480, "modal": 2370, "date": today},
        {"district": "Nandurbar", "taluka": "Shahada", "market": "Shahada APMC", "crop": "Soybean", "min": 4280, "max": 4680, "modal": 4500, "date": today},
        {"district": "Nandurbar", "taluka": "Taloda", "market": "Taloda APMC", "crop": "Rice", "min": 3100, "max": 3500, "modal": 3320, "date": today},

        # ═══ 22. Nashik ═══
        {"district": "Nashik", "taluka": "Malegaon", "market": "Malegaon APMC", "crop": "Harbhara", "min": 5100, "max": 5500, "modal": 5300, "date": today},
        {"district": "Nashik", "taluka": "Niphad", "market": "Lasalgaon APMC", "crop": "Wheat", "min": 2100, "max": 2350, "modal": 2250, "date": today},
        {"district": "Nashik", "taluka": "Sinnar", "market": "Sinnar APMC", "crop": "Soybean", "min": 4300, "max": 4700, "modal": 4550, "date": today},
        {"district": "Nashik", "taluka": "Nashik", "market": "Nashik APMC", "crop": "Rice", "min": 3200, "max": 3600, "modal": 3420, "date": today},
        {"district": "Nashik", "taluka": "Yeola", "market": "Yeola APMC", "crop": "Vatane", "min": 3850, "max": 4200, "modal": 4060, "date": today},

        # ═══ 23. Osmanabad (Dharashiv) ═══
        {"district": "Osmanabad", "taluka": "Osmanabad", "market": "Osmanabad APMC", "crop": "Soybean", "min": 4380, "max": 4780, "modal": 4600, "date": today},
        {"district": "Osmanabad", "taluka": "Tuljapur", "market": "Tuljapur APMC", "crop": "Harbhara", "min": 5180, "max": 5580, "modal": 5400, "date": today},
        {"district": "Osmanabad", "taluka": "Omerga", "market": "Omerga APMC", "crop": "Wheat", "min": 2220, "max": 2470, "modal": 2370, "date": today},
        {"district": "Osmanabad", "taluka": "Kalamb", "market": "Kalamb APMC", "crop": "Vatane", "min": 3800, "max": 4180, "modal": 4020, "date": today},

        # ═══ 24. Palghar ═══
        {"district": "Palghar", "taluka": "Palghar", "market": "Palghar APMC", "crop": "Rice", "min": 3350, "max": 3800, "modal": 3600, "date": today},
        {"district": "Palghar", "taluka": "Vasai", "market": "Vasai APMC", "crop": "Wheat", "min": 2350, "max": 2600, "modal": 2500, "date": today},
        {"district": "Palghar", "taluka": "Dahanu", "market": "Dahanu APMC", "crop": "Rice", "min": 3280, "max": 3680, "modal": 3500, "date": today},

        # ═══ 25. Parbhani ═══
        {"district": "Parbhani", "taluka": "Parbhani", "market": "Parbhani APMC", "crop": "Soybean", "min": 4380, "max": 4780, "modal": 4600, "date": today},
        {"district": "Parbhani", "taluka": "Gangakhed", "market": "Gangakhed APMC", "crop": "Harbhara", "min": 5150, "max": 5550, "modal": 5380, "date": today},
        {"district": "Parbhani", "taluka": "Jintur", "market": "Jintur APMC", "crop": "Wheat", "min": 2200, "max": 2450, "modal": 2340, "date": today},
        {"district": "Parbhani", "taluka": "Pathri", "market": "Pathri APMC", "crop": "Vatane", "min": 3850, "max": 4200, "modal": 4050, "date": today},

        # ═══ 26. Pune ═══
        {"district": "Pune", "taluka": "Baramati", "market": "Baramati APMC", "crop": "Wheat", "min": 2200, "max": 2450, "modal": 2350, "date": today},
        {"district": "Pune", "taluka": "Indapur", "market": "Indapur APMC", "crop": "Soybean", "min": 4100, "max": 4650, "modal": 4500, "date": today},
        {"district": "Pune", "taluka": "Daund", "market": "Daund APMC", "crop": "Harbhara", "min": 5200, "max": 5600, "modal": 5450, "date": today},
        {"district": "Pune", "taluka": "Shirur", "market": "Shirur APMC", "crop": "Vatane", "min": 3900, "max": 4300, "modal": 4100, "date": today},
        {"district": "Pune", "taluka": "Junnar", "market": "Junnar APMC", "crop": "Rice", "min": 3100, "max": 3500, "modal": 3350, "date": today},

        # ═══ 27. Raigad ═══
        {"district": "Raigad", "taluka": "Panvel", "market": "Panvel APMC", "crop": "Rice", "min": 3200, "max": 3600, "modal": 3400, "date": today},
        {"district": "Raigad", "taluka": "Alibag", "market": "Alibag APMC", "crop": "Rice", "min": 3300, "max": 3700, "modal": 3500, "date": today},
        {"district": "Raigad", "taluka": "Pen", "market": "Pen APMC", "crop": "Wheat", "min": 2250, "max": 2500, "modal": 2400, "date": today},
        {"district": "Raigad", "taluka": "Karjat", "market": "Karjat APMC", "crop": "Soybean", "min": 4200, "max": 4600, "modal": 4420, "date": today},

        # ═══ 28. Ratnagiri ═══
        {"district": "Ratnagiri", "taluka": "Ratnagiri", "market": "Ratnagiri APMC", "crop": "Rice", "min": 3400, "max": 3850, "modal": 3650, "date": today},
        {"district": "Ratnagiri", "taluka": "Chiplun", "market": "Chiplun APMC", "crop": "Rice", "min": 3350, "max": 3780, "modal": 3580, "date": today},
        {"district": "Ratnagiri", "taluka": "Khed", "market": "Khed APMC", "crop": "Wheat", "min": 2280, "max": 2520, "modal": 2420, "date": today},

        # ═══ 29. Sangli ═══
        {"district": "Sangli", "taluka": "Miraj", "market": "Miraj APMC", "crop": "Wheat", "min": 2180, "max": 2380, "modal": 2300, "date": today},
        {"district": "Sangli", "taluka": "Tasgaon", "market": "Tasgaon APMC", "crop": "Harbhara", "min": 5100, "max": 5450, "modal": 5300, "date": today},
        {"district": "Sangli", "taluka": "Vita", "market": "Vita APMC", "crop": "Soybean", "min": 4300, "max": 4700, "modal": 4520, "date": today},
        {"district": "Sangli", "taluka": "Atpadi", "market": "Atpadi APMC", "crop": "Vatane", "min": 3800, "max": 4200, "modal": 4020, "date": today},

        # ═══ 30. Satara ═══
        {"district": "Satara", "taluka": "Satara", "market": "Satara APMC", "crop": "Rice", "min": 3300, "max": 3700, "modal": 3520, "date": today},
        {"district": "Satara", "taluka": "Karad", "market": "Karad APMC", "crop": "Wheat", "min": 2250, "max": 2500, "modal": 2400, "date": today},
        {"district": "Satara", "taluka": "Wai", "market": "Wai APMC", "crop": "Soybean", "min": 4300, "max": 4700, "modal": 4520, "date": today},
        {"district": "Satara", "taluka": "Phaltan", "market": "Phaltan APMC", "crop": "Harbhara", "min": 5100, "max": 5500, "modal": 5320, "date": today},
        {"district": "Satara", "taluka": "Man", "market": "Dahiwadi APMC", "crop": "Vatane", "min": 3850, "max": 4250, "modal": 4080, "date": today},

        # ═══ 31. Sindhudurg ═══
        {"district": "Sindhudurg", "taluka": "Sindhudurg", "market": "Kudal APMC", "crop": "Rice", "min": 3350, "max": 3800, "modal": 3600, "date": today},
        {"district": "Sindhudurg", "taluka": "Sawantwadi", "market": "Sawantwadi APMC", "crop": "Rice", "min": 3300, "max": 3750, "modal": 3550, "date": today},

        # ═══ 32. Solapur ═══
        {"district": "Solapur", "taluka": "Akkalkot", "market": "Akkalkot APMC", "crop": "Vatane", "min": 3800, "max": 4200, "modal": 4000, "date": today},
        {"district": "Solapur", "taluka": "Pandharpur", "market": "Pandharpur APMC", "crop": "Wheat", "min": 2150, "max": 2400, "modal": 2300, "date": today},
        {"district": "Solapur", "taluka": "Barshi", "market": "Barshi APMC", "crop": "Soybean", "min": 4200, "max": 4600, "modal": 4450, "date": today},
        {"district": "Solapur", "taluka": "Karmala", "market": "Karmala APMC", "crop": "Harbhara", "min": 5100, "max": 5480, "modal": 5300, "date": today},
        {"district": "Solapur", "taluka": "Madha", "market": "Madha APMC", "crop": "Rice", "min": 3150, "max": 3550, "modal": 3380, "date": today},

        # ═══ 33. Thane ═══
        {"district": "Thane", "taluka": "Thane", "market": "Thane APMC", "crop": "Rice", "min": 3400, "max": 3850, "modal": 3650, "date": today},
        {"district": "Thane", "taluka": "Bhiwandi", "market": "Bhiwandi APMC", "crop": "Wheat", "min": 2350, "max": 2600, "modal": 2500, "date": today},
        {"district": "Thane", "taluka": "Kalyan", "market": "Kalyan APMC", "crop": "Soybean", "min": 4350, "max": 4750, "modal": 4580, "date": today},

        # ═══ 34. Wardha ═══
        {"district": "Wardha", "taluka": "Wardha", "market": "Wardha APMC", "crop": "Soybean", "min": 4380, "max": 4780, "modal": 4600, "date": today},
        {"district": "Wardha", "taluka": "Arvi", "market": "Arvi APMC", "crop": "Harbhara", "min": 5150, "max": 5550, "modal": 5380, "date": today},
        {"district": "Wardha", "taluka": "Hinganghat", "market": "Hinganghat APMC", "crop": "Wheat", "min": 2220, "max": 2470, "modal": 2370, "date": today},
        {"district": "Wardha", "taluka": "Deoli", "market": "Deoli APMC", "crop": "Rice", "min": 3200, "max": 3600, "modal": 3420, "date": today},

        # ═══ 35. Washim ═══
        {"district": "Washim", "taluka": "Washim", "market": "Washim APMC", "crop": "Soybean", "min": 4350, "max": 4750, "modal": 4580, "date": today},
        {"district": "Washim", "taluka": "Risod", "market": "Risod APMC", "crop": "Harbhara", "min": 5100, "max": 5500, "modal": 5320, "date": today},
        {"district": "Washim", "taluka": "Mangrulpir", "market": "Mangrulpir APMC", "crop": "Wheat", "min": 2200, "max": 2450, "modal": 2350, "date": today},

        # ═══ 36. Yavatmal ═══
        {"district": "Yavatmal", "taluka": "Yavatmal", "market": "Yavatmal APMC", "crop": "Soybean", "min": 4400, "max": 4800, "modal": 4620, "date": today},
        {"district": "Yavatmal", "taluka": "Pusad", "market": "Pusad APMC", "crop": "Harbhara", "min": 5200, "max": 5600, "modal": 5420, "date": today},
        {"district": "Yavatmal", "taluka": "Wani", "market": "Wani APMC", "crop": "Wheat", "min": 2180, "max": 2430, "modal": 2320, "date": today},
        {"district": "Yavatmal", "taluka": "Darwha", "market": "Darwha APMC", "crop": "Rice", "min": 3150, "max": 3550, "modal": 3380, "date": today},
        {"district": "Yavatmal", "taluka": "Digras", "market": "Digras APMC", "crop": "Vatane", "min": 3800, "max": 4200, "modal": 4020, "date": today},

        # ═══════════════════════════════════════════════════════
        #  YESTERDAY'S DATA (for price trend / historical view)
        # ═══════════════════════════════════════════════════════
        {"district": "Pune", "taluka": "Baramati", "market": "Baramati APMC", "crop": "Wheat", "min": 2180, "max": 2420, "modal": 2320, "date": yesterday},
        {"district": "Pune", "taluka": "Indapur", "market": "Indapur APMC", "crop": "Soybean", "min": 4080, "max": 4620, "modal": 4470, "date": yesterday},
        {"district": "Latur", "taluka": "Latur", "market": "Latur APMC", "crop": "Soybean", "min": 4480, "max": 4950, "modal": 4750, "date": yesterday},
        {"district": "Latur", "taluka": "Udgir", "market": "Udgir APMC", "crop": "Harbhara", "min": 5250, "max": 5650, "modal": 5450, "date": yesterday},
        {"district": "Nashik", "taluka": "Malegaon", "market": "Malegaon APMC", "crop": "Harbhara", "min": 5050, "max": 5450, "modal": 5250, "date": yesterday},
        {"district": "Nashik", "taluka": "Sinnar", "market": "Sinnar APMC", "crop": "Soybean", "min": 4280, "max": 4680, "modal": 4520, "date": yesterday},
        {"district": "Raigad", "taluka": "Panvel", "market": "Panvel APMC", "crop": "Rice", "min": 3150, "max": 3550, "modal": 3350, "date": yesterday},
        {"district": "Solapur", "taluka": "Akkalkot", "market": "Akkalkot APMC", "crop": "Vatane", "min": 3750, "max": 4150, "modal": 3950, "date": yesterday},
        {"district": "Nagpur", "taluka": "Nagpur", "market": "Nagpur APMC", "crop": "Wheat", "min": 2260, "max": 2460, "modal": 2380, "date": yesterday},
        {"district": "Aurangabad", "taluka": "Aurangabad", "market": "Aurangabad APMC", "crop": "Soybean", "min": 4420, "max": 4820, "modal": 4660, "date": yesterday},
        {"district": "Kolhapur", "taluka": "Kolhapur", "market": "Kolhapur APMC", "crop": "Rice", "min": 3380, "max": 3780, "modal": 3580, "date": yesterday},
        {"district": "Sangli", "taluka": "Miraj", "market": "Miraj APMC", "crop": "Wheat", "min": 2160, "max": 2360, "modal": 2280, "date": yesterday},
        {"district": "Satara", "taluka": "Karad", "market": "Karad APMC", "crop": "Wheat", "min": 2230, "max": 2480, "modal": 2380, "date": yesterday},
        {"district": "Ahmednagar", "taluka": "Kopargaon", "market": "Kopargaon APMC", "crop": "Soybean", "min": 4320, "max": 4720, "modal": 4560, "date": yesterday},
        {"district": "Jalgaon", "taluka": "Jalgaon", "market": "Jalgaon APMC", "crop": "Wheat", "min": 2260, "max": 2500, "modal": 2400, "date": yesterday},
        {"district": "Nanded", "taluka": "Nanded", "market": "Nanded APMC", "crop": "Soybean", "min": 4400, "max": 4800, "modal": 4620, "date": yesterday},
        {"district": "Amravati", "taluka": "Amravati", "market": "Amravati APMC", "crop": "Soybean", "min": 4380, "max": 4830, "modal": 4620, "date": yesterday},
        {"district": "Chandrapur", "taluka": "Chandrapur", "market": "Chandrapur APMC", "crop": "Rice", "min": 3220, "max": 3680, "modal": 3470, "date": yesterday},
        {"district": "Yavatmal", "taluka": "Yavatmal", "market": "Yavatmal APMC", "crop": "Soybean", "min": 4380, "max": 4780, "modal": 4600, "date": yesterday},
        {"district": "Beed", "taluka": "Beed", "market": "Beed APMC", "crop": "Soybean", "min": 4280, "max": 4720, "modal": 4520, "date": yesterday},
    ]

    count = 0
    for c in crops_data:
        existing = db.query(MarketPrice).filter(
            MarketPrice.crop == c["crop"],
            MarketPrice.market == c["market"],
            MarketPrice.date == c["date"]
        ).first()

        if existing:
            existing.min_price = Decimal(str(c["min"]))
            existing.max_price = Decimal(str(c["max"]))
            existing.modal_price = Decimal(str(c["modal"]))
            existing.recorded_at = datetime.now(timezone.utc)
        else:
            db.add(MarketPrice(
                state=MAHARASHTRA_STATE,
                district=c["district"],
                taluka=c["taluka"],
                market=c["market"],
                crop=c["crop"],
                min_price=Decimal(str(c["min"])),
                max_price=Decimal(str(c["max"])),
                modal_price=Decimal(str(c["modal"])),
                unit="Quintal",
                date=c["date"],
                recorded_at=datetime.now(timezone.utc)
            ))
            count += 1

    db.commit()
    print(f"Scraper [Tier-3]: Mock data → inserted {count} Maharashtra records (36 districts).")


def fetch_market_prices(db: Session):
    """
    Main market price fetcher with 3-tier fallback.
    Tries data.gov.in API first, then AGMARKNET scraping, then mock data.
    """
    print("Scraper: Fetching Maharashtra market prices (3-tier strategy)...")
    
    # Tier 1: data.gov.in API
    if _fetch_from_data_gov(db):
        print("Scraper: ✅ Tier-1 (data.gov.in) succeeded.")
        return
    
    # Tier 2: AGMARKNET BeautifulSoup
    if _fetch_from_agmarknet(db):
        print("Scraper: ✅ Tier-2 (AGMARKNET BS4) succeeded.")
        return
    
    # Tier 3: Mock data fallback
    print("Scraper: ⚠️ Tiers 1 & 2 failed, using expanded mock data.")
    _insert_mock_market_prices(db)


# ═══════════════════════════════════════════════════════════════════════
#  Government Schemes Scraper
# ═══════════════════════════════════════════════════════════════════════
def fetch_government_schemes(db: Session):
    """
    Scrape agriculture schemes from india.gov.in or agriwelfare.gov.in.
    """
    url = "https://www.india.gov.in/topics/agriculture/schemes"
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
        response = httpx.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            scheme_items = soup.select(".views-row")
            
            for item in scheme_items[:15]:
                title_elem = item.select_one("a")
                desc_elem = item.select_one(".field-content")
                
                if not title_elem:
                    continue
                
                title = title_elem.text.strip()
                link = title_elem.get("href", "")
                if not link.startswith("http"):
                    link = "https://www.india.gov.in" + link
                
                desc = desc_elem.text.strip() if desc_elem else "Agricultural government scheme."
                
                # Smarter categorization
                category = "Central"
                state_name = None
                
                # Check if it mentions a specific state
                states = ["Maharashtra", "Punjab", "Haryana", "Gujarat", "Karnataka", "Tamil Nadu", "Kerala"]
                for s in states:
                    if s.lower() in title.lower() or s.lower() in desc.lower():
                        category = "State"
                        state_name = s
                        break
                
                # Determine status based on keywords (simple heuristic)
                status = "Current"
                if any(k in title.lower() for k in ["upcoming", "launching", "newly"]):
                    status = "Upcoming"
                elif "closed" in title.lower() or "past" in title.lower():
                    status = "Past"

                existing = db.query(GovernmentScheme).filter(GovernmentScheme.title == title).first()
                if not existing:
                    scheme = GovernmentScheme(
                        title=title,
                        description=desc,
                        category=category,
                        status=status,
                        state_name=state_name,
                        eligibility="Eligible Indian farmers. Check link for specific criteria.",
                        application_link=link,
                        is_active=True,
                        created_at=datetime.now(timezone.utc),
                        # Default eligibility for dummy data
                        min_age=18,
                        max_income=Decimal("500000"),
                        min_land_acres=Decimal("0.5"),
                        eligible_categories="General, SC, ST, OBC"
                    )
                    db.add(scheme)
                else:
                    existing.category = category
                    existing.status = status
                    existing.state_name = state_name
            
            db.commit()
            print("Scraper: Successfully scraped and categorized government schemes.")
            return

    except Exception as e:
        print(f"Scraper Error: Failed to scrape schemes ({e})")
        _insert_static_schemes(db)


# ═══════════════════════════════════════════════════════════════════════
#  Agriculture News Scraper (RSS)
# ═══════════════════════════════════════════════════════════════════════
def fetch_agriculture_news(db: Session):
    """
    Scrape agriculture news using Google News RSS feed for agriculture topics.
    """
    url = "https://news.google.com/rss/search?q=agriculture+farmer+india&hl=en-IN&gl=IN&ceid=IN:en"
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        response = httpx.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            root = ET.fromstring(response.content)
            items = root.findall(".//item")
            
            count = 0
            for item in items[:15]:
                title = item.find("title").text if item.find("title") is not None else "Agri News"
                link = item.find("link").text if item.find("link") is not None else ""
                
                if not link:
                    continue

                existing = db.query(NewsArticle).filter(NewsArticle.url == link).first()
                if not existing:
                    description = item.find("description").text if item.find("description") is not None else ""
                    
                    # Random placeholder image since google news rss doesn't provide them easily
                    import random
                    images = [
                        "https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?w=800&q=80",
                        "https://images.unsplash.com/photo-1599839619722-39751411ea63?w=800&q=80",
                        "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&q=80",
                        "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&q=80"
                    ]
                    img_url = random.choice(images)
                    
                    clean_content = BeautifulSoup(description, "html.parser").get_text()[:600]
                    
                    source = "Google News"
                    source_elem = item.find("source")
                    if source_elem is not None and source_elem.text:
                        source = source_elem.text
                    
                    article = NewsArticle(
                        title=title,
                        source=source,
                        url=link,
                        image_url=img_url,
                        content=clean_content or "Latest agricultural news and updates.",
                        published_at=datetime.now(timezone.utc)
                    )
                    db.add(article)
                    count += 1
            
            db.commit()
            print(f"Scraper: Successfully synced {count} news articles.")
            return

    except Exception as e:
        print(f"Scraper Error: Failed to fetch news ({e})")
        _insert_static_news(db)



# ═══════════════════════════════════════════════════════════════════════
#  Static Fallbacks
# ═══════════════════════════════════════════════════════════════════════
def _insert_static_schemes(db: Session):
    schemes = [
        {"title": "PM Kisan Samman Nidhi", "description": "Rs. 6000/- per year in three installments to eligible farmers.", "link": "https://pmkisan.gov.in/"},
        {"title": "PM Fasal Bima Yojana", "description": "Financial support to farmers suffering crop loss/damage arising out of unforeseen events.", "link": "https://pmfby.gov.in/"},
        {"title": "Kisan Credit Card (KCC)", "description": "Provides timely credit to farmers for their cultivation and other needs.", "link": "https://www.pnbindia.in/kisan-credit-card.html"},
        {"title": "Soil Health Card Scheme", "description": "Promotes soil test based and balanced use of fertilizers.", "link": "https://www.soilhealth.dac.gov.in/"}
    ]
    for s in schemes:
        if not db.query(GovernmentScheme).filter(GovernmentScheme.title == s["title"]).first():
            db.add(GovernmentScheme(
                title=s["title"],
                description=s["description"],
                application_link=s["link"],
                is_active=True,
                created_at=datetime.now(timezone.utc)
            ))
    db.commit()


def _insert_static_news(db: Session):
    news = [
        {"title": "Government announces increased MSP for Rabi crops", "source": "Agri Ministry", "url": "https://agricoop.nic.in/news/1", "img": "https://images.unsplash.com/photo-1599839619722-39751411ea63?w=800&q=80"},
        {"title": "New drought-resistant wheat variety introduced in Maharashtra", "source": "ICAR", "url": "https://icar.org.in/news/2", "img": "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&q=80"},
        {"title": "Subsidy roll-out for solar irrigation pumps", "source": "PM-KUSUM", "url": "https://mnre.gov.in/news/3", "img": "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&q=80"}
    ]
    for n in news:
        if not db.query(NewsArticle).filter(NewsArticle.url == n["url"]).first():
            db.add(NewsArticle(
                title=n["title"],
                source=n["source"],
                url=n["url"],
                image_url=n["img"],
                content="Latest agricultural update for farmers.",
                published_at=datetime.now(timezone.utc)
            ))
    db.commit()


# ═══════════════════════════════════════════════════════════════════════
#  Main Runner
# ═══════════════════════════════════════════════════════════════════════
def run_all_scrapers(db: Session):
    print("═" * 60)
    print("Running scrapers scheduler...")
    print("═" * 60)
    fetch_market_prices(db)
    fetch_government_schemes(db)
    fetch_agriculture_news(db)
    print("═" * 60)
    print("Scrapers completed.")
    print("═" * 60)
