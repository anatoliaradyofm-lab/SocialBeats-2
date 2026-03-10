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
        "type": "follow",
        "title": "Yeni Takipçi",
        "body": f"@{current_user['username']} seni takip etmeye başladı",
        "read": False,
        "created_at": now
    })
    
    return {"message": "Successfully followed user"}

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
    
    await db.follow_requests.insert_one({
        "id": str(uuid.uuid4()),
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
        "type": "follow_request",
        "title": "Takip İsteği",
        "body": f"@{current_user['username']} seni takip etmek istiyor",
        "read": False,
        "created_at": now
    })
    
    return {"message": "Follow request sent"}

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

@router.post("/notifications/mark-read")
async def mark_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": current_user["id"], "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "Notifications marked as read"}
