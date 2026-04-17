from sqlalchemy.orm import Session
import app.models as models
from datetime import datetime, date, timedelta

def seed_default_schemes(db: Session):
    """
    Seed initial set of government schemes for India and Maharashtra.
    """
    schemes = [
        {
            "title": "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)",
            "description": "Financial benefit of Rs. 6000/- per year in three equal installments to all landholding farmer families.",
            "category": "Central",
            "status": "Current",
            "eligibility": "Small and marginal farmers with landholding up to 2 hectares.",
            "min_age": 18,
            "max_income": 300000,
            "min_land_acres": 0,
            "eligible_categories": "General, OBC, SC, ST",
            "application_link": "https://pmkisan.gov.in/",
            "start_date": date(2018, 12, 1),
            "end_date": None
        },
        {
            "title": "Namo Shetkari Mahasanman Nidhi",
            "description": "Maharashtra State supplement to PM-KISAN, providing an additional Rs. 6000/- per year to farmers.",
            "category": "State",
            "state_name": "Maharashtra",
            "status": "Current",
            "eligibility": "Farmers of Maharashtra who are receiving PM-KISAN benefits.",
            "min_age": 18,
            "max_income": 300000,
            "min_land_acres": 0,
            "eligible_categories": "General, OBC, SC, ST",
            "application_link": "https://mahabhulekh.maharashtra.gov.in/",
            "start_date": date(2023, 5, 29),
            "end_date": None
        },
        {
            "title": "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
            "description": "Comprehensive crop insurance scheme to provide financial support to farmers suffering crop loss/damage.",
            "category": "Central",
            "status": "Current",
            "eligibility": "All farmers growing the notified crops in the notified areas.",
            "min_age": 18,
            "max_income": 1000000,
            "min_land_acres": 0,
            "eligible_categories": "General, OBC, SC, ST",
            "application_link": "https://pmfby.gov.in/",
            "start_date": date(2016, 2, 18),
            "end_date": None
        },
        {
            "title": "[Upcoming] PM-KMY (Kisan Maan Dhan Yojana)",
            "description": "Pension scheme for small and marginal farmers to ensure social security after the age of 60.",
            "category": "Central",
            "status": "Upcoming",
            "eligibility": "Farmers aged between 18 and 40 years with land up to 2 hectares.",
            "min_age": 18,
            "max_income": 500000,
            "min_land_acres": 0,
            "eligible_categories": "General, OBC, SC, ST",
            "application_link": "https://maandhan.in/",
            "start_date": date(2024, 7, 1),
            "end_date": None
        },
        {
            "title": "[Past] Agri-Input Subsidy 2023",
            "description": "One-time subsidy for purchase of high-yield variety seeds and fertilizers for Kharif 2023.",
            "category": "State",
            "state_name": "Maharashtra",
            "status": "Past",
            "eligibility": "Farmers registered in drought-prone talukas.",
            "min_age": 18,
            "max_income": 200000,
            "min_land_acres": 0,
            "eligible_categories": "General, OBC, SC, ST",
            "application_link": None,
            "start_date": date(2023, 4, 1),
            "end_date": date(2023, 10, 31)
        }
    ]

    for s_data in schemes:
        existing = db.query(models.GovernmentScheme).filter(models.GovernmentScheme.title == s_data["title"]).first()
        if not existing:
            scheme = models.GovernmentScheme(**s_data)
            db.add(scheme)
    
    db.commit()
    print("Seed data for schemes completed.")
