# Music Cache Service - Generic MongoDB-backed cache for YouTube + Spotify
# Quota-safe: All API calls go through cache first.
# TTL: Pass ttl_hours=None or 0 for unlimited (never expire). Default is unlimited.
# Collection: music_cache with { key, value (JSON), cached_at }

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Any

logger = logging.getLogger(__name__)

_db = None

# Use None for unlimited TTL - cached items never expire
TTL_UNLIMITED = None

def set_db(database):
    """Set database reference"""
    global _db
    _db = database


async def get_cached(key: str, ttl_hours: Optional[int] = TTL_UNLIMITED) -> Optional[Any]:
    """
    Get value from cache if not expired.
    ttl_hours: None or 0 = unlimited (return if key exists, regardless of age).
    Returns None if miss or expired (when ttl_hours > 0).
    """
    if _db is None:
        return None
    try:
        doc = await _db.music_cache.find_one({"key": key})
        if not doc:
            return None
        cached_at = doc.get("cached_at")
        if not cached_at:
            return None
        # Unlimited TTL: skip age check, return data even if very old
        if ttl_hours is None or ttl_hours <= 0:
            return doc.get("value")
        age_hours = (datetime.now(timezone.utc) - cached_at).total_seconds() / 3600
        if age_hours >= ttl_hours:
            return None
        return doc.get("value")
    except Exception as e:
        logger.error(f"Cache get error for {key}: {e}")
        return None


async def set_cached(key: str, value: Any, ttl_hours: Optional[int] = TTL_UNLIMITED) -> None:
    """Store value in cache. ttl_hours=None/0 means unlimited TTL (checked at get time)."""
    if _db is None:
        return
    try:
        await _db.music_cache.update_one(
            {"key": key},
            {"$set": {"key": key, "value": value, "cached_at": datetime.now(timezone.utc)}},
            upsert=True
        )
    except Exception as e:
        logger.error(f"Cache set error for {key}: {e}")


