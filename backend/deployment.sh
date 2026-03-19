#!/bin/bash

# --- SocialBeats Production Deployment (Frankfurt) ---
# Lokasyon: europe-west3 (Frankfurt)
# Kapasite: 50,000+ Kullanıcı

PROJECT_ID="socialbeats-487416"
REGION="europe-west3"
NETWORK="default"
VPC_CONNECTOR_NAME="music-backend-vpc"
REDIS_NAME="frankfurt-redis"

echo "1. VPC Access Connector Oluşturuluyor (Redis baglantisi icin)..."
gcloud compute networks vpc-access connectors create $VPC_CONNECTOR_NAME \
    --region $REGION \
    --network $NETWORK \
    --range 10.8.0.0/28

echo "2. Redis (Memorystore) Kurulum Bilgisi..."
# Not: Memorystore manuel veya Terraform ile oluşturulmalıdır.
# IP adresi alttaki komutta kullanılacaktır.
REDIS_IP="10.x.x.x"

echo "3. Cloud Run Deploy (Europe-West3 - Frankfurt)..."
gcloud run deploy hybrid-music-backend \
    --source . \
    --region $REGION \
    --platform managed \
    --vpc-connector $VPC_CONNECTOR_NAME \
    --set-env-vars REDIS_HOST=$REDIS_IP,REDIS_PORT=6379 \
    --allow-unauthenticated \
    --min-instances 2 \
    --max-instances 50 \
    --cpu 2 \
    --memory 4Gi

echo "--- DEPLOYMENT TAMAMLANDI ---"
