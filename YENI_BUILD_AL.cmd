@echo off
color 0E
title SocialBeats Jetifier + Yeni Build Alma Araci

echo ==============================================================
echo 1/3: Dizine giriliyor ve Jetifier calistiriliyor...
echo ==============================================================
cd /d "%~dp0mobile"

echo Eski AndroidX kutuphaneleri donusturuluyor (Jetify)...
call npx jetify

echo.
echo ==============================================================
echo 2/3: Eski Android klasoru temizleniyor (Prebuild)...
echo ==============================================================
call npx expo prebuild --clean

echo.
echo ==============================================================
echo 3/3: Yeni EAS Build (Clear-Cache ile) Baslatiliyor...
echo ==============================================================
call eas build --profile preview --platform android --clear-cache

echo.
echo ==============================================================
echo ISLEM TAMAMLANDI. Lutfen ciktilari kontrol edin.
echo ==============================================================
pause
