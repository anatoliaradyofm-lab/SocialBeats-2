# Karaoke Routes
from fastapi import APIRouter, Depends, HTTPException
import httpx
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.auth import get_current_user

router = APIRouter(prefix="/karaoke", tags=["karaoke"])

@router.get("/lyrics/{track_id}")
async def get_karaoke_lyrics(
    track_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get lyrics for karaoke mode"""
    # Try to fetch synced lyrics from external service
    try:
        # Use LRCLIB - free lyrics API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://lrclib.net/api/get",
                params={"track_id": track_id},
                timeout=10.0
            )
            if response.status_code == 200:
                data = response.json()
                return {
                    "lyrics": parse_lrc(data.get("syncedLyrics") or data.get("plainLyrics")),
                    "synced": data.get("syncedLyrics") is not None,
                    "source": "lrclib"
                }
    except Exception as e:
        print(f"LRCLIB error: {e}")
    
    # Return mock lyrics if external service fails
    return {
        "lyrics": [
            {"time": 0, "text": "♪ Şarkı sözleri yükleniyor... ♪"},
            {"time": 5000, "text": "Bu şarkı için sözler henüz mevcut değil"},
            {"time": 10000, "text": "Karaoke modunu etkinleştirip keyfinize bakın!"},
        ],
        "synced": False,
        "source": "mock"
    }

@router.get("/search")
async def search_lyrics(
    track: str,
    artist: str,
    current_user: dict = Depends(get_current_user)
):
    """Search for lyrics by track and artist name"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://lrclib.net/api/search",
                params={"track_name": track, "artist_name": artist},
                timeout=10.0
            )
            if response.status_code == 200:
                results = response.json()
                if results:
                    best_match = results[0]
                    return {
                        "lyrics": parse_lrc(best_match.get("syncedLyrics") or best_match.get("plainLyrics")),
                        "synced": best_match.get("syncedLyrics") is not None,
                        "track_name": best_match.get("trackName"),
                        "artist_name": best_match.get("artistName"),
                        "source": "lrclib"
                    }
    except Exception as e:
        print(f"Lyrics search error: {e}")
    
    return {
        "lyrics": None,
        "synced": False,
        "message": "Şarkı sözleri bulunamadı"
    }

def parse_lrc(lrc_content: str) -> list:
    """Parse LRC format to list of {time, text}"""
    if not lrc_content:
        return []
    
    lyrics = []
    lines = lrc_content.split('\n')
    
    for line in lines:
        # Match [mm:ss.xx] format
        import re
        match = re.match(r'\[(\d{2}):(\d{2})\.?(\d{0,2})\](.*)', line)
        if match:
            minutes = int(match.group(1))
            seconds = int(match.group(2))
            centiseconds = int(match.group(3)) if match.group(3) else 0
            text = match.group(4).strip()
            
            if text:
                time_ms = (minutes * 60 + seconds) * 1000 + centiseconds * 10
                lyrics.append({"time": time_ms, "text": text})
    
    return sorted(lyrics, key=lambda x: x["time"])
