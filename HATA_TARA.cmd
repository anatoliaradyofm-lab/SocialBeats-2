@echo off
title JavaScript (Bundle) Hata Tarayicisi
color 0C

echo ==============================================================
echo EAS BULUTUNDAKI DERLEME (BUNDLE) HATASI SIMULE EDILIYOR...
echo ==============================================================
echo Lutfen bitmesini bekleyin...

cd mobile
call npx expo export --platform android > BundleHataRaporu.txt 2>&1

echo.
echo ==============================================================
echo TEST BITTI! Asil sorunun ne oldugunu tespit edebilmemiz
echo icin "BundleHataRaporu.txt" dosyasi hazirlandi.
echo Lutfen bana (bizi test eden robota) haber verin.
echo ==============================================================
pause
