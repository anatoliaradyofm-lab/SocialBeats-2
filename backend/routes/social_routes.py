# Social Routes - Posts, Follow, Comments, Notifications
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import db
from core.auth import get_current_user

router = APIRouter(prefix="/social", tags=["social"])

# ============== MODELS ==============
class PostCreate(BaseModel):
    content: str
    media_urls: List[str] = []
    track_id: Optional[str] = None
    playlist_id: Optional[str] = None
    mood: Optional[str] = None
    hashtags: List[str] = []
    location: Optional[str] = None
    poll_options: Optional[List[str]] = None
    visibility: str = "public"

# ============== FOLLOW SYSTEM ==============
@router.post("/follow/{user_id}")
async def follow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Follow a user"""
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing = await db.follows.find_one({
        "follower_id": current_user["id"],
        "following_id": user_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Already following this user")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Private account → send follow request instead of direct follow
    if target_user.get("is_private"):
        existing_req = await db.follow_requests.find_one({
            "sender_id": current_user["id"], "receiver_id": user_id, "status": "pending"
        })
        if existing_req:
            return {"status": "request_already_sent"}
        req_id = str(uuid.uuid4())
        await db.follow_requests.insert_one({
            "id": req_id,
            "sender_id": current_user["id"],
            "receiver_id": user_id,
            "status": "pending",
            "created_at": now
        })
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "sender_id": current_user["id"],
            "actor_username": current_user.get("username"),
            "type": "follow_request",
            "title": "Takip İsteği",
            "body": f"@{current_user['username']} seni takip etmek istiyor",
            "reference_id": req_id,
            "read": False,
            "created_at": now
        })
        return {"status": "request_sent"}

    await db.follows.insert_one({
        "id": str(uuid.uuid4()),
        "follower_id": current_user["id"],
        "following_id": user_id,
        "created_at": now
    })

    # Update counts
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"following_count": 1}})
    await db.users.update_one({"id": user_id}, {"$inc": {"followers_count": 1}})

    # Create notification
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "sender_id": current_user["id"],
        "actor_username": current_user.get("username"),
        "type": "follow",
        "title": "Yeni Takipçi",
        "body": f"@{current_user['username']} seni takip etmeye başladı",
        "read": False,
        "created_at": now
    })

    return {"message": "Successfully followed user", "status": "following"}

@router.get("/follow-status/{user_id}")
async def get_follow_status(user_id: str, current_user: dict = Depends(get_current_user)):
    """Check if current user is following another user"""
    # Check if following
    is_following = await db.follows.find_one({
        "follower_id": current_user["id"],
        "following_id": user_id
    })
    
    # Check if follow request sent
    is_requested = await db.follow_requests.find_one({
        "sender_id": current_user["id"],
        "receiver_id": user_id,
        "status": "pending"
    })
    
    return {
        "is_following": is_following is not None,
        "is_requested": is_requested is not None
    }

@router.post("/follow-request/{user_id}")
async def send_follow_request(user_id: str, current_user: dict = Depends(get_current_user)):
    """Send a follow request to a private account"""
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot send request to yourself")
    
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already following
    existing_follow = await db.follows.find_one({
        "follower_id": current_user["id"],
        "following_id": user_id
    })
    if existing_follow:
        raise HTTPException(status_code=400, detail="Already following this user")
    
    # Check if request already sent
    existing_request = await db.follow_requests.find_one({
        "sender_id": current_user["id"],
        "receiver_id": user_id,
        "status": "pending"
    })
    if existing_request:
        raise HTTPException(status_code=400, detail="Follow request already sent")
    
    now = datetime.now(timezone.utc).isoformat()
    
    req_id = str(uuid.uuid4())
    await db.follow_requests.insert_one({
        "id": req_id,
        "sender_id": current_user["id"],
        "receiver_id": user_id,
        "status": "pending",
        "created_at": now
    })

    # Create notification
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "sender_id": current_user["id"],
        "actor_username": current_user.get("username"),
        "type": "follow_request",
        "title": "Takip İsteği",
        "body": f"@{current_user['username']} seni takip etmek istiyor",
        "reference_id": req_id,
        "read": False,
        "created_at": now
    })
    
    return {"message": "Follow request sent"}

@router.post("/follow-request/{request_id}/accept")
async def accept_follow_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Accept a follow request — adds sender to followers list"""
    req = await db.follow_requests.find_one({
        "id": request_id,
        "receiver_id": current_user["id"],
        "status": "pending"
    })
    if not req:
        raise HTTPException(status_code=404, detail="Follow request not found")

    sender_id = req["sender_id"]
    now = datetime.now(timezone.utc).isoformat()

    # Add to follows
    existing = await db.follows.find_one({"follower_id": sender_id, "following_id": current_user["id"]})
    if not existing:
        await db.follows.insert_one({
            "id": str(uuid.uuid4()),
            "follower_id": sender_id,
            "following_id": current_user["id"],
            "created_at": now
        })
        await db.users.update_one({"id": sender_id}, {"$inc": {"following_count": 1}})
        await db.users.update_one({"id": current_user["id"]}, {"$inc": {"followers_count": 1}})

    # Mark request accepted
    await db.follow_requests.update_one({"id": request_id}, {"$set": {"status": "accepted"}})

    # Notify sender
    me = await db.users.find_one({"id": current_user["id"]})
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": sender_id,
        "sender_id": current_user["id"],
        "actor_username": current_user.get("username"),
        "actor_avatar": me.get("avatar_url") if me else None,
        "type": "follow_accepted",
        "title": "Takip İsteği Kabul Edildi",
        "body": f"@{current_user['username']} takip isteğini kabul etti",
        "read": False,
        "created_at": now
    })

    return {"status": "accepted"}


