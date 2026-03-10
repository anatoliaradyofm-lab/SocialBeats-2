# Gamification Router - Rozetler, seviyeler, liderlik tablosu
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import jwt
import os

router = APIRouter(tags=["gamification"])

# Security
security = HTTPBearer()

# Database reference
db = None

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'anatolia-music-secret-key-2024')
JWT_ALGORITHM = "HS256"

def init_gamification_router(database):
    global db
    db = database

def set_dependencies(get_user_func):
    # Not needed anymore since we handle auth directly
    pass

# Badge definitions
BADGES = {
    "first_post": {"name": "İlk Gönderi", "description": "İlk gönderisini paylaştı", "icon": "📝", "xp": 50},
    "social_butterfly": {"name": "Sosyal Kelebek", "description": "100 takipçiye ulaştı", "icon": "🦋", "xp": 200},
    "music_lover": {"name": "Müzik Sever", "description": "100 şarkı dinledi", "icon": "🎵", "xp": 100},
    "playlist_master": {"name": "Playlist Ustası", "description": "10 playlist oluşturdu", "icon": "📋", "xp": 150},
    "community_leader": {"name": "Topluluk Lideri", "description": "Bir topluluk kurdu", "icon": "👑", "xp": 300},
    "early_adopter": {"name": "Erken Kuş", "description": "İlk 1000 kullanıcıdan biri", "icon": "🐦", "xp": 500},
    "verified": {"name": "Doğrulanmış", "description": "Doğrulanmış hesap", "icon": "✓", "xp": 1000},
    "top_contributor": {"name": "En Çok Katkı", "description": "Haftalık en çok katkı sağlayan", "icon": "⭐", "xp": 250},
    "streak_master": {"name": "Seri Ustası", "description": "30 gün üst üste giriş yaptı", "icon": "🔥", "xp": 400},
    "influencer": {"name": "Influencer", "description": "1000 takipçiye ulaştı", "icon": "📢", "xp": 500},
}

# Level thresholds
LEVELS = [
    {"level": 1, "name": "Yeni Başlayan", "xp_required": 0},
    {"level": 2, "name": "Çaylak", "xp_required": 100},
    {"level": 3, "name": "Acemi", "xp_required": 300},
    {"level": 4, "name": "Orta Düzey", "xp_required": 600},
    {"level": 5, "name": "Deneyimli", "xp_required": 1000},
    {"level": 6, "name": "Uzman", "xp_required": 1500},
    {"level": 7, "name": "Usta", "xp_required": 2500},
    {"level": 8, "name": "Profesyonel", "xp_required": 4000},
    {"level": 9, "name": "Efsane", "xp_required": 6000},
    {"level": 10, "name": "Tanrısal", "xp_required": 10000},
]

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_level_for_xp(xp: int) -> dict:
    """Get level info for given XP amount"""
    current_level = LEVELS[0]
    for level in LEVELS:
        if xp >= level["xp_required"]:
            current_level = level
        else:
            break
    return current_level

async def award_badge(user_id: str, badge_type: str) -> bool:
    """Award a badge to user if not already owned"""
    if badge_type not in BADGES:
        return False
    
    # Check if user already has this badge
    existing = await db.user_badges.find_one({
        "user_id": user_id,
        "badge_type": badge_type
    })
    
    if existing:
        return False
    
    badge_info = BADGES[badge_type]
    now = datetime.now(timezone.utc).isoformat()
    
    await db.user_badges.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "badge_type": badge_type,
        "name": badge_info["name"],
        "description": badge_info["description"],
        "icon": badge_info["icon"],
        "awarded_at": now
    })
    
    # Award XP
    await add_xp(user_id, badge_info["xp"], f"Badge: {badge_info['name']}")
    
    return True

async def add_xp(user_id: str, amount: int, reason: str = ""):
    """Add XP to user"""
    await db.users.update_one(
        {"id": user_id},
        {"$inc": {"xp": amount}}
    )
    
    # Log XP gain
    await db.xp_history.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "amount": amount,
        "reason": reason,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

@router.get("/gamification/levels")
async def get_levels():
    """Get all level definitions"""
    return LEVELS

