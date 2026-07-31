import os
import time
import bcrypt
from typing import Optional
from jose import JWTError, jwt

SECRET_KEY = os.getenv("SECRET_KEY", "washpro-secret-2026-aurae-os2studio")
ALGORITHM  = "HS256"
TOKEN_DAYS = 30


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))


def create_token(data: dict) -> str:
    payload = data.copy()
    # CRITICAL FIX: exp MUST be an integer Unix timestamp
    # python-jose 3.3.0 silently issues but then FAILS to validate
    # tokens where exp is a Python datetime object — causing instant 401
    payload["exp"] = int(time.time()) + (TOKEN_DAYS * 24 * 3600)
    # JWT spec: sub must be a string
    payload["sub"] = str(payload.get("sub", ""))
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None