# Ortam Degiskenleri - Ozellik Refansi

Hangi ozellik icin hangi env degiskenlerinin doldurulmasi gerektigi.

| Ortam Degiskeni | Ozellik / Servis |
|-----------------|------------------|
| MONGO_URL, DB_NAME | Tum uygulama (kullanici, gonderi, hikaye, mesaj) |
| JWT_SECRET | Giris, 2FA, oturum |
| POSTGRES_URL | Profil, ayarlar, takip, referral, bildirim, gamification |
| GEMINI_API_KEY | AI calma listesi, yillik ozet, ruh hali onerisi, soz/duygu analizi |
| HF_API_TOKEN | Icerik moderasyonu, toksik yorum |
| R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY, R2_BUCKET, R2_PUBLIC_URL | Medya (profil, gonderi, hikaye), GDPR |
| MEILISEARCH_URL, MEILISEARCH_MASTER_KEY | Arama |
| TRENCH_URL, TRENCH_API_KEY | Event tracking, analitik, ekran suresi |
| EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE | Mesajlasma |
| SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM | E-posta (sifre sifirlama) |
| GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET | Google OAuth |
| LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET | Canli yayin |
| YOUTUBE_API_KEY | YouTube (opsiyonel) |
| SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI | Spotify (opsiyonel) |
| GIPHY_API_KEY | GIF (opsiyonel) |
| FREESOUND_API_KEY | Bildirim sesleri (opsiyonel) |
| GRAFANA_URL, GRAFANA_API_KEY | Dashboard (opsiyonel) |
| FRONTEND_URL | CORS, yonlendirmeler |

Tam liste: backend/.env.example
