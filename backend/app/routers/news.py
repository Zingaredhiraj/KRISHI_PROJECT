import os
import json
import logging
import asyncio
import httpx
import feedparser
import time as _time
from datetime import datetime, timezone
from typing import List, Optional
from dateutil import parser as date_parser
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
import app.models as models
from app.schemas import NewsArticleResponse

logger = logging.getLogger("digital_krishi.news")

router = APIRouter(prefix="/api/news", tags=["News"])

# 10-minute in-memory cache: {cache_key: (articles, timestamp)}
_RSS_CACHE: dict = {}
_RSS_CACHE_TTL = 600  # 10 minutes


def get_news_feeds():
    """Load news feeds from .env or fallback to trusted defaults"""
    feeds_env = os.getenv("AGRI_RSS_FEEDS")
    if feeds_env:
        try:
            return json.loads(feeds_env)
        except Exception as e:
            logger.warning(f"Error parsing AGRI_RSS_FEEDS from .env: {e}")

    return [
        {
            "url": "https://news.google.com/rss/search?q=agriculture+farming+india&hl=en-IN&gl=IN&ceid=IN:en",
            "source": "Google News (Agriculture)"
        },
        {
            "url": "https://pib.gov.in/RssMain.aspx?ModId=6",
            "source": "PIB Agriculture"
        },
    ]


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


@router.get("/realtime")
async def get_realtime_news(
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(24, ge=1, le=24),
):
    """
    Fetch latest agriculture news from configured RSS feeds asynchronously in parallel
    with a 10-minute in-memory cache (cuts latency from ~10-30s to <300ms).
    """
    cache_key = f"{category or 'all'}:{search or 'none'}"
    cached = _RSS_CACHE.get(cache_key)
    if cached:
        articles, ts = cached
        if _time.time() - ts < _RSS_CACHE_TTL:
            return articles[:limit]

    feeds = get_news_feeds()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }

    async with httpx.AsyncClient(timeout=8.0) as client:
        tasks = [client.get(feed["url"], headers=headers) for feed in feeds]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    collected = []
    for idx, res in enumerate(results):
        if isinstance(res, Exception):
            logger.warning(f"Failed to fetch feed {feeds[idx]['url']}: {res}")
            continue

        try:
            parsed = feedparser.parse(res.content)
            source_name = feeds[idx]["source"]

            for entry in parsed.entries:
                title = getattr(entry, "title", "").strip()
                link = getattr(entry, "link", "").strip()
                summary = getattr(entry, "summary", "").strip()
                published = getattr(entry, "published", None) or getattr(entry, "updated", None)

                if not link or not title:
                    continue

                text_to_scan = f"{title} {summary}".lower()

                if category and category in CATEGORY_KEYWORDS:
                    keywords = CATEGORY_KEYWORDS[category]
                    if not any(k in text_to_scan for k in keywords):
                        continue

                if search and search.lower() not in text_to_scan:
                    continue

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

                if any(item["url"] == link for item in collected):
                    continue

                published_at = datetime.now(timezone.utc)
                if published:
                    try:
                        published_at = date_parser.parse(published)
                    except Exception:
                        published_at = datetime.now(timezone.utc)

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
            logger.warning(f"Error parsing RSS from {feeds[idx]['url']}: {e}")
            continue

    collected = sorted(
        collected,
        key=lambda x: x["published_at"] if hasattr(x["published_at"], "tzinfo") else datetime.now(timezone.utc),
        reverse=True
    )
    _RSS_CACHE[cache_key] = (collected, _time.time())
    return collected[:limit]


@router.get("/{id}", response_model=NewsArticleResponse)
def get_news_by_id(id: int, db: Session = Depends(get_db)):
    article = db.query(models.NewsArticle).filter(models.NewsArticle.id == id).first()
    if not article:
        raise HTTPException(status_code=404, detail="News article not found")
    return article
