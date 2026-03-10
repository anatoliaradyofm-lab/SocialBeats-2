@echo off
color 0D
title Kesin Cozum Build Al - EAS

echo ==============================================================
echo 1/2: Expo Build Properties Eklentisi Kontrol Ediliyor...
echo ==============================================================
cd /d "%~dp0mobile"
call npx expo install expo-build-properties

echo.
echo ==============================================================
echo 2/2: Yeni ve Temiz Build Baslatiliyor (Clear-Cache)...
echo ==============================================================
call eas build --platform android --clear-cache

echo.
echo ==============================================================
echo ISLEM Bitti! App.json guncellemeleriniz sorunsuz yuklenmeye basladi.
echo ==============================================================
pause
