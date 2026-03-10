@echo off
set "CLOUDSDK_PYTHON=C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\platform\bundledpython\python.exe"
set "GCLOUD_CMD=C:\Users\user\Desktop\google-cloud-sdk\bin\gcloud.cmd"
set "PROJECT_ID=socialbeats-487416"
set "REGION=europe-west3"

echo Cloud Run servislerinin URL'leri aliniyor, lutfen bekleyin...
call "%GCLOUD_CMD%" run services list --project %PROJECT_ID% --region %REGION% > "C:\Users\user\Desktop\PROJE\backend\servis_linkleri.txt"

echo.
echo =====================================================================
echo Islem tamamlandi! PROJE\backend klasorunde 'servis_linkleri.txt'
echo adli dosyaya tum linkleriniz kaydedildi, lutfen o dosyayi acip kopyalayin.
echo =====================================================================
pause
