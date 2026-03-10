@echo off
color 0e
title SocialBeats Kamera Paketi Degisimi
echo.
echo =================================================================
echo Hatalara Sebep Olan VisionCamera Kaldiriliyor, Lutfen Bekleyin...
echo =================================================================
echo.

cd "%~dp0\mobile"

echo [*] react-native-vision-camera paket kütüphanesi siliniyor...
call npm uninstall react-native-vision-camera

echo.
echo =================================================================
echo Expo Kamera Kurulumu ve Gerekli Ayarlar Yapiliyor...
echo =================================================================
echo.

echo [*] expo-camera saglikli versiyonu indiriliyor...
call npx expo install expo-camera

echo.
echo =================================================================
echo Temizlik Yapiliyor...
echo =================================================================
echo [*] Gradle ve Onbellek Temizleniyor...
call npm ci

echo.
echo =================================================================
echo Tum İslemler Tamamlandi! Arti 'APK_OLUSTUR.cmd' kullanabilirsiniz.
echo =================================================================
pause
