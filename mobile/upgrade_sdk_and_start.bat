@echo off
echo =======================================================
echo EXPO SDK 54 YUKSELTME ARACI
echo =======================================================
echo.
echo Projeniz Expo SDK 54 surumune yukseltiliyor...
echo Lutfen bitmesini bekleyin (Bu islem birkac dakika surebilir).
echo.
call npx expo-env-info
echo.
echo Adim 1: Paketler ve Expo yukseltiliyor...
call npm install expo@~54.0.0
call npx expo install --fix
echo.
echo SDK yukseltmesi basariyla tamamlandi! Simdi web sunucusu (Ozel ayarlarla) baslatiliyor...
echo.
call npx expo start --web --clear
echo.
pause
