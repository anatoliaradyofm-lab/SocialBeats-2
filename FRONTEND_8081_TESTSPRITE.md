# Frontend 8081 + TestSprite Calistirma

## 1. Frontend'i 8081'de baslatin

**CMD'yi Baslat menüsünden acin** (yeni pencere):

```cmd
cd C:\Users\user\Desktop\PROJE\frontend
npm install
npm run web
```

- "Starting Metro Bundler" ve "Webpack compiled" gibi mesajlar gelene kadar bekleyin.
- Tarayicida http://localhost:8081 acilir veya siz acin.
- Bu CMD penceresini **kapatmayin**.

## 2. Backend calisiyor mu?

Baska bir CMD'de:

```cmd
cd C:\Users\user\Desktop\PROJE\backend
py server.py
```

Bu pencereyi de acik birakin. API: http://localhost:8000

## 3. 8081 calisiyor mu kontrol edin

Tarayicida **http://localhost:8081** adresine gidin. Sayfa yukleniyorsa frontend calisiyor.

## 4. TestSprite API Key

PROJE klasorunde `.env` dosyasi olusturun (yoksa):

```
API_KEY=sk_test_BURAYA_TESTSPRITE_API_ANAHTARINIZ
```

Anahtar: https://www.testsprite.com/dashboard/settings/apikey

## 5. TestSprite testini calistirin

**Ucuncu bir CMD** acin:

```cmd
cd C:\Users\user\Desktop\PROJE
npm run testsprite
```

---

## Hata: "metro" veya "expo-asset" bulunamadi

```cmd
cd C:\Users\user\Desktop\PROJE\frontend
npm install
npx expo install expo-asset metro
npm run web
```

## Hata: Port 8081 kullanilda

Baska bir uygulama 8081 kullaniyor olabilir. O uygulamayi kapatin veya Task Manager'dan sonlandirin.
