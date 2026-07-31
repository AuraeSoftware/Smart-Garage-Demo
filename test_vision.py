import requests

session = requests.Session()
login = session.post('http://127.0.0.1:8000/api/auth/login', json={"username": "admin", "password": "password"})
print("Login:", login.status_code, login.text)
token = login.json().get("access_token")

with open('src/assets/Rwash-Brand-Color/RWASH-Typo-logo-head-.png', 'rb') as f:
    res = requests.post(
        'http://127.0.0.1:8000/api/vision/analyze-car', 
        headers={"Authorization": f"Bearer {token}"},
        files={'file': ('image.jpg', f, 'image/jpeg')}
    )
print(res.status_code)
with open('res.txt', 'w', encoding='utf-8') as out:
    out.write(res.text)
