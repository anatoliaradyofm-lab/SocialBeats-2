# Unified Search - Spotify + YouTube with cache-first, merge by title+artist

from fastapi import APIRouter, Depends, Query
from typing import List, Optional
import logging
import re

from core.database import db
from core.auth import get_current_user

router = APIRouter(tags=["music"])

logger = logging.getLogger(__name__)


def _normalize(s: str) -> str:
    s = (s or "").lower().strip()
    s = re.sub(r'[^\w\s]', '', s)
    return re.sub(r'\s+', ' ', s)


def _match_tracks(yt_list: list, sp_list: list, dz_list: list = None) -> List[dict]:
    """Merge by title+artist, add spotify_id, youtube_id, deezer_id to each."""
    merged = {}
    for t in yt_list:
        title = t.get("title", "")
        artist = t.get("artist", "")
        key = _normalize(title) + "|" + _normalize(artist)
        if key not in merged:
            merged[key] = {
                "title": title,
                "artist": artist,
                "spotify_id": None,
                "youtube_id": t.get("id") or t.get("youtube_id") or t.get("song_id"),
                "deezer_id": None,
                "thumbnail": t.get("thumbnail") or t.get("cover_url", ""),
                "sources": [],
            }
        merged[key]["youtube_id"] = t.get("id") or t.get("youtube_id") or t.get("song_id")
        if "youtube" not in merged[key]["sources"]:
            merged[key]["sources"].append("youtube")
        if not merged[key]["thumbnail"]:
            merged[key]["thumbnail"] = t.get("thumbnail") or t.get("cover_url", "")

    for t in sp_list:
        title = t.get("title", "")
        artist = t.get("artist", "")
        key = _normalize(title) + "|" + _normalize(artist)
        if key not in merged:
            merged[key] = {
                "title": title,
                "artist": artist,
                "spotify_id": t.get("spotify_id") or t.get("id"),
                "youtube_id": None,
                "deezer_id": None,
                "thumbnail": t.get("thumbnail") or t.get("cover_url", ""),
                "sources": [],
            }
        merged[key]["spotify_id"] = t.get("spotify_id") or t.get("id")
        if "spotify" not in merged[key]["sources"]:
            merged[key]["sources"].append("spotify")
        if not merged[key]["thumbnail"]:
            merged[key]["thumbnail"] = t.get("thumbnail") or t.get("cover_url", "")

    for t in (dz_list or []):
        title = t.get("title", "")
        artist = t.get("artist", "")
        key = _normalize(title) + "|" + _normalize(artist)
        if key not in merged:
            merged[key] = {
                "title": title,
                "artist": artist,
                "spotify_id": None,
                "youtube_id": None,
                "deezer_id": t.get("deezer_id") or t.get("id", "").replace("deezer_", ""),
                "thumbnail": t.get("thumbnail") or t.get("cover_url", ""),
                "preview_url": t.get("preview_url", ""),
                "sources": [],
            }
        merged[key]["deezer_id"] = t.get("deezer_id") or t.get("id", "").replace("deezer_", "")
        if not merged[key].get("preview_url"):
            merged[key]["preview_url"] = t.get("preview_url", "")
        if "deezer" not in merged[key]["sources"]:
            merged[key]["sources"].append("deezer")
        if not merged[key]["thumbnail"]:
            merged[key]["thumbnail"] = t.get("thumbnail") or t.get("cover_url", "")

    return list(merged.values())


@router.get("/music/search-key")
async def get_meilisearch_key(current_user: dict = Depends(get_current_user)):
    """Frontend icin sadece arama yetkisi olan MeiliSearch anahtarini don."""
    try:
        from services.meilisearch_service import meili_service
        search_key = await meili_service.get_search_key()
        return {"search_key": search_key, "url": "https://meilisearch-45365938370.europe-west3.run.app"}
    except Exception:
        return {"search_key": "", "url": ""}


