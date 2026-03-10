@echo off
title SocialBeats - Bulutta APK Olusturma (Git Duzeltmeli)
color 0B

echo ==============================================================
echo 1. Adim: Gerekli Araclar Yukleniyor (EAS CLI)
echo ==============================================================
call npm install -g eas-cli

echo.
echo ==============================================================
echo 2. Adim: Git Baglantisi Devre Disi Birakiliyor...
echo ==============================================================
set EAS_NO_VCS=1
echo (Basarili: Git olmadan ilerleme izni verildi.)

echo.
echo ==============================================================
echo 3. Adim: Expo Hesabina Giris
echo ==============================================================
echo Hesabinizla giris yapmaniz istenebilir...
call npx eas-cli login

echo.
echo ==============================================================
echo 4. Adim: APK Olusturma Basliyor 
echo ==============================================================
cd mobile
call npx eas-cli build --profile preview --platform android

echo.
echo ==============================================================
echo YUKARIDAKI EKRANI KONTROL EDİN!
echo Mavi renkli Download Link veya QR Kod belirmisse 
echo APK indirmeye hazir demektir. Iyi testler!
echo ==============================================================
pause
