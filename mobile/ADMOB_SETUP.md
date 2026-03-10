# AdMob Kurulumu

## 1. Paket kurulumu

```bash
cd mobile
npm install
npx expo install react-native-google-mobile-ads
```

## 2. App ID - app.config.js

`app.config.js` App ID'leri `.env`'den okur. Test için `EXPO_PUBLIC_USE_ADMOB_TEST=true` ekleyin.

## 3. .env - Reklam birim ID'leri

`.env` dosyasında:

```env
EXPO_PUBLIC_ADMOB_APP_ID=ca-app-pub-XXXX~YYYY
EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID=ca-app-pub-XXXX/ZZZZ
EXPO_PUBLIC_ADMOB_STORY_INTERSTITIAL=ca-app-pub-XXXX/ZZZZ
```

`__DEV__` modunda otomatik test ID kullanılır.

## 4. Development build

Expo Go AdMob desteklemez. Native build gerekir:

```bash
cd mobile
npx expo prebuild --clean
npx expo run:android
```

veya EAS ile:

```bash
eas build --profile development
```
