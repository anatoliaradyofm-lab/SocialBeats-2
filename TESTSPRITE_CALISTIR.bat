@echo off
chcp 65001 >nul
title TestSprite - Backend + Frontend + Test

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo [1] Backend baslatiliyor...
start "Backend" cmd /k "%~dp0BACKEND_DIREKT.bat"
timeout /t 8 /nobreak >nul

echo [2] Frontend baslatiliyor...
start "Frontend" cmd /k "%~dp0FRONTEND_BASLAT.bat"
echo Frontend aciliyor, 90 saniye bekleniyor...
timeout /t 90 /nobreak >nul

echo [3] TestSprite testleri calistiriliyor...
cd /d "%ROOT%"
if exist "%~dp0node_modules\@testsprite\testsprite-mcp" (
  call npm run testsprite
) else (
  echo TestSprite kuruluyor...
  call npm install
  call npm run testsprite
)

echo.
echo Rapor: %ROOT%\testsprite_tests\testsprite-mcp-test-report.md
pause
