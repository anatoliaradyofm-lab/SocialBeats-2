#!/bin/bash
# Evolution API — Cloud Run Deploy Script
# Çalıştır: bash deploy_evolution.sh

set -e

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
  echo "❌ gcloud proje ayarlı değil. Çalıştır:"
  echo "   gcloud auth login"
  echo "   gcloud config set project PROJE_ADINIZ"
  exit 1
fi

echo "✅ Proje: $PROJECT_ID"
REGION="europe-west3"
SERVICE="evolution-api"
IMAGE="atendai/evolution-api:latest"

# Session dosyaları için GCS bucket
BUCKET="${PROJECT_ID}-evolution-sessions"

echo "📦 GCS bucket oluşturuluyor (yoksa)..."
gsutil mb -l $REGION gs://$BUCKET 2>/dev/null || echo "   Bucket zaten var."

echo "🚀 Cloud Run deploy ediliyor..."
gcloud run deploy $SERVICE \
  --image=$IMAGE \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=1 \
  --max-instances=3 \
  --timeout=300 \
  --set-env-vars="AUTHENTICATION_TYPE=apikey,\
AUTHENTICATION_API_KEY=sb-evolution-api-key-2024,\
SERVER_TYPE=http,\
SERVER_PORT=8080,\
CORS_ORIGIN=*,\
DEL_INSTANCE=false,\
QRCODE_LIMIT=30,\
DATABASE_ENABLED=false,\
CONFIG_SESSION_PHONE_VERSION=2.3000.1023204200,\
STORE_MESSAGES=true,\
STORE_MESSAGE_UP=true,\
STORE_CONTACTS=true,\
STORE_CHATS=true"

echo ""
echo "✅ Deploy tamamlandı!"
echo "🔗 URL: https://${SERVICE}-$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)').${REGION}.run.app"
echo ""
echo "📱 Şimdi WhatsApp bağla:"
echo "   curl -X POST https://${SERVICE}-*.run.app/instance/create \\"
echo "     -H 'apikey: sb-evolution-api-key-2024' \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"instanceName\":\"socialbeats\",\"qrcode\":true,\"integration\":\"WHATSAPP-BAILEYS\"}'"
