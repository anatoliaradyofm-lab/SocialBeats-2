@echo off
chcp 65001 >nul
title SocialBeats - Altyapi Kurulumu

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"
set "MOBILE=%ROOT%\mobile"

echo.
echo ============================================
echo   SocialBeats - Altyapi Kurulumu
echo   Proje: %ROOT%
echo ============================================
echo.

REM 1. Kontroller
where node >nul 2>&1
if errorlevel 1 (
  echo [HATA] Node.js yok. https://nodejs.org kurun.
  goto son
)
where python >nul 2>&1
if errorlevel 1 (
  echo [HATA] Python yok. https://python.org kurun.
  goto son
)
echo [OK] Node: && node -v
echo [OK] Python: && python --version 2>nul
echo.

REM 2. Backend
echo [1/4] Backend Python bagimliliklari kuruluyor...
cd /d "%BACKEND%"
if not exist requirements.txt (
  echo [UYARI] backend\requirements.txt bulunamadi. Atlaniyor.
) else (
  python -m pip install --upgrade pip
  pip install -r requirements.txt
  if errorlevel 1 (
    echo [UYARI] Bazi paketler kurulamadi. Devam ediliyor.
  )
)
echo.

REM 3. Frontend
echo [2/4] Frontend npm bagimliliklari kuruluyor...
cd /d "%FRONTEND%"
call npm install
if errorlevel 1 echo [UYARI] npm install hata verdi.
call npx expo install react-dom react-native-web @expo/metro-runtime 2>nul
echo.

REM 4. Mobile
echo [3/4] Mobile npm bagimliliklari kuruluyor...
cd /d "%MOBILE%"
call npm install
if errorlevel 1 echo [UYARI] npm install hata verdi.
echo.

REM 5. TestSprite seed
echo [4/4] TestSprite kullanicisi olusturuluyor...
cd /d "%BACKEND%"
if exist "scripts\seed_testsprite_user.py" (
  python -m scripts.seed_testsprite_user 2>nul
  if errorlevel 1 echo [UYARI] Seed atlandi. Veritabani gerekebilir.
) else (
  echo [UYARI] scripts\seed_testsprite_user.py bulunamadi.
)
echo.

echo ============================================
echo   Kurulum tamamlandi.
echo ============================================
echo.
echo Sonraki adimlar:
echo   - TEST_ET.bat ile Backend + Frontend baslatin
echo   - TestSprite: npx testsprite-mcp generateCodeAndExecute
echo.

:son
pause
