import requests

url = "http://localhost:8000/api/auth/otp/verify"
payload = {"email": "mytest@gmail.com", "otp": "123456"}
res = requests.post(url, json=payload)
print(res.status_code)
print(res.text)
