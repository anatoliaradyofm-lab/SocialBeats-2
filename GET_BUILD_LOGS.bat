@echo off
echo =======================================================
echo Google Cloud Build Hata Loglari Aliniyor...
echo =======================================================

set "CLOUDSDK_PYTHON=C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\platform\bundledpython\python.exe"

call "C:\Users\user\Desktop\google-cloud-sdk\bin\gcloud.cmd" builds log da2a7cc1-6e87-45b7-9adb-99f012f61af5 --region=europe-west1 > "c:\Users\user\Desktop\PROJE\build_error.txt"

echo Loglar build_error.txt dosyasina kaydedildi.
echo Lutfen dosyanin son kismindaki (son 30 satir vb) hatayi kopyalayip bana gonderin.
pause
