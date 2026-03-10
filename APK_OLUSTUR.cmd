@echo off
color 0a
title SocialBeats APK Olusturucu
echo.
echo =================================================================
echo SocialBeats Mobil Uygulamasi Icin APK Uretim Sureci Baslatiliyor...
echo Lutfen islem tamamlanana kadar bu pencereyi kapatmayin!
echo =================================================================
echo.

cd "%~dp0\mobile"
call npm run eas:build

echo.
echo =================================================================
echo Islem tamamlandi. Yukaridaki ciktilari kontrol edebilirsiniz.
echo =================================================================
pause
