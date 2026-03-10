# Social Features Routes - Instagram benzeri sosyal özellikler
# Mute, Restrict, Close Friends, QR Code, Archive

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
import uuid
import qrcode
import io
import base64
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import db
from core.auth import get_current_user

router = APIRouter(prefix="/social", tags=["Social Features"])

def init_social_features_router(database, auth_func):
    """Initialize router with dependencies - kept for compatibility"""
    pass


# ============================================
# MUTE (SESİZE AL) - Kullanıcı postlarını görmezden gel
# ============================================

@router.post("/mute/{user_id}")
async def mute_user(user_id: str, mute_stories: bool = True, mute_posts: bool = True,
                    mute_notifications: bool = True,
                    current_user: dict = Depends(get_current_user)):
    """
    Kullanıcıyı sessize al - Instagram'daki mute özelliği
    Engelleme değil, sadece içerikleri göstermez
    """
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Kendinizi sessize alamazsınız")
    
    # Check if user exists
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "username": 1})
    if not target_user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Check if already muted
    existing = await db.muted_users.find_one({
        "user_id": current_user["id"],
        "muted_user_id": user_id
    })
    
    if existing:
        await db.muted_users.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "mute_stories": mute_stories,
                "mute_posts": mute_posts,
                "mute_notifications": mute_notifications,
                "updated_at": now
            }}
        )
    else:
        await db.muted_users.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "muted_user_id": user_id,
            "muted_username": target_user["username"],
            "mute_stories": mute_stories,
            "mute_posts": mute_posts,
            "mute_notifications": mute_notifications,
            "created_at": now,
            "updated_at": now
        })
    
    return {
        "message": f"@{target_user['username']} sessize alındı",
        "mute_stories": mute_stories,
        "mute_posts": mute_posts,
        "mute_notifications": mute_notifications
    }


