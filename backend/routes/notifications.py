# Notifications Routes
# Push notifications, scheduled notifications, and notification settings
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import db
from core.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])

# =====================================================
# MODELLER
# =====================================================

class NotificationSettingsUpdate(BaseModel):
    push_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
    likes_notifications: Optional[bool] = None
    comments_notifications: Optional[bool] = None
    follows_notifications: Optional[bool] = None
    messages_notifications: Optional[bool] = None
    reposts_notifications: Optional[bool] = None
    mentions_notifications: Optional[bool] = None
    story_notifications: Optional[bool] = None
    new_content_notifications: Optional[bool] = None
    music_notifications: Optional[bool] = None
    system_notifications: Optional[bool] = None
    ad_notifications: Optional[bool] = None
    weekly_summary_enabled: Optional[bool] = None
    daily_reminder_enabled: Optional[bool] = None
    reminder_time: Optional[str] = None
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    vibration: Optional[bool] = None
    notification_sound: Optional[str] = None

class ScheduleNotificationRequest(BaseModel):
    notification_type: str
    scheduled_day: Optional[int] = None
    scheduled_hour: int = 9
    scheduled_minute: int = 0
    is_active: bool = True

# =====================================================
# HELPER FUNCTIONS
# =====================================================

async def send_push_notification(
    recipient_id: str,
    title: str,
    body: str,
    notification_type: str,
    data: dict = None,
    sender_id: str = None
):
    """Send push notification to user"""
    now = datetime.now(timezone.utc).isoformat()
    
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": recipient_id,
        "type": notification_type,
        "title": title,
        "body": body,
        "content": body,
        "data": data or {},
        "sender_id": sender_id,
        "read": False,
        "is_read": False,
        "created_at": now
    }
    
    if sender_id:
        sender = await db.users.find_one({"id": sender_id}, {"_id": 0, "username": 1, "avatar_url": 1})
        if sender:
            notification["from_username"] = sender.get("username")
            notification["from_avatar"] = sender.get("avatar_url")
    
    await db.notifications.insert_one(notification)
    return notification

# =====================================================
# PUSH TOKEN MANAGEMENT
# =====================================================