@router.get("/music/search-unified")
async def search_unified(
    q: str = Query(..., min_length=2),
    country: str = Query("US", description="Country code"),
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Unified search: Spotify + YouTube.
    Cache first (music_search_unified:{query}:{country}), TTL 24h.
    Merge by title+artist, return spotify_id + youtube_id per track.
    """
    query = q.strip()
    cache_key = f"music_search_unified:{query}:{country}"

    try:
        from services.music_cache import set_db, get_cached, set_cached
        set_db(db)
        cached = await get_cached(cache_key, None)
        if cached is not None:
            logger.info(f"Unified search cache HIT: {query}")
            return {"results": cached[:limit], "query": query, "country": country}
    except Exception as e:
        logger.error(f"Cache get error: {e}")

    yt_results = []
    sp_results = []
    dz_results = []

    try:
        from services.youtube_service import youtube_service
        youtube_service.set_db(db)
        yt_results = await youtube_service.search(query, limit=limit)
    except Exception as e:
        logger.error(f"YouTube search error: {e}")

    try:
        from services.spotify_cached import set_db as set_sp_db, search as spotify_search
        set_sp_db(db)
        sp_results = await spotify_search(query, country=country, limit=limit)
    except Exception as e:
        logger.error(f"Spotify search error: {e}")

    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(f"https://api.deezer.com/search?q={query}&limit={limit}") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    for t in data.get("data", []):
                        dz_results.append({
                            "id": f"deezer_{t['id']}",
                            "title": t.get("title", ""),
                            "artist": t.get("artist", {}).get("name", ""),
                            "thumbnail": t.get("album", {}).get("cover_medium", ""),
                            "deezer_id": str(t["id"]),
                            "preview_url": t.get("preview", ""),
                        })
    except Exception as e:
        logger.error(f"Deezer search error: {e}")

    merged = _match_tracks(yt_results, sp_results, dz_results)

    try:
        from services.music_cache import set_db, set_cached
        set_db(db)
        await set_cached(cache_key, merged, None)
    except Exception as e:
        logger.error(f"Cache set error: {e}")

    return {
        "results": merged[:limit],
        "query": query,
        "country": country,
    }


@router.get("/music/search-deezer")
async def search_deezer(
    q: str = Query(..., min_length=2),
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """Search music via Deezer API (free, no auth needed)."""
    import aiohttp

    cache_key = f"deezer_search:{q.strip().lower()}"
    try:
        from services.music_cache import set_db, get_cached, set_cached
        set_db(db)
        cached = await get_cached(cache_key, None)
        if cached is not None:
            return {"results": cached[:limit], "query": q, "platform": "deezer"}
    except Exception:
        pass

    results = []
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"https://api.deezer.com/search?q={q}&limit={limit}") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    for t in data.get("data", []):
                        results.append({
                            "id": f"deezer_{t['id']}",
                            "title": t.get("title", ""),
                            "artist": t.get("artist", {}).get("name", ""),
                            "thumbnail": t.get("album", {}).get("cover_medium", ""),
                            "duration": t.get("duration", 0),
                            "preview_url": t.get("preview", ""),
                            "platform": "deezer",
                            "deezer_id": str(t["id"]),
                        })
    except Exception as e:
        logger.error(f"Deezer search error: {e}")

    try:
        from services.music_cache import set_db, set_cached
        set_db(db)
        await set_cached(cache_key, results, None)
    except Exception:
        pass

    return {"results": results[:limit], "query": q, "platform": "deezer"}


@router.get("/discover/new-releases")
async def get_new_releases(
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """Get new music releases (last 24 hours from cache, or trending)."""
    from datetime import datetime, timezone, timedelta

    cutoff_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

    recent_tracks = await db.music_cache.find(
        {"cached_at": {"$gte": cutoff_24h}},
        {"_id": 0}
    ).sort("cached_at", -1).limit(limit).to_list(limit)

    if len(recent_tracks) < 5:
        recent_tracks = await db.music_cache.find(
            {}, {"_id": 0}
        ).sort("cached_at", -1).limit(limit).to_list(limit)

    releases = []
    for t in recent_tracks:
        data = t.get("data", t)
        if isinstance(data, dict):
            releases.append({
                "id": data.get("id", t.get("key", "")),
                "title": data.get("title", ""),
                "artist": data.get("artist", ""),
                "thumbnail": data.get("thumbnail", data.get("cover_url", "")),
                "platform": data.get("platform", ""),
                "added_at": t.get("cached_at", ""),
            })

    return {"releases": releases[:limit], "total": len(releases)}


@router.get("/discover/trending-content")
async def get_trending_content(
    limit: int = Query(20, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """Get trending content from last 7 days (posts + tracks)."""
    from datetime import datetime, timezone, timedelta

    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    trending_posts = await db.posts.find(
        {"created_at": {"$gte": cutoff}, "deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("likes_count", -1).limit(limit).to_list(limit)

    for post in trending_posts:
        user = await db.users.find_one(
            {"id": post.get("user_id")},
            {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
        )
        if user:
            post["user"] = user

    trending_tracks = await db.listening_history.aggregate([
        {"$match": {"played_at": {"$gte": cutoff}}},
        {"$group": {"_id": "$track_id", "play_count": {"$sum": 1}, "track": {"$first": "$$ROOT"}}},
        {"$sort": {"play_count": -1}},
        {"$limit": limit}
    ]).to_list(limit)

    tracks = []
    for t in trending_tracks:
        track_data = t.get("track", {})
        tracks.append({
            "id": t["_id"],
            "title": track_data.get("title", track_data.get("track_title", "")),
            "artist": track_data.get("artist", track_data.get("track_artist", "")),
            "thumbnail": track_data.get("thumbnail", track_data.get("cover_url", "")),
            "play_count": t["play_count"],
        })

    return {
        "trending_posts": trending_posts[:limit],
        "trending_tracks": tracks[:limit],
    }
