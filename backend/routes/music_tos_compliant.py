# Music API Routes - ToS Compliant YouTube Integration
# Uses YouTube IFrame Player API for playback - NO stream URL extraction
# Fully compliant with YouTube Terms of Service

from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from typing import Optional
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import ToS-compliant YouTube Service
from services.youtube_service import youtube_service

router = APIRouter(prefix="/music", tags=["music"])

# Database reference
db = None

def set_db(database):
    """Set database reference"""
    global db
    db = database
    youtube_service.set_db(database)

async def get_or_create_music_cache():
    """Get or create music cache collection with TTL index"""
    collection = db.music_cache
    await collection.create_index("cached_at", expireAfterSeconds=24 * 3600)
    return collection


# =====================================================
# ToS COMPLIANT ENDPOINTS
# =====================================================

@router.get("/discover")
async def music_discover(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=5, le=50),
    genre: Optional[str] = Query(None, description="Pop, Rock, Jazz, vb.")
):
    """
    SoundCloud tarzı müzik keşif akışı - sonsuz kaydırma için sayfalı.
    genre verilirse o türde arama yapar, yoksa popüler müzik döner.
    """
    try:
        if genre and genre.strip():
            results = await youtube_service.search(genre.strip(), limit=limit)
        else:
            results = await youtube_service.search("pop music 2024", limit=limit)
            if not results:
                results = await youtube_service.search("trending", limit=limit)
        return {
            "results": results,
            "page": page,
            "count": len(results),
            "genre": genre or "all",
            "has_more": False
        }
    except Exception as e:
        logging.error(f"Music discover error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search/{query}")
async def music_search(query: str, limit: int = Query(10, ge=1, le=50)):
    """
    Search for songs on YouTube.
    
    Returns metadata and embed URLs for IFrame Player playback.
    This is ToS-compliant as it uses official YouTube APIs.
    """
    if not query or len(query.strip()) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters")
    
    try:
        results = await youtube_service.search(query, limit=limit)
        
        return {
            "results": results,
            "query": query,
            "count": len(results),
            "source": "YouTube",
            "playback_method": "embed",
            "tos_compliant": True
        }
        
    except Exception as e:
        logging.error(f"Music search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/song/{song_id}")
async def music_get_song(song_id: str):
    """
    Get song details and embed configuration.
    
    Returns metadata and IFrame Player configuration.
    NO direct stream URLs - playback via YouTube IFrame API only.
    """
    if not song_id:
        raise HTTPException(status_code=400, detail="Song ID required")
    
    try:
        video_info = await youtube_service.get_video_info(song_id)
        
        if not video_info:
            raise HTTPException(status_code=404, detail="Song not found")
        
        # Add player configuration
        video_info["player_config"] = youtube_service.get_player_config(song_id)
        
        return video_info
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Music get song error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/embed/{song_id}")
async def get_embed_url(
    song_id: str,
    autoplay: bool = False,
    start: int = 0
):
    """
    Get YouTube embed URL for IFrame Player.
    
    This is the ToS-compliant way to play YouTube content.
    Use this URL in a WebView or IFrame to play the video.
    """
    if not song_id:
        raise HTTPException(status_code=400, detail="Song ID required")
    
    embed_url = youtube_service.get_embed_url(song_id, autoplay=autoplay, start=start)
    player_config = youtube_service.get_player_config(song_id)
    
    return {
        "song_id": song_id,
        "embed_url": embed_url,
        "player_config": player_config,
        "youtube_url": f"https://www.youtube.com/watch?v={song_id}",
        "tos_compliant": True,
        "usage_note": "Use YouTube IFrame Player API for playback"
    }


@router.get("/player-config/{song_id}")
async def get_player_config(song_id: str):
    """
    Get YouTube IFrame Player API configuration.
    
    Use this configuration to initialize the YouTube player
    in your mobile app or web application.
    """
    if not song_id:
        raise HTTPException(status_code=400, detail="Song ID required")
    
    return {
        "song_id": song_id,
        "config": youtube_service.get_player_config(song_id),
        "iframe_api_url": "https://www.youtube.com/iframe_api",
        "documentation": "https://developers.google.com/youtube/iframe_api_reference"
    }


# =====================================================
# DEPRECATED ENDPOINTS (For backward compatibility)
# =====================================================

