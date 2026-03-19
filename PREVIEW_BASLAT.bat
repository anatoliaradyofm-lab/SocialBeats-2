@echo off
title SocialBeats Web Preview
echo.
echo  SocialBeats - Web Preview Baslatiliyor...
echo.

cd /d "%~dp0web-preview"

if not exist node_modules (
  echo  Bagimliliklar kuruluyor...
  call npm install
  echo.
)

echo  Sunucu baslatiliyor: http://localhost:3000
echo  Degisiklikler mobile\src\ klasorune kaydedin - otomatik yenilenir
echo.
call npx vite
