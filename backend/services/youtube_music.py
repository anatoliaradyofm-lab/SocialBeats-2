# YouTube Music Service - yt-dlp + ytmusicapi Integration
# Self-hosted music streaming with server-side caching

import yt_dlp
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from concurrent.futures import ThreadPoolExecutor

# Thread pool for running sync yt-dlp operations
executor = ThreadPoolExecutor(max_workers=3)

# yt-dlp configuration
YDL_OPTIONS = {
    'format': 'bestaudio/best',
    'noplaylist': True,
    'quiet': True,
    'no_warnings': True,
    'extract_flat': False,
    'skip_download': True,
    'ignoreerrors': True,
    'nocheckcertificate': True,
}

# Search options for YouTube
YDL_SEARCH_OPTIONS = {
    **YDL_OPTIONS,
    'default_search': 'ytsearch5',  # Search YouTube, return 5 results
    'extract_flat': True,
}

class YouTubeMusicService:
    """YouTube Music streaming service using yt-dlp"""
    
    def __init__(self, db=None):
        self.db = db
        self.cache_expiry_hours = 6  # Audio URLs expire quickly
        
    def set_db(self, database):
        """Set database reference for caching"""
        self.db = database
    
    def _format_duration(self, seconds: int) -> str:
        """Format duration from seconds to MM:SS"""
        if not seconds or not isinstance(seconds, (int, float)):
            return "0:00"
        seconds = int(seconds)
        mins = seconds // 60
        secs = seconds % 60
        return f"{mins}:{secs:02d}"
    
    def _extract_info_sync(self, url_or_query: str, search: bool = False) -> Optional[Dict]:
        """Synchronous extraction using yt-dlp"""
        try:
            options = YDL_SEARCH_OPTIONS if search else YDL_OPTIONS
            with yt_dlp.YoutubeDL(options) as ydl:
                info = ydl.extract_info(url_or_query, download=False)
                return info
        except Exception as e:
            logging.error(f"yt-dlp extraction error: {e}")
            return None
    
    async def _extract_info(self, url_or_query: str, search: bool = False) -> Optional[Dict]:
        """Async wrapper for yt-dlp extraction"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            executor, 
            self._extract_info_sync, 
            url_or_query, 
            search
        )
    
    def _format_track(self, entry: Dict, video_id: str = None) -> Dict:
        """Format a single track from yt-dlp result"""
        vid = video_id or entry.get('id', '')
        return {
            'id': vid,
            'song_id': vid,
            'title': entry.get('title', 'Unknown'),
            'artist': entry.get('uploader', entry.get('channel', 'Unknown Artist')),
            'album': entry.get('album', ''),
            'duration': entry.get('duration', 0),
            'duration_formatted': self._format_duration(entry.get('duration', 0)),
            'thumbnail': entry.get('thumbnail', ''),
            'cover_url': entry.get('thumbnail', ''),
            'view_count': entry.get('view_count', 0),
            'youtube_url': f"https://www.youtube.com/watch?v={vid}" if vid else '',
            'source': 'YouTube',
        }
    
    async def search(self, query: str, limit: int = 10) -> List[Dict]:
        """
        Search for songs on YouTube
        Returns list of tracks with metadata
        """
        if not query or len(query.strip()) < 2:
            return []
        
        query = query.strip()
        cache_key = f"yt_search_{query.lower()}"
        
        # Check cache first
        if self.db:
            try:
                cache = self.db.music_cache
                cached = await cache.find_one({"cache_key": cache_key})
                if cached and cached.get("results"):
                    logging.info(f"YouTube search cache HIT: {query}")
                    return cached["results"]
            except Exception as e:
                logging.error(f"Cache read error: {e}")
        
        logging.info(f"YouTube search cache MISS: {query}, fetching from YouTube")
        
        # Search YouTube
        search_query = f"ytsearch{limit}:{query}"
        info = await self._extract_info(search_query, search=True)
        
        if not info:
            return []
        
        results = []
        entries = info.get('entries', [])
        
        for entry in entries:
            if entry and entry.get('id'):
                track = self._format_track(entry)
                results.append(track)
        
        # Cache results
        if self.db and results:
            try:
                cache = self.db.music_cache
                await cache.update_one(
                    {"cache_key": cache_key},
                    {
                        "$set": {
                            "cache_key": cache_key,
                            "query": query,
                            "results": results,
                            "cached_at": datetime.now(timezone.utc)
                        }
                    },
                    upsert=True
                )
            except Exception as e:
                logging.error(f"Cache write error: {e}")
        
        return results
    
    async def get_stream_url(self, video_id: str) -> Optional[Dict]:
        """
        Get audio stream URL for a video
        Returns dict with stream_url and metadata
        """
        if not video_id:
            return None
        
        cache_key = f"yt_stream_{video_id}"
        
        # Check cache first (shorter expiry for stream URLs)
        if self.db:
            try:
                cache = self.db.music_cache
                cached = await cache.find_one({"cache_key": cache_key})
                if cached and cached.get("stream_url"):
                    # Check if not expired (6 hours for stream URLs)
                    cached_at = cached.get("cached_at")
                    if cached_at:
                        age_hours = (datetime.now(timezone.utc) - cached_at).total_seconds() / 3600
                        if age_hours < self.cache_expiry_hours:
                            logging.info(f"YouTube stream cache HIT: {video_id}")
                            return {
                                "song_id": video_id,
                                "stream_url": cached["stream_url"],
                                "title": cached.get("title", ""),
                                "artist": cached.get("artist", ""),
                                "thumbnail": cached.get("thumbnail", ""),
                                "duration": cached.get("duration", 0),
                                "cached": True
                            }
            except Exception as e:
                logging.error(f"Cache read error: {e}")
        
        logging.info(f"YouTube stream cache MISS: {video_id}, extracting from YouTube")
        
        # Extract stream URL
        url = f"https://www.youtube.com/watch?v={video_id}"
        info = await self._extract_info(url, search=False)
        
        if not info:
            return None
        
        # Get best audio URL
        stream_url = None
        
        # Try to get direct URL
        if info.get('url'):
            stream_url = info['url']
        elif info.get('formats'):
            # Find best audio format
            audio_formats = [f for f in info['formats'] if f.get('acodec') != 'none' and f.get('vcodec') == 'none']
            if audio_formats:
                # Sort by quality
                audio_formats.sort(key=lambda x: x.get('abr', 0) or 0, reverse=True)
                stream_url = audio_formats[0].get('url')
            else:
                # Fallback to any format with audio
                for fmt in info['formats']:
                    if fmt.get('url') and fmt.get('acodec') != 'none':
                        stream_url = fmt['url']
                        break
        
        if not stream_url:
            return None
        
        result = {
            "song_id": video_id,
            "stream_url": stream_url,
            "title": info.get('title', 'Unknown'),
            "artist": info.get('uploader', info.get('channel', 'Unknown')),
            "thumbnail": info.get('thumbnail', ''),
            "duration": info.get('duration', 0),
            "duration_formatted": self._format_duration(info.get('duration', 0)),
            "cached": False
        }
        
        # Cache the result
        if self.db:
            try:
                cache = self.db.music_cache
                await cache.update_one(
                    {"cache_key": cache_key},
                    {
                        "$set": {
                            "cache_key": cache_key,
                            "song_id": video_id,
                            **result,
                            "cached_at": datetime.now(timezone.utc)
                        }
                    },
                    upsert=True
                )
            except Exception as e:
                logging.error(f"Cache write error: {e}")
        
        return result
    
    async def get_song_details(self, video_id: str) -> Optional[Dict]:
        """
        Get full song details without stream URL
        Faster than get_stream_url as it uses flat extraction
        """
        if not video_id:
            return None
        
        cache_key = f"yt_details_{video_id}"
        
        # Check cache
        if self.db:
            try:
                cache = self.db.music_cache
                cached = await cache.find_one({"cache_key": cache_key})
                if cached and cached.get("song"):
                    logging.info(f"YouTube details cache HIT: {video_id}")
                    return cached["song"]
            except Exception as e:
                logging.error(f"Cache read error: {e}")
        
        logging.info(f"YouTube details cache MISS: {video_id}")
        
        # Extract info
        url = f"https://www.youtube.com/watch?v={video_id}"
        
        # Use flat extraction for speed
        try:
            loop = asyncio.get_event_loop()
            
            def extract_flat():
                with yt_dlp.YoutubeDL({**YDL_OPTIONS, 'extract_flat': True}) as ydl:
                    return ydl.extract_info(url, download=False)
            
            info = await loop.run_in_executor(executor, extract_flat)
        except Exception as e:
            logging.error(f"Details extraction error: {e}")
            return None
        
        if not info:
            return None
        
        song = self._format_track(info, video_id)
        
        # Cache
        if self.db:
            try:
                cache = self.db.music_cache
                await cache.update_one(
                    {"cache_key": cache_key},
                    {
                        "$set": {
                            "cache_key": cache_key,
                            "song_id": video_id,
                            "song": song,
                            "cached_at": datetime.now(timezone.utc)
                        }
                    },
                    upsert=True
                )
            except Exception as e:
                logging.error(f"Cache write error: {e}")
        
        return song


# Singleton instance
youtube_music_service = YouTubeMusicService()
