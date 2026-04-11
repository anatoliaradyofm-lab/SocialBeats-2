# Unified Search - SoundCloud (via music_hybrid) with cache-first

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
    Unified search via SoundCloud + Audius.
    Cache first (music_search_unified:{query}:{country}), TTL 24h.
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

    results = []
    try:
        from routes.music_hybrid import _sc_search, _audius_search
        sc_tracks = await _sc_search(query, limit=limit)
        results = sc_tracks
        if len(results) < limit:
            audius_tracks = await _audius_search(query, limit=limit - len(results))
            results.extend(audius_tracks)
    except Exception as e:
        logger.error(f"SoundCloud search error: {e}")

    try:
        from services.music_cache import set_db, set_cached
        set_db(db)
        await set_cached(cache_key, results, None)
    except Exception as e:
        logger.error(f"Cache set error: {e}")

    return {
        "results": results[:limit],
        "query": query,
        "country": country,
    }


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
