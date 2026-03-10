# Messages Routes
# Uygulama ici mesajlasma - MongoDB + Socket.IO
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import os
import sys
import logging

logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import db
from core.auth import get_current_user

router = APIRouter(prefix="/messages", tags=["messages"])



# =====================================================
# MODELLER
# =====================================================

class CreateConversationRequest(BaseModel):
    participant_ids: List[str]
    is_group: bool = False
    group_name: Optional[str] = None

class SendMessageRequest(BaseModel):
    conversation_id: str
    content: str
    content_type: str = "TEXT"
    media_url: Optional[str] = None
    reply_to: Optional[str] = None

class MessageReactionRequest(BaseModel):
    message_id: str
    reaction: Optional[str] = None
    emoji: Optional[str] = None

# =====================================================
# HELPER FUNCTIONS
# =====================================================

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

# =====================================================
# CONVERSATIONS ENDPOINTS
# =====================================================

@router.get("/conversations")
async def get_conversations(
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get user's conversations list"""
    conversations = await db.conversations.find(
        {"participants": current_user["id"], "is_deleted": {"$ne": True}},
        {"_id": 0}
    ).sort("last_message_at", -1).skip(offset).limit(limit).to_list(limit)
    
    for conv in conversations:
        other_ids = [p for p in conv["participants"] if p != current_user["id"]]
        participants = await db.users.find(
            {"id": {"$in": other_ids}},
            {"_id": 0, "password": 0, "email": 0}
        ).to_list(10)
        conv["other_participants"] = participants
        
        last_msg = await db.messages.find_one(
            {"conversation_id": conv["id"]},
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        conv["last_message"] = last_msg
        
        unread = await db.messages.count_documents({
            "conversation_id": conv["id"],
            "sender_id": {"$ne": current_user["id"]},
            "read_by": {"$ne": current_user["id"]}
        })
        conv["unread_count"] = unread
    
    return {"conversations": conversations}

@router.post("/conversations")
async def create_conversation(
    data: CreateConversationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new conversation"""
    now = datetime.now(timezone.utc).isoformat()
    all_participants = list(set([current_user["id"]] + data.participant_ids))
    
    if not data.is_group and len(all_participants) == 2:
        existing = await db.conversations.find_one({
            "participants": {"$all": all_participants, "$size": 2},
            "is_group": False
        })
        if existing:
            existing.pop("_id", None)
            return existing
    
    conversation = {
        "id": str(uuid.uuid4()),
        "participants": all_participants,
        "is_group": data.is_group,
        "group_name": data.group_name if data.is_group else None,
        "group_avatar": None,
        "created_by": current_user["id"],
        "created_at": now,
        "last_message_at": now,
        "is_deleted": False
    }
    
    await db.conversations.insert_one(conversation)
    conversation.pop("_id", None)
    
    return conversation

@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, current_user: dict = Depends(get_current_user)):
    """Get conversation details"""
    conv = await db.conversations.find_one(
        {"id": conversation_id, "participants": current_user["id"]},
        {"_id": 0}
    )
    
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")
    
    participants = await db.users.find(
        {"id": {"$in": conv["participants"]}},
        {"_id": 0, "password": 0, "email": 0}
    ).to_list(20)
    conv["participants_info"] = participants
    
    return conv

@router.post("/conversations/{conversation_id}/pin")
async def pin_conversation(conversation_id: str, current_user: dict = Depends(get_current_user)):
    """Pin a conversation"""
    conv = await db.conversations.find_one({
        "id": conversation_id,
        "participants": current_user["id"]
    })
    
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")
    
    await db.user_pinned_conversations.update_one(
        {"user_id": current_user["id"], "conversation_id": conversation_id},
        {"$set": {
            "user_id": current_user["id"],
            "conversation_id": conversation_id,
            "pinned_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"message": "Sohbet sabitlendi"}

@router.delete("/conversations/{conversation_id}/pin")
async def unpin_conversation(conversation_id: str, current_user: dict = Depends(get_current_user)):
    """Unpin a conversation"""
    result = await db.user_pinned_conversations.delete_one({
        "user_id": current_user["id"],
        "conversation_id": conversation_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sabitlenmiş sohbet bulunamadı")
    
    return {"message": "Sabitleme kaldırıldı"}

@router.post("/conversations/{conversation_id}/archive")
async def archive_conversation(conversation_id: str, current_user: dict = Depends(get_current_user)):
    """Archive a conversation"""
    conv = await db.conversations.find_one({
        "id": conversation_id,
        "participants": current_user["id"]
    })
    
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")
    
    await db.user_archived_conversations.update_one(
        {"user_id": current_user["id"], "conversation_id": conversation_id},
        {"$set": {
            "user_id": current_user["id"],
            "conversation_id": conversation_id,
            "archived_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"message": "Sohbet arşivlendi"}

@router.delete("/conversations/{conversation_id}/archive")
async def unarchive_conversation(conversation_id: str, current_user: dict = Depends(get_current_user)):
    """Unarchive a conversation"""
    result = await db.user_archived_conversations.delete_one({
        "user_id": current_user["id"],
        "conversation_id": conversation_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Arşivlenmiş sohbet bulunamadı")
    
    return {"message": "Arşivden çıkarıldı"}

@router.get("/conversations/archived")
async def get_archived_conversations(current_user: dict = Depends(get_current_user)):
    """Get archived conversations"""
    archived = await db.user_archived_conversations.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    conversation_ids = [a["conversation_id"] for a in archived]
    
    conversations = await db.conversations.find(
        {"id": {"$in": conversation_ids}},
        {"_id": 0}
    ).to_list(100)
    
    return {"conversations": conversations}

# =====================================================
# MESSAGES ENDPOINTS
# =====================================================

@router.get("/{conversation_id}")
async def get_messages(
    conversation_id: str,
    limit: int = 50,
    before: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get messages in a conversation"""
    conv = await db.conversations.find_one({
        "id": conversation_id,
        "participants": current_user["id"]
    })
    
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")
    
    query = {"conversation_id": conversation_id}
    if before:
        query["created_at"] = {"$lt": before}
    
    messages = await db.messages.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    for msg in messages:
        sender = await db.users.find_one(
            {"id": msg["sender_id"]},
            {"_id": 0, "id": 1, "username": 1, "avatar_url": 1, "display_name": 1}
        )
        msg["sender"] = sender
    
    return {"messages": list(reversed(messages)), "has_more": len(messages) == limit}

@router.post("")
async def send_message(
    data: SendMessageRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send a message"""
    conv = await db.conversations.find_one({
        "id": data.conversation_id,
        "participants": current_user["id"]
    })
    
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")
    
    now = datetime.now(timezone.utc).isoformat()
    message_id = str(uuid.uuid4())
    
    message = {
        "id": message_id,
        "conversation_id": data.conversation_id,
        "sender_id": current_user["id"],
        "content": data.content,
        "content_type": data.content_type,
        "media_url": data.media_url,
        "reply_to": data.reply_to,
        "reactions": [],
        "read_by": [current_user["id"]],
        "is_deleted": False,
        "created_at": now
    }
    
    await db.messages.insert_one(message)
    
    await db.conversations.update_one(
        {"id": data.conversation_id},
        {"$set": {"last_message_at": now}}
    )
    
    # Notify via Socket.IO + Evolution API
    for participant_id in conv["participants"]:
        if participant_id != current_user["id"]:
            await notify_user(
                recipient_id=participant_id,
                sender_id=current_user["id"],
                notification_type="new_message",
                title=f"Yeni mesaj - {current_user.get('display_name', current_user['username'])}",
                body=data.content[:100] if data.content else "Medya",
                data={"conversation_id": data.conversation_id, "message_id": message_id}
            )
            # Evolution API ile de mesaji ilet
            try:
                from services.evolution_api_service import is_available, send_text, send_media
                if is_available():
                    if data.content_type == "TEXT" and data.content:
                        await send_text(participant_id, data.content)
                    elif data.media_url:
                        mt = "image"
                        if data.content_type and "video" in data.content_type.lower():
                            mt = "video"
                        elif data.content_type and "audio" in data.content_type.lower():
                            mt = "audio"
                        await send_media(participant_id, data.media_url, data.content or "", mt)
            except Exception as e:
                logger.debug(f"Evolution API mesaj iletme: {e}")
    
    message.pop("_id", None)
    return message

@router.post("/reaction")
async def add_message_reaction(
    data: MessageReactionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add reaction to a message"""
    message = await db.messages.find_one({"id": data.message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadi")
    
    reaction_val = data.emoji or data.reaction or "\u2764\ufe0f"
    await db.messages.update_one(
        {"id": data.message_id},
        {"$addToSet": {"reactions": {
            "user_id": current_user["id"],
            "emoji": reaction_val,
            "reaction": reaction_val,
            "created_at": datetime.now(timezone.utc).isoformat()
        }}}
    )
    
    # Evolution API ile tepki bildir
    try:
        from services.evolution_api_service import is_available, send_reaction
        if is_available():
            await send_reaction(data.message_id, reaction_val)
    except Exception as e:
        logger.debug(f"Evolution tepki: {e}")
    
    return {"message": "Tepki eklendi"}

@router.post("/{message_id}/read")
async def mark_message_read(message_id: str, current_user: dict = Depends(get_current_user)):
    """Mark message as read"""
    await db.messages.update_one(
        {"id": message_id},
        {"$addToSet": {"read_by": current_user["id"]}}
    )
    # Evolution API ile okundu bilgisi gonder
    try:
        from services.evolution_api_service import is_available, mark_as_read
        if is_available():
            await mark_as_read(message_id)
    except Exception as e:
        logger.debug(f"Evolution okundu: {e}")
    return {"message": "Okundu olarak isaretlendi"}

@router.delete("/{message_id}")
async def delete_message(message_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a message (soft delete)"""
    result = await db.messages.update_one(
        {"id": message_id, "sender_id": current_user["id"]},
        {"$set": {"is_deleted": True, "content": "Bu mesaj silindi", "media_url": None}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadi veya silme yetkiniz yok")
    
    # Evolution API ile de sil
    try:
        from services.evolution_api_service import is_available, delete_message_evo
        if is_available():
            await delete_message_evo(message_id)
    except Exception as e:
        logger.debug(f"Evolution silme: {e}")
    
    return {"message": "Mesaj silindi"}

@router.delete("/{message_id}/permanent")
async def delete_message_permanent(message_id: str, current_user: dict = Depends(get_current_user)):
    """Permanently delete a message"""
    result = await db.messages.delete_one({
        "id": message_id,
        "sender_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
    
    return {"message": "Mesaj kalıcı olarak silindi"}

@router.put("/{message_id}")
async def edit_message(
    message_id: str,
    data: dict = None,
    content: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Edit a message (within 15 minutes)"""
    if data and isinstance(data, dict):
        content = data.get("content", content)
    if not content:
        raise HTTPException(status_code=400, detail="content required")

    message = await db.messages.find_one({
        "id": message_id,
        "sender_id": current_user["id"]
    })
    
    if not message:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
    
    created = message.get("created_at", "")
    try:
        created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) - created_dt > timedelta(minutes=15):
            raise HTTPException(status_code=400, detail="Mesaj 15 dakika içinde düzenlenebilir")
    except (ValueError, TypeError):
        pass

    now = datetime.now(timezone.utc).isoformat()
    
    await db.messages.update_one(
        {"id": message_id},
        {"$set": {
            "content": content,
            "is_edited": True,
            "edited_at": now
        }}
    )
    
    return {"message": "Mesaj düzenlendi"}

@router.post("/forward")
async def forward_message(
    data: dict = None,
    message_id: str = None,
    conversation_ids: List[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Forward a message to other conversations"""
    if data and isinstance(data, dict):
        message_id = data.get("message_id", message_id)
        conversation_ids = data.get("conversation_ids", conversation_ids) or []
    if not message_id:
        raise HTTPException(status_code=400, detail="message_id required")

    original = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
    
    now = datetime.now(timezone.utc).isoformat()
    forwarded = []
    
    for conv_id in conversation_ids:
        conv = await db.conversations.find_one({
            "id": conv_id,
            "participants": current_user["id"]
        })
        
        if conv:
            new_message = {
                "id": str(uuid.uuid4()),
                "conversation_id": conv_id,
                "sender_id": current_user["id"],
                "content": original.get("content", ""),
                "content_type": original.get("content_type", "TEXT"),
                "media_url": original.get("media_url"),
                "is_forwarded": True,
                "forwarded_from": message_id,
                "reactions": [],
                "read_by": [current_user["id"]],
                "created_at": now
            }
            
            await db.messages.insert_one(new_message)
            new_message.pop("_id", None)
            forwarded.append(new_message)
            
            await db.conversations.update_one(
                {"id": conv_id},
                {"$set": {"last_message_at": now}}
            )
    
    return {"forwarded": forwarded, "count": len(forwarded)}

# =====================================================
# SEARCH ENDPOINTS
# =====================================================

@router.get("/search")
async def search_messages(
    q: str = Query(..., min_length=2),
    conversation_id: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Search messages"""
    user_conversations = await db.conversations.find(
        {"participants": current_user["id"]},
        {"_id": 0, "id": 1}
    ).to_list(1000)
    conversation_ids = [c["id"] for c in user_conversations]
    
    query = {
        "conversation_id": {"$in": conversation_ids},
        "content": {"$regex": q, "$options": "i"},
        "is_deleted": {"$ne": True}
    }
    
    if conversation_id:
        query["conversation_id"] = conversation_id
    
    messages = await db.messages.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"messages": messages, "total": len(messages)}

@router.get("/{conversation_id}/search")
async def search_in_conversation(
    conversation_id: str,
    q: str = Query(..., min_length=2),
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Search messages within a conversation"""
    conv = await db.conversations.find_one({
        "id": conversation_id,
        "participants": current_user["id"]
    })
    
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")
    
    messages = await db.messages.find(
        {
            "conversation_id": conversation_id,
            "content": {"$regex": q, "$options": "i"},
            "is_deleted": {"$ne": True}
        },
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"messages": messages, "total": len(messages)}

# =====================================================
# MEDIA ENDPOINTS
# =====================================================

@router.get("/media/{conversation_id}")
async def get_conversation_media(
    conversation_id: str,
    media_type: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get media from a conversation"""
    conv = await db.conversations.find_one({
        "id": conversation_id,
        "participants": current_user["id"]
    })
    
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")
    
    query = {
        "conversation_id": conversation_id,
        "media_url": {"$exists": True, "$ne": None},
        "is_deleted": {"$ne": True}
    }
    
    if media_type:
        query["content_type"] = media_type.upper()
    
    media = await db.messages.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"media": media, "total": len(media)}

@router.get("/{conversation_id}/media")
async def get_conversation_media_v2(
    conversation_id: str,
    media_type: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get media from conversation (v2)"""
    return await get_conversation_media(conversation_id, media_type, limit, current_user)

# =====================================================
# TYPING INDICATORS
# =====================================================

@router.post("/typing/{conversation_id}")
async def start_typing(conversation_id: str, current_user: dict = Depends(get_current_user)):
    """Start typing indicator"""
    conv = await db.conversations.find_one({
        "id": conversation_id,
        "participants": current_user["id"]
    })
    
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadi")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.typing_indicators.update_one(
        {"conversation_id": conversation_id, "user_id": current_user["id"]},
        {"$set": {
            "conversation_id": conversation_id,
            "user_id": current_user["id"],
            "username": current_user["username"],
            "timestamp": now
        }},
        upsert=True
    )
    
    # Evolution API ile yaziyor gostergesi
    try:
        from services.evolution_api_service import is_available, send_presence
        if is_available():
            for pid in conv.get("participants", []):
                if pid != current_user["id"]:
                    await send_presence(pid, "composing")
    except Exception as e:
        logger.debug(f"Evolution yaziyor: {e}")
    
    return {"message": "Yaziyor..."}

@router.get("/typing/{conversation_id}")
async def get_typing_users(conversation_id: str, current_user: dict = Depends(get_current_user)):
    """Get users currently typing"""
    from datetime import timedelta
    
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=10)).isoformat()
    
    typing_users = await db.typing_indicators.find(
        {
            "conversation_id": conversation_id,
            "user_id": {"$ne": current_user["id"]},
            "timestamp": {"$gt": cutoff}
        },
        {"_id": 0}
    ).to_list(10)
    
    return {"typing_users": typing_users}

# =====================================================
# GROUP MESSAGES
# =====================================================

@router.post("/groups")
async def create_group_conversation(
    data: dict = None,
    name: str = None,
    participant_ids: List[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Create a group conversation"""
    if data and isinstance(data, dict):
        name = data.get("name", name)
        participant_ids = data.get("participant_ids", participant_ids) or []
    if not name:
        raise HTTPException(status_code=400, detail="Grup adı gerekli")
    if not participant_ids:
        participant_ids = []

    now = datetime.now(timezone.utc).isoformat()
    all_participants = list(set([current_user["id"]] + participant_ids))
    
    if len(all_participants) > 256:
        raise HTTPException(status_code=400, detail="Grup en fazla 256 kisi olabilir")
    
    group = {
        "id": str(uuid.uuid4()),
        "participants": all_participants,
        "is_group": True,
        "group_name": name,
        "group_avatar": None,
        "admins": [current_user["id"]],
        "created_by": current_user["id"],
        "created_at": now,
        "last_message_at": now
    }
    
    await db.conversations.insert_one(group)
    group.pop("_id", None)
    
    return group

@router.put("/groups/{conversation_id}")
async def update_group(
    conversation_id: str,
    data: dict = None,
    name: Optional[str] = None,
    avatar_url: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update group settings"""
    if data and isinstance(data, dict):
        name = data.get("name") or data.get("group_name", name)
        avatar_url = data.get("avatar_url") or data.get("group_avatar", avatar_url)

    group = await db.conversations.find_one({
        "id": conversation_id,
        "is_group": True,
        "participants": current_user["id"]
    })
    
    if not group:
        raise HTTPException(status_code=404, detail="Grup bulunamadı veya yetkiniz yok")
    
    update_data = {}
    if name:
        update_data["group_name"] = name
    if avatar_url:
        update_data["group_avatar"] = avatar_url
    
    if update_data:
        await db.conversations.update_one({"id": conversation_id}, {"$set": update_data})
    
    return {"message": "Grup güncellendi"}

@router.post("/groups/{conversation_id}/members")
async def add_group_member(
    conversation_id: str,
    data: dict = None,
    user_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Add member to group"""
    if data and isinstance(data, dict):
        user_id = data.get("user_id", user_id)
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    group = await db.conversations.find_one({
        "id": conversation_id,
        "is_group": True,
        "participants": current_user["id"]
    })
    
    if not group:
        raise HTTPException(status_code=404, detail="Grup bulunamadı veya yetkiniz yok")
    
    if user_id in group["participants"]:
        raise HTTPException(status_code=400, detail="Kullanıcı zaten grupta")
    
    if len(group["participants"]) >= 256:
        raise HTTPException(status_code=400, detail="Grup en fazla 256 kisi olabilir")
    
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$push": {"participants": user_id}}
    )
    
    return {"message": "Üye eklendi"}

@router.delete("/groups/{conversation_id}/members/{user_id}")
async def remove_group_member(
    conversation_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove member from group"""
    group = await db.conversations.find_one({
        "id": conversation_id,
        "is_group": True
    })
    
    if not group:
        raise HTTPException(status_code=404, detail="Grup bulunamadı")
    
    is_admin = current_user["id"] in group.get("admins", [])
    is_self = user_id == current_user["id"]
    
    if not is_admin and not is_self:
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz yok")
    
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$pull": {"participants": user_id, "admins": user_id}}
    )
    
    return {"message": "Üye kaldırıldı"}

# =====================================================
# KONUM & KISI PAYLASIMI (Evolution API)
# =====================================================

@router.post("/location")
async def send_location_message(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Konum mesaji gonder + Evolution API ile WhatsApp'a da gonder"""
    conversation_id = data.get("conversation_id")
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    location_name = data.get("name", "")
    address = data.get("address", "")

    if not conversation_id or latitude is None or longitude is None:
        raise HTTPException(status_code=400, detail="conversation_id, latitude, longitude required")

    conv = await db.conversations.find_one({
        "id": conversation_id,
        "participants": current_user["id"]
    })
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadi")

    now = datetime.now(timezone.utc).isoformat()
    message_id = str(uuid.uuid4())

    message = {
        "id": message_id,
        "conversation_id": conversation_id,
        "sender_id": current_user["id"],
        "content": f"Konum: {location_name}" if location_name else "Konum paylasimi",
        "content_type": "LOCATION",
        "location": {"latitude": latitude, "longitude": longitude, "name": location_name, "address": address},
        "reactions": [],
        "read_by": [current_user["id"]],
        "is_deleted": False,
        "created_at": now
    }

    await db.messages.insert_one(message)
    await db.conversations.update_one({"id": conversation_id}, {"$set": {"last_message_at": now}})

    # Evolution API ile WhatsApp'a da konum gonder
    try:
        from services.evolution_api_service import is_available, send_location
        if is_available():
            for pid in conv.get("participants", []):
                if pid != current_user["id"]:
                    recipient = await db.users.find_one({"id": pid}, {"phone": 1, "phone_number": 1})
                    if recipient:
                        phone = recipient.get("phone") or recipient.get("phone_number")
                        if phone:
                            await send_location(phone, latitude, longitude, location_name, address)
    except Exception as e:
        logger.debug(f"Evolution konum hatasi: {e}")

    message.pop("_id", None)
    return message


@router.post("/contact-card")
async def send_contact_card(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Kisi karti mesaji gonder + Evolution API ile WhatsApp'a da gonder"""
    conversation_id = data.get("conversation_id")
    contact_name = data.get("contact_name", "")
    contact_phone = data.get("contact_phone", "")

    if not conversation_id or not contact_name:
        raise HTTPException(status_code=400, detail="conversation_id, contact_name required")

    conv = await db.conversations.find_one({
        "id": conversation_id,
        "participants": current_user["id"]
    })
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadi")

    now = datetime.now(timezone.utc).isoformat()
    message_id = str(uuid.uuid4())

    message = {
        "id": message_id,
        "conversation_id": conversation_id,
        "sender_id": current_user["id"],
        "content": f"Kisi: {contact_name}",
        "content_type": "CONTACT",
        "contact": {"name": contact_name, "phone": contact_phone},
        "reactions": [],
        "read_by": [current_user["id"]],
        "is_deleted": False,
        "created_at": now
    }

    await db.messages.insert_one(message)
    await db.conversations.update_one({"id": conversation_id}, {"$set": {"last_message_at": now}})

    # Evolution API ile WhatsApp'a da kisi karti gonder
    try:
        from services.evolution_api_service import is_available, send_contact
        if is_available() and contact_phone:
            for pid in conv.get("participants", []):
                if pid != current_user["id"]:
                    recipient = await db.users.find_one({"id": pid}, {"phone": 1, "phone_number": 1})
                    if recipient:
                        phone = recipient.get("phone") or recipient.get("phone_number")
                        if phone:
                            await send_contact(phone, contact_name, contact_phone)
    except Exception as e:
        logger.debug(f"Evolution kisi karti hatasi: {e}")

    message.pop("_id", None)
    return message


# =====================================================
# SPECIAL MESSAGE TYPES
# =====================================================

@router.post("/quote-reply")
async def quote_reply_message(
    message_id: str,
    content: str,
    current_user: dict = Depends(get_current_user)
):
    """Reply to a message with quote"""
    original = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
    
    conv = await db.conversations.find_one({
        "id": original["conversation_id"],
        "participants": current_user["id"]
    })
    
    if not conv:
        raise HTTPException(status_code=403, detail="Bu sohbete erişiminiz yok")
    
    now = datetime.now(timezone.utc).isoformat()
    
    reply = {
        "id": str(uuid.uuid4()),
        "conversation_id": original["conversation_id"],
        "sender_id": current_user["id"],
        "content": content,
        "content_type": "QUOTE_REPLY",
        "quoted_message": {
            "id": original["id"],
            "content": original.get("content", "")[:200],
            "sender_id": original.get("sender_id"),
            "content_type": original.get("content_type")
        },
        "reactions": [],
        "read_by": [current_user["id"]],
        "created_at": now
    }
    
    await db.messages.insert_one(reply)
    reply.pop("_id", None)
    
    await db.conversations.update_one(
        {"id": original["conversation_id"]},
        {"$set": {"last_message_at": now}}
    )
    
    return reply

@router.post("/broadcast")
async def broadcast_message(
    content: str,
    conversation_ids: List[str],
    current_user: dict = Depends(get_current_user)
):
    """Send same message to multiple conversations"""
    now = datetime.now(timezone.utc).isoformat()
    sent_messages = []
    
    for conv_id in conversation_ids[:10]:
        conv = await db.conversations.find_one({
            "id": conv_id,
            "participants": current_user["id"]
        })
        
        if conv:
            message = {
                "id": str(uuid.uuid4()),
                "conversation_id": conv_id,
                "sender_id": current_user["id"],
                "content": content,
                "content_type": "TEXT",
                "is_broadcast": True,
                "reactions": [],
                "read_by": [current_user["id"]],
                "created_at": now
            }
            
            await db.messages.insert_one(message)
            message.pop("_id", None)
            sent_messages.append(message)
            
            await db.conversations.update_one(
                {"id": conv_id},
                {"$set": {"last_message_at": now}}
            )
    
    return {"sent": sent_messages, "count": len(sent_messages)}

@router.post("/translate")
async def translate_message(
    data: dict = None,
    message_id: str = None,
    target_language: str = "tr",
    current_user: dict = Depends(get_current_user)
):
    """Translate a message - accepts either message_id or raw text"""
    text = None
    if data and isinstance(data, dict):
        message_id = data.get("message_id", message_id)
        target_language = data.get("target_language", target_language)
        text = data.get("text")

    content = ""
    if text:
        content = text
    elif message_id:
        message = await db.messages.find_one({"id": message_id}, {"_id": 0})
        if not message:
            raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
        content = message.get("content", "")
    else:
        raise HTTPException(status_code=400, detail="text veya message_id gerekli")

    try:
        from services.translation_service import translate_text
        result = await translate_text(content, target_language)
        translated = result.get("translated", content) if isinstance(result, dict) else str(result)
    except Exception:
        translated = f"[{target_language.upper()}] {content}"

    return {
        "original": content,
        "translated": translated,
        "translated_text": translated,
        "source_language": "auto",
        "target_language": target_language
    }

# =====================================================
# VOICE & MEDIA UPLOAD
# =====================================================

@router.post("/{conversation_id}/voice")
async def send_voice_message(
    conversation_id: str,
    data: dict = None,
    current_user: dict = Depends(get_current_user)
):
    """Send a voice message"""
    conv = await db.conversations.find_one({"id": conversation_id, "participants": current_user["id"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")
    
    now = datetime.now(timezone.utc).isoformat()
    voice_url = (data or {}).get("voice_url", "")
    duration = (data or {}).get("duration", "0:00")

    message = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "sender_id": current_user["id"],
        "content": "🎤 Sesli mesaj",
        "content_type": "VOICE",
        "voice_url": voice_url,
        "duration": duration,
        "type": "voice",
        "reactions": [],
        "read_by": [current_user["id"]],
        "created_at": now,
    }
    await db.messages.insert_one(message)
    await db.conversations.update_one({"id": conversation_id}, {"$set": {"last_message_at": now}})
    message.pop("_id", None)
    return message

@router.post("/{conversation_id}/media")
async def send_media_message(
    conversation_id: str,
    data: dict = None,
    current_user: dict = Depends(get_current_user)
):
    """Send a media (image/video) message"""
    conv = await db.conversations.find_one({"id": conversation_id, "participants": current_user["id"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")
    
    now = datetime.now(timezone.utc).isoformat()
    media_url = (data or {}).get("media_url", "")
    media_type = (data or {}).get("media_type", "IMAGE")

    message = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "sender_id": current_user["id"],
        "content": "📷 Fotoğraf" if media_type == "IMAGE" else "🎥 Video",
        "content_type": media_type,
        "media_url": media_url,
        "type": "media",
        "reactions": [],
        "read_by": [current_user["id"]],
        "created_at": now,
    }
    await db.messages.insert_one(message)
    await db.conversations.update_one({"id": conversation_id}, {"$set": {"last_message_at": now}})
    message.pop("_id", None)
    return message

# =====================================================
# MUTE CONVERSATION
# =====================================================

@router.post("/conversations/{conversation_id}/mute")
async def mute_conversation(
    conversation_id: str,
    data: dict = None,
    current_user: dict = Depends(get_current_user)
):
    """Mute a conversation (duration: 1h, 8h, 1d, forever)"""
    duration = (data or {}).get("duration", "forever")
    now = datetime.now(timezone.utc)
    
    mute_until = None
    if duration == "1h":
        mute_until = (now + timedelta(hours=1)).isoformat()
    elif duration == "8h":
        mute_until = (now + timedelta(hours=8)).isoformat()
    elif duration == "1d":
        mute_until = (now + timedelta(days=1)).isoformat()

    await db.user_muted_conversations.update_one(
        {"user_id": current_user["id"], "conversation_id": conversation_id},
        {"$set": {
            "user_id": current_user["id"],
            "conversation_id": conversation_id,
            "mute_until": mute_until,
            "muted_at": now.isoformat(),
        }},
        upsert=True,
    )
    return {"message": "Sohbet sessize alındı", "mute_until": mute_until}

@router.delete("/conversations/{conversation_id}/mute")
async def unmute_conversation(conversation_id: str, current_user: dict = Depends(get_current_user)):
    """Unmute a conversation"""
    await db.user_muted_conversations.delete_one({"user_id": current_user["id"], "conversation_id": conversation_id})
    return {"message": "Sessizden çıkarıldı"}

# =====================================================
# DELETE CONVERSATION
# =====================================================

@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a conversation for the user"""
    conv = await db.conversations.find_one({"id": conversation_id, "participants": current_user["id"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")
    
    await db.user_deleted_conversations.update_one(
        {"user_id": current_user["id"], "conversation_id": conversation_id},
        {"$set": {
            "user_id": current_user["id"],
            "conversation_id": conversation_id,
            "deleted_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"message": "Sohbet silindi"}

# =====================================================
# STAR MESSAGES
# =====================================================

@router.post("/{message_id}/star")
async def star_message(message_id: str, current_user: dict = Depends(get_current_user)):
    """Star / unstar a message"""
    existing = await db.starred_messages.find_one({"user_id": current_user["id"], "message_id": message_id})
    if existing:
        await db.starred_messages.delete_one({"_id": existing["_id"]})
        return {"message": "Yıldız kaldırıldı", "starred": False}
    
    await db.starred_messages.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "message_id": message_id,
        "starred_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"message": "Yıldızlandı", "starred": True}

@router.get("/starred/list")
async def get_starred_messages(current_user: dict = Depends(get_current_user)):
    """Get user's starred messages"""
    starred = await db.starred_messages.find({"user_id": current_user["id"]}, {"_id": 0}).sort("starred_at", -1).to_list(100)
    msg_ids = [s["message_id"] for s in starred]
    messages = await db.messages.find({"id": {"$in": msg_ids}}, {"_id": 0}).to_list(100)
    return {"messages": messages}

# =====================================================
# DELETE FOR ME / DELETE FOR EVERYONE
# =====================================================

@router.post("/{message_id}/delete-for-me")
async def delete_message_for_me(message_id: str, current_user: dict = Depends(get_current_user)):
    """Hide message only for current user"""
    await db.messages.update_one(
        {"id": message_id},
        {"$addToSet": {"hidden_for": current_user["id"]}}
    )
    return {"message": "Mesaj gizlendi"}

@router.post("/{message_id}/delete-for-all")
async def delete_message_for_all(message_id: str, current_user: dict = Depends(get_current_user)):
    """Delete message for everyone (sender only)"""
    msg = await db.messages.find_one({"id": message_id})
    if not msg:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
    if msg.get("sender_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Sadece gönderen silebilir")
    
    await db.messages.update_one(
        {"id": message_id},
        {"$set": {"is_deleted": True, "content": "[deleted]", "media_url": None, "voice_url": None}}
    )
    return {"message": "Mesaj herkes için silindi"}

# =====================================================
# DISAPPEARING MESSAGES
# =====================================================

@router.post("/conversations/{conversation_id}/disappearing")
async def set_disappearing_messages(
    conversation_id: str,
    data: dict = None,
    current_user: dict = Depends(get_current_user)
):
    """Set disappearing message timer (seconds: 0=off, 1-86400)"""
    seconds = (data or {}).get("seconds", 0)
    conv = await db.conversations.find_one({"id": conversation_id, "participants": current_user["id"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")

    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"disappearing_seconds": seconds}}
    )
    return {"message": "Kaybolan mesaj ayarlandı", "seconds": seconds}

# =====================================================
# CALL HISTORY
# =====================================================

@router.post("/calls/log")
async def log_call(data: dict, current_user: dict = Depends(get_current_user)):
    """Log a call"""
    now = datetime.now(timezone.utc).isoformat()
    call = {
        "id": str(uuid.uuid4()),
        "caller_id": current_user["id"],
        "callee_id": data.get("callee_id", ""),
        "call_type": data.get("call_type", "audio"),
        "status": data.get("status", "ended"),
        "duration": data.get("duration", 0),
        "started_at": data.get("started_at", now),
        "ended_at": now,
    }
    await db.call_history.insert_one(call)
    call.pop("_id", None)
    return call

@router.get("/calls/history")
async def get_call_history(limit: int = 50, current_user: dict = Depends(get_current_user)):
    """Get call history"""
    calls = await db.call_history.find(
        {"$or": [{"caller_id": current_user["id"]}, {"callee_id": current_user["id"]}]},
        {"_id": 0}
    ).sort("ended_at", -1).limit(limit).to_list(limit)
    
    for call in calls:
        other_id = call["callee_id"] if call["caller_id"] == current_user["id"] else call["caller_id"]
        other_user = await db.users.find_one({"id": other_id}, {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1})
        call["other_user"] = other_user
        call["is_outgoing"] = call["caller_id"] == current_user["id"]
    
    return {"calls": calls}

# =====================================================
# STICKER PACKS
# =====================================================

STICKER_PACKS = [
    {"id": "classic", "name": "Klasik", "stickers": ["😀", "😂", "😍", "🥰", "😎", "🤔", "😢", "😡", "👍", "👎", "🙏", "💪"]},
    {"id": "hearts", "name": "Kalpler", "stickers": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🤍", "🖤", "💕", "💞", "💓", "💗"]},
    {"id": "animals", "name": "Hayvanlar", "stickers": ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐸"]},
    {"id": "food", "name": "Yiyecekler", "stickers": ["🍕", "🍔", "🍟", "🌭", "🍿", "🧁", "🍰", "🍩", "🍪", "🍫", "☕", "🧃"]},
    {"id": "activities", "name": "Aktiviteler", "stickers": ["⚽", "🏀", "🎮", "🎸", "🎨", "📚", "✈️", "🏖️", "🎬", "🎵", "🏋️", "🚴"]},
    {"id": "celebrations", "name": "Kutlamalar", "stickers": ["🎉", "🎊", "🎂", "🎁", "🎈", "🎆", "🎇", "✨", "🥂", "🎶", "💐", "🌟"]},
]

@router.get("/stickers/packs")
async def get_sticker_packs(current_user: dict = Depends(get_current_user)):
    """Get available sticker packs"""
    return {"packs": STICKER_PACKS}

@router.post("/stickers/send")
async def send_sticker(data: dict, current_user: dict = Depends(get_current_user)):
    """Send a sticker message. Use 'sticker' (emoji) for pack stickers or 'sticker_url' (R2 URL) for custom image stickers."""
    conv_id = data.get("conversation_id")
    sticker = data.get("sticker", "")
    sticker_url = (data.get("sticker_url") or "").strip()
    if not conv_id:
        raise HTTPException(status_code=400, detail="conversation_id required")
    if not sticker and not sticker_url:
        raise HTTPException(status_code=400, detail="sticker (emoji) veya sticker_url gerekli")

    conv = await db.conversations.find_one({"id": conv_id, "participants": current_user["id"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")

    now = datetime.now(timezone.utc).isoformat()
    message = {
        "id": str(uuid.uuid4()),
        "conversation_id": conv_id,
        "sender_id": current_user["id"],
        "content": sticker or "Sticker",
        "content_type": "STICKER",
        "type": "sticker",
        "media_url": sticker_url if sticker_url else None,
        "reactions": [],
        "read_by": [current_user["id"]],
        "created_at": now,
    }
    await db.messages.insert_one(message)
    await db.conversations.update_one({"id": conv_id}, {"$set": {"last_message_at": now}})
    message.pop("_id", None)
    return message

# =====================================================
# GIF SEARCH (Tenor/GIPHY proxy)
# =====================================================

@router.get("/gif/search")
async def search_gifs(q: str = "", limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Search GIFs - returns placeholder results"""
    gifs = [
        {"id": f"gif_{i}", "url": f"https://media.giphy.com/media/placeholder{i}/giphy.gif", "preview": f"https://media.giphy.com/media/placeholder{i}/200w.gif", "title": f"{q} gif {i}"}
        for i in range(min(limit, 12))
    ]
    return {"gifs": gifs, "query": q}

@router.post("/gif/send")
async def send_gif(data: dict, current_user: dict = Depends(get_current_user)):
    """Send a GIF message"""
    conv_id = data.get("conversation_id")
    gif_url = data.get("gif_url", "")
    if not conv_id:
        raise HTTPException(status_code=400, detail="conversation_id required")

    conv = await db.conversations.find_one({"id": conv_id, "participants": current_user["id"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")

    now = datetime.now(timezone.utc).isoformat()
    message = {
        "id": str(uuid.uuid4()),
        "conversation_id": conv_id,
        "sender_id": current_user["id"],
        "content": "GIF",
        "content_type": "GIF",
        "media_url": gif_url,
        "type": "gif",
        "reactions": [],
        "read_by": [current_user["id"]],
        "created_at": now,
    }
    await db.messages.insert_one(message)
    await db.conversations.update_one({"id": conv_id}, {"$set": {"last_message_at": now}})
    message.pop("_id", None)
    return message

# =====================================================
# SHARE MUSIC / PLAYLIST / PROFILE / POST
# =====================================================

@router.post("/share")
async def share_content(data: dict, current_user: dict = Depends(get_current_user)):
    """Share music, playlist, profile, or post as a message"""
    conv_id = data.get("conversation_id")
    share_type = data.get("share_type", "music")
    if not conv_id:
        raise HTTPException(status_code=400, detail="conversation_id required")

    conv = await db.conversations.find_one({"id": conv_id, "participants": current_user["id"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")

    now = datetime.now(timezone.utc).isoformat()
    content_map = {
        "music": "🎵 Müzik paylaşıldı",
        "album": "💿 Albüm paylaşıldı",
        "playlist": "📋 Çalma listesi paylaşıldı",
        "profile": "👤 Profil paylaşıldı",
        "post": "📝 Gönderi paylaşıldı",
    }

    message = {
        "id": str(uuid.uuid4()),
        "conversation_id": conv_id,
        "sender_id": current_user["id"],
        "content": content_map.get(share_type, "Paylaşım"),
        "content_type": f"SHARE_{share_type.upper()}",
        "type": "share",
        "share_data": {
            "share_type": share_type,
            "item_id": data.get("item_id"),
            "title": data.get("title", ""),
            "subtitle": data.get("subtitle", ""),
            "thumbnail": data.get("thumbnail", ""),
            "url": data.get("url", ""),
        },
        "reactions": [],
        "read_by": [current_user["id"]],
        "created_at": now,
    }
    await db.messages.insert_one(message)
    await db.conversations.update_one({"id": conv_id}, {"$set": {"last_message_at": now}})
    message.pop("_id", None)

    for pid in conv["participants"]:
        if pid != current_user["id"]:
            await notify_user(pid, current_user["id"], "new_message", "Yeni paylaşım", content_map.get(share_type, "Paylaşım"), {"conversation_id": conv_id})

    return message

# =====================================================
# SPAM PROTECTION
# =====================================================

@router.post("/spam/check")
async def check_spam(data: dict = None, current_user: dict = Depends(get_current_user)):
    """Check if user is sending too many messages (rate limit)"""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    recent_count = await db.messages.count_documents({
        "sender_id": current_user["id"],
        "created_at": {"$gt": cutoff},
    })
    is_spam = recent_count > 30
    return {"is_spam": is_spam, "recent_count": recent_count, "limit": 30}

# =====================================================
# QUOTE-REPLY (body dict version)
# =====================================================

@router.post("/quote-reply-v2")
async def quote_reply_v2(data: dict, current_user: dict = Depends(get_current_user)):
    """Quote-reply with body dict"""
    message_id = data.get("message_id") or data.get("quoted_message_id")
    content = data.get("content", "")
    conversation_id = data.get("conversation_id")
    if not message_id or not content:
        raise HTTPException(status_code=400, detail="message_id and content required")

    original = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not original and not conversation_id:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")

    conv_id = conversation_id or original.get("conversation_id")
    conv = await db.conversations.find_one({"id": conv_id, "participants": current_user["id"]})
    if not conv:
        raise HTTPException(status_code=403, detail="Bu sohbete erişiminiz yok")

    now = datetime.now(timezone.utc).isoformat()
    sender_info = None
    if original:
        sender_info = await db.users.find_one({"id": original.get("sender_id")}, {"_id": 0, "username": 1})

    reply = {
        "id": str(uuid.uuid4()),
        "conversation_id": conv_id,
        "sender_id": current_user["id"],
        "content": content,
        "content_type": "QUOTE_REPLY",
        "quoted_message": {
            "id": message_id,
            "content": (original or {}).get("content", "")[:200],
            "sender_id": (original or {}).get("sender_id"),
            "sender": sender_info,
            "content_type": (original or {}).get("content_type"),
        } if original else None,
        "reactions": [],
        "read_by": [current_user["id"]],
        "created_at": now,
    }
    await db.messages.insert_one(reply)
    reply.pop("_id", None)
    await db.conversations.update_one({"id": conv_id}, {"$set": {"last_message_at": now}})
    return reply


# =====================================================
# EVOLUTION API STATUS (Uygulama ici - WhatsApp yok)
# =====================================================

@router.get("/evolution/status")
async def evolution_status(current_user: dict = Depends(get_current_user)):
    """Evolution API mesajlasma servisi durumu"""
    try:
        from services.evolution_api_service import get_status, health_check
        status = get_status()
        health = await health_check()
        return {**status, **health}
    except Exception as e:
        return {"available": False, "error": str(e)}


@router.post("/evolution/setup")
async def setup_evolution(current_user: dict = Depends(get_current_user)):
    """Evolution API instance olustur (uygulama ici)"""
    try:
        from services.evolution_api_service import is_available, create_instance, set_webhook
        if not is_available():
            raise HTTPException(status_code=400, detail="Evolution API yapilandirilmamis")

        instance = await create_instance()

        backend_url = os.getenv("BACKEND_URL", "")
        if backend_url:
            await set_webhook(f"{backend_url}/api/messages/webhook/evolution")

        return {
            "message": "Evolution API kurulumu tamamlandi",
            "mode": "in-app-only",
            "whatsapp": False,
            "instance": instance
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhook/evolution")
async def evolution_webhook(data: dict):
    """Evolution API webhook - uygulama ici mesaj bildirimleri"""
    try:
        event = data.get("event", "")
        if event == "messages.upsert":
            messages_data = data.get("data", [])
            if not isinstance(messages_data, list):
                messages_data = [messages_data]
            for msg_data in messages_data:
                # If the message is originated from the system itself, skip processing it again
                if msg_data.get("key", {}).get("fromMe", False) or msg_data.get("fromMe", False):
                    continue
                    
                sender_id = msg_data.get("sender_id", "")
                conversation_id = msg_data.get("conversation_id", "")
                message_id = msg_data.get("id") or msg_data.get("message_id") or msg_data.get("key", {}).get("id", "")
                
                if not sender_id or not conversation_id or not message_id:
                    continue
                    
                # Check for duplicates explicitly for robust safety
                exists = await db.messages.find_one({"message_id": message_id})
                if exists:
                    continue
                    
                text = msg_data.get("message", {}).get("text", "")
                media_url = msg_data.get("message", {}).get("media_url")
                now = datetime.now(timezone.utc).isoformat()
                new_msg = {
                    "id": str(uuid.uuid4()),
                    "message_id": message_id,
                    "conversation_id": conversation_id,
                    "sender_id": sender_id,
                    "content": text,
                    "content_type": "TEXT" if text else "MEDIA",
                    "media_url": media_url,
                    "source": "evolution",
                    "reactions": [],
                    "read_by": [sender_id],
                    "is_deleted": False,
                    "created_at": now
                }
                
                try:
                    await db.messages.insert_one(new_msg)
                except Exception as db_err:
                    # Ignore duplicate key error (E11000)
                    if "E11000" in str(db_err):
                        continue
                    raise
                    
                await db.conversations.update_one(
                    {"id": conversation_id},
                    {"$set": {"last_message_at": now}}
                )
                try:
                    from services.websocket_service import emit_to_user
                    conv = await db.conversations.find_one({"id": conversation_id}, {"participants": 1})
                    if conv:
                        for pid in conv.get("participants", []):
                            if pid != sender_id:
                                new_msg.pop("_id", None)
                                await emit_to_user(pid, "new_message", new_msg)
                except Exception:
                    pass
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Evolution webhook hatasi: {e}")
        return {"status": "error", "detail": str(e)}



