"""
Chatterbox Python Security & OTP Auth Microservice (FastAPI + Argon2id)
Runs privately on 127.0.0.1:8001 inside the container and handles:
- E.164 phone number validation & normalization (1 phone = 1 account)
- Argon2id password & Secret PIN hashing/verification
- Cryptographically secure 6-digit OTP generation & constant-time HMAC-SHA256 verification
- SMS OTP dispatch via Twilio / MSG91 (or clearly labelled demo mode when unconfigured)
"""
import hashlib
import hmac
import os
import re
import secrets
from typing import Optional

import httpx
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Chatterbox Python Auth Security Engine", docs_url=None, redoc_url=None)

ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=1)

INTERNAL_AUTH_KEY = os.getenv("INTERNAL_AUTH_KEY", "chatterbox-local-internal-key")
OTP_HMAC_SECRET = os.getenv("SESSION_SECRET", "dev-only-otp-hmac-secret")
SMS_PROVIDER = os.getenv("SMS_PROVIDER", "demo").lower()  # demo | twilio | msg91
OTP_DEMO_MODE = os.getenv("OTP_DEMO_MODE", "true").lower() == "true"

# Indian 10-digit mobile or E.164 international format (+<country><number>, 8-15 digits)
E164_RE = re.compile(r"^\+[1-9]\d{7,14}$")
DIGITS_ONLY_RE = re.compile(r"\D+")


def verify_internal_key(x_internal_key: Optional[str]) -> None:
    if not x_internal_key or not hmac.compare_digest(x_internal_key, INTERNAL_AUTH_KEY):
        raise HTTPException(status_code=403, detail="Forbidden internal request")


def normalize_phone_e164(raw_phone: str, default_country_code: str = "+91") -> str:
    cleaned = raw_phone.strip()
    if cleaned.startswith("+"):
        digits = "+" + DIGITS_ONLY_RE.sub("", cleaned[1:])
    else:
        digits_only = DIGITS_ONLY_RE.sub("", cleaned)
        # Strip leading 0 for local 10-digit Indian numbers
        if len(digits_only) == 11 and digits_only.startswith("0"):
            digits_only = digits_only[1:]
        if len(digits_only) == 10:
            digits = f"{default_country_code}{digits_only}"
        else:
            digits = f"+{digits_only}"

    if not E164_RE.match(digits):
        raise ValueError("Enter a valid mobile number (e.g. +919876543210 or 10-digit number).")
    return digits


def hash_otp_code(phone_e164: str, purpose: str, code: str) -> str:
    msg = f"{phone_e164}:{purpose}:{code}".encode("utf-8")
    return hmac.new(OTP_HMAC_SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def verify_otp_hash(phone_e164: str, purpose: str, code: str, expected_hash: str) -> bool:
    computed = hash_otp_code(phone_e164, purpose, code.strip())
    return hmac.compare_digest(computed, expected_hash)


async def dispatch_sms(phone_e164: str, code: str, purpose: str) -> dict:
    label = {
        "SIGNUP": "account verification",
        "LOGIN": "login",
        "RESET_PASSWORD": "password reset",
    }.get(purpose, "verification")
    message_text = f"Chatterbox: Your {label} OTP is {code}. Valid for 5 minutes. Never share this code."

    if SMS_PROVIDER == "twilio":
        sid = os.getenv("TWILIO_ACCOUNT_SID", "")
        token = os.getenv("TWILIO_AUTH_TOKEN", "")
        from_num = os.getenv("TWILIO_FROM_NUMBER", "")
        if not (sid and token and from_num):
            raise HTTPException(status_code=503, detail="Twilio SMS credentials are not configured on the server.")
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
                auth=(sid, token),
                data={"From": from_num, "To": phone_e164, "Body": message_text},
            )
            if resp.status_code >= 400:
                raise HTTPException(status_code=502, detail="SMS gateway rejected OTP delivery.")
        return {"deliveredVia": "twilio", "demoCode": None}

    if SMS_PROVIDER == "msg91":
        authkey = os.getenv("MSG91_AUTH_KEY", "")
        template_id = os.getenv("MSG91_TEMPLATE_ID", "")
        if not (authkey and template_id):
            raise HTTPException(status_code=503, detail="MSG91 SMS credentials are not configured on the server.")
        mobile_no_plus = phone_e164.lstrip("+")
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://control.msg91.com/api/v5/otp",
                headers={"authkey": authkey, "content-type": "application/json"},
                json={"template_id": template_id, "mobile": mobile_no_plus, "otp": code},
            )
            if resp.status_code >= 400:
                raise HTTPException(status_code=502, detail="MSG91 rejected OTP delivery.")
        return {"deliveredVia": "msg91", "demoCode": None}

    # Demo mode (when no external SMS provider credentials are configured)
    return {"deliveredVia": "demo", "demoCode": code if OTP_DEMO_MODE else None}


