"""
OTP Service — Real SMS delivery with Fast2SMS (India) or Twilio fallback.

How to get a FREE SMS OTP service for India:
═══════════════════════════════════════════
Option A ─ Fast2SMS (Recommended for India, FREE tier)
  1. Sign up at https://www.fast2sms.com/
  2. Go to Dev API → Generate API Key
  3. Add to .env:  SMS_PROVIDER=fast2sms
                   FAST2SMS_API_KEY=your-api-key-here

Option B ─ Twilio (Global, Trial is free)
  1. Sign up at https://www.twilio.com/
  2. Get Account SID, Auth Token, and a Twilio phone number
  3. Add to .env:  SMS_PROVIDER=twilio
                   TWILIO_ACCOUNT_SID=ACxxxxxxxx
                   TWILIO_AUTH_TOKEN=xxxxxxxx
                   TWILIO_PHONE=+1XXXXXXXXXX

Option C ─ 2Factor.in (India, Pay-per-use, very cheap)
  1. Sign up at https://2factor.in/
  2. Get API key from dashboard
  3. Add to .env:  SMS_PROVIDER=2factor
                   TWOFACTOR_API_KEY=your-key-here

If no provider is configured → DEMO mode (OTP shown in API response).
"""

import os
import httpx
import asyncio
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SMS_PROVIDER = os.getenv("SMS_PROVIDER", "demo").lower()
FAST2SMS_API_KEY = os.getenv("FAST2SMS_API_KEY", "")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE = os.getenv("TWILIO_PHONE", "")
TWOFACTOR_API_KEY = os.getenv("TWOFACTOR_API_KEY", "")


async def send_otp_sms(phone: str, otp: str) -> dict:
    """
    Send OTP via configured SMS provider.
    Returns: {"success": True/False, "message": "...", "demo": True/False}
    """
    # Normalize phone: remove country code for Fast2SMS / 2Factor (need 10-digit)
    clean_phone = phone.replace("+91", "").replace("+", "").replace(" ", "").strip()
    if clean_phone.startswith("91") and len(clean_phone) == 12:
        clean_phone = clean_phone[2:]

    if SMS_PROVIDER == "fast2sms" and FAST2SMS_API_KEY:
        return await _send_fast2sms(clean_phone, otp)

    elif SMS_PROVIDER == "twilio" and TWILIO_ACCOUNT_SID:
        full_phone = f"+91{clean_phone}" if not phone.startswith("+") else phone
        return await _send_twilio(full_phone, otp)

    elif SMS_PROVIDER == "2factor" and TWOFACTOR_API_KEY:
        return await _send_2factor(clean_phone, otp)

    else:
        # DEMO mode — OTP is visible in response (for development/testing)
        logger.info(f"[DEMO OTP] Phone: {phone} | OTP: {otp}")
        return {
            "success": True,
            "demo": True,
            "message": f"Demo mode: OTP is {otp} (no SMS sent). Configure SMS_PROVIDER in .env for real SMS."
        }


async def _send_fast2sms(phone_10: str, otp: str) -> dict:
    """Send OTP via Fast2SMS Quick SMS API."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://www.fast2sms.com/dev/bulkV2",
                headers={"authorization": FAST2SMS_API_KEY},
                data={
                    "route": "otp",
                    "variables_values": otp,
                    "flash": "0",
                    "numbers": phone_10,
                }
            )
            data = resp.json()
            if data.get("return") is True:
                logger.info(f"[Fast2SMS] OTP sent to {phone_10}")
                return {"success": True, "demo": False, "message": "OTP sent via SMS"}
            else:
                logger.error(f"[Fast2SMS] Failed: {data}")
                return {"success": False, "demo": False, "message": str(data.get("message", "SMS failed"))}
    except Exception as e:
        logger.error(f"[Fast2SMS] Exception: {e}")
        return {"success": False, "demo": False, "message": "SMS service error"}


async def _send_twilio(phone_full: str, otp: str) -> dict:
    """Send OTP via Twilio SMS."""
    try:
        import base64
        credentials = base64.b64encode(
            f"{TWILIO_ACCOUNT_SID}:{TWILIO_AUTH_TOKEN}".encode()
        ).decode()

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json",
                headers={"Authorization": f"Basic {credentials}"},
                data={
                    "To": phone_full,
                    "From": TWILIO_PHONE,
                    "Body": f"Your Digital Krishi OTP is: {otp}. Valid for 5 minutes. Do not share this code.",
                }
            )
            data = resp.json()
            if resp.status_code in (200, 201):
                logger.info(f"[Twilio] OTP sent to {phone_full}")
                return {"success": True, "demo": False, "message": "OTP sent via SMS"}
            else:
                logger.error(f"[Twilio] Failed: {data}")
                return {"success": False, "demo": False, "message": str(data.get("message", "SMS failed"))}
    except Exception as e:
        logger.error(f"[Twilio] Exception: {e}")
        return {"success": False, "demo": False, "message": "SMS service error"}


async def _send_2factor(phone_10: str, otp: str) -> dict:
    """Send OTP via 2Factor.in."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://2factor.in/API/V1/{TWOFACTOR_API_KEY}/SMS/{phone_10}/{otp}/OTP1"
            )
            data = resp.json()
            if data.get("Status") == "Success":
                logger.info(f"[2Factor] OTP sent to {phone_10}")
                return {"success": True, "demo": False, "message": "OTP sent via SMS"}
            else:
                logger.error(f"[2Factor] Failed: {data}")
                return {"success": False, "demo": False, "message": str(data.get("Details", "SMS failed"))}
    except Exception as e:
        logger.error(f"[2Factor] Exception: {e}")
        return {"success": False, "demo": False, "message": "SMS service error"}
