"""
Storage Service - Cloudflare R2 (primary) + MinIO (fallback)
Medya depolama: avatar, post, hikaye, ses kayıtları
"""
import os
import io
import uuid
import logging
from typing import Optional

logger = logging.getLogger(__name__)

R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY = os.getenv("R2_ACCESS_KEY", "")
R2_SECRET_KEY = os.getenv("R2_SECRET_KEY", "")
R2_BUCKET = os.getenv("R2_BUCKET", "socialbeats")
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "")
R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com" if R2_ACCOUNT_ID else ""

_r2_client = None


def _r2_available() -> bool:
    return bool(R2_ACCOUNT_ID and R2_ACCESS_KEY and R2_SECRET_KEY)


def _get_r2_client():
    global _r2_client
    if not _r2_available():
        return None
    if _r2_client is not None:
        return _r2_client
    try:
        import boto3
        _r2_client = boto3.client(
            "s3",
            endpoint_url=R2_ENDPOINT,
            aws_access_key_id=R2_ACCESS_KEY,
            aws_secret_access_key=R2_SECRET_KEY,
            region_name="auto",
        )
        return _r2_client
    except Exception as e:
        logger.debug(f"R2 client error: {e}")
        return None


def upload_file(file_data: bytes, filename: str = None, content_type: str = "application/octet-stream",
                folder: str = "uploads") -> Optional[str]:
    """R2 (ana) veya MinIO (yedek) ile yükle"""
    if not filename:
        ext = _ext_from_content_type(content_type)
        filename = f"{uuid.uuid4().hex}{ext}"
    object_name = f"{folder}/{filename}"

    if _r2_available():
        try:
            client = _get_r2_client()
            if client:
                client.put_object(
                    Bucket=R2_BUCKET, Key=object_name,
                    Body=io.BytesIO(file_data), ContentType=content_type,
                    CacheControl="public, max-age=86400"
                )
                if R2_PUBLIC_URL:
                    return f"{R2_PUBLIC_URL.rstrip('/')}/{object_name}"
                return f"https://{R2_BUCKET}.{R2_ACCOUNT_ID}.r2.cloudflarestorage.com/{object_name}"
        except Exception as e:
            logger.warning(f"R2 upload failed, fallback to MinIO: {e}")

    from services.minio_service import upload_file as mup
    return mup(file_data, filename, content_type, folder)


def _ext_from_content_type(ct: str) -> str:
    m = {"image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp",
         "video/mp4": ".mp4", "video/webm": ".webm", "audio/mpeg": ".mp3", "audio/m4a": ".m4a",
         "audio/wav": ".wav", "audio/ogg": ".ogg"}
    return m.get(ct, ".bin")


def get_storage_backend() -> str:
    """Aktif depolama: r2 veya minio"""
    if _r2_available():
        return "r2"
    try:
        from services.minio_service import get_client
        return "minio" if get_client() else "none"
    except Exception:
        return "none"
