# Communities Router - Topluluk yönetimi
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
import jwt
import os

router = APIRouter(tags=["communities"])

# Security
security = HTTPBearer()

# Database reference - will be set during init
db = None

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'anatolia-music-secret-key-2024')
JWT_ALGORITHM = "HS256"

def init_communities_router(database):
    global db
    db = database

# Pydantic Models
class CommunityCreate(BaseModel):
    name: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    community_type: str = "general"
    genre: Optional[str] = None

class Community(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    community_type: str
    genre: Optional[str] = None
    owner_id: str
    members_count: int = 0
    posts_count: int = 0
    created_at: str
    is_member: bool = False
    is_admin: bool = False

# Helper function placeholder
_award_badge_func = None

def set_dependencies(get_user_func, award_badge_func):
    global _award_badge_func
    _award_badge_func = award_badge_func

async def award_badge(user_id: str, badge_type: str):
    if _award_badge_func:
        await _award_badge_func(user_id, badge_type)

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

@router.post("/communities", response_model=Community)
async def create_community(community_data: CommunityCreate, current_user: dict = Depends(get_current_user)):
    community_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    community = {
        "id": community_id,
        "name": community_data.name,
        "description": community_data.description,
        "cover_url": community_data.cover_url or "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600",
        "community_type": community_data.community_type,
        "genre": community_data.genre,
        "owner_id": current_user["id"],
        "members_count": 1,
        "posts_count": 0,
        "created_at": now
    }
    
    await db.communities.insert_one(community)
    
    # Add owner as member
    await db.community_members.insert_one({
        "id": str(uuid.uuid4()),
        "community_id": community_id,
        "user_id": current_user["id"],
        "role": "admin",
        "joined_at": now
    })
    
    # Award community leader badge
    await award_badge(current_user["id"], "community_leader")
    
    community.pop("_id", None)
    return Community(**community, is_member=True, is_admin=True)

@router.get("/communities")
async def get_communities(
    genre: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if genre:
        query["genre"] = genre
    
    communities = await db.communities.find(query, {"_id": 0}).to_list(50)
    
    for comm in communities:
        membership = await db.community_members.find_one({
            "community_id": comm["id"],
            "user_id": current_user["id"]
        })
        comm["is_member"] = membership is not None
        comm["is_admin"] = membership["role"] == "admin" if membership else False
    
    return communities

@router.get("/communities/{community_id}")
async def get_community(community_id: str, current_user: dict = Depends(get_current_user)):
    community = await db.communities.find_one({"id": community_id}, {"_id": 0})
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    
    membership = await db.community_members.find_one({
        "community_id": community_id,
        "user_id": current_user["id"]
    })
    community["is_member"] = membership is not None
    community["is_admin"] = membership["role"] == "admin" if membership else False
    
    return community

@router.post("/communities/{community_id}/join")
async def join_community(community_id: str, current_user: dict = Depends(get_current_user)):
    community = await db.communities.find_one({"id": community_id}, {"_id": 0})
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    
    existing = await db.community_members.find_one({
        "community_id": community_id,
        "user_id": current_user["id"]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Already a member")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.community_members.insert_one({
        "id": str(uuid.uuid4()),
        "community_id": community_id,
        "user_id": current_user["id"],
        "role": "member",
        "joined_at": now
    })
    
    await db.communities.update_one({"id": community_id}, {"$inc": {"members_count": 1}})
    
    return {"message": "Joined community successfully"}

@router.delete("/communities/{community_id}/leave")
async def leave_community(community_id: str, current_user: dict = Depends(get_current_user)):
    membership = await db.community_members.find_one({
        "community_id": community_id,
        "user_id": current_user["id"]
    })
    
    if not membership:
        raise HTTPException(status_code=400, detail="Not a member")
    
    if membership["role"] == "admin":
        # Check if there are other admins
        admin_count = await db.community_members.count_documents({
            "community_id": community_id,
            "role": "admin"
        })
        if admin_count == 1:
            raise HTTPException(status_code=400, detail="Cannot leave as the only admin")
    
    await db.community_members.delete_one({"_id": membership["_id"]})
    await db.communities.update_one({"id": community_id}, {"$inc": {"members_count": -1}})
    
    return {"message": "Left community successfully"}

@router.get("/communities/{community_id}/members")
async def get_community_members(
    community_id: str, 
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    community = await db.communities.find_one({"id": community_id})
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")
    
    members = await db.community_members.find(
        {"community_id": community_id}, 
        {"_id": 0}
    ).limit(limit).to_list(limit)
    
    # Get user details for each member
    for member in members:
        user = await db.users.find_one({"id": member["user_id"]}, {"_id": 0, "password": 0})
        if user:
            member["user"] = user
    
    return members

@router.post("/communities/{community_id}/posts")
async def create_community_post(
    community_id: str,
    content: str,
    current_user: dict = Depends(get_current_user)
):
    # Verify membership
    membership = await db.community_members.find_one({
        "community_id": community_id,
        "user_id": current_user["id"]
    })
    
    if not membership:
        raise HTTPException(status_code=403, detail="Must be a member to post")
    
    post_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    post = {
        "id": post_id,
        "community_id": community_id,
        "user_id": current_user["id"],
        "username": current_user.get("username"),
        "content": content,
        "likes_count": 0,
        "comments_count": 0,
        "created_at": now
    }
    
    await db.community_posts.insert_one(post)
    await db.communities.update_one({"id": community_id}, {"$inc": {"posts_count": 1}})
    
    post.pop("_id", None)
    return post

@router.get("/communities/{community_id}/posts")
async def get_community_posts(
    community_id: str,
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    posts = await db.community_posts.find(
        {"community_id": community_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    # Add user info to each post
    for post in posts:
        user = await db.users.find_one(
            {"id": post["user_id"]}, 
            {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
        )
        if user:
            post["user"] = user
    
    return posts
