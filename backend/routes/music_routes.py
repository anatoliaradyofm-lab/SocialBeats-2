# Music Routes - Search, Streaming, and Library (cache-first via spotify_cached & youtube_service)
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import db
from core.auth import get_current_user

router = APIRouter(tags=["music"])

# ============== SEARCH ==============
@router.get("/music/search/{query}")
async def search_music(
    query: str,
    source: str = Query("youtube", enum=["youtube", "spotify", "all"]),
    limit: int = Query(20, le=50),
    country: str = Query("US", description="Country for Spotify"),
    current_user: dict = Depends(get_current_user)
):
    """Search for music across platforms (cache-first)"""
    results = []

    if source in ["youtube", "all"]:
        yt_results = await search_youtube(query, limit)
        results.extend(yt_results)

    if source in ["spotify", "all"]:
        sp_results = await search_spotify(query, limit, country)
        results.extend(sp_results)

    return {"results": results[:limit], "query": query, "source": source}


async def search_youtube(query: str, limit: int = 20) -> list:
    """Search YouTube (cache-first via youtube_service, key: yt_search:{query})"""
    try:
        from services.youtube_service import youtube_service
        youtube_service.set_db(db)
        res = await youtube_service.search(query, limit=limit)
        return [{
            "id": r.get("id") or r.get("song_id"),
            "title": r.get("title", ""),
            "artist": r.get("artist", ""),
            "thumbnail": r.get("thumbnail") or r.get("cover_url", ""),
            "source": "youtube",
            "youtube_id": r.get("id") or r.get("song_id"),
        } for r in res]
    except Exception as e:
        print(f"YouTube search error: {e}")
    return []


async def search_spotify(query: str, limit: int = 20, country: str = "US") -> list:
    """Search Spotify (cache-first via spotify_cached)"""
    try:
        from services.spotify_cached import set_db, search as spotify_search
        set_db(db)
        tracks = await spotify_search(query, country=country, limit=limit)
        return [{
            "id": t["id"],
            "title": t["title"],
            "artist": t["artist"],
            "album": t.get("album", ""),
            "thumbnail": t.get("thumbnail") or t.get("cover_url", ""),
            "duration_ms": t.get("duration_ms", 0),
            "preview_url": t.get("preview_url"),
            "source": "spotify",
            "spotify_id": t["id"],
        } for t in tracks]
    except Exception as e:
        print(f"Spotify search error: {e}")
    return []

# ============== LIBRARY ==============
@router.get("/library/favorites")
async def get_favorites(current_user: dict = Depends(get_current_user)):
    """Get user's favorite tracks"""
    likes = await db.track_likes.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    tracks = [like.get("track") for like in likes if like.get("track")]
    return tracks

