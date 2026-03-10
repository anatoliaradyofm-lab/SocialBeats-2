# SocialBeats - APK Build Rehberi

## Ön Gereksinimler

- Node.js (v18+)
- Expo hesabı ([expo.dev](https://expo.dev))
- EAS CLI: `npm install -g eas-cli`

## APK Oluşturma

```bash
cd mobile

# Expo'ya giriş (henüz giriş yapmadıysanız)
eas login

# Preview APK (test için - indirilebilir link)
eas build --profile preview --platform android

# Production APK (mağaza için)
eas build --profile production --platform android
```

## Build Tamamlandığında

- Build bittiğinde [expo.dev](https://expo.dev) üzerinden APK indirme linki alırsınız
- E-posta ile bildirim gelir
- `eas build:list` ile son build'leri görüntüleyebilirsiniz

## Yerel APK (Development)

```bash
npx expo run:android
# veya
npx expo prebuild && cd android && ./gradlew assembleRelease
```

## .env Ayarları

Build öncesi `mobile/.env` dosyasında:

```
EXPO_PUBLIC_API_URL=https://your-api.com/api
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxx.apps.googleusercontent.com
```
