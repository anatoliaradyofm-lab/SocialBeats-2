# Friends Routes - Arkadaşlık sistemi
# Modularized from server.py

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/social", tags=["Friends"])

# These will be set by server.py
db = None
get_current_user = None
add_xp = None

def init_friends_router(database, auth_func, xp_func):
    """Initialize router with dependencies"""
    global db, get_current_user, add_xp
    db = database
    get_current_user = auth_func
    add_xp = xp_func


@router.post("/friend-request/{user_id}")
async def send_friend_request(user_id: str, current_user: dict = Depends(lambda: get_current_user)):
    """Arkadaşlık isteği gönder"""
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Kendinize istek gönderemezsiniz")
    
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    # Check if already friends
    existing_follow = await db.follows.find_one({
        "$or": [
            {"follower_id": current_user["id"], "following_id": user_id},
            {"follower_id": user_id, "following_id": current_user["id"]}
        ]
    })
    if existing_follow:
        raise HTTPException(status_code=400, detail="Zaten arkadaşsınız")
    
    # Check if request already sent
    existing_request = await db.friend_requests.find_one({
        "$or": [
            {"from_user_id": current_user["id"], "to_user_id": user_id, "status": "pending"},
            {"from_user_id": user_id, "to_user_id": current_user["id"], "status": "pending"}
        ]
    })
    if existing_request:
        raise HTTPException(status_code=400, detail="Zaten bekleyen bir istek var")
    
    request_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    friend_request = {
        "id": request_id,
        "from_user_id": current_user["id"],
        "from_username": current_user["username"],
        "from_avatar": current_user.get("avatar_url"),
        "from_display_name": current_user.get("display_name"),
        "to_user_id": user_id,
        "status": "pending",
        "created_at": now
    }
    
    await db.friend_requests.insert_one(friend_request)
    
    # Send notification
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "friend_request",
        "from_user_id": current_user["id"],
        "from_username": current_user["username"],
        "from_avatar": current_user.get("avatar_url"),
        "content": f"@{current_user['username']} size arkadaşlık isteği gönderdi",
        "reference_id": request_id,
        "reference_type": "friend_request",
        "is_read": False,
        "created_at": now
    })
    
    return {"message": "Arkadaşlık isteği gönderildi", "request_id": request_id}


@router.get("/friend-requests")
async def get_friend_requests(current_user: dict = Depends(lambda: get_current_user)):
    """Gelen arkadaşlık isteklerini getir"""
    requests = await db.friend_requests.find(
        {"to_user_id": current_user["id"], "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return requests


@router.get("/friend-requests/sent")
async def get_sent_friend_requests(current_user: dict = Depends(lambda: get_current_user)):
    """Gönderilen arkadaşlık isteklerini getir"""
    requests = await db.friend_requests.find(
        {"from_user_id": current_user["id"], "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return requests


@router.post("/friend-request/{request_id}/accept")
async def accept_friend_request(request_id: str, current_user: dict = Depends(lambda: get_current_user)):
    """Arkadaşlık isteğini kabul et"""
    request = await db.friend_requests.find_one({
        "id": request_id,
        "to_user_id": current_user["id"],
        "status": "pending"
    })
    
    if not request:
        raise HTTPException(status_code=404, detail="İstek bulunamadı")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update request status
    await db.friend_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "accepted", "accepted_at": now}}
    )
    
    # Create mutual follow relationship
    await db.follows.insert_one({
        "id": str(uuid.uuid4()),
        "follower_id": current_user["id"],
        "following_id": request["from_user_id"],
        "created_at": now
    })
    await db.follows.insert_one({
        "id": str(uuid.uuid4()),
        "follower_id": request["from_user_id"],
        "following_id": current_user["id"],
        "created_at": now
    })
    
    # Update counts for both users
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"following_count": 1, "followers_count": 1}})
    await db.users.update_one({"id": request["from_user_id"]}, {"$inc": {"following_count": 1, "followers_count": 1}})
    
    # Add XP
    if add_xp:
        await add_xp(current_user["id"], 10)
        await add_xp(request["from_user_id"], 10)
    
    # Send notification to requester
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": request["from_user_id"],
        "type": "friend_accepted",
        "from_user_id": current_user["id"],
        "from_username": current_user["username"],
        "from_avatar": current_user.get("avatar_url"),
        "content": f"@{current_user['username']} arkadaşlık isteğinizi kabul etti",
        "reference_id": request_id,
        "reference_type": "friend_request",
        "is_read": False,
        "created_at": now
    })
    
    return {"message": "Arkadaşlık isteği kabul edildi"}


@router.post("/friend-request/{request_id}/reject")
async def reject_friend_request(request_id: str, current_user: dict = Depends(lambda: get_current_user)):
    """Arkadaşlık isteğini reddet"""
    request = await db.friend_requests.find_one({
        "id": request_id,
        "to_user_id": current_user["id"],
        "status": "pending"
    })
    
    if not request:
        raise HTTPException(status_code=404, detail="İstek bulunamadı")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.friend_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "rejected", "rejected_at": now}}
    )
    
    return {"message": "Arkadaşlık isteği reddedildi"}


@router.delete("/friend-request/{request_id}/cancel")
async def cancel_friend_request(request_id: str, current_user: dict = Depends(lambda: get_current_user)):
    """Arkadaşlık isteğini iptal et"""
    result = await db.friend_requests.delete_one({
        "id": request_id,
        "from_user_id": current_user["id"],
        "status": "pending"
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="İstek bulunamadı")
    
    return {"message": "Arkadaşlık isteği iptal edildi"}


@router.get("/friends")
async def get_friends(current_user: dict = Depends(lambda: get_current_user)):
    """Arkadaş listesini getir"""
    # Get mutual follows (friends)
    following = await db.follows.find(
        {"follower_id": current_user["id"]},
        {"_id": 0, "following_id": 1}
    ).to_list(1000)
    following_ids = [f["following_id"] for f in following]
    
    followers = await db.follows.find(
        {"following_id": current_user["id"]},
        {"_id": 0, "follower_id": 1}
    ).to_list(1000)
    follower_ids = [f["follower_id"] for f in followers]
    
    # Find mutual (friends)
    friend_ids = list(set(following_ids) & set(follower_ids))
    
    if not friend_ids:
        return []
    
    friends = await db.users.find(
        {"id": {"$in": friend_ids}},
        {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1, "is_online": 1}
    ).to_list(100)
    
    return friends


@router.delete("/friend/{user_id}")
async def remove_friend(user_id: str, current_user: dict = Depends(lambda: get_current_user)):
    """Arkadaşlıktan çıkar"""
    # Remove both follow relationships
    await db.follows.delete_many({
        "$or": [
            {"follower_id": current_user["id"], "following_id": user_id},
            {"follower_id": user_id, "following_id": current_user["id"]}
        ]
    })
    
    # Update counts
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"following_count": -1, "followers_count": -1}})
    await db.users.update_one({"id": user_id}, {"$inc": {"following_count": -1, "followers_count": -1}})
    
    return {"message": "Arkadaşlıktan çıkarıldı"}
