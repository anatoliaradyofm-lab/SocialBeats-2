# Auth Routes - Authentication and User Management
from fastapi import APIRouter, HTTPException, Depends, Header, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
import logging
import re
import uuid
import secrets
import random
import string
import time

try:
    import pyotp
    PYOTP_AVAILABLE = True
except ImportError:
    PYOTP_AVAILABLE = False

from ..models.schemas import UserCreate, UserLogin, UserResponse, TokenResponse
from ..utils.helpers import (
    hash_password, verify_password, create_access_token,
    verify_token, generate_id, now_iso, sanitize_email, sanitize_username,
    blacklist_token, is_token_blacklisted
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

    if is_token_blacklisted(token):
        raise HTTPException(status_code=401, detail="Token has been revoked")

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
    if len(user_data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
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
        "gender": user_data.gender or None,
        "country": user_data.country or None,
        "city": user_data.city or None,
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
async def login(credentials: UserLogin, request: Request = None):
    """Login with email and password"""
    email = sanitize_email(credentials.email)

    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(credentials.password, user.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Check account frozen status
    if user.get("account_frozen", False):
        raise HTTPException(status_code=403, detail="Account is frozen. Please contact support or wait for the freeze period to end.")

    # Update online status
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"is_online": True, "last_seen": now_iso()}}
    )

    # Create access token
    access_token = create_access_token(user["id"], email)

    # Record session
    session_id = str(uuid.uuid4())
    device_info = "Unknown Device"
    ip_addr = "Unknown"
    if request:
        ua = request.headers.get("User-Agent", "")
        ip_addr = request.client.host if request.client else "Unknown"
        if "iPhone" in ua or "iPad" in ua:
            device_info = "iOS Device"
        elif "Android" in ua:
            device_info = "Android Device"
        elif "Windows" in ua:
            device_info = "Windows"
        elif "Macintosh" in ua:
            device_info = "Mac"
        elif ua:
            device_info = ua[:60]

    if db is not None:
        await db.user_sessions.insert_one({
            "id": session_id,
            "user_id": user["id"],
            "device_info": device_info,
            "ip": ip_addr,
            "created_at": now_iso(),
            "last_active": now_iso(),
            "revoked": False,
        })

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "session_id": session_id,
        "user": format_user_response(user)
    }

@auth_router.post("/logout")
async def logout(request: Request, current_user: dict = Depends(get_current_user)):
    """Logout current user and revoke JWT token"""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        blacklist_token(auth_header[7:])
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
    
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    
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

@auth_router.post("/password-reset/request")
async def request_password_reset(body: dict):
    """Request a password reset code via email"""
    email = sanitize_email(body.get("email", ""))
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    user = await db.users.find_one({"email": email})
    # Always return success to avoid user enumeration
    if user:
        code = ''.join(random.choices(string.digits, k=6))
        await db.password_resets.update_one(
            {"email": email},
            {"$set": {"email": email, "code": code, "created_at": now_iso(), "used": False, "attempts": 0}},
            upsert=True,
        )
        logging.info(f"Password reset code sent to ...{email[-8:]}")
    return {"message": "If this email exists, a reset code has been sent."}

@auth_router.post("/password-reset/confirm")
async def confirm_password_reset(body: dict):
    """Confirm password reset with code and set new password"""
    email = sanitize_email(body.get("email", ""))
    code = str(body.get("code", "")).strip()
    new_password = body.get("new_password", "")
    if not email or not code or not new_password:
        raise HTTPException(status_code=400, detail="Email, code and new_password are required")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    record = await db.password_resets.find_one({"email": email, "used": False})
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset code")
    if record.get("attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Please request a new reset code.")
    created = datetime.fromisoformat(record["created_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) - created > timedelta(minutes=15):
        raise HTTPException(status_code=400, detail="Reset code has expired. Please request a new one.")
    await db.password_resets.update_one({"_id": record["_id"]}, {"$inc": {"attempts": 1}})
    if record["code"] != code:
        raise HTTPException(status_code=400, detail="Invalid reset code")
    hashed = hash_password(new_password)
    await db.users.update_one({"email": email}, {"$set": {"password": hashed}})
    await db.password_resets.update_one({"_id": record["_id"]}, {"$set": {"used": True}})
    return {"message": "Password reset successful"}


# ============== 2FA ENDPOINTS ==============

@auth_router.get("/2fa/status")
async def get_2fa_status(current_user: dict = Depends(get_current_user)):
    """Get 2FA status for current user"""
    return {
        "enabled": current_user.get("two_factor_enabled", False),
        "setup_at": current_user.get("two_factor_setup_at"),
    }


@auth_router.post("/2fa/setup")
async def setup_2fa(current_user: dict = Depends(get_current_user)):
    """Generate TOTP secret and QR URI for 2FA setup"""
    if not PYOTP_AVAILABLE:
        raise HTTPException(status_code=503, detail="2FA service unavailable (pyotp not installed)")

    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    qr_uri = totp.provisioning_uri(
        name=current_user["email"],
        issuer_name="SocialBeats"
    )

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"two_factor_secret_pending": secret}}
    )

    return {"secret": secret, "qr_uri": qr_uri}


