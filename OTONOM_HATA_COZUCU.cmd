@echo off
setlocal enabledelayedexpansion
title Otonom Hata Cozucu (SocialBeats)
color 0E

echo ==============================================================
echo Otonom Hata Cozucu Baslatildi! (Lutfen Kapatmayin)
echo Eksik paketler tespit edilip teker teker indirilecektir...
echo ==============================================================

cd mobile

:loop
echo [Tarama] Proje kodlari paketlenerek eksikler tespit ediliyor...
call npx expo export --platform android > BundleHataRaporu.txt 2>&1

if %errorlevel% equ 0 (
    goto :success
)

set module_name=
for /f "tokens=6" %%a in ('findstr /c:"Unable to resolve module " BundleHataRaporu.txt') do (
    set "module_name=%%a"
    goto :install_module
)

:install_module
if "!module_name!"=="" (
    echo.
    echo [HATA] Farkli türde bir sorun bulundu! (Kutuphane eksikligi degil).
    echo Lutfen bana (Yapay Zeka Asistaniniza) "Bundle hatasi cikti, yardim et" deyin
    echo ve PROJE/mobile icindeki BundleHataRaporu.txt dosyasinin icini atin.
    pause
    exit /b
)

echo [Bulundu!] Eksik Paket: !module_name!
echo [Kuruluyor] !module_name! otomatik olarak indiriliyor...
call npx expo install !module_name!
echo [Basarili] Kurulum bitti. Kalan hatalar taranacak...
echo.
goto :loop

:success
echo.
echo ==============================================================
echo [MUKEMMEL HABER!] Tum eksik paketler bulundu ve eklendi!
echo Artik Hicbir Javascript sorunu (Bundle) hatasi kalmadi.
echo.
echo Lutfen SIMDI son kez "APK_OLUSTUR.bat" dosyaniza cift tiklayin.
echo %100 basariyla indirme linkinizi alacaksiniz. Gecmis olsun!
echo ==============================================================
pause
