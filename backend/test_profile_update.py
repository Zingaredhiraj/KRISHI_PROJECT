import requests

url = "http://localhost:8000/api/auth/profile"
headers = {
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMSIsImV4cCI6MTc3NTcxNzgxMn0.AZoNvjpSHrjaGQH_vv9vODMOR3DM_MHQT-0cihtDwzw",
    "Content-Type": "application/json"
}
data = {"name": "Dhiraj"}

try:
    res = requests.put(url, headers=headers, json=data)
    print(res.status_code)
    print(res.text)
except Exception as e:
    print(e)
