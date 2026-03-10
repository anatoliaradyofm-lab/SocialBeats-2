@echo off
color 0b
title SocialBeats Lokal Derleme Temizligi
echo =================================================================
echo Proje Kalintilari Sifirlaniyor ve Yeniden Derleniyor...
echo =================================================================
echo.

cd "%~dp0\mobile"

echo [*] Android Kalinti Klasoru Temizliyi (Prebuild Cleaning)...
call npx expo prebuild --clean

echo.
echo [*] EAS Derlemesi Cloud Sunucusuna Gonderiliyor...
call npm run eas:build

echo.
echo =================================================================
echo Islem tamamlandi. Yukaridaki ciktilari kontrol edebilirsiniz.
echo =================================================================
pause
