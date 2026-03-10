@echo off
title SocialBeats - Gercek Cihazda Test
color 0B

echo ==============================================================
echo Kendi Telefonunuzda (Kablo ile) Test Uygulamasi Baslatiliyor
echo ==============================================================
echo.
echo Lutfen asagidaki adimlari izlediginizden emin olun:
echo.
echo 1. Telefonunuzu bilgisayara USB kablosu ile baglayin.
echo 2. Telefonunuzun ayarlarindan "Gelistirici Secenekleri"ni acin.
echo 3. "USB Hata Ayiklama" (USB Debugging) ozelligini aktif edin.
echo 4. Telefon ekraninda cikan "Bu bilgisayara guvenilsin mi?" 
echo    uyarisinda "Izin ver" (Tamam) secenegini isaretleyin.
echo.
echo Her sey hazirsa devam etmek icin bir tusa basin...
pause >nul

echo.
echo ==============================================================
echo Telefon araniyor ve yukleme baslatiliyor...
echo (Bu islem bilgisayarin hizina gore birkac dakika surebilir)
echo ==============================================================
cd mobile
call npx expo run:android

echo.
echo ==============================================================
echo Yukleme asamasi bitti! Eger her sey yolundaysa uygulamanin 
echo telefonunuzda otomatik olarak acilmis olmasi gerekir.
echo ==============================================================
pause
