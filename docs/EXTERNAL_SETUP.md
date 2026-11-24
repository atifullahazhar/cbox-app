# External Credentials & Production Deployment Setup

Local development works out of the box with Docker PostgreSQL and `STORAGE_DRIVER=local`. Before deploying Cbox to a shared or production environment (including Android PWA installation over HTTPS), complete the following external setup steps:

| Component | Required Environment Variables | Setup Action Needed |
| :--- | :--- | :--- |
| **Managed PostgreSQL** | `DATABASE_URL` | Provision PostgreSQL 15/16 (e.g., Supabase, Neon, RDS, or Railway) with SSL enabled and run `npm --workspace=backend run db:migrate`. |
| **Private Object Storage (S3 / R2 / MinIO)** | `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Create a **private** bucket (block all public access) so images are only served through `/api/media/:mediaId`. |
| **HTTPS & Cookie Security** | `NODE_ENV=production`, `APP_ORIGIN`, `COOKIE_SECURE=true`, `TRUST_PROXY=true`, `SESSION_SECRET` | Terminate TLS/HTTPS at your reverse proxy or platform (required for `Secure` cookies and Android PWA install). Generate a 48+ byte random `SESSION_SECRET`. |
| **Confirmed 12-Digit Developer Code** | `DEVELOPER_ACCESS_CODE`, `DEVELOPER_CODE_ALLOW_DEMO_9_DIGIT=false` | Store your confirmed **12-digit** developer access code in your secret manager. Do not use the 9-digit prototype code in production. |
| **Trust & Safety Policy** | `ALLOW_BLOCKING_DEVELOPERS=true` | Enable blocking for all accounts (including developers) in production. |
| **Future: Password Recovery Contact** | *(Not yet enabled)* | Username-only accounts have no verified email/phone. To support password recovery later, integrate a transactional email/SMS provider (e.g., Resend, Postmark, Twilio) and verified recovery tokens. |
| **Future: Native Android Play Store Build** | Android Studio signing keystore | Optional Capacitor workflow documented in `docs/PWA_AND_CAPACITOR.md`. |
