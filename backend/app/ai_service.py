import os
from typing import List, Dict
from dotenv import load_dotenv
import random

load_dotenv()

# ========== GEMINI AI (Primary) ==========
try:
    from google import genai
    GEMINI_AVAILABLE = True
    api_key = os.getenv("GEMINI_API_KEY", "")
    gemini_client = genai.Client(api_key=api_key) if api_key else None
except ImportError:
    GEMINI_AVAILABLE = False
    gemini_client = None

# Language display names for prompting
LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi (हिंदी)",
    "ta": "Tamil (தமிழ்)",
    "te": "Telugu (తెలుగు)",
    "mr": "Marathi (मराठी)",
}

# Multilingual local fallback responses
AI_RESPONSES = {
    "en": {
        "wheat": "For wheat cultivation, ensure proper irrigation during the tillering and grain filling stages. Apply nitrogen fertilizer in split doses. Watch for yellow rust and aphids. Current market price for wheat is around Rs.2,450 per quintal in Delhi.",
        "rice": "Rice needs standing water of 5-7cm during vegetative growth. Transplant 25-30 day old seedlings. Use certified seeds for better yield. Basmati varieties are fetching good prices in the market.",
        "tomato": "Tomatoes need regular watering and staking. Watch for early blight and fruit borer. Apply balanced NPK fertilizer every 15 days. Current tomato prices have increased by 5.8% in Bangalore.",
        "potato": "Potatoes require well-drained soil and cool weather. Plant seed potatoes 10-15cm deep. Watch for late blight disease. Store harvested potatoes in cool, dark places.",
        "onion": "Onions need sunny locations and well-drained soil. Transplant seedlings when they reach pencil thickness. Current onion prices are Rs.35/kg in Pune market with a 3.2% increase.",
        "corn": "Corn requires warm soil temperatures (above 15 degrees C). Plant seeds 2-3cm deep. Ensure adequate spacing for pollination. Sweet corn varieties are in high demand.",
        "fertilizer": "Use organic compost along with chemical fertilizers for better soil health. Get your soil tested before applying fertilizers. NPK ratio should be based on crop requirements.",
        "pest": "Identify the pest first using our disease detection feature. Use integrated pest management (IPM) techniques for sustainable control. Neem-based pesticides are effective for organic farming.",
        "irrigation": "Drip irrigation can save 40-50% water and increase yield by 20-30%. Schedule irrigation based on crop growth stage. Early morning or late evening is best for irrigation.",
        "organic": "For organic farming, use farmyard manure, vermicompost, and bio-fertilizers. Practice crop rotation and intercropping. Get organic certification for better market prices.",
        "weather": "Check our weather widget for 5-day forecasts. Heavy rainfall expected in some regions - take precautions to protect standing crops. Install rain gauges for accurate measurement.",
        "market": "Wheat prices are up 2.5% in Delhi. Rice prices slightly down by 1.2% in Mumbai. Tomato prices surged 5.8% in Bangalore. Check daily updates for best selling time.",
        "default": "I'm your Digital Krishi assistant! I can help you with crop management, pest control, fertilizer recommendations, weather updates, and market prices. Please ask specific questions about your farming needs."
    },
    "hi": {
        "wheat": "Gehun ki kheti ke liye, kalle nikalne aur daane bharne ki avdhi ke dauran uchit sinchai sunishchit karen. Nitrogen urvarak ko vibhajit khurakon mein lagaen. Peela ratua aur aphids par nazar rakhen.",
        "rice": "Dhan ko vanaspati vikas ke dauran 5-7 cm khade paani ki avashyakta hoti hai. 25-30 din purane paudhon ko ropen. Behtar upaj ke liye pramanit beej ka upyog karen.",
        "tomato": "Tamatar ko niyamit paani aur sahare ki jaroorat hoti hai. Early blight aur fruit borer se bachao karen. Santulit NPK urvarak ka prayog karen.",
        "potato": "Aloo ke liye achhi jalnikasi wali mitti aur thanda mausam chahiye. Beej aloo 10-15 cm gehre lagaen. Late blight rog se savdhan rahen.",
        "onion": "Pyaz ke liye dhoop wali jagah aur achhi jalnikasi wali mitti chahiye. Paudhe ko tab ropen jab ve pencil ki moti ho jaen.",
        "fertilizer": "Behtar mitti ke swasthya ke liye rasayanik unvarak ke sath jaivik khaad ka upyog karen. Urvarak lagane se pehle mitti ki janch karvaen.",
        "pest": "Pahle keet ki pahchan karen. Tikau niyantran ke liye entomoloji niyantran (IPM) taknik ka upyog karen.",
        "irrigation": "Drip sinchai se 40-50% paani ki bachat hoti hai aur upaj 20-30% badhti hai.",
        "weather": "5-din ka mausam poorvaanuman ke liye hamara mausam widget dekhen.",
        "market": "Delhi mein gehun ke daam 2.5% upar hain. Mumbai mein chawal ke daam 1.2% neeche hain.",
        "default": "Main aapka Digital Krishi sahayak hun! Main aapko fasal prabandhan, keet niyantran, urvarak sifarishen, mausam apdets aur bazaar ke bhav mein madad kar sakta hun."
    },
    "ta": {
        "wheat": "Kodhumai paiyirchi ku, kodik kadaippiyal matrum maani nirappu kattathalil sari yana neer pathippu tervai. Neytrogen uruvam pakuthi alavu il podungal.",
        "rice": "Nel vaLarchi yin pOthu 5-7 cm niRkum neer tervai. 25-30 naaL paLaiya naarRukal nadavu seiyavum.",
        "default": "Naan ungal Digital Krishi udaviyaaLar! Naan ungalukkku paiyir maanaaLam, pOcci kaiyaattu, uruvam parinthurai, vaanil nilai matrum sandai vilaikal il udavalam."
    },
    "te": {
        "wheat": "Godhumai saagu kosam, kanda roopannam mariyu manittu nirappu dasakallo saraina neeti paarana avashyam. Nitrogen eravunu vibhajita maatraallo veyali.",
        "rice": "Vari varidhi samayamlo 5-7 cm nilabada neeti avashyam. 25-30 roju pata mariyu naathu cheyali.",
        "default": "Nenu meeru Digital Krishi sahayakudu! Nenu meekku pantula yajamanya, peedakalu niyantrana, eravulu sifaarisu, vaayu guna soochana mariyu marketlu dhara lo sahayapadadamu."
    },
    "mr": {
        "wheat": "Gahu peekaasaathee, kalli yeNyaachya ani daaNe bharNyaachya avasthit yogya sinchan sUnishchit kara. Nitrogen khata vibhajit maatraat dyaa.",
        "rice": "Bhat pikaala vanaspatik vaadhaachya veLi 5-7 cm ubhe paaNi laagate. 25-30 divsaanchya puraanchya ropyaa lavaav yaat.",
        "default": "Mi tumcha Digital Krishi sahayak aahe! Mi tumhala pikaacha vyavasthapan, keedak niyantran, khataachya shiphaarasi, havamaan mahiti ani baazaarabhav yaamadhe madad karu shaktoo."
    }
}

