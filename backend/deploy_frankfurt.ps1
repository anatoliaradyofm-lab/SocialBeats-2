# --- SocialBeats Production Deployment (Frankfurt) ---
# Lokasyon: europe-west3 (Frankfurt)
# Proje: socialbeats-487416

$PROJECT_ID = "socialbeats-487416"
$REGION = "europe-west3"
$SERVICE = "socialbeats-core"

$PYTHON_BIN = "C:\Users\user\AppData\Local\Python\bin\python.exe"
$GCLOUD_PY = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\lib\gcloud.py"

function Invoke-GCloud {
    $env:CLOUDSDK_PYTHON = $PYTHON_BIN
    & $PYTHON_BIN $GCLOUD_PY $args
}

Write-Host "1. Proje ayarlaniyor: $PROJECT_ID" -ForegroundColor Cyan
Invoke-GCloud config set project $PROJECT_ID

Write-Host "2. Cloud Run Deploy (Frankfurt)..." -ForegroundColor Cyan

Invoke-GCloud run deploy $SERVICE `
    --source . `
    --region $REGION `
    --platform managed `
    --env-vars-file cloudrun_env.yaml `
    --allow-unauthenticated `
    --min-instances 1 `
    --max-instances 10 `
    --cpu 1 `
    --memory 2Gi `
    --timeout 60

Write-Host ""
Write-Host "--- DEPLOYMENT TAMAMLANDI ---" -ForegroundColor Green
Write-Host "Servis URL: " -NoNewline
Invoke-GCloud run services describe $SERVICE --region $REGION --format "value(status.url)"
