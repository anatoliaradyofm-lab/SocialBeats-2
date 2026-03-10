# Live Video Routes - Canlı Yayın API'leri
# WebRTC sinyalizasyon ve canlı yayın yönetimi

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
import uuid
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import db
from core.auth import get_current_user

router = APIRouter(prefix="/live", tags=["Live Video"])


# ============================================
# MODELS
# ============================================

class LiveStreamCreate(BaseModel):
    title: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    category: Optional[str] = "music"  # music, chat, performance, podcast
    is_private: bool = False
    invited_users: List[str] = []

class LiveComment(BaseModel):
    content: str


# ============================================
# LIVE STREAM MANAGEMENT
# ============================================

@router.post("/start")
async def start_live_stream(data: LiveStreamCreate, current_user: dict = Depends(get_current_user)):
    """Canlı yayın başlat"""
    existing_live = await db.live_streams.find_one({
        "user_id": current_user["id"],
        "status": "live"
    })
    
    if existing_live:
        raise HTTPException(status_code=400, detail="Zaten aktif bir yayınınız var")
    
    stream_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    stream = {
        "id": stream_id,
        "user_id": current_user["id"],
        "username": current_user["username"],
        "user_avatar": current_user.get("avatar_url"),
        "user_display_name": current_user.get("display_name"),
        "is_verified": current_user.get("is_verified", False),
        "title": data.title,
        "description": data.description,
        "cover_url": data.cover_url,
        "category": data.category,
        "is_private": data.is_private,
        "invited_users": data.invited_users,
        "status": "live",
        "viewer_count": 0,
        "peak_viewers": 0,
        "total_views": 0,
        "likes_count": 0,
        "comments_count": 0,
        "started_at": now,
        "ended_at": None,
        "duration_seconds": 0,
        "replay_url": None
    }
    
    await db.live_streams.insert_one(stream)
    
    # Notify followers
    followers = await db.follows.find(
        {"following_id": current_user["id"]},
        {"follower_id": 1}
    ).to_list(1000)
    
    for follower in followers:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": follower["follower_id"],
            "type": "live_started",
            "title": "Canlı Yayın Başladı",
            "body": f"@{current_user['username']} canlı yayın başlattı: {data.title}",
            "data": {"stream_id": stream_id, "type": "live_started"},
            "sender_id": current_user["id"],
            "read": False,
            "created_at": now
        })
    
    stream.pop("_id", None)
    return stream


@router.post("/end/{stream_id}")
async def end_live_stream(stream_id: str, current_user: dict = Depends(get_current_user)):
    """Canlı yayını sonlandır"""
    stream = await db.live_streams.find_one({
        "id": stream_id,
        "user_id": current_user["id"],
        "status": "live"
    })
    
    if not stream:
        raise HTTPException(status_code=404, detail="Aktif yayın bulunamadı")
    
    now = datetime.now(timezone.utc)
    started_at = datetime.fromisoformat(stream["started_at"].replace("Z", "+00:00"))
    duration = int((now - started_at).total_seconds())
    
    await db.live_streams.update_one(
        {"id": stream_id},
        {"$set": {
            "status": "ended",
            "ended_at": now.isoformat(),
            "duration_seconds": duration
        }}
    )
    
    return {
        "message": "Yayın sonlandırıldı",
        "duration_seconds": duration,
        "total_views": stream["total_views"],
        "peak_viewers": stream["peak_viewers"]
    }


