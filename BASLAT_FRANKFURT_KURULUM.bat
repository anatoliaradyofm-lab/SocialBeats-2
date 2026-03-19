@echo off
TITLE SocialBeats Complete Deployment (Frankfurt)
echo ============================================================
echo   SocialBeats Frankfurt Komple Kurulum Baslatiliyor...
echo ============================================================
echo.
powershell -ExecutionPolicy Bypass -File "C:\Users\user\Desktop\PROJE\deploy_all_frankfurt.ps1"
echo.
echo ============================================================
echo   Islem Tamamlandi. Pencereyi kapatmadan once ciktiyi kontrol edin.
echo ============================================================
pause
