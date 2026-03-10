@echo off
set "CLOUDSDK_PYTHON=C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\platform\bundledpython\python.exe"

echo Sunucu Baslangic Loglari Aliniyor...
call "C:\Users\user\Desktop\google-cloud-sdk\bin\gcloud.cmd" logging read "resource.type=cloud_run_revision AND resource.labels.service_name=socialbeats-backend" --limit=50 --format="value(textPayload)" --project="socialbeats-487416" > "C:\Users\user\Desktop\PROJE\run_error.txt"

echo Loglar run_error.txt dosyasina kaydedildi.
echo Lutfen text dosyasinin icini kopyalayip bana gonderin!
pause