@router.post("/register-token")
async def register_push_token(
    request: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Register or update push token for current user"""
    token = request.get("expo_token") or request.get("expo_push_token")
    platform = request.get("platform", "android")
    device_name = request.get("device_name")
    
    if not token:
        raise HTTPException(status_code=400, detail="expo_token veya expo_push_token gerekli")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.push_tokens.update_one(
        {
            "user_id": current_user["id"],
            "expo_push_token": token
        },
        {
            "$set": {
                "user_id": current_user["id"],
                "expo_push_token": token,
                "platform": platform,
                "device_name": device_name,
                "updated_at": now,
                "is_active": True
            },
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "created_at": now
            }
        },
        upsert=True
    )
    
    return {"message": "Push token kaydedildi", "status": "success"}

@router.delete("/unregister-token")
async def unregister_push_token(
    request: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Deactivate push token (logout)"""
    expo_push_token = request.get("expo_push_token") or request.get("expo_token")
    now = datetime.now(timezone.utc).isoformat()
    
    if expo_push_token:
        await db.push_tokens.update_one(
            {
                "user_id": current_user["id"],
                "expo_push_token": expo_push_token
            },
            {"$set": {"is_active": False, "updated_at": now}}
        )
    else:
        await db.push_tokens.update_many(
            {"user_id": current_user["id"]},
            {"$set": {"is_active": False, "updated_at": now}}
        )
    
    return {"message": "Push token kaldırıldı"}

# =====================================================
# NOTIFICATION LIST ENDPOINTS
# =====================================================

@router.get("")
async def get_notifications_list(
    limit: int = 20,
    offset: int = 0,
    source: str = "mongo",
    current_user: dict = Depends(get_current_user)
):
    """Bildirim merkezi - PostgreSQL (source=pg) veya MongoDB (varsayılan). Okundu PG'de de tutulur."""
    if source == "pg":
        try:
            from services.postgresql_service import get_notifications_pg, get_unread_count_pg
            notifications = await get_notifications_pg(current_user["id"], limit, offset)
            unread_count = await get_unread_count_pg(current_user["id"])
            for notif in notifications:
                notif["read"] = notif.get("is_read", False)
                if notif.get("sender_id"):
                    sender = await db.users.find_one(
                        {"id": notif["sender_id"]},
                        {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
                    )
                    notif["sender"] = sender
            return {
                "notifications": notifications,
                "unread_count": unread_count,
                "has_more": len(notifications) == limit,
                "source": "postgresql"
            }
        except Exception:
            pass
    now_iso = datetime.now(timezone.utc).isoformat()
    query = {
        "user_id": current_user["id"],
        "$or": [
            {"snoozed_until": {"$exists": False}},
            {"snoozed_until": {"$lte": now_iso}},
            {"snoozed_until": None}
        ]
    }
    notifications = await db.notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    for notif in notifications:
        if notif.get("sender_id"):
            sender = await db.users.find_one(
                {"id": notif["sender_id"]},
                {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
            )
            notif["sender"] = sender
    unread_count = await db.notifications.count_documents({
        "user_id": current_user["id"],
        "read": False,
        "$or": [
            {"snoozed_until": {"$exists": False}},
            {"snoozed_until": {"$lte": now_iso}},
            {"snoozed_until": None}
        ]
    })
    return {
        "notifications": notifications,
        "unread_count": unread_count,
        "has_more": len(notifications) == limit
    }

class SnoozeRequest(BaseModel):
    minutes: int = 60

@router.post("/{notification_id}/snooze")
async def snooze_notification(
    notification_id: str,
    body: Optional[SnoozeRequest] = None,
    current_user: dict = Depends(get_current_user)
):
    """Ertele - bildirimi X dakika gizle (sonra tekrar görünür)"""
    from datetime import timedelta
    minutes = (body or SnoozeRequest()).minutes
    snoozed_until = (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat()
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"snoozed_until": snoozed_until, "is_snoozed": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Bildirim bulunamadı")
    return {"message": f"{minutes} dakika ertelendi", "snoozed_until": snoozed_until}

@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Okundu işaretleme - MongoDB + PostgreSQL"""
    await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"read": True, "is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    try:
        from services.postgresql_service import mark_notification_read_pg
        await mark_notification_read_pg(notification_id, current_user["id"])
    except Exception:
        pass
    return {"message": "Bildirim okundu olarak işaretlendi"}

@router.post("/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    """Tüm bildirimleri okundu işaretle - MongoDB + PostgreSQL"""
    now = datetime.now(timezone.utc).isoformat()
    await db.notifications.update_many(
        {"user_id": current_user["id"], "read": False},
        {"$set": {"read": True, "is_read": True, "read_at": now}}
    )
    try:
        from services.postgresql_service import mark_all_notifications_read_pg
        await mark_all_notifications_read_pg(current_user["id"])
    except Exception:
        pass
    return {"message": "Tüm bildirimler okundu olarak işaretlendi"}

@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a notification"""
    await db.notifications.delete_one({
        "id": notification_id,
        "user_id": current_user["id"]
    })
    return {"message": "Bildirim silindi"}

@router.delete("")
async def clear_all_notifications(current_user: dict = Depends(get_current_user)):
    """Clear all notifications"""
    await db.notifications.delete_many({"user_id": current_user["id"]})
    return {"message": "Tüm bildirimler silindi"}

@router.delete("/bulk")
async def delete_bulk_notifications(
    notification_ids: List[str],
    current_user: dict = Depends(get_current_user)
):
    """Delete multiple notifications"""
    result = await db.notifications.delete_many({
        "id": {"$in": notification_ids},
        "user_id": current_user["id"]
    })
    return {"message": f"{result.deleted_count} bildirim silindi"}

@router.delete("/all")
async def delete_all_notifications(current_user: dict = Depends(get_current_user)):
    """Delete all notifications (alias for clear)"""
    result = await db.notifications.delete_many({"user_id": current_user["id"]})
    return {"message": f"{result.deleted_count} bildirim silindi"}

# =====================================================
# SCHEDULED NOTIFICATIONS
# =====================================================

@router.get("/scheduled")
async def get_scheduled_notifications(current_user: dict = Depends(get_current_user)):
    """Get user's scheduled notifications"""
    schedules = await db.scheduled_notifications.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(50)
    
    return {"schedules": schedules}

@router.post("/schedule")
async def create_scheduled_notification(
    notification_type: str,
    scheduled_day: Optional[int] = None,
    scheduled_hour: int = 9,
    scheduled_minute: int = 0,
    is_active: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Schedule a recurring notification"""
    now = datetime.now(timezone.utc).isoformat()
    
    notification_configs = {
        "weekly_report": {
            "title": "Haftalık Raporun Hazır!",
            "body": "Geçen hafta neler dinledin? Görmek için tıkla."
        },
        "new_music_alert": {
            "title": "Yeni Şarkılar!",
            "body": "Takip ettiğin sanatçılardan yeni şarkılar var."
        },
        "daily_reminder": {
            "title": "🎵 Müzik Zamanı!",
            "body": "Bugün ne dinlemek istersin?"
        }
    }
    
    if notification_type not in notification_configs:
        raise HTTPException(status_code=400, detail="Geçersiz bildirim tipi")
    
    config = notification_configs[notification_type]
    schedule_id = str(uuid.uuid4())
    
    schedule = {
        "id": schedule_id,
        "user_id": current_user["id"],
        "notification_type": notification_type,
        "title": config["title"],
        "body": config["body"],
        "scheduled_day": scheduled_day,
        "scheduled_hour": scheduled_hour,
        "scheduled_minute": scheduled_minute,
        "is_active": is_active,
        "created_at": now
    }
    
    await db.scheduled_notifications.insert_one(schedule)
    schedule.pop("_id", None)
    
    return schedule

@router.put("/schedule/{schedule_id}")
async def update_scheduled_notification(
    schedule_id: str,
    scheduled_day: Optional[int] = None,
    scheduled_hour: Optional[int] = None,
    scheduled_minute: Optional[int] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update a scheduled notification"""
    update_data = {}
    if scheduled_day is not None:
        update_data["scheduled_day"] = scheduled_day
    if scheduled_hour is not None:
        update_data["scheduled_hour"] = scheduled_hour
    if scheduled_minute is not None:
        update_data["scheduled_minute"] = scheduled_minute
    if is_active is not None:
        update_data["is_active"] = is_active
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Güncellenecek alan belirtilmedi")
    
    result = await db.scheduled_notifications.update_one(
        {"id": schedule_id, "user_id": current_user["id"]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Zamanlanmış bildirim bulunamadı")
    
    return {"message": "Zamanlanmış bildirim güncellendi"}

@router.delete("/schedule/{schedule_id}")
async def delete_scheduled_notification(
    schedule_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a scheduled notification"""
    result = await db.scheduled_notifications.delete_one({
        "id": schedule_id,
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Zamanlanmış bildirim bulunamadı")
    
    return {"message": "Zamanlanmış bildirim silindi"}

# =====================================================
# DO NOT DISTURB (DND) - PostgreSQL + cron
# =====================================================

@router.get("/dnd")
async def get_dnd_settings(current_user: dict = Depends(get_current_user)):
    """Rahatsız etme modu - PostgreSQL (cron push atlamak için kullanır)"""
    try:
        from services.postgresql_service import get_dnd_settings_pg
        dnd = await get_dnd_settings_pg(current_user["id"])
        return {
            "enabled": dnd.get("enabled", False),
            "start_time": dnd.get("start_time", "22:00"),
            "end_time": dnd.get("end_time", "08:00"),
        }
    except Exception:
        pass
    settings = await db.user_settings.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    return {
        "enabled": settings.get("dnd_enabled", False) if settings else False,
        "start_time": settings.get("dnd_start", "22:00") if settings else "22:00",
        "end_time": settings.get("dnd_end", "08:00") if settings else "08:00",
    }

@router.put("/dnd")
async def update_dnd_settings(
    enabled: bool = False,
    start_time: str = "22:00",
    end_time: str = "08:00",
    current_user: dict = Depends(get_current_user)
):
    """Rahatsız etme modu güncelle - PostgreSQL + MongoDB sync"""
    try:
        from services.postgresql_service import set_dnd_settings_pg
        await set_dnd_settings_pg(current_user["id"], enabled, start_time, end_time)
    except Exception:
        pass
    await db.user_settings.update_one(
        {"user_id": current_user["id"]},
        {"$set": {"dnd_enabled": enabled, "dnd_start": start_time, "dnd_end": end_time}},
        upsert=True
    )
    return {"message": "Rahatsız Etmeyin ayarları güncellendi"}

# =====================================================
# NOTIFICATION SOUNDS - Expo + Freesound API
# =====================================================

@router.get("/sounds")
async def get_notification_sounds(
    freesound: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Bildirim sesleri - varsayılan listesi + Freesound API (sınırsız)"""
    try:
        from services.expo_notifications_service import get_notification_sounds as get_sounds
        sounds = await get_sounds(include_freesound=freesound)
        return {"sounds": sounds}
    except Exception:
        pass
    return {
        "sounds": [
            {"id": "default", "name": "Varsayılan", "preview_url": None},
            {"id": "chime", "name": "Zil Sesi", "preview_url": None},
            {"id": "pop", "name": "Pop", "preview_url": None},
            {"id": "ding", "name": "Ding", "preview_url": None},
            {"id": "none", "name": "Sessiz", "preview_url": None}
        ]
    }

@router.put("/sound")
async def update_notification_sound(
    sound_id: str = "default",
    current_user: dict = Depends(get_current_user)
):
    """Bildirim sesi tercihi - PostgreSQL (MMKV sync) + MongoDB"""
    try:
        from services.postgresql_service import set_notification_preferences_pg
        await set_notification_preferences_pg(current_user["id"], notification_sound=sound_id)
    except Exception:
        pass
    await db.user_settings.update_one(
        {"user_id": current_user["id"]},
        {"$set": {"notification_sound": sound_id}},
        upsert=True
    )
    return {"message": "Bildirim sesi güncellendi", "sound_id": sound_id}


# =====================================================
# PER-USER NOTIFICATION SOUND
# =====================================================

@router.get("/person-sounds")
async def get_person_sounds(current_user: dict = Depends(get_current_user)):
    """Get per-person notification sound assignments"""
    sounds = await db.person_notification_sounds.find(
        {"owner_id": current_user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    for s in sounds:
        user = await db.users.find_one(
            {"id": s.get("user_id")},
            {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
        )
        if user:
            s["username"] = user.get("username")
            s["display_name"] = user.get("display_name")
            s["avatar_url"] = user.get("avatar_url")
    
    return {"person_sounds": sounds}

@router.post("/person-sounds")
async def set_person_sound(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Set notification sound for a specific person"""
    user_id = data.get("user_id")
    sound_id = data.get("sound_id", "default")
    
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id gerekli")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.person_notification_sounds.update_one(
        {"owner_id": current_user["id"], "user_id": user_id},
        {"$set": {
            "owner_id": current_user["id"],
            "user_id": user_id,
            "sound_id": sound_id,
            "updated_at": now
        }},
        upsert=True
    )
    
    return {"message": "Kişi bildirim sesi atandı", "user_id": user_id, "sound_id": sound_id}

@router.delete("/person-sounds/{user_id}")
async def remove_person_sound(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove per-person sound assignment"""
    await db.person_notification_sounds.delete_one({
        "owner_id": current_user["id"],
        "user_id": user_id
    })
    return {"message": "Kişi bildirim sesi kaldırıldı"}

# =====================================================
# NOTIFICATION SETTINGS - PostgreSQL + MMKV sync
# =====================================================

@router.get("/settings")
async def get_notification_settings(current_user: dict = Depends(get_current_user)):
    """Bildirim tercihleri - PostgreSQL (MMKV sync: updated_at ile cache invalidation)"""
    try:
        from services.postgresql_service import get_notification_preferences_pg
        pg = await get_notification_preferences_pg(current_user["id"])
        if pg:
            pg["user_id"] = current_user["id"]
            return pg
    except Exception:
        pass
    settings = await db.notification_settings.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    if not settings:
        return {
            "user_id": current_user["id"],
            "push_enabled": True,
            "like_notifications": True,
            "comment_notifications": True,
            "follow_notifications": True,
            "message_notifications": True,
            "tag_notifications": True,
            "new_content_notifications": True,
            "weekly_summary_enabled": True,
            "notification_sound": "default",
            "updated_at": None
        }
    return settings

@router.put("/settings")
async def update_notification_settings(
    settings_data: NotificationSettingsUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Bildirim tercihleri güncelle - PostgreSQL (MMKV sync) + MongoDB"""
    update_data = {k: v for k, v in settings_data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Güncellenecek ayar belirtilmedi")
    pg_map = {
        "likes_notifications": "like_notifications",
        "comments_notifications": "comment_notifications",
        "follows_notifications": "follow_notifications",
        "messages_notifications": "message_notifications",
        "mentions_notifications": "tag_notifications",
    }
    pg_data = {}
    for k, v in update_data.items():
        if k in ("push_enabled", "like_notifications", "comment_notifications", "follow_notifications",
                 "message_notifications", "tag_notifications", "new_content_notifications",
                 "weekly_summary_enabled", "notification_sound"):
            pg_data[k] = v
        elif k in pg_map:
            pg_data[pg_map[k]] = v
    try:
        from services.postgresql_service import set_notification_preferences_pg
        if pg_data:
            await set_notification_preferences_pg(current_user["id"], **pg_data)
    except Exception:
        pass
    update_data["user_id"] = current_user["id"]
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.notification_settings.update_one(
        {"user_id": current_user["id"]},
        {"$set": update_data},
        upsert=True
    )
    return {"message": "Bildirim ayarları güncellendi"}

@router.post("/settings/schedule")
async def update_notification_schedule(
    quiet_hours_enabled: bool = False,
    quiet_hours_start: str = "22:00",
    quiet_hours_end: str = "08:00",
    current_user: dict = Depends(get_current_user)
):
    """Update notification quiet hours schedule"""
    await db.notification_settings.update_one(
        {"user_id": current_user["id"]},
        {"$set": {
            "quiet_hours_enabled": quiet_hours_enabled,
            "quiet_hours_start": quiet_hours_start,
            "quiet_hours_end": quiet_hours_end
        }},
        upsert=True
    )
    
    return {"message": "Sessiz saatler güncellendi"}

# =====================================================
# WEEKLY SUMMARY - Trench + Expo Notifications
# =====================================================

@router.post("/send-weekly-summary")
async def trigger_weekly_summary(current_user: dict = Depends(get_current_user)):
    """Haftalık özet bildirimi - Trench verisi + Expo Push"""
    try:
        from services.analytics_service import prepare_weekly_summary
        from server import send_push_notification
        payload = await prepare_weekly_summary(current_user["id"])
        await send_push_notification(
            current_user["id"],
            payload["title"],
            payload["body"],
            "weekly_summary",
            payload.get("data", {}),
        )
        return {"message": "Haftalık özet gönderildi", "payload": payload}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
