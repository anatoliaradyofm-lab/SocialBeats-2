# Music Cached Service - Deezer API (free, no key required, high limits)
# Replaces Spotify API with Deezer for zero-cost music data
# Deezer API: https://developers.deezer.com/api - No authentication needed
# Rate limit: 50 requests / 5 seconds (very generous)
#
# Keys: deezer_search:{query}, deezer_track:{id}, deezer_trending, deezer_playlist:{id}
# TTL: unlimited (cache never expires)

import logging
import httpx
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

DEEZER_API_BASE = "https://api.deezer.com"

_db = None


def set_db(database):
    global _db
    _db = database


async def _get_cached(key: str, ttl_hours=None) -> Optional[Any]:
    if _db is None:
        return None
    try:
        from services.music_cache import get_cached
        return await get_cached(key, ttl_hours)
    except Exception:
        return None


async def _set_cached(key: str, value: Any, ttl_hours=None):
    if _db is None:
        return
    try:
        from services.music_cache import set_cached
        await set_cached(key, value, ttl_hours)
    except Exception as e:
        logger.error(f"Cache set error: {e}")


def _format_track(t: dict) -> dict:
    """Deezer track → unified format (same interface as old Spotify output)."""
    artist_name = t.get("artist", {}).get("name", "") if isinstance(t.get("artist"), dict) else str(t.get("artist", ""))
    album = t.get("album", {})
    album_name = album.get("title", "") if isinstance(album, dict) else ""
    album_cover = album.get("cover_big", "") if isinstance(album, dict) else ""
    return {
        "id": str(t.get("id", "")),
        "title": t.get("title", ""),
        "artist": artist_name,
        "album": album_name,
        "thumbnail": album_cover or t.get("md5_image", ""),
        "duration_ms": t.get("duration", 0) * 1000,
        "preview_url": t.get("preview", ""),
        "source": "spotify",
        "spotify_id": str(t.get("id", "")),
    }


async def search(query: str, country: str = "US", limit: int = 20) -> List[Dict]:
    """Search tracks via Deezer - cache first."""
    key = f"deezer_search:{query}:{country}"
    cached = await _get_cached(key)
    if cached is not None:
        logger.info(f"Deezer search cache HIT: {query}")
        return cached[:limit]

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{DEEZER_API_BASE}/search",
                params={"q": query, "limit": limit, "output": "json"},
                timeout=10,
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
            tracks = [_format_track(t) for t in data.get("data", [])]
            await _set_cached(key, tracks)
            return tracks
    except Exception as e:
        logger.error(f"Deezer search error: {e}")
        return []


async def get_trending(country: str = "US", limit: int = 20) -> List[Dict]:
    """Get trending/popular tracks via Deezer chart - cache first."""
    key = f"deezer:trending:{country}"
    cached = await _get_cached(key)
    if cached is not None:
        logger.info(f"Deezer trending cache HIT: {country}")
        return cached[:limit]

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{DEEZER_API_BASE}/chart/0/tracks",
                params={"limit": limit},
                timeout=10,
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
            tracks = [_format_track(t) for t in data.get("data", [])]
            await _set_cached(key, tracks)
            return tracks
    except Exception as e:
        logger.error(f"Deezer trending error: {e}")
        return []


async def get_track(track_id: str) -> Optional[Dict]:
    """Get track by ID via Deezer - cache first."""
    key = f"deezer_track:{track_id}"
    cached = await _get_cached(key)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{DEEZER_API_BASE}/track/{track_id}", timeout=10)
            if resp.status_code != 200:
                return None
            t = resp.json()
            if t.get("error"):
                return None
            track = _format_track(t)
            await _set_cached(key, track)
            return track
    except Exception as e:
        logger.error(f"Deezer track error: {e}")
        return None


