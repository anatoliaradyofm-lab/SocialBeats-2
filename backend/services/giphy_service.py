"""
GIPHY API Service - GIF arama (ücretsiz tier)
Env: GIPHY_API_KEY (developers.giphy.com)
"""
import os
import logging
from typing import Optional, List

logger = logging.getLogger(__name__)

GIPHY_API_KEY = os.getenv("GIPHY_API_KEY", "")
GIPHY_BASE = "https://api.giphy.com/v1"


def is_available() -> bool:
    return bool(GIPHY_API_KEY)


async def search(q: str, limit: int = 20, offset: int = 0) -> List[dict]:
    """GIPHY search - returns list of {id, url, preview, title}"""
    if not is_available():
        return []
    try:
        import httpx
        params = {
            "api_key": GIPHY_API_KEY,
            "q": q or "hello",
            "limit": min(limit, 50),
            "offset": offset,
            "rating": "g",
            "lang": "en",
        }
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{GIPHY_BASE}/gifs/search", params=params)
            if resp.status_code != 200:
                logger.debug(f"GIPHY search {resp.status_code}: {resp.text[:200]}")
                return []
            data = resp.json()
    except Exception as e:
        logger.debug(f"GIPHY error: {e}")
        return []
    out = []
    for g in data.get("data", []):
        img = g.get("images", {})
        orig = img.get("original", {}) or img.get("downsized", {})
        prev = img.get("fixed_height_small", {}) or img.get("downsized_small", {})
        out.append({
            "id": g.get("id", ""),
            "url": orig.get("url") or orig.get("mp4") or g.get("embed_url", ""),
            "preview": prev.get("url") or prev.get("mp4") or orig.get("url", ""),
            "title": g.get("title", "")[:100],
            "width": orig.get("width"),
            "height": orig.get("height"),
        })
    return out


async def trending(limit: int = 20) -> List[dict]:
    """Trending GIFs"""
    if not is_available():
        return []
    try:
        import httpx
        params = {"api_key": GIPHY_API_KEY, "limit": min(limit, 50), "rating": "g"}
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{GIPHY_BASE}/gifs/trending", params=params)
            if resp.status_code != 200:
                return []
            data = resp.json()
    except Exception as e:
        logger.debug(f"GIPHY trending: {e}")
        return []
    out = []
    for g in data.get("data", []):
        img = g.get("images", {})
        orig = img.get("original", {}) or img.get("downsized", {})
        prev = img.get("fixed_height_small", {}) or img.get("downsized_small", {})
        out.append({
            "id": g.get("id", ""),
            "url": orig.get("url") or orig.get("mp4") or "",
            "preview": prev.get("url") or prev.get("mp4") or orig.get("url", ""),
            "title": g.get("title", "")[:100],
        })
    return out


def get_status() -> dict:
    return {"available": is_available()}