@router.post("/library/tracks/like")
async def like_track(
    track_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Like/unlike a track"""
    track_id = track_data.get("track_id") or track_data.get("id")
    if not track_id:
        raise HTTPException(status_code=400, detail="Track ID required")
    
    existing = await db.track_likes.find_one({
        "user_id": current_user["id"],
        "track_id": track_id
    })
    
    if existing:
        # Unlike
        await db.track_likes.delete_one({"_id": existing["_id"]})
        return {"liked": False, "message": "Track unliked"}
    else:
        # Like
        now = datetime.now(timezone.utc).isoformat()
        await db.track_likes.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "track_id": track_id,
            "track": track_data.get("track") or track_data,
            "created_at": now
        })
        return {"liked": True, "message": "Track liked"}

@router.get("/library/recent")
async def get_recent_tracks(
    days: int = 30,
    limit: int = 100,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get recently played tracks with date filtering"""
    query = {"user_id": current_user["id"]}

    if date_from or date_to:
        date_filter = {}
        if date_from:
            date_filter["$gte"] = date_from
        if date_to:
            date_filter["$lte"] = date_to
        if date_filter:
            query["played_at"] = date_filter
    else:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        query["played_at"] = {"$gte": cutoff}

    history = await db.listening_history.find(
        query, {"_id": 0}
    ).sort("played_at", -1).to_list(limit)

    tracks = []
    for h in history:
        t = h.get("track")
        if t:
            t["played_at"] = h.get("played_at")
            t["listened_duration_ms"] = h.get("listened_duration_ms", 0)
            tracks.append(t)

    return {"tracks": tracks, "total": len(tracks)}

@router.delete("/library/recent")
async def clear_listening_history(current_user: dict = Depends(get_current_user)):
    """Clear all listening history"""
    result = await db.listening_history.delete_many({"user_id": current_user["id"]})
    return {"message": "Geçmiş temizlendi", "deleted": result.deleted_count}

@router.post("/library/history/record")
async def record_listening(data: dict, current_user: dict = Depends(get_current_user)):
    """Record a listening event for stats"""
    now = datetime.now(timezone.utc).isoformat()
    track = data.get("track", data)
    entry = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "track_id": track.get("id") or track.get("track_id", ""),
        "track": {
            "id": track.get("id", ""),
            "title": track.get("title", ""),
            "artist": track.get("artist", ""),
            "album": track.get("album", ""),
            "thumbnail": track.get("thumbnail", ""),
            "duration_ms": track.get("duration_ms", 0),
            "source": track.get("source", ""),
            "genre": track.get("genre", ""),
        },
        "listened_duration_ms": data.get("listened_duration_ms", 0),
        "played_at": now,
    }
    await db.listening_history.insert_one(entry)
    return {"message": "Recorded", "id": entry["id"]}

# ============== LIKED ARTISTS ==============
@router.get("/library/artists")
async def get_liked_artists(current_user: dict = Depends(get_current_user)):
    """Get liked artists"""
    likes = await db.artist_likes.find(
        {"user_id": current_user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    artists = [l.get("artist") for l in likes if l.get("artist")]
    return {"artists": artists, "total": len(artists)}

@router.post("/library/artists/like")
async def like_artist(data: dict, current_user: dict = Depends(get_current_user)):
    """Like/unlike an artist"""
    artist_id = data.get("artist_id") or data.get("id", "")
    if not artist_id:
        raise HTTPException(status_code=400, detail="Artist ID required")

    existing = await db.artist_likes.find_one({
        "user_id": current_user["id"], "artist_id": artist_id
    })

    if existing:
        await db.artist_likes.delete_one({"_id": existing["_id"]})
        return {"liked": False}
    else:
        now = datetime.now(timezone.utc).isoformat()
        await db.artist_likes.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "artist_id": artist_id,
            "artist": {
                "id": artist_id,
                "name": data.get("name", ""),
                "image": data.get("image", ""),
                "genres": data.get("genres", []),
            },
            "created_at": now,
        })
        return {"liked": True}

# ============== LIKED ALBUMS ==============
@router.get("/library/albums")
async def get_liked_albums(current_user: dict = Depends(get_current_user)):
    """Get liked albums"""
    likes = await db.album_likes.find(
        {"user_id": current_user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    albums = [l.get("album") for l in likes if l.get("album")]
    return {"albums": albums, "total": len(albums)}

@router.post("/library/albums/like")
async def like_album(data: dict, current_user: dict = Depends(get_current_user)):
    """Like/unlike an album"""
    album_id = data.get("album_id") or data.get("id", "")
    if not album_id:
        raise HTTPException(status_code=400, detail="Album ID required")

    existing = await db.album_likes.find_one({
        "user_id": current_user["id"], "album_id": album_id
    })

    if existing:
        await db.album_likes.delete_one({"_id": existing["_id"]})
        return {"liked": False}
    else:
        now = datetime.now(timezone.utc).isoformat()
        await db.album_likes.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "album_id": album_id,
            "album": {
                "id": album_id,
                "name": data.get("name", ""),
                "artist": data.get("artist", ""),
                "cover_url": data.get("cover_url", ""),
                "year": data.get("year", ""),
                "track_count": data.get("track_count", 0),
            },
            "created_at": now,
        })
        return {"liked": True}