async def get_artist(artist_id: str, country: str = "US") -> Optional[Dict]:
    """Get artist by ID with top tracks via Deezer - cache first."""
    key = f"deezer_artist:{artist_id}:{country}"
    cached = await _get_cached(key)
    if cached is not None:
        logger.info(f"Deezer artist cache HIT: {artist_id}")
        return cached

    try:
        async with httpx.AsyncClient() as client:
            artist_resp = await client.get(f"{DEEZER_API_BASE}/artist/{artist_id}", timeout=10)
            if artist_resp.status_code != 200:
                return None
            artist = artist_resp.json()
            if artist.get("error"):
                return None

            top_resp = await client.get(f"{DEEZER_API_BASE}/artist/{artist_id}/top", params={"limit": 10}, timeout=10)
            top_tracks = []
            if top_resp.status_code == 200:
                top_data = top_resp.json()
                top_tracks = [
                    {
                        "id": str(t.get("id", "")),
                        "title": t.get("title", ""),
                        "album": t.get("album", {}).get("title", "") if isinstance(t.get("album"), dict) else "",
                        "cover_url": t.get("album", {}).get("cover_big", "") if isinstance(t.get("album"), dict) else "",
                        "preview_url": t.get("preview", ""),
                    }
                    for t in top_data.get("data", [])[:10]
                ]

            result = {
                "id": str(artist.get("id", "")),
                "name": artist.get("name", ""),
                "image_url": artist.get("picture_big", ""),
                "followers": artist.get("nb_fan", 0),
                "genres": [],
                "popularity": 0,
                "top_tracks": top_tracks,
            }
            await _set_cached(key, result)
            return result
    except Exception as e:
        logger.error(f"Deezer artist error: {e}")
        return None


async def get_recommendations(
    seed_tracks: Optional[List[str]] = None,
    seed_artists: Optional[List[str]] = None,
    seed_genres: Optional[List[str]] = None,
    limit: int = 20,
) -> List[Dict]:
    """Get recommendations via Deezer radio/mix - cache first."""
    parts = []
    if seed_tracks:
        parts.extend(seed_tracks[:5])
    if seed_artists:
        parts.extend(seed_artists[:5])
    if seed_genres:
        parts.extend(seed_genres[:5])
    if not parts:
        parts = ["pop"]
    key = f"deezer_recommendations:{':'.join(parts)}:{limit}"
    cached = await _get_cached(key)
    if cached is not None:
        logger.info("Deezer recommendations cache HIT")
        return cached

    try:
        async with httpx.AsyncClient() as client:
            tracks = []
            if seed_artists and seed_artists[0].isdigit():
                resp = await client.get(
                    f"{DEEZER_API_BASE}/artist/{seed_artists[0]}/related",
                    params={"limit": 5},
                    timeout=10,
                )
                if resp.status_code == 200:
                    related = resp.json().get("data", [])
                    for rel_artist in related[:3]:
                        top_resp = await client.get(
                            f"{DEEZER_API_BASE}/artist/{rel_artist['id']}/top",
                            params={"limit": 7},
                            timeout=10,
                        )
                        if top_resp.status_code == 200:
                            for t in top_resp.json().get("data", []):
                                tracks.append(_format_track(t))
                                if len(tracks) >= limit:
                                    break
                        if len(tracks) >= limit:
                            break
            if not tracks:
                query = parts[0] if parts else "pop"
                resp = await client.get(
                    f"{DEEZER_API_BASE}/search",
                    params={"q": query, "limit": limit},
                    timeout=10,
                )
                if resp.status_code == 200:
                    tracks = [_format_track(t) for t in resp.json().get("data", [])]

            await _set_cached(key, tracks)
            return tracks[:limit]
    except Exception as e:
        logger.error(f"Deezer recommendations error: {e}")
        return []


async def get_playlist_tracks(playlist_id: str, limit: int = 100) -> List[Dict]:
    """Get playlist tracks via Deezer - cache first."""
    key = f"deezer_playlist:{playlist_id}"
    cached = await _get_cached(key)
    if cached is not None:
        logger.info(f"Deezer playlist cache HIT: {playlist_id}")
        return cached[:limit]

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{DEEZER_API_BASE}/playlist/{playlist_id}/tracks",
                params={"limit": min(limit, 100)},
                timeout=10,
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
            tracks = [_format_track(t) for t in data.get("data", [])]
            await _set_cached(key, tracks)
            return tracks[:limit]
    except Exception as e:
        logger.error(f"Deezer playlist error: {e}")
        return []
