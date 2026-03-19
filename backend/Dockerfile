# Production build for Frankfurt europe-west3
FROM python:3.11-slim as builder

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

COPY requirements_fixed.txt requirements.txt
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    ca-certificates \
    git \
    pkg-config \
    libssl-dev && \
    pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefer-binary --prefix=/install -r requirements.txt

# Final Stage
FROM python:3.11-slim

WORKDIR /app

# Copy installed dependencies
COPY --from=builder /install /usr/local
COPY . .

# Cloud Run / Frankfurt Optimizations
ENV PORT 8080
ENV WORKERS 4
ENV TIMEOUT 0

# Use Gunicorn as a process manager for Uvicorn workers
# server:fastapi_app is the main entry point
ENV PATH="/usr/local/bin:$PATH"
CMD exec /usr/local/bin/gunicorn --bind :$PORT --workers $WORKERS --worker-class uvicorn.workers.UvicornWorker --threads 8 server:fastapi_app