# ============== LIKED / FOLLOWED PLAYLISTS ==============
@router.get("/library/playlists/liked")
async def get_liked_playlists(current_user: dict = Depends(get_current_user)):
    """Get playlists the user has liked/followed"""
    likes = await db.playlist_likes.find(
        {"user_id": current_user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)

    playlist_ids = [l.get("playlist_id") for l in likes if l.get("playlist_id")]
    playlists = []
    if playlist_ids:
        playlists = await db.playlists.find(
            {"id": {"$in": playlist_ids}}, {"_id": 0}
        ).to_list(200)

    return {"playlists": playlists, "total": len(playlists)}

# ============== SAVED STORIES ==============
@router.get("/library/saved-stories")
async def get_saved_stories(current_user: dict = Depends(get_current_user)):
    """Get saved stories"""
    saves = await db.saved_stories.find(
        {"user_id": current_user["id"]}, {"_id": 0}
    ).sort("saved_at", -1).to_list(100)
    return {"stories": saves, "total": len(saves)}

@router.post("/library/saved-stories")
async def save_story(data: dict, current_user: dict = Depends(get_current_user)):
    """Save/unsave a story"""
    story_id = data.get("story_id", "")
    if not story_id:
        raise HTTPException(status_code=400, detail="Story ID required")

    existing = await db.saved_stories.find_one({
        "user_id": current_user["id"], "story_id": story_id
    })
    if existing:
        await db.saved_stories.delete_one({"_id": existing["_id"]})
        return {"saved": False}
    else:
        now = datetime.now(timezone.utc).isoformat()
        await db.saved_stories.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "story_id": story_id,
            "story": data.get("story", {}),
            "saved_at": now,
        })
        return {"saved": True}

# ============== SAVED PROFILES ==============
@router.get("/library/saved-profiles")
async def get_saved_profiles(current_user: dict = Depends(get_current_user)):
    """Get saved profiles"""
    saves = await db.saved_profiles.find(
        {"user_id": current_user["id"]}, {"_id": 0}
    ).sort("saved_at", -1).to_list(100)
    return {"profiles": saves, "total": len(saves)}

@router.post("/library/saved-profiles")
async def save_profile(data: dict, current_user: dict = Depends(get_current_user)):
    """Save/unsave a profile"""
    profile_id = data.get("profile_id", "")
    if not profile_id:
        raise HTTPException(status_code=400, detail="Profile ID required")

    existing = await db.saved_profiles.find_one({
        "user_id": current_user["id"], "profile_id": profile_id
    })
    if existing:
        await db.saved_profiles.delete_one({"_id": existing["_id"]})
        return {"saved": False}
    else:
        now = datetime.now(timezone.utc).isoformat()
        await db.saved_profiles.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "profile_id": profile_id,
            "profile": data.get("profile", {}),
            "saved_at": now,
        })
        return {"saved": True}

