# Music API Routes - YouTube Music Integration with yt-dlp
# Self-hosted music streaming with server-side caching

from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from typing import Optional
import logging

# Import YouTube Music Service
from services.youtube_music import youtube_music_service

# Music API Router
music_router = APIRouter(prefix="/music", tags=["music"])

# Database reference (will be set from main server)
db = None

def set_db(database):
    """Set database reference"""
    global db
    db = database
    youtube_music_service.set_db(database)

async def get_or_create_music_cache():
    """Get or create music cache collection with TTL index"""
    collection = db.music_cache
    await collection.create_index("cached_at", expireAfterSeconds=24 * 3600)
    return collection


@music_router.get("/search/{query}")
async def music_search(query: str, limit: int = 10):
    """
    Search for songs on YouTube with server-side caching.
    Uses yt-dlp for extraction.
    
    Flow: Check cache -> If miss, search YouTube -> Store in cache -> Return
    """
    if not query or len(query.strip()) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters")
    
    try:
        results = await youtube_music_service.search(query, limit=min(limit, 20))
        
        return {
            "results": results,
            "query": query,
            "count": len(results),
            "source": "YouTube"
        }
        
    except Exception as e:
        logging.error(f"Music search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@music_router.get("/song/{song_id}")
async def music_get_song(song_id: str):
    """
    Get song details with server-side caching.
    song_id is the YouTube video ID.
    """
    if not song_id:
        raise HTTPException(status_code=400, detail="Song ID required")
    
    try:
        song = await youtube_music_service.get_song_details(song_id)
        
        if not song:
            raise HTTPException(status_code=404, detail="Song not found")
        
        return song
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Music get song error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@music_router.get("/stream/{song_id}")
async def music_stream_url(song_id: str):
    """
    ⚠️ DEPRECATED - YouTube ToS Uyumluluğu
    
    Direct stream URL extraction YouTube ToS'unu ihlal eder.
    Bunun yerine YouTube IFrame Player API kullanın.
    
    Bu endpoint artık embed URL döndürür.
    Mobil uygulamada YouTubePlayerMobile bileşenini kullanın.
    """
    if not song_id:
        raise HTTPException(status_code=400, detail="Song ID required")
    
    # ToS uyumlu yanıt - embed URL döndür
    return {
        "video_id": song_id,
        "embed_url": f"https://www.youtube.com/embed/{song_id}?autoplay=1&enablejsapi=1",
        "playback_type": "embed",
        "deprecated": True,
        "message": "Direct streaming is no longer supported due to YouTube ToS compliance. Use YouTube IFrame Player API.",
        "migration": {
            "web": "Use YouTube IFrame Player API",
            "mobile": "Use react-native-youtube-iframe or WebView with embed URL",
            "docs": "https://developers.google.com/youtube/iframe_api_reference"
        }
    }


@music_router.get("/cache/stats")
async def music_cache_stats():
    """Get cache statistics"""
    try:
        cache = await get_or_create_music_cache()
        
        total = await cache.count_documents({})
        search_cached = await cache.count_documents({"cache_key": {"$regex": "^yt_search_"}})
        songs_cached = await cache.count_documents({"cache_key": {"$regex": "^yt_details_"}})
        streams_cached = await cache.count_documents({"cache_key": {"$regex": "^yt_stream_"}})
        
        return {
            "total_cached": total,
            "search_cached": search_cached,
            "songs_cached": songs_cached,
            "streams_cached": streams_cached,
            "source": "YouTube"
        }
    except Exception as e:
        logging.error(f"Cache stats error: {e}")
        return {"total_cached": 0, "search_cached": 0, "songs_cached": 0, "streams_cached": 0}


@music_router.delete("/cache/clear")
async def music_cache_clear():
    """Clear all music cache"""
    try:
        cache = await get_or_create_music_cache()
        result = await cache.delete_many({})
        return {"deleted": result.deleted_count, "message": "Cache cleared"}
    except Exception as e:
        logging.error(f"Cache clear error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
