@echo off
color 0C
title Manifest Hata Detayini Gorme Araci

echo ==============================================================
echo 1/2: Manifest Hata Sebebi Bulunuyor... Lutfen bekleyin.
echo ==============================================================
cd /d "%~dp0mobile\android"

echo.
call gradlew processReleaseMainManifest --stacktrace --info > ..\Manifest_Hata_Detayi.txt 2>&1

echo ==============================================================
echo 2/2: Hata detayi Manifest_Hata_Detayi.txt dosyasina kaydedildi!
echo ==============================================================
echo Klasore donup bu dosyayi bana kopyalayabilirsiniz.
pause
