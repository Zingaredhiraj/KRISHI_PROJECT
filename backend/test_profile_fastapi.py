from fastapi.testclient import TestClient
from main import app
from app.database import SessionLocal
from app.models import User
import os

client = TestClient(app)

# Use the token
headers = {"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMSIsImV4cCI6MTc3NTcxNzgxMn0.AZoNvjpSHrjaGQH_vv9vODMOR3DM_MHQT-0cihtDwzw"}
payload = {"name": "Dhiraj"}

try:
    response = client.put("/api/auth/profile", headers=headers, json=payload)
    print(response.status_code)
    print(response.json())
except Exception as e:
    import traceback
    traceback.print_exc()
