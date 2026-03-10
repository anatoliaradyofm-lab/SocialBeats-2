# Instagram Features Routes - Story Highlights, Saved Collections, Collab Posts, Stickers
# Eksik Instagram özellikleri için API'ler

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

router = APIRouter(tags=["Instagram Features"])


# ============================================
# MODELS
# ============================================

class StoryHighlightCreate(BaseModel):
    name: str
    cover_url: Optional[str] = None
    story_ids: List[str] = []

class SavedCollectionCreate(BaseModel):
    name: str
    cover_url: Optional[str] = None

class CollabPostInvite(BaseModel):
    post_id: str
    invited_user_id: str

class StoryReaction(BaseModel):
    emoji: str

class StoryStickerCreate(BaseModel):
    sticker_type: str  # question, countdown, quiz, poll, slider, link
    sticker_data: dict


# ============================================
# STORY HIGHLIGHTS (Öne Çıkan Hikayeler)
# ============================================

@router.post("/stories/highlights")
async def create_highlight(data: StoryHighlightCreate, current_user: dict = Depends(get_current_user)):
    """Yeni hikaye highlight oluştur"""
    highlight_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    highlight = {
        "id": highlight_id,
        "user_id": current_user["id"],
        "name": data.name,
        "cover_url": data.cover_url,
        "story_ids": data.story_ids,
        "stories_count": len(data.story_ids),
        "created_at": now,
        "updated_at": now
    }
    
    await db.story_highlights.insert_one(highlight)
    highlight.pop("_id", None)
    
    return highlight


@router.get("/stories/highlights")
async def get_my_highlights(current_user: dict = Depends(get_current_user)):
    """Kendi highlight'larımı getir"""
    highlights = await db.story_highlights.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return highlights


@router.get("/stories/highlights/user/{user_id}")
async def get_user_highlights(user_id: str, current_user: dict = Depends(get_current_user)):
    """Başka bir kullanıcının highlight'larını getir"""
    # Check if blocked
    blocked = await db.blocked_users.find_one({
        "$or": [
            {"blocker_id": current_user["id"], "blocked_id": user_id},
            {"blocker_id": user_id, "blocked_id": current_user["id"]}
        ]
    })
    if blocked:
        return []
    
    highlights = await db.story_highlights.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return highlights


@router.get("/stories/highlights/{highlight_id}")
async def get_highlight_detail(highlight_id: str, current_user: dict = Depends(get_current_user)):
    """Highlight detaylarını ve hikayelerini getir"""
    highlight = await db.story_highlights.find_one(
        {"id": highlight_id},
        {"_id": 0}
    )
    
    if not highlight:
        raise HTTPException(status_code=404, detail="Highlight bulunamadı")
    
    # Get stories
    stories = await db.stories.find(
        {"id": {"$in": highlight.get("story_ids", [])}},
        {"_id": 0}
    ).to_list(100)
    
    highlight["stories"] = stories
    return highlight


@router.put("/stories/highlights/{highlight_id}")
async def update_highlight(highlight_id: str, data: StoryHighlightCreate, current_user: dict = Depends(get_current_user)):
    """Highlight güncelle"""
    highlight = await db.story_highlights.find_one({"id": highlight_id, "user_id": current_user["id"]})
    if not highlight:
        raise HTTPException(status_code=404, detail="Highlight bulunamadı")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.story_highlights.update_one(
        {"id": highlight_id},
        {"$set": {
            "name": data.name,
            "cover_url": data.cover_url,
            "story_ids": data.story_ids,
            "stories_count": len(data.story_ids),
            "updated_at": now
        }}
    )
    
    return {"message": "Highlight güncellendi"}