@router.post("/follow-request/{request_id}/reject")
async def reject_follow_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Reject a follow request"""
    result = await db.follow_requests.delete_one({
        "id": request_id,
        "receiver_id": current_user["id"],
        "status": "pending"
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Follow request not found")
    return {"status": "rejected"}


@router.delete("/follow-request/{user_id}/cancel")
async def cancel_follow_request(user_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel a pending follow request"""
    result = await db.follow_requests.delete_one({
        "sender_id": current_user["id"],
        "receiver_id": user_id,
        "status": "pending"
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No pending request found")
    
    return {"message": "Follow request cancelled"}

@router.delete("/unfollow/{user_id}")
async def unfollow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Unfollow a user"""
    result = await db.follows.delete_one({
        "follower_id": current_user["id"],
        "following_id": user_id
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Not following this user")
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"following_count": -1}})
    await db.users.update_one({"id": user_id}, {"$inc": {"followers_count": -1}})
    return {"message": "Successfully unfollowed user"}

@router.delete("/follow/{user_id}")
async def unfollow_user_alias(user_id: str, current_user: dict = Depends(get_current_user)):
    """Unfollow a user (alias for DELETE /unfollow/{user_id})"""
    result = await db.follows.delete_one({
        "follower_id": current_user["id"],
        "following_id": user_id
    })
    if result.deleted_count == 0:
        # Also cancel any pending follow request
        await db.follow_requests.delete_one({"sender_id": current_user["id"], "receiver_id": user_id})
        return {"message": "Unfollowed"}
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"following_count": -1}})
    await db.users.update_one({"id": user_id}, {"$inc": {"followers_count": -1}})
    return {"message": "Successfully unfollowed user"}

@router.delete("/follower/{user_id}")
async def remove_follower(user_id: str, current_user: dict = Depends(get_current_user)):
    """Remove a follower from your followers list"""
    result = await db.follows.delete_one({
        "follower_id": user_id,
        "following_id": current_user["id"]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Takipçi bulunamadı")
    await db.users.update_one({"id": user_id}, {"$inc": {"following_count": -1}})
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"followers_count": -1}})
    return {"message": "Follower removed"}

@router.get("/followers/{user_id}")
async def get_followers(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get user's followers"""
    followers = await db.follows.find({"following_id": user_id}, {"_id": 0}).to_list(100)
    follower_ids = [f["follower_id"] for f in followers]
    
    users = await db.users.find(
        {"id": {"$in": follower_ids}},
        {"_id": 0, "password": 0, "email": 0}
    ).to_list(100)
    
    for user in users:
        is_following = await db.follows.find_one({
            "follower_id": current_user["id"],
            "following_id": user["id"]
        })
        user["is_following"] = is_following is not None
        is_follower_back = await db.follows.find_one({
            "follower_id": user["id"],
            "following_id": current_user["id"]
        })
        user["is_mutual"] = (is_following is not None) and (is_follower_back is not None)
    
    return {"followers": users}

@router.get("/following/{user_id}")
async def get_following(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get users that user is following"""
    following = await db.follows.find({"follower_id": user_id}, {"_id": 0}).to_list(100)
    following_ids = [f["following_id"] for f in following]
    
    users = await db.users.find(
        {"id": {"$in": following_ids}},
        {"_id": 0, "password": 0, "email": 0}
    ).to_list(100)
    
    for user in users:
        is_following = await db.follows.find_one({
            "follower_id": current_user["id"],
            "following_id": user["id"]
        })
        user["is_following"] = is_following is not None
        is_follower_back = await db.follows.find_one({
            "follower_id": user["id"],
            "following_id": current_user["id"]
        })
        user["is_mutual"] = (is_following is not None) and (is_follower_back is not None)
    
    return {"following": users}


# Posts, Feed, Comments endpoints moved to:
# - routes/posts.py
# - routes/feed.py
# - routes/comments.py

# ============== NOTIFICATIONS ==============
@router.get("/notifications")
async def get_notifications(
    limit: int = Query(50, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get user notifications"""
    notifications = await db.notifications.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return notifications

@router.get("/notifications/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Get unread notification count"""
    count = await db.notifications.count_documents({
        "user_id": current_user["id"],
        "read": False
    })
    return {"count": count}

@router.post("/notifications/{notif_id}/read")
async def mark_single_notification_read(notif_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a single notification as read"""
    await db.notifications.update_one(
        {"id": notif_id, "user_id": current_user["id"]},
        {"$set": {"read": True, "is_read": True}}
    )
    return {"message": "Notification marked as read"}

@router.post("/notifications/mark-read")
async def mark_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": current_user["id"]},
        {"$set": {"read": True, "is_read": True}}
    )
    return {"message": "Notifications marked as read"}


# ============== MUTED USERS ENDPOINTS ==============

@router.get("/muted")
async def get_muted_users(current_user: dict = Depends(get_current_user)):
    """Sessize alınan kullanıcılar listesi"""
    muted_cursor = db.muted_users.find(
        {"muter_id": current_user["id"]},
        {"_id": 0, "muted_user_id": 1, "created_at": 1}
    ).sort("created_at", -1)
    muted_docs = await muted_cursor.to_list(length=200)
    muted_ids = [m["muted_user_id"] for m in muted_docs]
    if not muted_ids:
        return []
    users_cursor = db.users.find(
        {"id": {"$in": muted_ids}},
        {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
    )
    users = await users_cursor.to_list(length=200)
    return users


@router.post("/mute/{user_id}")
async def mute_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Kullanıcıyı sessize al"""
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot mute yourself")
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    existing = await db.muted_users.find_one({
        "muter_id": current_user["id"],
        "muted_user_id": user_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="User already muted")
    now = datetime.now(timezone.utc).isoformat()
    await db.muted_users.insert_one({
        "id": str(uuid.uuid4()),
        "muter_id": current_user["id"],
        "muted_user_id": user_id,
        "created_at": now,
    })
    return {"muted": True, "user_id": user_id}


@router.delete("/unmute/{user_id}")
async def unmute_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Kullanıcıyı sessize almayı kaldır"""
    result = await db.muted_users.delete_one({
        "muter_id": current_user["id"],
        "muted_user_id": user_id
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User was not muted")
    return {"unmuted": True, "user_id": user_id}


# ============== BLOCKED USERS ENDPOINTS ==============

@router.get("/blocked-users")
async def get_blocked_users(current_user: dict = Depends(get_current_user)):
    """Engellenen kullanıcılar listesi"""
    blocked_cursor = db.blocked_users.find(
        {"blocker_id": current_user["id"]},
        {"_id": 0, "blocked_user_id": 1}
    )
    blocked_docs = await blocked_cursor.to_list(length=200)
    blocked_ids = [b["blocked_user_id"] for b in blocked_docs]
    if not blocked_ids:
        return []
    users_cursor = db.users.find(
        {"id": {"$in": blocked_ids}},
        {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
    )
    users = await users_cursor.to_list(length=200)
    return users


@router.delete("/unblock/{user_id}")
async def unblock_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Kullanıcının engelini kaldır"""
    result = await db.blocked_users.delete_one({
        "blocker_id": current_user["id"],
        "blocked_user_id": user_id
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User was not blocked")
    return {"unblocked": True, "user_id": user_id}
