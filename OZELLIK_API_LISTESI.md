# SocialBeats - Ozellik Bazli API Listesi

Her ozellik icin kullanilan API/servisler.

---

## 1. Kimlik Dogrulama ve Hesap

| Ozellik | API / Servis |
|---------|--------------|
| Kayit / Giris (email, sifre) | MongoDB, JWT |
| Sifre sifirlama | Brevo (SMTP) |
| 2FA | MongoDB, JWT |
| Google OAuth | Google OAuth 2.0 (GOOGLE_CLIENT_ID/SECRET) |
| Hesap gecisi | NextAuth.js, PostgreSQL |
| Hesap silme | PostgreSQL, MongoDB, Cloudflare R2 |

---

## 2. Profil ve Ayarlar

| Ozellik | API / Servis |
|---------|--------------|
| Profil goruntuleme/duzenleme | PostgreSQL, Cloudflare R2 |
| Gizlilik ayarlari | PostgreSQL |
| Bildirim tercihleri | PostgreSQL, MMKV |
| Tema secimi | MMKV, NativeWind, PostgreSQL |
| Dil secimi | MMKV, REST Countries API, PostgreSQL |
| Muzik kalitesi | MMKV, Expo AV |
| Zaman dilimi / para birimi | PostgreSQL, Frankfurter.app |
| Onbellek temizleme | MMKV |
| GDPR veri indirme | PostgreSQL, Cloudflare R2 |

---

## 3. i18n

| Ozellik | API / Servis |
|---------|--------------|
| Dil listesi | REST Countries API |
| Ceviri | MyMemory API, Lingva |
| Locales | PostgreSQL, i18n/locales |

---

## 4. Sosyal

| Ozellik | API / Servis |
|---------|--------------|
| Takip / takipci | PostgreSQL, MongoDB (feed sync) |
| Engel | PostgreSQL, MongoDB |
| Yakin arkadaslar | PostgreSQL |
| Gonderi CRUD | MongoDB, Cloudflare R2 |
| Begeni / yorum | MongoDB |
| Hikaye | MongoDB, Cloudflare R2, PostgreSQL |
| Paylasim | PostgreSQL, share routes |
| Referral | PostgreSQL |

---

## 5. Muzik

| Ozellik | API / Servis |
|---------|--------------|
| Calma listesi | PostgreSQL, MongoDB |
| Sarki sozleri | LRCLIB, lyrics.ovh |
| Karaoke | LRCLIB |
| Kesif / trending | discover routes |
| Ruh haline gore oneri | Google Gemini API |
| Kisisellestirilmis oneri | Google Gemini + Trench |
| AI calma listesi | Google Gemini API |
| Dinleme odasi | Socket.IO |

---

## 6. Moderasyon

| Ozellik | API / Servis |
|---------|--------------|
| Gorsel moderasyon | NudeNet |
| Metin toksisitesi | Detoxify, Hugging Face (HF_API_TOKEN) |
| Toksik yorum API | Hugging Face |
| Sarki sozu analizi | Google Gemini |
| Duygu analizi | Google Gemini |
| Otomatik etiketleme | Google Gemini |
| Rapor nedenleri | PostgreSQL |

---

## 7. Bildirim ve Mesajlasma

| Ozellik | API / Servis |
|---------|--------------|
| Push bildirim | Expo Notifications |
| Bildirim tercihleri | PostgreSQL, MMKV |
| Mesajlasma | Evolution API (EVOLUTION_API_URL/KEY) |
| Sessiz saatler (DND) | PostgreSQL |

---

## 8. Canli Yayin

| Ozellik | API / Servis |
|---------|--------------|
| Canli yayin | LiveKit (LIVEKIT_URL/API_KEY/SECRET) |
| Reels | music_routes/feed |

---

## 9. Analitik ve Gamification

| Ozellik | API / Servis |
|---------|--------------|
| Event tracking | Trench (TRENCH_URL/API_KEY) |
| Ekran suresi | Trench, MongoDB |
| Profil istatistikleri | Trench, Grafana |
| Yillik ozet | Google Gemini |
| Rozet / basarim | PostgreSQL, Trench |
| Kullanici seviyesi / XP | PostgreSQL |

---

## 10. Arama

| Ozellik | API / Servis |
|---------|--------------|
| Arama (kullanici, gonderi, playlist) | Meilisearch (MEILISEARCH_URL/MASTER_KEY) |
| Arama gecmisi | MMKV, PostgreSQL |

---

## 11. Diger

| Ozellik | API / Servis |
|---------|--------------|
| Cografi / yakinadakiler | geo routes, PostgreSQL |
| QR profil paylasimi | React Native QR Code |
| Yedekleme | PostgreSQL, MongoDB, R2 |
| Hesap birlestirme | backup/merge-accounts |

---

## Ozet: Kullanilan Dis API / Servisler

- **Google Gemini API** (GEMINI_API_KEY): AI calma listesi, yillik ozet, ruh hali, soz analizi, duygu, etiketleme
- **Hugging Face** (HF_API_TOKEN): Moderasyon, toksik yorum
- **Cloudflare R2** (R2_*): Medya yukleme, GDPR
- **PostgreSQL** (POSTGRES_URL): Profil, ayarlar, takip, referral, bildirim, gamification
- **MongoDB** (MONGO_URL, DB_NAME): Kullanici, gonderi, hikaye, mesaj, feed
- **Trench** (TRENCH_URL, TRENCH_API_KEY): Event tracking, analitik
- **Meilisearch** (MEILISEARCH_URL, MEILISEARCH_MASTER_KEY): Arama
- **Evolution API** (EVOLUTION_*): Mesajlasma
- **Expo** (Notifications, AV): Push, muzik, sesli mesaj
- **LiveKit** (LIVEKIT_*): Canli yayin
- **Brevo** (SMTP_*): E-posta
- **Frankfurter.app**: Doviz kurlari
- **MyMemory / Lingva**: Ceviri
- **REST Countries**: Dil listesi
- **LRCLIB / lyrics.ovh**: Sarki sozleri
- **NudeNet**: Gorsel moderasyon
- **NextAuth.js**: Hesap gecisi
- **MMKV**: Client cache (tema, dil, kalite, onbellek)

Ortam degiskenleri: backend/.env.example dosyasina bakin.
