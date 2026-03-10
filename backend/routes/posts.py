# Posts Router - Gönderi işlemleri için modüler API
# server.py'den ayrılmış posts endpoint'leri

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from datetime import datetime, timezone
from typing import Optional, List, Dict
from pydantic import BaseModel, ConfigDict
import uuid
import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import db
from core.auth import get_current_user

router = APIRouter(tags=["Posts"])

# Content moderator import (try-except for flexibility)
try:
    from services.content_moderation import content_moderator
    MODERATION_ENABLED = True
except:
    MODERATION_ENABLED = False
    content_moderator = None


async def _async_moderate_post(post_id: str, content: str):
    """Arka planda gönderiyi denetle, güvenli degilse yayindan kaldir (soft delete)"""
    if not MODERATION_ENABLED or not content_moderator or not content:
        return
    try:
        text_check = await content_moderator.check_text_toxicity(content)
        if not text_check.get("safe", True):
            # Safe degilse gizli yap / soft delete yap
            await db.posts.update_one(
                {"id": post_id},
                {"$set": {"visibility": "hidden", "deleted": True, "moderation_reason": "toxic_content"}}
            )
            try:
                from services.meilisearch_service import meili_service
                await meili_service.delete_document(meili_service.INDEX_POSTS, post_id)
            except:
                pass
    except Exception as e:
        print(f"Async moderation failed: {e}")


# ============================================
# MODELS
# ============================================

class Track(BaseModel):
    id: str
    title: str
    artist: str
    duration: str
    cover_url: Optional[str] = None

class PostCreate(BaseModel):
    content: str
    post_type: str = "text"
    track_id: Optional[str] = None
    playlist_id: Optional[str] = None
    mood: Optional[str] = None
    rating: Optional[int] = None
    media_urls: List[str] = []
    visibility: str = "public"
    allow_comments: bool = True
    poll_options: Optional[List[str]] = None
    tags: List[str] = []
    location: Optional[str] = None
    location_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class Post(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    username: str
    user_avatar: Optional[str] = None
    user_display_name: Optional[str] = None
    is_verified: bool = False
    user_level: int = 1
    content: str
    post_type: str
    track: Optional[Track] = None
    playlist: Optional[dict] = None
    mood: Optional[str] = None
    rating: Optional[int] = None
    media_urls: List[str] = []
    visibility: str = "public"
    allow_comments: bool = True
    poll_options: List[dict] = []
    tags: List[str] = []
    mentions: List[str] = []
    hashtags: List[str] = []
    reactions: Dict[str, int] = {}
    comments_count: int = 0
    shares_count: int = 0
    user_reaction: Optional[str] = None
    created_at: str
    is_pinned: bool = False
    is_saved: bool = False


# ============================================
# HELPER FUNCTIONS
# ============================================

async def notify_user(recipient_id: str, sender_id: str, notification_type: str, 
                      title: str, body: str, data: dict = None):
    """Send notification to user"""
    now = datetime.now(timezone.utc).isoformat()
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": recipient_id,
        "type": notification_type,
        "title": title,
        "body": body,
        "data": data or {},
        "sender_id": sender_id,
        "read": False,
        "created_at": now
    })


async def add_xp(user_id: str, amount: int):
    """Add XP to user"""
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"xp": amount}}
    )


# ============================================
# HASHTAG SUGGESTIONS
# ============================================

