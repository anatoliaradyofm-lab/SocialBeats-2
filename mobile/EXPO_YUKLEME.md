# SocialBeats – Expo'ya Yükleme

Uygulamanın güncel halini Expo sunucularına yüklemek (OTA update / yayın) için:

## 1. EAS (global kurulum istemiyorsanız: npx kullanın)

```bash
cd mobile
npx eas-cli login
npx eas-cli update --auto
```

Global kurmak isterseniz: `npm install -g eas-cli` sonra `eas login` / `eas update --auto`

## 2. Expo'ya giriş (bir kez)

```bash
npx eas-cli login
```

(expo.dev hesabınızla giriş yapın.)

## 3. Projeyi Expo'ya yükle

```bash
cd mobile
npx eas-cli update --auto
```

Veya: `npm run eas:update`

- `--auto`: branch/channel otomatik seçilir.
- İlk seferde “Link to existing project?” sorusunda **Yes** deyip mevcut projeyi (projectId: `81280268-57d3-41a2-8abc-95012176d7fa`) seçin.

## Ne işe yarar?

- Güncel JavaScript ve asset’ler Expo’ya yüklenir.
- EAS Build ile aldığınız APK/IPA veya Expo Go, bu güncellemeyi alır (OTA).
- expo.dev → projeniz → Updates sekmesinden yayınları görebilirsiniz.

## Özet komutlar (eas yok diyorsa npx kullanın)

```bash
cd mobile
npx eas-cli login
npx eas-cli update --auto
```

APK için: `npx eas-cli build --profile preview --platform android` veya `npm run eas:build`
