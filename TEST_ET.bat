@echo off
chcp 65001 >nul
title SocialBeats - Test

REM Script neredeyse proje orasi - yol sabit degil
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"
set "MOBILE=%ROOT%\mobile"

echo.
echo ============================================
echo   SocialBeats - Test (yol: %ROOT%)
echo ============================================
echo.

REM Kontroller
if not exist "%BACKEND%\server.py" (
  echo HATA: Backend bulunamadi: %BACKEND%
  echo Bu .bat dosyasi PROJE klasorunun icinde mi?
  goto son
)
if not exist "%FRONTEND%\package.json" (
  echo HATA: Frontend bulunamadi: %FRONTEND%
  goto son
)

where node >nul 2>&1
if errorlevel 1 (
  echo UYARI: Node.js yok. https://nodejs.org kurun.
) else (
  echo [OK] Node: && node -v
)
where python >nul 2>&1
if errorlevel 1 (
  echo UYARI: Python yok. Backend calismaz.
) else (
  echo [OK] Python: && python -v 2>nul || python --version 2>nul
)
echo.

echo Ne yapmak istiyorsunuz?
echo   1 - Sadece Backend baslat (API)
echo   2 - Sadece Frontend baslat (Web arayuz)
echo   3 - Ikisini de baslat (Backend + Frontend)
echo   4 - Mobil klasorune git (Expo / EAS icin)
echo   5 - Cikis
echo.
set /p secim="Seciminiz (1-5): "

if "%secim%"=="1" goto backend
if "%secim%"=="2" goto frontend
if "%secim%"=="3" goto ikisi
if "%secim%"=="4" goto mobile
goto son

:backend
echo.
echo Backend baslatiliyor: %BACKEND%
cd /d "%BACKEND%"
python server.py
if errorlevel 1 echo Backend hata verdi. Python kurulu mu?
goto son

:frontend
echo.
echo Frontend baslatiliyor: %FRONTEND%
cd /d "%FRONTEND%"
call npm run web
if errorlevel 1 echo Frontend hata verdi. "npm install" yaptiniz mi?
goto son

:ikisi
echo.
echo Backend yeni pencerede aciliyor...
start "Backend" cmd /k "%~dp0BACKEND_DIREKT.bat"
timeout /t 3 /nobreak >nul
echo Frontend yeni pencerede aciliyor...
start "Frontend" cmd /k "%~dp0FRONTEND_BASLAT.bat"
echo.
echo Iki pencere acildi. Tarayicida: http://localhost:8081
goto son

:mobile
echo.
echo Mobil klasorune gidiliyor. Yeni pencerede "npx eas-cli login" sonra "npx eas-cli update --auto" yazin.
cd /d "%MOBILE%"
if not exist "%MOBILE%\package.json" (echo HATA: mobile\package.json yok & goto son)
start "Mobil" cmd /k
goto son

:son
echo.
echo Devam etmek icin bir tusa basin...
pause >nul