@auth_router.post("/2fa/verify")
async def verify_2fa(body: dict, current_user: dict = Depends(get_current_user)):
    """Verify TOTP code and activate 2FA (or just verify without activating)"""
    if not PYOTP_AVAILABLE:
        raise HTTPException(status_code=503, detail="2FA service unavailable")

    code = str(body.get("code", "")).strip()
    if not code:
        raise HTTPException(status_code=400, detail="Verification code required")

    enabling = body.get("enabling", True)
    secret = (
        current_user.get("two_factor_secret_pending") if enabling
        else current_user.get("two_factor_secret")
    )

    if not secret:
        raise HTTPException(
            status_code=400,
            detail="No pending 2FA setup. Call /auth/2fa/setup first."
        )

    totp = pyotp.TOTP(secret)
    if not totp.verify(code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    if enabling:
        backup_codes = [secrets.token_hex(4).upper() for _ in range(8)]
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {
                "two_factor_enabled": True,
                "two_factor_secret": secret,
                "two_factor_secret_pending": None,
                "two_factor_setup_at": now_iso(),
                "two_factor_backup_codes": backup_codes,
            }}
        )
        return {"enabled": True, "backup_codes": backup_codes}

    return {"valid": True}


@auth_router.delete("/2fa")
async def disable_2fa(body: dict, current_user: dict = Depends(get_current_user)):
    """Disable 2FA — requires current TOTP code or a backup code"""
    if not current_user.get("two_factor_enabled", False):
        raise HTTPException(status_code=400, detail="2FA is not enabled")

    if not PYOTP_AVAILABLE:
        raise HTTPException(status_code=503, detail="2FA service unavailable")

    code = str(body.get("code", "")).strip()
    if not code:
        raise HTTPException(status_code=400, detail="Code required to disable 2FA")

    secret = current_user.get("two_factor_secret")
    totp = pyotp.TOTP(secret)
    code_valid = totp.verify(code, valid_window=1)

    if not code_valid:
        backup_codes = current_user.get("two_factor_backup_codes", [])
        if code.upper() in backup_codes:
            backup_codes = [c for c in backup_codes if c != code.upper()]
            await db.users.update_one(
                {"id": current_user["id"]},
                {"$set": {"two_factor_backup_codes": backup_codes}}
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid code")

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "two_factor_enabled": False,
            "two_factor_secret": None,
            "two_factor_backup_codes": [],
        }}
    )
    return {"disabled": True}


# ============== EMAIL CHANGE ENDPOINTS ==============

@auth_router.post("/change-email/request")
async def request_email_change(body: dict, current_user: dict = Depends(get_current_user)):
    """Step 1: Request email change — sends OTP to new address"""
    new_email = sanitize_email(body.get("new_email", ""))
    password = body.get("password", "")

    if not new_email:
        raise HTTPException(status_code=400, detail="New email required")
    if not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', new_email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    if new_email == current_user.get("email"):
        raise HTTPException(status_code=400, detail="New email must differ from current email")
    if not verify_password(password, current_user.get("password", "")):
        raise HTTPException(status_code=401, detail="Incorrect password")

    existing = await db.users.find_one({"email": new_email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already in use")

    code = ''.join(random.choices(string.digits, k=6))
    await db.email_changes.update_one(
        {"user_id": current_user["id"]},
        {"$set": {
            "user_id": current_user["id"],
            "new_email": new_email,
            "code": code,
            "created_at": now_iso(),
            "used": False,
            "attempts": 0,
        }},
        upsert=True
    )
    logging.info(f"[email-change] OTP sent for user {current_user['id']}")
    return {"message": "Verification code sent to new email address"}


@auth_router.post("/change-email/confirm")
async def confirm_email_change(body: dict, current_user: dict = Depends(get_current_user)):
    """Step 2: Confirm email change with OTP code"""
    code = str(body.get("code", "")).strip()
    if not code:
        raise HTTPException(status_code=400, detail="Verification code required")

    record = await db.email_changes.find_one({
        "user_id": current_user["id"],
        "used": False,
    })
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    if record.get("attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Please request a new verification code.")
    created = datetime.fromisoformat(record["created_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) - created > timedelta(minutes=15):
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")
    await db.email_changes.update_one({"_id": record["_id"]}, {"$inc": {"attempts": 1}})
    if record["code"] != code:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    new_email = record["new_email"]
    existing = await db.users.find_one({"email": new_email})
    if existing and existing["id"] != current_user["id"]:
        raise HTTPException(status_code=400, detail="Email already in use")

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"email": new_email, "updated_at": now_iso()}}
    )
    await db.email_changes.update_one({"_id": record["_id"]}, {"$set": {"used": True}})
    return {"message": "Email updated successfully", "email": new_email}


# ============== SESSION MANAGEMENT ENDPOINTS ==============

@auth_router.get("/sessions")
async def get_sessions(current_user: dict = Depends(get_current_user)):
    """List active sessions for current user"""
    cursor = db.user_sessions.find(
        {"user_id": current_user["id"], "revoked": False},
        {"_id": 0}
    ).sort("last_active", -1)
    sessions = await cursor.to_list(length=20)
    return {"sessions": sessions}


@auth_router.delete("/sessions/{session_id}")
async def revoke_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Revoke a specific session"""
    result = await db.user_sessions.update_one(
        {"id": session_id, "user_id": current_user["id"]},
        {"$set": {"revoked": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"revoked": True}


@auth_router.post("/sessions/revoke-all")
async def revoke_all_sessions(body: dict = None, current_user: dict = Depends(get_current_user)):
    """Revoke all sessions except the current one"""
    keep_id = (body or {}).get("current_session_id")
    query = {"user_id": current_user["id"], "revoked": False}
    if keep_id:
        query["id"] = {"$ne": keep_id}
    result = await db.user_sessions.update_many(query, {"$set": {"revoked": True}})
    return {"revoked_count": result.modified_count}
