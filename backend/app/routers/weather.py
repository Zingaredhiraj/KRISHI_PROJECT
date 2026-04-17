from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from decimal import Decimal
from datetime import datetime, timedelta
import httpx
import asyncio
import time as _time

router = APIRouter(prefix="/api/weather", tags=["Weather"])

_WEATHER_CACHE: dict = {}
WEATHER_CACHE_TTL = 300

def _make_cache_key(lat: float, lon: float) -> str:
    return f"{round(lat, 2)},{round(lon, 2)}"

@router.get("/current")
async def get_weather(lat: float = None, lon: float = None, location: str = None, db: Session = Depends(get_db)):
    if lat is None or lon is None:
        lat, lon = 18.5204, 73.8567
        loc_name = "Pune, Maharashtra (Default)"
        cache_key = "default"
    else:
        cache_key = _make_cache_key(lat, lon)
        loc_name = None

    cached = _WEATHER_CACHE.get(cache_key)
    if cached:
        data, ts = cached
        if _time.time() - ts < WEATHER_CACHE_TTL:
            return data

    async with httpx.AsyncClient(timeout=8.0) as client:
        tasks = []
        if loc_name is None:
            tasks.append(client.get(
                f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=10",
                headers={"User-Agent": "DigitalKrishi/1.0"}
            ))
        else:
            tasks.append(asyncio.sleep(0))

        tasks.append(client.get(
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m"
            f"&daily=weather_code,temperature_2m_max,temperature_2m_min"
            f"&timezone=auto"
        ))
        results = await asyncio.gather(*tasks, return_exceptions=True)

    if loc_name is None:
        nom_result = results[0]
        try:
            if not isinstance(nom_result, Exception):
                nom_data = nom_result.json()
                address = nom_data.get("address", {})
                city = address.get("city") or address.get("town") or address.get("county") or address.get("village", "Unknown Area")
                state = address.get("state", "")
                loc_name = f"{city}, {state}".strip(", ")
            else:
                loc_name = f"GPS ({round(lat, 2)}, {round(lon, 2)})"
        except Exception:
            loc_name = f"GPS ({round(lat, 2)}, {round(lon, 2)})"

    weather_result = results[1]
    try:
        if isinstance(weather_result, Exception):
            raise weather_result

        res = weather_result.json()
        current = res["current"]
        daily = res["daily"]

        temp = Decimal(str(current["temperature_2m"]))
        humidity = current["relative_humidity_2m"]
        wind_speed = Decimal(str(current["wind_speed_10m"]))

        code = current["weather_code"]
        condition = (
            "Clear" if code <= 2 else
            "Cloudy" if code == 3 else
            "Rain" if code in [51, 53, 55, 61, 63, 65, 80, 81, 82] else
            "Thunderstorm" if code >= 95 else
            "Fog"
        )

        forecast = []
        for i in range(1, min(4, len(daily["time"]))):
            f_code = daily["weather_code"][i]
            f_cond = (
                "Clear" if f_code <= 2 else
                "Cloudy" if f_code == 3 else
                "Rain" if f_code in [51, 53, 55, 61, 63, 65, 80, 81, 82] else
                "Thunderstorm" if f_code >= 95 else
                "Fog"
            )
            day_name = (datetime.now() + timedelta(days=i)).strftime("%A")
            if i == 1:
                day_name = "Tomorrow"
            forecast.append({"day": day_name, "temp": float(daily["temperature_2m_max"][i]), "condition": f_cond})

        data = {
            "id": 1, "location": loc_name, "temperature": float(temp), "condition": condition,
            "humidity": humidity, "wind_speed": float(wind_speed), "forecast": forecast,
            "recorded_at": datetime.now().isoformat(),
            "water_level_suggestion": "Delay irrigation, rain expected." if "Rain" in condition else "Normal irrigation recommended.",
            "fertilizer_suggestion": "Avoid foliar spray due to incoming rain/wind." if ("Rain" in condition or wind_speed > 20) else "Good weather for foliar spray.",
        }

        _WEATHER_CACHE[cache_key] = (data, _time.time())
        return data

    except Exception as e:
        print(f"Weather API Error: {e}")
        if cached:
            return cached[0]
        return {
            "id": 1, "location": loc_name, "temperature": 28.5, "condition": "Cloudy", "humidity": 45, "wind_speed": 12.5,
            "forecast": [{"day": "Tomorrow", "temp": 29, "condition": "Sunny"}],
            "recorded_at": datetime.now().isoformat(),
            "water_level_suggestion": "Normal irrigation recommended", "fertilizer_suggestion": "Monitor local conditions"
        }
