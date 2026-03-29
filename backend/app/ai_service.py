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
        "wheat": "For wheat cultivation, ensure proper irrigation during the tillering and grain filling stages. Apply nitrogen fertilizer in split doses. Watch for yellow rust and aphids. Current market price for wheat is around ₹2,450 per quintal in Delhi.",
        "rice": "Rice needs standing water of 5-7cm during vegetative growth. Transplant 25-30 day old seedlings. Use certified seeds for better yield. Basmati varieties are fetching good prices in the market.",
        "tomato": "Tomatoes need regular watering and staking. Watch for early blight and fruit borer. Apply balanced NPK fertilizer every 15 days. Current tomato prices have increased by 5.8% in Bangalore.",
        "potato": "Potatoes require well-drained soil and cool weather. Plant seed potatoes 10-15cm deep. Watch for late blight disease. Store harvested potatoes in cool, dark places.",
        "onion": "Onions need sunny locations and well-drained soil. Transplant seedlings when they reach pencil thickness. Current onion prices are ₹35/kg in Pune market with a 3.2% increase.",
        "corn": "Corn requires warm soil temperatures (above 15°C). Plant seeds 2-3cm deep. Ensure adequate spacing for pollination. Sweet corn varieties are in high demand.",
        "fertilizer": "Use organic compost along with chemical fertilizers for better soil health. Get your soil tested before applying fertilizers. NPK ratio should be based on crop requirements.",
        "pest": "Identify the pest first using our disease detection feature. Use integrated pest management (IPM) techniques for sustainable control. Neem-based pesticides are effective for organic farming.",
        "irrigation": "Drip irrigation can save 40-50% water and increase yield by 20-30%. Schedule irrigation based on crop growth stage. Early morning or late evening is best for irrigation.",
        "organic": "For organic farming, use farmyard manure, vermicompost, and bio-fertilizers. Practice crop rotation and intercropping. Get organic certification for better market prices.",
        "weather": "Check our weather widget for 5-day forecasts. Heavy rainfall expected in some regions - take precautions to protect standing crops. Install rain gauges for accurate measurement.",
        "market": "Wheat prices are up 2.5% in Delhi. Rice prices slightly down by 1.2% in Mumbai. Tomato prices surged 5.8% in Bangalore. Check daily updates for best selling time.",
        "default": "I'm your Digital Krishi assistant! I can help you with crop management, pest control, fertilizer recommendations, weather updates, and market prices. Please ask specific questions about your farming needs."
    },
    "hi": {
        "wheat": "गेहूं की खेती के लिए, कल्ले निकलने और दाने भरने की अवधि के दौरान उचित सिंचाई सुनिश्चित करें। नाइट्रोजन उर्वरक को विभाजित खुराक में लगाएं। पीला रतुआ और एफिड्स पर नज़र रखें।",
        "rice": "धान को वनस्पति विकास के दौरान 5-7 सेमी खड़े पानी की आवश्यकता होती है। 25-30 दिन पुराने पौधों को रोपें। बेहतर उपज के लिए प्रमाणित बीज का उपयोग करें।",
        "tomato": "टमाटर को नियमित पानी और सहारे की जरूरत होती है। अर्ली ब्लाइट और फ्रूट बोरर के लिए देखें। हर 15 दिनों में संतुलित NPK उर्वरक लगाएं।",
        "fertilizer": "बेहतर मिट्टी के स्वास्थ्य के लिए रासायनिक उर्वरकों के साथ जैविक खाद का उपयोग करें। उर्वरक लगाने से पहले अपनी मिट्टी की जांच कराएं।",
        "pest": "समेकित कीट प्रबंधन (IPM) तकनीकों का उपयोग करें। हमारी रोग पहचान सुविधा का उपयोग करके पहले कीट की पहचान करें।",
        "irrigation": "ड्रिप सिंचाई 40-50% पानी बचा सकती है और उपज को 20-30% बढ़ा सकती है। फसल विकास अवस्था के आधार पर सिंचाई का कार्यक्रम बनाएं।",
        "default": "मैं आपका Digital Krishi सहायक हूं! मैं फसल प्रबंधन, कीट नियंत्रण, उर्वरक सिफारिशों, मौसम अपडेट और बाजार भाव में आपकी सहायता कर सकता हूं।"
    },
    "ta": {
        "wheat": "கோதுமை சாகுபடிக்கு, கதிர் உருவாக்கம் மற்றும் மணி நிரப்பும் கட்டத்தில் சரியான நீர்ப்பாசனம் தேவை.",
        "rice": "நெல் வளர்ச்சியின்போது 5-7 செமீ நிற்கும் நீர் தேவை. 25-30 நாட்கள் பழைய நாற்றுகளை நடவு செய்யவும்.",
        "fertilizer": "மண் ஆரோக்கியத்திற்கு வேதிப்பொருள் உரங்களுடன் இயற்கை உ�def get_ai_response(message: str, language: str = "en", image_url: str = None, history: List[Dict] = None) -> Dict[str, any]:
    """
    Get AI response for farmer query.
    Uses Gemini API (same API key as disease detection) as primary,
    falls back to local keyword-based responses if unavailable.
    """
    # ===== TRY GEMINI FIRST =====
    if GEMINI_AVAILABLE and gemini_client:
        try:
            lang_name = LANGUAGE_NAMES.get(language, "English")

            system_prompt = f"""You are Digital Krishi AI — a smart, friendly farming assistant for Indian farmers.

LANGUAGE INSTRUCTION: You MUST respond entirely in {lang_name}. Every word of your response must be in {lang_name}.
{"If the language is Hindi, respond in Devanagari script (हिंदी)." if language == "hi" else ""}
{"If the language is Tamil, respond in Tamil script (தமிழ்)." if language == "ta" else ""}
{"If the language is Telugu, respond in Telugu script (తెలుగు)." if language == "te" else ""}
{"If the language is Marathi, respond in Devanagari script (मराठी)." if language == "mr" else ""}

EXPERTISE: You are an expert in Indian agriculture — crops, pests, diseases, fertilizers, organic farming, irrigation, weather impact, market prices, and government schemes (PM-KISAN, Fasal Bima Yojana, KCC, etc.).

RULES:
1. Give practical, actionable advice that a real farmer can follow immediately
2. Include specific product names, dosages, and timing when relevant
3. Mention approximate Indian market prices when discussing crops
4. Keep responses concise (max 200 words) but information-dense
5. Use simple language that a farmer can understand
6. If asked about weather, provide general seasonal guidance
7. Always be encouraging and supportive"""

            # Prepare contents with history and current message
            contents = []
            
            # Add History
            if history:
                for h in history:
                    contents.append({
                        "role": "user" if h["type"] == "user" else "model",
                        "parts": [{"text": h["content"]}]
                    })
            
            # Add current message with system instructions on the first one or as a prefix
            current_user_parts = [{"text": system_prompt + "\n\nFarmer's current question: " + message}]
            
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
                    contents=contents
                )

            if response and response.text:
                ai_text = response.text.strip()
                suggestions = SUGGESTIONS.get(language, SUGGESTIONS["en"])
                print(f"Gemini AI response generated for language: {language}")
                return {
                    "response": ai_text,
                    "suggestions": suggestions[:5]
                }�ப்பாடு", "உர பரிந்துரை", "சந்தை விலைகள்", "வானிலை முன்னறிவிப்பு"],
    "te": ["గోధుమ సాగు చిట్కాలు", "వరి సాగు గైడ్", "పీడకుల నియంత్రణ", "ఎరువు సిఫార్సు", "మార్కెట్ ధరలు", "వాతావరణ అంచనా"],
    "mr": ["गहू लागवड टिप्स", "भात लागवड मार्गदर्शक", "कीड नियंत्रण कसे करावे", "खत शिफारसी", "आजचे बाजार भाव", "हवामान अंदाज"]
}


