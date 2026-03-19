# ============================================================
# SocialBeats Music Backend — Frankfurt Deploy
# .\deploy_music_frankfurt.ps1
# ============================================================
param(
    [string]$ProjectId    = "socialbeats-prod",
    [string]$Region       = "europe-west3",
    [string]$ServiceName  = "music-backend",
    [string]$VpcConnector = "music-bridge"   # bos birak VPC yoksa
)

$ErrorActionPreference = "Stop"

# ── Credentials (ortam degiskenlerinden oku) ──────────────────
$UpstashUrl   = $env:UPSTASH_REDIS_REST_URL
$UpstashToken = $env:UPSTASH_REDIS_REST_TOKEN
$MeiliUrl     = $env:MEILI_URL          # ornek: https://search.socialbeats.app
$MeiliKey     = $env:MEILI_MASTER_KEY

if (-not $UpstashUrl -or -not $UpstashToken) {
    Write-Error "UPSTASH_REDIS_REST_URL ve UPSTASH_REDIS_REST_TOKEN ortam degiskenlerini tanimlayin."
    exit 1
}

Write-Host ""
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  SocialBeats Music Backend — Frankfurt" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════════" -ForegroundColor Cyan

# ── 1. Project ────────────────────────────────────────────────
Write-Host "[1/4] Project: $ProjectId" -ForegroundColor Yellow
gcloud config set project $ProjectId

# ── 2. Deploy (source-based, Docker build Cloud'da yapilir) ───
Write-Host "[2/4] Cloud Run deploy baslıyor..." -ForegroundColor Yellow

$EnvVars = "UPSTASH_REDIS_REST_URL=$UpstashUrl,UPSTASH_REDIS_REST_TOKEN=$UpstashToken"
if ($MeiliUrl)  { $EnvVars += ",MEILI_URL=$MeiliUrl" }
if ($MeiliKey)  { $EnvVars += ",MEILI_MASTER_KEY=$MeiliKey" }

$DeployArgs = @(
    "run", "deploy", $ServiceName,
    "--source", "$PSScriptRoot\backend",
    "--dockerfile", "Dockerfile.music",
    "--region", $Region,
    "--platform", "managed",
    "--allow-unauthenticated",
    "--min-instances", "1",
    "--max-instances", "20",
    "--cpu", "2",
    "--memory", "2Gi",
    "--concurrency", "100",
    "--timeout", "120s",
    "--set-env-vars", $EnvVars
)

if ($VpcConnector -ne "") {
    $DeployArgs += "--vpc-connector", $VpcConnector
    $DeployArgs += "--vpc-egress", "private-ranges-only"
}

gcloud @DeployArgs

if ($LASTEXITCODE -ne 0) { Write-Error "Deploy basarisiz."; exit 1 }

# ── 3. URL al ─────────────────────────────────────────────────
Write-Host "[3/4] Servis URL aliniyor..." -ForegroundColor Yellow
$Url = gcloud run services describe $ServiceName `
    --region $Region --format "value(status.url)"

# ── 4. web-preview api.js guncelle ───────────────────────────
Write-Host "[4/4] web-preview API mock guncelleniyor..." -ForegroundColor Yellow
$MockFile = "$PSScriptRoot\web-preview\src\mocks\api.js"
if (Test-Path $MockFile) {
    (Get-Content $MockFile -Raw) `
        -replace "const MUSIC_BACKEND_URL = '[^']*'", "const MUSIC_BACKEND_URL = '$Url'" |
    Set-Content $MockFile
    Write-Host "  api.js guncellendi: $Url" -ForegroundColor Gray
}

Write-Host ""
Write-Host "══════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  BASARILI!" -ForegroundColor Green
Write-Host "  URL   : $Url" -ForegroundColor Green
Write-Host "  Arama : $Url/search?q=eminem" -ForegroundColor Green
Write-Host "  Stream: $Url/stream/{track_id}" -ForegroundColor Green
Write-Host "  Health: $Url/health" -ForegroundColor Green
Write-Host "══════════════════════════════════════════════" -ForegroundColor Green
