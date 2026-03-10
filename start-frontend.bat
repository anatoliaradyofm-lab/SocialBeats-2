@echo off
echo Frontend uygulamasi baslatiliyor... Lutfen bekleyin.
cd /d "%~dp0frontend"
set EXPO_OFFLINE=1
call npx expo start --web --port 8080
pause
