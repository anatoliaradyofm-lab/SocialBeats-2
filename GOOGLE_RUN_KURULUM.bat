@echo off
echo =======================================================
echo Google Cloud Run Baglantisi ve Kurulumu Baslatiliyor...
echo =======================================================

cd /d "c:\Users\user\Desktop\PROJE\backend"

echo.
echo Google Cloud SDK icin Python ortami hazirlaniyor...
set "CLOUDSDK_PYTHON=C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\platform\bundledpython\python.exe"

echo.
echo [1/3] Google Hesabiniza Giris Islemi Basliyor...
echo Tarayiciniz acilacak. Lutfen 'socialbeats-487416' projenize ait Google hesabinizla giris yapin ve izin verin.
call "C:\Users\user\Desktop\google-cloud-sdk\bin\gcloud.cmd" auth login

echo.
echo [2/3] Proje 'socialbeats-487416' olarak ayarlaniyor...
call "C:\Users\user\Desktop\google-cloud-sdk\bin\gcloud.cmd" config set project socialbeats-487416

echo.
echo [3/3] Cloud Run Deploy islemi baslatiliyor...
echo Lutfen bekleyin, bu islem biraz (1-2 dk) surebilir...
echo.
call "C:\Users\user\Desktop\google-cloud-sdk\bin\gcloud.cmd" run deploy socialbeats-backend --source . --region europe-west1 --allow-unauthenticated --memory 1024Mi

echo.
echo =======================================================
echo Islem tamamlandi. Lutfen cikan sonuclari kontrol edin.
echo =======================================================
pause
