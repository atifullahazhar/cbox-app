# Chatterbox — Full-Stack Social Chat App + Python OTP Security Engine

Chatterbox (formerly Cbox) is a responsive social messaging and photo-sharing PWA for desktop browsers, mobile browsers, and Android. It combines a **Python FastAPI + Argon2id security & OTP authentication engine** with a **Node.js/Express + PostgreSQL/Prisma + Socket.IO** backend and a **React + TypeScript + Tailwind** frontend inside one Docker-ready Render deployment.

## What's Included in Phase 2
- **Chatterbox Rebrand**: Fresh branding across UI, PWA manifest, offline screen, and headers.
- **Python Auth & Security Engine (`python-auth/app.py`)**:
  - **1 Phone Number = 1 Account**: E.164 phone normalization (`+91` default for 10-digit Indian numbers or international `+...`) enforced by a PostgreSQL `UNIQUE` constraint.
  - **Phone + 6-Digit OTP Signup & Login**: Cryptographic OTP generation, HMAC-SHA256 hashing, 5-minute expiry, max 5 attempts, and rate limiting.
  - **Password Login + Forgot Password via Phone OTP**: Argon2id hashing/verification via Python `argon2-cffi`; resetting password revokes all active sessions.
  - **Live SMS Setup**: Set `SMS_PROVIDER=twilio` (with `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`) or `SMS_PROVIDER=msg91` (with `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`) and `OTP_DEMO_MODE=false` in Render Environment Variables for real SMS OTP delivery. Until configured, `SMS_PROVIDER=demo` shows a clearly labelled Demo OTP banner for testing.
- **Secret Mode (Live)**: 4–6 digit PIN-protected **Secret Vault** to hide chats from General + **Disappearing Messages timer** (`Off`, `5 min`, `1 hr`, `24 hr`).
- **Privacy & Safety**: **Hide Online Status**, **Disable Read Receipts**, real **Report User / Report Post** modal, and an audited **Safety Reports Moderation Queue** inside Developer Space.
- **Web Push Notifications**: Browser notification opt-in + VAPID-ready subscription endpoint (`/api/push/subscribe`).

## Updating Your Existing Render Service (Important!)
Because Phase 2 runs **Python + Node.js together via `Dockerfile`**:
1. Upload the unzipped files to your `atifullahazhar/cbox-app` GitHub repo (root level).
2. On **Render Dashboard → `cbox-app` → Settings**, change **Language / Runtime** to **Docker** (or sync your Blueprint via **Blueprints → `cbox` → Manual sync** so Render picks up `runtime: docker` from `render.yaml`).
3. Existing PostgreSQL user data in `cbox-db` is preserved via additive migrations (`prisma migrate deploy`).
