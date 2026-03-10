@echo off
title SocialBeats Mobile - Expo Go
color 0B

echo ==============================================
echo SocialBeats Mobil Uygulamasi Baslatiliyor...
echo ==============================================
echo.
echo Lutfen telefonunuzdan (App Store / Google Play) üzerinden
echo "Expo Go" uygulamasini indirin.
echo.
echo Asagida cikacak olan QR kodu telefonunuzun kamerasiyla (iOS) 
echo veya Expo Go icindeki tarayiciyla (Android) okutun.
echo.
echo Eger internet ayni agda degilse veya sorun yasarsaniz 
echo tusa basip kapatip, menuden "Tunnel" secenegini kullanabilirsiniz.
echo.
echo Baslatiliyor... Lutfen bekleyin.
echo ==============================================

cd mobile
npm start

pause
