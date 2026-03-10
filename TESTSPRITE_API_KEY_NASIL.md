# TestSprite API Key Nasil Ayarlanir

## 1. API Key olusturun

1. https://www.testsprite.com adresine gidin
2. Giris yapin
3. **Settings** -> **API Keys**
4. **New API Key** tiklayin
5. Olusan anahtari kopyalayin (sk_test_ ile baslar)

## 2. .env dosyasi olusturun

PROJE klasorunde `.env` dosyasi olusturun:

```
API_KEY=sk_test_BURAYA_API_ANAHTARINIZI_YAPISTIRIN
```

Ornek: `.env.example` dosyasini kopyalayip `.env` yapin ve API_KEY degerini girin.

## 3. env-cmd kurun (bir kez)

```cmd
cd C:\Users\user\Desktop\PROJE
npm install env-cmd --save-dev
```

## 4. Testi calistirin

```cmd
cd C:\Users\user\Desktop\PROJE
npm run testsprite
```

**Onemli:** Backend (8000) ve Frontend (8081) calisiyor olmali!
