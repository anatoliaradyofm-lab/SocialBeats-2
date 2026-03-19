@echo off
chcp 65001 >nul
title SocialBeats - Altyapi Kurulumu

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "BACKEND=%ROOT%\backend"
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

REM 3. Mobile
echo [2/3] Mobile npm bagimliliklari kuruluyor...
cd /d "%MOBILE%"
call npm install
if errorlevel 1 echo [UYARI] npm install hata verdi.
echo.

REM 4. TestSprite seed
echo [3/3] TestSprite kullanicisi olusturuluyor...
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
echo   - BACKEND_BASLAT.bat ile Backend'i baslatın
echo   - BASLAT_MOBIL_EXPO.cmd ile Mobil uygulamayı başlatın
echo   - TestSprite: npx testsprite-mcp generateCodeAndExecute
echo.

:son
pause