SUGGESTIONS = {
    "en": ["Wheat cultivation tips", "Pest control guidelines", "Identify disease", "Check latest market prices", "Today's weather forecast"],
    "hi": ["Gehun ki kheti", "Keet niyantran", "Bazaar bhav", "Aaj ka mausam", "Urvarak ki jaankari"],
    "ta": ["Paiyir saagubadi", "Urvaram parinthurai", "Sandai vilaikal", "Vaanil munanRivippu"],
    "te": ["Godhumai saagu chittkaalu", "Vari saagu guide", "Peedakula niyantrana", "Eravulu sifaarisu", "Market dhara", "Vaayu guna anchanam"],
    "mr": ["Gahu lagvad tips", "Bhat lagvad margadarshak", "Keed niyantran kase karaave", "Khata shiphaarasi", "Aajache baazar bhaav", "Havaman andaz"]
}


async def get_ai_response(
    message: str,
    language: str = "en",
    user_id: int = None,
    chat_history: List[Dict] = None,
    image_url: str = None
) -> Dict[str, any]:
    """
    Get AI response using Gemini (primary) with local fallback.
    """
    if chat_history is None:
        chat_history = []

    language = language if language in LANGUAGE_NAMES else "en"
    lang_name = LANGUAGE_NAMES[language]

    # ===== GEMINI AI =====
    if GEMINI_AVAILABLE and gemini_client:
        try:
            system_instructions = f"""You are Digital Krishi, an expert AI assistant for Indian farmers.
Always respond in {lang_name} language.
You specialize in: crop cultivation, pest control, fertilizer recommendations, weather-based farming advice, government schemes, market prices, and agricultural technology.
Keep responses practical, concise, and relevant to Indian farming conditions.
If asked in Hindi/Tamil/Telugu/Marathi, respond fully in that language.
"""
            # Build conversation history for context
            contents = []

            # Add chat history for context (last 6 messages)
            for hist in chat_history[-6:]:
                role = hist.get("role", "user")
                content = hist.get("content", "")
                if role in ("user", "model") and content:
                    contents.append({"role": role, "parts": [{"text": content}]})

            # Build current user parts
            current_user_parts = [{"text": system_instructions + "\n\nUser: " + message}]

            # Add image if provided
            if image_url:
                try:
                    from PIL import Image
                    filename = os.path.basename(image_url)
                    local_path = os.path.join(os.getcwd(), "static", "uploads", filename)
                    if os.path.exists(local_path):
                        img = Image.open(local_path)
                        current_user_parts.append(img)
                except Exception as e:
                    print(f"Error loading image for chat: {e}")

            contents.append({
                "role": "user",
                "parts": current_user_parts
            })

            try:
                response = gemini_client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=contents
                )
            except Exception as e:
                # Fallback to flash-latest if 2.5 has exhausted free-tier quotas or hangs
                print(f"2.5-flash failed, falling back to flash-latest. Error: {e}")
                response = gemini_client.models.generate_content(
                    model='gemini-flash-latest',
                    contents=[{"role": "user", "parts": current_user_parts}]
                )

            if response and response.text:
                ai_text = response.text.strip()
                suggestions = SUGGESTIONS.get(language, SUGGESTIONS["en"])
                print(f"Gemini AI response generated for language: {language}")
                return {
                    "response": ai_text,
                    "suggestions": suggestions[:5]
                }

        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Gemini AI Chat Error: {e}")
            # Fall through to local fallback

    # ===== LOCAL FALLBACK =====
    return _get_local_response(message, language)


