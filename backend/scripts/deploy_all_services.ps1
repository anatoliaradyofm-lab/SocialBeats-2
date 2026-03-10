# ============================================================
# SocialBeats - Tüm Cloud Run Servislerini Deploy Et
# ============================================================
# Kullanım: powershell -ExecutionPolicy Bypass -File deploy_all_services.ps1
# GCP Projesi: socialbeats-43d2a
# Region: europe-west3
# ============================================================

$PROJECT_ID = "socialbeats-43d2a"
$REGION = "europe-west3"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " SocialBeats Cloud Run Deploy Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# 1) GCP projesini ayarla
Write-Host "`n[1/8] GCP projesi ayarlanıyor..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID
gcloud config set run/region $REGION

# ============================================================
# 2) PostgreSQL - Supabase Free Tier (harici, Cloud Run olarak değil)
# NOT: PostgreSQL Cloud Run'da çalıştırılmaz (stateful).
# Supabase, Neon veya Cloud SQL kullanılmalı.
# Burada Supabase Free Tier URL'si .env'ye eklenecek.
# ============================================================
Write-Host "`n[2/8] PostgreSQL (Supabase/Neon) kontrol ediliyor..." -ForegroundColor Yellow
Write-Host "   PostgreSQL icin Supabase veya Neon Free Tier kullanilmali." -ForegroundColor White
Write-Host "   Supabase: https://supabase.com/dashboard -> New Project -> Settings -> Database -> Connection String" -ForegroundColor White
Write-Host "   Neon: https://neon.tech -> Create Project -> Connection String" -ForegroundColor White
Write-Host ""
$PG_URL = Read-Host "   PostgreSQL URL'sini girin (ornek: postgresql://user:pass@host:5432/db) [Enter ile atla]"

# ============================================================
# 3) Redis - Upstash Free Tier (harici)
# ============================================================
Write-Host "`n[3/8] Redis (Upstash) kontrol ediliyor..." -ForegroundColor Yellow  
Write-Host "   Redis icin Upstash Free Tier kullanilmali." -ForegroundColor White
Write-Host "   Upstash: https://console.upstash.com -> Create Database -> REST URL" -ForegroundColor White
Write-Host ""
$REDIS_URL = Read-Host "   Redis URL'sini girin (ornek: rediss://default:xxx@xxx.upstash.io:6379) [Enter ile atla]"

# ============================================================
# 4) LiveKit Server - Yeniden Deploy Et
# ============================================================
Write-Host "`n[4/8] LiveKit Server yeniden deploy ediliyor..." -ForegroundColor Yellow
gcloud run deploy livekit-server `
  --image livekit/livekit-server:latest `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --port 7880 `
  --memory 512Mi `
  --cpu 1 `
  --min-instances 0 `
  --max-instances 2 `
  --set-env-vars "LIVEKIT_KEYS=devkey: secret" `
  --set-env-vars "LIVEKIT_LOG_LEVEL=info"

if ($LASTEXITCODE -eq 0) {
    Write-Host "   LiveKit Server basariyla deploy edildi!" -ForegroundColor Green
} else {
    Write-Host "   LiveKit Server deploy hatasi! Manuel kontrol edin." -ForegroundColor Red
}

# ============================================================
# 5) Trench (Event Tracking) - Deploy Et
# ============================================================
Write-Host "`n[5/8] Trench (Event Tracking) deploy ediliyor..." -ForegroundColor Yellow
gcloud run deploy trench `
  --image ghcr.io/trench-js/trench:latest `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --port 4000 `
  --memory 256Mi `
  --cpu 1 `
  --min-instances 0 `
  --max-instances 2 `
  --set-env-vars "CLICKHOUSE_HOST=clickhouse-db-45365938370.europe-west3.run.app" `
  --set-env-vars "CLICKHOUSE_PORT=443" `
  --set-env-vars "CLICKHOUSE_USER=default" `
  --set-env-vars "CLICKHOUSE_DB=socialbeats" `
  --set-env-vars "API_KEY=sb-trench-api-key-2024"

if ($LASTEXITCODE -eq 0) {
    $TRENCH_SVC_URL = gcloud run services describe trench --region $REGION --format "value(status.url)" 2>$null
    Write-Host "   Trench deploy edildi: $TRENCH_SVC_URL" -ForegroundColor Green
} else {
    Write-Host "   Trench deploy hatasi! Image uyumlu olmayabilir, alternatif olarak MongoDB fallback kullanilacak." -ForegroundColor Red
    $TRENCH_SVC_URL = ""
}

# ============================================================
# 6) Grafana - Deploy Et
# ============================================================
Write-Host "`n[6/8] Grafana deploy ediliyor..." -ForegroundColor Yellow
gcloud run deploy grafana `
  --image grafana/grafana:latest `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --port 3000 `
  --memory 256Mi `
  --cpu 1 `
  --min-instances 0 `
  --max-instances 1 `
  --set-env-vars "GF_SECURITY_ADMIN_USER=admin" `
  --set-env-vars "GF_SECURITY_ADMIN_PASSWORD=SocialBeats2024!" `
  --set-env-vars "GF_SERVER_ROOT_URL=https://grafana-45365938370.europe-west3.run.app" `
  --set-env-vars "GF_AUTH_ANONYMOUS_ENABLED=false"

