# YouTube Service - ToS Compliant Implementation with Quota Optimization
# Uses YouTube Data API v3 for metadata and IFrame API for playback
# NO downloading or stream URL extraction - fully compliant with YouTube ToS
# AGGRESSIVE CACHING to minimize API quota usage
#
# Kota bittiğinde oEmbed veya yt-dlp ile devam eder, arama kesilmez.
# When quota is exceeded (403 quotaExceeded), fallback to oEmbed (free, no quota)
# or _search_basic (scraping). Search never stops - always a path without Data API.

import asyncio
import logging
import httpx
import os
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

# YouTube Data API v3 Key (optional - works without for basic metadata)
YOUTUBE_API_KEY = os.environ.get('YOUTUBE_API_KEY', '')

# Cache TTL: None = unlimited (never expire). Cached data stays until manually cleared.
SEARCH_CACHE_HOURS = None  # Unlimited
INFO_CACHE_HOURS = None    # Unlimited

# Rate limiting DISABLED - Cache handles quota protection
# MAX_SEARCHES_PER_MINUTE = 30
# MAX_SEARCHES_PER_HOUR = 300

class YouTubeService:
    """
    ToS-Compliant YouTube Service with Quota Optimization
    
    This service:
    - Uses YouTube Data API v3 for search and metadata (when API key available)
    - Falls back to oEmbed API for basic metadata (no API key needed, NO QUOTA)
    - Returns embed URLs for IFrame Player API playback
    - DOES NOT extract or provide direct stream URLs
    - DOES NOT enable downloading of content
    - AGGRESSIVE CACHING to minimize quota usage
    
    Quota Optimization:
    - Search and video info cached unlimited (never expire)
    - When quota exceeded (403): fallback to oEmbed or _search_basic - arama kesilmez
    - NO rate limiting - cache handles protection
    """
    
    def __init__(self, db=None):
        self.db = db
        self.api_key = YOUTUBE_API_KEY
        self.has_api_key = bool(self.api_key)
        # Rate limiting disabled
        # self._search_count = 0
        # self._search_reset_time = datetime.now(timezone.utc)
        
    def set_db(self, database):
        """Set database reference for caching"""
        self.db = database
    
    def _get_cache_key(self, prefix: str, value: str) -> str:
        """Generate cache key with hash for long values"""
        hash_val = hashlib.md5(value.lower().encode()).hexdigest()[:12]
        return f"{prefix}_{hash_val}"
    
    async def _check_rate_limit(self) -> bool:
        """Rate limiting disabled - always return True"""
        # Cache handles quota protection, no need for rate limiting
        return True
    
    async def _get_from_cache(self, cache_key: str, max_age_hours: Optional[int]) -> Optional[Dict]:
        """Get item from cache. max_age_hours=None means unlimited (return if exists)."""
        if self.db is None:
            return None
        
        try:
            cached = await self.db.music_cache.find_one({"cache_key": cache_key})
            if cached:
                cached_at = cached.get("cached_at")
                if cached_at:
                    # Unlimited TTL: skip age check
                    if max_age_hours is None or max_age_hours <= 0:
                        logging.info(f"Cache HIT: {cache_key}")
                        return cached.get("data") or cached.get("results") or cached.get("video_info")
                    age_hours = (datetime.now(timezone.utc) - cached_at).total_seconds() / 3600
                    if age_hours < max_age_hours:
                        logging.info(f"Cache HIT: {cache_key}")
                        return cached.get("data") or cached.get("results") or cached.get("video_info")
        except Exception as e:
            logging.error(f"Cache read error: {e}")
        
        return None
    
    async def _save_to_cache(self, cache_key: str, data: Any):
        """Save item to cache"""
        if self.db is None:
            return
        
        try:
            await self.db.music_cache.update_one(
                {"cache_key": cache_key},
                {
                    "$set": {
                        "cache_key": cache_key,
                        "data": data,
                        "results": data if isinstance(data, list) else None,
                        "video_info": data if isinstance(data, dict) and "song_id" in data else None,
                        "cached_at": datetime.now(timezone.utc)
                    }
                },
                upsert=True
            )
        except Exception as e:
            logging.error(f"Cache write error: {e}")
    
    def _format_duration(self, iso_duration: str) -> tuple:
        """
        Convert ISO 8601 duration (PT4M13S) to seconds and formatted string
        """
        if not iso_duration:
            return 0, "0:00"
        
        import re
        match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', iso_duration)
        if not match:
            return 0, "0:00"
        
        hours = int(match.group(1) or 0)
        minutes = int(match.group(2) or 0)
        seconds = int(match.group(3) or 0)
        
        total_seconds = hours * 3600 + minutes * 60 + seconds
        
        if hours > 0:
            formatted = f"{hours}:{minutes:02d}:{seconds:02d}"
        else:
            formatted = f"{minutes}:{seconds:02d}"
        
        return total_seconds, formatted
    
    def _format_view_count(self, count: int) -> str:
        """Format view count for display"""
        if count >= 1000000000:
            return f"{count / 1000000000:.1f}B"
        elif count >= 1000000:
            return f"{count / 1000000:.1f}M"
        elif count >= 1000:
            return f"{count / 1000:.1f}K"
        return str(count)
    
    async def search(self, query: str, limit: int = 10) -> List[Dict]:
        """
        Search YouTube for videos with quota optimization
        
        Strategy:
        1. Check cache first (6 hour TTL)
        2. If cache miss and API key exists, use Data API v3
        3. If no API key or quota limit, use oEmbed (zero quota)
        """
        if not query or len(query.strip()) < 2:
            return []
        
        query = query.strip()
        cache_key = self._get_cache_key("yt_search_v3", query)
        
        # 1. Check cache first
        cached_results = await self._get_from_cache(cache_key, SEARCH_CACHE_HOURS)
        if cached_results:
            return cached_results[:limit]
        
        logging.info(f"YouTube search (cache miss): {query}")
        
        results = []
        
        # 2. Use API if available (no rate limit)
        if self.has_api_key:
            results = await self._search_with_api(query, limit)
        
        # 3. Fallback to basic search (zero quota)
        if not results:
            results = await self._search_basic(query, limit)
        
        # Save to cache
        if results:
            await self._save_to_cache(cache_key, results)
        
        return results
    
    async def _search_with_api(self, query: str, limit: int) -> List[Dict]:
        """Search using YouTube Data API v3"""
        try:
            async with httpx.AsyncClient() as client:
                # Search for videos
                search_url = "https://www.googleapis.com/youtube/v3/search"
                search_params = {
                    "part": "snippet",
                    "q": query,
                    "type": "video",
                    "videoCategoryId": "10",  # Music category
                    "maxResults": limit,
                    "key": self.api_key
                }
                
                response = await client.get(search_url, params=search_params, timeout=10)
                
                if response.status_code == 403:
                    try:
                        err = response.json() if response.text else {}
                        errors = err.get("error", {}).get("errors", [])
                        if any(e.get("reason") == "quotaExceeded" for e in errors):
                            logging.warning("YouTube Data API quota exceeded - fallback to oEmbed/_search_basic")
                            return await self._search_basic(query, limit)
                    except Exception:
                        pass
                if response.status_code != 200:
                    logging.error(f"YouTube API error: {response.status_code}")
                    return await self._search_basic(query, limit)
                
                data = response.json()
                video_ids = [item["id"]["videoId"] for item in data.get("items", [])]
                
                if not video_ids:
                    return []
                
                # Get video details for duration and view count
                details_url = "https://www.googleapis.com/youtube/v3/videos"
                details_params = {
                    "part": "contentDetails,statistics,snippet",
                    "id": ",".join(video_ids),
                    "key": self.api_key
                }
                
                details_response = await client.get(details_url, params=details_params, timeout=10)
                if details_response.status_code == 403:
                    try:
                        err = details_response.json() if details_response.text else {}
                        errors = err.get("error", {}).get("errors", [])
                        if any(e.get("reason") == "quotaExceeded" for e in errors):
                            logging.warning("YouTube Data API quota exceeded (details) - fallback to _search_basic")
                            return await self._search_basic(query, limit)
                    except Exception:
                        pass
                details_data = details_response.json() if details_response.status_code == 200 else {"items": []}
                
                # Create lookup map
                details_map = {item["id"]: item for item in details_data.get("items", [])}
                
                results = []
                for item in data.get("items", []):
                    video_id = item["id"]["videoId"]
                    snippet = item.get("snippet", {})
                    details = details_map.get(video_id, {})
                    
                    duration_iso = details.get("contentDetails", {}).get("duration", "PT0S")
                    duration_seconds, duration_formatted = self._format_duration(duration_iso)
                    
                    view_count = int(details.get("statistics", {}).get("viewCount", 0))
                    
                    results.append({
                        "id": video_id,
                        "song_id": video_id,
                        "title": snippet.get("title", "Unknown"),
                        "artist": snippet.get("channelTitle", "Unknown Artist"),
                        "album": "",
                        "duration": duration_seconds,
                        "duration_formatted": duration_formatted,
                        "thumbnail": snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
                        "cover_url": snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
                        "view_count": view_count,
                        "view_count_formatted": self._format_view_count(view_count),
                        "youtube_url": f"https://www.youtube.com/watch?v={video_id}",
                        "embed_url": f"https://www.youtube.com/embed/{video_id}",
                        "source": "YouTube",
                        "playback_type": "embed"  # Indicates IFrame playback
                    })
                
                return results
                
        except Exception as e:
            logging.error(f"YouTube API search error: {e}")
            return await self._search_basic(query, limit)
    
    async def _search_basic(self, query: str, limit: int) -> List[Dict]:
        """
        Basic search without API key
        Uses YouTube's oEmbed and public endpoints
        """
        try:
            async with httpx.AsyncClient() as client:
                # Use YouTube search page (limited but works)
                search_url = f"https://www.youtube.com/results"
                params = {"search_query": query}
                
                response = await client.get(search_url, params=params, timeout=10, follow_redirects=True)
                
                if response.status_code != 200:
                    return []
                
                # Extract video IDs from the page (basic parsing)
                import re
                video_ids = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', response.text)
                video_ids = list(dict.fromkeys(video_ids))[:limit]  # Remove duplicates
                
                results = []
                for video_id in video_ids:
                    # Get metadata via oEmbed (ToS compliant)
                    oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
                    
                    try:
                        oembed_response = await client.get(oembed_url, timeout=5)
                        if oembed_response.status_code == 200:
                            oembed_data = oembed_response.json()
                            
                            results.append({
                                "id": video_id,
                                "song_id": video_id,
                                "title": oembed_data.get("title", "Unknown"),
                                "artist": oembed_data.get("author_name", "Unknown Artist"),
                                "album": "",
                                "duration": 0,
                                "duration_formatted": "0:00",
                                "thumbnail": oembed_data.get("thumbnail_url", ""),
                                "cover_url": oembed_data.get("thumbnail_url", ""),
                                "view_count": 0,
                                "youtube_url": f"https://www.youtube.com/watch?v={video_id}",
                                "embed_url": f"https://www.youtube.com/embed/{video_id}",
                                "source": "YouTube",
                                "playback_type": "embed"
                            })
                    except:
                        continue
                
                return results
                
        except Exception as e:
            logging.error(f"Basic search error: {e}")
            return []
    
    async def get_video_info(self, video_id: str) -> Optional[Dict]:
        """
        Get video information for playback with quota optimization
        
        Strategy:
        1. Check cache first (24 hour TTL)
        2. Use oEmbed API first (zero quota)
        3. Only use Data API v3 if more details needed
        """
        if not video_id:
            return None
        
        cache_key = self._get_cache_key("yt_info_v3", video_id)
        
        # 1. Check cache (24 hour TTL)
        cached_info = await self._get_from_cache(cache_key, INFO_CACHE_HOURS)
        if cached_info:
            return cached_info
        
        logging.info(f"YouTube video info (cache miss): {video_id}")
        
        # 2. Try oEmbed first (ZERO quota usage)
        video_info = await self._get_video_info_oembed(video_id)
        
        # 3. If oEmbed fails and we have API key, use Data API
        if not video_info and self.has_api_key:
            video_info = await self._get_video_info_api(video_id)
        
        # Save to cache
        if video_info:
            await self._save_to_cache(cache_key, video_info)
        
        return video_info
    
    async def _get_video_info_api(self, video_id: str) -> Optional[Dict]:
        """Get video info using Data API v3"""
        try:
            async with httpx.AsyncClient() as client:
                url = "https://www.googleapis.com/youtube/v3/videos"
                params = {
                    "part": "snippet,contentDetails,statistics",
                    "id": video_id,
                    "key": self.api_key
                }
                
                response = await client.get(url, params=params, timeout=10)
                
                if response.status_code == 403:
                    try:
                        err = response.json() if response.text else {}
                        errors = err.get("error", {}).get("errors", [])
                        if any(e.get("reason") == "quotaExceeded" for e in errors):
                            logging.warning("YouTube Data API quota exceeded (get_video_info) - fallback to oEmbed")
                            return await self._get_video_info_oembed(video_id)
                    except Exception:
                        pass
                if response.status_code != 200:
                    return await self._get_video_info_oembed(video_id)
                
                data = response.json()
                items = data.get("items", [])
                
                if not items:
                    return None
                
                item = items[0]
                snippet = item.get("snippet", {})
                content_details = item.get("contentDetails", {})
                statistics = item.get("statistics", {})
                
                duration_seconds, duration_formatted = self._format_duration(
                    content_details.get("duration", "PT0S")
                )
                view_count = int(statistics.get("viewCount", 0))
                
                return {
                    "id": video_id,
                    "song_id": video_id,
                    "title": snippet.get("title", "Unknown"),
                    "artist": snippet.get("channelTitle", "Unknown"),
                    "description": snippet.get("description", "")[:500],
                    "duration": duration_seconds,
                    "duration_formatted": duration_formatted,
                    "thumbnail": snippet.get("thumbnails", {}).get("maxres", snippet.get("thumbnails", {}).get("high", {})).get("url", ""),
                    "cover_url": snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
                    "view_count": view_count,
                    "view_count_formatted": self._format_view_count(view_count),
                    "like_count": int(statistics.get("likeCount", 0)),
                    "youtube_url": f"https://www.youtube.com/watch?v={video_id}",
                    "embed_url": f"https://www.youtube.com/embed/{video_id}",
                    "embed_html": f'<iframe width="100%" height="315" src="https://www.youtube.com/embed/{video_id}" frameborder="0" allowfullscreen></iframe>',
                    "source": "YouTube",
                    "playback_type": "embed",
                    "published_at": snippet.get("publishedAt", ""),
                    "tags": snippet.get("tags", [])[:10]
                }
                
        except Exception as e:
            logging.error(f"API video info error: {e}")
            return await self._get_video_info_oembed(video_id)
    
    async def _get_video_info_oembed(self, video_id: str) -> Optional[Dict]:
        """Get video info using oEmbed (no API key needed)"""
        try:
            async with httpx.AsyncClient() as client:
                url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
                
                response = await client.get(url, timeout=10)
                
                if response.status_code != 200:
                    return None
                
                data = response.json()
                
                return {
                    "id": video_id,
                    "song_id": video_id,
                    "title": data.get("title", "Unknown"),
                    "artist": data.get("author_name", "Unknown"),
                    "duration": 0,
                    "duration_formatted": "0:00",
                    "thumbnail": data.get("thumbnail_url", ""),
                    "cover_url": data.get("thumbnail_url", ""),
                    "view_count": 0,
                    "youtube_url": f"https://www.youtube.com/watch?v={video_id}",
                    "embed_url": f"https://www.youtube.com/embed/{video_id}",
                    "embed_html": data.get("html", ""),
                    "source": "YouTube",
                    "playback_type": "embed"
                }
                
        except Exception as e:
            logging.error(f"oEmbed error: {e}")
            return None
    
    def get_embed_url(self, video_id: str, autoplay: bool = False, start: int = 0) -> str:
        """
        Generate YouTube embed URL for IFrame Player
        This is the ToS-compliant way to play YouTube content
        """
        params = []
        if autoplay:
            params.append("autoplay=1")
        if start > 0:
            params.append(f"start={start}")
        params.append("enablejsapi=1")  # Enable JS API for control
        params.append("origin=" + os.environ.get('FRONTEND_URL', 'https://localhost'))
        
        query = "&".join(params)
        return f"https://www.youtube.com/embed/{video_id}?{query}"
    
    def get_player_config(self, video_id: str) -> Dict:
        """
        Get configuration for YouTube IFrame Player API
        Use this in the mobile app/web to initialize the player
        """
        return {
            "video_id": video_id,
            "player_vars": {
                "autoplay": 0,
                "controls": 1,
                "disablekb": 0,
                "enablejsapi": 1,
                "fs": 1,
                "iv_load_policy": 3,  # Hide video annotations
                "modestbranding": 1,
                "playsinline": 1,
                "rel": 0,  # Don't show related videos
                "showinfo": 0
            },
            "events": {
                "onReady": "onPlayerReady",
                "onStateChange": "onPlayerStateChange",
                "onError": "onPlayerError"
            }
        }


# Singleton instance
youtube_service = YouTubeService()
