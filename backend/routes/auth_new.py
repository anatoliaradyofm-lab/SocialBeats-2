# Auth Routes - Modular Authentication System
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import bcrypt
import jwt
import os

# Router setup
router = APIRouter(prefix="/auth", tags=["auth"])

# Import database from core
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import db

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'anatolia-music-secret-key-2024')
JWT_ALGORITHM = "HS256"

# ============== MODELS ==============
class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    display_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    connected_services: List[str] = []
    created_at: Optional[str] = None
    subscription_type: str = "free"
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0
    favorite_genres: List[str] = []
    favorite_artists: List[str] = []
    music_mood: Optional[str] = None
    is_verified: bool = False
    level: int = 1
    xp: int = 0
    badges: List[str] = []
    profile_theme: str = "default"
    is_online: bool = False

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# ============== HELPERS ==============
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str) -> str:
    from datetime import timedelta
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user_from_token(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        return user
    except:
        return None

# ============== ROUTES ==============
@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    """Register a new user"""
    existing = await db.users.find_one({
        "$or": [{"email": user_data.email}, {"username": user_data.username}]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Email or username already exists")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "username": user_data.username,
        "display_name": user_data.display_name or user_data.username,
        "password": hash_password(user_data.password),
        "avatar_url": f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_data.username}",
        "bio": None,
        "connected_services": [],
        "created_at": now,
        "subscription_type": "free",
        "followers_count": 0,
        "following_count": 0,
        "posts_count": 0,
        "favorite_genres": [],
        "favorite_artists": [],
        "music_mood": None,
        "is_verified": False,
        "level": 1,
        "xp": 0,
        "badges": ["new_user"],
        "profile_theme": "default",
        "is_online": True
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user_data.email)
    user_response = UserResponse(**{k: v for k, v in user_doc.items() if k != "password"})
    
    return TokenResponse(access_token=token, user=user_response)

@router.post("/login", response_model=TokenResponse)
async def login(login_data: UserLogin, request: Request):
    """Login with email and password"""
    user = await db.users.find_one({"email": login_data.email}, {"_id": 0})
    if not user or not verify_password(login_data.password, user.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Update online status
    await db.users.update_one({"id": user["id"]}, {"$set": {"is_online": True}})
    
    token = create_token(user["id"], user["email"])
    user_response = UserResponse(**{k: v for k, v in user.items() if k != "password"})
    
    return TokenResponse(access_token=token, user=user_response)

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(lambda: None)):
    """Get current user - requires auth middleware from main app"""
    # This will be overridden by the main app's dependency
    pass

@router.post("/logout")
async def logout():
    """Logout current user"""
    return {"message": "Logged out successfully"}

@router.get("/check-username/{username}")
async def check_username(username: str):
    """Check if username is available"""
    existing = await db.users.find_one({"username": username.lower()})
    return {"available": existing is None, "username": username}

@router.get("/check-email/{email}")
async def check_email(email: str):
    """Check if email is available"""
    existing = await db.users.find_one({"email": email.lower()})
    return {"available": existing is None, "email": email}