class PhoneRequest(BaseModel):
    phone: str = Field(..., min_length=6, max_length=24)


class PasswordHashRequest(BaseModel):
    password: str = Field(..., min_length=4, max_length=128)


class PasswordVerifyRequest(BaseModel):
    passwordHash: str = Field(..., min_length=10)
    password: str = Field(..., min_length=1, max_length=128)


class OtpCreateRequest(BaseModel):
    phone: str = Field(..., min_length=6, max_length=24)
    purpose: str = Field(..., pattern="^(SIGNUP|LOGIN|RESET_PASSWORD)$")


class OtpVerifyRequest(BaseModel):
    phone: str = Field(..., min_length=6, max_length=24)
    purpose: str = Field(..., pattern="^(SIGNUP|LOGIN|RESET_PASSWORD)$")
    code: str = Field(..., min_length=6, max_length=6)
    expectedHash: str = Field(..., min_length=32)


@app.get("/internal/health")
def health():
    return {"status": "ok", "engine": "python-argon2id-otp", "smsProvider": SMS_PROVIDER}


@app.post("/internal/phone/normalize")
def api_normalize_phone(body: PhoneRequest, x_internal_key: Optional[str] = Header(default=None)):
    verify_internal_key(x_internal_key)
    try:
        normalized = normalize_phone_e164(body.phone)
        return {"phoneNormalized": normalized}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/internal/password/hash")
def api_hash_password(body: PasswordHashRequest, x_internal_key: Optional[str] = Header(default=None)):
    verify_internal_key(x_internal_key)
    return {"passwordHash": ph.hash(body.password)}


@app.post("/internal/password/verify")
def api_verify_password(body: PasswordVerifyRequest, x_internal_key: Optional[str] = Header(default=None)):
    verify_internal_key(x_internal_key)
    try:
        valid = ph.verify(body.passwordHash, body.password)
        return {"valid": bool(valid)}
    except VerifyMismatchError:
        return {"valid": False}
    except Exception:
        return {"valid": False}


@app.post("/internal/otp/create")
async def api_create_otp(body: OtpCreateRequest, x_internal_key: Optional[str] = Header(default=None)):
    verify_internal_key(x_internal_key)
    try:
        phone_e164 = normalize_phone_e164(body.phone)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    code = f"{secrets.randbelow(1_000_000):06d}"
    code_hash = hash_otp_code(phone_e164, body.purpose, code)
    delivery = await dispatch_sms(phone_e164, code, body.purpose)

    return {
        "phoneNormalized": phone_e164,
        "codeHash": code_hash,
        "deliveredVia": delivery["deliveredVia"],
        "demoCode": delivery["demoCode"],
    }


@app.post("/internal/otp/verify")
def api_verify_otp(body: OtpVerifyRequest, x_internal_key: Optional[str] = Header(default=None)):
    verify_internal_key(x_internal_key)
    try:
        phone_e164 = normalize_phone_e164(body.phone)
    except ValueError:
        return {"valid": False}

    valid = verify_otp_hash(phone_e164, body.purpose, body.code, body.expectedHash)
    return {"valid": valid}
