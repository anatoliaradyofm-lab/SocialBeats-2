@echo off
chcp 65001 >nul
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set BACKEND=%ROOT%\backend
set FRONTEND=%ROOT%\frontend

echo [1/5] Test kullanıcısı oluşturuluyor...
cd /d "%BACKEND%"
python -m scripts.seed_testsprite_user
if errorlevel 1 echo Uyarı: Seed atlandi veya hata (Python gerekli).

echo [2/5] Backend baslatiliyor (arka planda)...
start "SocialBeats Backend" cmd /k "%~dp0BACKEND_BASLAT.bat"
timeout /t 5 /nobreak >nul

echo [3/5] Frontend bagimliliklari kontrol ediliyor...
cd /d "%FRONTEND%"
call npm run web:install 2>nul
if errorlevel 1 call npx expo install react-dom react-native-web @expo/metro-runtime

echo [4/5] Frontend web sunucusu baslatiliyor (port 8081)...
start "SocialBeats Frontend" cmd /k "%~dp0FRONTEND_BASLAT.bat"
echo Frontend aciliyor, 60 saniye bekleniyor...
timeout /t 60 /nobreak >nul

echo [5/5] TestSprite testleri calistiriliyor...
cd /d "%ROOT%"
set TSPRITE=%LOCALAPPDATA%\npm-cache\_npx\8ddf6bea01b2519d\node_modules\@testsprite\testsprite-mcp\dist\index.js
if not exist "%TSPRITE%" set TSPRITE=%APPDATA%\npm-cache\_npx\8ddf6bea01b2519d\node_modules\@testsprite\testsprite-mcp\dist\index.js
if exist "%TSPRITE%" (
  node "%TSPRITE%" generateCodeAndExecute
) else (
  echo TestSprite MCP bulunamadi. Cursor icinde TestSprite MCP ile "generate and execute tests" calistirin.
  echo Frontend: http://localhost:8081 - Backend: http://localhost:8000
)

echo.
echo Bitti. Rapor: %ROOT%\testsprite_tests\testsprite-mcp-test-report.md
pause