def _get_local_response(message: str, language: str = "en") -> Dict[str, any]:
    """Local keyword-based fallback when Gemini API is unavailable."""
    message_lower = message.lower()
    responses = AI_RESPONSES.get(language, AI_RESPONSES["en"])

    # Keyword mapping (supports multiple languages)
    keyword_map = {
        "wheat": ["wheat", "gehun", "gahun", "godhumai", "gahu"],
        "rice": ["rice", "dhan", "vari", "nel", "bhat"],
        "tomato": ["tomato", "tamatar", "tamato"],
        "potato": ["potato", "aloo"],
        "onion": ["onion", "pyaz", "kanda"],
        "corn": ["corn", "makai", "mokka"],
        "fertilizer": ["fertilizer", "urvarak", "urvaram", "eravunu", "khata", "khad"],
        "pest": ["pest", "keet", "pUcci", "peedaku", "keedak"],
        "irrigation": ["irrigation", "sinchai", "neer", "neeti", "paarana", "sinchan"],
        "organic": ["organic", "jaivik", "iyal", "sendriva", "kendriva"],
        "weather": ["weather", "mausam", "havamaan", "vaayu", "mausam"],
        "market": ["market", "bazaar", "bazar", "sandai", "marketu"],
    }

    response_text = responses.get("default", "I'm here to help with farming questions.")

    for key, keywords in keyword_map.items():
        for kw in keywords:
            if kw in message_lower:
                response_text = responses.get(key, response_text)
                break
        else:
            continue
        break

    suggestions = SUGGESTIONS.get(language, SUGGESTIONS["en"])
    return {
        "response": response_text,
        "suggestions": suggestions[:5]
    }


