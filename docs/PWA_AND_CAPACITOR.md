# Cbox PWA & Optional Android Capacitor Guide

## 1. Progressive Web App (PWA) Support
Cbox ships as an installable Progressive Web App for desktop browsers and Android:
- **Manifest**: `frontend/public/manifest.webmanifest` (`display: "standalone"`, `start_url: "/"`, theme/background colors, `192x192`, `512x512`, and `maskable` icons).
- **Service Worker**: `frontend/public/sw.js` caches the static app shell and serves `offline.html` when offline, while strictly bypassing `/api/*` and `/socket.io/*` so private messages and authorized media are never cached in shared browser caches.
- **Install Prompt**: `usePwaInstall` listens for `beforeinstallprompt` and surfaces an **Install Cbox App** button in the desktop sidebar and mobile top bar.

> **Important Distinction**: An installable PWA runs in standalone mode on Android with an app icon, but it is **not** a Google Play Store APK/AAB.

## 2. Installing Cbox on Android (Chrome / Edge)
1. Deploy Cbox over **HTTPS** (required by Android browsers for service workers and PWA installation).
2. Open your Cbox URL in **Chrome for Android**.
3. Tap the in-app **Install** banner (or Chrome menu `⋮` → **Install app** / **Add to Home screen**).
4. Launch **Cbox** from your Android home screen in standalone mode. Your account, theme, chats, and posts sync automatically with desktop browsers.

## 3. Optional Native Android Packaging with Capacitor (Future Step)
The project includes `frontend/capacitor.config.ts` so you can wrap the built web app into an Android APK/AAB later if you decide to publish to Google Play:

```bash
cd frontend
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
npx cap open android
```
Then configure your production `VITE_API_URL` and `VITE_WS_URL` (HTTPS backend), Android signing keystore, and Play Console listing in Android Studio.
