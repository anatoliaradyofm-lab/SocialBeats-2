# --- SocialBeats Open Source Services Deployment ---
# Proje: socialbeats-487416
# Lokasyon: europe-west3

$REGION = "europe-west3"
$PYTHON_BIN = "C:\Users\user\AppData\Local\Python\bin\python.exe"
$GCLOUD_PY = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\lib\gcloud.py"

function Invoke-GCloud {
    $env:CLOUDSDK_PYTHON = $PYTHON_BIN
    & $PYTHON_BIN $GCLOUD_PY $args
}

# 1. Evolution API (Message Routing)
Write-Host "Deploying Evolution API..." -ForegroundColor Cyan
Invoke-GCloud run deploy evolution-api `
    --image=atender/evolution-api:latest `
    --region=$REGION `
    --allow-unauthenticated `
    --port=8080 `
    --set-env-vars="AUTHENTICATION_API_KEY=socialbeats_secure_key_2024,AUTHENTICATION_TYPE=apikey"

# 2. LiveKit (WebRTC - Fixing)
Write-Host "Deploying/Fixing LiveKit..." -ForegroundColor Cyan
Invoke-GCloud run deploy livekit-server `
    --image=livekit/livekit-server:latest `
    --region=$REGION `
    --allow-unauthenticated `
    --port=7880 `
    --args="--dev" `
    --memory=1024Mi

# 3. Umami (Analytics)
Write-Host "Deploying Umami..." -ForegroundColor Cyan
# Not: DATABASE_URL gerektirir.
Invoke-GCloud run deploy umami `
    --image=ghcr.io/umami-software/umami:postgresql-latest `
    --region=$REGION `
    --allow-unauthenticated `
    --set-env-vars="DATABASE_URL=postgresql://postgres:Fsmadalet1453@34.141.25.67:5432/postgres,APP_SECRET=sb-umami-secret-2024"

# 4. Trench (Event Tracking)
Write-Host "Deploying Trench..." -ForegroundColor Cyan
Invoke-GCloud run deploy trench `
    --image=trench/trench:latest `
    --region=$REGION `
    --allow-unauthenticated `
    --set-env-vars="DATABASE_URL=postgresql://postgres:Fsmadalet1453@34.141.25.67:5432/postgres"

Write-Host "--- OPEN SOURCE DEPLOYMENT COMPLETE ---" -ForegroundColor Green
