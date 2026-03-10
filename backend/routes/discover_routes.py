# Discover routes - Mixed YouTube + Spotify homepage, cache-only

from fastapi import APIRouter, Depends, Query
from typing import List, Optional
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import db
from core.auth import get_current_user

router = APIRouter(prefix="/discover", tags=["discover"])

logger = logging.getLogger(__name__)

# Fallback mock tracks when cache empty
MOCK_TRACKS = [
    {"id": "t1", "title": "Yıldızların Altında", "artist": "Tarkan", "source": "spotify", "spotify_id": "t1", "youtube_id": None, "thumbnail": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300"},
    {"id": "t2", "title": "Sen Olsan Bari", "artist": "Aleyna Tilki", "source": "youtube", "spotify_id": None, "youtube_id": "t2", "thumbnail": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300"},
]


def _normalize_title_artist(title: str, artist: str) -> str:
    """Normalize for deduplication."""
    return (title or "").lower().strip() + "|" + (artist or "").lower().strip()


async def _get_from_cache(key: str, ttl_hours=None):
    try:
        from services.music_cache import get_cached
        return await get_cached(key, ttl_hours)
    except Exception:
        return None


@router.get("/home")
async def discover_home(
    country: str = Query("US", description="Country code"),
    limit: int = Query(30, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Mixed YouTube + Spotify recommendations for homepage.
    Uses CACHED data only - never hits APIs directly.
    Falls back to mock if cache empty.
    """
    # Initialize music_cache db
    try:
        from services.music_cache import set_db
        set_db(db)
    except Exception:
        pass

    results = []
    seen = set()

    # 1. Spotify trending from cache
    spotify_key = f"spotify:trending:{country}"
    spotify_data = await _get_from_cache(spotify_key)
    if spotify_data:
        for t in (spotify_data if isinstance(spotify_data, list) else [])[:limit]:
            norm = _normalize_title_artist(t.get("title", ""), t.get("artist", ""))
            if norm in seen:
                continue
            seen.add(norm)
            results.append({
                "id": t.get("spotify_id") or t.get("id", ""),
                "title": t.get("title", ""),
                "artist": t.get("artist", ""),
                "source": "spotify",
                "spotify_id": t.get("spotify_id") or t.get("id"),
                "youtube_id": t.get("youtube_id"),
                "thumbnail": t.get("thumbnail") or t.get("cover_url", ""),
            })

    # 2. YouTube trending from cache
    yt_key = "youtube:trending"
    yt_data = await _get_from_cache(yt_key)
    if yt_data:
        for t in (yt_data if isinstance(yt_data, list) else [])[:limit]:
            norm = _normalize_title_artist(t.get("title", ""), t.get("artist", ""))
            if norm in seen:
                continue
            seen.add(norm)
            vid = t.get("youtube_id") or t.get("id", "")
            results.append({
                "id": vid or t.get("song_id", ""),
                "title": t.get("title", ""),
                "artist": t.get("artist", ""),
                "source": "youtube",
                "spotify_id": t.get("spotify_id"),
                "youtube_id": vid or t.get("id"),
                "thumbnail": t.get("thumbnail") or t.get("cover_url", ""),
            })

    # Fallback to mock if empty
    from_cache = len(results) > 0
    if not results:
        results = [dict(m, id=m.get("spotify_id") or m.get("youtube_id") or m["id"]) for m in MOCK_TRACKS[:limit]]

    return {
        "tracks": results[:limit],
        "count": len(results),
        "country": country,
        "from_cache": from_cache,
    }