@router.post("/stories/highlights/{highlight_id}/add-story/{story_id}")
async def add_story_to_highlight(highlight_id: str, story_id: str, current_user: dict = Depends(get_current_user)):
    """Highlight'a hikaye ekle"""
    highlight = await db.story_highlights.find_one({"id": highlight_id, "user_id": current_user["id"]})
    if not highlight:
        raise HTTPException(status_code=404, detail="Highlight bulunamadı")
    
    story_ids = highlight.get("story_ids", [])
    if story_id not in story_ids:
        story_ids.append(story_id)
        
        await db.story_highlights.update_one(
            {"id": highlight_id},
            {"$set": {
                "story_ids": story_ids,
                "stories_count": len(story_ids),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return {"message": "Hikaye eklendi"}


@router.delete("/stories/highlights/{highlight_id}")
async def delete_highlight(highlight_id: str, current_user: dict = Depends(get_current_user)):
    """Highlight sil"""
    result = await db.story_highlights.delete_one({
        "id": highlight_id,
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Highlight bulunamadı")
    
    return {"message": "Highlight silindi"}


# ============================================
# STORY MENTIONS (Hikayede Etiketleme)
# ============================================

@router.post("/stories/{story_id}/mention/{user_id}")
async def mention_in_story(story_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    """Hikayede kullanıcı etiketle"""
    story = await db.stories.find_one({"id": story_id, "user_id": current_user["id"]})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "username": 1})
    if not target_user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    mentions = story.get("mentions", [])
    if user_id not in mentions:
        mentions.append(user_id)
        
        await db.stories.update_one(
            {"id": story_id},
            {"$set": {"mentions": mentions}}
        )
        
        # Send notification
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "story_mention",
            "title": "Hikayede Etiketlendin",
            "body": f"@{current_user['username']} seni hikayesinde etiketledi",
            "data": {"story_id": story_id, "type": "story_mention"},
            "sender_id": current_user["id"],
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"message": f"@{target_user['username']} etiketlendi"}


# ============================================
# STORY REPLIES (Hikayeye Yanıt)
# ============================================

class StoryReplyData(BaseModel):
    message: str

@router.post("/stories/{story_id}/reply")
async def reply_to_story(story_id: str, data: StoryReplyData, current_user: dict = Depends(get_current_user)):
    """Hikayeye yanıt ver (DM olarak gider)"""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    
    now = datetime.now(timezone.utc).isoformat()
    reply_id = str(uuid.uuid4())
    
    # Create reply as a message
    reply = {
        "id": reply_id,
        "sender_id": current_user["id"],
        "receiver_id": story["user_id"],
        "content": data.message,
        "message_type": "story_reply",
        "story_id": story_id,
        "story_media_url": story.get("media_url"),
        "created_at": now,
        "read": False
    }
    
    await db.messages.insert_one(reply)
    
    # Send notification
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": story["user_id"],
        "type": "story_reply",
        "title": "Hikayene Yanıt",
        "body": f"@{current_user['username']}: {data.message[:50]}{'...' if len(data.message) > 50 else ''}",
        "data": {"story_id": story_id, "message_id": reply_id, "type": "story_reply"},
        "sender_id": current_user["id"],
        "read": False,
        "created_at": now
    })
    
    reply.pop("_id", None)
    return reply


# ============================================
# STORY REACTIONS (Hikayeye Emoji Tepki)
# ============================================

@router.post("/stories/{story_id}/react")
async def react_to_story(story_id: str, data: StoryReaction, current_user: dict = Depends(get_current_user)):
    """Hikayeye emoji ile tepki ver"""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    
    now = datetime.now(timezone.utc).isoformat()
    reaction_id = str(uuid.uuid4())
    
    # Check if already reacted
    existing = await db.story_reactions.find_one({
        "story_id": story_id,
        "user_id": current_user["id"]
    })
    
    if existing:
        # Update reaction
        await db.story_reactions.update_one(
            {"id": existing["id"]},
            {"$set": {"emoji": data.emoji, "updated_at": now}}
        )
    else:
        # Create new reaction
        reaction = {
            "id": reaction_id,
            "story_id": story_id,
            "user_id": current_user["id"],
            "username": current_user["username"],
            "emoji": data.emoji,
            "created_at": now
        }
        await db.story_reactions.insert_one(reaction)
        
        # Send notification
        if story["user_id"] != current_user["id"]:
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": story["user_id"],
                "type": "story_reaction",
                "title": "Hikayene Tepki",
                "body": f"@{current_user['username']} hikayene {data.emoji} tepki verdi",
                "data": {"story_id": story_id, "type": "story_reaction", "emoji": data.emoji},
                "sender_id": current_user["id"],
                "read": False,
                "created_at": now
            })
    
    return {"message": "Tepki gönderildi", "emoji": data.emoji}


