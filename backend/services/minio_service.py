"""
MinIO Service - S3-compatible object storage (open-source)
Handles file uploads: avatars, media, voice messages, backups
Falls back to local filesystem or data URIs if MinIO is not available
"""
import os
import io
import uuid
import logging
from typing import Optional
from datetime import timedelta

logger = logging.getLogger(__name__)

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "socialbeats")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"
MINIO_PUBLIC_URL = os.getenv("MINIO_PUBLIC_URL", "")

_client = None


def get_client():
    global _client
    if _client is not None:
        return _client
    try:
        from minio import Minio
        _client = Minio(
            MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=MINIO_SECURE,
        )
        if not _client.bucket_exists(MINIO_BUCKET):
            _client.make_bucket(MINIO_BUCKET)
            logger.info(f"MinIO bucket '{MINIO_BUCKET}' created")
        logger.info("MinIO client connected")
        return _client
    except Exception as e:
        logger.info(f"MinIO not available: {e}")
        return None


def upload_file(file_data: bytes, filename: str = None, content_type: str = "application/octet-stream",
                folder: str = "uploads") -> Optional[str]:
    """Upload a file to MinIO and return its URL"""
    client = get_client()
    if not client:
        return None

    if not filename:
        ext = _ext_from_content_type(content_type)
        filename = f"{uuid.uuid4().hex}{ext}"

    object_name = f"{folder}/{filename}"

    try:
        client.put_object(
            MINIO_BUCKET,
            object_name,
            io.BytesIO(file_data),
            length=len(file_data),
            content_type=content_type,
        )
        if MINIO_PUBLIC_URL:
            return f"{MINIO_PUBLIC_URL}/{MINIO_BUCKET}/{object_name}"
        return f"{'https' if MINIO_SECURE else 'http'}://{MINIO_ENDPOINT}/{MINIO_BUCKET}/{object_name}"
    except Exception as e:
        logger.warning(f"MinIO upload failed: {e}")
        return None


def upload_avatar(file_data: bytes, user_id: str, content_type: str = "image/jpeg") -> Optional[str]:
    ext = _ext_from_content_type(content_type)
    filename = f"{user_id}{ext}"
    return upload_file(file_data, filename, content_type, folder="avatars")


def upload_media(file_data: bytes, content_type: str = "image/jpeg", folder: str = "media") -> Optional[str]:
    return upload_file(file_data, None, content_type, folder=folder)


def upload_voice(file_data: bytes, conversation_id: str) -> Optional[str]:
    filename = f"{uuid.uuid4().hex}.m4a"
    return upload_file(file_data, filename, "audio/m4a", folder=f"voice/{conversation_id}")


def get_presigned_url(object_name: str, expires: int = 3600) -> Optional[str]:
    client = get_client()
    if not client:
        return None
    try:
        return client.presigned_get_object(MINIO_BUCKET, object_name, expires=timedelta(seconds=expires))
    except Exception as e:
        logger.debug(f"MinIO presigned URL error: {e}")
        return None


def delete_file(object_name: str) -> bool:
    client = get_client()
    if not client:
        return False
    try:
        client.remove_object(MINIO_BUCKET, object_name)
        return True
    except Exception as e:
        logger.debug(f"MinIO delete error: {e}")
        return False


def list_files(prefix: str = "", limit: int = 100) -> list:
    client = get_client()
    if not client:
        return []
    try:
        objects = client.list_objects(MINIO_BUCKET, prefix=prefix, recursive=True)
        result = []
        for obj in objects:
            if len(result) >= limit:
                break
            result.append({
                "name": obj.object_name,
                "size": obj.size,
                "last_modified": obj.last_modified.isoformat() if obj.last_modified else None,
            })
        return result
    except Exception as e:
        logger.debug(f"MinIO list error: {e}")
        return []


def _ext_from_content_type(ct: str) -> str:
    mapping = {
        "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp",
        "video/mp4": ".mp4", "video/webm": ".webm",
        "audio/mpeg": ".mp3", "audio/m4a": ".m4a", "audio/wav": ".wav", "audio/ogg": ".ogg",
    }
    return mapping.get(ct, ".bin")
