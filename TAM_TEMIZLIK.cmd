@echo off
title Hata Cozucu - Tam Temizlik (SocialBeats)
color 0E

echo ==============================================================
echo 1. Adim: Eski Kalintilar ve Onbellek Temizleniyor...
echo ==============================================================
cd mobile
echo Lutfen bekleyin, klasorler siliniyor...
if exist node_modules rmdir /s /q node_modules
if exist .expo rmdir /s /q .expo
if exist package-lock.json del /f /q package-lock.json
call npm cache clean --force

echo.
echo ==============================================================
echo 2. Adim: Tum Kutuphaneler Sifirdan Kuruluyor...
echo ==============================================================
echo Moduller indiriliyor, bu islem biraz zaman alabilir...
call npm install
call npx expo install @expo/config-plugins @expo/metro-config --fix

echo.
echo ==============================================================
echo TAMAMLANDI! SISTEM TERTEMIZ YAPILDI.
echo ==============================================================
echo Lutfen SIMDI tekrar "APK_OLUSTUR.bat" dosyaniza cift tiklayin.
pause
