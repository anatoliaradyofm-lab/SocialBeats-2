FROM python:3.11-slim

# Çalışma dizinini ayarla
WORKDIR /app

# Sistem bağımlılıklarını yükle (Gerekliyse)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Bağımlılıkları kopyala ve yükle
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Uygulama kodunu kopyala
COPY . .

# Cloud Run varsayılan portu
EXPOSE 8080

# Uygulamayı başlat
CMD uvicorn server:fastapi_app --host 0.0.0.0 --port ${PORT:-8080}