def get_weather_agricultural_advice(current_weather: dict, forecast_summary: str = "") -> dict:
    """
    Get dynamic AI suggestions for water level and fertilizer application timing
    based on current weather and forecast (history/future).
    """

    def get_heuristic_advice(cw):
        temp = cw.get("temp", 25)
        humidity = cw.get("humidity", 50)
        wind_speed = cw.get("wind_speed", 10)
        condition = cw.get("condition", "").lower()

        # Agricultural heuristics for water management
        water_level = "Normal irrigation required to maintain soil moisture."
        if temp > 35 and humidity < 40:
            water_level = "High evaporation risk! Increase water level by 20-30%. Irrigate early morning."
        elif "rain" in condition or "thunderstorm" in condition or "shower" in condition:
            water_level = "Rain expected. Suspend irrigation to prevent waterlogging."
        elif humidity > 80:
            water_level = "High humidity detected. Reduce water volume. Ensure proper field drainage."
        elif temp > 30:
            water_level = "Maintain adequate soil moisture. Short, frequent irrigation is recommended."

        # Agricultural heuristics for fertilizer timing
        fertilizer = "Optimum conditions for standard fertilizer application schedule."
        if "rain" in condition or "thunderstorm" in condition or humidity > 85:
            fertilizer = "Delay fertilizer application! Heavy moisture will wash away nutrients."
        elif wind_speed > 20:
            fertilizer = "High wind speeds detected. Avoid foliar sprays to prevent chemical drift."
        elif temp > 35:
            fertilizer = "Heat stress possible. Avoid chemical fertilizers to prevent leaf burn. Use organic mulch."
        elif 20 <= temp <= 30 and humidity < 75:
            fertilizer = "Excellent conditions! Proceed with scheduled nutrient top-dressing or foliar spraying."

        return {
            "water_level": water_level,
            "fertilizer_timing": fertilizer
        }

    if not (GEMINI_AVAILABLE and gemini_client):
        return get_heuristic_advice(current_weather)

    try:
        system_prompt = """You are an expert Indian agriculturist and meteorologist.
Given the following current weather and forecast data, provide exactly two practical suggestions for farmers in plain text:
1. 'Water Level Suggestion': Advice on how much water to give crops (irrigation requirement) based on temperature, humidity, and upcoming rain.
2. 'Fertilizer Timing Suggestion': Advice on when to apply fertilizer (shrink timing/schedule) based on weather conditions (e.g., avoid before heavy rain or during high winds).
Keep advice concise (1-2 sentences each). Do not use markdown or list numbers. Return the two suggestions separated by the delimiter '|'.
Format: <water_level_advice> | <fertilizer_timing_advice>
"""

        user_prompt = f"Current Weather: Temp: {current_weather.get('temp')}C, Humidity: {current_weather.get('humidity')}%, Wind: {current_weather.get('wind_speed')} km/h, Condition: {current_weather.get('condition')}\nForecast/History: {forecast_summary}"

        response = gemini_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                {"role": "user", "parts": [{"text": system_prompt + "\n\n" + user_prompt}]}
            ]
        )

        if response and response.text:
            parts = response.text.strip().split('|')
            if len(parts) >= 2:
                return {
                    "water_level": parts[0].strip(),
                    "fertilizer_timing": parts[1].strip()
                }
    except Exception as e:
        print(f"Gemini Weather Advice Error: {e}")

    # Fallback if Gemini fails or rate limited
    return get_heuristic_advice(current_weather)
