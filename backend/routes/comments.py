# Comments Router - Yorum işlemleri için modüler API
# server.py'den ayrılmış comments endpoint'leri

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
import uuid
import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import db
from core.auth import get_current_user

router = APIRouter(tags=["Comments"])

# Content moderator import
try:
    from services.content_moderation import content_moderator
    MODERATION_ENABLED = True
except:
    MODERATION_ENABLED = False
    content_moderator = None


# ============================================
# MODELS
# ============================================

class CommentCreate(BaseModel):
    content: str
    media_url: Optional[str] = None
    parent_id: Optional[str] = None


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
# COMMENT CRUD
# ============================================

@router.post("/social/posts/{post_id}/comments")
async def add_comment(post_id: str, comment_data: CommentCreate, current_user: dict = Depends(get_current_user)):
    """Gönderiye yorum yap"""
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Gönderi bulunamadı")
    
    if not post.get("allow_comments", True):
        raise HTTPException(status_code=403, detail="Bu gönderi için yorumlar kapatılmış")
    
    # Text moderation: Hugging Face (ana) + Detoxify/content_moderator (yedek)
    if comment_data.content:
        try:
            from services.huggingface_service import moderate_text, HF_API_TOKEN
            if HF_API_TOKEN:
                hf_res = await moderate_text(comment_data.content)
                tox_keys = ["toxicity", "severe_toxicity", "toxic"]
                tox = max(float(hf_res.get(k, 0) or 0) for k in tox_keys)
                if tox > 0.7:
                    raise HTTPException(status_code=400, detail="Yorumunuz uygunsuz içerik barındırıyor.")
        except HTTPException:
            raise
        except Exception:
            pass
        if MODERATION_ENABLED and content_moderator:
            try:
                text_check = await content_moderator.check_text_toxicity(comment_data.content)
                if not text_check.get("safe", True):
                    raise HTTPException(status_code=400, detail="Yorumunuz uygunsuz içerik barındırıyor.")
            except HTTPException:
                raise
            except Exception:
                pass
    
    comment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Extract mentions
    mentions = re.findall(r'@(\w+)', comment_data.content or "")
    
    comment = {
        "id": comment_id,
        "post_id": post_id,
        "user_id": current_user["id"],
        "username": current_user["username"],
        "user_avatar": current_user.get("avatar_url"),
        "user_display_name": current_user.get("display_name"),
        "user_level": current_user.get("level", 1),
        "content": comment_data.content,
        "media_url": comment_data.media_url,
        "parent_id": comment_data.parent_id,
        "mentions": mentions,
        "likes_count": 0,
        "replies_count": 0,
        "created_at": now
    }
    
    await db.comments.insert_one(comment)
    
    if comment_data.parent_id:
        # This is a reply
        await db.comments.update_one({"id": comment_data.parent_id}, {"$inc": {"replies_count": 1}})
        
        # Notify parent comment author
        parent_comment = await db.comments.find_one({"id": comment_data.parent_id}, {"_id": 0})
        if parent_comment and parent_comment["user_id"] != current_user["id"]:
            await notify_user(
                recipient_id=parent_comment["user_id"],
                sender_id=current_user["id"],
                notification_type="reply",
                title="Yorumuna Yanıt",
                body=f"@{current_user['username']} yorumuna yanıt verdi: {comment_data.content[:50]}{'...' if len(comment_data.content) > 50 else ''}",
                data={"url": f"post/{post_id}", "type": "reply", "post_id": post_id, "comment_id": comment_id}
            )
    else:
        # This is a top-level comment
        await db.posts.update_one({"id": post_id}, {"$inc": {"comments_count": 1}})
    try:
        from services.postgres_posts_service import add_comment_pg
        await add_comment_pg(post_id, current_user["id"], comment_data.content, comment_data.parent_id)
    except Exception:
        pass

    # Add XP
    await add_xp(current_user["id"], 5)
    
    # Notify post owner
    if post["user_id"] != current_user["id"]:
        await notify_user(
            recipient_id=post["user_id"],
            sender_id=current_user["id"],
            notification_type="comment",
            title="Yeni Yorum",
            body=f"@{current_user['username']} gönderine yorum yaptı",
            data={"url": f"post/{post_id}", "type": "comment", "post_id": post_id}
        )
    
    # Send mention notifications
    if mentions:
        mentioned_users = await db.users.find(
            {"username": {"$in": mentions}},
            {"_id": 0, "id": 1, "username": 1}
        ).to_list(50)
        
        for mentioned_user in mentioned_users:
            if mentioned_user["id"] != current_user["id"] and mentioned_user["id"] != post["user_id"]:
                await notify_user(
                    recipient_id=mentioned_user["id"],
                    sender_id=current_user["id"],
                    notification_type="mention",
                    title="Bir Yorumda Etiketlendin",
                    body=f"@{current_user['username']} seni bir yorumda etiketledi: {comment_data.content[:50]}{'...' if len(comment_data.content) > 50 else ''}",
                    data={"url": f"post/{post_id}", "type": "mention", "post_id": post_id, "comment_id": comment_id}
                )
    
    comment.pop("_id", None)
    return {**comment, "is_liked": False, "replies": []}