@router.get("/social/hashtags/suggestions")
async def get_hashtag_suggestions(q: str = "", limit: int = 15, current_user: dict = Depends(get_current_user)):
    """Hashtag önerileri - Meilisearch (ana) veya MongoDB (yedek)"""
    try:
        from services.meilisearch_service import meili_service
        if meili_service.is_available() and q:
            res = await meili_service.search_hashtags(q, limit)
            hits = res.get("hits", [])
            return {"hashtags": [{"tag": h.get("tag", h.get("id", "")), "count": h.get("post_count", 0)} for h in hits]}
    except Exception:
        pass
    if q:
        pipeline = [
            {"$match": {"hashtags": {"$regex": f"^{re.escape(q)}", "$options": "i"}}},
            {"$unwind": "$hashtags"},
            {"$match": {"hashtags": {"$regex": f"^{re.escape(q)}", "$options": "i"}}},
            {"$group": {"_id": "$hashtags", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": limit},
        ]
    else:
        pipeline = [
            {"$unwind": "$hashtags"},
            {"$group": {"_id": "$hashtags", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": limit},
        ]
    results = await db.posts.aggregate(pipeline).to_list(limit)
    return {"hashtags": [{"tag": r["_id"], "count": r["count"]} for r in results]}


@router.get("/social/search/mentions")
async def search_mentions(q: str, limit: int = 10, current_user: dict = Depends(get_current_user)):
    """@ ile etiketleme - Meilisearch users arama"""
    try:
        from services.meilisearch_service import meili_service
        if meili_service.is_available():
            res = await meili_service.search_users(q, limit)
            return {"users": res.get("hits", [])}
    except Exception:
        pass
    users = await db.users.find(
        {"username": {"$regex": f"^{re.escape(q)}", "$options": "i"}, "is_private": {"$ne": True}},
        {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
    ).limit(limit).to_list(limit)
    return {"users": users}


# ============================================
# STATIC ROUTES (must be before dynamic {post_id} routes)
# ============================================

@router.get("/social/posts/archived")
async def get_archived_posts(
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Arşivlenmiş gönderileri getir (sadece kendi)"""
    skip = (page - 1) * limit
    posts = await db.posts.find(
        {"user_id": current_user["id"], "is_archived": True},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    for post in posts:
        r = await db.post_reactions.find_one({"post_id": post["id"], "user_id": current_user["id"]})
        post["user_reaction"] = r["reaction_type"] if r else None
        post["is_saved"] = True
    return posts


@router.get("/social/posts/tagged/{username}")
async def get_tagged_posts(
    username: str,
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Etiketlendiği gönderileri getir (mentions içinde bu kullanıcı olan)"""
    user_doc = await db.users.find_one({"username": username}, {"id": 1})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    user_id = user_doc["id"]

    skip = (page - 1) * limit
    posts = await db.posts.find(
        {"mentions": username, "is_archived": {"$ne": True}, "visibility": "public"},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    for post in posts:
        r = await db.post_reactions.find_one({"post_id": post["id"], "user_id": current_user["id"]})
        post["user_reaction"] = r["reaction_type"] if r else None
        s = await db.saved_posts.find_one({"post_id": post["id"], "user_id": current_user["id"]})
        post["is_saved"] = s is not None

    return posts


@router.get("/social/posts/saved")
async def get_saved_posts(
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Kaydedilen gönderileri getir"""
    skip = (page - 1) * limit
    
    saved = await db.saved_posts.find(
        {"user_id": current_user["id"]},
        {"post_id": 1}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    post_ids = [s["post_id"] for s in saved]
    
    posts = await db.posts.find(
        {"id": {"$in": post_ids}},
        {"_id": 0}
    ).to_list(limit)
    
    # Add is_saved flag
    for post in posts:
        post["is_saved"] = True
    
    return posts


@router.get("/social/posts/liked")
async def get_liked_posts(
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    skip = (page - 1) * limit

    likes = await db.post_likes.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    post_ids = [lk.get("post_id") for lk in likes if lk.get("post_id")]

    if not post_ids:
        reacts = await db.post_reactions.find(
            {"user_id": current_user["id"]},
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        post_ids = [r.get("post_id") for r in reacts if r.get("post_id")]

    posts = []
    if post_ids:
        posts = await db.posts.find(
            {"id": {"$in": post_ids}, "deleted": {"$ne": True}},
            {"_id": 0}
        ).to_list(limit)

    for post in posts:
        user = await db.users.find_one(
            {"id": post.get("user_id")},
            {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1, "is_verified": 1}
        )
        if user:
            post["user"] = user
        post["is_liked"] = True

    return {"posts": posts}


# ============================================
# POST CRUD OPERATIONS
# ============================================

@router.post("/social/posts/{post_id}/media")
async def upload_post_media(
    post_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload media file for a post - R2 (ana) veya base64 (yedek)"""
    post = await db.posts.find_one({"id": post_id, "user_id": current_user["id"]})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    contents = await file.read()
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    content_type = file.content_type or f"image/{ext}"
    media_type = "video" if "video" in content_type else "image"
    url = None
    try:
        from services.storage_service import upload_file as storage_upload
        url = storage_upload(contents, f"post_{post_id}_{uuid.uuid4().hex}.{ext}", content_type, "posts")
    except Exception:
        pass
    if not url:
        import base64
        url = f"data:{content_type};base64,{base64.b64encode(contents).decode()}"

    media_item = {
        "id": str(uuid.uuid4()),
        "url": url,
        "type": media_type,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    await db.posts.update_one(
        {"id": post_id},
        {"$push": {"media": media_item, "media_urls": url}, "$set": {"has_media": True, "media_type": media_type}}
    )
    return {"media": media_item}


@router.post("/social/posts")
async def create_post(post_data: PostCreate, current_user: dict = Depends(get_current_user)):
    """Yeni gönderi oluştur"""
    # Text moderation is now handled asynchronously below
    pass
    
    post_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Extract mentions and hashtags
    mentions = re.findall(r'@(\w+)', post_data.content or "")
    hashtags = re.findall(r'#(\w+)', post_data.content or "")
    
    # Get playlist if provided
    playlist = None
    if post_data.playlist_id:
        playlist_doc = await db.playlists.find_one({"id": post_data.playlist_id}, {"_id": 0})
        if playlist_doc:
            playlist = {"id": playlist_doc["id"], "name": playlist_doc["name"], "cover_url": playlist_doc.get("cover_url")}
    
    # Poll options
    poll_options = []
    if post_data.poll_options:
        poll_options = [{"text": opt, "votes": 0, "voters": []} for opt in post_data.poll_options]
    
    post = {
        "id": post_id,
        "user_id": current_user["id"],
        "username": current_user["username"],
        "user_avatar": current_user.get("avatar_url"),
        "user_display_name": current_user.get("display_name"),
        "is_verified": current_user.get("is_verified", False),
        "user_level": current_user.get("level", 1),
        "content": post_data.content,
        "post_type": post_data.post_type,
        "track": None,
        "playlist": playlist,
        "mood": post_data.mood,
        "rating": post_data.rating,
        "media_urls": post_data.media_urls,
        "visibility": post_data.visibility,
        "allow_comments": post_data.allow_comments,
        "poll_options": poll_options,
        "tags": post_data.tags,
        "mentions": mentions,
        "hashtags": hashtags,
        "reactions": {"heart": 0, "fire": 0, "applause": 0, "thinking": 0, "sad": 0},
        "comments_count": 0,
        "shares_count": 0,
        "views_count": 0,
        "created_at": now,
        "is_pinned": False,
        "location": post_data.location,
        "location_name": post_data.location_name,
        "latitude": post_data.latitude,
        "longitude": post_data.longitude,
    }
    
    await db.posts.insert_one(post)
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"posts_count": 1}})

    try:
        from services.postgres_posts_service import create_post_pg
        await create_post_pg(
            user_id=current_user["id"], content=post_data.content,
            media_urls=post_data.media_urls or [],
            location_name=post_data.location_name, latitude=post_data.latitude, longitude=post_data.longitude,
            mentions=mentions, hashtags=hashtags,
            visibility=post_data.visibility, allow_comments=post_data.allow_comments,
            post_id=post_id,
        )
    except Exception:
        pass

    try:
        from services.meilisearch_service import meili_service
        await meili_service.index_post(post)
    except Exception:
        pass
    try:
        from services.trench_service import track, is_available
        if is_available():
            await track("post_created", current_user["id"], {"post_id": post_id, "post_type": post_data.post_type})
    except Exception:
        pass
    # Yeni içerik bildirimi: takipçilere Trench + Expo Push
    try:
        import asyncio
        from server import send_push_notification
        followers = await db.follows.find(
            {"following_id": current_user["id"]},
            {"follower_id": 1}
        ).to_list(500)
        title = "Yeni gönderi"
        body = f"@{current_user['username']} yeni bir gönderi paylaştı."
        data = {"type": "new_content", "post_id": post_id, "user_id": current_user["id"]}
        for f in followers:
            uid = f.get("follower_id")
            if uid and uid != current_user["id"]:
                asyncio.create_task(send_push_notification(
                    uid, title, body, "new_content", data, sender_id=current_user["id"]
                ))
    except Exception:
        pass
    # Add XP
    await add_xp(current_user["id"], 10)
    
    # Asenkron Moderasyon Baslat
    if MODERATION_ENABLED and post_data.content:
        try:
            import asyncio
            loop = asyncio.get_running_loop()
            loop.create_task(_async_moderate_post(post_id, post_data.content))
        except Exception:
            pass
    
    # Send mention notifications
    if mentions:
        mentioned_users = await db.users.find(
            {"username": {"$in": mentions}},
            {"_id": 0, "id": 1, "username": 1}
        ).to_list(50)
        
        for mentioned_user in mentioned_users:
            if mentioned_user["id"] != current_user["id"]:
                await notify_user(
                    recipient_id=mentioned_user["id"],
                    sender_id=current_user["id"],
                    notification_type="mention",
                    title="Bir Gönderide Etiketlendin",
                    body=f"@{current_user['username']} seni bir gönderide etiketledi",
                    data={"url": f"post/{post_id}", "type": "mention", "post_id": post_id}
                )
    
    post.pop("_id", None)
    return {**post, "user_reaction": None, "is_saved": False}


@router.get("/social/posts/{post_id}/related")
async def get_related_posts(post_id: str, limit: int = 5, current_user: dict = Depends(get_current_user)):
    """İlgili gönderileri getir (aynı kullanıcı veya aynı hashtag)"""
    post = await db.posts.find_one({"id": post_id}, {"_id": 0, "user_id": 1, "hashtags": 1})
    if not post:
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı")
    
    blocked = await db.blocked_users.find({
        "$or": [
            {"blocker_id": current_user["id"]},
            {"blocked_id": current_user["id"]}
        ]
    }).to_list(1000)
    blocked_ids = list(set(b.get("blocker_id") for b in blocked if b.get("blocker_id")) | set(b.get("blocked_id") for b in blocked if b.get("blocked_id")))
    blocked_ids = [x for x in blocked_ids if x and x != current_user["id"]]
    
    query = {
        "id": {"$ne": post_id},
        "user_id": {"$nin": blocked_ids},
        "is_archived": {"$ne": True},
        "visibility": "public"
    }
    
    # Try same user first, then same hashtags
    or_conditions = [{"user_id": post["user_id"]}]
    if post.get("hashtags"):
        or_conditions.append({"hashtags": {"$in": post["hashtags"]}})
    
    related = await db.posts.find(
        {**query, "$or": or_conditions},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    for p in related:
        r = await db.post_reactions.find_one({"post_id": p["id"], "user_id": current_user["id"]})
        p["user_reaction"] = r["reaction_type"] if r else None
        s = await db.saved_posts.find_one({"post_id": p["id"], "user_id": current_user["id"]})
        p["is_saved"] = s is not None
    
    return related


@router.get("/social/posts/archived")
async def get_archived_posts(
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Arşivlenmiş gönderileri getir (sadece kendi)"""
    skip = (page - 1) * limit
    posts = await db.posts.find(
        {"user_id": current_user["id"], "is_archived": True},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    for post in posts:
        r = await db.post_reactions.find_one({"post_id": post["id"], "user_id": current_user["id"]})
        post["user_reaction"] = r["reaction_type"] if r else None
        post["is_saved"] = True  # archived implies user cares
    return posts


@router.get("/social/posts/{post_id}")
async def get_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Tek bir gönderiyi getir"""
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı")
    
    # Check block status
    blocked = await db.blocked_users.find_one({
        "$or": [
            {"blocker_id": current_user["id"], "blocked_id": post["user_id"]},
            {"blocker_id": post["user_id"], "blocked_id": current_user["id"]}
        ]
    })
    
    if blocked:
        raise HTTPException(status_code=403, detail="Bu gönderiyi görüntüleyemezsiniz")
    
    # Get user reaction
    reaction = await db.post_reactions.find_one({
        "post_id": post_id,
        "user_id": current_user["id"]
    })
    post["user_reaction"] = reaction["reaction_type"] if reaction else None
    
    # Check if saved
    saved = await db.saved_posts.find_one({
        "post_id": post_id,
        "user_id": current_user["id"]
    })
    post["is_saved"] = saved is not None

    # Increment views_count on view
    await db.posts.update_one(
        {"id": post_id},
        {"$inc": {"views_count": 1}}
    )
    post["views_count"] = post.get("views_count", 0) + 1
    try:
        from services.postgres_posts_service import increment_view_pg
        from services.analytics_service import track_view
        await increment_view_pg(post_id, current_user["id"])
        await track_view("post_viewed", current_user["id"], post_id, "post")
    except Exception:
        pass
    
    return post


@router.delete("/social/posts/{post_id}")
async def delete_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Gönderiyi sil"""
    post = await db.posts.find_one({"id": post_id, "user_id": current_user["id"]})
    if not post:
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı")
    
    await db.posts.delete_one({"id": post_id})
    await db.comments.delete_many({"post_id": post_id})
    await db.post_reactions.delete_many({"post_id": post_id})
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"posts_count": -1}})
    try:
        from services.postgres_posts_service import delete_post_pg
        await delete_post_pg(post_id, current_user["id"])
    except Exception:
        pass
    
    return {"message": "Gönderi silindi"}


@router.put("/social/posts/{post_id}")
async def update_post(post_id: str, post_data: PostCreate, current_user: dict = Depends(get_current_user)):
    """Gönderiyi güncelle"""
    post = await db.posts.find_one({"id": post_id, "user_id": current_user["id"]})
    if not post:
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı")
    
    # Extract mentions and hashtags
    mentions = re.findall(r'@(\w+)', post_data.content or "")
    hashtags = re.findall(r'#(\w+)', post_data.content or "")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.posts.update_one(
        {"id": post_id},
        {"$set": {
            "content": post_data.content,
            "mentions": mentions,
            "hashtags": hashtags,
            "media_urls": post_data.media_urls,
            "visibility": post_data.visibility,
            "allow_comments": post_data.allow_comments,
            "updated_at": now
        }}
    )
    try:
        from services.postgres_posts_service import update_post_pg
        await update_post_pg(post_id, current_user["id"],
            content=post_data.content, media_urls=post_data.media_urls,
            visibility=post_data.visibility, allow_comments=post_data.allow_comments,
            mentions=mentions, hashtags=hashtags,
        )
    except Exception:
        pass
    return {"message": "Gönderi güncellendi"}


# ============================================
# POST REACTIONS
# ============================================

@router.post("/social/posts/{post_id}/react")
async def react_to_post(post_id: str, data: dict = None, reaction_type: str = None, current_user: dict = Depends(get_current_user)):
    """Gönderiye tepki ver"""
    EMOJI_MAP = {"❤️": "heart", "🔥": "fire", "👏": "applause", "😂": "thinking", "😮": "thinking", "😢": "sad"}
    if data and isinstance(data, dict):
        raw = data.get("emoji") or data.get("reaction_type") or data.get("type", "heart")
        reaction_type = EMOJI_MAP.get(raw, raw)
    elif not reaction_type:
        reaction_type = "heart"

    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı")
    
    valid_reactions = ["heart", "fire", "applause", "thinking", "sad"]
    if reaction_type not in valid_reactions:
        reaction_type = "heart"
    
    existing = await db.post_reactions.find_one({
        "post_id": post_id,
        "user_id": current_user["id"]
    })
    
    if existing:
        old_type = existing["reaction_type"]
        if old_type == reaction_type:
            # Remove reaction
            await db.post_reactions.delete_one({"_id": existing["_id"]})
            await db.posts.update_one(
                {"id": post_id},
                {"$inc": {f"reactions.{reaction_type}": -1}}
            )
            return {"message": "Tepki kaldırıldı", "action": "removed"}
        else:
            # Change reaction
            await db.post_reactions.update_one(
                {"_id": existing["_id"]},
                {"$set": {"reaction_type": reaction_type}}
            )
            await db.posts.update_one(
                {"id": post_id},
                {"$inc": {
                    f"reactions.{old_type}": -1,
                    f"reactions.{reaction_type}": 1
                }}
            )
            return {"message": "Tepki değiştirildi", "action": "changed", "new_type": reaction_type}
    else:
        # New reaction
        await db.post_reactions.insert_one({
            "id": str(uuid.uuid4()),
            "post_id": post_id,
            "user_id": current_user["id"],
            "reaction_type": reaction_type,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.posts.update_one(
            {"id": post_id},
            {"$inc": {f"reactions.{reaction_type}": 1}}
        )
        try:
            from services.analytics_service import track_post_like
            await track_post_like(post_id, current_user["id"], reaction_type)
        except Exception:
            pass
        try:
            from services.postgres_posts_service import like_post_pg
            await like_post_pg(post_id, current_user["id"])
        except Exception:
            pass

        # Notify post owner
        if post["user_id"] != current_user["id"]:
            await notify_user(
                recipient_id=post["user_id"],
                sender_id=current_user["id"],
                notification_type="like",
                title="Yeni Tepki",
                body=f"@{current_user['username']} gönderine {reaction_type} tepkisi verdi",
                data={"post_id": post_id, "type": "reaction"}
            )
        
        return {"message": "Tepki eklendi", "action": "added", "type": reaction_type}


# ============================================
# SAVE/UNSAVE POST
# ============================================

@router.post("/social/posts/{post_id}/save")
async def save_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Gönderiyi kaydet"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı")
    
    existing = await db.saved_posts.find_one({
        "post_id": post_id,
        "user_id": current_user["id"]
    })
    
    if existing:
        await db.saved_posts.delete_one({"_id": existing["_id"]})
        return {"message": "Kayıt kaldırıldı", "is_saved": False}
    else:
        await db.saved_posts.insert_one({
            "id": str(uuid.uuid4()),
            "post_id": post_id,
            "user_id": current_user["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return {"message": "Kaydedildi", "is_saved": True}


# ============================================
# SHARE POST
# ============================================

@router.post("/social/posts/{post_id}/share")
async def share_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Gönderiyi paylaş"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı")
    
    await db.posts.update_one(
        {"id": post_id},
        {"$inc": {"shares_count": 1}}
    )
    
    # Create share record
    await db.post_shares.insert_one({
        "id": str(uuid.uuid4()),
        "post_id": post_id,
        "user_id": current_user["id"],
        "shared_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Paylaşıldı", "shares_count": post.get("shares_count", 0) + 1}


@router.post("/social/posts/{post_id}/repost")
async def repost(post_id: str, data: dict = None, current_user: dict = Depends(get_current_user)):
    """Gönderiyi kendi profilinde yeniden paylaş"""
    original = await db.posts.find_one({"id": post_id, "deleted": {"$ne": True}})
    if not original:
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı")

    existing = await db.posts.find_one({
        "user_id": current_user["id"], "repost_of": post_id, "deleted": {"$ne": True}
    })
    if existing:
        await db.posts.update_one({"id": existing["id"]}, {"$set": {"deleted": True}})
        await db.posts.update_one({"id": post_id}, {"$inc": {"reposts_count": -1}})
        return {"message": "Repost kaldırıldı", "reposted": False}

    repost_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    comment = ""
    if data and isinstance(data, dict):
        comment = data.get("comment", "")

    repost_doc = {
        "id": repost_id,
        "user_id": current_user["id"],
        "content": comment,
        "repost_of": post_id,
        "original_post": {
            "id": original["id"],
            "user_id": original.get("user_id"),
            "content": original.get("content", ""),
            "media": original.get("media", []),
        },
        "type": "repost",
        "created_at": now,
        "likes_count": 0,
        "comments_count": 0,
        "shares_count": 0,
        "reposts_count": 0,
        "deleted": False,
    }
    await db.posts.insert_one({**repost_doc, "_id": None})
    await db.posts.update_one({"id": post_id}, {"$inc": {"reposts_count": 1}})
    try:
        from services.postgres_posts_service import repost_pg
        await repost_pg(post_id, current_user["id"], comment)
    except Exception:
        pass

    return {"message": "Repost yapıldı", "reposted": True, "repost_id": repost_id}


# ============================================
# ARCHIVE POST
# ============================================

@router.post("/social/posts/{post_id}/archive")
async def archive_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Gönderiyi arşivle"""
    post = await db.posts.find_one({"id": post_id, "user_id": current_user["id"]})
    if not post:
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı")
    
    await db.posts.update_one(
        {"id": post_id},
        {"$set": {"is_archived": True}}
    )
    return {"message": "Gönderi arşivlendi", "is_archived": True}


@router.post("/social/posts/{post_id}/unarchive")
async def unarchive_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Gönderiyi arşivden çıkar"""
    post = await db.posts.find_one({"id": post_id, "user_id": current_user["id"]})
    if not post:
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı")
    
    await db.posts.update_one(
        {"id": post_id},
        {"$unset": {"is_archived": ""}}
    )
    return {"message": "Gönderi arşivden çıkarıldı", "is_archived": False}


# ============================================
# HIDE POST
# ============================================

@router.post("/social/posts/{post_id}/hide")
async def hide_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Gönderiyi gizle (profilde görünmez)"""
    post = await db.posts.find_one({"id": post_id, "user_id": current_user["id"]})
    if not post:
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı")
    
    await db.posts.update_one(
        {"id": post_id},
        {"$set": {"is_hidden": True}}
    )
    return {"message": "Gönderi gizlendi", "is_hidden": True}


@router.post("/social/posts/{post_id}/unhide")
async def unhide_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Gönderiyi gösterme geri al"""
    post = await db.posts.find_one({"id": post_id, "user_id": current_user["id"]})
    if not post:
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı")
    
    await db.posts.update_one(
        {"id": post_id},
        {"$unset": {"is_hidden": ""}}
    )
    return {"message": "Gönderi gösterildi", "is_hidden": False}


# ============================================
# PIN POST
# ============================================

@router.post("/social/posts/{post_id}/pin")
async def pin_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Gönderiyi sabitle"""
    post = await db.posts.find_one({"id": post_id, "user_id": current_user["id"]})
    if not post:
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı")
    
    # Unpin all other posts
    await db.posts.update_many(
        {"user_id": current_user["id"], "is_pinned": True},
        {"$set": {"is_pinned": False}}
    )
    
    # Pin this post
    new_pin_status = not post.get("is_pinned", False)
    await db.posts.update_one(
        {"id": post_id},
        {"$set": {"is_pinned": new_pin_status}}
    )
    try:
        from services.postgres_posts_service import pin_post_pg
        await pin_post_pg(post_id, current_user["id"], new_pin_status)
    except Exception:
        pass

    return {"message": "Sabitlendi" if new_pin_status else "Sabitleme kaldırıldı", "is_pinned": new_pin_status}


# ============================================
# POLL VOTING
# ============================================

@router.post("/social/posts/{post_id}/vote/{option_index}")
async def vote_poll(post_id: str, option_index: int, current_user: dict = Depends(get_current_user)):
    """Ankette oy kullan"""
    post = await db.posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı")
    
    if not post.get("poll_options"):
        raise HTTPException(status_code=400, detail="Bu gönderi bir anket değil")
    
    if option_index < 0 or option_index >= len(post["poll_options"]):
        raise HTTPException(status_code=400, detail="Geçersiz seçenek")
    
    # Check if already voted
    for i, option in enumerate(post["poll_options"]):
        if current_user["id"] in option.get("voters", []):
            if i == option_index:
                return {"message": "Zaten bu seçeneğe oy verdiniz"}
            else:
                # Remove old vote
                post["poll_options"][i]["voters"].remove(current_user["id"])
                post["poll_options"][i]["votes"] -= 1
    
    # Add new vote
    post["poll_options"][option_index]["voters"].append(current_user["id"])
    post["poll_options"][option_index]["votes"] += 1
    
    await db.posts.update_one(
        {"id": post_id},
        {"$set": {"poll_options": post["poll_options"]}}
    )
    
    return {"message": "Oy kullanıldı", "poll_options": post["poll_options"]}
