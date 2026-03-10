# User Routes
# User profile, settings, devices and media management endpoints
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import db
from core.auth import get_current_user

router = APIRouter(tags=["user"])

# =====================================================
# MODELLER
# =====================================================

class UserSettingsUpdate(BaseModel):
    is_private_account: Optional[bool] = None
    show_online_status: Optional[bool] = None
    who_can_message: Optional[str] = None
    message_requests: Optional[bool] = None
    who_can_see_posts: Optional[str] = None
    who_can_comment: Optional[str] = None
    show_like_count: Optional[bool] = None
    require_tag_approval: Optional[bool] = None
    message_notifications: Optional[bool] = None
    like_notifications: Optional[bool] = None
    comment_notifications: Optional[bool] = None
    follow_notifications: Optional[bool] = None
    tag_notifications: Optional[bool] = None
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    auto_accept_follows: Optional[bool] = None
    hide_followers_list: Optional[bool] = None
    hide_following_list: Optional[bool] = None
    show_read_receipts: Optional[bool] = None
    show_online_in_chat: Optional[bool] = None
    auto_delete_messages: Optional[str] = None
    allow_media_download: Optional[bool] = None
    theme: Optional[str] = None
    font_size: Optional[str] = None
    language: Optional[str] = None
    auto_play_videos: Optional[bool] = None
    data_saver_mode: Optional[bool] = None
    media_quality: Optional[str] = None

class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    display_name: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    birth_date: Optional[str] = None
    is_private: Optional[bool] = None
    avatar_url: Optional[str] = None

class UserPublicProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0
    favorite_genres: List[str] = []
    favorite_artists: List[str] = []
    is_verified: bool = False
    is_following: bool = False
    level: int = 1
    badges: List[str] = []
    profile_theme: str = "default"

# =====================================================
# USER SETTINGS ENDPOINTS
# =====================================================

@router.get("/user/settings")
async def get_user_settings(current_user: dict = Depends(get_current_user)):
    """Get user settings"""
    settings = await db.user_settings.find_one({"user_id": current_user["id"]}, {"_id": 0})
    
    if not settings:
        return {
            "user_id": current_user["id"],
            "is_private_account": False,
            "show_online_status": True,
            "who_can_message": "everyone",
            "message_requests": True,
            "who_can_see_posts": "everyone",
            "who_can_comment": "everyone",
            "show_like_count": True,
            "require_tag_approval": False,
            "message_notifications": True,
            "like_notifications": True,
            "comment_notifications": True,
            "follow_notifications": True,
            "tag_notifications": True,
            "quiet_hours_enabled": False,
            "quiet_hours_start": "22:00",
            "quiet_hours_end": "08:00",
            "auto_accept_follows": False,
            "hide_followers_list": False,
            "hide_following_list": False,
            "show_read_receipts": True,
            "show_online_in_chat": True,
            "auto_delete_messages": "never",
            "allow_media_download": True,
            "theme": "dark",
            "font_size": "medium",
            "language": "tr",
            "auto_play_videos": True,
            "data_saver_mode": False,
            "media_quality": "high"
        }
    
    return settings

