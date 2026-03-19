# ============================================================
# socialbeats-backend: europe-west1 → europe-west3 (Frankfurt)
# .\migrate_backend_to_frankfurt.ps1
# ============================================================

$PROJECT_ID  = "socialbeats-487416"
$SERVICE     = "socialbeats-backend"
$OLD_REGION  = "europe-west1"
$NEW_REGION  = "europe-west3"

$PYTHON_BIN  = "C:\Users\user\AppData\Local\Python\bin\python.exe"
$GCLOUD_PY   = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\lib\gcloud.py"

# Bilinen env var'lar (deploy_frankfurt.ps1 ile aynı)
$UPSTASH_URL   = "https://dynamic-glider-60323.upstash.io"
$UPSTASH_TOKEN = "AeujAAIncDJmZGYwOTY5MmYxYWU0ZTdmYmQ0YjY1OWQ0MGZjNWNlZHAyNjAzMjM"
$MONGO_URL     = "mongodb+srv://testuser:Testuser1234@cluster0.wered92.mongodb.net/?authSource=admin&appName=Cluster0"
$POSTGRES_URL  = "postgresql://postgres:Fsmadalet1453@db.nhosyslathewgwnfmmyi.supabase.co:5432/postgres"

function Invoke-GCloud {
    $env:CLOUDSDK_PYTHON = $PYTHON_BIN
    & $PYTHON_BIN $GCLOUD_PY @args
}

Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ${SERVICE}: ${OLD_REGION} -> ${NEW_REGION}" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Cyan

# ── 1. Proje ─────────────────────────────────────────────────
Write-Host "`n[1/4] Proje: $PROJECT_ID" -ForegroundColor Yellow
Invoke-GCloud config set project $PROJECT_ID

# ── 2. europe-west3'e deploy ──────────────────────────────────
Write-Host "`n[2/4] europe-west3'e deploy ediliyor..." -ForegroundColor Yellow

Push-Location "C:\Users\user\Desktop\PROJE\backend"

Invoke-GCloud run deploy $SERVICE `
    --source . `
    --region $NEW_REGION `
    --platform managed `
    --allow-unauthenticated `
    --min-instances 1 `
    --max-instances 10 `
    --cpu 1 `
    --memory 2Gi `
    --timeout 900s `
    --set-env-vars "UPSTASH_REDIS_REST_URL=$UPSTASH_URL,UPSTASH_REDIS_REST_TOKEN=$UPSTASH_TOKEN,MONGO_URL=$MONGO_URL,POSTGRES_URL=$POSTGRES_URL"

Pop-Location

if ($LASTEXITCODE -ne 0) {
    Write-Error "Deploy basarisiz. Cikan hataya gore duzeltip tekrar calistirin."
    exit 1
}

# ── 3. Yeni URL al ───────────────────────────────────────────
Write-Host "`n[3/4] Yeni servis URL aliniyor..." -ForegroundColor Yellow
$NewUrl = Invoke-GCloud run services describe $SERVICE `
    --region $NEW_REGION `
    --format "value(status.url)"

Write-Host "  Yeni URL: $NewUrl" -ForegroundColor Green

# ── 4. Eski servisi sil ──────────────────────────────────────
Write-Host "`n[4/4] europe-west1 servisi siliniyor..." -ForegroundColor Yellow
$confirm = Read-Host "  '$SERVICE' europe-west1'den silinsin mi? (evet/hayir)"
if ($confirm -eq "evet") {
    Invoke-GCloud run services delete $SERVICE `
        --region $OLD_REGION `
        --quiet
    Write-Host "  europe-west1 servisi silindi." -ForegroundColor Gray
} else {
    Write-Host "  Silme islemi atlatildi. europe-west1 servisi hala aktif." -ForegroundColor Yellow
    Write-Host "  Manuel silmek icin:" -ForegroundColor Gray
    Write-Host "  gcloud run services delete $SERVICE --region $OLD_REGION" -ForegroundColor Gray
}

Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  TAMAMLANDI!" -ForegroundColor Green
Write-Host "  Servis : $SERVICE" -ForegroundColor Green
Write-Host "  Bolge  : $NEW_REGION (Frankfurt)" -ForegroundColor Green
Write-Host "  URL    : $NewUrl" -ForegroundColor Green
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Green
