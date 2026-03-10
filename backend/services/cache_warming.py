# Cache Warming - Daily job to pre-fill music cache
# Spotify trending per country, YouTube trending
# TTL: unlimited (cache never expires)

import logging
import asyncio

logger = logging.getLogger(__name__)

SPOTIFY_COUNTRIES = ["US", "TR", "BR", "DE", "JP", "GB", "FR", "ES", "IT"]
YOUTUBE_QUERIES = ["top music 2024", "trending songs", "viral music 2024"]
CACHE_TTL_HOURS = None  # Unlimited


async def warm_music_cache(db):
    """Warm cache for Spotify trending + YouTube trending. Call from daily job."""
    from services.music_cache import set_db, set_cached
    from services.spotify_cached import set_db as set_spotify_db, get_trending as spotify_trending
    set_db(db)
    set_spotify_db(db)

    # Spotify trending per country
    for country in SPOTIFY_COUNTRIES:
        try:
            tracks = await spotify_trending(country=country, limit=25)
            if tracks:
                key = f"spotify:trending:{country}"
                await set_cached(key, tracks, None)
                logger.info(f"Cache warmed: {key} ({len(tracks)} tracks)")
        except Exception as e:
            logger.error(f"Spotify warming {country}: {e}")

    # YouTube trending - search and merge
    yt_results = []
    try:
        from services.youtube_service import youtube_service
        youtube_service.set_db(db)
        for q in YOUTUBE_QUERIES:
            try:
                res = await youtube_service.search(q, limit=10)
                for r in res:
                    yt_results.append({
                        "id": r.get("id") or r.get("song_id"),
                        "song_id": r.get("song_id") or r.get("id"),
                        "youtube_id": r.get("id") or r.get("song_id"),
                        "title": r.get("title", ""),
                        "artist": r.get("artist", ""),
                        "thumbnail": r.get("thumbnail") or r.get("cover_url", ""),
                        "source": "youtube",
                    })
            except Exception as e:
                logger.error(f"YouTube warming query {q}: {e}")

        # Dedupe by id
        seen = set()
        unique = []
        for t in yt_results:
            vid = t.get("youtube_id") or t.get("id")
            if vid and vid not in seen:
                seen.add(vid)
                unique.append(t)

        if unique:
            await set_cached("youtube:trending", unique, None)
            logger.info(f"Cache warmed: youtube:trending ({len(unique)} tracks)")
    except Exception as e:
        logger.error(f"YouTube cache warming: {e}")
