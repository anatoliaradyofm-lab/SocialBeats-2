@echo off
chcp 65001 >nul
title SocialBeats - CMD burada acik

REM Bu .bat dosyasinin oldugu klasor = proje kokü (sabit yol yok)
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

cd /d "%ROOT%"
echo.
echo Proje: %ROOT%
echo.
echo Ornek komutlar:
echo   cd backend    ^&^& python server.py
echo   cd frontend   ^&^& npm run web
echo   cd mobile     ^&^& npx expo start
echo.
cmd /k
