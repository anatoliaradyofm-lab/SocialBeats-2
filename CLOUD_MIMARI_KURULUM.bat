@echo off
chcp 65001 >nul
echo =========================================================================
echo SOCIALBEATS BULUT MIMARISI - OTOMATIK KURULUM MOTORU (EUROPE-WEST3)
echo =========================================================================
echo.
echo Lutfen bekleyin, bu senaryo sistemleri baslatacak ve yapilandiracaktir...
echo NOT: Cloud SQL ve Redis olusturma sureci ortalama 10-15 dakika surebilir!
echo.
pause

set "CLOUDSDK_PYTHON=C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\platform\bundledpython\python.exe"
set "GCLOUD_CMD=C:\Users\user\Desktop\google-cloud-sdk\bin\gcloud.cmd"
set "PROJECT_ID=socialbeats-487416"
set "REGION=europe-west3"

echo [1] Proje secimi ve Oturum...
call "%GCLOUD_CMD%" config set project %PROJECT_ID%

echo.
echo [2] Temel Google Cloud API'leri aktif ediliyor...
call "%GCLOUD_CMD%" services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com redis.googleapis.com compute.googleapis.com logging.googleapis.com monitoring.googleapis.com --async
echo API'ler aktif ediliyor (Arka planda devam edecek).

echo.
echo [3] REDIS (Memorystore - Onbellek ve Pub/Sub) Kurulumu...
echo Eger daha once kurulduysa hata verebilir, yoksayin.
call "%GCLOUD_CMD%" redis instances create socialbeats-redis --size=1 --region=%REGION% --tier=BASIC --redis-version=redis_6_x --async
echo Redis kurulum kervana katildi.

echo.
echo [4] POSTGRESQL (Cloud SQL - Ana Veritabani) Kurulumu (2 vCPU, 8GB RAM)...
echo Parola: "socialbeats_db_pass_2024" olarak ayarlaniyor!
call "%GCLOUD_CMD%" sql instances create socialbeats-db --database-version=POSTGRES_15 --cpu=2 --memory=8192MB --region=%REGION% --root-password="socialbeats_db_pass_2024" --async
echo Cloud SQL kuyruga eklendi.

echo.
echo [5] DIGER BAGIMSIZ SERVISLER (Cloud Run uzerine Docker Izoduslari) Kuruluyor...
echo.

echo - Meilisearch (Arama Motoru) Deploy ediliyor...
call "%GCLOUD_CMD%" run deploy meilisearch --image=getmeili/meilisearch:v1.6 --port=7700 --region=%REGION% --allow-unauthenticated --memory=1024Mi --set-env-vars="MEILI_MASTER_KEY=sb-meili-master-key-2024-secure-prod,MEILI_ENV=production"

echo.
echo - MinIO (S3 Depolama) Deploy ediliyor...
call "%GCLOUD_CMD%" run deploy minio-storage --image=minio/minio:latest --port=9000 --region=%REGION% --allow-unauthenticated --memory=1024Mi --args="server,/data,--console-address,:9001" --set-env-vars="MINIO_ROOT_USER=minioadmin,MINIO_ROOT_PASSWORD=minioadmin"

echo.
echo - ClickHouse (Analitik Veritabani) Deploy ediliyor...
call "%GCLOUD_CMD%" run deploy clickhouse-db --image=clickhouse/clickhouse-server:latest --port=8123 --region=%REGION% --allow-unauthenticated --memory=2048Mi

echo.
echo - LiveKit (WebRTC Iletisim) Deploy ediliyor...
call "%GCLOUD_CMD%" run deploy livekit-server --image=livekit/livekit-server:latest --port=7880 --region=%REGION% --allow-unauthenticated --memory=1024Mi --args="--dev"

echo.
echo =========================================================================
echo DEV ALTYAPI KOMUTLARI GOOGLE CLOUD'A ILETILDI!
echo =========================================================================
echo Veritabanlarinin (SQL ve Redis) hazir olmasi Google tarafinda 15 dk alabilir.
echo Ayri servislerin URL'leri konsol ekraninizda listelenmistir.
echo Yeni veritabani ve arama servisi URL'lerini backend/.env dosyaniza islemeyi unutmayin!
echo Mimariniz su an insa ediliyor...
pause
