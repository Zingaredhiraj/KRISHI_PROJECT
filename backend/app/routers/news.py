from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
import app.models as models
from app.schemas import NewsArticleResponse
from typing import List, Optional
from datetime import datetime
import feedparser
from dateutil import parser as date_parser

router = APIRouter(prefix="/api/news", tags=["News"])

import os
import json

def get_news_feeds():
    """Load news feeds from .env or fallback to trusted defaults"""
    feeds_env = os.getenv("AGRI_RSS_FEEDS")
    if feeds_env:
        try:
            return json.loads(feeds_env)
        except Exception as e:
            print(f"Error parsing AGRI_RSS_FEEDS from .env: {e}")
            
    return [
        {
            "url": "https://news.google.com/rss/search?q=agriculture+farming+maharashtra&hl=en-IN&gl=IN&ceid=IN:en",
            "source": "Google News (Maharashtra)"
        },
        {
            "url": "https://news.google.com/rss/search?q=crop+prices+market+mandi+maharashtra&hl=en-IN&gl=IN&ceid=IN:en",
            "source": "Google Market News (Maharashtra)"
        },
        {
            "url": "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=1",
            "source": "PIB India (Gov)"
        }
    ]


# Mapping UI categories to backend keywords
CATEGORY_KEYWORDS = {
    "Farming": ["farming", "cultivation", "sowing", "harvest", "organic", "seeds", "fertilizer"],
    "Weather": ["rain", "monsoon", "drought", "climate", "temperature", "forecast", "imd"],
    "Schemes": ["scheme", "pension", "subsidy", "nidhi", "kisan", "govt", "support"],
    "Market": ["msp", "mandi", "prices", "trade", "export", "import", "commodity"],
    "Technology": ["agritech", "drone", "digital", "iot", "modern", "precision", "software"]
}

@router.get("", response_model=List[NewsArticleResponse])
def get_news(db: Session = Depends(get_db)):
    """Fetch stored news from the database."""
    news = db.query(models.NewsArticle).order_by(models.NewsArticle.published_at.desc()).limit(20).all()
    return news

import requests

@router.get("/realtime")
def get_realtime_news(
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 24
):
    """Fetch latest agriculture news from configured RSS feeds with keyword-based categorization."""
    collected = []
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    }

    for feed_item in get_news_feeds():
        try:
            resp = requests.get(feed_item["url"], headers=headers, timeout=10)
            parsed = feedparser.parse(resp.content)
            source_name = feed_item["source"]
            
            for entry in parsed.entries:
                title = getattr(entry, "title", "").strip()
                link = getattr(entry, "link", "").strip()
                summary = getattr(entry, "summary", "").strip()
                published = getattr(entry, "published", None) or getattr(entry, "updated", None)
                
                if not link or not title:
                    continue
                
                # Filter by keyword if category is specified
                text_to_scan = f"{title} {summary}".lower()
                
                if category and category in CATEGORY_KEYWORDS:
                    keywords = CATEGORY_KEYWORDS[category]
                    if not any(k in text_to_scan for k in keywords):
                        continue
                
                if search and search.lower() not in text_to_scan:
                    continue
                
                # Image extraction logic
                image_url = None
                if "media_thumbnail" in entry:
                    image_url = entry.media_thumbnail[0]["url"]
                elif "links" in entry:
                    for l in entry.links:
                        if l.get("type", "").startswith("image"):
                            image_url = l.get("href")
                            break
                elif "enclosures" in entry:
                    for enc in entry.enclosures:
                        if enc.get("type", "").startswith("image"):
                            image_url = enc.get("href")
                            break

                # Prevent duplicates
                if any(item["url"] == link for item in collected):
                    continue

                published_at = datetime.utcnow()
                if published:
                    try:
                        published_at = date_parser.parse(published)
                    except Exception:
                        published_at = datetime.utcnow()

                collected.append({
                    "id": 0,
                    "title": title,
                    "source": source_name,
                    "url": link,
                    "image_url": image_url,
                    "content": summary[:300] + "..." if len(summary) > 300 else summary,
                    "published_at": published_at,
                })
        except Exception as e:
            print(f"Error fetching RSS: {e}")
            continue

    # Sort and limit
    collected = sorted(collected, key=lambda x: x["published_at"], reverse=True)
    return collected[:limit]

@router.get("/{id}", response_model=NewsArticleResponse)
def get_news_by_id(id: int, db: Session = Depends(get_db)):
    article = db.query(models.NewsArticle).filter(models.NewsArticle.id == id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article
