@echo off
color 0B
title Buluttaki Build Hatasini Getir

echo ==============================================================
echo EAS Sunucularindaki gercek hata raporu indiriliyor...
echo ==============================================================
cd /d "%~dp0mobile"

call npx eas-cli log c97888e5-0704-4d79-8a9e-42e1faded5c8 > ..\EAS_Gercek_Hata.txt 2>&1

echo ==============================================================
echo INDIRME TAMAMLANDI!
echo ==============================================================
echo Lutfen PROJE klasorundeki "EAS_Gercek_Hata.txt" dosyasini 
echo acip bana icerigini asagida kopyalayiniz.
pause
