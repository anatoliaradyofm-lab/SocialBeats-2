# Playlist Routes
# Modular playlist management endpoints
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, date
import uuid
import aiofiles
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import db
from core.auth import get_current_user

router = APIRouter(prefix="/playlists", tags=["playlists"])

# Upload directory
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(ROOT_DIR, "uploads")

# =====================================================
# MODELLER
# =====================================================

class PlaylistCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: bool = True
    is_collaborative: bool = False

class Track(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    artist: str
    album: str = ""
    duration: int = 0
    cover_url: str = ""
    source: str = "soundcloud"
    preview_url: Optional[str] = None
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    is_liked: bool = False

class Playlist(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    description: Optional[str] = None
    cover_url: str = ""
    track_count: int = 0
    owner_id: str
    is_public: bool = True
    created_at: str
    tracks: List[Track] = []
    likes_count: int = 0
    is_collaborative: bool = False

# Mock tracks for demo
MOCK_TRACKS = [
    {"id": "t1", "title": "Yıldızların Altında", "artist": "Tarkan", "album": "Metamorfoz", "duration": 245, "cover_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300", "source": "soundcloud", "likes_count": 15420, "comments_count": 234, "shares_count": 567},
    {"id": "t2", "title": "Sen Olsan Bari", "artist": "Aleyna Tilki", "album": "Singles", "duration": 198, "cover_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300", "source": "soundcloud", "likes_count": 12300, "comments_count": 189, "shares_count": 423},
    {"id": "t3", "title": "Firuze", "artist": "Sezen Aksu", "album": "Firuze", "duration": 312, "cover_url": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300", "source": "soundcloud", "likes_count": 28900, "comments_count": 567, "shares_count": 890},
]

# =====================================================
# HELPER FUNCTIONS
# =====================================================

async def send_push_notification(user_id: str, title: str, body: str, notification_type: str, data: dict = None):
    """Send push notification to user"""
    now = datetime.now(timezone.utc).isoformat()
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": notification_type,
        "title": title,
        "body": body,
        "data": data or {},
        "is_read": False,
        "created_at": now
    }
    await db.notifications.insert_one(notification)
    return notification

# =====================================================
# ENDPOINTS
# =====================================================

@router.get("", response_model=List[Playlist])
async def get_playlists(current_user: dict = Depends(get_current_user)):
    """Get user's playlists"""
    playlists = await db.playlists.find(
        {"owner_id": current_user["id"]}, {"_id": 0}
    ).to_list(100)
    
    if not playlists:
        return [
            {"id": "pl1", "name": "Türkçe Pop Hits", "description": "En sevilen Türkçe pop şarkıları", "cover_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300", "track_count": 25, "owner_id": current_user["id"], "is_public": True, "created_at": datetime.now(timezone.utc).isoformat(), "tracks": [], "likes_count": 145, "is_collaborative": False},
            {"id": "pl2", "name": "Rock Klasikleri", "description": "Türk rock'ının en iyileri", "cover_url": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300", "track_count": 18, "owner_id": current_user["id"], "is_public": True, "created_at": datetime.now(timezone.utc).isoformat(), "tracks": [], "likes_count": 89, "is_collaborative": False},
            {"id": "pl3", "name": "Chill Vibes", "description": "Rahatlatıcı müzikler", "cover_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300", "track_count": 32, "owner_id": current_user["id"], "is_public": False, "created_at": datetime.now(timezone.utc).isoformat(), "tracks": [], "likes_count": 67, "is_collaborative": True},
        ]
    return playlists

@router.post("", response_model=Playlist)
async def create_playlist(playlist_data: PlaylistCreate, current_user: dict = Depends(get_current_user)):
    """Create a new playlist"""
    playlist_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    playlist = {
        "id": playlist_id,
        "name": playlist_data.name,
        "description": playlist_data.description,
        "cover_url": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300",
        "track_count": 0,
        "owner_id": current_user["id"],
        "is_public": playlist_data.is_public,
        "is_collaborative": playlist_data.is_collaborative,
        "created_at": now,
        "tracks": [],
        "likes_count": 0
    }
    
    await db.playlists.insert_one(playlist)
    playlist.pop("_id", None)
    return playlist

# NOTE: These endpoints MUST be defined BEFORE /{playlist_id} to avoid route conflict
@router.get("/collaborative")
async def get_my_collaborative_playlists(current_user: dict = Depends(get_current_user)):
    """Get playlists where current user is a collaborator"""
    playlists = await db.playlists.find(
        {
            "$or": [
                {"owner_id": current_user["id"], "is_collaborative": True},
                {"collaborators.user_id": current_user["id"]}
            ]
        },
        {"_id": 0}
    ).to_list(100)
    
    for playlist in playlists:
        owner = await db.users.find_one(
            {"id": playlist.get("owner_id")},
            {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
        )
        if owner:
            playlist["owner"] = owner
        playlist["is_owner"] = playlist.get("owner_id") == current_user["id"]
    
    return {"playlists": playlists, "total": len(playlists)}

@router.get("/smart-types")
async def get_smart_playlist_types(current_user: dict = Depends(get_current_user)):
    """Get available smart playlist types"""
    return {
        "playlists": [
            {"type": "discover_weekly", "name": "Keşfet Haftalık", "description": "Sana özel yeni keşifler", "icon": "sparkles", "color": "#8B5CF6"},
            {"type": "repeat_rewind", "name": "Repeat Rewind", "description": "En çok dinlediğin şarkılar", "icon": "refresh", "color": "#10B981"},
            {"type": "chill_mix", "name": "Chill Mix", "description": "Rahatlatıcı melodiler", "icon": "moon", "color": "#6366F1"},
            {"type": "workout_mix", "name": "Workout Mix", "description": "Spor için enerjik şarkılar", "icon": "fitness", "color": "#EF4444"},
            {"type": "focus_mix", "name": "Focus Mix", "description": "Odaklanmana yardımcı melodiler", "icon": "bulb", "color": "#F59E0B"}
        ]
    }

@router.get("/seasonal-suggestions")
async def get_seasonal_playlist_suggestions(current_user: dict = Depends(get_current_user)):
    """Get seasonal playlist recommendations"""
    month = date.today().month
    
    if month in [3, 4, 5]:
        season = "spring"
        playlists = [
            {"name": "🌸 Bahar Temizliği", "description": "Enerjik ve fresh şarkılarla bahara merhaba", "mood": "energetic"},
            {"name": "🌼 Çiçek Açan Melodiler", "description": "Rahatlatıcı akustik şarkılar", "mood": "calm"},
            {"name": "☕ Bahar Sabahları", "description": "Kahve eşliğinde dinlenecek şarkılar", "mood": "chill"},
        ]
    elif month in [6, 7, 8]:
        season = "summer"
        playlists = [
            {"name": "🏖️ Yaz Partisi", "description": "Havaya girmelik enerjik parçalar", "mood": "party"},
            {"name": "🌊 Plaj Keyfi", "description": "Reggae ve chill vibes", "mood": "chill"},
            {"name": "🚗 Yolculuk Mix", "description": "Uzun yola çıkarken dinlenecekler", "mood": "roadtrip"},
        ]
    elif month in [9, 10, 11]:
        season = "fall"
        playlists = [
            {"name": "🍂 Hüzünlü Sonbahar", "description": "Melankolik ve duygusal şarkılar", "mood": "melancholic"},
            {"name": "📚 Yağmurlu Günler", "description": "Lo-fi ve akustik", "mood": "lofi"},
            {"name": "🍁 Sonbahar Esintisi", "description": "Folk ve indie keşifler", "mood": "indie"},
        ]
    else:
        season = "winter"
        playlists = [
            {"name": "❄️ Kar Altında", "description": "Sıcacık ve samimi şarkılar", "mood": "cozy"},
            {"name": "🎄 Yeni Yıl Ruhu", "description": "Kutlama zamanı!", "mood": "festive"},
            {"name": "☕ Sıcak Çikolata", "description": "Evde dinlenecek sakin parçalar", "mood": "relax"},
        ]
    
    return {"season": season, "playlists": playlists}

@router.post("/generate-smart")
async def generate_smart_playlist_endpoint(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Generate a smart playlist based on user preferences"""
    now = datetime.now(timezone.utc).isoformat()
    playlist_id = str(uuid.uuid4())
    playlist_type = data.get("type", "")
    
    playlist_configs = {
        "most_played": {"name": "En Çok Dinlenen", "description": "En sık dinlediğin şarkılar"},
        "recently_added": {"name": "Son Eklenen", "description": "Son eklediğin şarkılar"},
        "never_played": {"name": "Hiç Dinlenmemiş", "description": "Kütüphanende hiç dinlemediğin şarkılar"},
        "favorites": {"name": "Beğeniler", "description": "Beğendiğin tüm şarkılar"},
        "weekly_mix": {"name": "Haftalık Karma", "description": "Bu hafta sana özel karışık liste"},
        "mood_happy": {"name": "Mutlu Anlar", "description": "Mutlu hissettiğinde dinlenecekler"},
        "mood_chill": {"name": "Rahatlatıcı", "description": "Rahat melodiler"},
        "mood_energy": {"name": "Enerjik", "description": "Enerji yüklü parçalar"},
        "activity_workout": {"name": "Spor", "description": "Antrenman için enerjik şarkılar"},
        "activity_sleep": {"name": "Uyku", "description": "Uyumadan önce dinlenecekler"},
        "activity_study": {"name": "Çalışma", "description": "Odaklanma müzikleri"},
        "discover_weekly": {"name": "Keşfet Haftalık", "description": "Sana özel yeni keşifler"},
        "repeat_rewind": {"name": "Repeat Rewind", "description": "En çok dinlediğin şarkılar"},
        "chill_mix": {"name": "Chill Mix", "description": "Rahatlatıcı melodiler"},
        "workout_mix": {"name": "Workout Mix", "description": "Spor için enerjik şarkılar"},
        "focus_mix": {"name": "Focus Mix", "description": "Odaklanmana yardımcı melodiler"},
    }
    
    config = playlist_configs.get(playlist_type)
    if not config:
        raise HTTPException(status_code=400, detail="Geçersiz playlist tipi")
    
    tracks = []
    try:
        if playlist_type == "favorites":
            likes = await db.track_likes.find({"user_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
            tracks = [l.get("track") for l in likes if l.get("track")]
        elif playlist_type == "most_played":
            history = await db.listening_history.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(500)
            from collections import Counter
            play_counts = Counter(h.get("song_id") for h in history if h.get("song_id"))
            top_ids = [sid for sid, _ in play_counts.most_common(50)]
            track_map = {}
            for h in history:
                sid = h.get("song_id")
                if sid and sid not in track_map:
                    track_map[sid] = {"id": sid, "title": h.get("title", ""), "artist": h.get("artist", ""), "thumbnail": h.get("thumbnail", "")}
            tracks = [track_map[sid] for sid in top_ids if sid in track_map]
        elif playlist_type == "recently_added":
            history = await db.listening_history.find({"user_id": current_user["id"]}, {"_id": 0}).sort("played_at", -1).to_list(50)
            seen = set()
            for h in history:
                sid = h.get("song_id")
                if sid and sid not in seen:
                    seen.add(sid)
                    tracks.append({"id": sid, "title": h.get("title", ""), "artist": h.get("artist", ""), "thumbnail": h.get("thumbnail", "")})
        else:
            query_map = {
                "mood_happy": "happy upbeat music", "mood_chill": "chill lofi", "mood_energy": "energetic workout",
                "activity_workout": "workout gym music", "activity_sleep": "sleep meditation", "activity_study": "study focus music",
                "weekly_mix": "top hits 2024", "never_played": "new music discoveries",
            }
            search_query = query_map.get(playlist_type, config["name"])
            try:
                from routes.music_hybrid import _sc_search
                tracks = await _sc_search(search_query, limit=20)
            except Exception:
                pass
    except Exception:
        pass
    if not tracks:
        tracks = MOCK_TRACKS[:20]
    
    playlist = {
        "id": playlist_id,
        "user_id": current_user["id"],
        "owner_id": current_user["id"],
        "name": config["name"],
        "description": config["description"],
        "cover_url": None,
        "tracks": tracks,
        "track_count": len(tracks),
        "is_public": False,
        "is_smart": True,
        "smart_type": playlist_type,
        "created_at": now,
        "updated_at": now
    }
    
    await db.playlists.insert_one(playlist)
    playlist.pop("_id", None)
    
    return {"message": f"'{config['name']}' oluşturuldu", "playlist": playlist}

@router.get("/{playlist_id}", response_model=Playlist)
async def get_playlist(playlist_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific playlist"""
    playlist = await db.playlists.find_one({"id": playlist_id}, {"_id": 0})
    if not playlist:
        return {
            "id": playlist_id,
            "name": "Türkçe Pop Hits",
            "description": "En sevilen Türkçe pop şarkıları",
            "cover_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300",
            "track_count": len(MOCK_TRACKS),
            "owner_id": current_user["id"],
            "is_public": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "tracks": MOCK_TRACKS,
            "likes_count": 234,
            "is_collaborative": False
        }
    return playlist

@router.post("/{playlist_id}/tracks/{track_id}")
async def add_track_to_playlist(playlist_id: str, track_id: str, current_user: dict = Depends(get_current_user)):
    """Add a track to playlist"""
    track = next((t for t in MOCK_TRACKS if t["id"] == track_id), None)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    await db.playlists.update_one(
        {"id": playlist_id, "owner_id": current_user["id"]},
        {"$push": {"tracks": track}, "$inc": {"track_count": 1}}
    )
    return {"message": "Track added to playlist"}

@router.put("/{playlist_id}")
async def update_playlist(playlist_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Update playlist name, description, is_public"""
    playlist = await db.playlists.find_one({"id": playlist_id})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    owner_id = playlist.get("owner_id") or playlist.get("user_id")
    if owner_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    for field in ["name", "description", "is_public", "is_collaborative"]:
        if field in data:
            update[field] = data[field]
    await db.playlists.update_one({"id": playlist_id}, {"$set": update})
    return {"message": "Playlist updated", **update}


@router.delete("/{playlist_id}")
async def delete_playlist(playlist_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a playlist"""
    result = await db.playlists.delete_one({"id": playlist_id, "owner_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return {"message": "Playlist deleted"}


@router.delete("/{playlist_id}/tracks/{track_id}")
async def remove_track_from_playlist(playlist_id: str, track_id: str, current_user: dict = Depends(get_current_user)):
    """Remove a track from playlist"""
    playlist = await db.playlists.find_one({"id": playlist_id})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    owner_id = playlist.get("owner_id") or playlist.get("user_id")
    collaborator_ids = [c.get("user_id") for c in playlist.get("collaborators", [])]
    if owner_id != current_user["id"] and current_user["id"] not in collaborator_ids:
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.playlists.update_one(
        {"id": playlist_id},
        {"$pull": {"tracks": {"id": track_id}}, "$inc": {"track_count": -1},
         "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Track removed"}


@router.put("/{playlist_id}/tracks/reorder")
async def reorder_playlist_tracks(playlist_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Reorder tracks: { from_index: int, to_index: int }"""
    playlist = await db.playlists.find_one({"id": playlist_id})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    owner_id = playlist.get("owner_id") or playlist.get("user_id")
    if owner_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    tracks = playlist.get("tracks", [])
    from_idx = data.get("from_index", 0)
    to_idx = data.get("to_index", 0)
    if 0 <= from_idx < len(tracks) and 0 <= to_idx < len(tracks):
        item = tracks.pop(from_idx)
        tracks.insert(to_idx, item)
        await db.playlists.update_one(
            {"id": playlist_id},
            {"$set": {"tracks": tracks, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    return {"message": "Tracks reordered"}


@router.post("/{playlist_id}/like")
async def like_playlist(playlist_id: str, current_user: dict = Depends(get_current_user)):
    """Like/follow a playlist"""
    existing = await db.playlist_likes.find_one({"user_id": current_user["id"], "playlist_id": playlist_id})
    if existing:
        await db.playlist_likes.delete_one({"_id": existing["_id"]})
        await db.playlists.update_one({"id": playlist_id}, {"$inc": {"likes_count": -1}})
        return {"liked": False}
    await db.playlist_likes.insert_one({
        "id": str(uuid.uuid4()), "user_id": current_user["id"],
        "playlist_id": playlist_id, "created_at": datetime.now(timezone.utc).isoformat()
    })
    await db.playlists.update_one({"id": playlist_id}, {"$inc": {"likes_count": 1}})
    return {"liked": True}


@router.post("/{playlist_id}/merge")
async def merge_playlists(playlist_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Merge another playlist into this one: { source_playlist_id: str }"""
    target = await db.playlists.find_one({"id": playlist_id})
    if not target:
        raise HTTPException(status_code=404, detail="Target playlist not found")
    owner_id = target.get("owner_id") or target.get("user_id")
    if owner_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    source_id = data.get("source_playlist_id")
    source = await db.playlists.find_one({"id": source_id})
    if not source:
        raise HTTPException(status_code=404, detail="Source playlist not found")
    existing_ids = {t.get("id") for t in target.get("tracks", [])}
    new_tracks = [t for t in source.get("tracks", []) if t.get("id") not in existing_ids]
    if new_tracks:
        await db.playlists.update_one(
            {"id": playlist_id},
            {"$push": {"tracks": {"$each": new_tracks}}, "$inc": {"track_count": len(new_tracks)},
             "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    return {"message": f"{len(new_tracks)} new tracks merged", "added": len(new_tracks)}


@router.post("/{playlist_id}/compare")
async def compare_playlists(playlist_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Compare two playlists: { other_playlist_id: str }"""
    pl1 = await db.playlists.find_one({"id": playlist_id})
    other_id = data.get("other_playlist_id")
    pl2 = await db.playlists.find_one({"id": other_id})
    if not pl1 or not pl2:
        raise HTTPException(status_code=404, detail="Playlist not found")
    ids1 = {t.get("id") for t in pl1.get("tracks", [])}
    ids2 = {t.get("id") for t in pl2.get("tracks", [])}
    common_ids = ids1 & ids2
    only1 = ids1 - ids2
    only2 = ids2 - ids1
    return {
        "common_count": len(common_ids), "only_first_count": len(only1), "only_second_count": len(only2),
        "common_tracks": [t for t in pl1.get("tracks", []) if t.get("id") in common_ids],
        "only_in_first": [t for t in pl1.get("tracks", []) if t.get("id") in only1],
        "only_in_second": [t for t in pl2.get("tracks", []) if t.get("id") in only2],
    }


@router.get("/{playlist_id}/share")
async def get_playlist_share_link(playlist_id: str, current_user: dict = Depends(get_current_user)):
    """Get shareable link and QR code data for playlist"""
    playlist = await db.playlists.find_one({"id": playlist_id}, {"_id": 0, "id": 1, "name": 1, "is_public": 1})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    base_url = os.environ.get("FRONTEND_URL", "https://socialbeats.app")
    share_url = f"{base_url}/playlist/{playlist_id}"
    return {
        "share_url": share_url,
        "qr_data": share_url,
        "playlist_name": playlist.get("name"),
        "is_public": playlist.get("is_public", True)
    }


# =====================================================
# PLAYLIST FOLDERS
# =====================================================

@router.get("/folders/list")
async def get_playlist_folders(current_user: dict = Depends(get_current_user)):
    """Get user's playlist folders"""
    folders = await db.playlist_folders.find(
        {"user_id": current_user["id"]}, {"_id": 0}
    ).sort("name", 1).to_list(100)
    return {"folders": folders}


@router.post("/folders")
async def create_playlist_folder(data: dict, current_user: dict = Depends(get_current_user)):
    """Create a new playlist folder"""
    folder_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    folder = {
        "id": folder_id, "name": data.get("name", "Yeni Klasör"),
        "user_id": current_user["id"], "playlist_ids": [],
        "created_at": now, "updated_at": now
    }
    await db.playlist_folders.insert_one(folder)
    folder.pop("_id", None)
    return folder


@router.put("/folders/{folder_id}")
async def update_playlist_folder(folder_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Rename a folder"""
    result = await db.playlist_folders.update_one(
        {"id": folder_id, "user_id": current_user["id"]},
        {"$set": {"name": data.get("name", ""), "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Folder not found")
    return {"message": "Folder renamed"}


@router.delete("/folders/{folder_id}")
async def delete_playlist_folder(folder_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a folder (playlists are not deleted, just unlinked)"""
    result = await db.playlist_folders.delete_one({"id": folder_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Folder not found")
    return {"message": "Folder deleted"}


@router.post("/folders/{folder_id}/playlists/{playlist_id}")
async def add_playlist_to_folder(folder_id: str, playlist_id: str, current_user: dict = Depends(get_current_user)):
    """Add a playlist to a folder"""
    await db.playlist_folders.update_one(
        {"id": folder_id, "user_id": current_user["id"]},
        {"$addToSet": {"playlist_ids": playlist_id}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Playlist added to folder"}


@router.delete("/folders/{folder_id}/playlists/{playlist_id}")
async def remove_playlist_from_folder(folder_id: str, playlist_id: str, current_user: dict = Depends(get_current_user)):
    """Remove a playlist from a folder"""
    await db.playlist_folders.update_one(
        {"id": folder_id, "user_id": current_user["id"]},
        {"$pull": {"playlist_ids": playlist_id}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Playlist removed from folder"}


# =====================================================
# COLLABORATIVE PLAYLISTS
# =====================================================

@router.post("/{playlist_id}/collaborators/{user_id}")
async def add_playlist_collaborator(
    playlist_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Add a collaborator to a playlist (owner only)"""
    playlist = await db.playlists.find_one({"id": playlist_id})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist bulunamadı")
    
    if playlist.get("owner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Sadece playlist sahibi katkıda bulunanları ekleyebilir")
    
    if not playlist.get("is_collaborative"):
        raise HTTPException(status_code=400, detail="Bu playlist ortak düzenlemeye açık değil")
    
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.playlists.update_one(
        {"id": playlist_id},
        {"$addToSet": {"collaborators": {
            "user_id": user_id,
            "username": target_user.get("username"),
            "avatar_url": target_user.get("avatar_url"),
            "added_at": now,
            "added_by": current_user["id"]
        }}}
    )
    
    await send_push_notification(
        user_id,
        "Playlist Daveti",
        f"{current_user.get('display_name', current_user['username'])} sizi '{playlist['name']}' playlistine katkıda bulunan olarak ekledi",
        "playlist_invite",
        {"playlist_id": playlist_id}
    )
    
    return {"message": f"Kullanıcı playlist'e eklendi"}

@router.delete("/{playlist_id}/collaborators/{user_id}")
async def remove_playlist_collaborator(
    playlist_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a collaborator from playlist (owner or self)"""
    playlist = await db.playlists.find_one({"id": playlist_id})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist bulunamadı")
    
    is_owner = playlist.get("owner_id") == current_user["id"]
    is_self = user_id == current_user["id"]
    
    if not is_owner and not is_self:
        raise HTTPException(status_code=403, detail="Bu işlemi yapamazsınız")
    
    await db.playlists.update_one(
        {"id": playlist_id},
        {"$pull": {"collaborators": {"user_id": user_id}}}
    )
    
    return {"message": "Katkıda bulunan kaldırıldı"}

@router.get("/{playlist_id}/collaborators")
async def get_playlist_collaborators(
    playlist_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get list of playlist collaborators"""
    playlist = await db.playlists.find_one({"id": playlist_id}, {"_id": 0, "collaborators": 1, "owner_id": 1})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist bulunamadı")
    
    collaborators = playlist.get("collaborators", [])
    
    owner = await db.users.find_one(
        {"id": playlist.get("owner_id")},
        {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
    )
    
    return {
        "owner": owner,
        "collaborators": collaborators,
        "total": len(collaborators)
    }

@router.post("/{playlist_id}/tracks/{track_id}/collaborative")
async def add_track_collaborative(
    playlist_id: str,
    track_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Add track to collaborative playlist (collaborators can add)"""
    playlist = await db.playlists.find_one({"id": playlist_id})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist bulunamadı")
    
    is_owner = playlist.get("owner_id") == current_user["id"]
    collaborator_ids = [c.get("user_id") for c in playlist.get("collaborators", [])]
    is_collaborator = current_user["id"] in collaborator_ids
    
    if not is_owner and not is_collaborator:
        raise HTTPException(status_code=403, detail="Bu playlist'e şarkı ekleyemezsiniz")
    
    track = next((t for t in MOCK_TRACKS if t["id"] == track_id), None)
    
    if not track and track_id.startswith("sc_"):
        track = {
            "id": track_id,
            "title": "SoundCloud Track",
            "artist": "Unknown",
            "source": "soundcloud",
            "added_by": current_user["id"],
            "added_at": datetime.now(timezone.utc).isoformat()
        }
    
    if not track:
        raise HTTPException(status_code=404, detail="Şarkı bulunamadı")
    
    track["added_by"] = current_user["id"]
    track["added_by_username"] = current_user.get("username")
    track["added_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.playlists.update_one(
        {"id": playlist_id},
        {
            "$push": {"tracks": track},
            "$inc": {"track_count": 1}
        }
    )
    
    return {"message": "Şarkı eklendi", "track": track}

# =====================================================
# PLAYLIST COPY & STATS
# =====================================================

@router.post("/{playlist_id}/copy")
async def copy_playlist(
    playlist_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Copy a public playlist to user's library"""
    source = await db.playlists.find_one({"id": playlist_id})
    if not source:
        raise HTTPException(status_code=404, detail="Çalma listesi bulunamadı")
    
    if source.get("user_id") == current_user["id"] or source.get("owner_id") == current_user["id"]:
        raise HTTPException(status_code=400, detail="Kendi listeni kopyalayamazsın")
    
    if not source.get("is_public", False):
        raise HTTPException(status_code=403, detail="Bu çalma listesi özel")
    
    now = datetime.now(timezone.utc)
    new_playlist_id = str(uuid.uuid4())
    
    new_playlist = {
        "id": new_playlist_id,
        "user_id": current_user["id"],
        "owner_id": current_user["id"],
        "name": f"{source.get('name', 'Çalma Listesi')} (kopya)",
        "description": source.get("description", ""),
        "cover_url": source.get("cover_url"),
        "is_public": False,
        "copied_from": playlist_id,
        "tracks": source.get("tracks", []),
        "track_count": len(source.get("tracks", [])),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.playlists.insert_one(new_playlist)
    new_playlist.pop("_id", None)
    
    return new_playlist

@router.get("/{playlist_id}/stats")
async def get_playlist_stats(
    playlist_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get playlist statistics"""
    playlist = await db.playlists.find_one({"id": playlist_id})
    if not playlist:
        raise HTTPException(status_code=404, detail="Çalma listesi bulunamadı")
    
    owner_id = playlist.get("user_id") or playlist.get("owner_id")
    if owner_id != current_user["id"] and not playlist.get("is_public"):
        raise HTTPException(status_code=403, detail="Bu çalma listesine erişim yetkiniz yok")
    
    tracks = playlist.get("tracks", [])
    
    play_history = await db.play_history.find({
        "user_id": current_user["id"],
        "playlist_id": playlist_id
    }).to_list(length=10000)
    
    track_plays = {}
    track_skips = {}
    
    for play in play_history:
        track_id = play.get("track_id")
        if track_id:
            track_plays[track_id] = track_plays.get(track_id, 0) + 1
            if play.get("skipped"):
                track_skips[track_id] = track_skips.get(track_id, 0) + 1
    
    top_tracks = sorted(
        [(t, track_plays.get(t.get("id"), 0)) for t in tracks],
        key=lambda x: x[1],
        reverse=True
    )[:10]
    
    most_skipped = sorted(
        [(t, track_skips.get(t.get("id"), 0) / max(track_plays.get(t.get("id"), 1), 1) * 100) 
         for t in tracks if track_plays.get(t.get("id"), 0) > 0],
        key=lambda x: x[1],
        reverse=True
    )[:5]
    
    total_duration = sum(t.get("duration", 0) for t in tracks)
    
    return {
        "playlist_id": playlist_id,
        "total_tracks": len(tracks),
        "total_duration_seconds": total_duration,
        "total_plays": len(play_history),
        "total_play_time": sum(p.get("duration", 0) for p in play_history),
        "total_skips": sum(1 for p in play_history if p.get("skipped")),
        "top_tracks": [{"track": t[0], "plays": t[1]} for t in top_tracks],
        "most_skipped": [{"track": t[0], "skip_rate": round(t[1], 1)} for t in most_skipped],
        "average_track_duration": round(total_duration / len(tracks)) if tracks else 0
    }

@router.post("/{playlist_id}/cover")
async def update_playlist_cover(
    playlist_id: str,
    image: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload custom cover image for playlist"""
    playlist = await db.playlists.find_one({"id": playlist_id})
    if not playlist:
        raise HTTPException(status_code=404, detail="Çalma listesi bulunamadı")
    
    owner_id = playlist.get("user_id") or playlist.get("owner_id")
    if owner_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Bu çalma listesini düzenleme yetkiniz yok")
    
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if image.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Desteklenmeyen dosya formatı")
    
    file_ext = image.filename.split(".")[-1] if "." in image.filename else "jpg"
    filename = f"playlist_cover_{playlist_id}_{uuid.uuid4()}.{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    async with aiofiles.open(file_path, "wb") as f:
        content = await image.read()
        await f.write(content)
    
    cover_url = f"/api/uploads/{filename}"
    
    await db.playlists.update_one(
        {"id": playlist_id},
        {"$set": {"cover_url": cover_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"cover_url": cover_url}
