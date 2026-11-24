# Cbox — Responsive Social Chat App + Installable Android PWA

Cbox is a full-stack social messaging and photo-sharing platform built for desktop browsers, mobile browsers, and Android (installable PWA directly from the website, with Capacitor readiness for future native Android packaging). Frontend, Backend API, Socket.IO real-time messaging, and PostgreSQL run together cleanly on **Render** over HTTPS with zero CORS or mobile cookie issues.

---

## Quick Deploy: GitHub → Render (Recommended, 5 Minutes)

Because Cbox includes `render.yaml`, Render automatically creates your **PostgreSQL database** and deploys **both the Frontend + Backend on one HTTPS URL** (making Android PWA "Install App" work immediately!).

1. **Upload to GitHub**:
   - Unzip `cbox-render-ready.zip`.
   - Create a new repository on GitHub (e.g., `cbox-app`).
   - Upload all unzipped files (`render.yaml`, `package.json`, `backend/`, `frontend/`, `docs/`, `.gitignore`) directly to the root of your GitHub repository.
2. **Deploy on Render**:
   - Sign in to Render → click **New +** → **Blueprint**.
   - Connect your GitHub repository (`cbox-app`).
   - Render detects `render.yaml` automatically.
   - When prompted for `DEVELOPER_ACCESS_CODE`:
     - For demo testing with the supplied 9-digit code, enter `147852369` (with `DEVELOPER_CODE_ALLOW_DEMO_9_DIGIT=true` already set in `render.yaml`).
     - For production, set `DEVELOPER_CODE_ALLOW_DEMO_9_DIGIT=false` and enter a confirmed **12-digit** secret.
   - Click **Apply** — Render will create PostgreSQL, run migrations, build the React/Vite PWA, and launch `https://cbox-app.onrender.com`!
3. **Install as an App on Mobile (Android / iPhone)**:
   - Open your Render HTTPS URL on your phone in Chrome (Android) or Safari (iPhone).
   - Tap the **Install App** button in the top bar (or on the Login screen) to add Cbox to your home screen as a full-screen standalone app!
4. **Persistent Images on Render Production**:
   - Render's free disk resets on redeploy. For permanent profile/post photos in production, configure a free private **Cloudflare R2** or **S3** bucket (`STORAGE_DRIVER=s3` + S3 env vars — see `docs/EXTERNAL_SETUP.md`).

---

## Local Development Setup

```bash
docker compose up -d
cp .env.example backend/.env
npm install
npm --workspace=backend run db:generate
npm --workspace=backend run db:migrate
npm --workspace=backend run db:seed
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Run tests: `npm test`

### Demo Accounts (Seeded with `isDemo = true`, password: `CboxDemo!2026`)
- `@maya_chen`, `@alex_rivera`, `@sam_patel` (standard users)
- `@dev_cbox` (pre-seeded `DEVELOPER` role)

See `docs/API_AND_REALTIME.md`, `docs/SECURITY_AND_PERMISSIONS.md`, `docs/PWA_AND_CAPACITOR.md`, and `docs/EXTERNAL_SETUP.md` for complete technical documentation.
"# cbox-app" 
