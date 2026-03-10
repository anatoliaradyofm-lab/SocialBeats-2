# Stories Routes
# Modular story management endpoints
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import db
from core.auth import get_current_user

router = APIRouter(prefix="/stories", tags=["stories"])

# =====================================================
# MODELLER
# =====================================================

class StoryCreate(BaseModel):
    story_type: str = "track"
    track_id: Optional[str] = None
    playlist_id: Optional[str] = None
    mood: Optional[str] = None
    text: Optional[str] = None
    emoji: Optional[str] = None
    background_color: Optional[str] = "#8B5CF6"
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    duration: Optional[int] = None
    poll_question: Optional[str] = None
    poll_options: Optional[List[str]] = None
    swipe_up_url: Optional[str] = None
    swipe_up_title: Optional[str] = None
    music_track_id: Optional[str] = None
    music_start_time: Optional[int] = None
    caption: Optional[str] = None
    location: Optional[str] = None
    text_overlays: Optional[List[dict]] = None
    stickers: Optional[List[dict]] = None
    filter_id: Optional[str] = None
    close_friends_only: bool = False
    hide_from: Optional[List[str]] = None
    reply_restriction: str = "everyone"
    qa_question: Optional[str] = None
    countdown_title: Optional[str] = None
    countdown_end: Optional[str] = None

class StoryReplyRequest(BaseModel):
    story_id: str
    content: str
    reply_type: str = "TEXT"

