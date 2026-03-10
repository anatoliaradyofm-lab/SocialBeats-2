@echo off
title Hata Cozucu - QR Kod Kutuphanesi
color 0A

echo ==============================================================
echo Doktor Engelini Asmak Icin "react-native-svg" Yukleniyor...
echo ==============================================================
cd mobile
call npx expo install react-native-svg

echo.
echo ==============================================================
echo KURULUM TAMAMLANDI!
echo Her sey hazir! Lutfen "APK_OLUSTUR.bat" dosyasina cift tiklayin.
echo ==============================================================
pause
