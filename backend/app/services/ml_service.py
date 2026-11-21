import json
import os
import numpy as np
import io
from PIL import Image
from app.core.config import settings
import random

try:
    import tensorflow as tf
    # Disable GPU to ensure CPU-only usage
    os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False

try:
    from google import genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


def get_gemini_client():
    """Dynamically get or create genai.Client using current GEMINI_API_KEY environment variable."""
    if not GEMINI_AVAILABLE:
        return None
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        return genai.Client(api_key=api_key)
    except Exception as e:
        print(f"Failed to initialize Gemini client in ML service: {e}")
        return None


GEMINI_MODEL_CANDIDATES = [
    'gemini-3.5-flash-lite',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest'
]


class DiseaseDetectionService:
    def __init__(self):
        self.model = None
        self.disease_info = {}
        self.disease_solutions = {}
        self.disease_treatments = {}  # Comprehensive local fallback
        self.class_names = []
        self._is_loaded = False

    def load_resources(self):
        """Safely load Keras model and JSON files into memory."""
        # 1. Load JSON Data
        if settings.DISEASE_INFO_PATH.exists():
            with open(settings.DISEASE_INFO_PATH, 'r', encoding='utf-8') as f:
                self.disease_info = json.load(f)
        else:
            print(f"Warning: {settings.DISEASE_INFO_PATH} missing. Using mocked data.")
            self.disease_info = {}

        # 1.5 Extract Class Names (Essential for correct ML index mapping)
        # Use 'valid' directory which has all 38 classes matching the model output
        valid_dir = settings.DATASETS_DIR / "disease_datasets" / "valid"
        train_dir = settings.DATASETS_DIR / "disease_datasets" / "train"
        class_dir = valid_dir if (valid_dir.exists() and valid_dir.is_dir()) else train_dir
        if class_dir.exists() and class_dir.is_dir():
            # Keras sorts subdirectories alphabetically by default
            dirs = [d.name for d in class_dir.iterdir() if d.is_dir()]
            self.class_names = sorted(dirs)
            print(f"Loaded {len(self.class_names)} class names from {class_dir}")
        else:
            print(f"Warning: Training directory not found at {train_dir}. Falling back to JSON keys.")
            self.class_names = sorted(list(self.disease_info.keys()))

        if settings.SOLUTIONS_PATH.exists():
            with open(settings.SOLUTIONS_PATH, 'r', encoding='utf-8') as f:
                self.disease_solutions = json.load(f)
        else:
            print(f"Warning: {settings.SOLUTIONS_PATH} missing. Using mocked data.")
            self.disease_solutions = {}

        # 1.55 Load Comprehensive Treatment Fallback Database
        treatments_path = settings.DISEASE_INFO_PATH.parent / "disease_treatments.json"
        if treatments_path.exists():
            with open(treatments_path, 'r', encoding='utf-8') as f:
                self.disease_treatments = json.load(f)
            print(f"Loaded comprehensive treatments for {len(self.disease_treatments)} diseases.")
        else:
            print(f"Notice: {treatments_path} not found. Using basic fallback.")
            self.disease_treatments = {}

        # 1.6 Load Fertilizer Recommendations
        self.crop_fertilizers = {}
        fertilizer_path = settings.DATASETS_DIR / "fertilizer_dataset" / "fertilizer_recommendation.xls"
        if fertilizer_path.exists():
            try:
                import pandas as pd
                df = pd.read_excel(fertilizer_path)
                # Group by crop to find the top 2 recommended fertilizers for each crop
                for crop in df['Crop_Type'].unique():
                    top_ferts = df[df['Crop_Type'] == crop]['Recommended_Fertilizer'].value_counts().head(2).index.tolist()
                    self.crop_fertilizers[crop.lower()] = top_ferts
                print(f"Loaded fertilizer recommendations for {len(self.crop_fertilizers)} crops.")
            except Exception as e:
                print(f"Error loading fertilizer dataset: {e}")
        else:
            print(f"Notice: Fertilizer dataset not found at {fertilizer_path}")

        # 2. Load the Keras Model
        if TF_AVAILABLE and settings.MODEL_PATH.exists():
            print(f"Loading Keras model from {settings.MODEL_PATH}...")
            try:
                self.model = tf.keras.models.load_model(str(settings.MODEL_PATH))
                self._is_loaded = True
                print("Model loaded successfully.")
            except Exception as e:
                print(f"Failed to load model: {e}")
                self._is_loaded = False
        else:
            print(f"Notice: Model not found at {settings.MODEL_PATH} or TF not installed. Will use fallback ML logic.")
            self._is_loaded = False

    def predict(self, image_url_or_path: str, crop_hint: str = None) -> dict:
        """Process image, make prediction, and return info"""
        # Determine actual local path
        if not image_url_or_path:
            image_url_or_path = ""
            
        raw = str(image_url_or_path).split("?")[0]
        if "/uploads/" in raw:
            filename = raw.split("/uploads/")[-1]
        else:
            filename = raw.split("/")[-1]
        filename = os.path.basename(filename)
        upload_root = settings.UPLOAD_DIR.resolve()
        candidate = (settings.UPLOAD_DIR / filename).resolve()
        if not str(candidate).startswith(str(upload_root)) or not filename:
            local_path = ""
        else:
            local_path = candidate

        # 1. Primary: Direct Multimodal Gemini Vision AI Analysis
        client = get_gemini_client()
        if client and os.path.isfile(local_path):
            try:
                pil_img = Image.open(local_path).convert("RGB")
                pil_img.thumbnail((1024, 1024))
                
                hint_instruction = f"\nFarmer Note: The farmer indicated this crop may be '{crop_hint}'. Please verify whether this matches the visual leaf characteristics (e.g. trifoliate leaves for Soybean) or identify the correct crop.\n" if crop_hint else ""

                vision_prompt = f"""You are an expert plant pathologist and agronomist AI for Indian agriculture.
Analyze this plant / crop leaf image carefully.{hint_instruction}
Diagnose:
1. What crop is this? (e.g. Soybean, Tomato, Rice, Wheat, Potato, Cotton, Corn/Maize, Grape, Apple, Chili, Sugarcane, Onion, Groundnut, etc.)
2. Is it healthy or does it have a disease/pest issue? What is the specific disease name? (e.g. Early Blight, Late Blight, Yellow Rust, Leaf Spot, Rust, Powdery Mildew, Healthy)
3. Confidence level as a float between 80.0 and 99.0 (e.g. 94.5)
4. Comprehensive, actionable treatment plan in Markdown:
   - Immediate treatment (specific recommended fungicide/pesticide name, dosage per liter or acre, frequency)
   - Organic / biological treatment options (neem oil spray, Trichoderma, etc.)
   - Recommended fertilizers to strengthen crop recovery (accurate NPK combinations or micro-nutrients)
   - Actionable instructions for the farmer
5. Prevention measures for next harvest or neighboring crops

Return a strict JSON object with EXACTLY these keys:
{{
  "crop": "Crop Name",
  "disease": "Disease Name or Healthy",
  "confidence": 94.5,
  "treatment": "Markdown formatted detailed treatment & fertilizer advice",
  "prevention": "Markdown formatted prevention measures"
}}
Respond ONLY with the JSON object.
"""
                vision_resp = None
                for model_candidate in GEMINI_MODEL_CANDIDATES:
                    try:
                        vision_resp = client.models.generate_content(
                            model=model_candidate,
                            contents=[pil_img, vision_prompt]
                        )
                        if vision_resp and vision_resp.text:
                            print(f"Gemini Vision success using model candidate: {model_candidate}")
                            break
                    except Exception as ve:
                        print(f"Gemini vision attempt with {model_candidate} failed: {ve}")

                if vision_resp and vision_resp.text:
                    raw_text = vision_resp.text.strip()
                    if raw_text.startswith("```json"):
                        raw_text = raw_text[7:]
                    elif raw_text.startswith("```"):
                        raw_text = raw_text[3:]
                    if raw_text.endswith("```"):
                        raw_text = raw_text[:-3]
                    v_data = json.loads(raw_text.strip())
                    print(f"Gemini Vision successfully diagnosed {v_data.get('crop')} - {v_data.get('disease')}")
                    return {
                        "disease": v_data.get("disease", "Healthy"),
                        "confidence": float(v_data.get("confidence", 95.0)),
                        "crop": v_data.get("crop", crop_hint or "Plant"),
                        "treatment": v_data.get("treatment", "Ensure standard care and balanced nutrients."),
                        "prevention": v_data.get("prevention", "Maintain field hygiene.")
                    }
            except Exception as e:
                print(f"Gemini Vision direct diagnosis error: {e}")

        # 2. Secondary: If Keras model is loaded, run local prediction
        if self._is_loaded and TF_AVAILABLE and os.path.isfile(local_path):
            try:
                image = Image.open(local_path).convert("RGB")
                image = image.resize((128, 128)) # Model expects 128x128x3 input
                img_array = tf.keras.preprocessing.image.img_to_array(image)
                img_array = tf.expand_dims(img_array, 0)
                img_array = img_array / 255.0

                predictions = self.model.predict(img_array)
                predicted_class_index = np.argmax(predictions[0])
                confidence = float(np.max(predictions[0]))

                if self.class_names:
                    raw_disease_name = self.class_names[predicted_class_index]
                else:
                    raw_disease_name = f"Class_{predicted_class_index}"
                
                info = self.disease_info.get(raw_disease_name, {})
                solution = self.disease_solutions.get(raw_disease_name, {})
                treatment_db = self.disease_treatments.get(raw_disease_name, {})

                # Format human readable name if missing from JSON 
                default_disease_name = raw_disease_name.replace("___", " - ").replace("_", " ")
                
                crop_name = info.get("crop", treatment_db.get("crop", raw_disease_name.split("___")[0].replace("_", " ")))
                disease_display = info.get("disease", treatment_db.get("disease", default_disease_name))
                
                # Append regional fertilizer dataset recommendations based on crop
                recommended = self.crop_fertilizers.get(crop_name.lower(), [])
                
                # --- GEMINI ENHANCEMENT ---
                gemini_success = False
                base_treatment = ""
                
                if client:
                    for model_cand in GEMINI_MODEL_CANDIDATES:
                        try:
                            prompt = f"""You are an agricultural expert AI.

Detected Disease: {disease_display}
Crop: {crop_name}

Generate only practical treatment and fertilizer recommendations.

Return:
1. Immediate treatment (fungicide / pesticide name with usage guidance)
2. Organic treatment options
3. Recommended fertilizers to strengthen crop recovery
4. Short actionable farmer instructions

Keep response concise.
Do not include disease overview.
Do not include symptoms.
Do not include prevention measures.
Only return solution-focused content suitable for direct display under:
"Recommended Treatment & Fertilizer Solutions"."""
                            if recommended:
                                prompt += f"\n\nAlso consider incorporating these highly recommended fertilizers for {crop_name}: {', '.join(recommended)}"
                                
                            response = client.models.generate_content(
                                model=model_cand,
                                contents=prompt
                            )

                            if response and response.text:
                                base_treatment = response.text.strip()
                                gemini_success = True
                                break
                        except Exception as ge:
                            print(f"Gemini API Error with {model_cand}: {ge}")
                
                # --- LOCAL FALLBACK (when Gemini fails or is unavailable) ---
                if not gemini_success:
                    # Use comprehensive local treatment database
                    if treatment_db and treatment_db.get("treatment"):
                        base_treatment = treatment_db["treatment"]
                        print(f"Using local treatment database for: {raw_disease_name}")
                    else:
                        # Build treatment from disease_solutions.json (structured data)
                        sol_treatment = solution.get("treatment", {})
                        if isinstance(sol_treatment, dict) and (sol_treatment.get("chemical") or sol_treatment.get("organic")):
                            parts = []
                            chem = sol_treatment.get("chemical", {}).get("en", [])
                            org = sol_treatment.get("organic", {}).get("en", [])
                            if chem:
                                parts.append("## Immediate Treatment")
                                for i, c in enumerate(chem, 1):
                                    parts.append(f"{i}. **{c['name']}** — {c.get('dosage', '')} every {c.get('frequency', 'as needed')}")
                            if org:
                                parts.append("\n## Organic Treatment")
                                for o in org:
                                    parts.append(f"- **{o['name']}** — {o.get('dosage', '')} every {o.get('frequency', 'as needed')}")
                            if parts:
                                base_treatment = "\n".join(parts)
                            else:
                                base_treatment = f"## Treatment Recommendations\n1. Apply appropriate fungicide based on disease type\n2. Consult local agricultural extension officer for {crop_name}-specific guidance\n3. Remove infected plant parts and destroy them\n4. Ensure proper plant spacing and air circulation"
                        elif isinstance(sol_treatment, str) and sol_treatment:
                            base_treatment = sol_treatment
                        else:
                            base_treatment = f"## Treatment Recommendations\n1. Apply appropriate fungicide based on disease type\n2. Consult local agricultural extension officer for {crop_name}-specific guidance\n3. Remove infected plant parts and destroy them\n4. Ensure proper plant spacing and air circulation"
                    
                    # Append fertilizer database recommendations
                    if recommended:
                        base_treatment += f"\n\n**Recommended Fertilizers:** {', '.join(recommended)}"

                # Build prevention text
                prevention_text = ""
                if treatment_db.get("prevention"):
                    prevention_text = treatment_db["prevention"]
                else:
                    sol_prevention = solution.get("prevention", {})
                    if isinstance(sol_prevention, dict):
                        prev_list = sol_prevention.get("en", [])
                        prevention_text = ". ".join(prev_list) + "." if prev_list else "Maintain field hygiene."
                    elif isinstance(sol_prevention, str):
                        prevention_text = sol_prevention
                    else:
                        prevention_text = "Maintain field hygiene."

                return {
                    "disease": disease_display,
                    "confidence": round(confidence * 100, 2),
                    "crop": crop_name,
                    "treatment": base_treatment,
                    "prevention": prevention_text
                }
            except Exception as e:
                print(f"Prediction Error: {e}")

        # --- FALLBACK WHEN AI VISION AND LOCAL MODEL ARE BOTH UNAVAILABLE ---
        crop_display = crop_hint if crop_hint else "Unidentified Plant"
        
        # Check if crop_hint matches any known healthy database treatment
        matched_treatment = None
        matched_prevention = "Ensure field hygiene and disease-free seeds."
        if crop_hint:
            for key, val in self.disease_treatments.items():
                if val.get("crop", "").lower() == crop_hint.lower() and "healthy" in key.lower():
                    matched_treatment = val.get("treatment")
                    matched_prevention = val.get("prevention", matched_prevention)
                    break

        if not matched_treatment:
            matched_treatment = "AI image analysis service is temporarily busy. Please retry in 1 minute or consult your local agricultural extension officer."

        return {
            "disease": "Diagnosis Unavailable (AI Limit)",
            "confidence": 50.0,
            "crop": crop_display,
            "treatment": matched_treatment,
            "prevention": matched_prevention
        }
        
    def predict_best_crop(self, soil_type: str, water_level: str, temperature_history: list, humidity_history: list) -> dict:
        """
        Uses Gemini (or fallback logic) to recommend the best crop based on historical weather and field conditions.
        """
        avg_temp = sum(temperature_history) / len(temperature_history) if temperature_history else 28.0
        avg_hum = sum(humidity_history) / len(humidity_history) if humidity_history else 65.0
        
        fallback_response = {
            "recommended_crop": "Wheat or Mustard" if avg_temp < 20 else "Cotton or Maize" if avg_temp > 30 else "Rice or Soyabean",
            "reasoning": f"Based on the average temperature of {avg_temp:.1f}°C and {soil_type} soil, these crops optimize yield with {water_level} water availability.",
            "best_practices": "Ensure proper field drainage. Monitor soil moisture daily and apply NPK fertilizers."
        }

        client = get_gemini_client()
        if not client:
            return fallback_response

        try:
            prompt = f"""You are an expert agronomist AI.
Suggest the single best optimal crop (or top 2 crops) to plant based on these conditions:
- Soil Type: {soil_type}
- Water Availability: {water_level}
- Past 15-day Avg Temperature: {avg_temp:.1f}°C
- Past 15-day Avg Humidity: {avg_hum:.1f}%

Return a strict JSON object with EXACTLY these keys:
"recommended_crop": (String, e.g., 'Cotton and Maize')
"reasoning": (String, e.g., 'Detailed reason why this fits the conditions')
"best_practices": (String, e.g., 'A few brief best practices for this crop')

Ensure the response is ONLY valid JSON, without any markdown formatting or code blocks.
"""
            response = None
            for model_cand in GEMINI_MODEL_CANDIDATES:
                try:
                    response = client.models.generate_content(
                        model=model_cand,
                        contents=prompt
                    )
                    if response and response.text:
                        break
                except Exception as model_err:
                    print(f"Crop prediction model {model_cand} failed: {model_err}")
            
            if response and response.text:
                json_str = response.text.replace('```json', '').replace('```', '').strip()
                import json
                result = json.loads(json_str)
                return {
                    "recommended_crop": result.get("recommended_crop", fallback_response["recommended_crop"]),
                    "reasoning": result.get("reasoning", fallback_response["reasoning"]),
                    "best_practices": result.get("best_practices", fallback_response["best_practices"])
                }
        except Exception as e:
            print(f"Gemini Crop Prediction Error: {e}")
            
        return fallback_response


ml_service = DiseaseDetectionService()