@router.delete("/mute/{user_id}")
async def unmute_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Kullanıcının sesini aç"""
    result = await db.muted_users.delete_one({
        "user_id": current_user["id"],
        "muted_user_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bu kullanıcı sessize alınmamış")
    
    return {"message": "Kullanıcının sesi açıldı"}


@router.get("/muted")
async def get_muted_users(current_user: dict = Depends(get_current_user)):
    """Sessize alınan kullanıcıları listele"""
    muted = await db.muted_users.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    # Get user details
    muted_ids = [m["muted_user_id"] for m in muted]
    users = await db.users.find(
        {"id": {"$in": muted_ids}},
        {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
    ).to_list(100)
    
    user_map = {u["id"]: u for u in users}
    
    result = []
    for m in muted:
        user = user_map.get(m["muted_user_id"], {})
        result.append({
            **m,
            "user": user
        })
    
    return result


@router.get("/is-muted/{user_id}")
async def check_mute_status(user_id: str, current_user: dict = Depends(get_current_user)):
    """Kullanıcının sessize alınıp alınmadığını kontrol et"""
    muted = await db.muted_users.find_one({
        "user_id": current_user["id"],
        "muted_user_id": user_id
    }, {"_id": 0})
    
    if muted:
        return {
            "is_muted": True,
            "mute_stories": muted.get("mute_stories", True),
            "mute_posts": muted.get("mute_posts", True),
            "mute_notifications": muted.get("mute_notifications", True)
        }
    
    return {"is_muted": False}


# ============================================
# RESTRICT (KISITLA) - Yorum kontrolü
# ============================================

@router.post("/restrict/{user_id}")
async def restrict_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """
    Kullanıcıyı kısıtla - Instagram'daki restrict özelliği
    - Kısıtlanan kullanıcının yorumları sadece kendisi görebilir
    - DM'ler istek klasörüne düşer
    - Online durumu görünmez
    """
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Kendinizi kısıtlayamazsınız")
    
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "username": 1})
    if not target_user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Check existing - support both old and new field names
    existing = await db.restricted_users.find_one({
        "$or": [
            {"user_id": current_user["id"], "restricted_user_id": user_id},
            {"restricter_id": current_user["id"], "restricted_id": user_id}
        ]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Bu kullanıcı zaten kısıtlı")
    
    # Use field names consistent with server.py
    await db.restricted_users.insert_one({
        "id": str(uuid.uuid4()),
        "restricter_id": current_user["id"],
        "restricted_id": user_id,
        "restricted_username": target_user["username"],
        "created_at": now
    })
    
    return {"message": f"@{target_user['username']} kısıtlandı"}


@router.delete("/restrict/{user_id}")
async def unrestrict_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Kullanıcı kısıtlamasını kaldır"""
    # Support both old and new field names
    result = await db.restricted_users.delete_one({
        "$or": [
            {"user_id": current_user["id"], "restricted_user_id": user_id},
            {"restricter_id": current_user["id"], "restricted_id": user_id}
        ]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bu kullanıcı kısıtlı değil")
    
    return {"message": "Kullanıcı kısıtlaması kaldırıldı"}


@router.get("/restricted")
async def get_restricted_users(current_user: dict = Depends(get_current_user)):
    """Kısıtlanan kullanıcıları listele"""
    # Support both old and new field names
    restricted = await db.restricted_users.find({
        "$or": [
            {"user_id": current_user["id"]},
            {"restricter_id": current_user["id"]}
        ]
    }, {"_id": 0}).to_list(100)
    
    # Get user details - support both field name patterns
    restricted_ids = []
    for r in restricted:
        rid = r.get("restricted_user_id") or r.get("restricted_id")
        if rid:
            restricted_ids.append(rid)
    
    users = await db.users.find(
        {"id": {"$in": restricted_ids}},
        {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
    ).to_list(100)
    
    user_map = {u["id"]: u for u in users}
    
    result = []
    for r in restricted:
        rid = r.get("restricted_user_id") or r.get("restricted_id")
        user = user_map.get(rid, {})
        result.append({
            **r,
            "user": user
        })
    
    return result


@router.get("/is-restricted/{user_id}")
async def check_restrict_status(user_id: str, current_user: dict = Depends(get_current_user)):
    """Kullanıcının kısıtlı olup olmadığını kontrol et"""
    restricted = await db.restricted_users.find_one({
        "$or": [
            {"user_id": current_user["id"], "restricted_user_id": user_id},
            {"restricter_id": current_user["id"], "restricted_id": user_id}
        ]
    })
    
    return {"is_restricted": restricted is not None}


# ============================================
# CLOSE FRIENDS (YAKIN ARKADAŞLAR)
# ============================================

@router.post("/close-friends/{user_id}")
async def add_close_friend(user_id: str, current_user: dict = Depends(get_current_user)):
    """Yakın arkadaşlar listesine ekle"""
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Kendinizi yakın arkadaş olarak ekleyemezsiniz")
    
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "username": 1})
    if not target_user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    # Check if already close friend
    existing = await db.close_friends.find_one({
        "user_id": current_user["id"],
        "friend_id": user_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Bu kullanıcı zaten yakın arkadaşınız")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.close_friends.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "friend_id": user_id,
        "friend_username": target_user["username"],
        "created_at": now
    })
    
    return {"message": f"@{target_user['username']} yakın arkadaşlarınıza eklendi"}


@router.delete("/close-friends/{user_id}")
async def remove_close_friend(user_id: str, current_user: dict = Depends(get_current_user)):
    """Yakın arkadaşlar listesinden çıkar"""
    result = await db.close_friends.delete_one({
        "user_id": current_user["id"],
        "friend_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bu kullanıcı yakın arkadaşlarınızda değil")
    
    return {"message": "Yakın arkadaşlardan çıkarıldı"}


@router.get("/close-friends")
async def get_close_friends(current_user: dict = Depends(get_current_user)):
    """Yakın arkadaşlar listesini getir"""
    friends = await db.close_friends.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    # Get user details
    friend_ids = [f["friend_id"] for f in friends]
    users = await db.users.find(
        {"id": {"$in": friend_ids}},
        {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
    ).to_list(100)
    
    user_map = {u["id"]: u for u in users}
    
    result = []
    for f in friends:
        user = user_map.get(f["friend_id"], {})
        result.append({
            **f,
            "user": user
        })
    
    return result


@router.get("/is-close-friend/{user_id}")
async def check_close_friend_status(user_id: str, current_user: dict = Depends(get_current_user)):
    """Kullanıcının yakın arkadaş olup olmadığını kontrol et"""
    friend = await db.close_friends.find_one({
        "user_id": current_user["id"],
        "friend_id": user_id
    })
    
    return {"is_close_friend": friend is not None}


# ============================================
# REHBERDEN ARKADAŞ BULMA (CONTACTS)
# ============================================

class ContactsFindBody(BaseModel):
    phones: List[str] = []
    emails: List[str] = []

@router.post("/contacts/find")
async def find_contacts(
    body: ContactsFindBody,
    current_user: dict = Depends(get_current_user)
):
    """Rehberden arkadaş bul - email ile eşleşen kullanıcıları getir (telefon için users.phone gerekir)."""
    phones = body.phones or []
    emails = body.emails or []
    
    if not phones and not emails:
        return []
    
    or_conditions = []
    
    if emails:
        norm_emails = [e.strip().lower() for e in emails if e and "@" in str(e)]
        if norm_emails:
            or_conditions.append({"email": {"$in": norm_emails}})
    
    # Phone: users.phone varsa son 9 rakamı eşleştir
    seen_suffixes = set()
    for p in (phones or []):
        digits = "".join(c for c in str(p) if c.isdigit())
        if len(digits) >= 9 and digits not in seen_suffixes:
            suffix = digits[-9:]
            seen_suffixes.add(suffix)
            or_conditions.append({"phone": {"$regex": f".*{suffix}$"}})
    
    if not or_conditions:
        return []
    
    following = await db.follows.find({"follower_id": current_user["id"]}, {"following_id": 1}).to_list(1000)
    following_ids = [f["following_id"] for f in following]
    following_ids.append(current_user["id"])
    
    users = await db.users.find(
        {"id": {"$nin": following_ids}, "$or": or_conditions},
        {"_id": 0, "password": 0, "email": 0}
    ).limit(50).to_list(50)
    
    return users


# ============================================
# QR CODE PROFILE SHARING
# ============================================

@router.get("/qr-code")
async def get_profile_qr_code(current_user: dict = Depends(get_current_user)):
    """Profil QR kodunu oluştur"""
    try:
        # Profile URL
        profile_url = f"socialbeats://profile/{current_user['username']}"
        
        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(profile_url)
        qr.make(fit=True)
        
        # Create image
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        qr_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return {
            "qr_code": f"data:image/png;base64,{qr_base64}",
            "profile_url": profile_url,
            "username": current_user["username"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"QR kod oluşturulamadı: {str(e)}")


@router.get("/qr-code/{username}")
async def get_user_qr_code(username: str):
    """Belirli bir kullanıcının QR kodunu oluştur"""
    user = await db.users.find_one({"username": username}, {"_id": 0, "id": 1, "username": 1})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    try:
        profile_url = f"socialbeats://profile/{username}"
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(profile_url)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        qr_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        
        return {
            "qr_code": f"data:image/png;base64,{qr_base64}",
            "profile_url": profile_url,
            "username": username
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"QR kod oluşturulamadı: {str(e)}")


# ============================================
# POST ARCHIVE (ARŞİV)
# ============================================

@router.post("/archive/post/{post_id}")
async def archive_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Gönderiyi arşivle - başkalarından gizle ama silme"""
    post = await db.posts.find_one({"id": post_id, "user_id": current_user["id"]})
    if not post:
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.posts.update_one(
        {"id": post_id},
        {"$set": {
            "is_archived": True,
            "archived_at": now
        }}
    )
    
    return {"message": "Gönderi arşivlendi"}


@router.post("/archive/post/{post_id}/restore")
async def restore_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Arşivlenmiş gönderiyi geri yükle"""
    post = await db.posts.find_one({"id": post_id, "user_id": current_user["id"]})
    if not post:
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı")
    
    await db.posts.update_one(
        {"id": post_id},
        {"$set": {"is_archived": False}, "$unset": {"archived_at": ""}}
    )
    
    return {"message": "Gönderi geri yüklendi"}


@router.get("/archive/posts")
async def get_archived_posts(current_user: dict = Depends(get_current_user)):
    """Arşivlenmiş gönderileri listele"""
    posts = await db.posts.find(
        {"user_id": current_user["id"], "is_archived": True},
        {"_id": 0}
    ).sort("archived_at", -1).to_list(100)
    
    return posts


@router.post("/archive/story/{story_id}")
async def archive_story(story_id: str, current_user: dict = Depends(get_current_user)):
    """Hikayeyi arşivle (24 saat sonra otomatik arşivlenir)"""
    story = await db.stories.find_one({"id": story_id, "user_id": current_user["id"]})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.stories.update_one(
        {"id": story_id},
        {"$set": {
            "is_archived": True,
            "archived_at": now
        }}
    )
    
    return {"message": "Hikaye arşivlendi"}


@router.get("/archive/stories")
async def get_archived_stories(current_user: dict = Depends(get_current_user)):
    """Arşivlenmiş hikayeleri listele"""
    stories = await db.stories.find(
        {"user_id": current_user["id"], "is_archived": True},
        {"_id": 0}
    ).sort("archived_at", -1).to_list(100)
    
    return stories


# ============================================
# INTERACTION STATUS CHECK
# ============================================

@router.get("/interaction-status/{user_id}")
async def get_interaction_status(user_id: str, current_user: dict = Depends(get_current_user)):
    """Bir kullanıcıyla olan tüm etkileşim durumlarını getir"""
    # Check all statuses
    is_blocked = await db.blocked_users.find_one({
        "blocker_id": current_user["id"],
        "blocked_id": user_id
    }) is not None
    
    is_muted = await db.muted_users.find_one({
        "user_id": current_user["id"],
        "muted_user_id": user_id
    })
    
    # Check restricted - use both possible field names for compatibility
    is_restricted_new = await db.restricted_users.find_one({
        "user_id": current_user["id"],
        "restricted_user_id": user_id
    })
    is_restricted_old = await db.restricted_users.find_one({
        "restricter_id": current_user["id"],
        "restricted_id": user_id
    })
    is_restricted = (is_restricted_new is not None) or (is_restricted_old is not None)
    
    is_close_friend = await db.close_friends.find_one({
        "user_id": current_user["id"],
        "friend_id": user_id
    }) is not None
    
    is_following = await db.follows.find_one({
        "follower_id": current_user["id"],
        "following_id": user_id
    }) is not None
    
    is_follower = await db.follows.find_one({
        "follower_id": user_id,
        "following_id": current_user["id"]
    }) is not None
    
    return {
        "user_id": user_id,
        "is_blocked": is_blocked,
        "is_muted": is_muted is not None,
        "mute_stories": is_muted.get("mute_stories", False) if is_muted else False,
        "mute_posts": is_muted.get("mute_posts", False) if is_muted else False,
        "is_restricted": is_restricted,
        "is_close_friend": is_close_friend,
        "is_following": is_following,
        "is_follower": is_follower,
        "is_mutual": is_following and is_follower
    }


# ============================================
# BLOCK (ENGELLEME) - Kullanıcıyı engelle/kaldır
# ============================================

@router.post("/block/{user_id}")
async def block_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Kendinizi engelleyemezsiniz")

    existing = await db.blocked_users.find_one({
        "blocker_id": current_user["id"],
        "blocked_id": user_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Zaten engellenmiş")

    await db.blocked_users.insert_one({
        "id": str(uuid.uuid4()),
        "blocker_id": current_user["id"],
        "blocked_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    await db.follows.delete_one({"follower_id": current_user["id"], "following_id": user_id})
    await db.follows.delete_one({"follower_id": user_id, "following_id": current_user["id"]})
    await db.close_friends.delete_one({"user_id": current_user["id"], "friend_id": user_id})

    return {"success": True, "message": "Kullanıcı engellendi"}


@router.delete("/block/{user_id}")
async def unblock_user(user_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.blocked_users.delete_one({
        "blocker_id": current_user["id"],
        "blocked_id": user_id
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Engel bulunamadı")

    return {"success": True, "message": "Engel kaldırıldı"}


@router.get("/blocked")
async def get_blocked_users(current_user: dict = Depends(get_current_user)):
    blocks = await db.blocked_users.find(
        {"blocker_id": current_user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)

    users = []
    for b in blocks:
        u = await db.users.find_one({"id": b["blocked_id"]}, {"_id": 0, "password": 0})
        if u:
            u["blocked_at"] = b.get("created_at")
            users.append(u)

    return {"users": users}


# ============================================
# REPORT (RAPOR ETME) - 9 farklı nedenle rapor
# ============================================

REPORT_REASONS = [
    "spam", "harassment", "hate_speech", "violence",
    "nudity", "false_info", "impersonation",
    "intellectual_property", "other"
]

@router.post("/report")
async def report_user_or_content(data: dict, current_user: dict = Depends(get_current_user)):
    target_id = data.get("target_id")
    target_type = data.get("target_type", "user")
    reason = data.get("reason")
    details = data.get("details", "")

    if not target_id or not reason:
        raise HTTPException(status_code=400, detail="target_id ve reason gerekli")
    if reason not in REPORT_REASONS:
        raise HTTPException(status_code=400, detail=f"Geçersiz neden. Geçerli: {', '.join(REPORT_REASONS)}")

    existing = await db.reports.find_one({
        "reporter_id": current_user["id"],
        "target_id": target_id,
        "target_type": target_type,
        "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Bu içerik zaten rapor edilmiş")

    report = {
        "id": str(uuid.uuid4()),
        "reporter_id": current_user["id"],
        "target_id": target_id,
        "target_type": target_type,
        "content_type": target_type,
        "content_id": target_id,
        "reason": reason,
        "details": details,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.reports.insert_one(report)

    return {"success": True, "message": "Rapor gönderildi", "report_id": report["id"]}


# ============================================
# SUGGESTED USERS (ÖNERİLEN KİŞİLER)
# ============================================

@router.get("/suggested-users")
async def get_suggested_users(current_user: dict = Depends(get_current_user)):
    my_following = await db.follows.find(
        {"follower_id": current_user["id"]}, {"following_id": 1}
    ).to_list(1000)
    following_ids = {f["following_id"] for f in my_following}
    following_ids.add(current_user["id"])

    blocked = await db.blocked_users.find(
        {"$or": [{"blocker_id": current_user["id"]}, {"blocked_id": current_user["id"]}]}
    ).to_list(500)
    blocked_ids = {b.get("blocker_id") for b in blocked} | {b.get("blocked_id") for b in blocked}

    exclude_ids = following_ids | blocked_ids

    my_genres = current_user.get("favorite_genres", [])
    my_artists = current_user.get("favorite_artists", [])

    candidates = await db.users.find(
        {"id": {"$nin": list(exclude_ids)}},
        {"_id": 0, "password": 0}
    ).to_list(200)

    scored_users = []
    for u in candidates:
        score = 0
        u_genres = u.get("favorite_genres", [])
        u_artists = u.get("favorite_artists", [])
        common_genres = set(my_genres) & set(u_genres)
        common_artists = set(my_artists) & set(u_artists)
        score += len(common_genres) * 3
        score += len(common_artists) * 5

        mutual_followers = await db.follows.count_documents({
            "follower_id": u["id"],
            "following_id": {"$in": list(following_ids - {current_user["id"]})}
        })
        score += mutual_followers * 2
        u["mutual_friends"] = mutual_followers
        u["common_genres"] = list(common_genres)
        u["score"] = score
        scored_users.append(u)

    scored_users.sort(key=lambda x: x["score"], reverse=True)
    return {"users": scored_users[:30]}


# ============================================
# POPULAR USERS (POPÜLER KULLANICILAR)
# ============================================

@router.get("/popular-users")
async def get_popular_users(current_user: dict = Depends(get_current_user)):
    blocked = await db.blocked_users.find(
        {"$or": [{"blocker_id": current_user["id"]}, {"blocked_id": current_user["id"]}]}
    ).to_list(500)
    blocked_ids = {b.get("blocker_id") for b in blocked} | {b.get("blocked_id") for b in blocked}
    blocked_ids.discard(current_user["id"])

    all_users = await db.users.find(
        {"id": {"$nin": list(blocked_ids | {current_user["id"]})}},
        {"_id": 0, "password": 0}
    ).to_list(500)

    for u in all_users:
        follower_count = await db.follows.count_documents({"following_id": u["id"]})
        post_count = await db.posts.count_documents({"user_id": u["id"], "deleted": {"$ne": True}})
        u["followers_count"] = follower_count
        u["posts_count"] = post_count
        u["popularity_score"] = follower_count * 2 + post_count

    all_users.sort(key=lambda x: x["popularity_score"], reverse=True)
    return {"users": all_users[:30]}


# ============================================
# FIND FROM CONTACTS (REHBERDEN ARKADAŞ BULMA)
# ============================================

@router.post("/find-by-phone")
async def find_users_by_phone(data: dict, current_user: dict = Depends(get_current_user)):
    phone_numbers = data.get("phone_numbers", [])
    if not phone_numbers:
        raise HTTPException(status_code=400, detail="Telefon numarası listesi gerekli")

    normalized = []
    for p in phone_numbers:
        clean = "".join(c for c in str(p) if c.isdigit())
        if len(clean) >= 7:
            normalized.append(clean)
            if not clean.startswith("90") and len(clean) == 10:
                normalized.append("90" + clean)

    found_users = await db.users.find(
        {
            "$or": [
                {"phone": {"$in": normalized}},
                {"phone_number": {"$in": normalized}}
            ],
            "id": {"$ne": current_user["id"]}
        },
        {"_id": 0, "password": 0}
    ).to_list(200)

    my_following = await db.follows.find(
        {"follower_id": current_user["id"]}, {"following_id": 1}
    ).to_list(1000)
    following_ids = {f["following_id"] for f in my_following}

    for u in found_users:
        u["is_following"] = u["id"] in following_ids

    return {"users": found_users, "total": len(found_users)}


# ============================================
# GENERAL SHARE TRACKING
# ============================================

@router.post("/share")
async def track_share(data: dict, current_user: dict = Depends(get_current_user)):
    share_record = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "content_type": data.get("type", "unknown"),
        "content_id": data.get("id", ""),
        "platform": data.get("platform", "other"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.share_analytics.insert_one(share_record)
    return {"ok": True}