# ============== LISTENING STATS ==============
@router.get("/library/listening-stats")
async def get_listening_stats(
    period: str = "month",
    current_user: dict = Depends(get_current_user)
):
    """Get comprehensive listening statistics"""
    now = datetime.now(timezone.utc)
    if period == "week":
        cutoff = (now - timedelta(days=7)).isoformat()
    elif period == "year":
        cutoff = (now - timedelta(days=365)).isoformat()
    else:
        cutoff = (now - timedelta(days=30)).isoformat()

    history = await db.listening_history.find(
        {"user_id": current_user["id"], "played_at": {"$gte": cutoff}},
        {"_id": 0}
    ).to_list(5000)

    total_ms = sum(h.get("listened_duration_ms", 0) for h in history)
    total_minutes = total_ms // 60000 if total_ms else len(history) * 3
    total_tracks = len(history)

    artist_counts = {}
    genre_counts = {}
    daily_counts = {}
    for h in history:
        t = h.get("track", {})
        artist = t.get("artist", "Bilinmeyen")
        if artist:
            artist_counts[artist] = artist_counts.get(artist, 0) + 1
        genre = t.get("genre", "")
        if genre:
            genre_counts[genre] = genre_counts.get(genre, 0) + 1
        played = h.get("played_at", "")[:10]
        if played:
            daily_counts[played] = daily_counts.get(played, 0) + 1

    top_artists = sorted(artist_counts.items(), key=lambda x: x[1], reverse=True)
    top_genres = sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)
    unique_artists = len(artist_counts)
    unique_genres = len(genre_counts)

    day_labels = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]
    dow_counts = [0] * 7
    for h in history:
        played = h.get("played_at", "")
        if played:
            try:
                dt = datetime.fromisoformat(played.replace("Z", "+00:00"))
                dow_counts[dt.weekday()] += 1
            except Exception:
                pass
    daily_data = [{"label": day_labels[i], "value": dow_counts[i]} for i in range(7)]

    top_artist_name = top_artists[0][0] if top_artists else None
    top_genre_name = top_genres[0][0] if top_genres else None

    likes_count = await db.track_likes.count_documents({"user_id": current_user["id"]})

    return {
        "stats": {
            "total_listening_minutes": total_minutes,
            "total_tracks": total_tracks,
            "unique_artists": unique_artists,
            "unique_genres": unique_genres,
            "total_likes": likes_count,
            "top_artist": top_artist_name,
            "top_genre": top_genre_name,
            "top_artists": [{"name": a[0], "count": a[1]} for a in top_artists[:10]],
            "top_genres": [
                {"name": g[0], "percentage": round(g[1] / max(total_tracks, 1) * 100)}
                for g in top_genres[:10]
            ],
            "daily_data": daily_data,
        }
    }

