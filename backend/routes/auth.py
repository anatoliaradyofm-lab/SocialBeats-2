# Auth Routes - Authentication and User Management
from fastapi import APIRouter, HTTPException, Depends, Header
from datetime import datetime, timezone
from typing import Optional
import logging
import re

from ..models.schemas import UserCreate, UserLogin, UserResponse, TokenResponse
from ..utils.helpers import (
    hash_password, verify_password, create_access_token, 
    verify_token, generate_id, now_iso, sanitize_email, sanitize_username
)

auth_router = APIRouter(prefix="/auth", tags=["auth"])

# Database reference
db = None

def set_db(database):
    global db
    db = database

# ============== AUTH HELPERS ==============

async def get_current_user(authorization: Optional[str] = Header(None)):
    """Get current user from JWT token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

def format_user_response(user: dict) -> dict:
    """Format user document for response"""
    return {
        "id": user.get("id"),
        "email": user.get("email"),
        "username": user.get("username"),
        "display_name": user.get("display_name"),
        "avatar_url": user.get("avatar_url"),
        "bio": user.get("bio"),
        "connected_services": user.get("connected_services", []),
        "created_at": user.get("created_at"),
        "subscription_type": user.get("subscription_type", "free"),
        "followers_count": user.get("followers_count", 0),
        "following_count": user.get("following_count", 0),
        "posts_count": user.get("posts_count", 0),
        "favorite_genres": user.get("favorite_genres", []),
        "favorite_artists": user.get("favorite_artists", []),
        "music_mood": user.get("music_mood"),
        "is_verified": user.get("is_verified", False),
        "level": user.get("level", 1),
        "xp": user.get("xp", 0),
        "badges": user.get("badges", []),
        "profile_theme": user.get("profile_theme", "default"),
        "is_online": user.get("is_online", False),
    }

# ============== ROUTES ==============

@auth_router.post("/register")
async def register(user_data: UserCreate):
    """Register a new user"""
    email = sanitize_email(user_data.email)
    username = sanitize_username(user_data.username)
    
    # Validate email format
    if not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    
    # Validate username
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    
    # Validate password
    if len(user_data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Check if email exists
    existing_email = await db.users.find_one({"email": email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if username exists
    existing_username = await db.users.find_one({"username": username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Create user
    user_id = generate_id()
    hashed_pw = hash_password(user_data.password)
    
    new_user = {
        "id": user_id,
        "email": email,
        "username": username,
        "password": hashed_pw,
        "display_name": user_data.display_name or username,
        "avatar_url": f"https://i.pravatar.cc/200?u={user_id}",
        "bio": "",
        "connected_services": [],
        "created_at": now_iso(),
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
        "badges": [],
        "profile_theme": "default",
        "is_online": True,
        "last_seen": now_iso(),
    }
    
    await db.users.insert_one(new_user)
    
    # Create access token
    access_token = create_access_token(user_id, email)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": format_user_response(new_user)
    }

@auth_router.post("/login")
async def login(credentials: UserLogin):
    """Login with email and password"""
    email = sanitize_email(credentials.email)
    
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, user.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Update online status
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"is_online": True, "last_seen": now_iso()}}
    )
    
    # Create access token
    access_token = create_access_token(user["id"], email)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": format_user_response(user)
    }

@auth_router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout current user"""
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"is_online": False, "last_seen": now_iso()}}
    )
    return {"message": "Logged out successfully"}

@auth_router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    return format_user_response(current_user)

@auth_router.put("/me")
async def update_me(
    update_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update current user profile"""
    allowed_fields = [
        "display_name", "bio", "avatar_url", "favorite_genres",
        "favorite_artists", "music_mood", "profile_theme"
    ]
    
    update_fields = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_fields["updated_at"] = now_iso()
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": update_fields}
    )
    
    updated_user = await db.users.find_one({"id": current_user["id"]})
    return format_user_response(updated_user)

@auth_router.post("/change-password")
async def change_password(
    password_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Change user password"""
    current_password = password_data.get("current_password")
    new_password = password_data.get("new_password")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Current and new passwords required")
    
    if not verify_password(current_password, current_user.get("password", "")):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    hashed_pw = hash_password(new_password)
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password": hashed_pw, "updated_at": now_iso()}}
    )
    
    return {"message": "Password changed successfully"}

@auth_router.delete("/me")
async def delete_account(current_user: dict = Depends(get_current_user)):
    """Delete user account"""
    user_id = current_user["id"]
    
    # Delete user's posts
    await db.posts.delete_many({"author_id": user_id})
    
    # Delete user's stories
    await db.stories.delete_many({"user_id": user_id})
    
    # Delete user's messages
    await db.messages.delete_many({"sender_id": user_id})
    
    # Delete user
    await db.users.delete_one({"id": user_id})
    
    return {"message": "Account deleted successfully"}

@auth_router.get("/check-username/{username}")
async def check_username(username: str):
    """Check if username is available"""
    username = sanitize_username(username)
    
    if len(username) < 3:
        return {"available": False, "reason": "Username must be at least 3 characters"}
    
    existing = await db.users.find_one({"username": username})
    
    return {
        "available": existing is None,
        "username": username
    }

@auth_router.get("/check-email/{email}")
async def check_email(email: str):
    """Check if email is available"""
    email = sanitize_email(email)
    
    if not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', email):
        return {"available": False, "reason": "Invalid email format"}
    
    existing = await db.users.find_one({"email": email})
    
    return {
        "available": existing is None,
        "email": email
    }
