# SocialBeats – Uluslararası Müzik & Sosyal Medya Uygulaması Özellik Denetimi

Bu belge uygulamanın baştan sona taranmasıyla tespit edilen **mevcut** ve **eksik** özellikleri listeler. Eksik olanlar için ücretsiz/açık kaynak API ile eklenenler işaretlenmiştir.

---

## 1. Kimlik Doğrulama & Hesap

| Özellik | Durum | Not |
|--------|--------|-----|
| Kayıt / Giriş (email, şifre) | Var | auth, nextauth_routes |
| Şifre sıfırlama | Var | email_service.send_password_reset, server |
| 2FA | Var | server (verify-2fa) |
| Google OAuth | Var | auth/google |
| NextAuth uyumlu session / switch account | Var | nextauth_routes, switch-account |
| Hesap silme (PostgreSQL + MongoDB) | Var | user_routes + delete_user_data_pg |
| E-posta doğrulama | Kısmen | firebase email_verified, tam akış yok |

---

## 2. Profil & Ayarlar

| Özellik | Durum | Not |
|--------|--------|-----|
| Profil görüntüleme / düzenleme (PostgreSQL + R2) | Var | profile_routes, avatar/cover |
| Gizlilik ayarları (PostgreSQL) | Var | settings/privacy |
| Bildirim tercihleri (PostgreSQL + MMKV) | Var | settings/notifications, notification_preferences_pg |
| Tema (MMKV + NativeWind, PG sync) | Var | themes, settings/me |
| Dil seçimi (MMKV + REST Countries) | Var | settings/languages, locale |
| Müzik kalitesi (MMKV + Expo AV) | Var | settings/music-quality |
| Zaman dilimi tercihi | Eklendi | user_settings_pg.timezone, settings/me |
| Para birimi tercihi | Eklendi | user_settings_pg.currency, settings/currencies, exchange-rates (Frankfurter) |
| Önbellek temizleme (MMKV) | Var | settings/cache/clear |
| GDPR veri indirme (PostgreSQL + R2) | Var | backup/export/gdpr + postgres_export, media_urls |

---

## 3. Uluslararasılaştırma (i18n)

| Özellik | Durum | Not |
|--------|--------|-----|
| Dil listesi (REST Countries) | Var | settings/languages |
| Kullanıcı locale (PG) | Var | settings/me locale |
| İçerik çevirisi API | Eklendi | i18n/translate (MyMemory + Lingva, ücretsiz) |
| Desteklenen diller listesi (client dropdown) | Eklendi | i18n/locales |

---

## 4. Sosyal Özellikler

| Özellik | Durum | Not |
|--------|--------|-----|
| Takip / takipçi (PostgreSQL) | Var | profile follow/unfollow, followers |
| Engel (block) | Var | profile block, blocked_users PG |
| Yakın arkadaşlar | Var | close_friends PG |
| Gönderi (post) CRUD | Var | posts.py |
| Beğeni / yorum | Var | posts, comments |
| Hikaye (story) | Var | stories.py |
| Paylaşım linki (playlist) | Var | playlists/{id}/share |
| Birleşik paylaşım API (post/track/playlist/profil) | Eklendi | share routes |
| Referral (davet kodu) sistemi | Eklendi | referral/generate, apply, me (PostgreSQL) |

---

## 5. Müzik

| Özellik | Durum | Not |
|--------|--------|-----|
| Çalma listesi (playlist) CRUD | Var | playlists.py, PG |
| Şarkı sözü (lrclib, lyrics.ovh) | Var | lyrics_service, karaoke, /music/lyrics |
| Karaoke / senkron söz | Var | karaoke.py, LRCLIB |
| Keşif / trending | Var | discover_routes, server discover/trending |
| Ruh haline göre öneri (Gemini) | Var | search/mood |
| Kişiselleştirilmiş öneri (Gemini + Trench) | Var | search/recommendations |
| AI çalma listesi (Gemini) | Var | ai_text_service.generate_ai_playlist |
| Dinleme odası / ortak dinleme | Var | server listening-rooms, invite |

---

## 6. İçerik Moderasyonu & Güvenlik

| Özellik | Durum | Not |
|--------|--------|-----|
| Görsel moderasyon (NudeNet) | Var | content_moderation |
| Metin toksisitesi (Detoxify + Hugging Face) | Var | content_moderation, huggingface_service |
| Toksik yorum / içerik moderasyonu API | Var | ai_moderation_routes /moderation/check, /toxic |
| Rapor oluşturma / benim raporlarım | Var | server POST/GET /reports |
| Rapor nedenleri listesi (client dropdown) | Eklendi | reports/reasons |
| Ban / yasak kontrolü | Var | server /bans/status |

---

## 7. Bildirim & Mesajlaşma

| Özellik | Durum | Not |
|--------|--------|-----|
| Push bildirim (Expo) | Var | expo_notifications_service |
| Bildirim tercihleri (PG + MMKV) | Var | notifications/settings |
| Mesajlaşma (sohbet) | Var | messages, evolution_api_service |
| Sessiz saatler (DND) | Var | dnd_settings_pg |

---

## 8. Canlı Yayın & Video

| Özellik | Durum | Not |
|--------|--------|-----|
| Canlı yayın (LiveKit) | Var | live_video.py, livekit_service |
| Reels / kısa video feed | Var | music_routes/feed reels |

---

## 9. Analitik & Gamification

| Özellik | Durum | Not |
|--------|--------|-----|
| Trench event tracking | Var | trench_service |
| Ekran süresi (Trench + MongoDB) | Var | user/screen-time |
| Profil istatistikleri (Grafana) | Var | profile/me/stats |
| Yıllık özet (Gemini) | Var | analytics/yearly-summary |
| Rozet / başarım (PostgreSQL) | Var | profile/me/badges, achievements |
| Kullanıcı seviyesi / XP (PostgreSQL) | Var | profile/me/level, gamification |

---

## 10. Ödeme & Abonelik

| Özellik | Durum | Not |
|--------|--------|-----|
| Abonelik durumu (in-memory/DB) | Var | subscription/upgrade, status |
| Stripe entegrasyonu | Yok | requirements’ta stripe var, kodda kullanım yok |

---

## 11. Diğer

| Özellik | Durum | Not |
|--------|--------|-----|
| Arama (Meilisearch) | Var | search_unified, meilisearch_service |
| Coğrafi / yakındakiler | Var | server geo, postgresql log_event |
| QR ile profil paylaşımı | Var | profile/me/share-url |
| Yedekleme / geri yükleme | Var | backup routes |
| Hesap birleştirme | Var | backup/merge-accounts |

---

## Eklenen API’ler (Ücretsiz / Açık Kaynak)

- **i18n:** `GET /api/i18n/locales`, `POST /api/i18n/translate` (MyMemory + Lingva).
- **Zaman dilimi / para birimi:** `user_settings_pg.timezone`, `currency`; `GET/PUT /api/settings/me`; `GET /api/settings/currencies`, `GET /api/settings/exchange-rates` (Frankfurter.app).
- **Rapor nedenleri:** `GET /api/reports/reasons`.
- **Birleşik paylaşım:** `POST /api/share` (type: post | track | playlist | profile, id).
- **Referral:** `POST /api/referral/generate`, `GET /api/referral/me`, `POST /api/referral/apply?code=...` (PostgreSQL).

Bu denetim, backend odaklıdır; mobil/web client tarafı ayrıca gözden geçirilmelidir.