@router.get("/gamification/badges")
async def get_all_badges():
    """Get all available badges"""
    return [
        {"type": k, **v} for k, v in BADGES.items()
    ]

@router.get("/gamification/leaderboard")
async def get_leaderboard(
    period: str = "all",  # all, weekly, monthly
    limit: int = 50
):
    """Get XP leaderboard"""
    # For now, return all-time leaderboard
    users = await db.users.find(
        {},
        {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1, "xp": 1}
    ).sort("xp", -1).limit(limit).to_list(limit)
    
    leaderboard = []
    for rank, user in enumerate(users, 1):
        xp = user.get("xp", 0)
        level = get_level_for_xp(xp)
        leaderboard.append({
            "rank": rank,
            "user": user,
            "xp": xp,
            "level": level
        })
    
    return leaderboard

@router.get("/badges")
async def get_badges_list():
    """Get all badge definitions"""
    return [{"type": k, **v} for k, v in BADGES.items()]

@router.get("/user/{user_id}/badges")
async def get_user_badges(user_id: str):
    """Get badges for a specific user"""
    badges = await db.user_badges.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(100)
    return badges

@router.post("/badges/check")
async def check_and_award_badges(current_user: dict = Depends(get_current_user)):
    """Check and award any earned badges"""
    user_id = current_user["id"]
    awarded = []
    
    # Check various badge conditions
    # First post badge
    post_count = await db.posts.count_documents({"user_id": user_id})
    if post_count >= 1:
        if await award_badge(user_id, "first_post"):
            awarded.append("first_post")
    
    # Social butterfly (100 followers)
    follower_count = await db.follows.count_documents({"following_id": user_id})
    if follower_count >= 100:
        if await award_badge(user_id, "social_butterfly"):
            awarded.append("social_butterfly")
    
    # Influencer (1000 followers)
    if follower_count >= 1000:
        if await award_badge(user_id, "influencer"):
            awarded.append("influencer")
    
    # Playlist master (10 playlists)
    playlist_count = await db.playlists.count_documents({"user_id": user_id})
    if playlist_count >= 10:
        if await award_badge(user_id, "playlist_master"):
            awarded.append("playlist_master")
    
    return {"awarded_badges": awarded}

@router.get("/profile/level")
async def get_profile_level(current_user: dict = Depends(get_current_user)):
    """Get current user's level info"""
    xp = current_user.get("xp", 0)
    current_level = get_level_for_xp(xp)
    
    # Find next level
    next_level = None
    for level in LEVELS:
        if level["xp_required"] > xp:
            next_level = level
            break
    
    progress = 0
    if next_level:
        xp_in_level = xp - current_level["xp_required"]
        xp_needed = next_level["xp_required"] - current_level["xp_required"]
        progress = (xp_in_level / xp_needed) * 100 if xp_needed > 0 else 100
    else:
        progress = 100
    
    return {
        "current_level": current_level,
        "next_level": next_level,
        "total_xp": xp,
        "progress_percent": round(progress, 1)
    }

@router.get("/profile/badges")
async def get_profile_badges(current_user: dict = Depends(get_current_user)):
    """Get current user's badges"""
    badges = await db.user_badges.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    # Add unclaimed/available badges
    owned_types = {b["badge_type"] for b in badges}
    available = [
        {"type": k, **v, "owned": k in owned_types}
        for k, v in BADGES.items()
    ]
    
    return {
        "owned": badges,
        "all_badges": available
    }

@router.post("/profile/badges/{badge_id}/claim")
async def claim_badge(badge_id: str, current_user: dict = Depends(get_current_user)):
    """Claim a badge (if eligible)"""
    if badge_id not in BADGES:
        raise HTTPException(status_code=404, detail="Badge not found")
    
    # Check if already owned
    existing = await db.user_badges.find_one({
        "user_id": current_user["id"],
        "badge_type": badge_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Badge already claimed")
    
    # For now, just award the badge (in real app, check eligibility)
    success = await award_badge(current_user["id"], badge_id)
    
    if success:
        return {"message": "Badge claimed successfully", "badge": BADGES[badge_id]}
    else:
        raise HTTPException(status_code=400, detail="Could not claim badge")

@router.get("/xp/history")
async def get_xp_history(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get XP gain history for current user"""
    history = await db.xp_history.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return history