@router.get("/stream/{song_id}")
async def music_stream_url(song_id: str):
    """
    ⚠️ DEPRECATED - This endpoint now returns embed URL instead.
    
    Direct stream URL extraction violates YouTube ToS.
    Use the embed URL with YouTube IFrame Player API instead.
    """
    if not song_id:
        raise HTTPException(status_code=400, detail="Song ID required")
    
    # Return embed URL instead of stream URL
    embed_url = youtube_service.get_embed_url(song_id, autoplay=True)
    
    return {
        "song_id": song_id,
        "deprecated": True,
        "message": "Direct streaming is no longer supported. Use embed URL with YouTube IFrame Player.",
        "embed_url": embed_url,
        "youtube_url": f"https://www.youtube.com/watch?v={song_id}",
        "migration_guide": "Replace stream URL usage with YouTube IFrame Player API"
    }


# =====================================================
# CACHE ENDPOINTS
# =====================================================

@router.get("/cache/stats")
async def music_cache_stats():
    """Get cache statistics"""
    try:
        if not db:
            return {"error": "Database not initialized"}
        
        cache = db.music_cache
        
        total = await cache.count_documents({})
        search_cached = await cache.count_documents({"cache_key": {"$regex": "^yt_search"}})
        info_cached = await cache.count_documents({"cache_key": {"$regex": "^yt_info"}})
        
        return {
            "total_cached": total,
            "search_cached": search_cached,
            "info_cached": info_cached,
            "source": "YouTube",
            "playback_method": "embed",
            "tos_compliant": True
        }
    except Exception as e:
        logging.error(f"Cache stats error: {e}")
        return {"total_cached": 0, "error": str(e)}


@router.delete("/cache/clear")
async def music_cache_clear():
    """Clear all music cache"""
    try:
        if not db:
            raise HTTPException(status_code=500, detail="Database not initialized")
        
        cache = db.music_cache
        result = await cache.delete_many({})
        return {"deleted": result.deleted_count, "message": "Cache cleared"}
    except Exception as e:
        logging.error(f"Cache clear error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# =====================================================
# LYRICS ENDPOINTS
# =====================================================

@router.get("/lyrics")
async def get_lyrics(
    title: str = Query(..., min_length=1),
    artist: str = Query("", description="Artist name"),
):
    """
    Get song lyrics (plain + synced if available).
    Uses free APIs: lrclib.net, lyrics.ovh
    """
    try:
        from services.lyrics_service import get_lyrics as fetch_lyrics, set_db as set_lyrics_db, parse_synced_lyrics
        set_lyrics_db(db)
        result = await fetch_lyrics(title, artist)

        synced_segments = []
        if result.get("synced_lyrics"):
            synced_segments = parse_synced_lyrics(result["synced_lyrics"])

        return {
            "title": title,
            "artist": artist,
            "lyrics": result.get("lyrics"),
            "synced_lyrics": result.get("synced_lyrics"),
            "synced_segments": synced_segments,
            "source": result.get("source"),
            "has_synced": bool(result.get("synced_lyrics")),
        }
    except Exception as e:
        logging.error(f"Lyrics error: {e}")
        return {
            "title": title,
            "artist": artist,
            "lyrics": None,
            "synced_lyrics": None,
            "synced_segments": [],
            "source": None,
            "has_synced": False,
        }


# =====================================================
# ToS NOTICE ENDPOINT
# =====================================================

@router.get("/tos-notice")
async def get_tos_notice():
    """
    Get YouTube Terms of Service compliance notice.
    
    This endpoint explains how this API complies with YouTube ToS.
    """
    return {
        "title": "YouTube Terms of Service Compliance",
        "compliant": True,
        "implementation": {
            "search": "Uses YouTube Data API v3 or oEmbed for metadata",
            "playback": "Uses YouTube IFrame Player API (official embed)",
            "no_download": "No audio/video downloading or stream extraction",
            "no_circumvention": "No circumvention of YouTube's playback controls"
        },
        "youtube_tos_url": "https://www.youtube.com/static?template=terms",
        "api_tos_url": "https://developers.google.com/youtube/terms/api-services-terms-of-service",
        "note": "Content is played directly from YouTube servers via official embed player"
    }
