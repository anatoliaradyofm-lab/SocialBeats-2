from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from core.security import get_current_user
from core.database import db
import uuid
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Listening Rooms"])

@router.post("/listening-rooms")
async def create_room(
    data: dict,
    user: dict = Depends(get_current_user)
):
    """Oda olustur (Host)"""
    room_id = str(uuid.uuid4())
    room = {
        "id": room_id,
        "host_id": user["id"],
        "name": data.get("name", "Muzik Odasi"),
        "type": data.get("type", "public"), # public, followers, invite, private
        "capacity": data.get("capacity", 50),
        "cover_url": data.get("cover_url", ""),
        "description": data.get("description", ""),
        "is_active": True,
        "participants": [
            {
                "user_id": user["id"],
                "role": "host",
                "joined_at": datetime.now(timezone.utc).isoformat()
            }
        ],
        "queue": [],
        "current_track": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.listening_rooms.insert_one(room)
    return {"status": "success", "room": room}

@router.get("/listening-rooms/explore")
async def get_active_rooms(
    user: dict = Depends(get_current_user),
    skip: int = 0,
    limit: int = 20
):
    """Aktif public odalari listele"""
    rooms = await db.listening_rooms.find(
        {"is_active": True, "type": "public"}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(None)
    
    for r in rooms:
        r.pop("_id", None)
    return rooms

@router.get("/listening-rooms")
async def get_all_active_rooms(
    user: dict = Depends(get_current_user),
    skip: int = 0,
    limit: int = 20
):
    """Aktif public odalari listele"""
    rooms = await db.listening_rooms.find(
        {"is_active": True, "type": "public"}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(None)
    
    for r in rooms:
        r.pop("_id", None)
    return rooms

@router.get("/listening-rooms/{room_id}")
async def get_room_details(
    room_id: str,
    user: dict = Depends(get_current_user)
):
    room = await db.listening_rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Oda bulunamadi")
    room.pop("_id", None)
    return room

@router.post("/listening-rooms/{room_id}/join")
async def join_room(
    room_id: str,
    user: dict = Depends(get_current_user)
):
    room = await db.listening_rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Oda bulunamadi")
    if not room.get("is_active"):
        raise HTTPException(status_code=400, detail="Oda aktif degil")
        
    participants = room.get("participants", [])
    if len(participants) >= room.get("capacity", 50):
        raise HTTPException(status_code=400, detail="Oda dolu")
        
    for p in participants:
        if p["user_id"] == user["id"]:
            # Zaten odada
            return {"status": "success", "room": room}
            
    await db.listening_rooms.update_one(
        {"id": room_id},
        {"$push": {"participants": {
            "user_id": user["id"],
            "role": "participant",
            "joined_at": datetime.now(timezone.utc).isoformat()
        }}}
    )
    
    # Broadcast to websocket
    try:
        from server import sio_broadcast_to_room
        await sio_broadcast_to_room(f"room_{room_id}", "room_participant_joined", {"user_id": user["id"], "username": user.get("username")})
    except Exception as e:
        logger.error(f"Ws error: {e}")
        
    return {"status": "success"}

@router.post("/listening-rooms/{room_id}/leave")
async def leave_room(
    room_id: str,
    user: dict = Depends(get_current_user)
):
    room = await db.listening_rooms.find_one({"id": room_id})
    if not room:
        return {"status": "success"}
    
    await db.listening_rooms.update_one(
        {"id": room_id},
        {"$pull": {"participants": {"user_id": user["id"]}}}
    )
    
    # Eger odada kimse kalmadiysa kapat
    updated = await db.listening_rooms.find_one({"id": room_id})
    if not updated.get("participants") or (len(updated.get("participants", [])) == 0):
        await db.listening_rooms.update_one({"id": room_id}, {"$set": {"is_active": False}})
        
    try:
        from server import sio_broadcast_to_room
        await sio_broadcast_to_room(f"room_{room_id}", "room_participant_left", {"user_id": user["id"]})
    except Exception as e:
        pass
        
    return {"status": "success"}

@router.post("/listening-rooms/{room_id}/queue")
async def add_to_queue(
    room_id: str,
    data: dict,
    user: dict = Depends(get_current_user)
):
    """Sıraya parça ekle"""
    track_id = str(uuid.uuid4())
    track = {
        "id": track_id,
        "url": data.get("url"),
        "title": data.get("title"),
        "artist": data.get("artist"),
        "cover": data.get("cover"),
        "added_by": user["id"],
        "votes": 0,
        "voter_ids": []
    }
    await db.listening_rooms.update_one(
        {"id": room_id},
        {"$push": {"queue": track}}
    )
    
    try:
        from server import sio_broadcast_to_room
        await sio_broadcast_to_room(f"room_{room_id}", "room_queue_updated", track)
    except:
        pass
        
    return {"status": "success", "track": track}

@router.post("/listening-rooms/{room_id}/sync")
async def sync_playback(
    room_id: str,
    data: dict,
    user: dict = Depends(get_current_user)
):
    """Sadece Host muzigi senkronize edebilir"""
    room = await db.listening_rooms.find_one({"id": room_id})
    if not room or room.get("host_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Yetkisiz")
        
    update_data = {
        "current_track": data.get("current_track"),
        "position": data.get("position", 0),
        "is_playing": data.get("is_playing", True),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.listening_rooms.update_one(
        {"id": room_id},
        {"$set": update_data}
    )
    
    try:
        from server import sio_broadcast_to_room
        await sio_broadcast_to_room(f"room_{room_id}", "room_sync", update_data)
    except:
        pass
        
    return {"status": "success"}
