@echo off
echo =======================================================
echo HATA COZUM VE BASLATMA ARACI
echo =======================================================
echo.
echo Sizin projeniz icin gerekli olan eksik 'shaka-player' paketi yukleniyor...
echo Lutfen bitmesini bekleyin...
echo.
call npm install shaka-player@4.7.11 --save --legacy-peer-deps
echo.
echo Kurulum tamamlandi! Simdi web sunucusu (Ozel ayarlarla) baslatiliyor...
echo.
call npx expo start --web
echo.
pause
