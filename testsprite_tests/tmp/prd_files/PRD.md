# SocialBeats – Product Requirements Document (PRD)

**Ürün adı:** SocialBeats  
**Kısa açıklama:** Uluslararası müzik ve sosyal medya uygulaması (mobil + web).

---

## 1. Ürün özeti

SocialBeats, kullanıcıların müzik keşfetmesi, çalma listeleri oluşturması, gönderi paylaşması, hikaye atması ve diğer kullanıcılarla sosyal etkileşim kurması için tasarlanmış bir platformdur. Uygulama çok dilli, tema ve gizlilik ayarları destekler.

---

## 2. Kullanıcı türleri

- **Son kullanıcı:** Kayıt/giriş yapan, profil yöneten, gönderi/hikaye paylaşan, müzik dinleyen ve keşfeden kullanıcı.
- **Test kullanıcısı:** Otomasyon (örn. TestSprite) için sabit e-posta/şifre ile giriş yapan hesap.

---

## 3. Kimlik doğrulama ve hesap

| Gereksinim | Açıklama |
|------------|----------|
| Kayıt | E-posta, kullanıcı adı, şifre ile kayıt. Şifre: en az 8 karakter, büyük/küçük harf, rakam ve özel karakter. |
| Giriş | E-posta + şifre ile giriş. API: `POST /api/auth/login` body: `{"email":"...","password":"..."}`. |
| Şifre sıfırlama | E-posta ile sıfırlama linki gönderimi. |
| 2FA | Opsiyonel TOTP; açıksa giriş sonrası kod istenir. |
| Google OAuth | `GET /api/auth/google/login` ile OAuth akışı. |
| Hesap silme | Kullanıcı hesabını silebilir (veri silme + GDPR uyumu). |

---

## 4. Profil ve ayarlar

| Gereksinim | Açıklama |
|------------|----------|
| Profil görüntüleme/düzenleme | Avatar, kapak, bio, görünen ad. `GET/PUT /api/profile/me`. |
| Gizlilik ayarları | Profil görünürlüğü, istatistik paylaşımı. `GET/PUT /api/settings/privacy`. |
| Bildirim tercihleri | Push, e-posta, takip/beğeni bildirimleri. `GET/PUT /api/settings/notifications`. |
| Tema | Açık/koyu sistem. `GET/PUT /api/settings/me` (theme). |
| Dil | Uygulama dili. `GET /api/settings/languages`, `PUT /api/settings/me` (locale). |
| Müzik kalitesi | Çalma kalitesi seçimi (client tarafında). |
| Zaman dilimi / para birimi | Ayarlar üzerinden. `GET /api/settings/currencies`, `GET /api/settings/exchange-rates`. |
| Önbellek temizleme | `POST /api/settings/cache/clear`. |
| GDPR veri indirme | `GET /api/backup/export/gdpr` (kullanıcı verisi paketi). |

---

## 5. Sosyal özellikler

| Gereksinim | Açıklama |
|------------|----------|
| Takip / takipçi | Kullanıcı takip etme / takipten çıkma. `POST/DELETE /api/profile/follow/{user_id}`. Takipçi listesi: `GET /api/profile/me/followers` vb. |
| Engel | Kullanıcı engelleme / engeli kaldırma. `POST/DELETE /api/profile/block/{user_id}`. |
| Yakın arkadaşlar | Yakın arkadaş listesi yönetimi. |
| Gönderi (post) | Oluşturma, düzenleme, silme, listeleme. Beğeni ve yorum. |
| Hikaye (story) | 24 saatlik hikaye oluşturma ve görüntüleme. |
| Paylaşım | Gönderi, parça, çalma listesi, profil paylaşım linki. `POST /api/share`. |
| Referral | Davet kodu oluşturma ve uygulama. `POST /api/referral/generate`, `POST /api/referral/apply?code=...`. |
| Raporlama | İçerik/kullanıcı raporlama. `GET /api/reports/reasons`, ilgili report endpoint’leri. |

---

## 6. Müzik

| Gereksinim | Açıklama |
|------------|----------|
| Çalma listesi | CRUD. Oluşturma, şarkı ekleme/çıkarma, paylaşım. |
| Şarkı sözü | Parça için söz getirme. Karaoke/senkron söz desteği. |
| Keşif / trending | Keşif ve trend içerik listeleri. |
| Öneriler | Ruh haline ve dinleme geçmişine göre öneri (AI). |
| AI çalma listesi | Metin/ruh haline göre çalma listesi üretimi. |
| Dinleme odası | Ortak dinleme odaları. |

---

## 7. İçerik moderasyonu ve güvenlik

| Gereksinim | Açıklama |
|------------|----------|
| Görsel moderasyon | Yükleme öncesi/sonrası görsel kontrolü. |
| Metin toksisitesi | Yorum/metin için toksisite kontrolü. `POST /api/moderation/check`, `POST /api/moderation/toxic`. |
| Ban / yasak | Yasaklı kullanıcıların giriş ve içerik erişiminin engellenmesi. |

---

## 8. Bildirim ve mesajlaşma

| Gereksinim | Açıklama |
|------------|----------|
| Push bildirim | Mobil cihazlara bildirim. |
| Bildirim tercihleri | Hangi olaylarda bildirim gönderileceği. |
| Mesajlaşma | Sohbet, konuşma listesi. |
| Sessiz saatler | DND (rahatsız etmeyin) ayarları. |

---

## 9. Canlı yayın ve video

| Gereksinim | Açıklama |
|------------|----------|
| Canlı yayın | LiveKit tabanlı canlı yayın. |
| Reels / kısa video | Kısa video feed. |

---

## 10. Analitik ve gamification

| Gereksinim | Açıklama |
|------------|----------|
| Profil istatistikleri | Takipçi, gönderi, dinleme vb. `GET /api/profile/me/stats`. |
| Yıllık özet | Yıllık dinleme/aktivite özeti (AI). |
| Rozet / başarım | `GET /api/profile/me/badges`, `GET /api/profile/me/achievements`. |
| Kullanıcı seviyesi / XP | `GET /api/profile/me/level`. |
| Ekran süresi | İsteğe bağlı kullanım süresi takibi. |

---

## 11. API kimlik doğrulama

Korumalı endpoint’ler için:

- Header: `Authorization: Bearer <access_token>`
- Giriş yanıtı: `{"access_token":"...", "user":{...}}`

---

## 12. Test kullanıcısı (TestSprite)

- **E-posta:** testsprite@test.com  
- **Şifre:** TestSprite123!  
- Test kullanıcısı, seed script çalıştırıldıktan sonra giriş yapabilir: `python -m scripts.seed_testsprite_user` (backend dizininden).  
- 2FA bu hesapta kapalı tutulmalı; otomasyon için sadece e-posta/şifre ile giriş kullanılır.

---

*Bu PRD, SocialBeats backend ve özellik denetimi dokümanına dayanmaktadır. Güncellemeler proje ile birlikte revize edilir.*
