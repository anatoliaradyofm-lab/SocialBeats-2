# SocialBeats – Altyapı Kurulum Rehberi

## Otomatik kurulum (önerilen)

**PROJE** klasöründe **KURULUM.bat** dosyasına çift tıklayın.

Bu script sırayla:
1. Backend Python bağımlılıklarını kurar (`pip install -r requirements.txt`)
2. Frontend npm paketlerini kurar (`npm install` + Expo web deps)
3. Mobile npm paketlerini kurar (`npm install`)
4. TestSprite kullanıcısını oluşturur

---

## Manuel kurulum

### 1. Backend (Python)

```cmd
cd backend
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m scripts.seed_testsprite_user
```

**Gereksinim:** Python 3.9+ ve MongoDB / PostgreSQL (veya .env ile uzak DB)

### 2. Frontend (Expo)

```cmd
cd frontend
npm install
npx expo install react-dom react-native-web @expo/metro-runtime
```

### 3. Mobile (Expo)

```cmd
cd mobile
npm install
```

---

## Kurulum sonrası

- **TEST_ET.bat** ile Backend + Frontend başlatın
- TestSprite: `npx testsprite-mcp generateCodeAndExecute`
- Mobil: `cd mobile` → `npx expo start` veya `npx eas-cli update --auto`