class Track(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    artist: str
    album: str = ""
    duration: int = 0
    cover_url: str = ""
    source: str = "youtube"

# Mock tracks for demo
MOCK_TRACKS = [
    {"id": "t1", "title": "Yıldızların Altında", "artist": "Tarkan", "album": "Metamorfoz", "duration": 245, "cover_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300", "source": "spotify"},
    {"id": "t2", "title": "Sen Olsan Bari", "artist": "Aleyna Tilki", "album": "Singles", "duration": 198, "cover_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300", "source": "youtube"},
    {"id": "t3", "title": "Firuze", "artist": "Sezen Aksu", "album": "Firuze", "duration": 312, "cover_url": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300", "source": "apple"},
]

# =====================================================
# HELPER FUNCTIONS
# =====================================================

async def add_xp(user_id: str, amount: int):
    """Add XP to user"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user:
        new_xp = user.get("xp", 0) + amount
        await db.users.update_one({"id": user_id}, {"$set": {"xp": new_xp}})

async def notify_user(recipient_id: str, sender_id: str, notification_type: str, title: str, body: str, data: dict = None):
    """Send notification to user"""
    now = datetime.now(timezone.utc).isoformat()
    sender = await db.users.find_one({"id": sender_id}, {"_id": 0, "username": 1, "avatar_url": 1})
    
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": recipient_id,
        "type": notification_type,
        "from_user_id": sender_id,
        "from_username": sender.get("username") if sender else "Unknown",
        "from_avatar": sender.get("avatar_url") if sender else None,
        "title": title,
        "content": body,
        "data": data or {},
        "is_read": False,
        "created_at": now
    }
    await db.notifications.insert_one(notification)
    return notification

# =====================================================
# STORY ENDPOINTS
# =====================================================

@router.post("/{story_id}/media")
async def upload_story_media(
    story_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload media file for a story"""
    import base64
    story = await db.stories.find_one({"id": story_id, "user_id": current_user["id"]})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")

    contents = await file.read()
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    content_type = file.content_type or f"image/{ext}"
    media_type = "video" if "video" in content_type else "image"
    data_uri = f"data:{content_type};base64,{base64.b64encode(contents).decode()}"

    await db.stories.update_one(
        {"id": story_id},
        {"$set": {"media_url": data_uri, "media_type": media_type}}
    )
    return {"media_url": data_uri, "media_type": media_type}


@router.post("")
async def create_story(story_data: StoryCreate, current_user: dict = Depends(get_current_user)):
    """Create a new story"""
    story_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=24)
    
    track = None
    playlist = None
    
    if story_data.track_id:
        track = next((t for t in MOCK_TRACKS if t["id"] == story_data.track_id), None)
        if not track:
            cached = await db.music_cache.find_one({"id": story_data.track_id}, {"_id": 0})
            if cached:
                track = {"id": cached["id"], "title": cached.get("title", ""), "artist": cached.get("artist", ""), "cover_url": cached.get("thumbnail", "")}
    
    if story_data.playlist_id:
        playlist_doc = await db.playlists.find_one({"id": story_data.playlist_id}, {"_id": 0})
        if playlist_doc:
            playlist = {
                "id": playlist_doc["id"],
                "name": playlist_doc["name"],
                "cover_url": playlist_doc.get("cover_url"),
                "track_count": playlist_doc.get("track_count", 0)
            }
    
    duration = story_data.duration
    if duration is None:
        if story_data.story_type == 'photo':
            duration = 30
        elif story_data.story_type == 'video':
            duration = 60
        else:
            duration = 5
    
    story = {
        "id": story_id,
        "user_id": current_user["id"],
        "username": current_user["username"],
        "user_avatar": current_user.get("avatar_url"),
        "user_display_name": current_user.get("display_name"),
        "is_verified": current_user.get("is_verified", False),
        "story_type": story_data.story_type,
        "track": track,
        "playlist": playlist,
        "mood": story_data.mood,
        "text": story_data.text,
        "emoji": story_data.emoji,
        "background_color": story_data.background_color or "#8B5CF6",
        "media_url": story_data.media_url,
        "media_type": story_data.media_type,
        "duration": duration,
        "viewers": [],
        "viewers_count": 0,
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        "poll_question": story_data.poll_question,
        "poll_options": [{"id": str(uuid.uuid4()), "text": opt, "votes": 0, "voters": []} 
                        for opt in (story_data.poll_options or [])] if story_data.story_type == "poll" else None,
        "swipe_up_url": story_data.swipe_up_url,
        "swipe_up_title": story_data.swipe_up_title,
        "music_track_id": story_data.music_track_id,
        "music_start_time": story_data.music_start_time or 0,
        "caption": story_data.caption,
        "location": story_data.location,
        "text_overlays": story_data.text_overlays or [],
        "stickers": story_data.stickers or [],
        "filter_id": story_data.filter_id,
        "close_friends_only": story_data.close_friends_only,
        "hide_from": story_data.hide_from or [],
        "reply_restriction": story_data.reply_restriction or "everyone",
        "qa_question": story_data.qa_question,
        "qa_answers": [],
        "countdown_title": story_data.countdown_title,
        "countdown_end": story_data.countdown_end,
    }
    
    if story_data.music_track_id:
        music_track = next((t for t in MOCK_TRACKS if t["id"] == story_data.music_track_id), None)
        if music_track:
            story["music_track"] = {
                "id": music_track["id"],
                "title": music_track["title"],
                "artist": music_track["artist"],
                "cover_url": music_track.get("cover_url"),
                "preview_url": music_track.get("preview_url")
            }
    
    await db.stories.insert_one(story)
    await add_xp(current_user["id"], 5)
    
    story.pop("_id", None)
    return story

@router.get("/feed")
async def get_stories_feed(current_user: dict = Depends(get_current_user)):
    """Get stories from users the current user follows"""
    now = datetime.now(timezone.utc)
    
    following = await db.follows.find({"follower_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    following_ids = [f["following_id"] for f in following]
    following_ids.append(current_user["id"])
    
    stories = await db.stories.find(
        {
            "user_id": {"$in": following_ids},
            "expires_at": {"$gt": now.isoformat()}
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    my_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "close_friends": 1})
    close_friend_ids = set((my_user or {}).get("close_friends", []))

    user_stories = {}
    for story in stories:
        user_id = story["user_id"]

        if current_user["id"] in story.get("hide_from", []):
            continue
        if story.get("close_friends_only") and user_id != current_user["id"]:
            owner = await db.users.find_one({"id": user_id}, {"_id": 0, "close_friends": 1})
            if current_user["id"] not in (owner or {}).get("close_friends", []):
                continue

        story["is_viewed"] = current_user["id"] in story.get("viewers", [])
        story["is_expired"] = False
        
        if user_id not in user_stories:
            user_stories[user_id] = {
                "user_id": user_id,
                "username": story["username"],
                "user_avatar": story.get("user_avatar"),
                "user_display_name": story.get("user_display_name"),
                "is_verified": story.get("is_verified", False),
                "stories": [],
                "has_unviewed": False
            }
        
        user_stories[user_id]["stories"].append(story)
        if not story["is_viewed"]:
            user_stories[user_id]["has_unviewed"] = True
    
    result = list(user_stories.values())
    result.sort(key=lambda x: (
        x["user_id"] != current_user["id"],
        not x["has_unviewed"],
        x["stories"][0]["created_at"] if x["stories"] else ""
    ))
    
    return result

@router.get("/my")
async def get_my_stories(current_user: dict = Depends(get_current_user)):
    """Get current user's active stories"""
    now = datetime.now(timezone.utc)
    
    stories = await db.stories.find(
        {
            "user_id": current_user["id"],
            "expires_at": {"$gt": now.isoformat()}
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    for story in stories:
        story["is_viewed"] = True
        story["is_expired"] = False
    
    return stories

@router.get("/archive")
async def get_stories_archive(
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get archived (expired) stories"""
    now = datetime.now(timezone.utc)
    skip = (page - 1) * limit
    
    stories = await db.stories.find(
        {
            "user_id": current_user["id"],
            "expires_at": {"$lt": now.isoformat()}
        },
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.stories.count_documents({
        "user_id": current_user["id"],
        "expires_at": {"$lt": now.isoformat()}
    })
    
    return {
        "stories": stories,
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": (total + limit - 1) // limit
    }

@router.get("/archive/monthly")
async def get_archive_monthly(current_user: dict = Depends(get_current_user)):
    """Get archived stories grouped by month"""
    stories = await db.stories.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    months = {}
    for story in stories:
        created = story.get("created_at", "")
        month_key = created[:7] if len(created) >= 7 else "unknown"
        if month_key not in months:
            months[month_key] = {"month": month_key, "stories": [], "count": 0}
        months[month_key]["stories"].append(story)
        months[month_key]["count"] += 1

    return {"months": list(months.values())}

@router.get("/user/{user_id}")
async def get_user_stories(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get all active stories from a specific user"""
    now = datetime.now(timezone.utc)
    
    stories = await db.stories.find(
        {
            "user_id": user_id,
            "expires_at": {"$gt": now.isoformat()}
        },
        {"_id": 0}
    ).sort("created_at", 1).to_list(50)
    
    for story in stories:
        story["is_viewed"] = current_user["id"] in story.get("viewers", [])
        story["is_expired"] = False
    
    return stories

@router.post("/{story_id}/view")
async def view_story(story_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a story as viewed"""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    if story["user_id"] == current_user["id"]:
        return {"message": "Own story viewed"}
    
    if current_user["id"] not in story.get("viewers", []):
        await db.stories.update_one(
            {"id": story_id},
            {
                "$addToSet": {"viewers": current_user["id"]},
                "$inc": {"viewers_count": 1}
            }
        )
        
        now = datetime.now(timezone.utc).isoformat()
        await db.story_viewers.insert_one({
            "story_id": story_id,
            "user_id": current_user["id"],
            "username": current_user["username"],
            "user_avatar": current_user.get("avatar_url"),
            "user_display_name": current_user.get("display_name"),
            "viewed_at": now
        })
        try:
            from services.analytics_service import track_view
            await track_view("story_viewed", current_user["id"], story_id, "story")
        except Exception:
            pass
    return {"message": "Story viewed"}

@router.get("/{story_id}/viewers")
async def get_story_viewers(story_id: str, current_user: dict = Depends(get_current_user)):
    """Get list of users who viewed a story (only for story owner)"""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    if story["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Can only view viewers of your own stories")
    
    viewers = await db.story_viewers.find(
        {"story_id": story_id},
        {"_id": 0, "story_id": 0}
    ).sort("viewed_at", -1).to_list(100)
    
    return viewers

@router.delete("/{story_id}")
async def delete_story(story_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a story"""
    result = await db.stories.delete_one({
        "id": story_id,
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Story not found")
    
    await db.story_viewers.delete_many({"story_id": story_id})
    
    return {"message": "Story deleted"}

@router.post("/{story_id}/reply")
async def reply_to_story(
    story_id: str,
    reply_data: dict = None,
    current_user: dict = Depends(get_current_user)
):
    """Reply to a story - creates a DM conversation with the story owner"""
    if isinstance(reply_data, dict):
        content = reply_data.get("content", "")
        reply_type = reply_data.get("reply_type", "TEXT")
    else:
        content = getattr(reply_data, "content", "")
        reply_type = getattr(reply_data, "reply_type", "TEXT")

    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    
    restriction = story.get("reply_restriction", "everyone")
    story_owner_id = story["user_id"]
    
    if story_owner_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Kendi hikayenize yanıt veremezsiniz")

    if restriction == "close_friends":
        owner = await db.users.find_one({"id": story_owner_id}, {"_id": 0, "close_friends": 1})
        if current_user["id"] not in (owner or {}).get("close_friends", []):
            raise HTTPException(status_code=403, detail="Sadece yakın arkadaşlar yanıt verebilir")
    elif restriction == "followers":
        is_follower = await db.follows.find_one({"follower_id": current_user["id"], "following_id": story_owner_id})
        if not is_follower:
            raise HTTPException(status_code=403, detail="Sadece takipçiler yanıt verebilir")
    elif restriction == "nobody":
        raise HTTPException(status_code=403, detail="Yanıtlar kapatılmış")
    
    now = datetime.now(timezone.utc).isoformat()
    
    conversation = await db.conversations.find_one({
        "is_group": False,
        "participants": {"$all": [current_user["id"], story_owner_id], "$size": 2}
    })
    
    if not conversation:
        conversation_id = str(uuid.uuid4())
        conversation = {
            "id": conversation_id,
            "is_group": False,
            "participants": [current_user["id"], story_owner_id],
            "created_at": now,
            "last_message_at": now
        }
        await db.conversations.insert_one(conversation)
    else:
        conversation_id = conversation["id"]
    
    message_id = str(uuid.uuid4())
    
    story_preview = {
        "story_id": story_id,
        "story_type": story.get("story_type", "text"),
        "media_url": story.get("media_url"),
        "text": story.get("text", "")[:100] if story.get("text") else None,
        "background_color": story.get("background_color"),
        "created_at": story.get("created_at")
    }
    
    message = {
        "id": message_id,
        "conversation_id": conversation_id,
        "sender_id": current_user["id"],
        "content_type": "STORY_REPLY",
        "content": content,
        "story_id": story_id,
        "story_preview": story_preview,
        "reply_type": reply_type,
        "reactions": [],
        "read_by": [current_user["id"]],
        "is_delivered": True,
        "created_at": now
    }
    
    await db.messages.insert_one(message)
    
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"last_message_at": now}}
    )
    
    await notify_user(
        recipient_id=story_owner_id,
        sender_id=current_user["id"],
        notification_type="story_reply",
        title=f"{current_user.get('display_name') or current_user['username']} hikayeni yanıtladı",
        body=content[:50] if content else "📸 Hikaye yanıtı",
        data={"url": f"messages/{conversation_id}", "type": "story_reply", "story_id": story_id}
    )
    
    message.pop("_id", None)
    return {
        "message": "Yanıt gönderildi",
        "conversation_id": conversation_id,
        "reply": message
    }

# =====================================================
# STORY REACTIONS
# =====================================================

@router.post("/reaction")
async def add_story_reaction(
    data: dict = None,
    story_id: str = None,
    reaction: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Add a reaction to a story"""
    if data and isinstance(data, dict):
        story_id = data.get("story_id", story_id)
        reaction = data.get("emoji") or data.get("reaction", reaction) or "❤️"
    if not story_id:
        raise HTTPException(status_code=400, detail="story_id required")
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    existing = await db.story_reactions.find_one({
        "story_id": story_id,
        "user_id": current_user["id"]
    })
    
    if existing:
        await db.story_reactions.update_one(
            {"id": existing["id"]},
            {"$set": {"reaction": reaction, "updated_at": now}}
        )
    else:
        await db.story_reactions.insert_one({
            "id": str(uuid.uuid4()),
            "story_id": story_id,
            "user_id": current_user["id"],
            "username": current_user["username"],
            "user_avatar": current_user.get("avatar_url"),
            "reaction": reaction,
            "created_at": now
        })
        
        if story["user_id"] != current_user["id"]:
            await notify_user(
                recipient_id=story["user_id"],
                sender_id=current_user["id"],
                notification_type="story_reaction",
                title=f"{current_user['username']} hikayenize tepki verdi",
                body=reaction,
                data={"story_id": story_id}
            )
    
    return {"message": "Reaction added", "reaction": reaction}

@router.get("/{story_id}/reactions")
async def get_story_reactions(story_id: str, current_user: dict = Depends(get_current_user)):
    """Get reactions on a story"""
    reactions = await db.story_reactions.find(
        {"story_id": story_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    reaction_counts = {}
    for r in reactions:
        emoji = r.get("reaction", "❤️")
        reaction_counts[emoji] = reaction_counts.get(emoji, 0) + 1
    
    return {
        "reactions": reactions,
        "counts": reaction_counts,
        "total": len(reactions)
    }

@router.delete("/{story_id}/reaction")
async def remove_story_reaction(story_id: str, current_user: dict = Depends(get_current_user)):
    """Remove reaction from story"""
    result = await db.story_reactions.delete_one({
        "story_id": story_id,
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reaction not found")
    
    return {"message": "Reaction removed"}

# =====================================================
# STORY POLLS
# =====================================================

@router.post("/{story_id}/poll/vote")
async def vote_story_poll(
    story_id: str,
    data: dict = None,
    option_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Vote in a story poll"""
    if data and isinstance(data, dict):
        option_id = data.get("option_id", option_id)
        option_index = data.get("option_index")
    else:
        option_index = None

    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    
    if story.get("story_type") != "poll" and not story.get("poll_options"):
        raise HTTPException(status_code=400, detail="Bu hikaye bir anket değil")
    
    poll_options = story.get("poll_options", [])

    if option_index is not None and 0 <= option_index < len(poll_options):
        option = poll_options[option_index]
        option_id = option.get("id", str(option_index))
    elif option_id:
        option = next((o for o in poll_options if o.get("id") == option_id), None)
    else:
        raise HTTPException(status_code=400, detail="option_id or option_index required")

    if not option:
        raise HTTPException(status_code=404, detail="Seçenek bulunamadı")
    
    for opt in poll_options:
        if current_user["id"] in opt.get("voters", []):
            raise HTTPException(status_code=400, detail="Zaten oy kullandınız")
    
    if option.get("id"):
        await db.stories.update_one(
            {"id": story_id, "poll_options.id": option_id},
            {
                "$inc": {"poll_options.$.votes": 1},
                "$push": {"poll_options.$.voters": current_user["id"]}
            }
        )
    else:
        poll_options[option_index]["votes"] = poll_options[option_index].get("votes", 0) + 1
        poll_options[option_index].setdefault("voters", []).append(current_user["id"])
        await db.stories.update_one({"id": story_id}, {"$set": {"poll_options": poll_options}})
    
    return {"message": "Oyunuz kaydedildi", "voted_option_id": option_id}

@router.get("/{story_id}/poll/results")
async def get_poll_results(story_id: str, current_user: dict = Depends(get_current_user)):
    """Get poll results"""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    
    if story.get("story_type") != "poll":
        raise HTTPException(status_code=400, detail="Bu hikaye bir anket değil")
    
    poll_options = story.get("poll_options", [])
    total_votes = sum(o.get("votes", 0) for o in poll_options)
    
    user_vote = None
    for opt in poll_options:
        if current_user["id"] in opt.get("voters", []):
            user_vote = opt.get("id")
            break
    
    results = []
    for opt in poll_options:
        votes = opt.get("votes", 0)
        percentage = (votes / total_votes * 100) if total_votes > 0 else 0
        results.append({
            "id": opt.get("id"),
            "text": opt.get("text"),
            "votes": votes,
            "percentage": round(percentage, 1)
        })
    
    return {
        "question": story.get("poll_question"),
        "options": results,
        "total_votes": total_votes,
        "user_vote": user_vote
    }

# =====================================================
# STORY ANALYTICS
# =====================================================

@router.post("/{story_id}/analytics/view")
async def track_story_view_analytics(
    story_id: str,
    duration: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Track detailed story view analytics"""
    story = await db.stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.story_analytics.insert_one({
        "id": str(uuid.uuid4()),
        "story_id": story_id,
        "story_owner_id": story["user_id"],
        "viewer_id": current_user["id"],
        "view_duration": duration,
        "completed": duration >= story.get("duration", 5),
        "created_at": now
    })
    
    return {"message": "View tracked", "duration": duration}

@router.get("/{story_id}/analytics")
async def get_story_analytics(story_id: str, current_user: dict = Depends(get_current_user)):
    """Get story analytics (owner only)"""
    story = await db.stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    if story["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only story owner can view analytics")
    
    analytics = await db.story_analytics.find({"story_id": story_id}).to_list(10000)
    
    total_views = len(analytics)
    unique_viewers = len(set(a.get("viewer_id") for a in analytics))
    completed_views = sum(1 for a in analytics if a.get("completed"))
    avg_duration = sum(a.get("view_duration", 0) for a in analytics) / total_views if total_views > 0 else 0
    
    return {
        "story_id": story_id,
        "total_views": total_views,
        "unique_viewers": unique_viewers,
        "completed_views": completed_views,
        "completion_rate": round(completed_views / total_views * 100, 1) if total_views > 0 else 0,
        "average_view_duration": round(avg_duration, 1),
        "story_duration": story.get("duration", 5)
    }

# =====================================================
# Q&A ANSWERS
# =====================================================

@router.post("/{story_id}/qa/answer")
async def answer_qa(story_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """Answer a Q&A sticker on a story"""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    if not story.get("qa_question"):
        raise HTTPException(status_code=400, detail="Bu hikayede soru yok")

    answer = data.get("answer", "").strip()
    if not answer:
        raise HTTPException(status_code=400, detail="Cevap gerekli")

    now = datetime.now(timezone.utc).isoformat()
    entry = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "username": current_user["username"],
        "avatar_url": current_user.get("avatar_url"),
        "answer": answer,
        "created_at": now,
    }
    await db.stories.update_one({"id": story_id}, {"$push": {"qa_answers": entry}})

    if story["user_id"] != current_user["id"]:
        await notify_user(
            recipient_id=story["user_id"],
            sender_id=current_user["id"],
            notification_type="story_qa",
            title=f"{current_user['username']} sorunuzu yanıtladı",
            body=answer[:80],
            data={"story_id": story_id},
        )
    return {"message": "Cevap gönderildi", "answer": entry}

@router.get("/{story_id}/qa/answers")
async def get_qa_answers(story_id: str, current_user: dict = Depends(get_current_user)):
    """Get all Q&A answers for a story (owner only)"""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    if story["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Sadece hikaye sahibi görebilir")
    return {"answers": story.get("qa_answers", []), "question": story.get("qa_question")}

# =====================================================
# SCREENSHOT NOTIFICATION
# =====================================================

@router.post("/{story_id}/screenshot")
async def notify_screenshot(story_id: str, current_user: dict = Depends(get_current_user)):
    """Notify story owner that someone took a screenshot"""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    if story["user_id"] == current_user["id"]:
        return {"message": "Kendi hikayeniz"}

    await notify_user(
        recipient_id=story["user_id"],
        sender_id=current_user["id"],
        notification_type="story_screenshot",
        title="Ekran Görüntüsü",
        body=f"@{current_user['username']} hikayenizin ekran görüntüsünü aldı",
        data={"story_id": story_id},
    )
    return {"message": "Bildirim gönderildi"}

# =====================================================
# STORY MUSIC SEARCH
# =====================================================

@router.get("/music/search")
async def search_story_music(q: str = "", limit: int = 10, current_user: dict = Depends(get_current_user)):
    """Search music for stories"""
    results = list(MOCK_TRACKS)
    if q:
        results = [t for t in MOCK_TRACKS if q.lower() in t["title"].lower() or q.lower() in t["artist"].lower()]
    cached = await db.music_cache.find(
        {"$or": [
            {"title": {"$regex": q, "$options": "i"}},
            {"artist": {"$regex": q, "$options": "i"}},
        ]} if q else {},
        {"_id": 0}
    ).limit(limit).to_list(limit)
    for c in cached:
        if not any(r["id"] == c.get("id") for r in results):
            results.append({"id": c.get("id", ""), "title": c.get("title", ""), "artist": c.get("artist", ""), "cover_url": c.get("thumbnail", ""), "source": c.get("source", "")})
    return {"tracks": results[:limit]}