@router.put("/user/settings")
async def update_user_settings(
    settings_data: UserSettingsUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update user settings"""
    update_data = {k: v for k, v in settings_data.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Güncellenecek ayar belirtilmedi")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.user_settings.update_one(
        {"user_id": current_user["id"]},
        {"$set": {**update_data, "user_id": current_user["id"]}},
        upsert=True
    )
    
    return {"message": "Ayarlar güncellendi"}

@router.get("/user/settings/export")
async def export_user_settings(current_user: dict = Depends(get_current_user)):
    """Export user settings as JSON"""
    settings = await db.user_settings.find_one({"user_id": current_user["id"]}, {"_id": 0})
    user_data = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    
    return {
        "settings": settings or {},
        "profile": user_data,
        "exported_at": datetime.now(timezone.utc).isoformat()
    }

@router.post("/user/settings/import")
async def import_user_settings(
    settings: dict,
    current_user: dict = Depends(get_current_user)
):
    """Import user settings from JSON"""
    now = datetime.now(timezone.utc).isoformat()
    
    if settings:
        settings["user_id"] = current_user["id"]
        settings["imported_at"] = now
        settings.pop("_id", None)
        
        await db.user_settings.update_one(
            {"user_id": current_user["id"]},
            {"$set": settings},
            upsert=True
        )
    
    return {"message": "Ayarlar içe aktarıldı"}

# =====================================================
# USER PROFILE ENDPOINTS
# =====================================================

@router.put("/user/profile")
async def update_profile(
    display_name: Optional[str] = None,
    avatar_url: Optional[str] = None,
    bio: Optional[str] = None,
    favorite_genres: Optional[List[str]] = None,
    favorite_artists: Optional[List[str]] = None,
    music_mood: Optional[str] = None,
    profile_theme: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update user profile"""
    update_data = {}
    if display_name:
        update_data["display_name"] = display_name
    if avatar_url:
        update_data["avatar_url"] = avatar_url
    if bio is not None:
        update_data["bio"] = bio
    if favorite_genres is not None:
        update_data["favorite_genres"] = favorite_genres
    if favorite_artists is not None:
        update_data["favorite_artists"] = favorite_artists
    if music_mood is not None:
        update_data["music_mood"] = music_mood
    if profile_theme is not None:
        update_data["profile_theme"] = profile_theme
    
    if update_data:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    return updated_user

@router.put("/users/profile")
async def update_user_profile_v2(
    profile: ProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update user profile (v2)"""
    now = datetime.now(timezone.utc).isoformat()
    update_data = {"updated_at": now}
    
    if profile.username and profile.username != current_user.get("username"):
        existing = await db.users.find_one({"username": profile.username.lower()})
        if existing:
            raise HTTPException(status_code=400, detail="Bu kullanıcı adı zaten alınmış")
        update_data["username"] = profile.username.lower()
    
    if profile.display_name is not None:
        update_data["display_name"] = profile.display_name
    if profile.bio is not None:
        update_data["bio"] = profile.bio[:200]
    if profile.location is not None:
        update_data["location"] = profile.location
    if profile.website is not None:
        update_data["website"] = profile.website
    if profile.birth_date is not None:
        update_data["birth_date"] = profile.birth_date
    if profile.is_private is not None:
        update_data["is_private"] = profile.is_private
    if profile.avatar_url is not None:
        update_data["avatar_url"] = profile.avatar_url
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    
    return {"message": "Profil güncellendi", "user": updated_user}

@router.get("/users/check-username")
async def check_username_availability(
    username: str = Query(..., min_length=3, max_length=30),
    current_user: dict = Depends(get_current_user)
):
    """Check if username is available"""
    if username.lower() == current_user.get("username", "").lower():
        return {"available": True, "message": "Mevcut kullanıcı adınız"}
    
    existing = await db.users.find_one({"username": username.lower()})
    return {"available": existing is None, "username": username}

@router.post("/user/phone")
async def update_phone(phone: str, current_user: dict = Depends(get_current_user)):
    """Update phone number"""
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"phone": phone}})
    return {"message": "Telefon numarası güncellendi"}

# =====================================================
# DEVICE MANAGEMENT
# =====================================================

@router.get("/user/devices")
async def get_user_devices(current_user: dict = Depends(get_current_user)):
    """Get user's devices"""
    devices = await db.user_devices.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("last_active", -1).to_list(50)
    
    if not devices:
        return [{
            "id": "current",
            "platform": "Unknown",
            "model": "Mevcut Cihaz",
            "user_agent": "Unknown",
            "last_active": datetime.now(timezone.utc).isoformat(),
            "is_current": True
        }]
    
    return devices

@router.delete("/user/devices/{device_id}")
async def remove_device(device_id: str, current_user: dict = Depends(get_current_user)):
    """Remove a device"""
    result = await db.user_devices.delete_one({
        "id": device_id,
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cihaz bulunamadı")
    
    return {"message": "Cihaz kaldırıldı"}

# =====================================================
# USER DATA USAGE (MUST BE BEFORE /user/{username})
# =====================================================

@router.get("/user/data-usage")
async def get_data_usage(current_user: dict = Depends(get_current_user)):
    """Get user's data usage statistics"""
    usage = await db.user_data_usage.find_one({"user_id": current_user["id"]}, {"_id": 0})
    
    if not usage:
        return {
            "user_id": current_user["id"],
            "music_streaming_mb": 0,
            "video_streaming_mb": 0,
            "image_downloads_mb": 0,
            "total_mb": 0,
            "limit_mb": None
        }
    
    return usage

@router.put("/user/data-limit")
async def set_data_limit(
    limit_mb: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Set data usage limit"""
    await db.user_data_usage.update_one(
        {"user_id": current_user["id"]},
        {"$set": {"limit_mb": limit_mb}},
        upsert=True
    )
    return {"message": "Veri limiti güncellendi", "limit_mb": limit_mb}

# =====================================================
# USER AUTOPLAY & NIGHT MODE SETTINGS (MUST BE BEFORE /user/{username})
# =====================================================

@router.get("/user/autoplay-settings")
async def get_autoplay_settings(current_user: dict = Depends(get_current_user)):
    """Get autoplay settings"""
    settings = await db.user_settings.find_one({"user_id": current_user["id"]}, {"_id": 0})
    
    return {
        "auto_play_videos": settings.get("auto_play_videos", True) if settings else True,
        "auto_play_on_wifi_only": settings.get("auto_play_on_wifi_only", False) if settings else False
    }

@router.put("/user/autoplay-settings")
async def update_autoplay_settings(
    auto_play_videos: bool = True,
    auto_play_on_wifi_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Update autoplay settings"""
    await db.user_settings.update_one(
        {"user_id": current_user["id"]},
        {"$set": {
            "auto_play_videos": auto_play_videos,
            "auto_play_on_wifi_only": auto_play_on_wifi_only
        }},
        upsert=True
    )
    return {"message": "Otomatik oynatma ayarları güncellendi"}

@router.get("/user/night-mode")
async def get_night_mode(current_user: dict = Depends(get_current_user)):
    """Get night mode settings"""
    settings = await db.user_settings.find_one({"user_id": current_user["id"]}, {"_id": 0})
    
    return {
        "enabled": settings.get("night_mode_enabled", False) if settings else False,
        "start_time": settings.get("night_mode_start", "22:00") if settings else "22:00",
        "end_time": settings.get("night_mode_end", "07:00") if settings else "07:00",
        "auto": settings.get("night_mode_auto", False) if settings else False
    }

@router.put("/user/night-mode")
async def update_night_mode(
    enabled: bool = False,
    start_time: str = "22:00",
    end_time: str = "07:00",
    auto: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Update night mode settings"""
    await db.user_settings.update_one(
        {"user_id": current_user["id"]},
        {"$set": {
            "night_mode_enabled": enabled,
            "night_mode_start": start_time,
            "night_mode_end": end_time,
            "night_mode_auto": auto
        }},
        upsert=True
    )
    return {"message": "Gece modu ayarları güncellendi"}

# =====================================================
# USER ANNIVERSARY (MUST BE BEFORE /user/{username})
# =====================================================

@router.get("/user/anniversary")
async def get_user_anniversary(current_user: dict = Depends(get_current_user)):
    """Get user's account anniversary info"""
    created_at = current_user.get("created_at")
    if not created_at:
        return {"has_anniversary": False}
    
    try:
        created_date = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        
        years = (now - created_date).days // 365
        next_anniversary = created_date.replace(year=now.year)
        if next_anniversary < now:
            next_anniversary = next_anniversary.replace(year=now.year + 1)
        
        days_until = (next_anniversary - now).days
        
        return {
            "has_anniversary": True,
            "years": years,
            "created_at": created_at,
            "next_anniversary": next_anniversary.isoformat(),
            "days_until_next": days_until
        }
    except:
        return {"has_anniversary": False}

@router.get("/user/profile-visitors")
async def get_profile_visitors(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get profile visitors (premium feature)"""
    visitors = await db.profile_visits.find(
        {"visited_user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"visitors": visitors, "total": len(visitors)}

# =====================================================
# USER PUBLIC PROFILE (PARAMETERIZED ROUTES - MUST BE LAST)
# =====================================================

@router.get("/user/me")
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """Get current user's profile"""
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0, "email": 0})
    if not user:
        return {"user": current_user}
    return {"user": user}


@router.post("/user/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload user avatar"""
    import base64
    contents = await file.read()
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    data_uri = f"data:image/{ext};base64,{base64.b64encode(contents).decode()}"

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"avatar_url": data_uri, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"avatar_url": data_uri}


@router.post("/user/cover")
async def upload_cover(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload user cover image"""
    import base64
    contents = await file.read()
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    data_uri = f"data:image/{ext};base64,{base64.b64encode(contents).decode()}"

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"cover_url": data_uri, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"cover_url": data_uri}


@router.get("/user/{username}", response_model=UserPublicProfile)
async def get_user_profile(username: str, current_user: dict = Depends(get_current_user)):
    """Get user's public profile - searches by username first, then by ID"""
    user = await db.users.find_one({"username": username}, {"_id": 0, "password": 0, "email": 0})
    if not user:
        user = await db.users.find_one({"id": username}, {"_id": 0, "password": 0, "email": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_blocked = await db.blocked_users.find_one({
        "$or": [
            {"blocker_id": current_user["id"], "blocked_id": user["id"]},
            {"blocker_id": user["id"], "blocked_id": current_user["id"]}
        ]
    })
    if is_blocked:
        raise HTTPException(status_code=404, detail="User not found")

    is_following = await db.follows.find_one({
        "follower_id": current_user["id"],
        "following_id": user["id"]
    }) is not None

    if user["id"] != current_user["id"]:
        try:
            from services.analytics_service import track_view
            await track_view("profile_viewed", current_user["id"], user["id"], "profile")
        except Exception:
            pass

    return UserPublicProfile(**user, is_following=is_following)

@router.get("/user/{username}/activity")
async def get_user_activity(username: str, limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Get user's recent activity"""
    user = await db.users.find_one({"username": username}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    posts = await db.posts.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"posts": posts, "user": user}

@router.get("/user/{user_id}/badges")
async def get_user_badges(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get user's badges"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "badges": 1, "level": 1, "xp": 1})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    badge_definitions = {
        "new_user": {"name": "Yeni Üye", "description": "Hoş geldin!", "icon": "👋"},
        "first_post": {"name": "İlk Post", "description": "İlk gönderisini paylaştı", "icon": "📝"},
        "social_butterfly": {"name": "Sosyal Kelebek", "description": "100+ takipçi", "icon": "🦋"},
        "music_expert": {"name": "Müzik Uzmanı", "description": "1000+ şarkı dinledi", "icon": "🎵"},
        "premium_member": {"name": "Premium Üye", "description": "Premium abone", "icon": "⭐"},
        "verified": {"name": "Doğrulanmış", "description": "Doğrulanmış hesap", "icon": "✓"}
    }
    
    user_badges = []
    for badge_id in user.get("badges", []):
        if badge_id in badge_definitions:
            user_badges.append({
                "id": badge_id,
                **badge_definitions[badge_id]
            })
    
    return {
        "badges": user_badges,
        "level": user.get("level", 1),
        "xp": user.get("xp", 0)
    }

# =====================================================
# USER MEDIA ENDPOINTS
# =====================================================

@router.get("/users/{user_id}/photos")
async def get_user_photos(
    user_id: str,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get user's photos from posts"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    photos = await db.posts.find(
        {
            "user_id": user_id,
            "$or": [
                {"media_type": "photo"},
                {"media_type": "image"},
                {"media_url": {"$regex": r"\.(jpg|jpeg|png|gif|webp)$", "$options": "i"}}
            ]
        },
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    total = await db.posts.count_documents({
        "user_id": user_id,
        "$or": [
            {"media_type": "photo"},
            {"media_type": "image"},
            {"media_url": {"$regex": r"\.(jpg|jpeg|png|gif|webp)$", "$options": "i"}}
        ]
    })
    
    return {"photos": photos, "total": total, "has_more": offset + limit < total}

@router.get("/users/{user_id}/videos")
async def get_user_videos(
    user_id: str,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get user's videos from posts"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    videos = await db.posts.find(
        {
            "user_id": user_id,
            "$or": [
                {"media_type": "video"},
                {"media_url": {"$regex": r"\.(mp4|mov|avi|webm)$", "$options": "i"}}
            ]
        },
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    total = await db.posts.count_documents({
        "user_id": user_id,
        "$or": [
            {"media_type": "video"},
            {"media_url": {"$regex": r"\.(mp4|mov|avi|webm)$", "$options": "i"}}
        ]
    })
    
    return {"videos": videos, "total": total, "has_more": offset + limit < total}

@router.get("/users/{user_id}/media")
async def get_user_all_media(
    user_id: str,
    media_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get all media from a user's posts"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    query = {"user_id": user_id, "media_url": {"$exists": True, "$ne": None}}
    
    if media_type == "photo":
        query["$or"] = [
            {"media_type": "photo"},
            {"media_type": "image"},
            {"media_url": {"$regex": r"\.(jpg|jpeg|png|gif|webp)$", "$options": "i"}}
        ]
    elif media_type == "video":
        query["$or"] = [
            {"media_type": "video"},
            {"media_url": {"$regex": r"\.(mp4|mov|avi|webm)$", "$options": "i"}}
        ]
    
    media = await db.posts.find(query, {"_id": 0}).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    total = await db.posts.count_documents(query)
    
    return {"media": media, "total": total, "has_more": offset + limit < total}

@router.get("/users/{user_id}/content")
async def get_user_content_summary(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get summary of user's content"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    photos_count = await db.posts.count_documents({
        "user_id": user_id,
        "$or": [{"media_type": "photo"}, {"media_type": "image"}]
    })
    
    videos_count = await db.posts.count_documents({
        "user_id": user_id,
        "$or": [{"media_type": "video"}]
    })
    
    stories_count = await db.stories.count_documents({"user_id": user_id})
    highlights_count = await db.highlights.count_documents({"user_id": user_id})
    
    return {
        "photos": photos_count,
        "videos": videos_count,
        "stories": stories_count,
        "highlights": highlights_count
    }

@router.get("/users/{user_id}/stats")
async def get_user_stats(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get user statistics"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    posts_count = await db.posts.count_documents({"user_id": user_id})
    followers_count = await db.follows.count_documents({"following_id": user_id})
    following_count = await db.follows.count_documents({"follower_id": user_id})

    likes_received = 0
    user_posts = await db.posts.find({"user_id": user_id}, {"likes_count": 1, "likes": 1}).to_list(5000)
    for p in user_posts:
        likes_received += p.get("likes_count", 0) or len(p.get("likes", []))

    listening = await db.listening_history.find({"user_id": user_id}).to_list(50000)
    total_minutes = sum(h.get("duration_seconds", 0) for h in listening) / 60

    artist_counts = {}
    genre_counts = {}
    for h in listening:
        a = h.get("artist") or h.get("artist_name", "")
        g = h.get("genre", "")
        if a:
            artist_counts[a] = artist_counts.get(a, 0) + 1
        if g:
            genre_counts[g] = genre_counts.get(g, 0) + 1

    top_artist = max(artist_counts, key=artist_counts.get) if artist_counts else None
    top_genre = max(genre_counts, key=genre_counts.get) if genre_counts else None

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    new_followers = await db.follows.count_documents({
        "following_id": user_id,
        "created_at": {"$gte": week_ago.isoformat()}
    })

    days_tr = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]
    week_activity = [0] * 7
    for h in listening:
        ts = h.get("played_at") or h.get("created_at")
        if not ts:
            continue
        if isinstance(ts, str):
            try:
                ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except Exception:
                continue
        if ts >= week_ago:
            week_activity[ts.weekday()] += h.get("duration_seconds", 180) // 60

    return {
        "user_id": user_id,
        "posts_count": posts_count,
        "followers_count": followers_count,
        "following_count": following_count,
        "total_likes": likes_received,
        "total_listening_minutes": int(total_minutes),
        "top_artist": top_artist,
        "top_genre": top_genre,
        "follower_growth": new_followers,
        "weekly_activity": [{"label": days_tr[i], "value": week_activity[i]} for i in range(7)],
        "level": user.get("level", 1),
        "xp": user.get("xp", 0),
    }

# =====================================================
# USER SEARCH
# =====================================================

@router.get("/users/search")
async def search_users(
    q: str = Query(..., min_length=1),
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Search for users - excludes blocked users in both directions"""
    blocked = await db.blocked_users.find(
        {"$or": [{"blocker_id": current_user["id"]}, {"blocked_id": current_user["id"]}]}
    ).to_list(2000)
    blocked_ids = set()
    for b in blocked:
        blocked_ids.add(b.get("blocker_id", ""))
        blocked_ids.add(b.get("blocked_id", ""))
    blocked_ids.discard(current_user["id"])

    users = await db.users.find(
        {
            "$and": [
                {"id": {"$nin": list(blocked_ids)}},
                {"$or": [
                    {"username": {"$regex": q, "$options": "i"}},
                    {"display_name": {"$regex": q, "$options": "i"}},
                    {"full_name": {"$regex": q, "$options": "i"}}
                ]}
            ]
        },
        {"_id": 0, "password": 0, "email": 0}
    ).limit(limit).to_list(limit)

    for user in users:
        is_following = await db.follows.find_one({
            "follower_id": current_user["id"],
            "following_id": user["id"]
        }) is not None
        user["is_following"] = is_following

    return {"users": users, "total": len(users)}

# =====================================================
# USER ACTIVITY STATUS
# =====================================================

@router.get("/users/{user_id}/activity-status")
async def get_user_activity_status(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get user's online/activity status"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "is_online": 1, "last_active": 1})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    return {
        "user_id": user_id,
        "is_online": user.get("is_online", False),
        "last_active": user.get("last_active")
    }

@router.post("/users/{user_id}/visit")
async def record_profile_visit(user_id: str, current_user: dict = Depends(get_current_user)):
    """Record a profile visit"""
    if user_id == current_user["id"]:
        return {"message": "Kendi profiliniz"}
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.profile_visits.insert_one({
        "id": str(uuid.uuid4()),
        "visited_user_id": user_id,
        "visitor_id": current_user["id"],
        "visitor_username": current_user["username"],
        "visitor_avatar": current_user.get("avatar_url"),
        "created_at": now
    })
    
    return {"message": "Ziyaret kaydedildi"}

# =====================================================
# DELETE ACCOUNT
# =====================================================

@router.delete("/users/delete-account")
async def delete_account(
    password: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete user account"""
    import bcrypt
    
    user = await db.users.find_one({"id": current_user["id"]})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    if user.get("password"):
        if not bcrypt.checkpw(password.encode('utf-8'), user["password"].encode('utf-8')):
            raise HTTPException(status_code=401, detail="Şifre yanlış")
    
    user_id = current_user["id"]

    # PostgreSQL + NextAuth: tüm kullanıcı verilerini sil (gizlilik ayarları, bildirimler, profil, takip, vb.)
    try:
        from services.postgresql_service import delete_user_data_pg
        await delete_user_data_pg(user_id)
    except Exception:
        pass

    # MongoDB
    await db.users.delete_one({"id": user_id})
    await db.posts.delete_many({"user_id": user_id})
    await db.stories.delete_many({"user_id": user_id})
    await db.follows.delete_many({"$or": [{"follower_id": user_id}, {"following_id": user_id}]})
    await db.user_settings.delete_one({"user_id": user_id})
    await db.notifications.delete_many({"user_id": user_id})
    await db.user_devices.delete_many({"user_id": user_id})
    await db.linked_accounts.delete_many({"$or": [{"owner_id": user_id}, {"linked_user_id": user_id}]})
    await db.screen_time.delete_many({"user_id": user_id})

    return {"message": "Hesabınız silindi"}


# =====================================================
# SCREEN TIME (EKRAN SÜRESİ TAKİBİ)
# =====================================================

@router.post("/user/screen-time")
async def record_screen_time(data: dict, current_user: dict = Depends(get_current_user)):
    duration = data.get("duration_seconds", 0)
    screen = data.get("screen", "app")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Trench: ekran süresi takibi (event tracking)
    try:
        from services.trench_service import track, is_available
        if is_available() and duration > 0:
            await track("screen_time", current_user["id"], {"duration_seconds": duration, "screen": screen, "date": today})
    except Exception:
        pass

    await db.screen_time.update_one(
        {"user_id": current_user["id"], "date": today},
        {
            "$inc": {"total_seconds": duration},
            "$push": {"sessions": {
                "screen": screen,
                "duration": duration,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }},
            "$setOnInsert": {"user_id": current_user["id"], "date": today}
        },
        upsert=True
    )
    return {"success": True}


@router.get("/user/screen-time")
async def get_screen_time(
    days: int = Query(7, le=30),
    current_user: dict = Depends(get_current_user)
):
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")

    records = await db.screen_time.find(
        {"user_id": current_user["id"], "date": {"$gte": cutoff}},
        {"_id": 0}
    ).sort("date", -1).to_list(days)

    total_seconds = sum(r.get("total_seconds", 0) for r in records)
    daily_avg = total_seconds / max(len(records), 1)

    return {
        "records": records,
        "total_seconds": total_seconds,
        "total_minutes": round(total_seconds / 60),
        "daily_average_minutes": round(daily_avg / 60),
        "days": len(records)
    }


# =====================================================
# ACCOUNT SWITCHING (HESAP GEÇİŞİ - max 3)
# =====================================================

@router.get("/user/linked-accounts")
async def get_linked_accounts(current_user: dict = Depends(get_current_user)):
    # PostgreSQL (NextAuth + PostgreSQL) öncelikli; yoksa MongoDB
    from services.postgresql_service import get_linked_accounts_pg
    links_pg = await get_linked_accounts_pg(current_user["id"])
    if not links_pg:
        links = await db.linked_accounts.find(
            {"owner_id": current_user["id"]}, {"_id": 0}
        ).to_list(10)
    else:
        links = [{"linked_user_id": r["linked_user_id"]} for r in links_pg]

    accounts = [{"id": current_user["id"], "username": current_user.get("username"), "avatar_url": current_user.get("avatar_url"), "is_current": True}]
    for link in links:
        u = await db.users.find_one({"id": link["linked_user_id"]}, {"_id": 0, "password": 0})
        if u:
            accounts.append({"id": u["id"], "username": u.get("username"), "avatar_url": u.get("avatar_url"), "is_current": False})

    return {"accounts": accounts[:3], "max_accounts": 3}


@router.post("/user/linked-accounts")
async def add_linked_account(data: dict, current_user: dict = Depends(get_current_user)):
    import bcrypt
    username = data.get("username")
    password = data.get("password")
    if not username or not password:
        raise HTTPException(status_code=400, detail="Kullanıcı adı ve şifre gerekli")

    existing = await db.linked_accounts.count_documents({"owner_id": current_user["id"]})
    if existing >= 2:
        raise HTTPException(status_code=400, detail="En fazla 3 hesap bağlanabilir")

    target = await db.users.find_one({"username": username})
    if not target:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    if target["id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="Kendi hesabınızı bağlayamazsınız")

    if target.get("password"):
        if not bcrypt.checkpw(password.encode('utf-8'), target["password"].encode('utf-8')):
            raise HTTPException(status_code=401, detail="Şifre yanlış")

    already = await db.linked_accounts.find_one({
        "owner_id": current_user["id"],
        "linked_user_id": target["id"]
    })
    if already:
        raise HTTPException(status_code=400, detail="Bu hesap zaten bağlı")

    link_id = str(uuid.uuid4())
    await db.linked_accounts.insert_one({
        "id": link_id,
        "owner_id": current_user["id"],
        "linked_user_id": target["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    try:
        from services.postgresql_service import insert_linked_account_pg
        await insert_linked_account_pg(link_id, current_user["id"], target["id"], "credentials")
    except Exception:
        pass

    return {"success": True, "message": "Hesap bağlandı"}


@router.delete("/user/linked-accounts/{account_id}")
async def remove_linked_account(account_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.linked_accounts.delete_one({
        "owner_id": current_user["id"],
        "linked_user_id": account_id
    })
    if result.deleted_count == 0:
        await db.linked_accounts.delete_one({
            "owner_id": current_user["id"],
            "id": account_id
        })
    try:
        from services.postgresql_service import delete_linked_account_pg
        await delete_linked_account_pg(current_user["id"], account_id)
    except Exception:
        pass
    return {"success": True, "message": "Hesap kaldırıldı"}


# =====================================================
# MUSIC TASTE TEST (MÜZİK ZEVKİ TESTİ)
# =====================================================

TASTE_GENRES = [
    "Pop", "Rock", "Hip-Hop", "R&B", "Jazz", "Klasik",
    "Elektronik", "Country", "Latin", "Metal", "Indie",
    "Blues", "Reggae", "Folk", "Soul", "Punk",
]

TASTE_MOODS = [
    "Enerjik", "Sakin", "Melankolik", "Mutlu",
    "Romantik", "Motivasyon", "Nostaljik", "Agresif",
]

@router.get("/user/taste-test/options")
async def get_taste_test_options(current_user: dict = Depends(get_current_user)):
    return {
        "genres": TASTE_GENRES,
        "moods": TASTE_MOODS,
        "min_genres": 3,
        "max_genres": 8,
        "min_moods": 2,
        "max_moods": 5,
    }


@router.post("/user/taste-test")
async def submit_taste_test(data: dict, current_user: dict = Depends(get_current_user)):
    genres = data.get("genres", [])
    moods = data.get("moods", [])
    artists = data.get("favorite_artists", [])

    if len(genres) < 3:
        raise HTTPException(status_code=400, detail="En az 3 tür seçin")

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "favorite_genres": genres,
            "favorite_moods": moods,
            "favorite_artists": artists,
            "taste_test_completed": True,
            "taste_test_date": datetime.now(timezone.utc).isoformat()
        }}
    )

    return {"success": True, "message": "Müzik zevki kaydedildi"}


@router.get("/user/taste-test/result")
async def get_taste_test_result(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    return {
        "completed": user.get("taste_test_completed", False),
        "genres": user.get("favorite_genres", []),
        "moods": user.get("favorite_moods", []),
        "favorite_artists": user.get("favorite_artists", []),
        "test_date": user.get("taste_test_date")
    }
