# SocialBeats – APK İndirme

## Hızlı yol (EAS – indirilebilir link)

1. **EAS CLI kur** (bir kez):
   ```bash
   npm install -g eas-cli
   ```

2. **Expo’ya giriş** (bir kez):
   ```bash
   eas login
   ```

3. **APK build’i başlat**:
   ```bash
   cd mobile
   eas build --profile preview --platform android
   ```

4. **APK’yı indir**:
   - Build bittikten sonra [expo.dev](https://expo.dev) → projeniz → Builds
   - Veya gelen e-postadaki linkten APK’yı indirin

---

## Yerel APK (bilgisayarınızda üretir)

Android Studio / JDK kurulu olmalı.

```bash
cd mobile
npx expo prebuild
cd android
./gradlew assembleRelease
```

APK: `mobile/android/app/build/outputs/apk/release/app-release.apk`

---

## Özet

| Yöntem        | Komut / adres |
|---------------|----------------|
| EAS (link)    | `cd mobile` → `eas build --profile preview --platform android` → expo.dev’den indir |
| Yerel release | `cd mobile` → `npx expo prebuild` → `cd android` → `./gradlew assembleRelease` |

Detay: `mobile/BUILD.md`