@router.get("/library/listening-stats/monthly")
async def get_monthly_report(
    year: Optional[int] = None,
    month: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get monthly listening report with daily breakdown"""
    now = datetime.now(timezone.utc)
    y = year or now.year
    m = month or now.month

    start = datetime(y, m, 1, tzinfo=timezone.utc)
    if m == 12:
        end = datetime(y + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(y, m + 1, 1, tzinfo=timezone.utc)

    history = await db.listening_history.find(
        {
            "user_id": current_user["id"],
            "played_at": {"$gte": start.isoformat(), "$lt": end.isoformat()},
        },
        {"_id": 0},
    ).to_list(5000)

    days_in_month = (end - start).days
    daily_minutes = [0] * days_in_month
    daily_tracks = [0] * days_in_month
    artist_counts = {}

    for h in history:
        dur = h.get("listened_duration_ms", 0)
        played = h.get("played_at", "")
        try:
            dt = datetime.fromisoformat(played.replace("Z", "+00:00"))
            day_idx = dt.day - 1
            if 0 <= day_idx < days_in_month:
                daily_minutes[day_idx] += dur // 60000 if dur else 3
                daily_tracks[day_idx] += 1
        except Exception:
            pass
        t = h.get("track", {})
        artist = t.get("artist", "")
        if artist:
            artist_counts[artist] = artist_counts.get(artist, 0) + 1

    total_ms = sum(h.get("listened_duration_ms", 0) for h in history)
    total_minutes = total_ms // 60000 if total_ms else len(history) * 3

    top_artists = sorted(artist_counts.items(), key=lambda x: x[1], reverse=True)

    return {
        "year": y,
        "month": m,
        "total_tracks": len(history),
        "total_minutes": total_minutes,
        "daily_data": [
            {"day": i + 1, "minutes": daily_minutes[i], "tracks": daily_tracks[i]}
            for i in range(days_in_month)
        ],
        "top_artists": [{"name": a[0], "count": a[1]} for a in top_artists[:5]],
    }

@router.get("/library/listening-stats/weekly-summary")
async def get_weekly_summary(current_user: dict = Depends(get_current_user)):
    """Get weekly listening summary for notification"""
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()

    history = await db.listening_history.find(
        {"user_id": current_user["id"], "played_at": {"$gte": week_ago}},
        {"_id": 0},
    ).to_list(2000)

    total_ms = sum(h.get("listened_duration_ms", 0) for h in history)
    total_minutes = total_ms // 60000 if total_ms else len(history) * 3

    artist_counts = {}
    for h in history:
        a = h.get("track", {}).get("artist", "")
        if a:
            artist_counts[a] = artist_counts.get(a, 0) + 1
    top_artists = sorted(artist_counts.items(), key=lambda x: x[1], reverse=True)

    prev_week_start = (now - timedelta(days=14)).isoformat()
    prev_history = await db.listening_history.find(
        {"user_id": current_user["id"], "played_at": {"$gte": prev_week_start, "$lt": week_ago}},
        {"_id": 0},
    ).to_list(2000)
    prev_ms = sum(h.get("listened_duration_ms", 0) for h in prev_history)
    prev_minutes = prev_ms // 60000 if prev_ms else len(prev_history) * 3

    change = total_minutes - prev_minutes

    return {
        "total_tracks": len(history),
        "total_minutes": total_minutes,
        "change_from_last_week": change,
        "top_artist": top_artists[0][0] if top_artists else None,
        "top_artists": [{"name": a[0], "count": a[1]} for a in top_artists[:3]],
    }

# ============== PLAYLISTS ==============
@router.get("/playlists")
async def get_playlists(current_user: dict = Depends(get_current_user)):
    """Get user's playlists"""
    playlists = await db.playlists.find(
        {"$or": [
            {"owner_id": current_user["id"]},  # server.py uses owner_id
            {"user_id": current_user["id"]},   # backward compatibility
            {"collaborators": current_user["id"]}
        ]},
        {"_id": 0}
    ).to_list(100)
    
    return playlists

@router.post("/playlists")
async def create_playlist(
    playlist_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Create a new playlist"""
    playlist_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    playlist = {
        "id": playlist_id,
        "name": playlist_data.get("name", "Yeni Playlist"),
        "description": playlist_data.get("description", ""),
        "cover_url": playlist_data.get("cover_url", f"https://picsum.photos/seed/{playlist_id}/300"),
        "owner_id": current_user["id"],  # Use owner_id for consistency with server.py
        "tracks": [],
        "track_count": 0,
        "is_public": playlist_data.get("is_public", True),
        "collaborators": [],
        "created_at": now,
        "updated_at": now
    }
    
    await db.playlists.insert_one(playlist)
    
    return {k: v for k, v in playlist.items() if k != "_id"}

@router.get("/playlists/{playlist_id}")
async def get_playlist(
    playlist_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get playlist details"""
    playlist = await db.playlists.find_one({"id": playlist_id}, {"_id": 0})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    return playlist

@router.post("/playlists/{playlist_id}/tracks")
async def add_track_to_playlist(
    playlist_id: str,
    track_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Add a track to playlist"""
    playlist = await db.playlists.find_one({"id": playlist_id})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    # Check permission - support both owner_id and user_id for backward compatibility
    owner_id = playlist.get("owner_id") or playlist.get("user_id")
    if owner_id != current_user["id"] and current_user["id"] not in playlist.get("collaborators", []):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    track = {
        "id": track_data.get("id") or str(uuid.uuid4()),
        "title": track_data.get("title", "Unknown"),
        "artist": track_data.get("artist", "Unknown"),
        "album": track_data.get("album", "Unknown Album"),  # Required by Playlist model
        "duration": track_data.get("duration", track_data.get("duration_ms", 0)),  # Required by Playlist model
        "cover_url": track_data.get("cover_url", track_data.get("thumbnail", "")),  # Required by Playlist model
        "thumbnail": track_data.get("thumbnail", ""),
        "duration_ms": track_data.get("duration_ms", 0),
        "source": track_data.get("source", "youtube"),
        "added_at": datetime.now(timezone.utc).isoformat(),
        "added_by": current_user["id"]
    }
    
    await db.playlists.update_one(
        {"id": playlist_id},
        {
            "$push": {"tracks": track},
            "$inc": {"track_count": 1},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"message": "Track added", "track": track}

@router.delete("/playlists/{playlist_id}")
async def delete_playlist(
    playlist_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a playlist"""
    playlist = await db.playlists.find_one({"id": playlist_id})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    # Support both owner_id and user_id for backward compatibility
    owner_id = playlist.get("owner_id") or playlist.get("user_id")
    if owner_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.playlists.delete_one({"id": playlist_id})
    
    return {"message": "Playlist deleted"}


# ============== SONGS ENDPOINTS (Dashboard) ==============

FALLBACK_SONGS = [
    {"id": "s1", "title": "Yıldızların Altında", "artist": "Tarkan", "thumbnail": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300", "source": "spotify", "duration_ms": 240000},
    {"id": "s2", "title": "Sen Olsan Bari", "artist": "Aleyna Tilki", "thumbnail": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300", "source": "youtube", "duration_ms": 210000},
    {"id": "s3", "title": "Dön Desem", "artist": "Semicenk", "thumbnail": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300", "source": "spotify", "duration_ms": 195000},
    {"id": "s4", "title": "Fikrimin İnce Gülü", "artist": "Barış Manço", "thumbnail": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300", "source": "youtube", "duration_ms": 260000},
    {"id": "s5", "title": "İmkansızım", "artist": "Mabel Matiz", "thumbnail": "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300", "source": "spotify", "duration_ms": 225000},
    {"id": "s6", "title": "Gel", "artist": "Manga", "thumbnail": "https://images.unsplash.com/photo-1504898770365-14faca6a7320?w=300", "source": "youtube", "duration_ms": 200000},
    {"id": "s7", "title": "Sevme Zamanı", "artist": "Sezen Aksu", "thumbnail": "https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=300", "source": "spotify", "duration_ms": 280000},
    {"id": "s8", "title": "Senden Daha Güzel", "artist": "Duman", "thumbnail": "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300", "source": "youtube", "duration_ms": 235000},
    {"id": "s9", "title": "Ela", "artist": "Reynmen", "thumbnail": "https://images.unsplash.com/photo-1446057032654-9d8885db76c6?w=300", "source": "spotify", "duration_ms": 190000},
    {"id": "s10", "title": "Vazgeçtim", "artist": "Sertab Erener", "thumbnail": "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=300", "source": "spotify", "duration_ms": 245000},
]


async def _get_cached_songs(cache_key: str, limit: int) -> list:
    try:
        from services.music_cache import get_cached, set_db
        set_db(db)
        cached = await get_cached(cache_key)
        if cached and isinstance(cached, list):
            return cached[:limit]
    except Exception:
        pass
    return []


@router.get("/songs/trending")
async def get_trending_songs(
    limit: int = Query(10, le=50),
    current_user: dict = Depends(get_current_user)
):
    songs = await _get_cached_songs("spotify:trending:TR", limit)
    if not songs:
        songs = await _get_cached_songs("youtube:trending", limit)
    if not songs:
        liked = await db.track_likes.find({}).sort("created_at", -1).limit(limit).to_list(limit)
        if liked:
            songs = [{"id": l.get("track_id", ""), "title": l.get("title", ""), "artist": l.get("artist", ""),
                       "thumbnail": l.get("thumbnail", ""), "source": l.get("source", "spotify")} for l in liked]
    if not songs:
        songs = FALLBACK_SONGS[:limit]
    return {"songs": songs[:limit]}


@router.get("/songs/new-releases")
async def get_new_releases(
    limit: int = Query(10, le=50),
    current_user: dict = Depends(get_current_user)
):
    songs = await _get_cached_songs("spotify:new_releases", limit)
    if not songs:
        try:
            from services.spotify_cached import set_db as sp_set_db, get_new_releases as sp_new_releases
            sp_set_db(db)
            songs = await sp_new_releases(limit=limit)
        except Exception:
            pass
    if not songs:
        songs = FALLBACK_SONGS[3:3+limit]
    return {"songs": songs[:limit]}


@router.get("/songs/for-you")
async def get_for_you_songs(
    limit: int = Query(10, le=50),
    current_user: dict = Depends(get_current_user)
):
    user_likes = await db.track_likes.find(
        {"user_id": current_user["id"]}
    ).sort("created_at", -1).limit(5).to_list(5)

    genres = set()
    artists = set()
    for lk in user_likes:
        if lk.get("genre"):
            genres.add(lk["genre"])
        if lk.get("artist"):
            artists.add(lk["artist"])

    songs = []
    if artists:
        for artist in list(artists)[:3]:
            cached = await _get_cached_songs(f"spotify:artist:{artist}", limit)
            songs.extend(cached)
    if not songs:
        songs = await _get_cached_songs("spotify:trending:TR", limit)
    if not songs:
        history = await db.listening_history.find(
            {"user_id": current_user["id"]}
        ).sort("played_at", -1).limit(limit).to_list(limit)
        if history:
            songs = [{"id": h.get("track_id", ""), "title": h.get("title", ""), "artist": h.get("artist", ""),
                       "thumbnail": h.get("thumbnail", ""), "source": h.get("source", "spotify")} for h in history]
    if not songs:
        songs = FALLBACK_SONGS[1:1+limit]
    return {"songs": songs[:limit]}


@router.get("/songs/charts")
async def get_charts(
    limit: int = Query(10, le=50),
    country: str = Query("TR"),
    current_user: dict = Depends(get_current_user)
):
    songs = await _get_cached_songs(f"spotify:charts:{country}", limit)
    if not songs:
        songs = await _get_cached_songs(f"spotify:trending:{country}", limit)
    if not songs:
        top_liked = await db.track_likes.aggregate([
            {"$group": {"_id": "$track_id", "count": {"$sum": 1},
                        "title": {"$first": "$title"}, "artist": {"$first": "$artist"},
                        "thumbnail": {"$first": "$thumbnail"}, "source": {"$first": "$source"}}},
            {"$sort": {"count": -1}},
            {"$limit": limit}
        ]).to_list(limit)
        if top_liked:
            songs = [{"id": t["_id"], "title": t.get("title", ""), "artist": t.get("artist", ""),
                       "thumbnail": t.get("thumbnail", ""), "source": t.get("source", "spotify"),
                       "likes_count": t["count"]} for t in top_liked]
    if not songs:
        songs = FALLBACK_SONGS[2:2+limit]
    return {"songs": songs[:limit]}


# ============== REELS FEED ==============

@router.get("/reels/feed")
async def get_reels_feed(
    limit: int = Query(20, le=50),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    pipeline = [
        {"$match": {"content_type": {"$in": ["video", "reel", "music_video"]}, "deleted": {"$ne": True}}},
        {"$sort": {"created_at": -1}},
        {"$skip": offset},
        {"$limit": limit},
    ]
    reels = await db.posts.aggregate(pipeline).to_list(limit)

    for reel in reels:
        reel.pop("_id", None)
        user = await db.users.find_one(
            {"id": reel.get("user_id")},
            {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1, "is_verified": 1}
        )
        if user:
            reel["user"] = user
        reel["likes_count"] = reel.get("likes_count", 0)
        reel["comments_count"] = reel.get("comments_count", 0)
        if not reel.get("media_url") and reel.get("media_urls"):
            reel["media_url"] = reel["media_urls"][0]

    if not reels:
        recent_posts = await db.posts.find(
            {
                "deleted": {"$ne": True},
                "$or": [
                    {"media_urls.0": {"$exists": True}},
                    {"media_url": {"$exists": True, "$nin": [None, "", []]}}
                ]
            }, {"_id": 0}
        ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
        
        for p in recent_posts:
            user = await db.users.find_one(
                {"id": p.get("user_id")},
                {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1, "is_verified": 1}
            )
            if user:
                p["user"] = user
            if not p.get("media_url") and p.get("media_urls"):
                p["media_url"] = p["media_urls"][0]
        reels = recent_posts

    return {"reels": reels, "count": len(reels), "offset": offset}



# ============== LISTENING HISTORY (secondary tracking) ==============

@router.post("/listening-history")
async def record_listening_history(
    body: dict,
    current_user: dict = Depends(get_current_user)
):
    song_id = body.get("song_id", "")
    if not song_id:
        return {"ok": True}

    record = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "track_id": song_id,
        "title": body.get("title", ""),
        "artist": body.get("artist", ""),
        "thumbnail": body.get("thumbnail", ""),
        "source": body.get("source", ""),
        "played_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.listening_history.insert_one(record)
    return {"ok": True}
