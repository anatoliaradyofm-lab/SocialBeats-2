# Lyrics Service - Fetches song lyrics from free APIs
# Sources: lyrics.ovh (free, no key), lrclib.net (synced lyrics, no key)

import logging
import httpx
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)

_db = None


def set_db(database):
    global _db
    _db = database


async def _get_cached(key: str) -> Optional[Dict]:
    if _db is None:
        return None
    try:
        cached = await _db.lyrics_cache.find_one({"cache_key": key})
        if cached:
            return cached.get("data")
    except Exception as e:
        logger.error(f"Lyrics cache read error: {e}")
    return None


async def _set_cached(key: str, data: Dict):
    if _db is None:
        return
    try:
        from datetime import datetime, timezone
        await _db.lyrics_cache.update_one(
            {"cache_key": key},
            {"$set": {"cache_key": key, "data": data, "cached_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
    except Exception as e:
        logger.error(f"Lyrics cache write error: {e}")


async def get_lyrics(title: str, artist: str) -> Dict:
    """
    Fetch lyrics for a song. Tries multiple free sources.
    Returns { lyrics: str, synced_lyrics: str|null, source: str }
    """
    if not title:
        return {"lyrics": None, "synced_lyrics": None, "source": None}

    cache_key = f"lyrics:{(artist or '').lower().strip()}:{title.lower().strip()}"
    cached = await _get_cached(cache_key)
    if cached is not None:
        logger.info(f"Lyrics cache HIT: {title} - {artist}")
        return cached

    result = {"lyrics": None, "synced_lyrics": None, "source": None}

    synced = await _fetch_lrclib(title, artist)
    if synced:
        result = synced

    if not result["lyrics"]:
        plain = await _fetch_lyrics_ovh(title, artist)
        if plain:
            result["lyrics"] = plain
            result["source"] = result.get("source") or "lyrics.ovh"

    if result["lyrics"]:
        await _set_cached(cache_key, result)

    return result


async def _fetch_lrclib(title: str, artist: str) -> Optional[Dict]:
    """Fetch synced lyrics from lrclib.net (free, no API key)"""
    try:
        async with httpx.AsyncClient() as client:
            params = {"track_name": title, "artist_name": artist or ""}
            resp = await client.get(
                "https://lrclib.net/api/search",
                params=params,
                timeout=8,
                headers={"User-Agent": "SocialBeats/1.0"},
            )
            if resp.status_code != 200:
                return None

            data = resp.json()
            if not data or not isinstance(data, list):
                return None

            best = data[0]
            synced = best.get("syncedLyrics")
            plain = best.get("plainLyrics")

            if not synced and not plain:
                return None

            return {
                "lyrics": plain or _strip_timestamps(synced),
                "synced_lyrics": synced,
                "source": "lrclib.net",
                "duration": best.get("duration"),
            }
    except Exception as e:
        logger.error(f"lrclib error: {e}")
    return None


async def _fetch_lyrics_ovh(title: str, artist: str) -> Optional[str]:
    """Fetch plain lyrics from lyrics.ovh (free, no API key)"""
    if not artist:
        return None
    try:
        async with httpx.AsyncClient() as client:
            url = f"https://api.lyrics.ovh/v1/{artist}/{title}"
            resp = await client.get(url, timeout=8)
            if resp.status_code != 200:
                return None
            data = resp.json()
            lyrics = data.get("lyrics")
            if lyrics and len(lyrics.strip()) > 10:
                return lyrics.strip()
    except Exception as e:
        logger.error(f"lyrics.ovh error: {e}")
    return None


def _strip_timestamps(synced: str) -> str:
    """Convert synced lyrics [mm:ss.xx] lines to plain text"""
    if not synced:
        return ""
    import re
    lines = synced.split("\n")
    plain_lines = []
    for line in lines:
        cleaned = re.sub(r'\[\d{2}:\d{2}\.\d{2,3}\]\s*', '', line).strip()
        if cleaned:
            plain_lines.append(cleaned)
    return "\n".join(plain_lines)


def parse_synced_lyrics(synced_text: str) -> List[Dict]:
    """Parse synced lyrics into time-stamped segments for frontend"""
    if not synced_text:
        return []
    import re
    segments = []
    for line in synced_text.split("\n"):
        match = re.match(r'\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)', line)
        if match:
            minutes = int(match.group(1))
            seconds = int(match.group(2))
            ms_str = match.group(3)
            ms = int(ms_str) * (10 if len(ms_str) == 2 else 1)
            time_ms = (minutes * 60 + seconds) * 1000 + ms
            text = match.group(4).strip()
            if text:
                segments.append({"time_ms": time_ms, "text": text})
    return segments