def get_ai_response(message: str, language: str = "en", image_url: str = None) -> Dict[str, any]:
    """
    Get AI response for farmer query.
    Uses Gemini API (same API key as disease detection) as primary,
    falls back to local keyword-based responses if unavailable.
    """
    # ===== TRY GEMINI FIRST =====
    if GEMINI_AVAILABLE and gemini_client:
        try:
            lang_name = LANGUAGE_NAMES.get(language, "English")

            system_prompt = f"""You are Digital Krishi AI — a smart, friendly farming assistant for Indian farmers.

LANGUAGE INSTRUCTION: You MUST respond entirely in {lang_name}. Every word of your response must be in {lang_name}.
{"If the language is Hindi, respond in Devanagari script (हिंदी)." if language == "hi" else ""}
{"If the language is Tamil, respond in Tamil script (தமிழ்)." if language == "ta" else ""}
{"If the language is Telugu, respond in Telugu script (తెలుగు)." if language == "te" else ""}
{"If the language is Marathi, respond in Devanagari script (मराठी)." if language == "mr" else ""}

EXPERTISE: You are an expert in Indian agriculture — crops, pests, diseases, fertilizers, organic farming, irrigation, weather impact, market prices, and government schemes (PM-KISAN, Fasal Bima Yojana, KCC, etc.).

RULES:
1. Give practical, actionable advice that a real farmer can follow immediately
2. Include specific product names, dosages, and timing when relevant
3. Mention approximate Indian market prices when discussing crops
4. Keep responses concise (max 200 words) but information-dense
5. Use simple language that a farmer can understand
6. If asked about weather, provide general seasonal guidance
7. Always be encouraging and supportive"""

            parts = [{"text": system_prompt + "\n\nFarmer's question: " + message}]
            if image_url:
                try:
                    from PIL import Image
                    filename = os.path.basename(image_url)
                    local_path = os.path.join(os.getcwd(), "static", "uploads", filename)
                    if os.path.exists(local_path):
                        img = Image.open(local_path)
                        parts.append(img)
                except Exception as e:
                    print(f"Error loading image for chat: {e}")

            try:
                response = gemini_client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=[{"role": "user", "parts": parts}]
                )
            except Exception as e:
                # Fallback to flash-latest if 2.5 has exhausted free-tier quotas or hangs
                print(f"2.5-flash failed, falling back to flash-latest. Error: {e}")
                response = gemini_client.models.generate_content(
                    model='gemini-flash-latest',
                    contents=[{"role": "user", "parts": parts}]
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
        "wheat": ["wheat", "गेहूं", "gahun", "గోధుమ", "கோதுமை", "गहू"],
        "rice": ["rice", "धान", "dhan", "వరి", "நெல்", "भात"],
        "tomato": ["tomato", "टमाटर", "tamatar", "టమాటో", "தக்காளி"],
        "potato": ["potato", "आलू", "aloo"],
        "onion": ["onion", "प्याज", "pyaz", "कांदा"],
        "corn": ["corn", "मकई", "makai", "మొక్కజొన్న"],
        "fertilizer": ["fertilizer", "उर्वरक", "urvarak", "ఎరువు", "உரம்", "खत", "khad"],
        "pest": ["pest", "कीट", "keet", "పీడకు", "பூச்சி", "कीड"],
        "irrigation": ["irrigation", "सिंचाई", "sichai", "నీటిపారుదల", "நீர்ப்பாசனம்", "सिंचन"],
        "organic": ["organic", "जैविक", "jaivik", "సేంద్రీయ", "இயற்கை", "सेंद्रिय"],
        "weather": ["weather", "मौसम", "mausam", "వాతావరణం", "வானிலை", "हवामान"],
        "market": ["market", "बाजार", "bazaar", "bazar", "మార్కెట్", "சந்தை"],
    }

    response_text = responses.get("default", responses.get("default", "I'm here to help with farming questions."))

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
        
        user_prompt = f"Current Weather: Temp: {current_weather.get('temp')}°C, Humidity: {current_weather.get('humidity')}%, Wind: {current_weather.get('wind_speed')} km/h, Condition: {current_weather.get('condition')}\nForecast/History: {forecast_summary}"
        
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

