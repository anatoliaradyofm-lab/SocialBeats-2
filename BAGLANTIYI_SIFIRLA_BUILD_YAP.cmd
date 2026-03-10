@echo off
color 0C
title EAS Sunucu Baglanti Sorunu Cozucu

echo ==============================================================
echo 1/2: Internet ve DNS Baglantisi Sifirlaniyor...
echo ==============================================================
ipconfig /flushdns

echo.
echo ==============================================================
echo 2/2: Yeni Build Baslatiliyor (Yeniden Deneme)...
echo ==============================================================
cd /d "%~dp0mobile"

echo Google Cloud / Expo sunucularina tekrar yukleniyor...
call eas build --profile preview --platform android --clear-cache

echo.
echo ==============================================================
echo ISLEM TAMAMLANDI. Sayet yine socket hang up verirse telefonunuzun
echo internetiyle baglanarak denemeniz tavsiye edilir.
echo ==============================================================
pause
