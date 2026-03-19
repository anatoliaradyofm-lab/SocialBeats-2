@echo off
TITLE SocialBeats Frankfurt Full Deployment
echo ============================================================
echo   SocialBeats Frankfurt Komple Kurulum Baslatiliyor...
echo ============================================================
echo.
cd /d C:\Users\user\Desktop\PROJE
powershell -ExecutionPolicy Bypass -File .\deploy_all_frankfurt.ps1
echo.
echo ============================================================
echo   Islem Tamamlandi. Pencereyi kapatmadan once ciktiyi kontrol edin.
echo ============================================================
pause