@router.get("/stories/{story_id}/reactions")
async def get_story_reactions(story_id: str, current_user: dict = Depends(get_current_user)):
    """Hikaye tepkilerini getir"""
    reactions = await db.story_reactions.find(
        {"story_id": story_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Group by emoji
    emoji_counts = {}
    for r in reactions:
        emoji = r["emoji"]
        emoji_counts[emoji] = emoji_counts.get(emoji, 0) + 1
    
    return {
        "reactions": reactions,
        "summary": emoji_counts,
        "total": len(reactions)
    }


# ============================================
# SAVED COLLECTIONS (Kaydedilen Koleksiyonlar)
# ============================================

@router.post("/collections/saved")
async def create_collection(data: SavedCollectionCreate, current_user: dict = Depends(get_current_user)):
    """Yeni kayıt koleksiyonu oluştur"""
    collection_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    collection = {
        "id": collection_id,
        "user_id": current_user["id"],
        "name": data.name,
        "cover_url": data.cover_url,
        "post_ids": [],
        "posts_count": 0,
        "created_at": now,
        "updated_at": now
    }
    
    await db.saved_collections.insert_one(collection)
    collection.pop("_id", None)
    
    return collection


@router.get("/collections/saved")
async def get_my_collections(current_user: dict = Depends(get_current_user)):
    """Koleksiyonlarımı getir"""
    collections = await db.saved_collections.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(50)
    
    # Get cover images from first post
    for col in collections:
        if col["post_ids"] and not col.get("cover_url"):
            first_post = await db.posts.find_one(
                {"id": col["post_ids"][0]},
                {"_id": 0, "media_urls": 1}
            )
            if first_post and first_post.get("media_urls"):
                col["cover_url"] = first_post["media_urls"][0]
    
    return collections


@router.get("/collections/saved/{collection_id}")
async def get_collection_posts(collection_id: str, current_user: dict = Depends(get_current_user)):
    """Koleksiyon postlarını getir"""
    collection = await db.saved_collections.find_one(
        {"id": collection_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not collection:
        raise HTTPException(status_code=404, detail="Koleksiyon bulunamadı")
    
    posts = await db.posts.find(
        {"id": {"$in": collection.get("post_ids", [])}},
        {"_id": 0}
    ).to_list(100)
    
    collection["posts"] = posts
    return collection


@router.post("/collections/saved/{collection_id}/add/{post_id}")
async def add_to_collection(collection_id: str, post_id: str, current_user: dict = Depends(get_current_user)):
    """Koleksiyona post ekle"""
    collection = await db.saved_collections.find_one({
        "id": collection_id,
        "user_id": current_user["id"]
    })
    
    if not collection:
        raise HTTPException(status_code=404, detail="Koleksiyon bulunamadı")
    
    post_ids = collection.get("post_ids", [])
    if post_id not in post_ids:
        post_ids.append(post_id)
        
        await db.saved_collections.update_one(
            {"id": collection_id},
            {"$set": {
                "post_ids": post_ids,
                "posts_count": len(post_ids),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Also add to saved posts if not already
        existing_save = await db.saved_posts.find_one({
            "user_id": current_user["id"],
            "post_id": post_id
        })
        
        if not existing_save:
            await db.saved_posts.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": current_user["id"],
                "post_id": post_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    return {"message": "Post koleksiyona eklendi"}


@router.delete("/collections/saved/{collection_id}/remove/{post_id}")
async def remove_from_collection(collection_id: str, post_id: str, current_user: dict = Depends(get_current_user)):
    """Koleksiyondan post çıkar"""
    collection = await db.saved_collections.find_one({
        "id": collection_id,
        "user_id": current_user["id"]
    })
    
    if not collection:
        raise HTTPException(status_code=404, detail="Koleksiyon bulunamadı")
    
    post_ids = collection.get("post_ids", [])
    if post_id in post_ids:
        post_ids.remove(post_id)
        
        await db.saved_collections.update_one(
            {"id": collection_id},
            {"$set": {
                "post_ids": post_ids,
                "posts_count": len(post_ids),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return {"message": "Post koleksiyondan çıkarıldı"}


@router.delete("/collections/saved/{collection_id}")
async def delete_collection(collection_id: str, current_user: dict = Depends(get_current_user)):
    """Koleksiyonu sil"""
    result = await db.saved_collections.delete_one({
        "id": collection_id,
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Koleksiyon bulunamadı")
    
    return {"message": "Koleksiyon silindi"}


# ============================================
# COLLAB POSTS (Ortak Gönderi)
# ============================================

@router.post("/posts/{post_id}/collab/invite")
async def invite_collaborator(post_id: str, invited_user_id: str, current_user: dict = Depends(get_current_user)):
    """Ortak gönderi için davet gönder"""
    post = await db.posts.find_one({"id": post_id, "user_id": current_user["id"]})
    if not post:
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı")
    
    target_user = await db.users.find_one({"id": invited_user_id}, {"_id": 0, "id": 1, "username": 1})
    if not target_user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    # Check if already invited
    existing = await db.collab_invites.find_one({
        "post_id": post_id,
        "invited_user_id": invited_user_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Bu kullanıcı zaten davet edilmiş")
    
    now = datetime.now(timezone.utc).isoformat()
    invite_id = str(uuid.uuid4())
    
    invite = {
        "id": invite_id,
        "post_id": post_id,
        "inviter_id": current_user["id"],
        "invited_user_id": invited_user_id,
        "status": "pending",
        "created_at": now
    }
    
    await db.collab_invites.insert_one(invite)
    
    # Send notification
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": invited_user_id,
        "type": "collab_invite",
        "title": "Ortak Gönderi Daveti",
        "body": f"@{current_user['username']} seni bir gönderide etiketlemek istiyor",
        "data": {"post_id": post_id, "invite_id": invite_id, "type": "collab_invite"},
        "sender_id": current_user["id"],
        "read": False,
        "created_at": now
    })
    
    return {"message": f"@{target_user['username']}'e davet gönderildi", "invite_id": invite_id}


@router.post("/posts/collab/accept/{invite_id}")
async def accept_collab_invite(invite_id: str, current_user: dict = Depends(get_current_user)):
    """Ortak gönderi davetini kabul et"""
    invite = await db.collab_invites.find_one({
        "id": invite_id,
        "invited_user_id": current_user["id"],
        "status": "pending"
    })
    
    if not invite:
        raise HTTPException(status_code=404, detail="Davet bulunamadı")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update invite status
    await db.collab_invites.update_one(
        {"id": invite_id},
        {"$set": {"status": "accepted", "accepted_at": now}}
    )
    
    # Add user to post collaborators
    await db.posts.update_one(
        {"id": invite["post_id"]},
        {
            "$addToSet": {"collaborators": current_user["id"]},
            "$set": {"is_collab": True}
        }
    )
    
    # Notify inviter
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": invite["inviter_id"],
        "type": "collab_accepted",
        "title": "Ortak Gönderi Kabul Edildi",
        "body": f"@{current_user['username']} ortak gönderi davetini kabul etti",
        "data": {"post_id": invite["post_id"], "type": "collab_accepted"},
        "sender_id": current_user["id"],
        "read": False,
        "created_at": now
    })
    
    return {"message": "Davet kabul edildi"}


@router.post("/posts/collab/decline/{invite_id}")
async def decline_collab_invite(invite_id: str, current_user: dict = Depends(get_current_user)):
    """Ortak gönderi davetini reddet"""
    invite = await db.collab_invites.find_one({
        "id": invite_id,
        "invited_user_id": current_user["id"],
        "status": "pending"
    })
    
    if not invite:
        raise HTTPException(status_code=404, detail="Davet bulunamadı")
    
    await db.collab_invites.update_one(
        {"id": invite_id},
        {"$set": {"status": "declined", "declined_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Davet reddedildi"}


@router.get("/posts/collab/invites")
async def get_my_collab_invites(current_user: dict = Depends(get_current_user)):
    """Bekleyen ortak gönderi davetlerimi getir"""
    invites = await db.collab_invites.find(
        {"invited_user_id": current_user["id"], "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    # Get post and inviter info
    for inv in invites:
        post = await db.posts.find_one({"id": inv["post_id"]}, {"_id": 0, "media_urls": 1, "content": 1})
        inviter = await db.users.find_one({"id": inv["inviter_id"]}, {"_id": 0, "username": 1, "avatar_url": 1})
        inv["post"] = post
        inv["inviter"] = inviter
    
    return invites


# ============================================
# STORY STICKERS (Hikaye Çıkartmaları)
# ============================================

@router.post("/stories/{story_id}/stickers")
async def add_sticker_to_story(story_id: str, data: StoryStickerCreate, current_user: dict = Depends(get_current_user)):
    """Hikayeye sticker ekle (question, countdown, quiz, poll, slider, link)"""
    story = await db.stories.find_one({"id": story_id, "user_id": current_user["id"]})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    
    sticker_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    sticker = {
        "id": sticker_id,
        "type": data.sticker_type,
        "data": data.sticker_data,
        "responses": [],
        "created_at": now
    }
    
    # Add to story stickers
    stickers = story.get("stickers", [])
    stickers.append(sticker)
    
    await db.stories.update_one(
        {"id": story_id},
        {"$set": {"stickers": stickers}}
    )
    
    return {"message": "Sticker eklendi", "sticker_id": sticker_id}


@router.post("/stories/{story_id}/stickers/{sticker_id}/respond")
async def respond_to_sticker(story_id: str, sticker_id: str, response: dict, current_user: dict = Depends(get_current_user)):
    """Sticker'a yanıt ver (question answer, poll vote, quiz answer, slider value)"""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    
    stickers = story.get("stickers", [])
    sticker_index = next((i for i, s in enumerate(stickers) if s["id"] == sticker_id), None)
    
    if sticker_index is None:
        raise HTTPException(status_code=404, detail="Sticker bulunamadı")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Add response
    sticker_response = {
        "user_id": current_user["id"],
        "username": current_user["username"],
        "response": response,
        "created_at": now
    }
    
    stickers[sticker_index]["responses"].append(sticker_response)
    
    await db.stories.update_one(
        {"id": story_id},
        {"$set": {"stickers": stickers}}
    )
    
    # Notify story owner (for questions)
    if stickers[sticker_index]["type"] == "question" and story["user_id"] != current_user["id"]:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": story["user_id"],
            "type": "sticker_response",
            "title": "Yeni Soru Yanıtı",
            "body": f"@{current_user['username']} soruna yanıt verdi",
            "data": {"story_id": story_id, "sticker_id": sticker_id, "type": "sticker_response"},
            "sender_id": current_user["id"],
            "read": False,
            "created_at": now
        })
    
    return {"message": "Yanıt gönderildi"}


@router.get("/stories/{story_id}/stickers/{sticker_id}/responses")
async def get_sticker_responses(story_id: str, sticker_id: str, current_user: dict = Depends(get_current_user)):
    """Sticker yanıtlarını getir (sadece hikaye sahibi görebilir)"""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    
    if story["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Sadece hikaye sahibi yanıtları görebilir")
    
    stickers = story.get("stickers", [])
    sticker = next((s for s in stickers if s["id"] == sticker_id), None)
    
    if not sticker:
        raise HTTPException(status_code=404, detail="Sticker bulunamadı")
    
    return {
        "sticker_type": sticker["type"],
        "sticker_data": sticker["data"],
        "responses": sticker["responses"],
        "total_responses": len(sticker["responses"])
    }