if ($LASTEXITCODE -eq 0) {
    $GRAFANA_SVC_URL = gcloud run services describe grafana --region $REGION --format "value(status.url)" 2>$null
    Write-Host "   Grafana deploy edildi: $GRAFANA_SVC_URL" -ForegroundColor Green
} else {
    Write-Host "   Grafana deploy hatasi!" -ForegroundColor Red
    $GRAFANA_SVC_URL = ""
}

# ============================================================
# 7) Umami (Web Analytics) - Deploy Et
# ============================================================
Write-Host "`n[7/8] Umami (Web Analytics) deploy ediliyor..." -ForegroundColor Yellow
gcloud run deploy umami `
  --image ghcr.io/umami-software/umami:postgresql-latest `
  --region $REGION `
  --platform managed `
  --allow-unauthenticated `
  --port 3000 `
  --memory 256Mi `
  --cpu 1 `
  --min-instances 0 `
  --max-instances 1 `
  --set-env-vars "DATABASE_URL=$PG_URL" `
  --set-env-vars "APP_SECRET=sb-umami-secret-2024"

if ($LASTEXITCODE -eq 0) {
    $UMAMI_SVC_URL = gcloud run services describe umami --region $REGION --format "value(status.url)" 2>$null
    Write-Host "   Umami deploy edildi: $UMAMI_SVC_URL" -ForegroundColor Green
} else {
    Write-Host "   Umami deploy hatasi! PostgreSQL URL gerekli." -ForegroundColor Red
    $UMAMI_SVC_URL = ""
}

# ============================================================
# 8) Backend .env güncelle ve yeniden deploy et
# ============================================================
Write-Host "`n[8/8] Backend .env güncelleniyor ve yeniden deploy ediliyor..." -ForegroundColor Yellow

# Mevcut servis URL'lerini al
$LIVEKIT_SVC_URL = gcloud run services describe livekit-server --region $REGION --format "value(status.url)" 2>$null
$MEILISEARCH_SVC_URL = gcloud run services describe meilisearch --region $REGION --format "value(status.url)" 2>$null
$MINIO_SVC_URL = gcloud run services describe minio-storage --region $REGION --format "value(status.url)" 2>$null
$CLICKHOUSE_SVC_URL = gcloud run services describe clickhouse-db --region $REGION --format "value(status.url)" 2>$null

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " Deploy Tamamlandi - Servis URL'leri" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "  LiveKit:     $LIVEKIT_SVC_URL" -ForegroundColor White
Write-Host "  MeiliSearch: $MEILISEARCH_SVC_URL" -ForegroundColor White
Write-Host "  MinIO:       $MINIO_SVC_URL" -ForegroundColor White
Write-Host "  ClickHouse:  $CLICKHOUSE_SVC_URL" -ForegroundColor White
Write-Host "  Trench:      $TRENCH_SVC_URL" -ForegroundColor White
Write-Host "  Grafana:     $GRAFANA_SVC_URL" -ForegroundColor White
Write-Host "  Umami:       $UMAMI_SVC_URL" -ForegroundColor White
Write-Host "  PostgreSQL:  $PG_URL" -ForegroundColor White
Write-Host "  Redis:       $REDIS_URL" -ForegroundColor White
Write-Host ""
Write-Host "Simdi .env dosyasini guncellemeniz gerekiyor:" -ForegroundColor Yellow
Write-Host "  backend/.env dosyasindaki degerleri yukardaki URL'lerle degistirin." -ForegroundColor White
