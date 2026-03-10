# API Keys Setup Guide

Step-by-step instructions to obtain each API key used by SocialBeats.

---

## YouTube Data API v3

**Get:** [Google Cloud Console](https://console.cloud.google.com/)

1. Create or select a project.
2. Go to **APIs & Services** > **Library**.
3. Search for **YouTube Data API v3** and enable it.
4. Go to **APIs & Services** > **Credentials**.
5. Click **Create Credentials** > **API Key**.
6. Copy the key and add to `.env` as `YOUTUBE_API_KEY`.

**Usage:** Search, trending, channel videos. If empty, oEmbed + yt-dlp fallback is used (limited search, no key required).

---

## Spotify

**Get:** [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)

1. Log in with Spotify.
2. Click **Create an app**.
3. Fill in name and description; set redirect URI (e.g. `http://localhost:8080/callback`).
4. Open your app > **Settings**.
5. Copy **Client ID** and **Client Secret**.
6. Add to `.env`:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `SPOTIFY_REDIRECT_URI` (must match the URI in Spotify app settings)

---

## Firebase

**Get:** [Firebase Console](https://console.firebase.google.com/)

1. Create or select a project.
2. Add a **Web** app (if not already added).
3. Go to **Project Settings** (gear icon) > **General**.
4. Under **Your apps**, find the web app config.
5. Copy the config values:
   - `apiKey` → `VITE_FIREBASE_API_KEY` (frontend)
   - `authDomain` → `VITE_FIREBASE_AUTH_DOMAIN`
   - `projectId` → `FIREBASE_PROJECT_ID` (backend), `VITE_FIREBASE_PROJECT_ID` (frontend)
   - `storageBucket` → `VITE_FIREBASE_STORAGE_BUCKET`
   - `messagingSenderId` → `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` → `VITE_FIREBASE_APP_ID`
6. For backend: **Project Settings** > **Service accounts** > **Web API Key** (or use Firebase config) → `FIREBASE_WEB_API_KEY`.

---

## Google OAuth (Google Sign-In)

**Get:** [Google Cloud Console](https://console.cloud.google.com/)

1. Same or new project as YouTube.
2. Go to **APIs & Services** > **Credentials**.
3. **Create Credentials** > **OAuth client ID**.
4. Application type: **Web application**.
5. Add authorized redirect URIs (e.g. `http://localhost:8080`, `https://yourdomain.com`).
6. Copy **Client ID** and **Client Secret**.
7. Add to `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

---

## Perspective API (Text Toxicity)

**Get:** [Perspective API](https://developers.perspectiveapi.com/s/)

1. Sign in with Google.
2. Request API access (free tier available).
3. Once approved, get the API key from the dashboard.
4. Add to `.env` as `PERSPECTIVE_API_KEY`.

**Note:** Perspective API sunsets Dec 31, 2026. Monitor for migration options. Without a key, a local keyword-based fallback is used.

---

## Resend (Email)

**Get:** [Resend](https://resend.com/)

1. Create an account.
2. Go to **API Keys** and create a key.
3. Add to `.env` as `RESEND_API_KEY`.
4. Set `EMAIL_FROM` (e.g. `App Name <onboarding@resend.dev>` for testing, or a verified domain).

**Free tier:** 100 emails/day.

---

## GIPHY

**Get:** [GIPHY Developers](https://developers.giphy.com/)

1. Create an account.
2. Go to **Create an App** > **API**.
3. Copy the API key.
4. Add to `.env` as `GIPHY_API_KEY`.

Without the key, GIF search/trending returns mock data.

---

## Google Cloud Vision API (Image Moderation)

**Get:** [Google Cloud Console](https://console.cloud.google.com/)

1. Enable **Cloud Vision API** for your project.
2. Go to **APIs & Services** > **Credentials**.
3. **Create Credentials** > **Service Account**.
4. Grant roles (e.g. **Cloud Vision API User**).
5. Create a JSON key and download it.
6. Set the path in `.env` as `GOOGLE_APPLICATION_CREDENTIALS`:
   ```env
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/your-service-account.json
   ```

---

## Admin API Status

Admins can check which APIs are active via:

```
GET /api/admin/api-status
```

Requires admin JWT. Response includes for each API:

- `name`, `configured` (key present and non-empty), `status` (`"ok"` | `"missing"` | `"error"`).

Some APIs are tested with a simple call (e.g. Spotify token, YouTube, Perspective, GIPHY) when keys are set.