@router.get("/active")
async def get_active_streams(
    category: Optional[str] = None,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Aktif canlı yayınları listele"""
    blocked = await db.blocked_users.find(
        {"$or": [
            {"blocker_id": current_user["id"]},
            {"blocked_id": current_user["id"]}
        ]},
        {"blocker_id": 1, "blocked_id": 1}
    ).to_list(1000)
    
    blocked_ids = set()
    for b in blocked:
        blocked_ids.add(b.get("blocker_id"))
        blocked_ids.add(b.get("blocked_id"))
    blocked_ids.discard(current_user["id"])
    
    query = {
        "status": "live",
        "user_id": {"$nin": list(blocked_ids)},
        "$or": [
            {"is_private": False},
            {"invited_users": current_user["id"]},
            {"user_id": current_user["id"]}
        ]
    }
    
    if category:
        query["category"] = category
    
    streams = await db.live_streams.find(
        query,
        {"_id": 0}
    ).sort("viewer_count", -1).limit(limit).to_list(limit)
    
    return streams


@router.get("/following")
async def get_following_streams(current_user: dict = Depends(get_current_user)):
    """Takip edilenlerin canlı yayınlarını getir"""
    following = await db.follows.find(
        {"follower_id": current_user["id"]},
        {"following_id": 1}
    ).to_list(1000)
    
    following_ids = [f["following_id"] for f in following]
    
    streams = await db.live_streams.find(
        {
            "user_id": {"$in": following_ids},
            "status": "live"
        },
        {"_id": 0}
    ).sort("started_at", -1).to_list(50)
    
    return streams


@router.get("/{stream_id}")
async def get_stream_details(stream_id: str, current_user: dict = Depends(get_current_user)):
    """Yayın detaylarını getir"""
    stream = await db.live_streams.find_one(
        {"id": stream_id},
        {"_id": 0}
    )
    
    if not stream:
        raise HTTPException(status_code=404, detail="Yayın bulunamadı")
    
    blocked = await db.blocked_users.find_one({
        "$or": [
            {"blocker_id": current_user["id"], "blocked_id": stream["user_id"]},
            {"blocker_id": stream["user_id"], "blocked_id": current_user["id"]}
        ]
    })
    
    if blocked:
        raise HTTPException(status_code=403, detail="Bu yayına erişemezsiniz")
    
    if stream["is_private"]:
        if current_user["id"] != stream["user_id"] and current_user["id"] not in stream.get("invited_users", []):
            raise HTTPException(status_code=403, detail="Bu yayın özel")
    
    return stream


# ============================================
# VIEWER MANAGEMENT
# ============================================

@router.post("/{stream_id}/join")
async def join_stream(stream_id: str, current_user: dict = Depends(get_current_user)):
    """Yayına katıl"""
    stream = await db.live_streams.find_one({"id": stream_id, "status": "live"})
    if not stream:
        raise HTTPException(status_code=404, detail="Aktif yayın bulunamadı")
    
    now = datetime.now(timezone.utc).isoformat()
    
    viewer_record = {
        "id": str(uuid.uuid4()),
        "stream_id": stream_id,
        "user_id": current_user["id"],
        "username": current_user["username"],
        "joined_at": now,
        "left_at": None
    }
    
    await db.live_viewers.insert_one(viewer_record)
    
    current_viewers = await db.live_viewers.count_documents({
        "stream_id": stream_id,
        "left_at": None
    })
    
    update_data = {
        "viewer_count": current_viewers,
        "total_views": stream["total_views"] + 1
    }
    
    if current_viewers > stream["peak_viewers"]:
        update_data["peak_viewers"] = current_viewers
    
    await db.live_streams.update_one(
        {"id": stream_id},
        {"$set": update_data}
    )
    
    return {
        "message": "Yayına katıldın",
        "viewer_count": current_viewers
    }


@router.post("/{stream_id}/leave")
async def leave_stream(stream_id: str, current_user: dict = Depends(get_current_user)):
    """Yayından ayrıl"""
    now = datetime.now(timezone.utc).isoformat()
    
    await db.live_viewers.update_one(
        {
            "stream_id": stream_id,
            "user_id": current_user["id"],
            "left_at": None
        },
        {"$set": {"left_at": now}}
    )
    
    current_viewers = await db.live_viewers.count_documents({
        "stream_id": stream_id,
        "left_at": None
    })
    
    await db.live_streams.update_one(
        {"id": stream_id},
        {"$set": {"viewer_count": current_viewers}}
    )
    
    return {"message": "Yayından ayrıldın", "viewer_count": current_viewers}


@router.get("/{stream_id}/viewers")
async def get_stream_viewers(stream_id: str, current_user: dict = Depends(get_current_user)):
    """Yayın izleyicilerini getir"""
    viewers = await db.live_viewers.find(
        {"stream_id": stream_id, "left_at": None},
        {"_id": 0, "user_id": 1, "username": 1, "joined_at": 1}
    ).sort("joined_at", -1).to_list(100)
    
    user_ids = [v["user_id"] for v in viewers]
    users = await db.users.find(
        {"id": {"$in": user_ids}},
        {"_id": 0, "id": 1, "username": 1, "avatar_url": 1, "is_verified": 1}
    ).to_list(100)
    
    user_map = {u["id"]: u for u in users}
    
    for viewer in viewers:
        viewer["user"] = user_map.get(viewer["user_id"], {})
    
    return viewers


# ============================================
# LIVE COMMENTS
# ============================================

@router.post("/{stream_id}/comment")
async def add_live_comment(stream_id: str, data: LiveComment, current_user: dict = Depends(get_current_user)):
    """Canlı yayına yorum yap"""
    stream = await db.live_streams.find_one({"id": stream_id, "status": "live"})
    if not stream:
        raise HTTPException(status_code=404, detail="Aktif yayın bulunamadı")
    
    comment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    comment = {
        "id": comment_id,
        "stream_id": stream_id,
        "user_id": current_user["id"],
        "username": current_user["username"],
        "user_avatar": current_user.get("avatar_url"),
        "is_verified": current_user.get("is_verified", False),
        "content": data.content,
        "created_at": now
    }
    
    await db.live_comments.insert_one(comment)
    
    await db.live_streams.update_one(
        {"id": stream_id},
        {"$inc": {"comments_count": 1}}
    )
    
    comment.pop("_id", None)
    return comment


@router.get("/{stream_id}/comments")
async def get_live_comments(
    stream_id: str,
    limit: int = 50,
    since: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Canlı yayın yorumlarını getir"""
    query = {"stream_id": stream_id}
    
    if since:
        query["created_at"] = {"$gt": since}
    
    comments = await db.live_comments.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return comments


# ============================================
# LIVE LIKE
# ============================================

@router.post("/{stream_id}/like")
async def like_stream(stream_id: str, current_user: dict = Depends(get_current_user)):
    """Yayını beğen (kalp gönder)"""
    stream = await db.live_streams.find_one({"id": stream_id, "status": "live"})
    if not stream:
        raise HTTPException(status_code=404, detail="Aktif yayın bulunamadı")
    
    await db.live_streams.update_one(
        {"id": stream_id},
        {"$inc": {"likes_count": 1}}
    )
    
    return {"message": "Beğenildi", "likes_count": stream["likes_count"] + 1}


# ============================================
# WEBRTC SIGNALING INFO
# ============================================

@router.get("/{stream_id}/rtc-config")
async def get_rtc_config(stream_id: str, current_user: dict = Depends(get_current_user)):
    """WebRTC bağlantı bilgilerini getir"""
    stream = await db.live_streams.find_one({"id": stream_id, "status": "live"})
    if not stream:
        raise HTTPException(status_code=404, detail="Aktif yayın bulunamadı")
    
    return {
        "stream_id": stream_id,
        "is_broadcaster": stream["user_id"] == current_user["id"],
        "ice_servers": [
            {"urls": "stun:stun.l.google.com:19302"},
            {"urls": "stun:stun1.l.google.com:19302"},
            {"urls": "stun:stun2.l.google.com:19302"},
            {"urls": "stun:stun3.l.google.com:19302"},
            {"urls": "stun:stun4.l.google.com:19302"},
        ],
        "signaling_room": f"live_{stream_id}"
    }


# ============================================
# LIVE STREAM HISTORY
# ============================================

@router.get("/history/my")
async def get_my_live_history(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Kendi geçmiş yayınlarımı getir"""
    streams = await db.live_streams.find(
        {"user_id": current_user["id"], "status": "ended"},
        {"_id": 0}
    ).sort("started_at", -1).limit(limit).to_list(limit)
    
    return streams


@router.get("/history/user/{user_id}")
async def get_user_live_history(
    user_id: str,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Bir kullanıcının geçmiş yayınlarını getir"""
    blocked = await db.blocked_users.find_one({
        "$or": [
            {"blocker_id": current_user["id"], "blocked_id": user_id},
            {"blocker_id": user_id, "blocked_id": current_user["id"]}
        ]
    })
    
    if blocked:
        return []
    
    streams = await db.live_streams.find(
        {"user_id": user_id, "status": "ended", "is_private": False},
        {"_id": 0}
    ).sort("started_at", -1).limit(limit).to_list(limit)
    
    return streams