@router.get("/social/posts/{post_id}/comments")
async def get_comments(
    post_id: str,
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Gönderi yorumlarını getir"""
    skip = (page - 1) * limit
    
    # Get top-level comments
    comments = await db.comments.find(
        {"post_id": post_id, "parent_id": None},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get likes for comments
    comment_ids = [c["id"] for c in comments]
    
    for comment in comments:
        # Check if user liked
        liked = await db.comment_likes.find_one({
            "comment_id": comment["id"],
            "user_id": current_user["id"]
        })
        comment["is_liked"] = liked is not None
        
        # Get replies (limited)
        replies = await db.comments.find(
            {"parent_id": comment["id"]},
            {"_id": 0}
        ).sort("created_at", 1).limit(3).to_list(3)
        
        for reply in replies:
            reply_liked = await db.comment_likes.find_one({
                "comment_id": reply["id"],
                "user_id": current_user["id"]
            })
            reply["is_liked"] = reply_liked is not None
        
        comment["replies"] = replies
    
    return comments


@router.get("/social/comments/{comment_id}/replies")
async def get_comment_replies(
    comment_id: str,
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Yorum yanıtlarını getir"""
    skip = (page - 1) * limit
    
    replies = await db.comments.find(
        {"parent_id": comment_id},
        {"_id": 0}
    ).sort("created_at", 1).skip(skip).limit(limit).to_list(limit)
    
    for reply in replies:
        liked = await db.comment_likes.find_one({
            "comment_id": reply["id"],
            "user_id": current_user["id"]
        })
        reply["is_liked"] = liked is not None
    
    return replies


@router.delete("/social/comments/{comment_id}")
async def delete_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
    """Yorumu sil"""
    comment = await db.comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Yorum bulunamadı")
    
    # Check ownership or post ownership
    post = await db.posts.find_one({"id": comment["post_id"]})
    
    if comment["user_id"] != current_user["id"] and post["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Bu yorumu silme yetkiniz yok")
    
    # Delete comment and its replies
    await db.comments.delete_many({
        "$or": [
            {"id": comment_id},
            {"parent_id": comment_id}
        ]
    })
    
    # Update counts
    if comment.get("parent_id"):
        await db.comments.update_one({"id": comment["parent_id"]}, {"$inc": {"replies_count": -1}})
    else:
        await db.posts.update_one({"id": comment["post_id"]}, {"$inc": {"comments_count": -1}})
    
    return {"message": "Yorum silindi"}


# ============================================
# COMMENT LIKES
# ============================================

@router.post("/social/comments/{comment_id}/like")
async def like_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
    """Yorumu beğen"""
    comment = await db.comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Yorum bulunamadı")
    
    existing = await db.comment_likes.find_one({
        "comment_id": comment_id,
        "user_id": current_user["id"]
    })
    
    if existing:
        await db.comment_likes.delete_one({"_id": existing["_id"]})
        await db.comments.update_one({"id": comment_id}, {"$inc": {"likes_count": -1}})
        return {"message": "Beğeni kaldırıldı", "is_liked": False}
    else:
        await db.comment_likes.insert_one({
            "id": str(uuid.uuid4()),
            "comment_id": comment_id,
            "user_id": current_user["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.comments.update_one({"id": comment_id}, {"$inc": {"likes_count": 1}})
        
        # Notify comment owner
        if comment["user_id"] != current_user["id"]:
            await notify_user(
                recipient_id=comment["user_id"],
                sender_id=current_user["id"],
                notification_type="like",
                title="Yorumun Beğenildi",
                body=f"@{current_user['username']} yorumunu beğendi",
                data={"post_id": comment["post_id"], "comment_id": comment_id, "type": "comment_like"}
            )
        
        return {"message": "Beğenildi", "is_liked": True}


# ============================================
# COMMENT EDIT
# ============================================

@router.put("/social/comments/{comment_id}")
async def edit_comment(comment_id: str, content: str, current_user: dict = Depends(get_current_user)):
    """Yorumu düzenle"""
    comment = await db.comments.find_one({"id": comment_id, "user_id": current_user["id"]})
    if not comment:
        raise HTTPException(status_code=404, detail="Yorum bulunamadı")

    if MODERATION_ENABLED and content_moderator and content:
        try:
            text_check = await content_moderator.check_text_toxicity(content)
            if not text_check.get("safe", True):
                raise HTTPException(
                    status_code=400,
                    detail="Yorumunuz uygunsuz içerik barındırıyor."
                )
        except HTTPException:
            raise
        except Exception:
            pass

    # Extract new mentions
    mentions = re.findall(r'@(\w+)', content or "")
    
    await db.comments.update_one(
        {"id": comment_id},
        {"$set": {
            "content": content,
            "mentions": mentions,
            "edited_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Yorum güncellendi"}
