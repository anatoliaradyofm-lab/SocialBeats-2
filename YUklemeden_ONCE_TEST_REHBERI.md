# Yüklemeden Önce Test Rehberi – SocialBeats

Uygulamayı mağazaya veya sunucuya yüklemeden önce yapılacak test adımları.

---

## 1. Ortam Kontrolü

- [ ] **.env dosyası:** `backend/.env` ve `frontend/.env` (veya `mobile/.env`) dolu mu?
- [ ] **Veritabanları:** MongoDB ve PostgreSQL erişilebilir mi? (`MONGO_URL`, `POSTGRES_URL`)
- [ ] **Python:** `python --version` (3.10+), gerekli paketler: `cd backend && pip install -r requirements.txt`
- [ ] **Node:** `node --version` (18+), frontend/mobile: `npm install`

---

## 2. Backend Testi

**Backend’i başlat:**
```bash
cd backend
python server.py
```

**Kontrol et:**
- Tarayıcıda **http://localhost:8000/api/** → `{"message":"SocialBeats...","status":"healthy"}` benzeri yanıt
- **http://localhost:8000/docs** → Swagger UI açılıyor mu?

**Test kullanıcısı (bir kez):**
```bash
cd backend
python -m scripts.seed_testsprite_user
```
Giriş: `testsprite@test.com` / `TestSprite123!`

**Önemli API’ler:**
- `POST /api/auth/login` (e-posta/şifre)
- `GET /api/profile/me` (token ile)
- `GET /api/feed/` (token ile)

---

## 3. Frontend (Web) Testi

```bash
cd frontend
npm run web:install   # ilk kez: react-dom, react-native-web
npm run web
```

- **http://localhost:8081** açılıyor mu?
- Giriş yap: `testsprite@test.com` / `TestSprite123!`
- Ana sayfa, profil, ayarlar, çıkış çalışıyor mu?

---

## 4. Mobil (Expo) Testi

```bash
cd frontend   # veya mobile (proje yapınıza göre)
npm start
```

- **Android:** `a` tuşu veya cihazda Expo Go ile QR tara
- **iOS:** `i` tuşu veya Simulator
- Giriş, navigasyon, müzik, bildirim izinleri test et

---

## 5. TestSprite ile Otomatik Test (Web)

Web arayüzünü otomatik test etmek için:

1. Backend çalışıyor (port 8000)
2. Test kullanıcısı oluşturuldu
3. Frontend web çalışıyor (port 8081)

Ardından TestSprite’ı çalıştırın (Cursor MCP veya CLI).  
Detay: **testsprite_tests/CALISTIR-TESTSPRITE.md**

---

## 6. Manuel Kontrol Listesi (Yüklemeden Önce)

| Alan | Kontrol |
|------|--------|
| **Giriş/Kayıt** | E-posta/şifre girişi, Google OAuth (varsa), 2FA (varsa) |
| **Profil** | Görüntüleme, düzenleme, avatar/kapak yükleme |
| **Sosyal** | Takip/takipten çıkma, gönderi paylaşma, beğeni, yorum |
| **Hikaye** | Hikaye oluşturma, görüntüleme, 24 saat silinme |
| **Müzik** | Çalma listesi, çalma, söz, keşif/trending |
| **Mesajlaşma** | Birebir sohbet, (grup varsa) grup, medya gönderme |
| **Bildirim** | Push izni, bildirim merkezi, tercihler |
| **Ayarlar** | Tema, dil, gizlilik, hesap silme, GDPR indirme |
| **Arama** | Kullanıcı, gönderi, çalma listesi arama |

---

## 7. Hızlı Tek Komut (Kendi Makinenizde)

**baslat-ve-test.bat** (proje kökünde) ile:

- Test kullanıcısı oluşturulur
- Backend arka planda başlar
- Frontend web arka planda başlar
- TestSprite (yol bulunursa) çalıştırılır

Çift tıkla veya: `baslat-ve-test.bat`

---

## 8. Yükleme Öncesi Son Kontrol

- [ ] Tüm ortam değişkenleri production için güncellendi (API anahtarları, URL’ler)
- [ ] Hassas bilgi (şifre, secret) kod içinde yok
- [ ] Backend ve frontend production build alındı
- [ ] Mobil için: `eas build` veya ilgili build komutu çalıştırıldı

Bu rehberi tamamladıktan sonra uygulamayı yükleyebilirsiniz.
