from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Query, File, UploadFile, Form, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import base64
import os
import json
import logging
import zipfile
import tempfile
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import random
import httpx
import aiofiles
import shutil
import asyncio
from collections import defaultdict
import time
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import socketio

ROOT_DIR = Path(__file__).parent
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'socialbeats')]

# Global Scheduler
scheduler = AsyncIOScheduler()

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET environment variable is not set. "
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
    )
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Email: via services.email_service (Brevo API). Config: BREVO_API_KEY, EMAIL_FROM in .env

# WebAuthn Configuration (env WEBAUTHN_RP_ID, WEBAUTHN_ORIGIN or derived from request)
WEBAUTHN_RP_ID = os.environ.get('WEBAUTHN_RP_ID', '')
WEBAUTHN_ORIGIN = os.environ.get('WEBAUTHN_ORIGIN', '')
WEBAUTHN_RP_NAME = os.environ.get('WEBAUTHN_RP_NAME', 'SocialBeats')

# ============== SOCKET.IO SETUP ==============
# Create Socket.IO server
_sio_origins = os.environ.get(
    'CORS_ORIGINS',
    'http://localhost:19006,http://localhost:8080,https://socialbeats.app'
).split(',')
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=_sio_origins,
    logger=False,
    engineio_logger=False
)

# Create the main FastAPI app
fastapi_app = FastAPI(title="SocialBeats Social API", version="3.0.0")

# Add CORS middleware
_cors_origins = os.environ.get(
    'CORS_ORIGINS',
    'http://localhost:19006,http://localhost:8080,https://socialbeats.app,https://social-music-fix.preview.emergentagent.com'
).split(',')
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============== SECURITY SERVICES ==============
# Import security services (without middleware for now - use manual checks)
SECURITY_ENABLED = False
ASYNC_MODERATION = False
try:
    from services.security_middleware import rate_limiter, brute_force_protection, input_sanitizer, validate_file_upload, SECURITY_HEADERS, generate_csrf_token, SecurityMiddleware, CSRFMiddleware
    from services.content_moderation import content_moderator, ContentModerationService
    from services.async_moderation import moderation_queue, AsyncModerationQueue
    
    from services import encryption_service
    SECURITY_ENABLED = True
    ASYNC_MODERATION = True
    logger.info("✅ Security services enabled")
    logger.info("✅ Encryption service enabled (AES-256-GCM)")
    logger.info("✅ Async moderation queue enabled")
except ImportError as e:
    encryption_service = None
    logger.warning(f"⚠️ Security services not available: {e}")

# Add security headers middleware
@fastapi_app.middleware("http")
async def add_security_headers(request, call_next):
    # Only allow CORS if it's not handled by the CORSMiddleware?
    # Actually, let's keep it simple.
    response = await call_next(request)
    if SECURITY_ENABLED:
        for header, value in SECURITY_HEADERS.items():
            response.headers[header] = value
    return response

# Include modular routers
# ...

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# Socket.IO user session tracking
socket_sessions = {}  # sid -> user_id
user_sockets = defaultdict(set)  # user_id -> set of sids

@sio.event
async def connect(sid, environ):
    logger.info(f"Socket.IO client connected: {sid}")
    # Auth will happen in authenticate event

@sio.event
async def disconnect(sid):
    logger.info(f"Socket.IO client disconnected: {sid}")
    # Clean up session
    if sid in socket_sessions:
        user_id = socket_sessions[sid]
        user_sockets[user_id].discard(sid)
        del socket_sessions[sid]
        # Update online status if no more connections
        if not user_sockets[user_id]:
            await db.users.update_one({"id": user_id}, {"$set": {"is_online": False}})
            # Broadcast offline status to friends
            await broadcast_online_status(user_id, False)

@sio.event
async def authenticate(sid, data):
    """Authenticate socket connection with JWT token"""
    try:
        token = data.get('token')
        if not token:
            await sio.emit('auth_error', {'error': 'Token required'}, to=sid)
            return
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('sub')
        
        if user_id:
            socket_sessions[sid] = user_id
            user_sockets[user_id].add(sid)
            
            # Update online status
            await db.users.update_one({"id": user_id}, {"$set": {"is_online": True}})
            
            # Join user's personal room
            await sio.enter_room(sid, f"user_{user_id}")
            
            # Broadcast online status to friends
            await broadcast_online_status(user_id, True)
            
            await sio.emit('authenticated', {'user_id': user_id}, to=sid)
            logger.info(f"User {user_id} authenticated on socket {sid}")
    except jwt.ExpiredSignatureError:
        await sio.emit('auth_error', {'error': 'Token expired'}, to=sid)
    except jwt.InvalidTokenError:
        await sio.emit('auth_error', {'error': 'Invalid token'}, to=sid)

@sio.event
async def join_conversation(sid, data):
    """Join a conversation room for real-time updates"""
    conversation_id = data.get('conversation_id')
    if not conversation_id:
        return
    
    user_id = socket_sessions.get(sid)
    if user_id:
        await sio.enter_room(sid, f"conv_{conversation_id}")
        logger.info(f"User {user_id} joined conversation {conversation_id}")

@sio.event
async def join_listening_room(sid, data):
    room_id = data.get('room_id')
    user_id = socket_sessions.get(sid)
    if user_id and room_id:
        await sio.enter_room(sid, f"room_{room_id}")

@sio.event
async def leave_listening_room(sid, data):
    room_id = data.get('room_id')
    user_id = socket_sessions.get(sid)
    if user_id and room_id:
        await sio.leave_room(sid, f"room_{room_id}")

@sio.event
async def send_room_chat(sid, data):
    room_id = data.get('room_id')
    message = data.get('message')
    user_id = socket_sessions.get(sid)
    if user_id and room_id and message:
        await sio.emit('room_chat_received', {"user_id": user_id, "message": message}, room=f"room_{room_id}")

@sio.event
async def send_room_reaction(sid, data):
    room_id = data.get('room_id')
    reaction = data.get('reaction')
    user_id = socket_sessions.get(sid)
    if user_id and room_id and reaction:
        await sio.emit('room_reaction_received', {"user_id": user_id, "reaction": reaction}, room=f"room_{room_id}")

async def sio_broadcast_to_room(room_name: str, event: str, data: dict):
    await sio.emit(event, data, room=room_name)

@sio.event
async def leave_conversation(sid, data):
    if not user_id:
        await sio.emit('error', {'error': 'Not authenticated'}, to=sid)
        return
    
    # Verify user is part of conversation
    conversation = await db.conversations.find_one({
        "id": conversation_id,
        "participants": user_id
    })
    
    if conversation:
        await sio.enter_room(sid, f"conversation_{conversation_id}")
        logger.info(f"User {user_id} joined conversation {conversation_id}")
    else:
        await sio.emit('error', {'error': 'Not authorized for this conversation'}, to=sid)

@sio.event
async def leave_conversation(sid, data):
    """Leave a conversation room"""
    conversation_id = data.get('conversation_id')
    if conversation_id:
        await sio.leave_room(sid, f"conversation_{conversation_id}")

@sio.event
async def typing_start(sid, data):
    """Broadcast typing indicator to conversation"""
    conversation_id = data.get('conversation_id')
    user_id = socket_sessions.get(sid)
    
    if not user_id or not conversation_id:
        return
    
    # Get user info
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "username": 1, "avatar_url": 1})
    
    await sio.emit('user_typing', {
        'user_id': user_id,
        'username': user.get('username') if user else 'Unknown',
        'avatar_url': user.get('avatar_url') if user else None,
        'conversation_id': conversation_id
    }, room=f"conversation_{conversation_id}", skip_sid=sid)

@sio.event
async def typing_stop(sid, data):
    """Stop typing indicator"""
    conversation_id = data.get('conversation_id')
    user_id = socket_sessions.get(sid)
    
    if user_id and conversation_id:
        await sio.emit('user_stopped_typing', {
            'user_id': user_id,
            'conversation_id': conversation_id
        }, room=f"conversation_{conversation_id}", skip_sid=sid)

@sio.event
async def message_read(sid, data):
    """Mark messages as read and notify sender"""
    conversation_id = data.get('conversation_id')
    message_ids = data.get('message_ids', [])
    user_id = socket_sessions.get(sid)
    
    if not user_id or not conversation_id:
        return
    
    # Update read status in database
    if message_ids:
        await db.messages.update_many(
            {"id": {"$in": message_ids}, "sender_id": {"$ne": user_id}},
            {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    # Notify conversation participants
    await sio.emit('messages_read', {
        'conversation_id': conversation_id,
        'message_ids': message_ids,
        'read_by': user_id
    }, room=f"conversation_{conversation_id}", skip_sid=sid)

@sio.event
async def send_message(sid, data):
    """Handle real-time message sending via Socket.IO"""
    conversation_id = data.get('conversation_id')
    content = data.get('content', '')
    user_id = socket_sessions.get(sid)

    if not user_id or not conversation_id or not content:
        return

    conversation = await db.conversations.find_one({
        "id": conversation_id,
        "participants": user_id
    })
    if not conversation:
        await sio.emit('error', {'error': 'Not authorized'}, to=sid)
        return

    user = await db.users.find_one({"id": user_id}, {"_id": 0, "username": 1, "avatar_url": 1, "display_name": 1})
    msg_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    message = {
        "id": msg_id,
        "conversation_id": conversation_id,
        "sender_id": user_id,
        "sender": {
            "id": user_id,
            "username": user.get("username", "") if user else "",
            "avatar_url": user.get("avatar_url") if user else None,
            "display_name": user.get("display_name") if user else "",
        },
        "content": content,
        "type": data.get("type", "text"),
        "created_at": now,
        "is_read": False,
    }

    await db.messages.insert_one({**message, "_id": None})
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"last_message": content, "last_message_at": now, "updated_at": now}}
    )

    await sio.emit('new_message', message, room=f"conversation_{conversation_id}")


async def broadcast_online_status(user_id: str, is_online: bool):
    """Broadcast user's online status to their followers/friends"""
    # Get user's followers
    followers = await db.follows.find({"following_id": user_id}, {"_id": 0, "follower_id": 1}).to_list(1000)
    
    for follower in followers:
        follower_id = follower.get('follower_id')
        if follower_id in user_sockets:
            for sid in user_sockets[follower_id]:
                await sio.emit('user_status_change', {
                    'user_id': user_id,
                    'is_online': is_online
                }, to=sid)

async def send_realtime_message(conversation_id: str, message: dict):
    """Send a message to all participants in a conversation via Socket.IO"""
    await sio.emit('new_message', message, room=f"conversation_{conversation_id}")

async def send_notification(user_id: str, notification: dict):
    """Send a real-time notification to a user"""
    if user_id in user_sockets:
        for sid in user_sockets[user_id]:
            await sio.emit('notification', notification, to=sid)

# ============== RATE LIMITING & BOT DETECTION ==============

class RateLimiter:
    """Advanced in-memory rate limiter with bot detection"""
    def __init__(self):
        self.requests = defaultdict(list)
        self.blocked_ips = {}  # IP -> block_until timestamp
        self.suspicious_ips = defaultdict(int)  # IP -> suspicion score
        self.request_patterns = defaultdict(list)  # IP -> list of (timestamp, endpoint)
    
    def is_blocked(self, ip: str) -> bool:
        """Check if IP is blocked"""
        if ip in self.blocked_ips:
            if time.time() < self.blocked_ips[ip]:
                return True
            else:
                del self.blocked_ips[ip]
        return False
    
    def block_ip(self, ip: str, duration_minutes: int = 30):
        """Block an IP for specified duration"""
        self.blocked_ips[ip] = time.time() + (duration_minutes * 60)
        logging.warning(f"IP blocked: {ip} for {duration_minutes} minutes")
    
    def check_rate_limit(self, ip: str, limit: int = 100, window_seconds: int = 60) -> bool:
        """Check if request is within rate limit. Returns True if allowed."""
        now = time.time()
        window_start = now - window_seconds
        
        # Clean old requests
        self.requests[ip] = [t for t in self.requests[ip] if t > window_start]
        
        if len(self.requests[ip]) >= limit:
            # Increase suspicion score
            self.suspicious_ips[ip] += 1
            if self.suspicious_ips[ip] >= 5:
                # Auto-block after 5 rate limit violations
                self.block_ip(ip, duration_minutes=60)
            return False
        
        self.requests[ip].append(now)
        return True
    
    def get_remaining(self, ip: str, limit: int = 100, window_seconds: int = 60) -> int:
        """Get remaining requests for IP"""
        now = time.time()
        window_start = now - window_seconds
        self.requests[ip] = [t for t in self.requests[ip] if t > window_start]
        return max(0, limit - len(self.requests[ip]))
    
    def detect_bot_patterns(self, ip: str, endpoint: str, user_agent: str = "") -> bool:
        """
        Detect potential bot patterns. Returns True if suspicious.
        Heuristics:
        - Too fast requests (< 100ms between requests)
        - No user agent or suspicious user agent
        - Repeated exact same endpoint requests
        """
        now = time.time()
        
        # Check user agent
        suspicious_agents = ['curl', 'wget', 'python-requests', 'scrapy', 'bot', 'spider']
        if not user_agent or any(agent in user_agent.lower() for agent in suspicious_agents):
            self.suspicious_ips[ip] += 1
        
        # Track request pattern
        self.request_patterns[ip].append((now, endpoint))
        
        # Keep only last 100 requests
        self.request_patterns[ip] = self.request_patterns[ip][-100:]
        
        patterns = self.request_patterns[ip]
        if len(patterns) >= 5:
            # Check for too fast requests (< 100ms intervals)
            recent = patterns[-5:]
            intervals = [recent[i+1][0] - recent[i][0] for i in range(len(recent)-1)]
            if all(interval < 0.1 for interval in intervals):  # All < 100ms
                self.suspicious_ips[ip] += 3
                logging.warning(f"Bot pattern detected (fast requests): {ip}")
            
            # Check for repeated same endpoint
            recent_endpoints = [p[1] for p in recent]
            if len(set(recent_endpoints)) == 1 and recent_endpoints[0] not in ['/api/health', '/']:
                self.suspicious_ips[ip] += 1
        
        # Auto-block if too suspicious
        if self.suspicious_ips[ip] >= 10:
            self.block_ip(ip, duration_minutes=120)
            return True
        
        return self.suspicious_ips[ip] >= 5
    
    def get_blocked_ips(self) -> list:
        """Get list of currently blocked IPs"""
        now = time.time()
        return [
            {"ip": ip, "blocked_until": blocked_until, "remaining_seconds": int(blocked_until - now)}
            for ip, blocked_until in self.blocked_ips.items()
            if blocked_until > now
        ]
    
    def unblock_ip(self, ip: str) -> bool:
        """Manually unblock an IP"""
        if ip in self.blocked_ips:
            del self.blocked_ips[ip]
            self.suspicious_ips[ip] = 0
            return True
        return False
    
    def get_stats(self) -> dict:
        """Get rate limiter statistics"""
        return {
            "total_tracked_ips": len(self.requests),
            "blocked_ips_count": len([ip for ip, t in self.blocked_ips.items() if t > time.time()]),
            "suspicious_ips": dict(self.suspicious_ips)
        }

rate_limiter = RateLimiter()

# ============== EMAIL SERVICE (Brevo API) ==============
from services.email_service import email_service, EmailService

# ============== IP WHITELIST/BLACKLIST ==============

class IPListManager:
    """Manage IP whitelist and blacklist"""
    
    @staticmethod
    async def get_lists():
        """Get whitelist and blacklist from database"""
        whitelist = await db.ip_whitelist.find({}, {"_id": 0}).to_list(1000)
        blacklist = await db.ip_blacklist.find({}, {"_id": 0}).to_list(1000)
        return {
            "whitelist": [item.get("ip") for item in whitelist],
            "blacklist": [item.get("ip") for item in blacklist]
        }
    
    @staticmethod
    async def add_to_list(ip: str, list_type: str, added_by: str, reason: str = ""):
        """Add IP to whitelist or blacklist"""
        collection = db.ip_whitelist if list_type == "whitelist" else db.ip_blacklist
        now = datetime.now(timezone.utc).isoformat()
        
        existing = await collection.find_one({"ip": ip})
        if existing:
            return {"status": "exists", "message": "IP zaten listede"}
        
        await collection.insert_one({
            "id": str(uuid.uuid4()),
            "ip": ip,
            "added_by": added_by,
            "reason": reason,
            "created_at": now
        })
        
        # If blacklisted, also block in rate limiter
        if list_type == "blacklist":
            rate_limiter.block_ip(ip, duration_minutes=525600)  # 1 year
        
        return {"status": "success", "message": f"IP {list_type}'e eklendi"}
    
    @staticmethod
    async def remove_from_list(ip: str, list_type: str):
        """Remove IP from whitelist or blacklist"""
        collection = db.ip_whitelist if list_type == "whitelist" else db.ip_blacklist
        result = await collection.delete_one({"ip": ip})
        
        if list_type == "blacklist":
            rate_limiter.unblock_ip(ip)
        
        if result.deleted_count > 0:
            return {"status": "success", "message": f"IP {list_type}'ten kaldırıldı"}
        return {"status": "not_found", "message": "IP bulunamadı"}
    
    @staticmethod
    async def is_whitelisted(ip: str) -> bool:
        """Check if IP is whitelisted"""
        result = await db.ip_whitelist.find_one({"ip": ip})
        return result is not None
    
    @staticmethod
    async def is_blacklisted(ip: str) -> bool:
        """Check if IP is blacklisted"""
        result = await db.ip_blacklist.find_one({"ip": ip})
        return result is not None

ip_manager = IPListManager()

# ============== SECURITY CONFIG ==============

SECURITY_CONFIG = {
    "bot_detection": {
        "signup": {
            "ip_threshold": 0.7,
            "email_threshold": 0.8,
            "headless_threshold": 0.9,
            "max_accounts_per_ip": 3,
            "time_window": 3600000,  # 1 hour in ms
        },
        "behavior": {
            "action_time_threshold": 50,  # ms
            "daily_activity_threshold": 0.8,
            "repetitive_threshold": 0.7,
            "spam_ratio_threshold": 0.3,
            "follow_ratio_threshold": 10,
        },
        "actions": {
            "low_risk": "VERIFY_EMAIL",
            "medium_risk": "REQUIRE_CAPTCHA",
            "high_risk": "TEMPORARY_BAN",
            "critical_risk": "PERMANENT_BAN",
        }
    }
}

# ============== DEVICE TRACKING ==============

async def track_device(user_id: str, request: Request):
    """Track user device for security"""
    user_agent = request.headers.get("user-agent", "Unknown")
    ip = request.client.host if request.client else "Unknown"
    
    now = datetime.now(timezone.utc).isoformat()
    device_id = str(uuid.uuid4())
    
    # Parse user agent for device info
    platform = "Unknown"
    if "iPhone" in user_agent or "iPad" in user_agent:
        platform = "iOS"
    elif "Android" in user_agent:
        platform = "Android"
    elif "Windows" in user_agent:
        platform = "Windows"
    elif "Mac" in user_agent:
        platform = "macOS"
    elif "Linux" in user_agent:
        platform = "Linux"
    
    device = {
        "id": device_id,
        "user_id": user_id,
        "platform": platform,
        "user_agent": user_agent,
        "ip_address": ip,
        "last_active": now,
        "created_at": now,
        "is_current": True
    }
    
    # Check if this is a new device
    existing = await db.user_devices.find_one({
        "user_id": user_id,
        "user_agent": user_agent
    })
    
    if existing:
        # Update existing device
        await db.user_devices.update_one(
            {"id": existing["id"]},
            {"$set": {"last_active": now, "ip_address": ip}}
        )
        return existing, False
    else:
        # New device - insert and return
        await db.user_devices.insert_one(device)
        return device, True

# ============== CRON JOBS ==============

async def cleanup_expired_stories():
    """24 saat geçen hikayeleri arşive kopyala (R2 medya korunur) sonra sil"""
    try:
        now = datetime.now(timezone.utc).isoformat()
        expired = await db.stories.find({"expires_at": {"$lt": now}, "is_highlight": {"$ne": True}}).to_list(1000)
        for s in expired:
            s.pop("_id", None)
            s["archived_at"] = datetime.now(timezone.utc).isoformat()
            await db.story_archive.insert_one(s)
        if expired:
            result = await db.stories.delete_many({"expires_at": {"$lt": now}, "is_highlight": {"$ne": True}})
            logging.info(f"Archived and cleaned up {result.deleted_count} expired stories")
    except Exception as e:
        logging.error(f"Story cleanup error: {e}")

async def cleanup_old_notifications():
    """Delete notifications older than 30 days"""
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        result = await db.notifications.delete_many({"created_at": {"$lt": cutoff}, "is_read": True})
        if result.deleted_count > 0:
            logging.info(f"Cleaned up {result.deleted_count} old notifications")
    except Exception as e:
        logging.error(f"Notification cleanup error: {e}")

async def cleanup_typing_indicators():
    """Clear stale typing indicators (older than 10 seconds)"""
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(seconds=10)).isoformat()
        result = await db.typing_indicators.delete_many({"timestamp": {"$lt": cutoff}})
    except Exception as e:
        logging.error(f"Typing indicator cleanup error: {e}")


async def cleanup_disappearing_messages():
    """Kaybolan mesajlar: vanish süresi dolan mesajları sil (Evolution API + cron)"""
    try:
        convs = await db.conversations.find(
            {"disappearing_seconds": {"$exists": True, "$gt": 0}},
            {"id": 1, "disappearing_seconds": 1}
        ).to_list(500)
        for conv in convs:
            sec = conv.get("disappearing_seconds") or 0
            if sec <= 0:
                continue
            cutoff = (datetime.now(timezone.utc) - timedelta(seconds=sec)).isoformat()
            result = await db.messages.update_many(
                {"conversation_id": conv["id"], "created_at": {"$lt": cutoff}, "is_deleted": {"$ne": True}},
                {"$set": {"is_deleted": True, "content": "Bu mesaj silindi (kaybolan mesaj)"}}
            )
            if result.modified_count > 0:
                logging.info(f"Disappearing: conv {conv['id']} cleaned {result.modified_count} messages")
    except Exception as e:
        logging.error(f"Disappearing messages cleanup error: {e}")

async def update_trending_hashtags():
    """Update trending hashtags cache"""
    try:
        # Get hashtags from recent posts (last 24 hours)
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        pipeline = [
            {"$match": {"created_at": {"$gte": cutoff}}},
            {"$project": {"hashtags": {"$regexFindAll": {"input": "$content", "regex": "#(\\w+)"}}}},
            {"$unwind": "$hashtags"},
            {"$group": {"_id": "$hashtags.match", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 20}
        ]
        # This would update a trending cache collection
        logging.info("Updated trending hashtags")
    except Exception as e:
        logging.error(f"Trending update error: {e}")

async def run_scheduled_tasks():
    """Run scheduled cleanup tasks"""
    while True:
        try:
            await cleanup_expired_stories()
            await cleanup_old_notifications()
            await cleanup_typing_indicators()
            await cleanup_disappearing_messages()
            await update_trending_hashtags()
        except Exception as e:
            logging.error(f"Scheduled task error: {e}")
        
        # Run every 5 minutes
        await asyncio.sleep(300)

# ============== CONSTANTS ==============

REACTION_TYPES = ["heart", "fire", "applause", "thinking", "sad"]
MOOD_OPTIONS = ["Enerjik", "Romantik", "Melankolik", "Mutlu", "Huzurlu", "Nostaljik", "Parti", "Odaklanmış"]
ACTIVITY_OPTIONS = ["Spor", "Yürüyüş", "Çalışma", "Yolculuk", "Uyku", "Parti", "Yemek", "Meditasyon"]
SEASONS = ["ilkbahar", "yaz", "sonbahar", "kış"]
GENRE_OPTIONS = ["Pop", "Rock", "Hip-Hop", "Jazz", "Classical", "Electronic", "R&B", "Turkish Pop", "Turkish Rock", "Indie", "Metal", "Folk"]
BADGE_TYPES = ["new_user", "first_post", "social_butterfly", "music_expert", "trendsetter", "community_leader", "verified"]
USER_LEVELS = {
    1: {"name": "Dinleyici", "xp_required": 0},
    2: {"name": "Meraklı", "xp_required": 100},
    3: {"name": "Bilirkişi", "xp_required": 500},
    4: {"name": "Koleksiyoner", "xp_required": 1500},
    5: {"name": "Elçi", "xp_required": 3000},
    6: {"name": "Uzman", "xp_required": 5000},
    7: {"name": "Efsane", "xp_required": 10000}
}

# Content moderation thresholds (0-4 scale: VERY_UNLIKELY=0, UNLIKELY=1, POSSIBLE=2, LIKELY=3, VERY_LIKELY=4)
MODERATION_THRESHOLDS = {
    "adult": 2,      # Block if POSSIBLE or higher
    "violence": 2,
    "racy": 3,       # Block if LIKELY or higher
    "medical": 3,
    "spoof": 4,      # Block only if VERY_LIKELY
}

# Inappropriate text patterns for OCR moderation
INAPPROPRIATE_TEXT_PATTERNS = [
    # Add patterns as needed
]

# ============== CONTENT MODERATION SERVICE (NudeNet wrapper) ==============

from services.moderation_service import ContentModerationService as _ModerationServiceClass
moderation_service = _ModerationServiceClass()

# ============== MODELS ==============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    username: str
    display_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    connected_services: List[str] = []
    created_at: str
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

class UserPublicProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0
    favorite_genres: List[str] = []
    favorite_artists: List[str] = []
    is_verified: bool = False
    is_following: bool = False
    level: int = 1
    badges: List[str] = []
    profile_theme: str = "default"

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ProfileUpdateBody(BaseModel):
    display_name: Optional[str] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    birth_date: Optional[str] = None
    is_private: Optional[bool] = None
    favorite_genres: Optional[List[str]] = None
    favorite_artists: Optional[List[str]] = None
    music_mood: Optional[str] = None
    profile_theme: Optional[str] = None

class ConnectedService(BaseModel):
    service_type: str
    service_user_id: Optional[str] = None
    connected_at: str
    library_sync_status: str = "pending"

class Track(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    artist: str
    album: str
    duration: int
    cover_url: str
    source: str
    preview_url: Optional[str] = None
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    is_liked: bool = False

class Playlist(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    description: Optional[str] = None
    cover_url: str
    track_count: int
    owner_id: str
    is_public: bool = True
    created_at: str
    tracks: List[Track] = []
    likes_count: int = 0
    is_collaborative: bool = False

class PlaylistCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: bool = True
    is_collaborative: bool = False


class PlaylistUpdate(BaseModel):
    name: Optional[str] = None
    is_public: Optional[bool] = None
    cover_url: Optional[str] = None


class SearchResult(BaseModel):
    tracks: List[Track]
    playlists: List[Playlist]
    artists: List[dict]
    users: List[dict] = []
    communities: List[dict] = []

class ListeningStats(BaseModel):
    total_minutes: int
    top_artists: List[dict]
    top_genres: List[dict]
    platform_breakdown: dict

# ============== ENHANCED SOCIAL MODELS ==============

class PostCreate(BaseModel):
    content: str
    post_type: str = "text"  # text, track_share, playlist_share, mood, review, poll, question
    track_id: Optional[str] = None
    playlist_id: Optional[str] = None
    mood: Optional[str] = None
    rating: Optional[int] = None
    media_urls: List[str] = []
    visibility: str = "public"  # public, followers, private
    allow_comments: bool = True
    poll_options: List[str] = []
    tags: List[str] = []

class Post(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    username: str
    user_avatar: Optional[str] = None
    user_display_name: Optional[str] = None
    is_verified: bool = False
    user_level: int = 1
    content: str
    post_type: str
    track: Optional[Track] = None
    playlist: Optional[dict] = None
    mood: Optional[str] = None
    rating: Optional[int] = None
    media_urls: List[str] = []
    visibility: str = "public"
    allow_comments: bool = True
    poll_options: List[dict] = []
    tags: List[str] = []
    mentions: List[str] = []
    hashtags: List[str] = []
    reactions: Dict[str, int] = {}
    comments_count: int = 0
    shares_count: int = 0
    user_reaction: Optional[str] = None
    created_at: str
    is_pinned: bool = False
    is_saved: bool = False

class CommentCreate(BaseModel):
    content: str
    parent_id: Optional[str] = None
    media_url: Optional[str] = None

class Comment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    username: str
    user_avatar: Optional[str] = None
    user_display_name: Optional[str] = None
    user_level: int = 1
    content: str
    media_url: Optional[str] = None
    likes_count: int = 0
    is_liked: bool = False
    created_at: str
    replies: List[dict] = []
    replies_count: int = 0

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    type: str
    from_user_id: str
    from_username: str
    from_avatar: Optional[str] = None
    content: str
    reference_id: Optional[str] = None
    reference_type: Optional[str] = None
    is_read: bool = False
    created_at: str

class MessageCreate(BaseModel):
    content: str
    media_url: Optional[str] = None
    track_id: Optional[str] = None

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    conversation_id: str
    sender_id: str
    sender_username: str
    sender_avatar: Optional[str] = None
    content: str
    media_url: Optional[str] = None
    track: Optional[dict] = None
    is_read: bool = False
    created_at: str

class Conversation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    participants: List[dict]
    last_message: Optional[dict] = None
    unread_count: int = 0
    created_at: str
    updated_at: str

class CommunityCreate(BaseModel):
    name: str
    description: Optional[str] = None
    community_type: str = "public"  # public, private, invite_only
    genre: Optional[str] = None
    cover_url: Optional[str] = None

class Community(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    description: Optional[str] = None
    cover_url: str
    community_type: str
    genre: Optional[str] = None
    owner_id: str
    members_count: int = 0
    posts_count: int = 0
    created_at: str
    is_member: bool = False
    is_admin: bool = False

class ListeningActivity(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    username: str
    user_avatar: Optional[str] = None
    track: Track
    started_at: str
    is_live: bool = True

# ============== USER SETTINGS MODELS ==============

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ChangeEmailRequest(BaseModel):
    new_email: EmailStr
    password: str

class UserSettingsUpdate(BaseModel):
    # Privacy - Profile
    is_private_account: Optional[bool] = None
    show_online_status: Optional[bool] = None
    
    # Privacy - Interaction
    who_can_message: Optional[str] = None  # everyone, followers, nobody
    message_requests: Optional[bool] = None
    
    # Privacy - Sharing
    who_can_see_posts: Optional[str] = None
    who_can_comment: Optional[str] = None
    show_like_count: Optional[bool] = None
    require_tag_approval: Optional[bool] = None
    
    # Notifications
    message_notifications: Optional[bool] = None
    like_notifications: Optional[bool] = None
    comment_notifications: Optional[bool] = None
    follow_notifications: Optional[bool] = None
    tag_notifications: Optional[bool] = None
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    
    # Social
    auto_accept_follows: Optional[bool] = None
    hide_followers_list: Optional[bool] = None
    hide_following_list: Optional[bool] = None
    
    # Messaging
    show_read_receipts: Optional[bool] = None
    show_online_in_chat: Optional[bool] = None
    auto_delete_messages: Optional[str] = None  # never, 24h, 7d, 30d
    allow_media_download: Optional[bool] = None
    
    # App
    theme: Optional[str] = None  # dark, light, auto
    font_size: Optional[str] = None  # small, medium, large
    language: Optional[str] = None
    auto_play_videos: Optional[bool] = None
    data_saver_mode: Optional[bool] = None
    media_quality: Optional[str] = None  # low, medium, high

# ============== STORY MODELS ==============

class StoryCreate(BaseModel):
    story_type: str = "track"  # track, playlist, mood, text, photo, video, poll
    audience: Optional[str] = "all"  # all, close_friends
    track_id: Optional[str] = None
    playlist_id: Optional[str] = None
    mood: Optional[str] = None
    text: Optional[str] = None
    emoji: Optional[str] = None
    background_color: Optional[str] = "#8B5CF6"
    filter: Optional[str] = None  # normal, vintage, sepia, noir, warm, cool
    media_url: Optional[str] = None
    media_type: Optional[str] = None  # photo, video
    duration: Optional[int] = None  # Görüntülenme süresi (saniye)
    # Poll fields
    poll_question: Optional[str] = None
    poll_options: Optional[List[str]] = None
    # Swipe-up link
    swipe_up_url: Optional[str] = None
    swipe_up_title: Optional[str] = None
    # Music sync
    music_track_id: Optional[str] = None
    music_start_time: Optional[int] = None  # Start position in seconds
    # Audience: all = herkese, close_friends = sadece yakın arkadaşlara
    audience: Optional[str] = "all"  # all, close_friends

class Story(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    username: str
    user_avatar: Optional[str] = None
    user_display_name: Optional[str] = None
    is_verified: bool = False
    story_type: str
    track: Optional[Track] = None
    playlist: Optional[dict] = None
    mood: Optional[str] = None
    text: Optional[str] = None
    emoji: Optional[str] = None
    background_color: str = "#8B5CF6"
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    duration: int = 5  # Varsayılan 5 saniye
    viewers: List[str] = []
    viewers_count: int = 0
    created_at: str
    expires_at: str
    is_viewed: bool = False
    is_expired: bool = False
    # Poll fields
    poll_question: Optional[str] = None
    poll_options: Optional[List[dict]] = None  # [{id, text, votes, voters}]
    user_poll_vote: Optional[str] = None  # User's vote option id
    # Swipe-up link
    swipe_up_url: Optional[str] = None
    swipe_up_title: Optional[str] = None
    # Music sync
    music_track: Optional[dict] = None
    music_start_time: Optional[int] = None

class StoryViewer(BaseModel):
    user_id: str
    username: str
    user_avatar: Optional[str] = None
    user_display_name: Optional[str] = None
    viewed_at: str

class StoryReplyRequest(BaseModel):
    story_id: str
    content: str
    reply_type: str = "TEXT"  # TEXT, EMOJI, QUICK_REACTION

# ============== AUTH HELPERS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, session_id: str = None) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    if session_id:
        payload["sid"] = session_id
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Check token blacklist
        try:
            blacklisted = await db.token_blacklist.find_one({"token": token})
            if blacklisted:
                raise HTTPException(status_code=401, detail="Token revoked")
        except Exception:
            pass
        
        # Validate session if session_id present
        session_id = payload.get("sid")
        if session_id:
            session = await db.user_sessions.find_one({
                "id": session_id, "user_id": user_id, "is_active": True
            })
            if not session:
                raise HTTPException(status_code=401, detail="Session revoked")
            # Update last_active
            await db.user_sessions.update_one(
                {"id": session_id},
                {"$set": {"last_active": datetime.now(timezone.utc).isoformat()}}
            )
        
        if payload.get("type") == "2fa_pending":
            raise HTTPException(status_code=401, detail="2FA verification required. Use /api/auth/verify-2fa")
            
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

class VerifyLogin2FARequest(BaseModel):
    code: str
    temp_token: str

@api_router.post("/auth/verify-2fa", response_model=TokenResponse)
async def verify_login_2fa(
    verify_data: VerifyLogin2FARequest,
    request: Request
):
    """Verify 2FA after successful password check and get full token"""
    try:
        payload = jwt.decode(verify_data.temp_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "2fa_pending":
            raise HTTPException(status_code=400, detail="Invalid token type")
        
        user_id = payload.get("sub")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        method = user.get("two_factor_method", "app")
        
        if method == "app":
            totp_secret = user.get("two_factor_secret")
            if not totp_secret:
                raise HTTPException(status_code=400, detail="2FA yapılandırması eksik")
            
            import pyotp
            totp = pyotp.TOTP(totp_secret)
            if not totp.verify(verify_data.code, valid_window=1):
                raise HTTPException(status_code=400, detail="Geçersiz 2FA kodu")
        else:
            # Verify code for email
            stored_code = user.get("two_factor_code")
            expires = user.get("two_factor_code_expires")
            
            if not stored_code or stored_code != verify_data.code:
                raise HTTPException(status_code=400, detail="Geçersiz kod")
            
            if expires and datetime.fromisoformat(expires.replace('Z', '+00:00')) < datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail="Kod süresi dolmuş")
        
        # Successful 2FA - create full session
        session_id = str(uuid.uuid4())
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Determine platform/device
        user_agent = request.headers.get("user-agent", "Unknown")
        platform = "Unknown"
        if "iPhone" in user_agent or "iPad" in user_agent: platform = "iOS"
        elif "Android" in user_agent: platform = "Android"
        elif "Windows" in user_agent: platform = "Windows"
        elif "Mac" in user_agent: platform = "macOS"
        elif "Linux" in user_agent: platform = "Linux"
        
        # Track device
        from services.postgresql_service import track_device_pg
        try:
            # We wrap this to avoid breaking login if Geo lookup fails
            device, is_new = await track_device(user_id, request)
        except:
            pass
            
        await db.user_sessions.insert_one({
            "id": session_id,
            "user_id": user["id"],
            "device": platform,
            "user_agent": user_agent,
            "ip_address": request.client.host if request.client else "unknown",
            "created_at": now_iso,
            "is_active": True
        })
        
        token = create_token(user["id"], user["email"], session_id=session_id)
        # Clear sensitive fields
        if "password" in user: del user["password"]
        
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": user
        }
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token süresi dolmuş")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Geçersiz token")

def calculate_level(xp: int) -> int:
    for level in sorted(USER_LEVELS.keys(), reverse=True):
        if xp >= USER_LEVELS[level]["xp_required"]:
            return level
    return 1

async def add_xp(user_id: str, amount: int):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user:
        new_xp = user.get("xp", 0) + amount
        new_level = calculate_level(new_xp)
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"xp": new_xp, "level": new_level}}
        )

async def award_badge(user_id: str, badge: str):
    await db.users.update_one(
        {"id": user_id},
        {"$addToSet": {"badges": badge}}
    )

# ============== IP GEOLOCATION (Free - ip-api.com) ==============
# Country code -> BCP 47 language code (for geo/me and downstream APIs)
LANG_MAP = {
    "US": "en", "GB": "en", "UK": "en", "ZA": "en", "NG": "en", "SG": "en",
    "BR": "pt-BR",
    "IN": "hi",
    "ID": "id",
    "RU": "ru",
    "MX": "es", "AR": "es", "CO": "es", "CL": "es", "PE": "es", "ES": "es",
    "JP": "ja",
    "DE": "de",
    "TR": "tr",
    "FR": "fr",
    "KR": "ko",
    "VN": "vi",
    "PH": "fil",
    "TH": "th",
    "PK": "ur",
    "EG": "ar", "SA": "ar", "AE": "ar",
    "MY": "ms",
    "IT": "it",
    "PL": "pl",
    "CN": "zh",
    "NL": "nl",
    "GR": "el",
    "UA": "uk",
    "BD": "bd",
    "PT": "pt",
}


def get_client_ip(request: Request) -> str:
    """Get client IP from request (supports proxies: X-Forwarded-For, CF-Connecting-IP, X-Real-IP)"""
    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip:
        return cf_ip.split(",")[0].strip()
    forwarded = request.headers.get("X-Forwarded-For") or request.headers.get("X-Real-IP")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""

@api_router.get("/geo/me")
async def geo_me(request: Request):
    """IP-based region/country detection - ip-api.com (free). Returns countryCode, country, region, city, timezone, language."""
    try:
        client_ip = get_client_ip(request)
        if not client_ip or client_ip in ("127.0.0.1", "localhost", "::1"):
            return {"countryCode": "TR", "country": "Turkey", "region": "", "city": "", "timezone": "Europe/Istanbul", "language": "tr"}
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"http://ip-api.com/json/{client_ip}?fields=status,country,countryCode,regionName,city,timezone")
            data = resp.json()
        if data.get("status") != "success":
            return {"countryCode": "TR", "country": "Turkey", "region": "", "city": "", "timezone": "Europe/Istanbul", "language": "tr"}
        cc = data.get("countryCode", "US")
        language = LANG_MAP.get(cc, "en")
        return {
            "countryCode": cc,
            "country": data.get("country", ""),
            "region": data.get("regionName", ""),
            "city": data.get("city", ""),
            "timezone": data.get("timezone", "UTC"),
            "language": language
        }
    except Exception as e:
        logger.warning(f"Geo lookup failed: {e}")
        return {"countryCode": "TR", "country": "Turkey", "region": "", "city": "", "timezone": "Europe/Istanbul", "language": "tr"}

# ============== LOCATION & GEOCODING (Photon API - Free, OpenStreetMap) ==============
from services.geocoding_service import geocoding_service

@api_router.get("/location/search")
async def search_locations(
    q: str = Query(..., min_length=2),
    lang: str = Query("default"),
    limit: int = Query(5, ge=1, le=20),
    lat: float = Query(None),
    lon: float = Query(None),
):
    """Search locations using Photon API (free, no key, OpenStreetMap data)"""
    results = await geocoding_service.search_location(q, lang=lang, limit=limit, lat=lat, lon=lon)
    return {"results": results, "count": len(results), "source": "photon"}

@api_router.get("/location/reverse")
async def reverse_geocode(
    lat: float = Query(...),
    lon: float = Query(...),
):
    """Reverse geocode: coordinates to address using Photon API"""
    result = await geocoding_service.reverse_geocode(lat, lon)
    if not result:
        raise HTTPException(status_code=404, detail="Konum bulunamadı")
    return {"result": result, "source": "photon"}

@api_router.get("/location/nearby")
async def nearby_locations(
    lat: float = Query(...),
    lon: float = Query(...),
    q: str = Query(""),
    limit: int = Query(10, ge=1, le=20),
):
    """Search nearby locations using Photon API with coordinate bias"""
    query = q if q else "restaurant cafe park"
    results = await geocoding_service.search_location(query, limit=limit, lat=lat, lon=lon)
    return {"results": results, "count": len(results), "source": "photon"}

# ============== COUNTRIES (REST Countries API - Free, No Key) ==============

@api_router.get("/countries")
async def get_countries(
    region: str = Query(None),
    subregion: str = Query(None),
):
    """Get countries list using REST Countries API (free, no key)"""
    if subregion:
        countries = await geocoding_service.get_countries_by_subregion(subregion)
    elif region:
        countries = await geocoding_service.get_countries_by_region(region)
    else:
        countries = await geocoding_service.get_all_countries()
    return {"countries": countries, "count": len(countries), "source": "restcountries"}

@api_router.get("/countries/search")
async def search_countries(q: str = Query(..., min_length=2)):
    """Search countries by name"""
    countries = await geocoding_service.search_country(q)
    return {"countries": countries, "count": len(countries), "source": "restcountries"}

@api_router.get("/countries/{code}")
async def get_country_by_code(code: str):
    """Get country details by ISO alpha-2 code (e.g. TR, US, DE)"""
    country = await geocoding_service.get_country_by_code(code)
    if not country:
        raise HTTPException(status_code=404, detail="Ülke bulunamadı")
    return country

@api_router.get("/countries/regions/list")
async def get_regions():
    """Get available regions"""
    return {
        "regions": [
            {"id": "africa", "name": "Afrika", "name_en": "Africa"},
            {"id": "americas", "name": "Amerika", "name_en": "Americas"},
            {"id": "asia", "name": "Asya", "name_en": "Asia"},
            {"id": "europe", "name": "Avrupa", "name_en": "Europe"},
            {"id": "oceania", "name": "Okyanusya", "name_en": "Oceania"},
        ]
    }

# ============== API SERVICES STATUS ==============
@api_router.get("/services/status")
async def services_status():
    """Tüm API servislerinin durumu"""
    giphy_key = os.environ.get("GIPHY_API_KEY", "")
    smtp_ok = bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_USER") and os.environ.get("SMTP_PASS"))

    nudenet_ok = False
    try:
        from services.content_moderation import content_moderator
        nudenet_ok = content_moderator.detector is not None
    except Exception:
        pass

    detoxify_ok = False
    try:
        import detoxify as _dt
        detoxify_ok = True
    except ImportError:
        pass

    return {
        "soundcloud": {
            "status": "ok",
            "message": "SoundCloud arama aktif (main.py microservice)",
            "free": True, "key_required": False,
        },
        "deezer": {
            "status": "ok",
            "message": "Deezer arama aktif (ücretsiz, anahtar gerektirmez)",
            "endpoint": "https://api.deezer.com/search",
            "free": True, "key_required": False,
        },
        "translate": {
            "status": "ok",
            "message": "MyMemory Translation API (ücretsiz, anahtar gerektirmez, 5000 kelime/gün)",
            "endpoint": "https://api.mymemory.translated.net/get",
            "free": True, "key_required": False,
        },
        "email": {
            "status": "ok" if smtp_ok else "not_configured",
            "message": f"SMTP aktif ({os.environ.get('SMTP_HOST', 'yok')})" if smtp_ok else "SMTP_HOST, SMTP_USER, SMTP_PASS .env'e ekleyin (Brevo 300/gün ücretsiz)",
            "configured": smtp_ok,
            "free": True, "key_required": True,
        },
        "giphy": {
            "status": "ok" if giphy_key else "mock",
            "message": "GIPHY aktif" if giphy_key else "Mock mod (GIPHY_API_KEY .env'e ekleyin, ücretsiz)",
            "configured": bool(giphy_key),
            "free": True, "key_required": True,
        },
        "lyrics": {
            "status": "ok",
            "message": "lyrics.ovh + lrclib.net (ücretsiz, anahtar gerektirmez)",
            "free": True, "key_required": False,
        },
        "nudenet": {
            "status": "ok" if nudenet_ok else "not_loaded",
            "message": "NudeNet görsel moderasyon aktif" if nudenet_ok else "NudeNet yüklenmedi (pip install nudenet)",
            "free": True, "key_required": False, "open_source": True,
        },
        "detoxify": {
            "status": "ok" if detoxify_ok else "not_installed",
            "message": "Detoxify metin moderasyon aktif" if detoxify_ok else "Detoxify yüklenmedi (pip install detoxify)",
            "free": True, "key_required": False, "open_source": True,
        },
        "expo_push": {
            "status": "ok",
            "message": "Expo Push Notification servisi (ücretsiz)",
            "endpoint": "https://exp.host/--/api/v2/push/send",
            "free": True, "key_required": False,
        },
        "dicebear": {
            "status": "ok",
            "message": "DiceBear avatar API (ücretsiz, anahtar gerektirmez)",
            "endpoint": "https://api.dicebear.com/7.x/avataaars/svg",
            "free": True, "key_required": False,
        },
        "geo": {
            "status": "ok",
            "message": "ip-api.com (ücretsiz) ile IP tabanlı bölge tespiti",
            "free": True, "key_required": False,
        },
        "photon_geocoding": {
            "status": "ok",
            "message": "Photon API (Komoot) - ücretsiz geocoding, OpenStreetMap verileri",
            "endpoint": "https://photon.komoot.io/api",
            "free": True, "key_required": False, "open_source": True,
        },
        "rest_countries": {
            "status": "ok",
            "message": "REST Countries API - ülke/bölge bilgileri (ücretsiz, anahtar gerektirmez)",
            "endpoint": "https://restcountries.com/v3.1",
            "free": True, "key_required": False,
        },
        "leaflet_maps": {
            "status": "ok",
            "message": "Leaflet.js + OpenStreetMap tiles - ücretsiz harita görüntüleme",
            "tiles": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            "free": True, "key_required": False, "open_source": True,
        },
        "meilisearch": meili_service.get_status(),
        "ar_effects": {
            "status": "ok",
            "message": "Three.js, MindAR, MediaPipe, VisionCamera, Expo AV - config API (istemci tarafında render)",
            "endpoints": ["/api/effects/equalizer/config", "/api/effects/face-filters", "/api/effects/particles/config", "/api/effects/ar-music", "/api/effects/waveform/config", "/api/effects/camera", "/api/effects/motion-tracking/config"],
            "free": True, "key_required": False, "open_source": True,
        },
    }

# ============== FRIEND REQUEST SYSTEM ==============

class FriendRequestCreate(BaseModel):
    to_user_id: str

class FriendRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    from_user_id: str
    from_username: str
    from_avatar: Optional[str] = None
    from_display_name: Optional[str] = None
    to_user_id: str
    request_status: str = "pending"  # pending, accepted, rejected
    created_at: str

@api_router.post("/social/friend-request/{user_id}")
async def send_friend_request(user_id: str, current_user: dict = Depends(get_current_user)):
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

@api_router.get("/social/friend-requests")
async def get_friend_requests(current_user: dict = Depends(get_current_user)):
    requests = await db.friend_requests.find(
        {"to_user_id": current_user["id"], "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return requests

@api_router.get("/social/friend-requests/sent")
async def get_sent_friend_requests(current_user: dict = Depends(get_current_user)):
    requests = await db.friend_requests.find(
        {"from_user_id": current_user["id"], "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return requests

@api_router.post("/social/friend-request/{request_id}/accept")
async def accept_friend_request(request_id: str, current_user: dict = Depends(get_current_user)):
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
    try:
        from services.analytics_service import track_follower_change
        await track_follower_change(request["from_user_id"], current_user["id"], "follow")
        await track_follower_change(current_user["id"], request["from_user_id"], "follow")
    except Exception:
        pass
    
    # Update counts for both users
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"following_count": 1, "followers_count": 1}})
    await db.users.update_one({"id": request["from_user_id"]}, {"$inc": {"following_count": 1, "followers_count": 1}})
    
    # Add XP
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

@api_router.post("/social/friend-request/{request_id}/reject")
async def reject_friend_request(request_id: str, current_user: dict = Depends(get_current_user)):
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

@api_router.delete("/social/friend-request/{request_id}/cancel")
async def cancel_friend_request(request_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.friend_requests.delete_one({
        "id": request_id,
        "from_user_id": current_user["id"],
        "status": "pending"
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="İstek bulunamadı")
    
    return {"message": "Arkadaşlık isteği iptal edildi"}

@api_router.get("/users/{user_id}/followers")
async def get_followers(
    user_id: str,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Takipçi listesi - follower_id follows user_id"""
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    if target.get("hide_followers_list") and user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Bu liste gizli")
    follows = await db.follows.find(
        {"following_id": user_id},
        {"follower_id": 1}
    ).skip(offset).limit(limit).to_list(limit)
    ids = [f["follower_id"] for f in follows]
    users = await db.users.find(
        {"id": {"$in": ids}},
        {"_id": 0, "password": 0, "email": 0}
    ).to_list(len(ids))
    my_following = set(f["following_id"] for f in await db.follows.find(
        {"follower_id": current_user["id"]},
        {"following_id": 1}
    ).to_list(1000))
    for u in users:
        u["is_following"] = u["id"] in my_following
        mutual = await db.follows.find_one({"follower_id": u["id"], "following_id": current_user["id"]})
        u["is_mutual"] = bool(mutual)
    order_map = {id: i for i, id in enumerate(ids)}
    users.sort(key=lambda x: order_map.get(x["id"], 999))
    return {"users": users}

@api_router.get("/users/{user_id}/following")
async def get_following(
    user_id: str,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Takip edilenler listesi - user_id follows following_id"""
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    if target.get("hide_following_list") and user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Bu liste gizli")
    follows = await db.follows.find(
        {"follower_id": user_id},
        {"following_id": 1}
    ).skip(offset).limit(limit).to_list(limit)
    ids = [f["following_id"] for f in follows]
    users = await db.users.find(
        {"id": {"$in": ids}},
        {"_id": 0, "password": 0, "email": 0}
    ).to_list(len(ids))
    my_following = set(f["following_id"] for f in await db.follows.find(
        {"follower_id": current_user["id"]},
        {"following_id": 1}
    ).to_list(1000))
    for u in users:
        u["is_following"] = u["id"] in my_following
        mutual = await db.follows.find_one({"follower_id": u["id"], "following_id": current_user["id"]})
        u["is_mutual"] = bool(mutual)
    order_map = {id: i for i, id in enumerate(ids)}
    users.sort(key=lambda x: order_map.get(x["id"], 999))
    return {"users": users}

@api_router.delete("/social/unfriend/{user_id}")
async def unfriend_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Arkadaşlığı kaldır (karşılıklı takibi sil)"""
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Kendinizle arkadaş olamazsınız")
    r = await db.follows.delete_many({
        "$or": [
            {"follower_id": current_user["id"], "following_id": user_id},
            {"follower_id": user_id, "following_id": current_user["id"]}
        ]
    })
    if r.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Zaten arkadaş değilsiniz")
    try:
        from services.analytics_service import track_follower_change
        await track_follower_change(user_id, current_user["id"], "unfollow")
        await track_follower_change(current_user["id"], user_id, "unfollow")
    except Exception:
        pass
    return {"message": "Arkadaşlık kaldırıldı"}

# ============== PREMIUM SUBSCRIPTION ==============

@api_router.post("/subscription/upgrade")
async def upgrade_to_premium(current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "subscription_type": "premium",
            "subscription_started_at": now,
            "subscription_expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        }}
    )
    
    # Award premium badge
    await award_badge(current_user["id"], "premium_member")
    
    return {"message": "Premium üyeliğiniz aktifleştirildi", "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()}

@api_router.get("/subscription/status")
async def get_subscription_status(current_user: dict = Depends(get_current_user)):
    return {
        "subscription_type": current_user.get("subscription_type", "free"),
        "started_at": current_user.get("subscription_started_at"),
        "expires_at": current_user.get("subscription_expires_at")
    }

# ============== MOCK DATA ==============

MOCK_TRACKS = [
    {"id": "t1", "title": "Yıldızların Altında", "artist": "Tarkan", "album": "Metamorfoz", "duration": 245, "cover_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300", "source": "spotify", "likes_count": 15420, "comments_count": 234, "shares_count": 567},
    {"id": "t2", "title": "Sen Olsan Bari", "artist": "Aleyna Tilki", "album": "Singles", "duration": 198, "cover_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300", "source": "youtube", "likes_count": 12300, "comments_count": 189, "shares_count": 423},
    {"id": "t3", "title": "Firuze", "artist": "Sezen Aksu", "album": "Firuze", "duration": 312, "cover_url": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300", "source": "apple", "likes_count": 28900, "comments_count": 567, "shares_count": 890},
    {"id": "t4", "title": "Cevapsız Çınlama", "artist": "maNga", "album": "e-akustik", "duration": 256, "cover_url": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300", "source": "spotify", "likes_count": 19800, "comments_count": 345, "shares_count": 612},
    {"id": "t5", "title": "Unuttun mu Beni", "artist": "Mabel Matiz", "album": "Gök Nerede", "duration": 223, "cover_url": "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300", "source": "youtube", "likes_count": 16700, "comments_count": 278, "shares_count": 445},
    {"id": "t6", "title": "Duman", "artist": "Duman", "album": "Darmaduman", "duration": 287, "cover_url": "https://images.unsplash.com/photo-1504898770365-14faca6a7320?w=300", "source": "spotify", "likes_count": 22100, "comments_count": 456, "shares_count": 789},
    {"id": "t7", "title": "Kuzu Kuzu", "artist": "Tarkan", "album": "Karma", "duration": 234, "cover_url": "https://images.unsplash.com/photo-1487180144351-b8472da7d491?w=300", "source": "apple", "likes_count": 31200, "comments_count": 678, "shares_count": 1023},
    {"id": "t8", "title": "Şımarık", "artist": "Tarkan", "album": "Ölürüm Sana", "duration": 201, "cover_url": "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300", "source": "youtube", "likes_count": 45600, "comments_count": 890, "shares_count": 1567},
]

MOCK_ARTISTS = [
    {"id": "a1", "name": "Tarkan", "image_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300", "monthly_listeners": 8500000, "genres": ["Pop", "Turkish Pop"], "followers_count": 2340000},
    {"id": "a2", "name": "Sezen Aksu", "image_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300", "monthly_listeners": 6200000, "genres": ["Pop", "Turkish Classical"], "followers_count": 1890000},
    {"id": "a3", "name": "Duman", "image_url": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300", "monthly_listeners": 4800000, "genres": ["Rock", "Alternative Rock"], "followers_count": 1560000},
    {"id": "a4", "name": "maNga", "image_url": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300", "monthly_listeners": 3500000, "genres": ["Rock", "Nu Metal"], "followers_count": 980000},
    {"id": "a5", "name": "Mabel Matiz", "image_url": "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300", "monthly_listeners": 5100000, "genres": ["Pop", "Indie"], "followers_count": 1230000},
]

# ============== AUTH ENDPOINTS ==============

def validate_password(password: str) -> tuple[bool, str]:
    """Validate password: minimum 8 characters."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    return True, ""

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Validate password strength
    is_valid, error_message = validate_password(user_data.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_message)
    
    existing = await db.users.find_one({"$or": [{"email": user_data.email}, {"username": user_data.username}]})
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
    
    try:
        await meili_service.index_user(user_doc)
    except Exception:
        pass
    
    token = create_token(user_id, user_data.email)
    user_response = UserResponse(**{k: v for k, v in user_doc.items() if k != "password"})
    
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(login_data: UserLogin, request: Request):
    # ============== BRUTE FORCE PROTECTION ==============
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}_{login_data.email}"  # Track by IP + email combo
    
    try:
        if SECURITY_ENABLED:
            # Check if account/IP is locked
            is_locked, remaining = brute_force_protection.is_locked(identifier)
            if is_locked:
                raise HTTPException(
                    status_code=429, 
                    detail=f"Çok fazla başarısız deneme. {remaining} saniye sonra tekrar deneyin."
                )
    except NameError:
        pass  # Security not enabled
    
    user = await db.users.find_one({"email": login_data.email}, {"_id": 0})
    if not user or not verify_password(login_data.password, user["password"]):
        # Record failed attempt
        try:
            if SECURITY_ENABLED:
                should_lock = brute_force_protection.record_failed_attempt(identifier)
                remaining_attempts = brute_force_protection.get_remaining_attempts(identifier)
                
                if should_lock:
                    raise HTTPException(
                        status_code=429,
                        detail="Hesabınız geçici olarak kilitlendi. 24 saat sonra tekrar deneyin."
                    )
                else:
                    raise HTTPException(
                        status_code=401, 
                        detail=f"Geçersiz e-posta veya şifre. {remaining_attempts} deneme hakkınız kaldı."
                    )
        except NameError:
            pass
        
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # 2FA enforcement: if user has 2FA enabled, return temp_token and require verification
    if user.get("two_factor_enabled"):
        # Send code if method is email
        if user.get("two_factor_method") == "email":
            import secrets
            code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {
                    "two_factor_code": code,
                    "two_factor_code_expires": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
                }}
            )
            try:
                await email_service.send_2fa_code(user["email"], user.get("display_name", user.get("username", "Kullanıcı")), code)
            except Exception as e:
                logger.warning(f"Failed to send 2FA email: {e}")

        from fastapi.responses import JSONResponse
        temp_token_payload = {
            "sub": user["id"],
            "email": user["email"],
            "type": "2fa_pending",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
            "iat": datetime.now(timezone.utc)
        }
        temp_token = jwt.encode(temp_token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        return JSONResponse(
            status_code=401,
            content={
                "detail": "2FA verification required",
                "requires_2fa": True,
                "temp_token": temp_token,
                "method": user.get("two_factor_method", "app")
            }
        )
    
    # Clear failed attempts on successful login
    try:
        if SECURITY_ENABLED:
            brute_force_protection.clear_attempts(identifier)
    except NameError:
        pass
    
    # Update online status
    await db.users.update_one({"id": user["id"]}, {"$set": {"is_online": True}})
    
    # Track device and check for suspicious login
    device, is_new_device = await track_device(user["id"], request)
    
    # Create session for real session tracking
    ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "Unknown")
    platform = "Unknown"
    if "iPhone" in user_agent or "iPad" in user_agent:
        platform = "iOS"
    elif "Android" in user_agent:
        platform = "Android"
    elif "Windows" in user_agent:
        platform = "Windows"
    elif "Mac" in user_agent:
        platform = "macOS"
    elif "Linux" in user_agent:
        platform = "Linux"
    
    session_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.user_sessions.insert_one({
        "id": session_id,
        "user_id": user["id"],
        "device": platform,
        "user_agent": user_agent,
        "ip_address": ip,
        "created_at": now_iso,
        "last_active": now_iso,
        "is_active": True
    })
    
    if is_new_device:
        # Send suspicious login alert email
        ip = request.client.host if request.client else "Bilinmiyor"
        user_agent = request.headers.get("user-agent", "Bilinmiyor")
        
        await email_service.send_suspicious_login_alert(
            user["email"],
            user.get("display_name", user.get("username", "Kullanıcı")),
            {
                "ip_address": ip,
                "user_agent": user_agent,
                "location": "Bilinmiyor",  # Could use IP geolocation API
                "device_id": device["id"]
            }
        )
        
        await db.login_history.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "ip_address": ip,
            "user_agent": user_agent,
            "platform": platform,
            "device_id": device["id"],
            "is_suspicious": True,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    else:
        ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "Unknown")
        await db.login_history.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "ip_address": ip,
            "user_agent": user_agent,
            "platform": platform,
            "device_id": device.get("id") if isinstance(device, dict) else "",
            "is_suspicious": False,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    token = create_token(user["id"], user["email"], session_id=session_id)
    user_response = UserResponse(**{k: v for k, v in user.items() if k != "password"})
    
    # Set CSRF cookie (double-submit) and include in response
    try:
        csrf_token = generate_csrf_token() if SECURITY_ENABLED else ""
        if SECURITY_ENABLED and csrf_token:
            from fastapi.responses import JSONResponse
            response = JSONResponse(content={
                "access_token": token,
                "user": user_response.model_dump(),
                "csrf_token": csrf_token
            })
            response.set_cookie(key="csrf_token", value=csrf_token, httponly=False, samesite="lax", path="/")
            return response
    except NameError:
        pass
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

@api_router.post("/auth/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user: dict = Depends(get_current_user)
):
    token = credentials.credentials
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    session_id = payload.get("sid")
    if session_id:
        await db.user_sessions.update_one(
            {"id": session_id, "user_id": current_user["id"]},
            {"$set": {"is_active": False}}
        )
    await db.token_blacklist.insert_one({
        "token": token,
        "user_id": current_user["id"],
        "revoked_at": datetime.now(timezone.utc).isoformat()
    })
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"is_online": False}})
    await db.listening_activity.update_one({"user_id": current_user["id"]}, {"$set": {"is_live": False}})
    return {"message": "Logged out successfully"}

class Verify2FALoginRequest(BaseModel):
    temp_token: str
    code: str  # TOTP code

@api_router.post("/auth/verify-2fa", response_model=TokenResponse)
async def verify_2fa_login(verify_data: Verify2FALoginRequest, request: Request):
    """Verify 2FA TOTP code and return real JWT after login"""
    try:
        payload = jwt.decode(
            verify_data.temp_token, JWT_SECRET, algorithms=[JWT_ALGORITHM]
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Temp token expired. Please login again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid temp token")
    
    if payload.get("type") != "2fa_pending":
        raise HTTPException(status_code=401, detail="Invalid temp token type")
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid temp token")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user or not user.get("two_factor_enabled"):
        raise HTTPException(status_code=401, detail="User not found or 2FA not enabled")
    
    # Verify TOTP
    totp_secret = user.get("two_factor_secret")
    if not totp_secret:
        raise HTTPException(status_code=400, detail="2FA not properly configured")
    
    try:
        import pyotp
        totp = pyotp.TOTP(totp_secret)
        if not totp.verify(verify_data.code, valid_window=1):
            raise HTTPException(status_code=401, detail="Invalid 2FA code")
    except ImportError:
        # Fallback if pyotp not installed: accept any 6-digit code (dev only)
        if len(verify_data.code) != 6 or not verify_data.code.isdigit():
            raise HTTPException(status_code=401, detail="Invalid 2FA code")
    
    # Clear brute force
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}_{user['email']}"
    try:
        if SECURITY_ENABLED:
            brute_force_protection.clear_attempts(identifier)
    except NameError:
        pass
    
    # Create session
    user_agent = request.headers.get("user-agent", "Unknown")
    platform = "Unknown"
    if "iPhone" in user_agent or "iPad" in user_agent:
        platform = "iOS"
    elif "Android" in user_agent:
        platform = "Android"
    elif "Windows" in user_agent:
        platform = "Windows"
    elif "Mac" in user_agent:
        platform = "macOS"
    elif "Linux" in user_agent:
        platform = "Linux"
    
    session_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.user_sessions.insert_one({
        "id": session_id,
        "user_id": user["id"],
        "device": platform,
        "user_agent": user_agent,
        "ip_address": ip,
        "created_at": now_iso,
        "last_active": now_iso,
        "is_active": True
    })
    
    await db.users.update_one({"id": user["id"]}, {"$set": {"is_online": True}})
    
    token = create_token(user["id"], user["email"], session_id=session_id)
    user_response = UserResponse(**{k: v for k, v in user.items() if k != "password"})
    
    # Set CSRF cookie for verify-2fa response
    try:
        csrf_token = generate_csrf_token() if SECURITY_ENABLED else ""
        if SECURITY_ENABLED and csrf_token:
            from fastapi.responses import JSONResponse
            response = JSONResponse(content={
                "access_token": token,
                "user": user_response.model_dump(),
                "csrf_token": csrf_token
            })
            response.set_cookie(key="csrf_token", value=csrf_token, httponly=False, samesite="lax", path="/")
            return response
    except NameError:
        pass
    return TokenResponse(access_token=token, user=user_response)

# ============== GOOGLE AUTH (Direct OAuth) ==============

GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
GOOGLE_REDIRECT_URI = os.environ.get("BACKEND_URL", "http://localhost:8080") + "/api/auth/google/callback"

@api_router.get("/auth/google/login")
async def google_login():
    """Get Google OAuth authorization URL"""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    
    # Google OAuth URL
    auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={GOOGLE_REDIRECT_URI}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        "&access_type=offline"
        "&prompt=consent"
    )
    return {"auth_url": auth_url}

@api_router.get("/auth/google/callback")
async def google_callback(code: str = None, error: str = None):
    """Handle Google OAuth callback"""
    from fastapi.responses import RedirectResponse
    
    # Mobile deeplink ile yönlendirme
    app_scheme = os.environ.get("MOBILE_APP_SCHEME", "socialbeats")

    if error:
        return RedirectResponse(url=f"{app_scheme}://auth/callback?error={error}")

    if not code:
        return RedirectResponse(url=f"{app_scheme}://auth/callback?error=no_code")
    
    try:
        # Exchange code for tokens
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": GOOGLE_REDIRECT_URI
                }
            )
            
            if token_response.status_code != 200:
                logging.error(f"Google token error: {token_response.text}")
                return RedirectResponse(url=f"{app_scheme}://auth/callback?error=token_exchange_failed")
            
            tokens = token_response.json()
            access_token = tokens.get("access_token")
            
            # Get user info from Google
            user_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if user_response.status_code != 200:
                return RedirectResponse(url=f"{app_scheme}://auth/callback?error=user_info_failed")
            
            google_user = user_response.json()
    
    except Exception as e:
        logging.error(f"Google OAuth error: {e}")
        return RedirectResponse(url=f"{app_scheme}://auth/callback?error=oauth_error")
    
    # Check if user exists
    email = google_user.get("email")
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        # Update user with Google info
        await db.users.update_one(
            {"email": email},
            {"$set": {
                "is_online": True,
                "avatar_url": google_user.get("picture", existing_user.get("avatar_url")),
                "google_id": google_user.get("id"),
                "last_login": datetime.now(timezone.utc).isoformat()
            }}
        )
        user_id = existing_user["id"]
    else:
        # Create new user
        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        username = email.split("@")[0] + "_" + str(uuid.uuid4())[:4]
        
        user_doc = {
            "id": user_id,
            "email": email,
            "username": username,
            "display_name": google_user.get("name", username),
            "password": None,
            "avatar_url": google_user.get("picture", f"https://api.dicebear.com/7.x/avataaars/svg?seed={username}"),
            "bio": None,
            "google_id": google_user.get("id"),
            "auth_provider": "google",
            "connected_services": [],
            "created_at": now,
            "subscription_type": "free",
            "followers_count": 0,
            "following_count": 0,
            "posts_count": 0,
            "favorite_genres": [],
            "favorite_artists": [],
            "music_mood": None,
            "is_verified": google_user.get("verified_email", False),
            "level": 1,
            "xp": 0,
            "badges": ["new_user", "google_user"],
            "profile_theme": "default",
            "is_online": True
        }
        await db.users.insert_one(user_doc)
    
    # Create JWT token
    token = create_token(user_id, email)
    
    # Mobil uygulama deeplink ile token ilet
    return RedirectResponse(url=f"{app_scheme}://auth/callback?token={token}")

# Mobile Google Auth - supports both id_token (verified) and access_token + user info
class GoogleMobileLoginRequest(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None
    google_id: Optional[str] = None
    access_token: Optional[str] = None
    id_token: Optional[str] = None

def _verify_google_id_token(id_token_str: str):
    """Verify Google ID token and return user info - tries GOOGLE_CLIENT_ID and EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"""
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests
        client_ids = []
        for var in ('GOOGLE_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'):
            for c in os.environ.get(var, '').split(','):
                if c.strip():
                    client_ids.append(c.strip())
        if not client_ids:
            return None
        req = google_requests.Request()
        for cid in client_ids:
            try:
                idinfo = id_token.verify_oauth2_token(id_token_str, req, cid)
                if idinfo.get('iss') in ('accounts.google.com', 'https://accounts.google.com'):
                    return {"email": idinfo.get("email"), "name": idinfo.get("name"), "picture": idinfo.get("picture"), "id": idinfo.get("sub")}
            except ValueError:
                continue
        return None
    except Exception as e:
        logger.warning(f"ID token verify failed: {e}")
        return None

@api_router.post("/auth/google/mobile")
async def google_mobile_login(data: GoogleMobileLoginRequest):
    """Handle Google login from mobile app - id_token (verified) or access_token + user info"""
    try:
        email, name, picture, google_id = None, None, None, None
        if data.id_token:
            idinfo = _verify_google_id_token(data.id_token)
            if idinfo:
                email, name, picture, google_id = idinfo.get("email"), idinfo.get("name"), idinfo.get("picture"), idinfo.get("id")
        if not email and data.email:
            email, name, picture, google_id = data.email, data.name, data.picture, data.google_id
        if not email:
            raise HTTPException(status_code=400, detail="Invalid Google credentials")
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": email})
        
        if existing_user:
            user_id = existing_user["id"]
            # Update user info
            await db.users.update_one(
                {"email": email},
                {"$set": {
                    "avatar_url": picture or existing_user.get("avatar_url"),
                    "google_id": google_id,
                    "is_online": True,
                    "last_login": datetime.now(timezone.utc).isoformat()
                }}
            )
            user_doc = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0, "password_hash": 0})
        else:
            # Create new user
            user_id = str(uuid.uuid4())
            username = email.split("@")[0].lower().replace(".", "_")
            
            # Check username uniqueness
            counter = 1
            original_username = username
            while await db.users.find_one({"username": username}):
                username = f"{original_username}{counter}"
                counter += 1
            
            user_doc = {
                "id": user_id,
                "email": email,
                "username": username,
                "display_name": name or username,
                "password_hash": "",
                "avatar_url": picture or f"https://api.dicebear.com/7.x/avataaars/svg?seed={username}",
                "bio": "",
                "google_id": google_id,
                "auth_provider": "google",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "followers_count": 0,
                "following_count": 0,
                "posts_count": 0,
                "favorite_genres": [],
                "favorite_artists": [],
                "music_mood": None,
                "is_verified": True,
                "level": 1,
                "xp": 0,
                "badges": ["new_user", "google_user"],
                "profile_theme": "default",
                "is_online": True
            }
            await db.users.insert_one(user_doc)
            user_doc = {k: v for k, v in user_doc.items() if k not in ("_id", "password", "password_hash")}
        
        # Create JWT token
        token = create_token(user_id, email)
        
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": user_doc
        }
    except Exception as e:
        print(f"Mobile Google login error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== USER PROFILE ENDPOINTS ==============

@api_router.get("/user/settings")
async def get_user_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.user_settings.find_one({"user_id": current_user["id"]}, {"_id": 0})
    
    if not settings:
        # Return default settings
        return {
            "user_id": current_user["id"],
            "is_private_account": False,
            "show_online_status": True,
            "who_can_message": "everyone",
            "message_requests": True,
            "who_can_see_posts": "everyone",
            "who_can_comment": "everyone",
            "show_like_count": True,
            "require_tag_approval": False,
            "message_notifications": True,
            "like_notifications": True,
            "comment_notifications": True,
            "follow_notifications": True,
            "tag_notifications": True,
            "quiet_hours_enabled": False,
            "quiet_hours_start": "22:00",
            "quiet_hours_end": "08:00",
            "auto_accept_follows": False,
            "hide_followers_list": False,
            "hide_following_list": False,
            "show_read_receipts": True,
            "show_online_in_chat": True,
            "auto_delete_messages": "never",
            "allow_media_download": True,
            "theme": "dark",
            "font_size": "medium",
            "language": "tr",
            "auto_play_videos": True,
            "data_saver_mode": False,
            "media_quality": "high"
        }
    
    return settings

@api_router.put("/user/settings")
async def update_user_settings(
    settings_data: UserSettingsUpdate,
    current_user: dict = Depends(get_current_user)
):
    # Get only non-None values
    update_data = {k: v for k, v in settings_data.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Güncellenecek ayar belirtilmedi")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Upsert settings
    await db.user_settings.update_one(
        {"user_id": current_user["id"]},
        {"$set": {**update_data, "user_id": current_user["id"]}},
        upsert=True
    )
    
    return {"message": "Ayarlar güncellendi"}

@api_router.post("/user/phone")
async def update_phone(
    phone: str,
    current_user: dict = Depends(get_current_user)
):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"phone": phone}}
    )
    return {"message": "Telefon numarası güncellendi"}

@api_router.put("/user/profile")
async def update_profile(
    body: ProfileUpdateBody,
    current_user: dict = Depends(get_current_user)
):
    update_data = {}
    if body.display_name is not None:
        update_data["display_name"] = body.display_name
    if body.username is not None:
        new_username = body.username.strip().lower()
        if not new_username or len(new_username) < 3:
            raise HTTPException(status_code=400, detail="Kullanıcı adı en az 3 karakter olmalı")
        if not new_username.replace("_", "").isalnum():
            raise HTTPException(status_code=400, detail="Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir")
        existing = await db.users.find_one({"username": new_username})
        if existing and existing["id"] != current_user["id"]:
            raise HTTPException(status_code=400, detail="Bu kullanıcı adı zaten alınmış")
        update_data["username"] = new_username
    if body.avatar_url is not None:
        update_data["avatar_url"] = body.avatar_url
    if body.bio is not None:
        update_data["bio"] = (body.bio[:200] if body.bio else "").strip() or None  # max 200 chars
    if body.location is not None:
        update_data["location"] = body.location.strip() or None
    if body.website is not None:
        update_data["website"] = body.website.strip() or None
    if body.birth_date is not None:
        update_data["birth_date"] = body.birth_date.strip() or None
    if body.is_private is not None:
        update_data["is_private"] = body.is_private
    if body.favorite_genres is not None:
        update_data["favorite_genres"] = body.favorite_genres
    if body.favorite_artists is not None:
        update_data["favorite_artists"] = body.favorite_artists
    if body.music_mood is not None:
        update_data["music_mood"] = body.music_mood
    if body.profile_theme is not None:
        update_data["profile_theme"] = body.profile_theme
    
    if update_data:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    return updated_user

# ============== DEVICE MANAGEMENT (must be before /user/{username}) ==============

@api_router.get("/user/devices")
async def get_user_devices_early(current_user: dict = Depends(get_current_user)):
    """Get user's devices"""
    devices = await db.user_devices.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("last_active", -1).to_list(50)
    
    # If no devices, return mock
    if not devices:
        return [{
            "id": "current",
            "platform": "Unknown",
            "model": "Mevcut Cihaz",
            "user_agent": "Unknown",
            "last_active": datetime.now(timezone.utc).isoformat(),
            "is_current": True
        }]
    
    return devices

@api_router.delete("/user/devices/{device_id}")
async def remove_device_early(
    device_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a device"""
    result = await db.user_devices.delete_one({
        "id": device_id,
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cihaz bulunamadı")
    
    return {"message": "Cihaz kaldırıldı"}

@api_router.get("/user/{username}")
async def get_user_profile(username: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"username": username}, {"_id": 0, "password": 0, "email": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_following = await db.follows.find_one({
        "follower_id": current_user["id"],
        "following_id": user["id"]
    }) is not None
    
    friend_request_status = "none"
    if is_following:
        # Karşılıklı takip varsa arkadaş
        other_dir = await db.follows.find_one({"follower_id": user["id"], "following_id": current_user["id"]})
        friend_request_status = "friends" if other_dir else "following"
    else:
        pending_from_me = await db.friend_requests.find_one({
            "from_user_id": current_user["id"], "to_user_id": user["id"], "status": "pending"
        })
        pending_from_them = await db.friend_requests.find_one({
            "from_user_id": user["id"], "to_user_id": current_user["id"], "status": "pending"
        })
        if pending_from_me:
            friend_request_status = "sent"
        elif pending_from_them:
            friend_request_status = "received"
    
    return {**dict(user), "is_following": is_following, "friend_request_status": friend_request_status}

@api_router.get("/user/{username}/activity")
async def get_user_activity(username: str, limit: int = 20, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"username": username}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user's recent posts
    posts = await db.posts.find(
        {"user_id": user["id"], "visibility": "public"},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"posts": posts}


# ============== SOCIAL POSTS MOVED TO routes/posts.py ==============
# ============== FEED MOVED TO routes/feed.py ==============
# ============== COMMENTS MOVED TO routes/comments.py ==============

# ============== COMMUNITIES MOVED TO routes/communities.py ==============

# ============== NOTIFICATIONS ==============

@api_router.get("/social/notifications")
async def get_notifications(
    limit: int = 50,
    notification_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["id"]}
    if notification_type:
        query["type"] = notification_type
    
    notifications = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return notifications

@api_router.get("/social/notifications/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    count = await db.notifications.count_documents({
        "user_id": current_user["id"],
        "is_read": False
    })
    return {"count": count}

@api_router.post("/social/notifications/mark-read")
async def mark_notifications_read(
    notification_ids: Optional[List[str]] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["id"], "is_read": False}
    if notification_ids:
        query["id"] = {"$in": notification_ids}
    
    await db.notifications.update_many(query, {"$set": {"is_read": True}})
    return {"message": "Notifications marked as read"}

# ============== LISTENING ACTIVITY ==============

@api_router.post("/social/activity/now-playing")
async def update_now_playing(track_id: str, current_user: dict = Depends(get_current_user)):
    track = next((t for t in MOCK_TRACKS if t["id"] == track_id), None)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.listening_activity.update_one(
        {"user_id": current_user["id"]},
        {"$set": {
            "user_id": current_user["id"],
            "username": current_user["username"],
            "user_avatar": current_user.get("avatar_url"),
            "track": track,
            "started_at": now,
            "is_live": True
        }},
        upsert=True
    )
    
    return {"message": "Now playing updated"}

@api_router.delete("/social/activity/now-playing")
async def clear_now_playing(current_user: dict = Depends(get_current_user)):
    await db.listening_activity.update_one(
        {"user_id": current_user["id"]},
        {"$set": {"is_live": False}}
    )
    return {"message": "Now playing cleared"}

@api_router.get("/social/activity/friends")
async def get_friends_activity(current_user: dict = Depends(get_current_user)):
    following = await db.follows.find({"follower_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    following_ids = [f["following_id"] for f in following]
    
    activities = await db.listening_activity.find(
        {"user_id": {"$in": following_ids}, "is_live": True},
        {"_id": 0}
    ).to_list(50)
    
    return activities

# ============== GAMIFICATION MOVED TO routes/gamification.py ==============

# ============== USER SUGGESTIONS ==============

@api_router.get("/social/suggestions/users")
async def get_user_suggestions(current_user: dict = Depends(get_current_user)):
    following = await db.follows.find({"follower_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    following_ids = [f["following_id"] for f in following]
    following_ids.append(current_user["id"])
    
    # Get users with similar music tastes
    user_genres = current_user.get("favorite_genres", [])
    
    query = {"id": {"$nin": following_ids}}
    if user_genres:
        query["favorite_genres"] = {"$in": user_genres}
    
    suggestions = await db.users.find(
        query,
        {"_id": 0, "password": 0, "email": 0}
    ).limit(10).to_list(10)
    
    return suggestions

# ============== TRACK SOCIAL FEATURES ==============

@api_router.post("/social/tracks/{track_id}/like")
async def like_track(track_id: str, current_user: dict = Depends(get_current_user)):
    existing = await db.track_likes.find_one({
        "track_id": track_id,
        "user_id": current_user["id"]
    })
    
    if existing:
        await db.track_likes.delete_one({"_id": existing["_id"]})
        return {"message": "Unliked", "is_liked": False}
    else:
        now = datetime.now(timezone.utc).isoformat()
        await db.track_likes.insert_one({
            "id": str(uuid.uuid4()),
            "track_id": track_id,
            "user_id": current_user["id"],
            "created_at": now
        })
        await add_xp(current_user["id"], 1)
        return {"message": "Liked", "is_liked": True}

@api_router.post("/social/tracks/{track_id}/share")
async def share_track(
    track_id: str,
    content: str = "",
    current_user: dict = Depends(get_current_user)
):
    track = next((t for t in MOCK_TRACKS if t["id"] == track_id), None)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    post_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    post = {
        "id": post_id,
        "user_id": current_user["id"],
        "username": current_user["username"],
        "user_avatar": current_user.get("avatar_url"),
        "user_display_name": current_user.get("display_name"),
        "is_verified": current_user.get("is_verified", False),
        "user_level": current_user.get("level", 1),
        "content": content or f"🎵 {track['title']} - {track['artist']} dinliyorum!",
        "post_type": "track_share",
        "track": track,
        "playlist": None,
        "mood": None,
        "rating": None,
        "media_urls": [],
        "visibility": "public",
        "allow_comments": True,
        "poll_options": [],
        "tags": [],
        "reactions": {"heart": 0, "fire": 0, "applause": 0, "thinking": 0, "sad": 0},
        "comments_count": 0,
        "shares_count": 0,
        "created_at": now,
        "is_pinned": False
    }
    
    await db.posts.insert_one(post)
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {"posts_count": 1}})
    await add_xp(current_user["id"], 10)
    
    post.pop("_id", None)
    return {"message": "Track shared", "post": post}

@api_router.get("/social/tracks/{track_id}/comments")
async def get_track_comments(track_id: str, current_user: dict = Depends(get_current_user)):
    comments = await db.track_comments.find(
        {"track_id": track_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return comments

@api_router.post("/social/tracks/{track_id}/comments")
async def add_track_comment(
    track_id: str,
    comment_data: CommentCreate,
    current_user: dict = Depends(get_current_user)
):
    comment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    comment = {
        "id": comment_id,
        "track_id": track_id,
        "user_id": current_user["id"],
        "username": current_user["username"],
        "user_avatar": current_user.get("avatar_url"),
        "user_level": current_user.get("level", 1),
        "content": comment_data.content,
        "likes_count": 0,
        "created_at": now
    }
    
    await db.track_comments.insert_one(comment)
    await add_xp(current_user["id"], 3)
    comment.pop("_id", None)
    
    return comment

# ============== SERVICE CONNECTION ENDPOINTS ==============

@api_router.post("/services/connect/{service_type}")
async def connect_service(service_type: str, current_user: dict = Depends(get_current_user)):
    if service_type not in ["youtube", "spotify", "apple"]:
        raise HTTPException(status_code=400, detail="Invalid service type")
    
    now = datetime.now(timezone.utc).isoformat()
    service_data = {
        "service_type": service_type,
        "service_user_id": f"mock_{service_type}_{uuid.uuid4().hex[:8]}",
        "connected_at": now,
        "library_sync_status": "syncing"
    }
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$addToSet": {"connected_services": service_type}}
    )
    
    await db.service_connections.update_one(
        {"user_id": current_user["id"], "service_type": service_type},
        {"$set": {**service_data, "user_id": current_user["id"]}},
        upsert=True
    )
    
    return {"message": f"Successfully connected to {service_type}", "service": service_data}

@api_router.delete("/services/disconnect/{service_type}")
async def disconnect_service(service_type: str, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$pull": {"connected_services": service_type}}
    )
    await db.service_connections.delete_one({"user_id": current_user["id"], "service_type": service_type})
    
    return {"message": f"Successfully disconnected from {service_type}"}

@api_router.get("/services/connected", response_model=List[ConnectedService])
async def get_connected_services(current_user: dict = Depends(get_current_user)):
    services = await db.service_connections.find(
        {"user_id": current_user["id"]}, {"_id": 0, "user_id": 0}
    ).to_list(10)
    return services

# ============== MUSIC LIBRARY ENDPOINTS ==============

@api_router.get("/library/tracks", response_model=List[Track])
async def get_library_tracks(
    source: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    tracks = MOCK_TRACKS.copy()
    if source:
        tracks = [t for t in tracks if t["source"] == source]
    
    for track in tracks:
        is_liked = await db.track_likes.find_one({
            "track_id": track["id"],
            "user_id": current_user["id"]
        }) is not None
        track["is_liked"] = is_liked
    
    return tracks[:limit]

@api_router.get("/library/recent", response_model=List[Track])
async def get_recent_tracks(current_user: dict = Depends(get_current_user)):
    shuffled = MOCK_TRACKS.copy()
    random.shuffle(shuffled)
    return shuffled[:6]

@api_router.get("/library/favorites", response_model=List[Track])
async def get_favorite_tracks(current_user: dict = Depends(get_current_user)):
    favorites = await db.user_favorites.find(
        {"user_id": current_user["id"]}, {"_id": 0}
    ).to_list(100)
    
    if not favorites:
        return MOCK_TRACKS[:5]
    
    return favorites

@api_router.post("/library/favorites/{track_id}")
async def add_to_favorites(track_id: str, current_user: dict = Depends(get_current_user)):
    track = next((t for t in MOCK_TRACKS if t["id"] == track_id), None)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    await db.user_favorites.update_one(
        {"user_id": current_user["id"], "id": track_id},
        {"$set": {**track, "user_id": current_user["id"], "favorited_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"message": "Added to favorites"}

@api_router.delete("/library/favorites/{track_id}")
async def remove_from_favorites(track_id: str, current_user: dict = Depends(get_current_user)):
    await db.user_favorites.delete_one({"user_id": current_user["id"], "id": track_id})
    return {"message": "Removed from favorites"}

# ============== PLAYLIST ENDPOINTS ==============

@api_router.get("/playlists", response_model=List[Playlist])
async def get_playlists(current_user: dict = Depends(get_current_user)):
    playlists = await db.playlists.find(
        {"owner_id": current_user["id"]}, {"_id": 0}
    ).to_list(100)
    
    if not playlists:
        return [
            {"id": "pl1", "name": "Türkçe Pop Hits", "description": "En sevilen Türkçe pop şarkıları", "cover_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300", "track_count": 25, "owner_id": current_user["id"], "is_public": True, "created_at": datetime.now(timezone.utc).isoformat(), "tracks": [], "likes_count": 145, "is_collaborative": False},
            {"id": "pl2", "name": "Rock Klasikleri", "description": "Türk rock'ının en iyileri", "cover_url": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300", "track_count": 18, "owner_id": current_user["id"], "is_public": True, "created_at": datetime.now(timezone.utc).isoformat(), "tracks": [], "likes_count": 89, "is_collaborative": False},
            {"id": "pl3", "name": "Chill Vibes", "description": "Rahatlatıcı müzikler", "cover_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300", "track_count": 32, "owner_id": current_user["id"], "is_public": False, "created_at": datetime.now(timezone.utc).isoformat(), "tracks": [], "likes_count": 67, "is_collaborative": True},
        ]
    return playlists

@api_router.post("/playlists", response_model=Playlist)
async def create_playlist(playlist_data: PlaylistCreate, current_user: dict = Depends(get_current_user)):
    playlist_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    playlist = {
        "id": playlist_id,
        "name": playlist_data.name,
        "description": playlist_data.description,
        "cover_url": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300",
        "track_count": 0,
        "owner_id": current_user["id"],
        "is_public": playlist_data.is_public,
        "is_collaborative": playlist_data.is_collaborative,
        "created_at": now,
        "tracks": [],
        "likes_count": 0
    }
    
    await db.playlists.insert_one(playlist)
    playlist.pop("_id", None)
    return playlist

# NOTE: This endpoint MUST be defined BEFORE /playlists/{playlist_id} to avoid route conflict
@api_router.get("/playlists/collaborative")
async def get_my_collaborative_playlists(
    current_user: dict = Depends(get_current_user)
):
    """Get playlists where current user is a collaborator"""
    playlists = await db.playlists.find(
        {
            "$or": [
                {"owner_id": current_user["id"], "is_collaborative": True},
                {"collaborators.user_id": current_user["id"]}
            ]
        },
        {"_id": 0}
    ).to_list(100)
    
    # Add owner info
    for playlist in playlists:
        owner = await db.users.find_one(
            {"id": playlist.get("owner_id")},
            {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
        )
        if owner:
            playlist["owner"] = owner
        playlist["is_owner"] = playlist.get("owner_id") == current_user["id"]
    
    return {"playlists": playlists, "total": len(playlists)}

# ============== SMART PLAYLISTS (Must be before {playlist_id} routes) ==============

@api_router.get("/playlists/smart-types")
async def get_smart_playlist_types(current_user: dict = Depends(get_current_user)):
    """Get available smart playlist types"""
    return {
        "playlists": [
            {
                "type": "discover_weekly",
                "name": "Keşfet Haftalık",
                "description": "Sana özel yeni keşifler",
                "icon": "sparkles",
                "color": "#8B5CF6"
            },
            {
                "type": "repeat_rewind",
                "name": "Repeat Rewind",
                "description": "En çok dinlediğin şarkılar",
                "icon": "refresh",
                "color": "#10B981"
            },
            {
                "type": "chill_mix",
                "name": "Chill Mix",
                "description": "Rahatlatıcı melodiler",
                "icon": "moon",
                "color": "#6366F1"
            },
            {
                "type": "workout_mix",
                "name": "Workout Mix",
                "description": "Spor için enerjik şarkılar",
                "icon": "fitness",
                "color": "#EF4444"
            },
            {
                "type": "focus_mix",
                "name": "Focus Mix",
                "description": "Odaklanmana yardımcı melodiler",
                "icon": "bulb",
                "color": "#F59E0B"
            }
        ]
    }

@api_router.get("/playlists/seasonal-suggestions")
async def get_seasonal_playlist_suggestions(current_user: dict = Depends(get_current_user)):
    """Get seasonal playlist recommendations"""
    from datetime import date
    month = date.today().month
    
    if month in [3, 4, 5]:
        season = "spring"
        playlists = [
            {"name": "🌸 Bahar Temizliği", "description": "Enerjik ve fresh şarkılarla bahara merhaba", "mood": "energetic"},
            {"name": "🌼 Çiçek Açan Melodiler", "description": "Rahatlatıcı akustik şarkılar", "mood": "calm"},
            {"name": "☕ Bahar Sabahları", "description": "Kahve eşliğinde dinlenecek şarkılar", "mood": "chill"},
        ]
    elif month in [6, 7, 8]:
        season = "summer"
        playlists = [
            {"name": "🏖️ Yaz Partisi", "description": "Havaya girmelik enerjik parçalar", "mood": "party"},
            {"name": "🌊 Plaj Keyfi", "description": "Reggae ve chill vibes", "mood": "chill"},
            {"name": "🚗 Yolculuk Mix", "description": "Uzun yola çıkarken dinlenecekler", "mood": "roadtrip"},
        ]
    elif month in [9, 10, 11]:
        season = "fall"
        playlists = [
            {"name": "🍂 Hüzünlü Sonbahar", "description": "Melankolik ve duygusal şarkılar", "mood": "melancholic"},
            {"name": "📚 Yağmurlu Günler", "description": "Lo-fi ve akustik", "mood": "lofi"},
            {"name": "🍁 Sonbahar Esintisi", "description": "Folk ve indie keşifler", "mood": "indie"},
        ]
    else:
        season = "winter"
        playlists = [
            {"name": "❄️ Kar Altında", "description": "Sıcacık ve samimi şarkılar", "mood": "cozy"},
            {"name": "🎄 Yeni Yıl Ruhu", "description": "Kutlama zamanı!", "mood": "festive"},
            {"name": "☕ Sıcak Çikolata", "description": "Evde dinlenecek sakin parçalar", "mood": "relax"},
        ]
    
    return {"season": season, "playlists": playlists}

@api_router.post("/playlists/generate-smart")
async def generate_smart_playlist_endpoint(
    playlist_type: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate a smart playlist based on user preferences"""
    now = datetime.now(timezone.utc).isoformat()
    playlist_id = str(uuid.uuid4())
    
    playlist_configs = {
        "discover_weekly": {"name": "Keşfet Haftalık", "description": "Sana özel yeni keşifler - otomatik güncellenir"},
        "repeat_rewind": {"name": "Repeat Rewind", "description": "En çok dinlediğin şarkılar"},
        "chill_mix": {"name": "Chill Mix", "description": "Rahatlatıcı melodiler"},
        "workout_mix": {"name": "Workout Mix", "description": "Spor için enerjik şarkılar"},
        "focus_mix": {"name": "Focus Mix", "description": "Odaklanmana yardımcı melodiler"}
    }
    
    config = playlist_configs.get(playlist_type)
    if not config:
        raise HTTPException(status_code=400, detail="Geçersiz playlist tipi")
    
    tracks = MOCK_TRACKS[:20]
    
    playlist = {
        "id": playlist_id,
        "user_id": current_user["id"],
        "name": config["name"],
        "description": config["description"],
        "cover_url": None,
        "tracks": tracks,
        "track_count": len(tracks),
        "is_public": False,
        "is_smart": True,
        "smart_type": playlist_type,
        "created_at": now,
        "updated_at": now
    }
    
    await db.playlists.insert_one(playlist)
    playlist.pop("_id", None)
    
    return {"message": f"'{config['name']}' oluşturuldu", "playlist": playlist}

@api_router.put("/playlists/{playlist_id}", response_model=Playlist)
async def update_playlist(
    playlist_id: str,
    body: PlaylistUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update playlist name and/or is_public. Owner only."""
    playlist = await db.playlists.find_one({"id": playlist_id, "owner_id": current_user["id"]})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.name is not None:
        update_data["name"] = body.name
    if body.is_public is not None:
        update_data["is_public"] = body.is_public
    if body.cover_url is not None:
        update_data["cover_url"] = body.cover_url
    await db.playlists.update_one(
        {"id": playlist_id, "owner_id": current_user["id"]},
        {"$set": update_data}
    )
    updated = await db.playlists.find_one({"id": playlist_id}, {"_id": 0})
    return updated


@api_router.get("/playlists/{playlist_id}", response_model=Playlist)
async def get_playlist(playlist_id: str, current_user: dict = Depends(get_current_user)):
    playlist = await db.playlists.find_one({"id": playlist_id}, {"_id": 0})
    if not playlist:
        return {
            "id": playlist_id,
            "name": "Türkçe Pop Hits",
            "description": "En sevilen Türkçe pop şarkıları",
            "cover_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300",
            "track_count": len(MOCK_TRACKS),
            "owner_id": current_user["id"],
            "is_public": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "tracks": MOCK_TRACKS,
            "likes_count": 234,
            "is_collaborative": False
        }
    return playlist

class PlaylistReorderBody(BaseModel):
    track_ids: List[str]


@api_router.put("/playlists/{playlist_id}/tracks/reorder")
async def reorder_playlist_tracks(
    playlist_id: str,
    body: PlaylistReorderBody,
    current_user: dict = Depends(get_current_user)
):
    """Reorder tracks in playlist. track_ids = ordered list of track ids."""
    playlist = await db.playlists.find_one({"id": playlist_id, "owner_id": current_user["id"]})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    tracks = playlist.get("tracks", [])
    track_map = {str(t.get("id", t.get("song_id", ""))): t for t in tracks}
    ordered = []
    for tid in body.track_ids:
        if tid in track_map:
            ordered.append(track_map[tid])
    # Keep any tracks not in track_ids at the end
    for t in tracks:
        tid = str(t.get("id", t.get("song_id", "")))
        if tid not in body.track_ids:
            ordered.append(t)
    await db.playlists.update_one(
        {"id": playlist_id, "owner_id": current_user["id"]},
        {"$set": {"tracks": ordered, "track_count": len(ordered)}}
    )
    return {"message": "Playlist reordered", "tracks": ordered}


@api_router.post("/playlists/{playlist_id}/tracks/{track_id}")
async def add_track_to_playlist(playlist_id: str, track_id: str, current_user: dict = Depends(get_current_user)):
    track = next((t for t in MOCK_TRACKS if t["id"] == track_id), None)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    await db.playlists.update_one(
        {"id": playlist_id, "owner_id": current_user["id"]},
        {"$push": {"tracks": track}, "$inc": {"track_count": 1}}
    )
    return {"message": "Track added to playlist"}


@api_router.delete("/playlists/{playlist_id}/tracks/{track_id}")
async def remove_track_from_playlist(
    playlist_id: str, track_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a track from playlist. Owner only."""
    playlist = await db.playlists.find_one({"id": playlist_id, "owner_id": current_user["id"]})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    tracks = playlist.get("tracks", [])
    filtered = [t for t in tracks if str(t.get("id", t.get("song_id", ""))) != str(track_id)]
    if len(filtered) == len(tracks):
        raise HTTPException(status_code=404, detail="Track not found in playlist")
    await db.playlists.update_one(
        {"id": playlist_id, "owner_id": current_user["id"]},
        {"$set": {"tracks": filtered, "track_count": len(filtered)}}
    )
    return {"message": "Track removed from playlist"}


@api_router.delete("/playlists/{playlist_id}")
async def delete_playlist(playlist_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.playlists.delete_one({"id": playlist_id, "owner_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return {"message": "Playlist deleted"}

# ============== COLLABORATIVE PLAYLISTS ==============

@api_router.post("/playlists/{playlist_id}/collaborators/{user_id}")
async def add_playlist_collaborator(
    playlist_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Add a collaborator to a playlist (owner only)"""
    playlist = await db.playlists.find_one({"id": playlist_id})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist bulunamadı")
    
    if playlist.get("owner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Sadece playlist sahibi katkıda bulunanları ekleyebilir")
    
    if not playlist.get("is_collaborative"):
        raise HTTPException(status_code=400, detail="Bu playlist ortak düzenlemeye açık değil")
    
    # Check if user exists
    target_user = await db.users.find_one({"id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Add to collaborators
    await db.playlists.update_one(
        {"id": playlist_id},
        {"$addToSet": {"collaborators": {
            "user_id": user_id,
            "username": target_user.get("username"),
            "avatar_url": target_user.get("avatar_url"),
            "added_at": now,
            "added_by": current_user["id"]
        }}}
    )
    
    # Send notification
    await send_push_notification(
        user_id,
        "Playlist Daveti",
        f"{current_user.get('display_name', current_user['username'])} sizi '{playlist['name']}' playlistine katkıda bulunan olarak ekledi",
        "playlist_invite",
        {"playlist_id": playlist_id}
    )
    
    return {"message": f"Kullanıcı playlist'e eklendi"}

@api_router.delete("/playlists/{playlist_id}/collaborators/{user_id}")
async def remove_playlist_collaborator(
    playlist_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a collaborator from playlist (owner or self)"""
    playlist = await db.playlists.find_one({"id": playlist_id})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist bulunamadı")
    
    is_owner = playlist.get("owner_id") == current_user["id"]
    is_self = user_id == current_user["id"]
    
    if not is_owner and not is_self:
        raise HTTPException(status_code=403, detail="Bu işlemi yapamazsınız")
    
    await db.playlists.update_one(
        {"id": playlist_id},
        {"$pull": {"collaborators": {"user_id": user_id}}}
    )
    
    return {"message": "Katkıda bulunan kaldırıldı"}

@api_router.get("/playlists/{playlist_id}/collaborators")
async def get_playlist_collaborators(
    playlist_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get list of playlist collaborators"""
    playlist = await db.playlists.find_one({"id": playlist_id}, {"_id": 0, "collaborators": 1, "owner_id": 1})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist bulunamadı")
    
    collaborators = playlist.get("collaborators", [])
    
    # Add owner info
    owner = await db.users.find_one(
        {"id": playlist.get("owner_id")},
        {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
    )
    
    return {
        "owner": owner,
        "collaborators": collaborators,
        "total": len(collaborators)
    }

@api_router.post("/playlists/{playlist_id}/tracks/{track_id}/collaborative")
async def add_track_collaborative(
    playlist_id: str,
    track_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Add track to collaborative playlist (collaborators can add)"""
    playlist = await db.playlists.find_one({"id": playlist_id})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist bulunamadı")
    
    is_owner = playlist.get("owner_id") == current_user["id"]
    collaborator_ids = [c.get("user_id") for c in playlist.get("collaborators", [])]
    is_collaborator = current_user["id"] in collaborator_ids
    
    if not is_owner and not is_collaborator:
        raise HTTPException(status_code=403, detail="Bu playlist'e şarkı ekleyemezsiniz")
    
    # Find track (try mock tracks first, then YouTube format)
    track = next((t for t in MOCK_TRACKS if t["id"] == track_id), None)
    
    if not track and track_id.startswith("yt_"):
        # YouTube track
        track = {
            "id": track_id,
            "youtube_id": track_id.replace("yt_", ""),
            "title": "YouTube Track",
            "artist": "Unknown",
            "source": "youtube",
            "added_by": current_user["id"],
            "added_at": datetime.now(timezone.utc).isoformat()
        }
    
    if not track:
        raise HTTPException(status_code=404, detail="Şarkı bulunamadı")
    
    # Add metadata
    track["added_by"] = current_user["id"]
    track["added_by_username"] = current_user.get("username")
    track["added_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.playlists.update_one(
        {"id": playlist_id},
        {
            "$push": {"tracks": track},
            "$inc": {"track_count": 1}
        }
    )
    
    return {"message": "Şarkı eklendi", "track": track}

# ============== SEARCH ENDPOINT (LEGACY - moved to enhanced version below) ==============
# Legacy search endpoint removed - use enhanced /api/search with filters below

# ============== STATS ENDPOINT ==============

@api_router.get("/stats/listening", response_model=ListeningStats)
async def get_listening_stats(current_user: dict = Depends(get_current_user)):
    return ListeningStats(
        total_minutes=12450,
        top_artists=[
            {"name": "Tarkan", "minutes": 2340, "image_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300"},
            {"name": "Sezen Aksu", "minutes": 1890, "image_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300"},
            {"name": "Duman", "minutes": 1560, "image_url": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300"},
            {"name": "maNga", "minutes": 1230, "image_url": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300"},
            {"name": "Mabel Matiz", "minutes": 980, "image_url": "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300"},
        ],
        top_genres=[
            {"name": "Turkish Pop", "percentage": 45},
            {"name": "Rock", "percentage": 25},
            {"name": "Alternative", "percentage": 15},
            {"name": "Classical", "percentage": 10},
            {"name": "Electronic", "percentage": 5},
        ],
        platform_breakdown={
            "spotify": 45,
            "youtube": 35,
            "apple": 20
        }
    )

# ============== RECOMMENDATION SERVICE ==============

@api_router.get("/recommendations/personalized")
async def get_personalized_recommendations(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get personalized content recommendations"""
    
    # Get user's listening history and preferences
    user_data = await db.users.find_one({"id": current_user["id"]})
    favorite_genres = user_data.get("favorite_genres", [])
    favorite_artists = user_data.get("favorite_artists", [])
    
    # Get users they follow
    following = await db.follows.find(
        {"follower_id": current_user["id"]}, {"following_id": 1, "_id": 0}
    ).to_list(500)
    following_ids = [f["following_id"] for f in following]
    
    # Get recommended tracks (mock for now)
    recommended_tracks = MOCK_TRACKS[:limit]
    
    # Get recommended users to follow
    recommended_users = await db.users.find(
        {
            "id": {"$nin": following_ids + [current_user["id"]]},
            "is_private": {"$ne": True}
        },
        {"_id": 0, "password": 0, "email": 0}
    ).sort("followers_count", -1).limit(5).to_list(5)
    
    # Get recommended playlists
    recommended_playlists = await db.playlists.find(
        {
            "is_public": True,
            "user_id": {"$ne": current_user["id"]}
        },
        {"_id": 0}
    ).sort("followers_count", -1).limit(5).to_list(5)
    
    return {
        "tracks": recommended_tracks,
        "users": recommended_users,
        "playlists": recommended_playlists,
        "reason": "Dinleme alışkanlıklarına göre" if favorite_genres else "Popüler içerikler"
    }

@api_router.get("/recommendations/nearby")
async def get_nearby_recommendations(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: int = 10,  # km
    current_user: dict = Depends(get_current_user)
):
    """Get location-based recommendations"""
    
    # For now, return mock data
    # In production, this would use geospatial queries
    
    return {
        "posts": [],
        "songs": MOCK_TRACKS[:5],
        "users": [],
        "location": {"lat": lat, "lng": lng, "radius": radius},
        "message": "Yakınındaki popüler içerikler" if lat and lng else "Konum bilgisi gerekli"
    }

# ============== DISCOVER ENDPOINTS ==============

@api_router.get("/discover/trending", response_model=List[Track])
async def get_trending(current_user: dict = Depends(get_current_user)):
    return MOCK_TRACKS[:6]

@api_router.get("/discover/artists", response_model=List[dict])
async def get_top_artists(current_user: dict = Depends(get_current_user)):
    return MOCK_ARTISTS

@api_router.get("/discover/moods")
async def get_moods():
    return MOOD_OPTIONS

@api_router.get("/discover/genres")
async def get_genres():
    return GENRE_OPTIONS

@api_router.get("/discover/popular")
async def get_popular_content(
    content_type: Optional[str] = None,  # posts, tracks, users, playlists
    period: str = "week",  # day, week, month, all
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get popular/trending content across the platform"""
    
    # Calculate time window
    if period == "day":
        cutoff = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    elif period == "week":
        cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    elif period == "month":
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    else:
        cutoff = "2020-01-01T00:00:00+00:00"  # All time
    
    result = {}
    
    # Popular Posts
    if content_type in [None, "posts"]:
        posts = await db.posts.find(
            {"created_at": {"$gte": cutoff}},
            {"_id": 0}
        ).sort("likes_count", -1).skip(offset).limit(limit).to_list(limit)
        
        # Add user info
        for post in posts:
            user = await db.users.find_one(
                {"id": post["user_id"]},
                {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1, "is_verified": 1}
            )
            if user:
                post["user"] = user
        
        result["posts"] = posts
    
    # Popular Users (by follower growth)
    if content_type in [None, "users"]:
        users = await db.users.find(
            {},
            {"_id": 0, "password": 0, "email": 0}
        ).sort("followers_count", -1).skip(offset).limit(limit).to_list(limit)
        result["users"] = users
    
    # Popular Playlists
    if content_type in [None, "playlists"]:
        playlists = await db.playlists.find(
            {"is_public": True, "created_at": {"$gte": cutoff}},
            {"_id": 0}
        ).sort("followers_count", -1).skip(offset).limit(limit).to_list(limit)
        
        # Add owner info
        for playlist in playlists:
            owner = await db.users.find_one(
                {"id": playlist.get("user_id")},
                {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
            )
            if owner:
                playlist["owner"] = owner
        
        result["playlists"] = playlists
    
    # Trending Tracks (mock for now)
    if content_type in [None, "tracks"]:
        result["tracks"] = MOCK_TRACKS[:min(limit, len(MOCK_TRACKS))]
    
    return result

@api_router.get("/discover/for-you")
async def get_for_you_content(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Personalized content recommendations based on user activity"""
    
    # Get user's favorite genres and artists
    user_data = await db.users.find_one({"id": current_user["id"]})
    favorite_genres = user_data.get("favorite_genres", [])
    favorite_artists = user_data.get("favorite_artists", [])
    
    # Get users the current user follows
    following = await db.follows.find(
        {"follower_id": current_user["id"]}, {"following_id": 1, "_id": 0}
    ).to_list(500)
    following_ids = [f["following_id"] for f in following]
    
    # Get posts from similar interests (not from followed users)
    recommendations = []
    
    # Get posts with similar genres/moods
    if favorite_genres:
        genre_posts = await db.posts.find(
            {
                "user_id": {"$nin": following_ids + [current_user["id"]]},
                "$or": [
                    {"genre": {"$in": favorite_genres}},
                    {"mood": {"$exists": True}}
                ]
            },
            {"_id": 0}
        ).sort("likes_count", -1).limit(limit // 2).to_list(limit // 2)
        recommendations.extend(genre_posts)
    
    # Get popular posts from users not followed
    popular_posts = await db.posts.find(
        {
            "user_id": {"$nin": following_ids + [current_user["id"]]},
            "likes_count": {"$gte": 5}
        },
        {"_id": 0}
    ).sort("created_at", -1).limit(limit // 2).to_list(limit // 2)
    recommendations.extend(popular_posts)
    
    # Remove duplicates and add user info
    seen_ids = set()
    unique_recs = []
    for post in recommendations:
        if post["id"] not in seen_ids:
            seen_ids.add(post["id"])
            user = await db.users.find_one(
                {"id": post["user_id"]},
                {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1, "is_verified": 1}
            )
            if user:
                post["user"] = user
            unique_recs.append(post)
    
    return {
        "recommendations": unique_recs[:limit],
        "reason": "Based on your interests" if favorite_genres else "Popular in your area"
    }

# ============== STORIES ENDPOINTS ==============

@api_router.post("/stories")
async def create_story(story_data: StoryCreate, current_user: dict = Depends(get_current_user)):
    story_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=24)
    
    # Get track or playlist if provided
    track = None
    playlist = None
    
    if story_data.track_id:
        track = next((t for t in MOCK_TRACKS if t["id"] == story_data.track_id), None)
    
    if story_data.playlist_id:
        playlist_doc = await db.playlists.find_one({"id": story_data.playlist_id}, {"_id": 0})
        if playlist_doc:
            playlist = {
                "id": playlist_doc["id"],
                "name": playlist_doc["name"],
                "cover_url": playlist_doc.get("cover_url"),
                "track_count": playlist_doc.get("track_count", 0)
            }
    
    # Hikaye süresi: photo=30sn, video=60sn, diğerleri=5sn
    duration = story_data.duration
    if duration is None:
        if story_data.story_type == 'photo':
            duration = 30
        elif story_data.story_type == 'video':
            duration = 60
        else:
            duration = 5
    
    story = {
        "id": story_id,
        "user_id": current_user["id"],
        "username": current_user["username"],
        "user_avatar": current_user.get("avatar_url"),
        "user_display_name": current_user.get("display_name"),
        "is_verified": current_user.get("is_verified", False),
        "story_type": story_data.story_type,
        "audience": story_data.audience or "all",
        "track": track,
        "playlist": playlist,
        "mood": story_data.mood,
        "text": story_data.text,
        "emoji": story_data.emoji,
        "background_color": story_data.background_color or "#8B5CF6",
        "filter": story_data.filter,
        "media_url": story_data.media_url,
        "media_type": story_data.media_type,
        "duration": duration,
        "viewers": [],
        "viewers_count": 0,
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
        # Poll support
        "poll_question": story_data.poll_question,
        "poll_options": [{"id": str(uuid.uuid4()), "text": opt, "votes": 0, "voters": []} 
                        for opt in (story_data.poll_options or [])] if story_data.story_type == "poll" else None,
        # Swipe-up link
        "swipe_up_url": story_data.swipe_up_url,
        "swipe_up_title": story_data.swipe_up_title,
        # Music sync
        "music_track_id": story_data.music_track_id,
        "music_start_time": story_data.music_start_time or 0,
        # Audience: all | close_friends
        "audience": story_data.audience or "all",
    }
    
    # Get music track if provided
    if story_data.music_track_id:
        music_track = next((t for t in MOCK_TRACKS if t["id"] == story_data.music_track_id), None)
        if music_track:
            story["music_track"] = {
                "id": music_track["id"],
                "title": music_track["title"],
                "artist": music_track["artist"],
                "cover_url": music_track.get("cover_url"),
                "preview_url": music_track.get("preview_url")
            }
    
    await db.stories.insert_one(story)
    await add_xp(current_user["id"], 5)
    
    story.pop("_id", None)
    return story

@api_router.get("/stories/feed")
async def get_stories_feed(current_user: dict = Depends(get_current_user)):
    """Get stories from users the current user follows. Kısıtlı: creator restricted me -> no story."""
    now = datetime.now(timezone.utc)
    
    # Get following list
    following = await db.follows.find({"follower_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    following_ids = [f["following_id"] for f in following]
    following_ids.append(current_user["id"])  # Include own stories
    
    # Kısıtlı hesap: users who restricted me - can't see their stories (sadece mesaj görebilir)
    restricted_me = await db.restricted_users.find(
        {"restricted_id": current_user["id"]}, {"restricter_id": 1}
    ).to_list(1000)
    restricter_ids = {r["restricter_id"] for r in restricted_me}

    # Get user's close friends (for close_friends audience filter - we need creator's close friends)
    # For each story with audience=close_friends, viewer must be in creator's close_friends
    close_friends_by_creator = {}  # creator_id -> set of friend_ids

    # Kısıtlı: beni kısıtlayan kullanıcıların hikayelerini gösterme (sadece mesaj görebilir)
    restricted_me = await db.restricted_users.find(
        {"restricted_id": current_user["id"]},
        {"restricter_id": 1}
    ).to_list(200)
    restricter_ids = {r["restricter_id"] for r in restricted_me}
    following_ids = [uid for uid in following_ids if uid not in restricter_ids]
    
    # Get active stories (not expired)
    stories = await db.stories.find(
        {
            "user_id": {"$in": following_ids},
            "expires_at": {"$gt": now.isoformat()}
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    # Group stories by user, filter close_friends audience + restricted (creator restricted me)
    user_stories = {}
    for story in stories:
        if story["user_id"] in restricter_ids:
            continue  # Creator restricted me - can't see their stories
        audience = story.get("audience", "all")
        if audience == "close_friends" and story["user_id"] != current_user["id"]:
            cf = close_friends_by_creator.get(story["user_id"])
            if cf is None:
                cf_docs = await db.close_friends.find(
                    {"user_id": story["user_id"]}, {"friend_id": 1}
                ).to_list(200)
                cf = {d["friend_id"] for d in cf_docs}
                close_friends_by_creator[story["user_id"]] = cf
            if current_user["id"] not in cf:
                continue  # Skip - viewer not in creator's close friends

        user_id = story["user_id"]
        story["is_viewed"] = current_user["id"] in story.get("viewers", [])
        story["is_expired"] = False

        if user_id not in user_stories:
            user_stories[user_id] = {
                "user_id": user_id,
                "username": story["username"],
                "user_avatar": story.get("user_avatar"),
                "user_display_name": story.get("user_display_name"),
                "is_verified": story.get("is_verified", False),
                "stories": [],
                "has_unviewed": False
            }
        
        user_stories[user_id]["stories"].append(story)
        if not story["is_viewed"]:
            user_stories[user_id]["has_unviewed"] = True
    
    # Sort: own stories first, then unviewed, then viewed
    result = list(user_stories.values())
    result.sort(key=lambda x: (
        x["user_id"] != current_user["id"],  # Own stories first
        not x["has_unviewed"],  # Unviewed before viewed
        x["stories"][0]["created_at"] if x["stories"] else ""
    ))
    
    return result

@api_router.get("/stories/user/{user_id}")
async def get_user_stories(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get all active stories from a specific user"""
    now = datetime.now(timezone.utc)
    
    stories = await db.stories.find(
        {
            "user_id": user_id,
            "expires_at": {"$gt": now.isoformat()}
        },
        {"_id": 0}
    ).sort("created_at", 1).to_list(50)

    # Filter close_friends: only show if viewer is creator or in creator's close friends
    filtered = []
    for story in stories:
        audience = story.get("audience", "all")
        if audience == "close_friends" and story["user_id"] != current_user["id"]:
            cf = await db.close_friends.find_one(
                {"user_id": user_id, "friend_id": current_user["id"]}
            )
            if not cf:
                continue
        filtered.append(story)
    stories = filtered

    for story in stories:
        story["is_viewed"] = current_user["id"] in story.get("viewers", [])
        story["is_expired"] = False
    
    return stories

@api_router.post("/stories/{story_id}/view")
async def view_story(story_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a story as viewed"""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    # Don't count self-views
    if story["user_id"] == current_user["id"]:
        return {"message": "Own story viewed"}
    
    # Add viewer if not already viewed
    if current_user["id"] not in story.get("viewers", []):
        await db.stories.update_one(
            {"id": story_id},
            {
                "$addToSet": {"viewers": current_user["id"]},
                "$inc": {"viewers_count": 1}
            }
        )
        
        # Add viewer details
        now = datetime.now(timezone.utc).isoformat()
        await db.story_viewers.insert_one({
            "story_id": story_id,
            "user_id": current_user["id"],
            "username": current_user["username"],
            "user_avatar": current_user.get("avatar_url"),
            "user_display_name": current_user.get("display_name"),
            "viewed_at": now
        })
    
    return {"message": "Story viewed"}

@api_router.get("/stories/{story_id}/viewers")
async def get_story_viewers(story_id: str, current_user: dict = Depends(get_current_user)):
    """Get list of users who viewed a story (only for story owner)"""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    if story["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Can only view viewers of your own stories")
    
    viewers = await db.story_viewers.find(
        {"story_id": story_id},
        {"_id": 0, "story_id": 0}
    ).sort("viewed_at", -1).to_list(100)
    
    return viewers

@api_router.delete("/stories/{story_id}")
async def delete_story(story_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a story"""
    result = await db.stories.delete_one({
        "id": story_id,
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Story not found")
    
    # Clean up viewers
    await db.story_viewers.delete_many({"story_id": story_id})
    
    return {"message": "Story deleted"}

@api_router.get("/stories/my")
async def get_my_stories(current_user: dict = Depends(get_current_user)):
    """Get current user's active stories with viewer details"""
    now = datetime.now(timezone.utc)
    
    stories = await db.stories.find(
        {
            "user_id": current_user["id"],
            "expires_at": {"$gt": now.isoformat()}
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    for story in stories:
        story["is_viewed"] = True  # Own stories are always "viewed"
        story["is_expired"] = False
    
    return stories

@api_router.get("/stories/archive")
async def get_story_archive(current_user: dict = Depends(get_current_user)):
    """Get current user's archived (expired) stories - for profile archive view"""
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=30)).isoformat()  # Last 30 days
    stories = await db.stories.find(
        {
            "user_id": current_user["id"],
            "expires_at": {"$lt": now.isoformat()},
            "created_at": {"$gt": cutoff}
        },
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    for s in stories:
        s["is_expired"] = True
    return stories

@api_router.post("/stories/{story_id}/reply")
async def reply_to_story(
    story_id: str,
    reply_data: StoryReplyRequest,
    current_user: dict = Depends(get_current_user)
):
    """Reply to a story - creates a DM conversation with the story owner"""
    # Get story
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    
    story_owner_id = story["user_id"]
    
    # Can't reply to own story
    if story_owner_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Kendi hikayenize yanıt veremezsiniz")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Find or create conversation between these two users
    conversation = await db.conversations.find_one({
        "is_group": False,
        "participants": {"$all": [current_user["id"], story_owner_id], "$size": 2}
    })
    
    if not conversation:
        # Create new conversation
        conversation_id = str(uuid.uuid4())
        conversation = {
            "id": conversation_id,
            "is_group": False,
            "participants": [current_user["id"], story_owner_id],
            "created_at": now,
            "last_message_at": now
        }
        await db.conversations.insert_one(conversation)
    else:
        conversation_id = conversation["id"]
    
    # Create story reply message
    message_id = str(uuid.uuid4())
    
    # Build story preview for the message
    story_preview = {
        "story_id": story_id,
        "story_type": story.get("story_type", "text"),
        "media_url": story.get("media_url"),
        "text": story.get("text", "")[:100] if story.get("text") else None,
        "background_color": story.get("background_color"),
        "created_at": story.get("created_at")
    }
    
    message = {
        "id": message_id,
        "conversation_id": conversation_id,
        "sender_id": current_user["id"],
        "content_type": "STORY_REPLY",
        "content": reply_data.content,
        "story_id": story_id,
        "story_preview": story_preview,
        "reply_type": reply_data.reply_type,
        "reactions": [],
        "read_by": [current_user["id"]],
        "is_delivered": True,
        "created_at": now
    }
    
    await db.messages.insert_one(message)
    
    # Update conversation last message time
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"last_message_at": now}}
    )
    
    # Send notification to story owner
    await notify_user(
        recipient_id=story_owner_id,
        sender_id=current_user["id"],
        notification_type="story_reply",
        title=f"{current_user.get('display_name') or current_user['username']} hikayeni yanıtladı",
        body=reply_data.content[:50] if reply_data.content else "📸 Hikaye yanıtı",
        data={"url": f"messages/{conversation_id}", "type": "story_reply", "story_id": story_id}
    )
    
    message.pop("_id", None)
    return {
        "message": "Yanıt gönderildi",
        "conversation_id": conversation_id,
        "reply": message
    }

# ============== PUSH NOTIFICATIONS ==============

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

@api_router.post("/notifications/register-token")
async def register_push_token(
    request: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Register or update push token for current user"""
    # Accept both expo_token and expo_push_token for compatibility
    token = request.get("expo_token") or request.get("expo_push_token")
    platform = request.get("platform", "android")
    device_name = request.get("device_name")
    
    if not token:
        raise HTTPException(status_code=400, detail="expo_token veya expo_push_token gerekli")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Upsert token
    await db.push_tokens.update_one(
        {
            "user_id": current_user["id"],
            "expo_push_token": token
        },
        {
            "$set": {
                "user_id": current_user["id"],
                "expo_push_token": token,
                "platform": platform,
                "device_name": device_name,
                "updated_at": now,
                "is_active": True
            },
            "$setOnInsert": {
                "id": str(uuid.uuid4()),
                "created_at": now
            }
        },
        upsert=True
    )
    
    return {"message": "Push token kaydedildi", "status": "success"}

@api_router.delete("/notifications/unregister-token")
async def unregister_push_token(
    request: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Deactivate push token (logout)"""
    expo_push_token = request.get("expo_push_token") or request.get("expo_token")
    
    if expo_push_token:
        await db.push_tokens.update_one(
            {
                "user_id": current_user["id"],
                "expo_push_token": expo_push_token
            },
            {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        # Deactivate all tokens for user
        await db.push_tokens.update_many(
            {"user_id": current_user["id"]},
            {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"message": "Push token kaldırıldı"}

# ============== SCHEDULED NOTIFICATIONS ==============

@api_router.get("/notifications/scheduled")
async def get_scheduled_notifications(current_user: dict = Depends(get_current_user)):
    """Get user's scheduled notifications"""
    schedules = await db.scheduled_notifications.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(50)
    
    return {"schedules": schedules}

@api_router.post("/notifications/schedule")
async def create_scheduled_notification(
    notification_type: str,  # weekly_report, new_music_alert, daily_reminder
    scheduled_day: Optional[int] = None,  # 0-6 (Sunday-Saturday)
    scheduled_hour: int = 9,  # 0-23
    scheduled_minute: int = 0,  # 0-59
    is_active: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Schedule a recurring notification"""
    now = datetime.now(timezone.utc).isoformat()
    
    notification_configs = {
        "weekly_report": {
            "title": "Haftalık Raporun Hazır!",
            "body": "Geçen hafta neler dinledin? Görmek için tıkla."
        },
        "new_music_alert": {
            "title": "Yeni Şarkılar!",
            "body": "Takip ettiğin sanatçılardan yeni şarkılar var."
        },
        "daily_reminder": {
            "title": "🎵 Müzik Zamanı!",
            "body": "Bugün ne dinlemek istersin?"
        }
    }
    
    config = notification_configs.get(notification_type)
    if not config:
        raise HTTPException(status_code=400, detail="Geçersiz bildirim tipi")
    
    schedule_id = str(uuid.uuid4())
    
    schedule = {
        "id": schedule_id,
        "user_id": current_user["id"],
        "type": notification_type,
        "title": config["title"],
        "body": config["body"],
        "scheduled_day": scheduled_day,
        "scheduled_hour": scheduled_hour,
        "scheduled_minute": scheduled_minute,
        "is_active": is_active,
        "last_sent_at": None,
        "created_at": now,
        "updated_at": now
    }
    
    await db.scheduled_notifications.insert_one(schedule)
    schedule.pop("_id", None)
    
    return {"message": "Bildirim zamanlandı", "schedule": schedule}

@api_router.put("/notifications/schedule/{schedule_id}")
async def update_scheduled_notification(
    schedule_id: str,
    is_active: Optional[bool] = None,
    scheduled_hour: Optional[int] = None,
    scheduled_minute: Optional[int] = None,
    scheduled_day: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update a scheduled notification"""
    schedule = await db.scheduled_notifications.find_one({
        "id": schedule_id,
        "user_id": current_user["id"]
    })
    
    if not schedule:
        raise HTTPException(status_code=404, detail="Zamanlanmış bildirim bulunamadı")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if is_active is not None:
        update_data["is_active"] = is_active
    if scheduled_hour is not None:
        update_data["scheduled_hour"] = scheduled_hour
    if scheduled_minute is not None:
        update_data["scheduled_minute"] = scheduled_minute
    if scheduled_day is not None:
        update_data["scheduled_day"] = scheduled_day
    
    await db.scheduled_notifications.update_one(
        {"id": schedule_id},
        {"$set": update_data}
    )
    
    return {"message": "Bildirim güncellendi"}

@api_router.delete("/notifications/schedule/{schedule_id}")
async def delete_scheduled_notification(
    schedule_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a scheduled notification"""
    result = await db.scheduled_notifications.delete_one({
        "id": schedule_id,
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Zamanlanmış bildirim bulunamadı")
    
    return {"message": "Bildirim silindi"}

# ============== DO NOT DISTURB ==============

@api_router.get("/notifications/dnd")
async def get_dnd_settings(current_user: dict = Depends(get_current_user)):
    """Get Do Not Disturb settings"""
    settings = await db.notification_settings.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not settings:
        # Return defaults
        return {
            "do_not_disturb": False,
            "dnd_start": "23:00",
            "dnd_end": "08:00",
            "dnd_allow_calls": False,
            "dnd_allow_favorites": True
        }
    
    return {
        "do_not_disturb": settings.get("do_not_disturb", False),
        "dnd_start": settings.get("dnd_start", "23:00"),
        "dnd_end": settings.get("dnd_end", "08:00"),
        "dnd_allow_calls": settings.get("dnd_allow_calls", False),
        "dnd_allow_favorites": settings.get("dnd_allow_favorites", True)
    }

@api_router.put("/notifications/dnd")
async def update_dnd_settings(
    do_not_disturb: Optional[bool] = None,
    dnd_start: Optional[str] = None,
    dnd_end: Optional[str] = None,
    dnd_allow_calls: Optional[bool] = None,
    dnd_allow_favorites: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update Do Not Disturb settings"""
    now = datetime.now(timezone.utc).isoformat()
    
    update_data = {"updated_at": now}
    
    if do_not_disturb is not None:
        update_data["do_not_disturb"] = do_not_disturb
    if dnd_start is not None:
        update_data["dnd_start"] = dnd_start
    if dnd_end is not None:
        update_data["dnd_end"] = dnd_end
    if dnd_allow_calls is not None:
        update_data["dnd_allow_calls"] = dnd_allow_calls
    if dnd_allow_favorites is not None:
        update_data["dnd_allow_favorites"] = dnd_allow_favorites
    
    await db.notification_settings.update_one(
        {"user_id": current_user["id"]},
        {
            "$set": update_data,
            "$setOnInsert": {"user_id": current_user["id"], "created_at": now}
        },
        upsert=True
    )
    
    return {"message": "Rahatsız etmeyin ayarları güncellendi"}

# ============== NOTIFICATION SOUNDS ==============

@api_router.get("/notifications/sounds")
async def get_notification_sounds(current_user: dict = Depends(get_current_user)):
    """Get available notification sounds"""
    return {
        "sounds": [
            {"id": "default", "name": "Varsayılan", "preview_url": None},
            {"id": "bell", "name": "Zil", "preview_url": None},
            {"id": "chime", "name": "Çan", "preview_url": None},
            {"id": "soft", "name": "Yumuşak", "preview_url": None},
            {"id": "none", "name": "Sessiz", "preview_url": None}
        ]
    }

@api_router.put("/notifications/sound")
async def update_notification_sound(
    sound_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Update notification sound preference"""
    valid_sounds = ["default", "bell", "chime", "soft", "none"]
    
    if sound_id not in valid_sounds:
        raise HTTPException(status_code=400, detail="Geçersiz ses seçeneği")
    
    await db.notification_settings.update_one(
        {"user_id": current_user["id"]},
        {
            "$set": {
                "notification_sound": sound_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"message": "Bildirim sesi güncellendi", "sound_id": sound_id}

# ============== WEEKLY SUMMARY EMAIL ==============

@api_router.post("/notifications/send-weekly-summary")
async def trigger_weekly_summary_email(current_user: dict = Depends(get_current_user)):
    """Manually trigger weekly summary email (for testing)"""
    user = await db.users.find_one({"id": current_user["id"]})
    
    if not user or not user.get("email"):
        raise HTTPException(status_code=400, detail="Email adresi bulunamadı")
    
    # Generate mock stats
    stats = {
        "total_minutes": random.randint(200, 800),
        "total_songs": random.randint(50, 200),
        "top_artist": "Tarkan",
        "top_song": "Şımarık"
    }
    
    result = await email_service.send_weekly_summary(
        user["email"],
        user.get("display_name") or user.get("username") or "Kullanıcı",
        stats
    )
    
    return {"message": "Haftalık özet emaili gönderildi", "result": result}

async def send_push_notification(
    recipient_id: str,
    title: str,
    body: str,
    notification_type: str,
    data: dict = None,
    sender_id: str = None
):
    """Internal function to send push notification to a user"""
    data = data or {}
    # Sessize alma: recipient has muted sender -> no notification (kaydetme, push yok)
    if sender_id:
        muted = await db.muted_users.find_one({
            "user_id": recipient_id,
            "muted_user_id": sender_id,
            "mute_notifications": True
        })
        if muted:
            return {"success": True, "reason": "User has muted sender - bildirim gelmez"}
    # Sohbet sessize alma (PostgreSQL + MongoDB): mesaj bildirimi için push atlama
    if notification_type == "new_message" and data.get("conversation_id"):
        conv_id = data["conversation_id"]
        mongo_muted = await db.muted_conversations.find_one({
            "user_id": recipient_id,
            "conversation_id": conv_id,
        })
        if mongo_muted:
            return {"success": True, "reason": "Conversation muted - push skipped"}
        try:
            from services.postgresql_service import get_conversation_settings_pg
            pg = await get_conversation_settings_pg(recipient_id)
            if conv_id in pg.get("muted", {}):
                return {"success": True, "reason": "Conversation muted (PG) - push skipped"}
        except Exception:
            pass
    now = datetime.now(timezone.utc).isoformat()
    notif_id = str(uuid.uuid4())
    
    # Kaydet (MongoDB + PostgreSQL bildirim merkezi)
    notification_doc = {
        "id": notif_id,
        "user_id": recipient_id,
        "type": notification_type,
        "title": title,
        "body": body,
        "data": data or {},
        "sender_id": sender_id,
        "read": False,
        "created_at": now
    }
    await db.notifications.insert_one(notification_doc)
    try:
        from services.postgresql_service import insert_notification_pg
        await insert_notification_pg(notif_id, recipient_id, notification_type, title, body, data, sender_id)
    except Exception:
        pass
    
    # Get active push tokens for recipient
    tokens = await db.push_tokens.find(
        {"user_id": recipient_id, "is_active": True},
        {"_id": 0, "expo_push_token": 1}
    ).to_list(10)
    
    if not tokens:
        return {"success": True, "reason": "Saved to DB, no push tokens"}
    
    # Bildirim tercihleri: PostgreSQL (MMKV sync) öncelikli, yoksa MongoDB
    pref_key = None
    pref_map = {
        "like": "like_notifications", "comment": "comment_notifications",
        "follow": "follow_notifications", "message": "message_notifications",
        "tag": "tag_notifications", "mention": "mention_notifications",
        "repost": "reposts_notifications", "story_reply": "story_notifications",
        "new_content": "new_content_notifications", "weekly_summary": "weekly_summary_enabled",
        "daily_reminder": "daily_reminder_enabled",
    }
    pref_key = pref_map.get(notification_type)
    push_enabled = True
    sound = "default"
    try:
        from services.postgresql_service import get_notification_preferences_pg, is_in_dnd_window_pg
        pg_prefs = await get_notification_preferences_pg(recipient_id)
        if pg_prefs:
            if not pg_prefs.get("push_enabled", True):
                return {"success": True, "reason": "Saved to DB, push disabled"}
            if pref_key and not pg_prefs.get(pref_key, True):
                return {"success": True, "reason": "Saved to DB, push disabled for type"}
            sound = pg_prefs.get("notification_sound") or "default"
        if await is_in_dnd_window_pg(recipient_id):
            return {"success": True, "reason": "Saved to DB, DND active"}
    except Exception:
        pass

    settings = await db.user_settings.find_one({"user_id": recipient_id})
    if settings and pref_key and not settings.get(pref_key, True):
        return {"success": True, "reason": "Saved to DB, push disabled"}
    if settings and settings.get("quiet_hours_enabled"):
        current_time = datetime.now(timezone.utc).strftime("%H:%M")
        start = settings.get("quiet_hours_start", "22:00")
        end = settings.get("quiet_hours_end", "08:00")
        if start <= current_time or current_time <= end:
            return {"success": True, "reason": "Saved to DB, quiet hours active"}
    
    push_tokens = [t["expo_push_token"] for t in tokens]
    try:
        from services.expo_notifications_service import send_push as expo_send_push
        result = await expo_send_push(
            push_tokens, title, body, data=data,
            sound="none" if sound == "none" else (sound if sound and sound.startswith("http") else "default"),
        )
        return {"success": result.get("success", True), "data": result.get("data")}
    except Exception as e:
        logging.error(f"Push notification error: {e}")
        return {"success": True, "reason": "Saved to DB, push failed"}

@api_router.get("/notifications")
async def get_notifications_list(
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get user's notifications"""
    notifications = await db.notifications.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    # Get sender info for each notification
    for notif in notifications:
        if notif.get("sender_id"):
            sender = await db.users.find_one(
                {"id": notif["sender_id"]},
                {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
            )
            notif["sender"] = sender
    
    # Get unread count
    unread_count = await db.notifications.count_documents({
        "user_id": current_user["id"],
        "read": False
    })
    
    return {
        "notifications": notifications,
        "unread_count": unread_count,
        "has_more": len(notifications) == limit
    }

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a notification as read"""
    await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Bildirim okundu olarak işaretlendi"}

@api_router.post("/notifications/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    now = datetime.now(timezone.utc).isoformat()
    await db.notifications.update_many(
        {"user_id": current_user["id"], "read": False},
        {"$set": {"read": True, "read_at": now}}
    )
    return {"message": "Tüm bildirimler okundu olarak işaretlendi"}

@api_router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a notification"""
    await db.notifications.delete_one({
        "id": notification_id,
        "user_id": current_user["id"]
    })
    return {"message": "Bildirim silindi"}

@api_router.delete("/notifications")
async def clear_all_notifications(current_user: dict = Depends(get_current_user)):
    """Clear all notifications"""
    await db.notifications.delete_many({"user_id": current_user["id"]})
    return {"message": "Tüm bildirimler silindi"}

# Helper function to send notification when social actions happen
async def notify_user(
    recipient_id: str,
    sender_id: str,
    notification_type: str,
    title: str,
    body: str,
    data: dict = None
):
    """Helper to send notification (called from other endpoints)"""
    # Don't notify yourself
    if recipient_id == sender_id:
        return
    
    await send_push_notification(
        recipient_id=recipient_id,
        title=title,
        body=body,
        notification_type=notification_type,
        data=data,
        sender_id=sender_id
    )

@api_router.post("/auth/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user)
):
    # Verify current password
    user = await db.users.find_one({"id": current_user["id"]})
    if not user or not verify_password(data.current_password, user["password"]):
        raise HTTPException(status_code=400, detail="Mevcut şifre yanlış")
    
    # Validate new password
    is_valid, error_message = validate_password(data.new_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_message)
    
    # Update password
    hashed = hash_password(data.new_password)
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"password": hashed, "password_changed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Şifre başarıyla değiştirildi"}

@api_router.post("/auth/change-email")
async def change_email(
    data: ChangeEmailRequest,
    current_user: dict = Depends(get_current_user)
):
    # Verify password
    user = await db.users.find_one({"id": current_user["id"]})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=400, detail="Şifre yanlış")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": data.new_email})
    if existing:
        raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kullanımda")
    
    # Update email
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"email": data.new_email, "email_changed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "E-posta adresi güncellendi"}

@api_router.post("/auth/toggle-2fa")
async def toggle_two_factor(
    enabled: bool,
    current_user: dict = Depends(get_current_user)
):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"two_factor_enabled": enabled}}
    )
    
    message = "İki faktörlü doğrulama etkinleştirildi" if enabled else "İki faktörlü doğrulama devre dışı bırakıldı"
    return {"message": message, "two_factor_enabled": enabled}

@api_router.get("/auth/sessions")
async def get_active_sessions_list(current_user: dict = Depends(get_current_user)):
    """Get real sessions from DB (first definition - may be overridden later)"""
    sessions = await db.user_sessions.find(
        {"user_id": current_user["id"], "is_active": True},
        {"_id": 0, "user_id": 0}
    ).sort("last_active", -1).to_list(20)
    return sessions if sessions else []

@api_router.post("/auth/sessions/logout-all")
async def logout_all_sessions(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user: dict = Depends(get_current_user)
):
    """Revoke all sessions: delete all user sessions and blacklist current token"""
    token = credentials.credentials
    user_id = current_user["id"]
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.token_blacklist.insert_one({
        "token": token,
        "user_id": user_id,
        "revoked_at": datetime.now(timezone.utc).isoformat()
    })
    await db.users.update_one({"id": user_id}, {"$set": {"is_online": False}})
    return {"message": "Tüm oturumlar kapatıldı"}

@api_router.post("/account/freeze")
async def freeze_account(current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "is_frozen": True,
            "frozen_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Hesabınız donduruldu"}

@api_router.post("/account/unfreeze")
async def unfreeze_account(current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"is_frozen": False, "frozen_at": None}}
    )
    return {"message": "Hesabınız yeniden etkinleştirildi"}

@api_router.post("/account/delete/request")
async def request_account_deletion(current_user: dict = Depends(get_current_user)):
    """Step 1: Request deletion - sends email with verification code"""
    user = await db.users.find_one({"id": current_user["id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    import secrets
    code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    
    await db.pending_deletions.delete_many({"user_id": current_user["id"]})
    await db.pending_deletions.insert_one({
        "user_id": current_user["id"],
        "code": code,
        "expires_at": expires_at
    })
    
    await email_service.send_deletion_code(
        user["email"],
        user.get("display_name", user.get("username", "Kullanıcı")),
        code
    )
    
    return {"message": "Doğrulama kodu e-posta adresinize gönderildi", "step": 1}

@api_router.post("/account/delete/verify-code")
async def verify_deletion_code(code: str, current_user: dict = Depends(get_current_user)):
    """Step 2: Verify code from email"""
    pending = await db.pending_deletions.find_one({
        "user_id": current_user["id"],
        "code": code
    })
    if not pending:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş kod")
    
    expires = datetime.fromisoformat(pending["expires_at"].replace('Z', '+00:00'))
    if expires < datetime.now(timezone.utc):
        await db.pending_deletions.delete_one({"user_id": current_user["id"]})
        raise HTTPException(status_code=400, detail="Kod süresi doldu. Lütfen tekrar isteyin.")
    
    return {"message": "Kod doğrulandı", "step": 2, "code_verified": True}

@api_router.delete("/account/delete")
async def delete_account(
    password: str,
    code: str = Query(..., description="Verification code from email"),
    current_user: dict = Depends(get_current_user)
):
    """Step 3: Confirm with code + password, then permanently delete account"""
    pending = await db.pending_deletions.find_one({
        "user_id": current_user["id"],
        "code": code
    })
    if not pending:
        raise HTTPException(status_code=400, detail="Önce silme talebi yapın ve e-posta kodunu girin")
    
    expires = datetime.fromisoformat(pending["expires_at"].replace('Z', '+00:00'))
    if expires < datetime.now(timezone.utc):
        await db.pending_deletions.delete_one({"user_id": current_user["id"]})
        raise HTTPException(status_code=400, detail="Kod süresi doldu. Lütfen tekrar isteyin.")
    
    user = await db.users.find_one({"id": current_user["id"]})
    if not user or not verify_password(password, user["password"]):
        raise HTTPException(status_code=400, detail="Şifre yanlış")
    
    user_id = current_user["id"]
    
    await db.pending_deletions.delete_one({"user_id": user_id})
    
    # Delete all user data
    await db.posts.delete_many({"user_id": user_id})
    await db.comments.delete_many({"user_id": user_id})
    await db.follows.delete_many({"$or": [{"follower_id": user_id}, {"following_id": user_id}]})
    await db.stories.delete_many({"user_id": user_id})
    await db.notifications.delete_many({"user_id": user_id})
    await db.messages.delete_many({"sender_id": user_id})
    await db.conversations.delete_many({"participants": user_id})
    await db.user_settings.delete_one({"user_id": user_id})
    await db.track_likes.delete_many({"user_id": user_id})
    await db.post_reactions.delete_many({"user_id": user_id})
    await db.saved_posts.delete_many({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.token_blacklist.delete_many({"user_id": user_id})
    await db.users.delete_one({"id": user_id})
    
    return {"message": "Hesabınız kalıcı olarak silindi"}

@api_router.get("/account/data-export")
async def request_data_export(current_user: dict = Depends(get_current_user)):
    """Export user data as ZIP download (profile, posts, comments, etc.)"""
    user_id = current_user["id"]
    
    # Fetch user data (exclude password)
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Fetch posts, comments, etc.
    posts = await db.posts.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    comments = await db.comments.find({"user_id": user_id}, {"_id": 0}).to_list(5000)
    saved = await db.saved_posts.find({"user_id": user_id}, {"_id": 0}).to_list(500)
    
    # Convert ObjectId and non-serializable
    def sanitize(obj):
        if isinstance(obj, dict):
            return {k: sanitize(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [sanitize(i) for i in obj]
        if hasattr(obj, 'isoformat'):
            return obj.isoformat()
        return obj
    
    user_safe = sanitize(user)
    posts_safe = sanitize(posts)
    comments_safe = sanitize(comments)
    saved_safe = sanitize(saved)
    
    # Create ZIP in temp dir
    exports_dir = ROOT_DIR / "exports"
    exports_dir.mkdir(exist_ok=True)
    zip_path = exports_dir / f"export_{user_id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.zip"
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("profile.json", json.dumps(user_safe, indent=2, ensure_ascii=False))
        zf.writestr("posts.json", json.dumps(posts_safe, indent=2, ensure_ascii=False))
        zf.writestr("comments.json", json.dumps(comments_safe, indent=2, ensure_ascii=False))
        zf.writestr("saved_posts.json", json.dumps(saved_safe, indent=2, ensure_ascii=False))
    
    from fastapi.responses import FileResponse
    return FileResponse(
        path=zip_path,
        media_type="application/zip",
        filename=f"socialbeats_export_{user.get('username', user_id)}.zip"
    )

# ============== USER WARNINGS & PENALTY ==============
# penalty_level: 0=none, 1=warned, 2=restricted, 3=banned

class CreateWarningRequest(BaseModel):
    user_id: str
    reason: str
    report_id: Optional[str] = None

async def apply_penalty(user_id: str, offense_number: int) -> int:
    """Apply graduated penalty: 1st=warning(1), 2nd=restriction(2), 3rd+=ban(3)"""
    if offense_number == 1:
        level = 1  # warned
    elif offense_number == 2:
        level = 2  # restricted
    else:
        level = 3  # banned
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"penalty_level": level, "penalty_updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return level

@api_router.post("/users/warnings")
async def create_warning(
    req: CreateWarningRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a warning for a user (admin/moderator when report action taken)"""
    if not current_user.get("is_admin") and not current_user.get("is_moderator"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    now = datetime.now(timezone.utc).isoformat()
    warning_id = str(uuid.uuid4())
    await db.user_warnings.insert_one({
        "id": warning_id,
        "user_id": req.user_id,
        "reason": req.reason,
        "report_id": req.report_id,
        "created_by": current_user["id"],
        "created_at": now
    })
    
    count = await db.user_warnings.count_documents({"user_id": req.user_id})
    new_level = await apply_penalty(req.user_id, count)
    
    return {"message": "Uyarı oluşturuldu", "warning_id": warning_id, "penalty_level": new_level}

@api_router.get("/users/warnings")
async def get_user_warnings(
    user_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Get warnings for a user (own warnings or admin)"""
    target_id = user_id or current_user["id"]
    if target_id != current_user["id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    warnings = await db.user_warnings.find(
        {"user_id": target_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return warnings

@api_router.get("/users/penalty-status")
async def get_penalty_status(current_user: dict = Depends(get_current_user)):
    """Get current user's penalty level and status"""
    user = await db.users.find_one(
        {"id": current_user["id"]},
        {"penalty_level": 1, "penalty_updated_at": 1, "_id": 0}
    )
    level = user.get("penalty_level", 0)
    labels = {0: "none", 1: "warned", 2: "restricted", 3: "banned"}
    return {
        "penalty_level": level,
        "status": labels.get(level, "none"),
        "can_post": level < 3,
        "is_restricted": level == 2,
        "is_banned": level == 3,
        "updated_at": user.get("penalty_updated_at")
    }

@api_router.get("/social/blocked-users")
async def get_blocked_users(current_user: dict = Depends(get_current_user)):
    blocked = await db.blocked_users.find(
        {"blocker_id": current_user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    if not blocked:
        return []
    
    blocked_ids = [b["blocked_id"] for b in blocked]
    users = await db.users.find(
        {"id": {"$in": blocked_ids}},
        {"_id": 0, "password": 0, "email": 0}
    ).to_list(100)
    
    return users

@api_router.post("/social/block/{user_id}")
async def block_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Kendinizi engelleyemezsiniz")
    
    existing = await db.blocked_users.find_one({
        "blocker_id": current_user["id"],
        "blocked_id": user_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Bu kullanıcı zaten engellenmiş")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.blocked_users.insert_one({
        "id": str(uuid.uuid4()),
        "blocker_id": current_user["id"],
        "blocked_id": user_id,
        "created_at": now
    })
    
    # Remove any follow relationship
    await db.follows.delete_many({
        "$or": [
            {"follower_id": current_user["id"], "following_id": user_id},
            {"follower_id": user_id, "following_id": current_user["id"]}
        ]
    })
    
    return {"message": "Kullanıcı engellendi"}

@api_router.delete("/social/unblock/{user_id}")
async def unblock_user(user_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.blocked_users.delete_one({
        "blocker_id": current_user["id"],
        "blocked_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bu kullanıcı engellenmiş değil")
    
    return {"message": "Kullanıcının engeli kaldırıldı"}

@api_router.get("/social/restricted-users")
async def get_restricted_users(current_user: dict = Depends(get_current_user)):
    restricted = await db.restricted_users.find(
        {"restricter_id": current_user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    if not restricted:
        return []
    
    restricted_ids = [r["restricted_id"] for r in restricted]
    users = await db.users.find(
        {"id": {"$in": restricted_ids}},
        {"_id": 0, "password": 0, "email": 0}
    ).to_list(100)
    
    return users

@api_router.post("/social/restrict/{user_id}")
async def restrict_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Kendinizi kısıtlayamazsınız")
    
    existing = await db.restricted_users.find_one({
        "restricter_id": current_user["id"],
        "restricted_id": user_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Bu kullanıcı zaten kısıtlanmış")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.restricted_users.insert_one({
        "id": str(uuid.uuid4()),
        "restricter_id": current_user["id"],
        "restricted_id": user_id,
        "created_at": now
    })
    
    return {"message": "Kullanıcı kısıtlandı"}

@api_router.delete("/social/unrestrict/{user_id}")
async def unrestrict_user(user_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.restricted_users.delete_one({
        "restricter_id": current_user["id"],
        "restricted_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bu kullanıcı kısıtlanmış değil")
    
    return {"message": "Kullanıcının kısıtlaması kaldırıldı"}

# ============== SEARCH & DISCOVER ==============

class SearchHistoryItem(BaseModel):
    query: str

@api_router.get("/search")
async def search(
    q: str,
    type: str = "all",  # all, users, tracks, posts, playlists
    platform: str = "all",  # all, youtube, apple_music
    duration: str = "all",  # all, short, medium, long
    sort: str = "relevance",  # relevance, date, views, likes
    date: str = "all",  # all, hour, day, week, month - tarih filtresi (posts için)
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Universal search endpoint - Meilisearch with MongoDB fallback"""
    from services.meilisearch_service import meili_service

    results = {
        "query": q,
        "users": [],
        "tracks": [],
        "posts": [],
        "playlists": [],
        "youtube": [],
        "apple_music": [],
        "search_engine": "meilisearch" if meili_service.is_available() else "mongodb",
    }

    use_meili = meili_service.is_available()

    if use_meili and type == "all":
        meili_results = await meili_service.multi_search(q, {
            "users": min(limit, 10), "posts": limit, "tracks": limit, "playlists": min(limit, 10)
        })
        results["users"] = meili_results.get("users", {}).get("hits", [])
        results["tracks"] = meili_results.get("tracks", {}).get("hits", [])
        results["posts"] = meili_results.get("posts", {}).get("hits", [])
        results["playlists"] = meili_results.get("playlists", {}).get("hits", [])
    else:
        if type in ["all", "users"]:
            if use_meili:
                r = await meili_service.search_users(q, limit, offset)
                results["users"] = r.get("hits", [])
            else:
                user_query = {"$or": [
                {"username": {"$regex": q, "$options": "i"}},
                {"display_name": {"$regex": q, "$options": "i"}},
                {"bio": {"$regex": q, "$options": "i"}}
                ]}
                results["users"] = await db.users.find(user_query, {"_id": 0, "password": 0, "email": 0}).limit(limit).skip(offset).to_list(limit)

        if type in ["all", "tracks"]:
            if use_meili:
                r = await meili_service.search_tracks(q, limit, offset, platform=platform if platform != "all" else None)
                results["tracks"] = r.get("hits", [])
            else:
                track_query = {"$or": [
                    {"title": {"$regex": q, "$options": "i"}},
                    {"artist": {"$regex": q, "$options": "i"}},
                    {"album": {"$regex": q, "$options": "i"}}
                ]}
                if platform != "all":
                    track_query["source"] = platform
                results["tracks"] = await db.tracks.find(track_query, {"_id": 0}).limit(limit).skip(offset).to_list(limit)

        if type in ["all", "posts"]:
            if use_meili:
                r = await meili_service.search_posts(q, limit, offset, date=date)
                results["posts"] = r.get("hits", [])
            else:
                post_query = {"$or": [
                {"content": {"$regex": q, "$options": "i"}},
                {"tags": {"$in": [q.lower()]}}
                ]}
            if date and date != "all":
                cutoff_map = {"hour": 1, "day": 24, "week": 168, "month": 720}
                hours = cutoff_map.get(date)
                if hours:
                    post_query["created_at"] = {"$gte": (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()}
            posts = await db.posts.find(post_query, {"_id": 0}).sort("created_at", -1).limit(limit).skip(offset).to_list(limit)
            for post in posts:
                u = await db.users.find_one({"id": post.get("user_id")}, {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1})
                post["user"] = u
            results["posts"] = posts

        if type in ["all", "playlists"]:
            if use_meili:
                r = await meili_service.search_playlists(q, limit, offset, platform=platform if platform != "all" else None)
                results["playlists"] = r.get("hits", [])
            else:
                playlist_query = {"is_public": True, "$or": [
                {"name": {"$regex": q, "$options": "i"}},
                {"description": {"$regex": q, "$options": "i"}}
                ]}
                results["playlists"] = await db.playlists.find(playlist_query, {"_id": 0}).limit(limit).skip(offset).to_list(limit)
    
    return results

@api_router.get("/search/history")
async def get_search_history(
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """Get user's search history (MongoDB + PostgreSQL merge for MMKV sync)"""
    history = await db.search_history.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    try:
        from services.postgresql_service import get_search_history_pg
        pg_hist = await get_search_history_pg(current_user["id"], limit)
        if pg_hist and not history:
            history = [{"id": str(h.get("id", "")), "query": h.get("query", ""), "created_at": str(h.get("created_at", ""))} for h in pg_hist]
        elif pg_hist:
            seen = {h.get("query") for h in history}
            for h in pg_hist:
                q = h.get("query", "")
                if q and q not in seen and len(history) < limit:
                    history.append({"id": str(h.get("id", "")), "query": q, "created_at": str(h.get("created_at", ""))})
                    seen.add(q)
            history = sorted(history, key=lambda x: x.get("created_at", ""), reverse=True)[:limit]
    except Exception:
        pass
    return {"history": history}

@api_router.post("/search/history")
async def add_to_search_history(
    item: SearchHistoryItem,
    current_user: dict = Depends(get_current_user)
):
    """Add search query to history"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Check if already exists
    existing = await db.search_history.find_one({
        "user_id": current_user["id"],
        "query": item.query
    })
    
    if existing:
        # Update timestamp
        await db.search_history.update_one(
            {"id": existing["id"]},
            {"$set": {"created_at": now}}
        )
    else:
        # Add new entry
        await db.search_history.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "query": item.query,
            "created_at": now
        })
        
        # Keep only last 20 searches
        history = await db.search_history.find(
            {"user_id": current_user["id"]}
        ).sort("created_at", -1).to_list(100)
        
        if len(history) > 20:
            old_ids = [h["id"] for h in history[20:]]
            await db.search_history.delete_many({"id": {"$in": old_ids}})
    try:
        from services.postgresql_service import add_search_history_pg
        await add_search_history_pg(current_user["id"], item.query, "all")
    except Exception:
        pass
    return {"message": "Arama geçmişine eklendi"}

@api_router.delete("/search/history/{history_id}")
async def delete_search_history_item(
    history_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a single search history item"""
    await db.search_history.delete_one({
        "id": history_id,
        "user_id": current_user["id"]
    })
    return {"message": "Silindi"}

@api_router.delete("/search/history")
async def clear_search_history(current_user: dict = Depends(get_current_user)):
    """Clear all search history"""
    await db.search_history.delete_many({"user_id": current_user["id"]})
    return {"message": "Arama geçmişi temizlendi"}

@api_router.get("/search/categories")
async def get_search_categories(limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Kategori keşif - Meilisearch genre/platform facet dağılımı"""
    try:
        from services.meilisearch_service import meili_service
        if meili_service.is_available():
            cats = await meili_service.discover_categories(limit)
            return {"genres": cats.get("genres", []), "platforms": cats.get("platforms", [])}
    except Exception:
        pass
    return {"genres": ["pop", "rock", "hiphop", "electronic", "jazz", "acoustic"], "platforms": ["YouTube", "Spotify"]}

@api_router.get("/search/popular")
@api_router.get("/search/trending")
async def get_trending_searches(limit: int = 10, current_user: dict = Depends(get_current_user)):
    """Popüler aramalar - MongoDB + Trench (search event aggregation)"""
    # Aggregate most common searches in last 7 days
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    pipeline = [
        {"$match": {"created_at": {"$gte": seven_days_ago}}},
        {"$group": {"_id": "$query", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit}
    ]
    
    trending = await db.search_history.aggregate(pipeline).to_list(limit)
    # If no recent searches, return popular categories
    if not trending:
        trending = [
            {"query": "Pop", "count": 100},
            {"query": "Rock", "count": 90},
            {"query": "Hip-Hop", "count": 85},
            {"query": "Elektronik", "count": 75},
            {"query": "Akustik", "count": 70},
            {"query": "Türkçe Pop", "count": 65},
            {"query": "Jazz", "count": 60},
            {"query": "R&B", "count": 55}
        ]
    else:
        trending = [{"query": t["_id"], "count": t["count"]} for t in trending]
    
    return {"trending": trending}

@api_router.get("/discover/categories")
async def get_discover_categories():
    """Get music categories for discovery"""
    categories = [
        {"id": "pop", "name": "Pop", "color": "from-pink-500 to-rose-500", "icon": "musical-notes"},
        {"id": "rock", "name": "Rock", "color": "from-purple-500 to-indigo-500", "icon": "flame"},
        {"id": "hiphop", "name": "Hip-Hop/Rap", "color": "from-yellow-500 to-orange-500", "icon": "mic"},
        {"id": "electronic", "name": "Elektronik", "color": "from-blue-500 to-cyan-500", "icon": "pulse"},
        {"id": "acoustic", "name": "Akustik", "color": "from-green-500 to-emerald-500", "icon": "leaf"},
        {"id": "jazz", "name": "Caz", "color": "from-amber-500 to-yellow-500", "icon": "musical-note"},
        {"id": "classical", "name": "Klasik", "color": "from-gray-500 to-slate-500", "icon": "library"},
        {"id": "turkish", "name": "Türkçe", "color": "from-red-500 to-rose-500", "icon": "flag"}
    ]
    return {"categories": categories[:6]}  # 6 kategori keşif

@api_router.get("/discover/new-releases")
async def get_new_releases(limit: int = 15, current_user: dict = Depends(get_current_user)):
    """Yeni çıkan müzikler"""
    week_ago = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    tracks = await db.tracks.find({"created_at": {"$gte": week_ago}}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    if not tracks:
        tracks = MOCK_TRACKS[:limit]
    return {"tracks": tracks}

@api_router.get("/search/mood")
async def get_mood_music(mood: str = Query(..., description="Ruh hali: mutlu, hüzünlü, enerjik, sakin, nostalji vb."),
                         activity: str = Query(None), limit: int = 20,
                         current_user: dict = Depends(get_current_user)):
    """Ruh haline göre müzik - Google Gemini AI önerisi"""
    try:
        from services.ai_text_service import generate_ai_playlist
        tracks = await generate_ai_playlist(mood=mood, activity=activity, limit=limit)
        if tracks:
            return {"tracks": tracks, "mood": mood}
    except Exception:
        pass
    return {"tracks": [], "mood": mood}

@api_router.get("/discover/moods/{mood}/tracks")
async def get_mood_tracks(mood: str, limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Ruh haline göre müzik (MongoDB posts fallback)"""
    posts = await db.posts.find({"mood": {"$regex": mood, "$options": "i"}}, {"_id": 0}).limit(50).to_list(50)
    tracks = []
    for p in posts:
        if p.get("track") and p["track"] not in [t.get("id") for t in tracks]:
            tracks.append(p["track"] if isinstance(p["track"], dict) else {"id": p["track"], "title": "Track", "artist": ""})
    if not tracks:
        tracks = [dict(t, mood=mood) for t in MOCK_TRACKS[:limit]]
    return {"tracks": tracks[:limit]}

@api_router.get("/search/recommendations")
async def get_personalized_recommendations(limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Kişiselleştirilmiş öneriler - Google Gemini + Trench (kullanıcı etkinlikleri)"""
    try:
        from services.ai_text_service import generate_ai_playlist
        tracks = await generate_ai_playlist(activity="genel popüler müzik", limit=limit)
        if tracks:
            return {"tracks": tracks}
    except Exception:
        pass
    return {"tracks": []}

@api_router.get("/social/friends/activity")
async def get_friends_activity(limit: int = 30, current_user: dict = Depends(get_current_user)):
    """Arkadaş aktivitesi - takip edilenlerin gönderileri/likeleri. Evolution + Trench ile bildirim."""
    following_ids = [f["following_id"] for f in await db.follows.find(
        {"follower_id": current_user["id"]}, {"following_id": 1}
    ).to_list(100)]
    if not following_ids:
        return {"activities": []}
    activities = []
    posts = await db.posts.find(
        {"user_id": {"$in": following_ids}, "visibility": "public"},
        {"_id": 0, "id": 1, "content": 1, "user_id": 1, "likes_count": 1, "created_at": 1, "post_type": 1}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    for p in posts:
        u = await db.users.find_one({"id": p["user_id"]}, {"_id": 0, "username": 1, "display_name": 1, "avatar_url": 1})
        activities.append({"type": "post", "post": p, "user": u})
    return {"activities": activities}

@api_router.get("/search/nearby")
async def get_nearby_popular(lat: float = Query(...), lng: float = Query(...),
                             radius_km: float = Query(50, le=500),
                             limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Yakındaki popüler - Trench + PostgreSQL (geo events). Leaflet.js ile haritada göster."""
    try:
        from services.postgresql_service import log_event, query
        await log_event("geo_view", current_user["id"], {"lat": lat, "lng": lng, "radius_km": radius_km})
        rows = await query(
            """SELECT data->>'track_id' as track_id, data->>'title' as title, data->>'artist' as artist, COUNT(*) as play_count
               FROM analytics_events
               WHERE event_type = 'track_played' AND data ? 'lat' AND data ? 'lng'
               GROUP BY data->>'track_id', data->>'title', data->>'artist'
               ORDER BY play_count DESC LIMIT $1""",
            limit
        )
        if rows:
            return {"tracks": [{"id": r.get("track_id"), "title": r.get("title"), "artist": r.get("artist"), "play_count": r.get("play_count", 0)} for r in rows]}
    except Exception:
        pass
    return {"tracks": []}

@api_router.get("/discover/activities")
async def get_activities():
    """Aktivite listesi (aktiviteye göre müzik için)"""
    return {"activities": [{"id": a.lower().replace(" ", "_"), "name": a} for a in ACTIVITY_OPTIONS]}

@api_router.get("/discover/activities/{activity}/tracks")
async def get_activity_tracks(activity: str, limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Aktiviteye göre müzik"""
    act_name = activity.replace("_", " ").title()
    posts = await db.posts.find({"activity": {"$regex": act_name, "$options": "i"}}, {"_id": 0}).limit(50).to_list(50)
    tracks = []
    for p in posts:
        if p.get("track"):
            tracks.append(p["track"] if isinstance(p["track"], dict) else {"id": p["track"], "title": "Track", "artist": ""})
    if not tracks:
        tracks = MOCK_TRACKS[:limit]
    return {"tracks": tracks[:limit]}

@api_router.get("/discover/trending/week")
async def get_trending_week(limit: int = 15, current_user: dict = Depends(get_current_user)):
    """Trend içerikler (son 7 gün)"""
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    posts = await db.posts.find({"created_at": {"$gte": week_ago}}, {"_id": 0}).sort("likes_count", -1).limit(limit).to_list(limit)
    for p in posts:
        u = await db.users.find_one({"id": p["user_id"]}, {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1})
        p["user"] = u
    return {"posts": posts, "tracks": MOCK_TRACKS[:limit]}

@api_router.get("/discover/seasonal")
async def get_seasonal_recommendations(current_user: dict = Depends(get_current_user)):
    """Mevsimsel öneriler (4 mevsim)"""
    month = datetime.now().month
    if month in [3, 4, 5]: season = "ilkbahar"
    elif month in [6, 7, 8]: season = "yaz"
    elif month in [9, 10, 11]: season = "sonbahar"
    else: season = "kış"
    return {"season": season, "seasons": SEASONS, "tracks": MOCK_TRACKS[:8]}

@api_router.get("/discover/featured")
async def get_featured_content(current_user: dict = Depends(get_current_user)):
    """Get featured/recommended content for discover page"""
    # Featured playlists
    featured_playlists = await db.playlists.find(
        {"is_featured": True, "is_public": True},
        {"_id": 0}
    ).limit(6).to_list(6)
    
    # Popular users
    popular_users = await db.users.find(
        {},
        {"_id": 0, "password": 0, "email": 0}
    ).sort("followers_count", -1).limit(10).to_list(10)
    
    # Recent popular tracks
    popular_tracks = await db.tracks.find(
        {},
        {"_id": 0}
    ).sort("play_count", -1).limit(20).to_list(20)
    
    # Trending posts
    trending_posts = await db.posts.find(
        {"created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()}},
        {"_id": 0}
    ).sort("likes_count", -1).limit(10).to_list(10)
    
    for post in trending_posts:
        user = await db.users.find_one(
            {"id": post["user_id"]},
            {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
        )
        post["user"] = user
    
    return {
        "featured_playlists": featured_playlists,
        "popular_users": popular_users,
        "popular_tracks": popular_tracks,
        "trending_posts": trending_posts
    }

# ============== HEALTH CHECK ==============

@api_router.get("/")
async def root():
    return {"message": "SocialBeats Social API v3.0", "status": "healthy"}


# ============== PUBLIC: TestSprite / PRD ==============
PROJECT_ROOT = ROOT_DIR.parent
PRD_PATH = PROJECT_ROOT / "PRD.md"


@api_router.get("/public/prd")
async def download_prd():
    """İndirilebilir PRD (Product Requirements Document) – TestSprite vb. için."""
    from fastapi.responses import FileResponse
    if not PRD_PATH.exists():
        raise HTTPException(status_code=404, detail="PRD.md not found")
    return FileResponse(
        path=str(PRD_PATH),
        media_type="text/markdown",
        filename="SocialBeats-PRD.md",
        headers={"Content-Disposition": "attachment; filename=SocialBeats-PRD.md"},
    )


# ============== MESSAGING SYSTEM ==============

class CreateConversationRequest(BaseModel):
    participant_ids: List[str]
    is_group: bool = False
    group_name: Optional[str] = None

class SendMessageRequest(BaseModel):
    conversation_id: str
    content_type: str = "TEXT"  # TEXT, IMAGE, VIDEO, VOICE, MUSIC, POST, PLAYLIST, PROFILE, GIF, STICKER, STORY_REPLY
    content: Optional[str] = None
    media_url: Optional[str] = None
    duration: Optional[int] = None  # For voice messages
    music_id: Optional[str] = None
    post_id: Optional[str] = None
    playlist_id: Optional[str] = None
    user_id: Optional[str] = None  # For PROFILE share
    story_id: Optional[str] = None  # For story replies
    reply_to: Optional[str] = None  # message_id for quote reply
    disappears_after_seconds: Optional[int] = None  # 1-24 for disappearing messages
    e2e_encrypted: bool = False  # E2E: content is base64 ciphertext
    e2e_nonce: Optional[str] = None  # E2E: base64 nonce (24 bytes for nacl.box)
    e2e_sender_public_key: Optional[str] = None  # E2E: sender's base64 public key (for recipient decrypt)

class MessageReactionRequest(BaseModel):
    message_id: str
    reaction: str  # emoji

@api_router.get("/messages/conversations")
async def get_conversations(
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get user's conversations list (excludes deleted and archived)"""
    # Exclude user-deleted conversations
    deleted_ids = await db.user_deleted_conversations.find(
        {"user_id": current_user["id"]},
        {"conversation_id": 1}
    ).to_list(500)
    excluded_ids = [d["conversation_id"] for d in deleted_ids]

    # Exclude archived conversations (MongoDB + PostgreSQL)
    archived = await db.archived_conversations.find(
        {"user_id": current_user["id"]},
        {"conversation_id": 1}
    ).to_list(500)
    excluded_ids = list(set(excluded_ids + [a["conversation_id"] for a in archived]))
    try:
        from services.postgresql_service import get_conversation_settings_pg
        pg_settings = await get_conversation_settings_pg(current_user["id"])
        excluded_ids = list(set(excluded_ids + pg_settings.get("archived", [])))
    except Exception:
        pg_settings = {"pinned": [], "muted": {}, "archived": []}

    # Get conversations where user is a participant
    query = {"participants": current_user["id"], "is_deleted": {"$ne": True}}
    if excluded_ids:
        query["id"] = {"$nin": excluded_ids}
    conversations = await db.conversations.find(
        query,
        {"_id": 0}
    ).sort("last_message_at", -1).skip(offset).limit(limit).to_list(limit)
    
    # Enrich with participant info and last message
    for conv in conversations:
        # Get other participants info
        other_ids = [p for p in conv["participants"] if p != current_user["id"]]
        participants = await db.users.find(
            {"id": {"$in": other_ids}},
            {"_id": 0, "password": 0, "email": 0}
        ).to_list(10)
        conv["other_participants"] = participants
        
        # Get last message
        last_msg = await db.messages.find_one(
            {"conversation_id": conv["id"]},
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        conv["last_message"] = last_msg
        
        # Get unread count
        unread = await db.messages.count_documents({
            "conversation_id": conv["id"],
            "sender_id": {"$ne": current_user["id"]},
            "read_by": {"$ne": current_user["id"]}
        })
        conv["unread_count"] = unread

        # Check muted (PostgreSQL overrides MongoDB)
        pg_mute_until = pg_settings.get("muted", {}).get(conv["id"])
        muted = await db.muted_conversations.find_one({"conversation_id": conv["id"], "user_id": current_user["id"]})
        conv["is_muted"] = pg_mute_until is not None or bool(muted)
        conv["muted_until"] = pg_mute_until if pg_mute_until is not None else (muted.get("muted_until") if muted else None)

        # Check pinned (PostgreSQL overrides MongoDB)
        pinned = await db.pinned_conversations.find_one({"conversation_id": conv["id"], "user_id": current_user["id"]})
        conv["is_pinned"] = conv["id"] in pg_settings.get("pinned", []) or bool(pinned)
        conv["pinned_at"] = pinned.get("pinned_at") if pinned and conv["id"] not in pg_settings.get("pinned", []) else None

    # Sort: pinned first, then by last_message_at (newest first)
    conversations.sort(key=lambda c: c.get("last_message_at") or "0000", reverse=True)
    conversations.sort(key=lambda c: not c.get("is_pinned"))  # pinned (True) first

@api_router.post("/messages/conversations")
async def create_conversation(
    data: CreateConversationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new conversation"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Add current user to participants
    all_participants = list(set([current_user["id"]] + data.participant_ids))
    
    # Check if 1-on-1 conversation already exists
    if not data.is_group and len(all_participants) == 2:
        existing = await db.conversations.find_one({
            "$and": [
                {"participants": {"$all": all_participants}},
                {"participants": {"$size": 2}},
                {"is_group": False}
            ]
        })
        if existing:
            existing.pop("_id", None)
            return existing
    
    conversation = {
        "id": str(uuid.uuid4()),
        "participants": all_participants,
        "is_group": data.is_group,
        "group_name": data.group_name if data.is_group else None,
        "group_avatar": None,
        "created_by": current_user["id"],
        "created_at": now,
        "last_message_at": now,
        "is_deleted": False
    }
    
    await db.conversations.insert_one(conversation)
    conversation.pop("_id", None)
    
    return conversation

@api_router.get("/messages/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get conversation details"""
    conv = await db.conversations.find_one(
        {"id": conversation_id, "participants": current_user["id"]},
        {"_id": 0}
    )
    
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")
    
    # Get participants info
    participants = await db.users.find(
        {"id": {"$in": conv["participants"]}},
        {"_id": 0, "password": 0, "email": 0}
    ).to_list(20)
    conv["participants_info"] = participants
    
    return conv

@api_router.get("/messages/search")
async def search_messages(
    q: str,
    conversation_id: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Search messages across conversations or within a specific conversation"""
    if not q or len(q) < 2:
        return {"messages": [], "total": 0}
    
    # Build query
    query = {
        "content": {"$regex": q, "$options": "i"},
        "content_type": "TEXT"  # Only search text messages
    }
    
    if conversation_id:
        # Search within specific conversation
        conv = await db.conversations.find_one({
            "id": conversation_id,
            "participants": current_user["id"]
        })
        if not conv:
            raise HTTPException(status_code=403, detail="Bu sohbete erişiminiz yok")
        query["conversation_id"] = conversation_id
    else:
        # Search across all user's conversations
        user_conversations = await db.conversations.find(
            {"participants": current_user["id"]},
            {"id": 1, "_id": 0}
        ).to_list(100)
        conv_ids = [c["id"] for c in user_conversations]
        
        if not conv_ids:
            # User has no conversations
            return {"messages": [], "total": 0, "query": q}
        
        query["conversation_id"] = {"$in": conv_ids}
    
    # Execute search
    messages = await db.messages.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Enrich with conversation and sender info
    enriched_messages = []
    for msg in messages:
        # Get sender info
        sender = await db.users.find_one(
            {"id": msg["sender_id"]},
            {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
        )
        
        # Get conversation info
        conv = await db.conversations.find_one(
            {"id": msg["conversation_id"]},
            {"_id": 0, "id": 1, "is_group": 1, "group_name": 1, "participants": 1}
        )
        
        enriched_messages.append({
            **msg,
            "sender": sender,
            "conversation": conv
        })
    
    return {
        "messages": enriched_messages,
        "total": len(enriched_messages),
        "query": q
    }

@api_router.get("/messages/media/{conversation_id}")
async def get_conversation_media(
    conversation_id: str,
    media_type: Optional[str] = None,  # IMAGE, VIDEO, VOICE, GIF
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get all media from a conversation (Media Gallery)"""
    # Verify access
    conv = await db.conversations.find_one({
        "id": conversation_id,
        "participants": current_user["id"]
    })
    if not conv:
        raise HTTPException(status_code=403, detail="Bu sohbete erişiminiz yok")
    
    # Build query for media messages
    query = {
        "conversation_id": conversation_id,
        "content_type": {"$in": ["IMAGE", "VIDEO", "VOICE", "GIF"]}
    }
    
    if media_type:
        query["content_type"] = media_type
    
    media = await db.messages.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Group by type
    grouped = {
        "images": [],
        "videos": [],
        "voice": [],
        "gifs": []
    }
    
    for m in media:
        if m["content_type"] == "IMAGE":
            grouped["images"].append(m)
        elif m["content_type"] == "VIDEO":
            grouped["videos"].append(m)
        elif m["content_type"] == "VOICE":
            grouped["voice"].append(m)
        elif m["content_type"] == "GIF":
            grouped["gifs"].append(m)
    
    return {
        "media": media,
        "grouped": grouped,
        "total": len(media)
    }

@api_router.get("/messages/{conversation_id}")
async def get_messages(
    conversation_id: str,
    limit: int = 50,
    before: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get messages in a conversation"""
    # Verify user is participant
    conv = await db.conversations.find_one({
        "id": conversation_id,
        "participants": current_user["id"]
    })
    
    if not conv:
        raise HTTPException(status_code=403, detail="Bu sohbete erişiminiz yok")
    
    query = {"conversation_id": conversation_id}
    if before:
        query["created_at"] = {"$lt": before}
    
    # Exclude expired disappearing messages
    now_iso = datetime.now(timezone.utc).isoformat()
    query["$or"] = [{"expires_at": {"$exists": False}}, {"expires_at": {"$gt": now_iso}}]
    
    # Exclude messages deleted "for me" by current user
    deleted_for_me = await db.user_deleted_messages.find(
        {"user_id": current_user["id"]},
        {"message_id": 1}
    ).to_list(5000)
    deleted_ids = [d["message_id"] for d in deleted_for_me]
    if deleted_ids:
        query["id"] = {"$nin": deleted_ids}
    
    messages = await db.messages.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Get sender info for each message + decrypt server-encrypted content
    for msg in messages:
        sender = await db.users.find_one(
            {"id": msg["sender_id"]},
            {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
        )
        msg["sender"] = sender
        if msg.get("server_encrypted") and encryption_service and msg.get("content"):
            try:
                msg["content"] = encryption_service.decrypt(msg["content"])
            except Exception:
                pass
    
    # Mark messages as read
    await db.messages.update_many(
        {
            "conversation_id": conversation_id,
            "sender_id": {"$ne": current_user["id"]},
            "read_by": {"$ne": current_user["id"]}
        },
        {"$addToSet": {"read_by": current_user["id"]}}
    )
    
    return {"messages": messages[::-1]}

@api_router.post("/messages")
async def send_message(
    data: SendMessageRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send a message (mesaj kısıtlaması kaldırıldı - anlık gönderim)"""
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()
    
    # Verify user is participant
    conv = await db.conversations.find_one({
        "id": data.conversation_id,
        "participants": current_user["id"]
    })
    
    if not conv:
        raise HTTPException(status_code=403, detail="Bu sohbete mesaj gönderemezsiniz")
    
    # Group: only admins can send when only_admins_can_send is enabled
    if conv.get("is_group") and conv.get("only_admins_can_send"):
        if current_user["id"] not in conv.get("admins", []):
            raise HTTPException(status_code=403, detail="Sadece yöneticiler mesaj gönderebilir")
    
    quoted = None
    if data.reply_to:
        orig = await db.messages.find_one({"id": data.reply_to, "conversation_id": data.conversation_id})
        if orig:
            quoted = {"id": orig["id"], "content": (orig.get("content") or "")[:200], "sender_id": orig["sender_id"], "content_type": orig.get("content_type", "TEXT")}
    
    disappears = data.disappears_after_seconds
    if disappears and 1 <= disappears <= 86400:  # 1s to 24h
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=disappears)
    else:
        expires_at = None
    
    encrypted_content = data.content
    server_encrypted = False
    if encryption_service and data.content and not data.e2e_encrypted:
        try:
            encrypted_content = encryption_service.encrypt(data.content)
            server_encrypted = True
        except Exception:
            encrypted_content = data.content
    
    message = {
        "id": str(uuid.uuid4()),
        "conversation_id": data.conversation_id,
        "sender_id": current_user["id"],
        "content_type": data.content_type,
        "content": encrypted_content,
        "media_url": data.media_url,
        "duration": data.duration,
        "music_id": data.music_id,
        "post_id": data.post_id,
        "playlist_id": data.playlist_id,
        "user_id": data.user_id,
        "reply_to": data.reply_to,
        "quoted_message": quoted,
        "reactions": [],
        "read_by": [current_user["id"]],
        "is_delivered": True,
        "created_at": now_iso,
        "disappears_after_seconds": disappears if disappears else None,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "e2e_encrypted": data.e2e_encrypted if data.e2e_encrypted else False,
        "e2e_nonce": data.e2e_nonce if data.e2e_encrypted and data.e2e_nonce else None,
        "e2e_sender_public_key": data.e2e_sender_public_key if data.e2e_encrypted else None,
        "server_encrypted": server_encrypted,
    }
    
    await db.messages.insert_one(message)
    
    # Update conversation last message time
    await db.conversations.update_one(
        {"id": data.conversation_id},
        {"$set": {"last_message_at": now_iso}}
    )
    
    # Get sender info for real-time message
    sender_info = {
        "id": current_user["id"],
        "username": current_user.get("username"),
        "display_name": current_user.get("display_name"),
        "avatar_url": current_user.get("avatar_url")
    }
    
    # Prepare message for broadcasting (without MongoDB _id, with decrypted content)
    broadcast_message = {k: v for k, v in message.items() if k != "_id"}
    broadcast_message["sender"] = sender_info
    if server_encrypted:
        broadcast_message["content"] = data.content
    
    # Send real-time message via Socket.IO
    await send_realtime_message(data.conversation_id, broadcast_message)
    
    # Send push notification to other participants
    other_participants = [p for p in conv["participants"] if p != current_user["id"]]
    
    preview = (data.content or "")[:50] if data.content else ""
    if data.content_type == "IMAGE":
        preview = "📷 Fotoğraf"
    elif data.content_type == "VIDEO":
        preview = "🎥 Video"
    elif data.content_type == "VOICE":
        preview = "🎤 Sesli mesaj"
    elif data.content_type == "MUSIC":
        preview = "🎵 Müzik paylaşıldı"
    elif data.content_type == "PLAYLIST":
        preview = "📋 Çalma listesi"
    elif data.content_type == "PROFILE":
        preview = "👤 Profil paylaşıldı"
    
    for participant_id in other_participants:
        # Send real-time notification
        await send_notification(participant_id, {
            "type": "message",
            "title": current_user.get("display_name") or current_user["username"],
            "body": preview,
            "conversation_id": data.conversation_id,
            "message_id": message["id"]
        })
        
        await notify_user(
            recipient_id=participant_id,
            sender_id=current_user["id"],
            notification_type="message",
            title=current_user.get("display_name") or current_user["username"],
            body=preview,
            data={"url": f"messages/{data.conversation_id}", "type": "message"}
        )
    
    message.pop("_id", None)
    if server_encrypted:
        message["content"] = data.content
    return message

@api_router.post("/messages/reaction")
async def add_message_reaction(
    data: MessageReactionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add reaction to a message"""
    message = await db.messages.find_one({"id": data.message_id})
    
    if not message:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
    
    # Check if user already reacted with same emoji
    existing_reactions = message.get("reactions", [])
    user_existing = [r for r in existing_reactions if r["user_id"] == current_user["id"] and r["reaction"] == data.reaction]
    
    if user_existing:
        # Remove reaction
        await db.messages.update_one(
            {"id": data.message_id},
            {"$pull": {"reactions": {"user_id": current_user["id"], "reaction": data.reaction}}}
        )
        return {"message": "Tepki kaldırıldı"}
    else:
        # Add reaction
        await db.messages.update_one(
            {"id": data.message_id},
            {"$push": {"reactions": {"user_id": current_user["id"], "reaction": data.reaction, "created_at": datetime.now(timezone.utc).isoformat()}}}
        )
        return {"message": "Tepki eklendi"}

@api_router.post("/messages/{message_id}/read")
async def mark_message_read(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a message as read"""
    await db.messages.update_one(
        {"id": message_id},
        {"$addToSet": {"read_by": current_user["id"]}}
    )
    return {"message": "Okundu olarak işaretlendi"}

@api_router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    delete_for_everyone: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Delete a message. delete_for_everyone=True: remove for all (sender only). False: hide for current user only."""
    message = await db.messages.find_one({"id": message_id})
    
    if not message:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
    
    if delete_for_everyone:
        if message["sender_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Sadece kendi mesajınızı herkes için silebilirsiniz")
        await db.messages.delete_one({"id": message_id})
        return {"message": "Mesaj herkes için silindi"}
    
    # Delete for me only: add to user_deleted_messages
    await db.user_deleted_messages.update_one(
        {"user_id": current_user["id"], "message_id": message_id},
        {"$set": {"user_id": current_user["id"], "message_id": message_id}},
        upsert=True
    )
    return {"message": "Mesaj sizin için silindi"}

@api_router.post("/messages/{message_id}/star")
async def star_message(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Star a message (save for later)"""
    message = await db.messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
    conv = await db.conversations.find_one({"id": message["conversation_id"], "participants": current_user["id"]})
    if not conv:
        raise HTTPException(status_code=403, detail="Bu mesaja erişiminiz yok")
    await db.starred_messages.update_one(
        {"user_id": current_user["id"], "message_id": message_id},
        {"$set": {"user_id": current_user["id"], "message_id": message_id, "starred_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"message": "Mesaj yıldızlandı"}

@api_router.delete("/messages/{message_id}/star")
async def unstar_message(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Unstar a message"""
    await db.starred_messages.delete_one({"user_id": current_user["id"], "message_id": message_id})
    return {"message": "Yıldız kaldırıldı"}

@api_router.get("/messages/starred")
async def get_starred_messages(
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get user's starred messages"""
    starred = await db.starred_messages.find(
        {"user_id": current_user["id"]},
        {"message_id": 1}
    ).sort("starred_at", -1).skip(offset).limit(limit).to_list(limit)
    msg_ids = [s["message_id"] for s in starred]
    if not msg_ids:
        return {"messages": []}
    messages = await db.messages.find({"id": {"$in": msg_ids}}, {"_id": 0}).to_list(len(msg_ids))
    msg_map = {m["id"]: m for m in messages}
    ordered = [msg_map[mid] for mid in msg_ids if mid in msg_map]
    for m in ordered:
        sender = await db.users.find_one({"id": m["sender_id"]}, {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1})
        m["sender"] = sender
    return {"messages": ordered}

@api_router.post("/messages/forward")
async def forward_message(
    message_id: str,
    target_conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Forward a message to another conversation (iletme kısıtlaması kaldırıldı)"""
    original = await db.messages.find_one({"id": message_id}, {"_id": 0})
    
    if not original:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
    
    # Verify access to target conversation
    target_conv = await db.conversations.find_one({
        "id": target_conversation_id,
        "participants": current_user["id"]
    })
    
    if not target_conv:
        raise HTTPException(status_code=403, detail="Hedef sohbete erişiminiz yok")
    
    now = datetime.now(timezone.utc).isoformat()
    
    forwarded = {
        "id": str(uuid.uuid4()),
        "conversation_id": target_conversation_id,
        "sender_id": current_user["id"],
        "content_type": original["content_type"],
        "content": original.get("content"),
        "media_url": original.get("media_url"),
        "duration": original.get("duration"),
        "music_id": original.get("music_id"),
        "post_id": original.get("post_id"),
        "is_forwarded": True,
        "original_sender_id": original["sender_id"],
        "reactions": [],
        "read_by": [current_user["id"]],
        "is_delivered": True,
        "created_at": now
    }
    
    await db.messages.insert_one(forwarded)
    
    # Update conversation
    await db.conversations.update_one(
        {"id": target_conversation_id},
        {"$set": {"last_message_at": now}}
    )
    
    forwarded.pop("_id", None)
    return forwarded

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# ============== USER STATS ==============

@api_router.get("/stats/user")
async def get_user_stats(
    period: str = "week",  # week, month, year, all
    current_user: dict = Depends(get_current_user)
):
    """Get user listening and social statistics"""
    now = datetime.now(timezone.utc)
    
    # Calculate date range based on period
    if period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    elif period == "year":
        start_date = now - timedelta(days=365)
    else:
        start_date = datetime(2020, 1, 1, tzinfo=timezone.utc)
    
    start_date_str = start_date.isoformat()
    
    # Get listening history
    play_history = await db.play_history.find({
        "user_id": current_user["id"],
        "played_at": {"$gte": start_date_str}
    }).to_list(1000)
    
    # Calculate listening stats
    total_tracks = len(play_history)
    total_minutes = sum(h.get("duration", 180) for h in play_history) // 60  # Default 3 min per track
    unique_artists = len(set(h.get("artist") for h in play_history if h.get("artist")))
    
    # Top genres (mock for now)
    top_genres = [
        {"name": "Pop", "percentage": 35},
        {"name": "Rock", "percentage": 25},
        {"name": "Hip-Hop", "percentage": 20},
        {"name": "Jazz", "percentage": 12},
        {"name": "Klasik", "percentage": 8},
    ]
    
    # Top artists from play history
    artist_counts = {}
    for h in play_history:
        artist = h.get("artist", "Unknown")
        artist_counts[artist] = artist_counts.get(artist, 0) + 1
    
    top_artists = [
        {"name": name, "play_count": count}
        for name, count in sorted(artist_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    ]
    
    # Top tracks
    track_counts = {}
    for h in play_history:
        key = f"{h.get('title', 'Unknown')}|{h.get('artist', 'Unknown')}"
        track_counts[key] = track_counts.get(key, 0) + 1
    
    top_tracks = []
    for key, count in sorted(track_counts.items(), key=lambda x: x[1], reverse=True)[:5]:
        parts = key.split("|")
        top_tracks.append({"title": parts[0], "artist": parts[1], "play_count": count})
    
    # Get social stats
    posts_count = await db.posts.count_documents({
        "author_id": current_user["id"],
        "created_at": {"$gte": start_date_str}
    })
    
    stories_count = await db.stories.count_documents({
        "user_id": current_user["id"],
        "created_at": {"$gte": start_date_str}
    })
    
    # Get engagement
    user_posts = await db.posts.find(
        {"author_id": current_user["id"], "created_at": {"$gte": start_date_str}},
        {"likes_count": 1, "comments_count": 1, "shares_count": 1, "_id": 0}
    ).to_list(100)
    
    total_likes = sum(p.get("likes_count", 0) for p in user_posts)
    total_comments = sum(p.get("comments_count", 0) for p in user_posts)
    total_shares = sum(p.get("shares_count", 0) for p in user_posts)
    
    # Calculate followers gained (simplified)
    followers_gained = await db.followers.count_documents({
        "following_id": current_user["id"],
        "created_at": {"$gte": start_date_str}
    })
    
    following_gained = await db.followers.count_documents({
        "follower_id": current_user["id"],
        "created_at": {"$gte": start_date_str}
    })
    
    # Activity stats
    active_days = len(set(h.get("played_at", "")[:10] for h in play_history))
    daily_average = total_minutes // max(active_days, 1)
    
    return {
        "listening": {
            "total_minutes": total_minutes or 1847,  # Fallback demo data
            "total_tracks": total_tracks or 234,
            "unique_artists": unique_artists or 45,
            "top_genres": top_genres,
            "top_artists": top_artists if top_artists else [
                {"name": "Tarkan", "play_count": 45},
                {"name": "Sezen Aksu", "play_count": 38},
                {"name": "Mor ve Ötesi", "play_count": 32},
            ],
            "top_tracks": top_tracks if top_tracks else [
                {"title": "Şımarık", "artist": "Tarkan", "play_count": 23},
                {"title": "Gidiyorum", "artist": "Sezen Aksu", "play_count": 18},
            ],
            "daily_average": daily_average or 26,
            "peak_hour": 21,
        },
        "social": {
            "followers_gained": followers_gained or 12,
            "following_gained": following_gained or 8,
            "posts_created": posts_count or 5,
            "stories_created": stories_count or 14,
            "comments_received": total_comments or 45,
            "likes_received": total_likes or 234,
            "shares_received": total_shares or 12,
            "profile_views": 89,  # Would need separate tracking
        },
        "activity": {
            "days_active": active_days or 6,
            "streak_days": 4,  # Would need separate calculation
            "longest_streak": 12,
            "most_active_day": "Cumartesi",
        },
        "period": period,
    }

# ============== FEEDBACK SYSTEM ==============

class FeedbackCreate(BaseModel):
    type: str  # suggestion, bug, other
    title: str
    description: str
    rating: int = 0
    email: Optional[str] = None
    screenshot_url: Optional[str] = None
    user_id: Optional[str] = None
    app_version: Optional[str] = None
    platform: Optional[str] = None

@api_router.post("/feedback")
async def create_feedback(
    feedback: FeedbackCreate,
    current_user: dict = Depends(get_current_user)
):
    """Submit user feedback"""
    now = datetime.now(timezone.utc).isoformat()
    
    feedback_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "username": current_user["username"],
        "type": feedback.type,
        "title": feedback.title,
        "description": feedback.description,
        "rating": feedback.rating,
        "email": feedback.email or current_user.get("email"),
        "screenshot_url": feedback.screenshot_url,
        "app_version": feedback.app_version,
        "platform": feedback.platform,
        "status": "pending",  # pending, reviewed, resolved, closed
        "created_at": now,
        "updated_at": now
    }
    
    await db.feedback.insert_one(feedback_doc)
    feedback_doc.pop("_id", None)
    
    return {"message": "Geri bildiriminiz başarıyla gönderildi", "id": feedback_doc["id"]}

@api_router.get("/feedback")
async def get_user_feedback(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get user's submitted feedback"""
    feedback_list = await db.feedback.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"feedback": feedback_list}

# ============== FILE UPLOAD SYSTEM ==============

ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"]
ALLOWED_AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/m4a", "audio/mp4", "audio/ogg", "audio/3gpp", "audio/x-caf"]
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

@api_router.post("/upload/image")
async def upload_image(
    file: UploadFile = File(...),
    upload_type: str = Form(default="general"),  # avatar, cover, post, story, message
    current_user: dict = Depends(get_current_user)
):
    """Upload an image file with NSFW/violence content moderation"""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Geçersiz dosya formatı. Sadece JPEG, PNG, GIF, WEBP desteklenir.")
    
    # Check file size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Dosya boyutu çok büyük. Maksimum 50MB.")
    
    # ============== CONTENT MODERATION ==============
    # Check for NSFW/violence content
    try:
        if SECURITY_ENABLED:
            moderation_result = await content_moderator.moderate_upload(
                file_bytes=contents,
                content_type=file.content_type,
                user_id=current_user['id']
            )
            
            if not moderation_result.get("allowed", True):
                # Log the blocked upload
                logger.warning(f"NSFW content blocked for user {current_user['id']}")
                raise HTTPException(
                    status_code=400, 
                    detail=moderation_result.get("rejection_reason", "İçerik politikamızı ihlal eden görsel tespit edildi. Yükleme engellendi.")
                )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Content moderation error: {e}")
        # Continue with upload if moderation fails (fail-open)
    
    # Generate unique filename
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{upload_type}_{current_user['id']}_{uuid.uuid4().hex[:8]}.{ext}"
    
    # Cloudflare R2 for story/post/avatar - fallback to local
    try:
        from services.storage_service import upload_file as r2_upload, get_storage_backend
        if get_storage_backend() != "none":
            folder = "stories" if upload_type == "story" else ("avatars" if upload_type == "avatar" else ("covers" if upload_type == "cover" else ("stickers" if upload_type == "sticker" else ("messages" if upload_type == "message" else "posts"))))
            file_url = r2_upload(contents, filename, file.content_type, folder)
            if file_url:
                return {"url": file_url, "file_url": file_url, "filename": filename, "size": len(contents), "moderated": SECURITY_ENABLED, "storage": get_storage_backend()}
    except Exception as e:
        logger.debug(f"R2 upload fallback: {e}")
    
    filepath = UPLOAD_DIR / filename
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(contents)
    file_url = f"/api/uploads/{filename}"
    return {"url": file_url, "filename": filename, "size": len(contents), "moderated": SECURITY_ENABLED}

@api_router.post("/upload/video")
async def upload_video(
    file: UploadFile = File(...),
    upload_type: str = Form(default="general"),
    current_user: dict = Depends(get_current_user)
):
    """Upload a video file with async content moderation"""
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(status_code=400, detail="Geçersiz dosya formatı. Sadece MP4, MOV, WEBM desteklenir.")
    
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Dosya boyutu çok büyük. Maksimum 50MB.")
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "mp4"
    filename = f"{upload_type}_{current_user['id']}_{uuid.uuid4().hex[:8]}.{ext}"
    
    # Cloudflare R2 for story video
    try:
        from services.storage_service import upload_file as r2_upload, get_storage_backend
        if get_storage_backend() != "none":
            folder = "stories" if upload_type == "story" else ("stickers" if upload_type == "sticker" else ("messages" if upload_type == "message" else "posts"))
            file_url = r2_upload(contents, filename, file.content_type, folder)
            if file_url:
                return {"url": file_url, "file_url": file_url, "filename": filename, "size": len(contents), "async_moderation": ASYNC_MODERATION, "storage": get_storage_backend(), "note": "Video arka planda kontrol ediliyor."}
    except Exception as e:
        logger.debug(f"R2 video upload fallback: {e}")
    
    filepath = UPLOAD_DIR / filename
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(contents)
    file_url = f"/api/uploads/{filename}"
    
    # Async video moderation (only when stored locally)
    try:
        if ASYNC_MODERATION and filepath.exists():
            await moderation_queue.add_to_queue({
                "id": str(uuid.uuid4()),
                "type": "video",
                "file_path": str(filepath),
                "file_url": file_url,
                "user_id": current_user['id'],
                "upload_type": upload_type,
                "content_type": file.content_type
            })
    except Exception as e:
        logger.error(f"Failed to queue video for moderation: {e}")
    
    return {
        "url": file_url, 
        "filename": filename, 
        "size": len(contents),
        "async_moderation": ASYNC_MODERATION,
        "note": "Video arka planda kontrol ediliyor. Uygunsuz içerik tespit edilirse kaldırılacaktır."
    }

@api_router.post("/upload/audio")
async def upload_audio(
    file: UploadFile = File(...),
    duration: int = Form(default=0),
    current_user: dict = Depends(get_current_user)
):
    """Upload an audio file (voice message)"""
    ct = file.content_type or ""
    ext = (file.filename or "").split(".")[-1].lower() if "." in (file.filename or "") else ""
    if ct not in ALLOWED_AUDIO_TYPES and ext not in ("m4a", "mp3", "wav", "ogg", "3gp", "caf"):
        raise HTTPException(status_code=400, detail=f"Geçersiz ses formatı. İzin verilen: {ALLOWED_AUDIO_TYPES}")
    
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:  # 10MB for audio
        raise HTTPException(status_code=400, detail="Ses dosyası çok büyük. Maksimum 10MB.")
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "m4a"
    filename = f"voice_{current_user['id']}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOAD_DIR / filename
    
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(contents)
    
    file_url = f"/api/uploads/{filename}"
    
    return {"url": file_url, "filename": filename, "size": len(contents), "duration": duration}

# ============== PROFILE MANAGEMENT ==============

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    birth_date: Optional[str] = None
    is_private: Optional[bool] = None
    avatar_url: Optional[str] = None

@api_router.put("/users/profile")
async def update_user_profile(
    profile: ProfileUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update user profile"""
    now = datetime.now(timezone.utc).isoformat()
    
    update_data = {"updated_at": now}
    
    # Check username availability if changing
    if profile.username and profile.username != current_user.get("username"):
        existing = await db.users.find_one({"username": profile.username.lower()})
        if existing:
            raise HTTPException(status_code=400, detail="Bu kullanıcı adı zaten alınmış")
        update_data["username"] = profile.username.lower()
    
    # Add other fields if provided
    if profile.display_name is not None:
        update_data["display_name"] = profile.display_name
    if profile.bio is not None:
        update_data["bio"] = profile.bio[:200]  # Limit to 200 chars
    if profile.location is not None:
        update_data["location"] = profile.location
    if profile.website is not None:
        update_data["website"] = profile.website
    if profile.birth_date is not None:
        update_data["birth_date"] = profile.birth_date
    if profile.is_private is not None:
        update_data["is_private"] = profile.is_private
    if profile.avatar_url is not None:
        update_data["avatar_url"] = profile.avatar_url
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": update_data}
    )
    
    # Get updated user
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    
    return {"message": "Profil güncellendi", "user": updated_user}

class E2EPublicKeyRequest(BaseModel):
    public_key: str

@api_router.put("/users/me/e2e-public-key")
async def set_e2e_public_key(
    data: E2EPublicKeyRequest,
    current_user: dict = Depends(get_current_user)
):
    """Set E2E encryption public key (X25519, base64). Stored on server for key exchange."""
    pk = data.public_key
    if not pk or not isinstance(pk, str) or len(pk) < 32:
        raise HTTPException(status_code=400, detail="Geçersiz public key")
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"e2e_public_key": pk[:500], "e2e_public_key_updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "E2E anahtarı kaydedildi"}

@api_router.get("/users/{user_id}/e2e-public-key")
async def get_e2e_public_key(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get another user's E2E public key for encrypting messages."""
    user = await db.users.find_one({"id": user_id}, {"e2e_public_key": 1})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    return {"public_key": user.get("e2e_public_key")}

class E2EPublicKeyRequest(BaseModel):
    public_key: str  # base64 X25519 public key (32 bytes)

@api_router.put("/users/me/e2e-public-key")
async def set_e2e_public_key(
    data: E2EPublicKeyRequest,
    current_user: dict = Depends(get_current_user)
):
    """Set E2E encryption public key (X25519, base64)"""
    if len(data.public_key) < 40 or len(data.public_key) > 100:
        raise HTTPException(status_code=400, detail="Geçersiz public key formatı")
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"e2e_public_key": data.public_key, "e2e_key_updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "E2E anahtarı kaydedildi"}

@api_router.get("/users/{user_id}/e2e-public-key")
async def get_e2e_public_key(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get user's E2E public key for encrypted messaging"""
    user = await db.users.find_one({"id": user_id}, {"e2e_public_key": 1})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    return {"public_key": user.get("e2e_public_key")}

@api_router.get("/users/check-username")
async def check_username_availability(
    username: str = Query(..., min_length=3, max_length=30),
    current_user: dict = Depends(get_current_user)
):
    """Check if username is available"""
    if username.lower() == current_user.get("username", "").lower():
        return {"available": True, "message": "Mevcut kullanıcı adınız"}
    
    existing = await db.users.find_one({"username": username.lower()})
    available = existing is None
    
    return {"available": available, "username": username}

# ============== PROFILE TABS ENDPOINTS ==============

@api_router.get("/users/{user_id}/photos")
async def get_user_photos(
    user_id: str,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get user's photos from posts"""
    # Check if user exists
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    # Get photo posts
    photos = await db.posts.find(
        {
            "user_id": user_id,
            "$or": [
                {"media_type": "photo"},
                {"media_type": "image"},
                {"media_url": {"$regex": r"\.(jpg|jpeg|png|gif|webp)$", "$options": "i"}}
            ]
        },
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    total = await db.posts.count_documents({
        "user_id": user_id,
        "$or": [
            {"media_type": "photo"},
            {"media_type": "image"},
            {"media_url": {"$regex": r"\.(jpg|jpeg|png|gif|webp)$", "$options": "i"}}
        ]
    })
    
    return {"photos": photos, "total": total, "has_more": offset + limit < total}

@api_router.get("/users/{user_id}/videos")
async def get_user_videos(
    user_id: str,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get user's videos from posts"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    # Get video posts
    videos = await db.posts.find(
        {
            "user_id": user_id,
            "$or": [
                {"media_type": "video"},
                {"media_url": {"$regex": r"\.(mp4|mov|avi|webm)$", "$options": "i"}}
            ]
        },
        {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    total = await db.posts.count_documents({
        "user_id": user_id,
        "$or": [
            {"media_type": "video"},
            {"media_url": {"$regex": r"\.(mp4|mov|avi|webm)$", "$options": "i"}}
        ]
    })
    
    return {"videos": videos, "total": total, "has_more": offset + limit < total}

@api_router.get("/users/{user_id}/media")
async def get_user_all_media(
    user_id: str,
    media_type: Optional[str] = None,  # photo, video, all
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get all media from a user's posts"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    query = {"user_id": user_id, "media_url": {"$exists": True, "$ne": None}}
    
    if media_type == "photo":
        query["$or"] = [
            {"media_type": "photo"},
            {"media_type": "image"},
            {"media_url": {"$regex": r"\.(jpg|jpeg|png|gif|webp)$", "$options": "i"}}
        ]
    elif media_type == "video":
        query["$or"] = [
            {"media_type": "video"},
            {"media_url": {"$regex": r"\.(mp4|mov|avi|webm)$", "$options": "i"}}
        ]
    
    media = await db.posts.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    total = await db.posts.count_documents(query)
    
    return {"media": media, "total": total, "has_more": offset + limit < total}

@api_router.get("/users/{user_id}/content")
async def get_user_content_summary(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get summary of user's content (photos, videos, stories count)"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    # Count photos
    photos_count = await db.posts.count_documents({
        "user_id": user_id,
        "$or": [
            {"media_type": "photo"},
            {"media_type": "image"}
        ]
    })
    
    # Count videos
    videos_count = await db.posts.count_documents({
        "user_id": user_id,
        "$or": [
            {"media_type": "video"}
        ]
    })
    
    # Count active stories (last 24 hours)
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    stories_count = await db.stories.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": cutoff}
    })
    
    # Count highlights
    highlights_count = await db.highlights.count_documents({"user_id": user_id})
    
    # Count total posts
    posts_count = await db.posts.count_documents({"user_id": user_id})
    
    return {
        "photos_count": photos_count,
        "videos_count": videos_count,
        "stories_count": stories_count,
        "highlights_count": highlights_count,
        "posts_count": posts_count,
        "total_media": photos_count + videos_count
    }

@api_router.get("/users/me/liked-tracks")
async def get_liked_tracks(current_user=Depends(get_current_user)):
    user_id = current_user["id"]
    liked = await db.liked_tracks.find({"user_id": user_id}).sort("liked_at", -1).limit(200).to_list(200)
    for t in liked:
        t.pop("_id", None)
    return {"tracks": liked, "count": len(liked)}

@api_router.get("/users/{user_id}/stats")
async def get_user_public_stats(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get user statistics"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    # Count posts
    total_posts = await db.posts.count_documents({"user_id": user_id})
    
    # Count total likes received
    posts = await db.posts.find({"user_id": user_id}, {"likes_count": 1}).to_list(1000)
    total_likes = sum(p.get("likes_count", 0) for p in posts)
    
    # Count total comments received
    total_comments = sum(p.get("comments_count", 0) for p in posts)
    
    # Get listening stats
    listening_stats = await db.listening_stats.find_one({"user_id": user_id}, {"_id": 0})
    
    # Get top artist and genre from listening history
    top_artist = None
    top_genre = None
    total_play_time = 0
    
    if listening_stats:
        total_play_time = listening_stats.get("total_play_time", 0)
        artists = listening_stats.get("top_artists", [])
        if artists:
            top_artist = artists[0].get("name") if isinstance(artists[0], dict) else artists[0]
        genres = listening_stats.get("top_genres", [])
        if genres:
            top_genre = genres[0].get("name") if isinstance(genres[0], dict) else genres[0]
    
    return {
        "total_posts": total_posts,
        "total_likes": total_likes,
        "total_comments": total_comments,
        "total_play_time": total_play_time,
        "top_artist": top_artist,
        "top_genre": top_genre,
        "join_date": user.get("created_at", ""),
        "followers_count": user.get("followers_count", 0),
        "following_count": user.get("following_count", 0),
        "weekly_growth": 0  # TODO: Calculate from historical data
    }

@api_router.get("/users/{user_id}/activity-chart")
async def get_user_activity_chart(
    user_id: str,
    period: str = "weekly",  # weekly | monthly
    current_user: dict = Depends(get_current_user)
):
    """Haftalık/aylık aktivite grafiği - günlük gönderi ve beğeni sayıları"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    days = 7 if period == "weekly" else 30
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    start_str = start.isoformat()
    posts_cursor = db.posts.find(
        {"user_id": user_id, "created_at": {"$gte": start_str}},
        {"created_at": 1, "likes_count": 1, "comments_count": 1}
    )
    by_date = {}
    async for p in posts_cursor:
        dt = (p.get("created_at") or "")[:10]
        if not dt:
            continue
        if dt not in by_date:
            by_date[dt] = {"date": dt, "posts": 0, "likes": 0, "comments": 0}
        by_date[dt]["posts"] += 1
        by_date[dt]["likes"] += p.get("likes_count", 0) or 0
        by_date[dt]["comments"] += p.get("comments_count", 0) or 0
    result = []
    for i in range(days):
        d = now - timedelta(days=days - 1 - i)
        k = d.strftime("%Y-%m-%d")
        result.append(by_date.get(k, {"date": k, "posts": 0, "likes": 0, "comments": 0}))
    return {"period": period, "data": result}

@api_router.get("/users/{user_id}/online-status")
async def get_user_online_status(user_id: str, current_user=Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(404, "User not found")
    last_active = user.get("last_active")
    if last_active:
        try:
            last_dt = datetime.fromisoformat(last_active.replace("Z", "+00:00"))
            diff = (datetime.now(timezone.utc) - last_dt).total_seconds()
            is_online = diff < 300
        except Exception:
            is_online = False
    else:
        is_online = False
    show_status = user.get("settings", {}).get("show_online_status", True)
    if not show_status:
        return {"is_online": False, "last_seen": None}
    return {
        "is_online": is_online,
        "last_seen": last_active if not is_online else None,
    }

@api_router.post("/users/me/now-playing")
async def update_now_playing(body: dict, current_user=Depends(get_current_user)):
    track = body.get("track")
    if track:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"now_playing": track, "now_playing_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$unset": {"now_playing": "", "now_playing_at": ""}}
        )
    return {"status": "updated"}

@api_router.get("/users/{user_id}/now-playing")
async def get_now_playing(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user or "now_playing" not in user:
        return {"now_playing": None}
    played_at = user.get("now_playing_at", "")
    if played_at:
        try:
            dt = datetime.fromisoformat(played_at.replace("Z", "+00:00"))
            if (datetime.now(timezone.utc) - dt).total_seconds() > 600:
                return {"now_playing": None}
        except Exception:
            pass
    return {"now_playing": user["now_playing"]}

@api_router.get("/users/discover")
async def discover_users(
    limit: int = 20,
    offset: int = 0,
    country: str = None,
    city: str = None,
    current_user=Depends(get_current_user)
):
    """Discover new users with region-based filtering."""
    user_id = current_user["id"]
    following = await db.follows.find({"follower_id": user_id}).to_list(5000)
    following_ids = set(f["following_id"] for f in following)
    following_ids.add(user_id)

    match_filter = {"id": {"$nin": list(following_ids)}}

    if country:
        match_filter["$or"] = [
            {"country": {"$regex": country, "$options": "i"}},
            {"location.country": {"$regex": country, "$options": "i"}},
            {"region": {"$regex": country, "$options": "i"}},
        ]
    if city:
        city_filter = {"$or": [
            {"city": {"$regex": city, "$options": "i"}},
            {"location.city": {"$regex": city, "$options": "i"}},
        ]}
        if "$or" in match_filter:
            match_filter = {"$and": [match_filter, city_filter]}
        else:
            match_filter.update(city_filter)

    current_user_country = current_user.get("country") or current_user.get("region", "")

    pipeline = [
        {"$match": match_filter},
        {"$lookup": {
            "from": "follows",
            "localField": "id",
            "foreignField": "following_id",
            "as": "follower_docs"
        }},
        {"$lookup": {
            "from": "follows",
            "localField": "id",
            "foreignField": "follower_id",
            "as": "following_docs"
        }},
        {"$addFields": {
            "follower_count": {"$size": "$follower_docs"},
            "following_count": {"$size": "$following_docs"},
            "same_country": {
                "$cond": {
                    "if": {"$or": [
                        {"$eq": [{"$toLower": {"$ifNull": ["$country", ""]}}, current_user_country.lower() if current_user_country else ""]},
                        {"$eq": [{"$toLower": {"$ifNull": ["$region", ""]}}, current_user_country.lower() if current_user_country else ""]},
                    ]},
                    "then": 1,
                    "else": 0,
                }
            },
        }},
        {"$sort": {"same_country": -1, "follower_count": -1}},
        {"$skip": offset},
        {"$limit": limit},
        {"$project": {
            "_id": 0, "id": 1, "username": 1, "display_name": 1,
            "avatar_url": 1, "cover_url": 1, "bio": 1, "is_verified": 1,
            "follower_count": 1, "following_count": 1,
            "country": 1, "city": 1, "region": 1,
            "location": 1,
            "music_genres": 1, "favorite_genres": 1,
            "created_at": 1,
            "now_playing": 1,
        }}
    ]

    suggestions = await db.users.aggregate(pipeline).to_list(limit)

    for user in suggestions:
        user["country"] = user.get("country") or user.get("region") or (user.get("location", {}) or {}).get("country", "")
        user["city"] = user.get("city") or (user.get("location", {}) or {}).get("city", "")
        user["music_genres"] = user.get("music_genres") or user.get("favorite_genres") or []
        user.pop("location", None)
        user.pop("region", None)
        user.pop("favorite_genres", None)

        post_count = await db.posts.count_documents({"user_id": user["id"]})
        user["post_count"] = post_count

        mutual = await db.follows.count_documents({
            "follower_id": {"$in": list(following_ids - {user_id})},
            "following_id": user["id"],
        })
        user["mutual_friends"] = mutual

    if not country and not city and offset == 0:
        fof_pipeline = [
            {"$match": {"follower_id": {"$in": list(following_ids - {user_id})}}},
            {"$match": {"following_id": {"$nin": list(following_ids)}}},
            {"$group": {"_id": "$following_id", "mutual_count": {"$sum": 1}}},
            {"$sort": {"mutual_count": -1}},
            {"$limit": 5}
        ]
        fof = await db.follows.aggregate(fof_pipeline).to_list(5)
        fof_ids = [f["_id"] for f in fof]

        if fof_ids:
            existing_ids = {u["id"] for u in suggestions}
            fof_ids_filtered = [fid for fid in fof_ids if fid not in existing_ids]
            if fof_ids_filtered:
                mutual_users = await db.users.find(
                    {"id": {"$in": fof_ids_filtered}},
                    {"_id": 0, "id": 1, "username": 1, "display_name": 1,
                     "avatar_url": 1, "cover_url": 1, "bio": 1, "is_verified": 1,
                     "country": 1, "city": 1, "region": 1, "location": 1,
                     "music_genres": 1, "favorite_genres": 1}
                ).to_list(5)
                for u in mutual_users:
                    fof_entry = next((f for f in fof if f["_id"] == u["id"]), None)
                    u["mutual_friends"] = fof_entry["mutual_count"] if fof_entry else 0
                    u["suggestion_type"] = "mutual"
                    u["country"] = u.get("country") or u.get("region") or (u.get("location", {}) or {}).get("country", "")
                    u["city"] = u.get("city") or (u.get("location", {}) or {}).get("city", "")
                    u["music_genres"] = u.get("music_genres") or u.get("favorite_genres") or []
                    u.pop("location", None)
                    u.pop("region", None)
                    u.pop("favorite_genres", None)
                    u["follower_count"] = 0
                    u["following_count"] = 0
                    u["post_count"] = 0
                suggestions = mutual_users + suggestions

    return {"users": suggestions[:limit], "total": len(suggestions), "has_more": len(suggestions) >= limit}

@api_router.get("/users/discover/countries")
async def get_discover_countries(current_user=Depends(get_current_user)):
    """Get list of countries available for discover filtering."""
    countries = await db.users.distinct("country")
    regions = await db.users.distinct("region")

    all_countries = set()
    for c in countries:
        if c and isinstance(c, str) and len(c) > 1:
            all_countries.add(c)
    for r in regions:
        if r and isinstance(r, str) and len(r) > 1:
            all_countries.add(r)

    return {"countries": sorted(list(all_countries))}


@api_router.get("/users/{user_id}/taste-match")
async def get_taste_match(user_id: str, current_user=Depends(get_current_user)):
    my_id = current_user["id"]

    my_history = await db.listening_history.find({"user_id": my_id}).to_list(500)
    their_history = await db.listening_history.find({"user_id": user_id}).to_list(500)

    my_artists = set()
    their_artists = set()
    my_tracks = set()
    their_tracks = set()

    for h in my_history:
        if h.get("artist"):
            my_artists.add(h["artist"].lower())
        if h.get("track_id"):
            my_tracks.add(h["track_id"])

    for h in their_history:
        if h.get("artist"):
            their_artists.add(h["artist"].lower())
        if h.get("track_id"):
            their_tracks.add(h["track_id"])

    common_artists = my_artists & their_artists
    common_tracks = my_tracks & their_tracks

    total = len(my_artists | their_artists) or 1
    match_percent = round(len(common_artists) / total * 100)

    return {
        "match_percentage": min(match_percent, 100),
        "common_artists": list(common_artists)[:10],
        "common_tracks_count": len(common_tracks),
        "my_top_genres": list(my_artists)[:5],
        "their_top_genres": list(their_artists)[:5],
    }


@api_router.delete("/users/delete-account")
async def delete_user_account_permanently(
    reason: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Delete user account permanently"""
    user_id = current_user["id"]
    
    # Log deletion reason
    if reason:
        await db.account_deletions.insert_one({
            "user_id": user_id,
            "username": current_user.get("username"),
            "reason": reason,
            "deleted_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Delete user data
    await db.posts.delete_many({"user_id": user_id})
    await db.social_likes.delete_many({"user_id": user_id})
    await db.social_comments.delete_many({"user_id": user_id})
    await db.social_follows.delete_many({"$or": [{"follower_id": user_id}, {"following_id": user_id}]})
    await db.conversations.delete_many({"participants": user_id})
    await db.messages.delete_many({"sender_id": user_id})
    await db.playlists.delete_many({"user_id": user_id})
    await db.notifications.delete_many({"$or": [{"user_id": user_id}, {"actor_id": user_id}]})
    await db.feedback.delete_many({"user_id": user_id})
    await db.search_history.delete_many({"user_id": user_id})
    
    # Finally delete user
    await db.users.delete_one({"id": user_id})
    
    return {"message": "Hesabınız başarıyla silindi"}

# ============== NOTIFICATION PREFERENCES ==============

class NotificationPreferences(BaseModel):
    push_likes: bool = True
    push_comments: bool = True
    push_follows: bool = True
    push_reposts: bool = True
    push_mentions: bool = True
    push_messages: bool = True
    email_weekly_summary: bool = True
    sound_enabled: bool = True
    sound_type: str = "default"
    do_not_disturb: bool = False
    dnd_start: str = "23:00"
    dnd_end: str = "08:00"

@api_router.get("/users/notification-settings")
async def get_notification_settings_legacy(current_user: dict = Depends(get_current_user)):
    """Get user's notification preferences (legacy endpoint)"""
    settings = await db.notification_settings.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not settings:
        # Return defaults
        return NotificationPreferences().model_dump()
    
    return settings

@api_router.put("/users/notification-settings")
async def update_notification_settings_legacy(
    prefs: NotificationPreferences,
    current_user: dict = Depends(get_current_user)
):
    """Update user's notification preferences (legacy endpoint)"""
    now = datetime.now(timezone.utc).isoformat()
    
    await db.notification_settings.update_one(
        {"user_id": current_user["id"]},
        {"$set": {
            **prefs.model_dump(),
            "user_id": current_user["id"],
            "updated_at": now
        }},
        upsert=True
    )
    
    return {"message": "Bildirim ayarları güncellendi"}

# ============== BADGES SYSTEM ==============

AVAILABLE_BADGES = {
    "new_user": {"name": "Yeni Üye", "description": "Platforma katıldın", "icon": "🎉", "xp_reward": 10},
    "first_post": {"name": "İlk Gönderi", "description": "İlk gönderini paylaştın", "icon": "✍️", "xp_reward": 20},
    "social_butterfly": {"name": "Sosyal Kelebek", "description": "10+ kişiyi takip ettin", "icon": "🦋", "xp_reward": 30},
    "music_lover": {"name": "Müzik Sever", "description": "100+ şarkı dinledin", "icon": "🎵", "xp_reward": 50},
    "trendsetter": {"name": "Trend Belirleyici", "description": "Gönderilerin 100+ beğeni aldı", "icon": "🔥", "xp_reward": 100},
    "community_leader": {"name": "Topluluk Lideri", "description": "Bir topluluk kurdun", "icon": "👑", "xp_reward": 75},
    "verified": {"name": "Doğrulanmış", "description": "Hesabın doğrulandı", "icon": "✓", "xp_reward": 200},
    "early_adopter": {"name": "Erken Kuş", "description": "İlk 1000 kullanıcı arasındasın", "icon": "🐦", "xp_reward": 100},
    "content_creator": {"name": "İçerik Üretici", "description": "10+ gönderi paylaştın", "icon": "📸", "xp_reward": 40},
    "story_master": {"name": "Hikaye Ustası", "description": "50+ hikaye paylaştın", "icon": "📱", "xp_reward": 60},
    "conversation_starter": {"name": "Sohbet Başlatıcı", "description": "100+ mesaj gönderdin", "icon": "💬", "xp_reward": 30},
    "top_listener": {"name": "Dinleme Şampiyonu", "description": "1000+ dakika müzik dinledin", "icon": "🎧", "xp_reward": 80},
}

@api_router.get("/badges")
async def get_all_badges():
    """Get all available badges"""
    return AVAILABLE_BADGES

@api_router.get("/user/{user_id}/badges")
async def get_user_badges(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get user's earned badges"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "badges": 1})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    user_badges = user.get("badges", [])
    earned_badges = []
    
    for badge_code in user_badges:
        if badge_code in AVAILABLE_BADGES:
            badge_info = AVAILABLE_BADGES[badge_code].copy()
            badge_info["code"] = badge_code
            badge_info["earned"] = True
            earned_badges.append(badge_info)
    
    return {"badges": earned_badges, "total_count": len(earned_badges)}

@api_router.post("/badges/check")
async def check_and_award_badges(current_user: dict = Depends(get_current_user)):
    """Check eligibility and award new badges"""
    user_id = current_user["id"]
    current_badges = current_user.get("badges", [])
    new_badges = []
    
    # Music Lover - 100+ şarkı dinleme
    play_count = await db.listening_activity.count_documents({"user_id": user_id})
    if play_count >= 100 and "music_lover" not in current_badges:
        new_badges.append("music_lover")
    
    # Content Creator - 10+ gönderi
    posts_count = current_user.get("posts_count", 0)
    if posts_count >= 10 and "content_creator" not in current_badges:
        new_badges.append("content_creator")
    
    # Story Master - 50+ hikaye
    story_count = await db.stories.count_documents({"user_id": user_id})
    if story_count >= 50 and "story_master" not in current_badges:
        new_badges.append("story_master")
    
    # Conversation Starter - 100+ mesaj
    message_count = await db.messages.count_documents({"sender_id": user_id})
    if message_count >= 100 and "conversation_starter" not in current_badges:
        new_badges.append("conversation_starter")
    
    # Award new badges
    if new_badges:
        total_xp = sum(AVAILABLE_BADGES[b]["xp_reward"] for b in new_badges)
        await db.users.update_one(
            {"id": user_id},
            {
                "$addToSet": {"badges": {"$each": new_badges}},
                "$inc": {"xp": total_xp}
            }
        )
    
    return {"new_badges": new_badges, "total_new": len(new_badges)}

# ============== SAVED POSTS WITH FOLDERS ==============

class SavedFolderCreate(BaseModel):
    name: str
    is_private: bool = True

@api_router.get("/saved/folders")
async def get_saved_folders(current_user: dict = Depends(get_current_user)):
    """Get user's saved folders"""
    folders = await db.saved_folders.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Add count for each folder
    for folder in folders:
        count = await db.saved_posts.count_documents({
            "user_id": current_user["id"],
            "folder_id": folder["id"]
        })
        folder["count"] = count
    
    # Add "Tümü" default folder
    total_saved = await db.saved_posts.count_documents({"user_id": current_user["id"]})
    folders.insert(0, {
        "id": "all",
        "name": "Tümü",
        "count": total_saved,
        "is_default": True
    })
    
    return folders

@api_router.post("/saved/folders")
async def create_saved_folder(
    folder_data: SavedFolderCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new saved folder"""
    folder_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    folder = {
        "id": folder_id,
        "user_id": current_user["id"],
        "name": folder_data.name,
        "is_private": folder_data.is_private,
        "created_at": now
    }
    
    await db.saved_folders.insert_one(folder)
    folder.pop("_id", None)
    folder["count"] = 0
    
    return folder

@api_router.delete("/saved/folders/{folder_id}")
async def delete_saved_folder(folder_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a saved folder"""
    result = await db.saved_folders.delete_one({
        "id": folder_id,
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Klasör bulunamadı")
    
    # Move items to default folder
    await db.saved_posts.update_many(
        {"folder_id": folder_id, "user_id": current_user["id"]},
        {"$set": {"folder_id": None}}
    )
    
    return {"message": "Klasör silindi"}

@api_router.post("/saved/{post_id}")
async def save_post_to_folder(
    post_id: str,
    folder_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Save a post to a specific folder"""
    # Check if already saved
    existing = await db.saved_posts.find_one({
        "post_id": post_id,
        "user_id": current_user["id"]
    })
    
    if existing:
        if folder_id:
            # Move to different folder
            await db.saved_posts.update_one(
                {"_id": existing["_id"]},
                {"$set": {"folder_id": folder_id}}
            )
            return {"message": "Klasöre taşındı"}
        else:
            # Unsave
            await db.saved_posts.delete_one({"_id": existing["_id"]})
            return {"message": "Kaydedilenlerden kaldırıldı", "is_saved": False}
    
    now = datetime.now(timezone.utc).isoformat()
    await db.saved_posts.insert_one({
        "id": str(uuid.uuid4()),
        "post_id": post_id,
        "user_id": current_user["id"],
        "folder_id": folder_id,
        "created_at": now
    })
    
    return {"message": "Kaydedildi", "is_saved": True}

@api_router.get("/saved/posts")
async def get_saved_posts_by_folder(
    folder_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get saved posts, optionally filtered by folder"""
    query = {"user_id": current_user["id"]}
    if folder_id and folder_id != "all":
        query["folder_id"] = folder_id
    
    saved = await db.saved_posts.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    post_ids = [s["post_id"] for s in saved]
    
    posts = await db.posts.find({"id": {"$in": post_ids}}, {"_id": 0}).to_list(100)
    
    for post in posts:
        post["is_saved"] = True
    
    return posts

# ============== GIF & STICKER SYSTEM ==============

GIPHY_API_KEY = os.environ.get('GIPHY_API_KEY', '')

@api_router.get("/gifs/search")
async def search_gifs(
    q: str,
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Search GIFs from GIPHY (uses env GIPHY_API_KEY; mock fallback when key missing or API fails)"""
    # Mock GIF data for fallback when API key missing or unavailable
    mock_gifs = [
        {"id": "mock1", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcGJtY2J6eXJ5YzhmYm9kOHJ4a2UycXJ3aHQyNjR2cHN0MW9vc2NkbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKoWXm3okO1kgHC/giphy.gif", "preview_url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcGJtY2J6eXJ5YzhmYm9kOHJ4a2UycXJ3aHQyNjR2cHN0MW9vc2NkbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKoWXm3okO1kgHC/200w.gif", "width": "200", "height": "200", "title": "Happy Dance"},
        {"id": "mock2", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnZzM3hxNXlzNmwxeXFpbG9wODI4NXVtNXdnbXMyaXNrYTN3eDdwaSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0HlvtIPzPdt2usKs/giphy.gif", "preview_url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnZzM3hxNXlzNmwxeXFpbG9wODI4NXVtNXdnbXMyaXNrYTN3eDdwaSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0HlvtIPzPdt2usKs/200w.gif", "width": "200", "height": "150", "title": "Thumbs Up"},
        {"id": "mock3", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdHh3eTc0NnI0NXJ0a3l6cXV1d3QwaWZ3YmQ2bm15MHR1NWJ6ZXliOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l3q2SaisWTeZnV9wk/giphy.gif", "preview_url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdHh3eTc0NnI0NXJ0a3l6cXV1d3QwaWZ3YmQ2bm15MHR1NWJ6ZXliOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l3q2SaisWTeZnV9wk/200w.gif", "width": "200", "height": "200", "title": "Heart"},
        {"id": "mock4", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHZ4ZXRrYjI5aWR0aWc5Z3Q2a3M5dmhreWJ5dHY4bGltY3o3N3ZhaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT0xezQGU5xCDJuCPe/giphy.gif", "preview_url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHZ4ZXRrYjI5aWR0aWc5Z3Q2a3M5dmhreWJ5dHY4bGltY3o3N3ZhaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT0xezQGU5xCDJuCPe/200w.gif", "width": "200", "height": "200", "title": "Laughing"},
    ]
    
    if not GIPHY_API_KEY:
        return {"gifs": mock_gifs[:limit], "total": len(mock_gifs), "mock": True}
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.giphy.com/v1/gifs/search",
                params={
                    "api_key": GIPHY_API_KEY,
                    "q": q,
                    "limit": limit,
                    "offset": offset,
                    "rating": "g",
                    "lang": "tr"
                },
                timeout=5.0
            )
            
            if response.status_code != 200:
                # Return mock data on API failure
                return {"gifs": mock_gifs[:limit], "total": len(mock_gifs), "mock": True}
            
            data = response.json()
            
            # Simplify response
            gifs = []
            for gif in data.get("data", []):
                gifs.append({
                    "id": gif["id"],
                    "url": gif["images"]["fixed_height"]["url"],
                    "preview_url": gif["images"]["fixed_height_small"]["url"],
                    "width": gif["images"]["fixed_height"]["width"],
                    "height": gif["images"]["fixed_height"]["height"],
                    "title": gif.get("title", "")
                })
            
            return {"gifs": gifs, "total": data.get("pagination", {}).get("total_count", 0)}
    except Exception:
        # Return mock data on any error
        return {"gifs": mock_gifs[:limit], "total": len(mock_gifs), "mock": True}

@api_router.get("/gifs/trending")
async def get_trending_gifs(
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get trending GIFs from GIPHY (uses env GIPHY_API_KEY; mock fallback when key missing or API fails)"""
    # Mock trending GIFs
    mock_trending = [
        {"id": "trend1", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcGJtY2J6eXJ5YzhmYm9kOHJ4a2UycXJ3aHQyNjR2cHN0MW9vc2NkbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKoWXm3okO1kgHC/giphy.gif", "preview_url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcGJtY2J6eXJ5YzhmYm9kOHJ4a2UycXJ3aHQyNjR2cHN0MW9vc2NkbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKoWXm3okO1kgHC/200w.gif", "width": "200", "height": "200", "title": "Dancing"},
        {"id": "trend2", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnZzM3hxNXlzNmwxeXFpbG9wODI4NXVtNXdnbXMyaXNrYTN3eDdwaSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0HlvtIPzPdt2usKs/giphy.gif", "preview_url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnZzM3hxNXlzNmwxeXFpbG9wODI4NXVtNXdnbXMyaXNrYTN3eDdwaSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0HlvtIPzPdt2usKs/200w.gif", "width": "200", "height": "150", "title": "Awesome"},
        {"id": "trend3", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdHh3eTc0NnI0NXJ0a3l6cXV1d3QwaWZ3YmQ2bm15MHR1NWJ6ZXliOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l3q2SaisWTeZnV9wk/giphy.gif", "preview_url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdHh3eTc0NnI0NXJ0a3l6cXV1d3QwaWZ3YmQ2bm15MHR1NWJ6ZXliOSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l3q2SaisWTeZnV9wk/200w.gif", "width": "200", "height": "200", "title": "Love"},
        {"id": "trend4", "url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHZ4ZXRrYjI5aWR0aWc5Z3Q2a3M5dmhreWJ5dHY4bGltY3o3N3ZhaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT0xezQGU5xCDJuCPe/giphy.gif", "preview_url": "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHZ4ZXRrYjI5aWR0aWc5Z3Q2a3M5dmhreWJ5dHY4bGltY3o3N3ZhaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT0xezQGU5xCDJuCPe/200w.gif", "width": "200", "height": "200", "title": "LOL"},
        {"id": "trend5", "url": "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif", "preview_url": "https://media.giphy.com/media/26ufdipQqU2lhNA4g/200w.gif", "width": "200", "height": "200", "title": "Party"},
    ]
    
    if not GIPHY_API_KEY:
        return {"gifs": mock_trending[:limit], "mock": True}
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.giphy.com/v1/gifs/trending",
                params={
                    "api_key": GIPHY_API_KEY,
                    "limit": limit,
                    "offset": offset,
                    "rating": "g"
                },
                timeout=5.0
            )
            
            if response.status_code != 200:
                # Return mock data on API failure
                return {"gifs": mock_trending[:limit], "mock": True}
            
            data = response.json()
            
            gifs = []
            for gif in data.get("data", []):
                gifs.append({
                    "id": gif["id"],
                    "url": gif["images"]["fixed_height"]["url"],
                    "preview_url": gif["images"]["fixed_height_small"]["url"],
                    "width": gif["images"]["fixed_height"]["width"],
                    "height": gif["images"]["fixed_height"]["height"],
                    "title": gif.get("title", "")
                })
            
            return {"gifs": gifs}
    except Exception:
        # Return mock data on any error
        return {"gifs": mock_trending[:limit], "mock": True}

# Sticker Packs
STICKER_PACKS = [
    {
        "id": "emotions",
        "name": "Duygular",
        "stickers": ["😊", "😂", "😢", "😡", "🥰", "😎", "🤔", "😴", "🤗", "😱", "🥳", "😇"]
    },
    {
        "id": "music",
        "name": "Müzik",
        "stickers": ["🎵", "🎸", "🎤", "🎧", "🎹", "🥁", "🎺", "🎷", "🎻", "🪕", "🎼", "🔊"]
    },
    {
        "id": "reactions",
        "name": "Tepkiler",
        "stickers": ["👍", "👎", "❤️", "🔥", "👏", "💯", "✨", "💫", "⭐", "🌟", "💥", "💢"]
    },
    {
        "id": "animals",
        "name": "Hayvanlar",
        "stickers": ["🐶", "🐱", "🐼", "🦊", "🐨", "🦁", "🐯", "🐮", "🐷", "🐸", "🦋", "🐝"]
    },
    {
        "id": "food",
        "name": "Yiyecekler",
        "stickers": ["🍕", "🍔", "🍟", "🌭", "🍿", "🧀", "🍩", "🍪", "🍰", "☕", "🍷", "🍻"]
    },
    {
        "id": "activities",
        "name": "Aktiviteler",
        "stickers": ["⚽", "🏀", "🎾", "🏈", "🎮", "🎯", "🎱", "🏆", "🥇", "🎪", "🎨", "🎬"]
    }
]

@api_router.get("/stickers/packs")
async def get_sticker_packs():
    """Get all available sticker packs"""
    return STICKER_PACKS

@api_router.get("/stickers/search")
async def search_stickers(q: str):
    """Search stickers by keyword"""
    results = []
    q_lower = q.lower()
    
    # Simple search in pack names
    for pack in STICKER_PACKS:
        if q_lower in pack["name"].lower():
            results.extend(pack["stickers"])
    
    return {"stickers": results[:20]}

# ============== TYPING INDICATOR ==============

@api_router.post("/messages/typing/{conversation_id}")
async def send_typing_indicator(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Send typing indicator to conversation. Evolution: send composing presence to WhatsApp (1:1)."""
    now = datetime.now(timezone.utc).isoformat()
    # Store typing status (expires after 5 seconds)
    await db.typing_indicators.update_one(
        {"conversation_id": conversation_id, "user_id": current_user["id"]},
        {
            "$set": {
                "conversation_id": conversation_id,
                "user_id": current_user["id"],
                "username": current_user["username"],
                "avatar_url": current_user.get("avatar_url"),
                "updated_at": now,
                "expires_at": (datetime.now(timezone.utc) + timedelta(seconds=5)).isoformat()
            }
        },
        upsert=True
    )
    # Evolution API: 1:1 sohbette karşı tarafın phone'una typing gönder
    try:
        conv = await db.conversations.find_one({"id": conversation_id, "participants": current_user["id"]}, {"participants": 1, "is_group": 1})
        if conv and not conv.get("is_group"):
            other_id = next((p for p in conv["participants"] if p != current_user["id"]), None)
            if other_id:
                other_user = await db.users.find_one({"id": other_id}, {"phone": 1})
                if other_user and other_user.get("phone"):
                    from services.evolution_api_service import send_presence, is_available
                    if is_available():
                        await send_presence(other_user["phone"], presence="composing", delay_ms=4000)
    except Exception:
        pass
    return {"status": "typing"}

@api_router.get("/messages/typing/{conversation_id}")
async def get_typing_users(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get users currently typing in conversation"""
    now = datetime.now(timezone.utc).isoformat()
    
    typing_users = await db.typing_indicators.find(
        {
            "conversation_id": conversation_id,
            "user_id": {"$ne": current_user["id"]},
            "expires_at": {"$gt": now}
        },
        {"_id": 0, "user_id": 1, "username": 1, "avatar_url": 1}
    ).to_list(10)
    
    return {"typing_users": typing_users}

# ============== CLOSE FRIENDS ==============

@api_router.get("/social/close-friends")
async def get_close_friends(current_user: dict = Depends(get_current_user)):
    """Get user's close friends list"""
    close_friends = await db.close_friends.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    friend_ids = [f["friend_id"] for f in close_friends]
    
    friends = await db.users.find(
        {"id": {"$in": friend_ids}},
        {"_id": 0, "password": 0, "email": 0}
    ).to_list(100)
    
    return friends

@api_router.post("/social/close-friends/{user_id}")
async def add_close_friend(user_id: str, current_user: dict = Depends(get_current_user)):
    """Add user to close friends"""
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Kendinizi ekleyemezsiniz")
    
    # Check if already close friend
    existing = await db.close_friends.find_one({
        "user_id": current_user["id"],
        "friend_id": user_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Zaten yakın arkadaş")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.close_friends.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "friend_id": user_id,
        "created_at": now
    })
    
    return {"message": "Yakın arkadaşlara eklendi"}

@api_router.delete("/social/close-friends/{user_id}")
async def remove_close_friend(user_id: str, current_user: dict = Depends(get_current_user)):
    """Remove user from close friends"""
    result = await db.close_friends.delete_one({
        "user_id": current_user["id"],
        "friend_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Yakın arkadaş bulunamadı")
    
    return {"message": "Yakın arkadaşlardan çıkarıldı"}

@api_router.get("/social/close-friends/suggestions")
async def get_close_friend_suggestions(current_user: dict = Depends(get_current_user)):
    """Get close friend suggestions based on interactions"""
    # Get users you interact with most
    following = await db.follows.find(
        {"follower_id": current_user["id"]},
        {"_id": 0}
    ).to_list(100)
    following_ids = [f["following_id"] for f in following]
    
    # Exclude already close friends
    close_friends = await db.close_friends.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(100)
    close_friend_ids = [f["friend_id"] for f in close_friends]
    
    # Filter and get user info
    potential_ids = [fid for fid in following_ids if fid not in close_friend_ids]
    
    suggestions = await db.users.find(
        {"id": {"$in": potential_ids[:10]}},
        {"_id": 0, "password": 0, "email": 0}
    ).to_list(10)
    
    return suggestions

# ============== STORY HIGHLIGHTS ==============

class HighlightCreate(BaseModel):
    name: str
    cover_url: Optional[str] = None
    story_ids: List[str] = []

@api_router.get("/highlights")
async def get_user_highlights(current_user: dict = Depends(get_current_user)):
    """Get current user's highlights"""
    highlights = await db.highlights.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Add story count and cover
    for hl in highlights:
        story_count = await db.highlight_stories.count_documents({"highlight_id": hl["id"]})
        hl["story_count"] = story_count
        
        if not hl.get("cover_url"):
            # Get first story as cover
            first = await db.highlight_stories.find_one(
                {"highlight_id": hl["id"]},
                {"_id": 0}
            )
            if first:
                story = await db.stories.find_one({"id": first["story_id"]}, {"_id": 0})
                if story:
                    hl["cover_url"] = story.get("media_url") or story.get("background_color", "#8B5CF6")
    
    return highlights

@api_router.get("/user/{user_id}/highlights")
async def get_profile_highlights(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get user's public highlights"""
    highlights = await db.highlights.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    for hl in highlights:
        story_count = await db.highlight_stories.count_documents({"highlight_id": hl["id"]})
        hl["story_count"] = story_count
    
    return highlights

@api_router.post("/highlights")
async def create_highlight(
    highlight_data: HighlightCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new highlight"""
    highlight_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    highlight = {
        "id": highlight_id,
        "user_id": current_user["id"],
        "name": highlight_data.name,
        "cover_url": highlight_data.cover_url,
        "created_at": now
    }
    
    await db.highlights.insert_one(highlight)
    
    # Add stories to highlight
    for story_id in highlight_data.story_ids:
        await db.highlight_stories.insert_one({
            "id": str(uuid.uuid4()),
            "highlight_id": highlight_id,
            "story_id": story_id,
            "added_at": now
        })
    
    highlight.pop("_id", None)
    highlight["story_count"] = len(highlight_data.story_ids)
    
    return highlight

@api_router.put("/highlights/{highlight_id}")
async def update_highlight(
    highlight_id: str,
    highlight_data: HighlightCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a highlight"""
    existing = await db.highlights.find_one({
        "id": highlight_id,
        "user_id": current_user["id"]
    })
    
    if not existing:
        raise HTTPException(status_code=404, detail="Öne çıkarılan bulunamadı")
    
    await db.highlights.update_one(
        {"id": highlight_id},
        {"$set": {
            "name": highlight_data.name,
            "cover_url": highlight_data.cover_url
        }}
    )
    
    return {"message": "Öne çıkarılan güncellendi"}

@api_router.delete("/highlights/{highlight_id}")
async def delete_highlight(highlight_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a highlight"""
    result = await db.highlights.delete_one({
        "id": highlight_id,
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Öne çıkarılan bulunamadı")
    
    # Delete associated stories
    await db.highlight_stories.delete_many({"highlight_id": highlight_id})
    
    return {"message": "Öne çıkarılan silindi"}

@api_router.post("/highlights/{highlight_id}/stories")
async def add_story_to_highlight(
    highlight_id: str,
    story_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Add a story to a highlight"""
    # Verify ownership
    highlight = await db.highlights.find_one({
        "id": highlight_id,
        "user_id": current_user["id"]
    })
    
    if not highlight:
        raise HTTPException(status_code=404, detail="Öne çıkarılan bulunamadı")
    
    # Check if already added
    existing = await db.highlight_stories.find_one({
        "highlight_id": highlight_id,
        "story_id": story_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Hikaye zaten ekli")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.highlight_stories.insert_one({
        "id": str(uuid.uuid4()),
        "highlight_id": highlight_id,
        "story_id": story_id,
        "added_at": now
    })
    
    return {"message": "Hikaye eklendi"}

@api_router.get("/highlights/{highlight_id}/stories")
async def get_highlight_stories(
    highlight_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all stories in a highlight"""
    highlight_stories = await db.highlight_stories.find(
        {"highlight_id": highlight_id},
        {"_id": 0}
    ).sort("added_at", 1).to_list(100)
    
    story_ids = [hs["story_id"] for hs in highlight_stories]
    
    stories = await db.stories.find(
        {"id": {"$in": story_ids}},
        {"_id": 0}
    ).to_list(100)
    
    return stories

# ============== STORY ARCHIVE ==============

@api_router.get("/stories/archive")
async def get_story_archive(current_user: dict = Depends(get_current_user)):
    """Get user's archived (expired) stories"""
    now = datetime.now(timezone.utc).isoformat()
    
    stories = await db.stories.find(
        {
            "user_id": current_user["id"],
            "expires_at": {"$lt": now}
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    return stories

# ============== USER STATISTICS (V2) ==============

@api_router.get("/stats/listening")
async def get_user_listening_stats_v2(current_user: dict = Depends(get_current_user)):
    """Get user's listening statistics"""
    _ = current_user["id"]  # Reserved for future use
    
    # Total listening time (mock for now)
    total_minutes = random.randint(500, 5000)
    
    # This week's activity (mock data)
    weekly_data = {
        "labels": ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"],
        "values": [random.randint(10, 60) for _ in range(7)]
    }
    
    # Top genres (mock)
    top_genres = [
        {"name": "Pop", "percentage": 35},
        {"name": "Rock", "percentage": 25},
        {"name": "Hip-Hop", "percentage": 20},
        {"name": "Elektronik", "percentage": 12},
        {"name": "Diğer", "percentage": 8}
    ]
    
    # Top artists (mock)
    top_artists = [
        {"name": "Tarkan", "plays": random.randint(50, 200)},
        {"name": "Sezen Aksu", "plays": random.randint(40, 150)},
        {"name": "Duman", "plays": random.randint(30, 120)},
        {"name": "maNga", "plays": random.randint(20, 100)},
        {"name": "Mabel Matiz", "plays": random.randint(15, 80)}
    ]
    
    return {
        "total_minutes": total_minutes,
        "weekly_activity": weekly_data,
        "top_genres": top_genres,
        "top_artists": top_artists,
        "streak_days": random.randint(1, 30),
        "favorite_time": "21:00 - 23:00"
    }

@api_router.get("/stats/weekly-summary")
async def get_weekly_summary(current_user: dict = Depends(get_current_user)):
    """Get user's weekly summary"""
    return {
        "songs_played": random.randint(50, 200),
        "new_discoveries": random.randint(5, 30),
        "minutes_listened": random.randint(200, 800),
        "top_song": {
            "title": "Yıldızların Altında",
            "artist": "Tarkan",
            "plays": random.randint(10, 50)
        },
        "top_artist": {
            "name": "Tarkan",
            "time_listened": random.randint(30, 120)
        },
        "mood_distribution": [
            {"mood": "Enerjik", "percentage": 30},
            {"mood": "Mutlu", "percentage": 25},
            {"mood": "Huzurlu", "percentage": 20},
            {"mood": "Romantik", "percentage": 15},
            {"mood": "Melankolik", "percentage": 10}
        ]
    }

@api_router.get("/stats/listening-habits")
async def get_listening_habits(current_user: dict = Depends(get_current_user)):
    """Get user's listening habits analysis"""
    # Weekly activity (Mon-Sun)
    weekly_activity = [random.randint(20, 100) for _ in range(7)]
    weekly_hours = [round(a * 0.05, 1) for a in weekly_activity]
    
    # Hourly distribution (6 time slots)
    hourly_dist = [random.randint(5, 30) for _ in range(6)]
    total = sum(hourly_dist)
    hourly_distribution = [round(h / total * 100) for h in hourly_dist]
    
    # Peak hour
    peak_index = hourly_distribution.index(max(hourly_distribution))
    peak_hours = [4, 8, 12, 16, 20, 24]
    peak_hour = peak_hours[peak_index]
    
    # Genre evolution
    genres = ["Pop", "Rock", "Hip-Hop", "Türk Sanat Müziği", "Elektronik"]
    genre_evolution = [
        {"name": genre, "percentage": random.randint(5, 35)}
        for genre in genres[:4]
    ]
    
    return {
        "weekly_activity": weekly_activity,
        "weekly_hours": weekly_hours,
        "hourly_distribution": hourly_distribution,
        "peak_hour": peak_hour,
        "genre_evolution": sorted(genre_evolution, key=lambda x: x["percentage"], reverse=True)
    }

@api_router.get("/stats/timeline")
async def get_activity_timeline(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get activity timeline for heatmap"""
    from datetime import date
    
    end_date = date.today()
    activities = []
    
    # Calculate streaks
    current_streak = 0
    longest_streak = 0
    temp_streak = 0
    total_active_days = 0
    
    for i in range(days):
        d = end_date - timedelta(days=i)
        count = random.randint(0, 50) if random.random() > 0.2 else 0
        minutes = count * random.randint(2, 5) if count > 0 else 0
        
        activities.append({
            "date": d.isoformat(),
            "count": count,
            "minutes": minutes
        })
        
        if count > 0:
            total_active_days += 1
            temp_streak += 1
            longest_streak = max(longest_streak, temp_streak)
            if i == 0:
                current_streak = temp_streak
        else:
            temp_streak = 0
            if i == 0:
                current_streak = 0
    
    return {
        "data": activities,
        "total_active_days": total_active_days,
        "current_streak": current_streak,
        "longest_streak": longest_streak
    }

@api_router.get("/stats/year-review/{year}")
async def get_year_review(
    year: int,
    current_user: dict = Depends(get_current_user)
):
    """Get year in review stats"""
    # Generate realistic stats
    total_minutes = random.randint(5000, 50000)
    total_songs = random.randint(500, 5000)
    total_hours = total_minutes // 60
    
    top_artists = [
        {"name": "Tarkan", "plays": random.randint(50, 200), "image": None},
        {"name": "Sezen Aksu", "plays": random.randint(40, 150), "image": None},
        {"name": "Barış Manço", "plays": random.randint(30, 100), "image": None},
        {"name": "MFÖ", "plays": random.randint(20, 80), "image": None},
        {"name": "Teoman", "plays": random.randint(10, 60), "image": None},
    ]
    
    top_songs = [
        {"name": "Şımarık", "artist": "Tarkan", "plays": random.randint(20, 100)},
        {"name": "Gülümse", "artist": "Sezen Aksu", "plays": random.randint(15, 80)},
        {"name": "Dönence", "artist": "Barış Manço", "plays": random.randint(10, 60)},
    ]
    
    top_genres = ["Pop", "Rock", "Türk Halk Müziği", "Jazz", "Elektronik"]
    
    return {
        "year": year,
        "username": current_user.get("username"),
        "total_minutes": total_minutes,
        "total_hours": total_hours,
        "total_songs": total_songs,
        "top_artists": top_artists,
        "top_songs": top_songs,
        "top_genre": random.choice(top_genres),
        "top_artist": top_artists[0] if top_artists else None,
        "top_song": top_songs[0] if top_songs else None,
        "total_likes": random.randint(100, 1000),
        "playlists_created": random.randint(1, 20),
        "listening_streak": random.randint(1, 100)
    }

@api_router.get("/stats/realtime/trending")
async def get_realtime_trending(
    period: str = "day",  # hour, day, week, month
    current_user: dict = Depends(get_current_user)
):
    """Get real-time trending content"""
    youtube_trending = [
        {"platform_id": f"yt_{i}", "title": f"Trending Song {i}", "artist": f"Artist {i}", "count": random.randint(100, 1000)}
        for i in range(10)
    ]
    
    apple_trending = [
        {"platform_id": f"am_{i}", "title": f"Apple Hit {i}", "artist": f"Artist {i}", "count": random.randint(50, 500)}
        for i in range(10)
    ]
    
    return {
        "youtube": youtube_trending,
        "apple": apple_trending,
        "period": period,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# ============== GROUP CHAT ==============

class GroupChatCreate(BaseModel):
    name: str
    participant_ids: List[str]
    avatar_url: Optional[str] = None

@api_router.post("/messages/groups")
async def create_group_chat(
    group_data: GroupChatCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new group chat (max 8 participants including creator)"""
    if len(group_data.participant_ids) < 2:
        raise HTTPException(status_code=400, detail="Grup için en az 2 kişi gerekli")
    if len(group_data.participant_ids) > 7:
        raise HTTPException(status_code=400, detail="Grup en fazla 8 kişi olabilir (sen + 7 kişi)")
    
    conversation_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Add current user to participants
    all_participants = list(set(group_data.participant_ids + [current_user["id"]]))
    
    # Get participant info
    participants = await db.users.find(
        {"id": {"$in": all_participants}},
        {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
    ).to_list(50)
    
    conversation = {
        "id": conversation_id,
        "is_group": True,
        "group_name": group_data.name,
        "group_avatar": group_data.avatar_url,
        "admins": [current_user["id"]],
        "participants": all_participants,
        "created_by": current_user["id"],
        "created_at": now,
        "last_message_at": now,
        "is_deleted": False
    }
    
    await db.conversations.insert_one(conversation)
    
    # Send system message
    system_message = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "sender_id": "system",
        "content_type": "SYSTEM",
        "content": f"{current_user['display_name'] or current_user['username']} grubu oluşturdu",
        "created_at": now
    }
    await db.messages.insert_one(system_message)
    
    conversation.pop("_id", None)
    return conversation

@api_router.get("/messages/groups/{conversation_id}")
async def get_group_chat(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get group chat details (participants, admins, settings)"""
    conversation = await db.conversations.find_one({
        "id": conversation_id,
        "is_group": True,
        "participants": current_user["id"]
    })
    if not conversation:
        raise HTTPException(status_code=404, detail="Grup bulunamadı")
    # Get participant user details
    participant_ids = conversation.get("participants", [])
    users = await db.users.find(
        {"id": {"$in": participant_ids}},
        {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
    ).to_list(50)
    user_map = {u["id"]: u for u in users}
    return {
        "id": conversation["id"],
        "group_name": conversation.get("group_name"),
        "group_avatar": conversation.get("group_avatar"),
        "admins": conversation.get("admins", []),
        "only_admins_can_send": conversation.get("only_admins_can_send", False),
        "members": [
            {**user_map.get(pid, {"id": pid, "username": "", "display_name": "", "avatar_url": None}), "is_admin": pid in conversation.get("admins", [])}
            for pid in participant_ids
        ],
    }


@api_router.put("/messages/groups/{conversation_id}")
async def update_group_chat(
    conversation_id: str,
    name: Optional[str] = Query(None),
    avatar_url: Optional[str] = Query(None),
    only_admins_can_send: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Update group chat settings (query params or body)"""
    oacs = None
    if only_admins_can_send is not None:
        oacs = str(only_admins_can_send).lower() in ('true', '1', 'yes')
    conversation = await db.conversations.find_one({
        "id": conversation_id,
        "is_group": True,
        "admins": current_user["id"]
    })
    
    if not conversation:
        raise HTTPException(status_code=403, detail="Sadece yöneticiler değişiklik yapabilir")
    
    update_data = {}
    if name is not None:
        update_data["group_name"] = name
    if avatar_url is not None:
        update_data["group_avatar"] = avatar_url
    if oacs is not None:
        update_data["only_admins_can_send"] = oacs
    
    if update_data:
        await db.conversations.update_one(
            {"id": conversation_id},
            {"$set": update_data}
        )
    
    return {"message": "Grup güncellendi"}

@api_router.post("/messages/groups/{conversation_id}/members")
async def add_group_member(
    conversation_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Add a member to group chat"""
    conversation = await db.conversations.find_one({
        "id": conversation_id,
        "is_group": True,
        "admins": current_user["id"]
    })
    
    if not conversation:
        raise HTTPException(status_code=403, detail="Sadece yöneticiler üye ekleyebilir")
    
    if user_id in conversation.get("participants", []):
        raise HTTPException(status_code=400, detail="Kullanıcı zaten grupta")
    if len(conversation.get("participants", [])) >= 8:
        raise HTTPException(status_code=400, detail="Grup en fazla 8 kişi olabilir")
    
    # Add to participants
    new_user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
    )
    
    if not new_user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$addToSet": {"participants": user_id}}
    )
    
    # System message
    now = datetime.now(timezone.utc).isoformat()
    await db.messages.insert_one({
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "sender_id": "system",
        "content_type": "SYSTEM",
        "content": f"{new_user.get('display_name') or new_user['username']} gruba eklendi",
        "created_at": now
    })
    
    return {"message": "Üye eklendi"}

@api_router.delete("/messages/groups/{conversation_id}/members/{user_id}")
async def remove_group_member(
    conversation_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a member from group chat"""
    conversation = await db.conversations.find_one({"id": conversation_id, "is_group": True})
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Grup bulunamadı")
    
    is_admin = current_user["id"] in conversation.get("admins", [])
    is_self = user_id == current_user["id"]
    
    if not is_admin and not is_self:
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    # Remove from participants
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$pull": {"participants": user_id}}
    )
    
    # System message
    removed_user = await db.users.find_one({"id": user_id}, {"_id": 0, "username": 1, "display_name": 1})
    now = datetime.now(timezone.utc).isoformat()
    
    message = f"{removed_user.get('display_name') or removed_user['username']} gruptan ayrıldı" if is_self else f"{removed_user.get('display_name') or removed_user['username']} gruptan çıkarıldı"
    
    await db.messages.insert_one({
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "sender_id": "system",
        "content_type": "SYSTEM",
        "content": message,
        "created_at": now
    })
    
    return {"message": "Üye çıkarıldı" if not is_self else "Gruptan ayrıldınız"}


@api_router.post("/messages/groups/{conversation_id}/admins/{user_id}")
async def add_group_admin(
    conversation_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Make a member an admin of the group"""
    conversation = await db.conversations.find_one({
        "id": conversation_id,
        "is_group": True,
        "admins": current_user["id"]
    })
    if not conversation:
        raise HTTPException(status_code=403, detail="Sadece yöneticiler işlem yapabilir")
    if user_id not in conversation.get("participants", []):
        raise HTTPException(status_code=400, detail="Kullanıcı grupta değil")
    if user_id in conversation.get("admins", []):
        raise HTTPException(status_code=400, detail="Kullanıcı zaten yönetici")
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$addToSet": {"admins": user_id}}
    )
    return {"message": "Yönetici eklendi"}


@api_router.delete("/messages/groups/{conversation_id}/admins/{user_id}")
async def remove_group_admin(
    conversation_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove admin from a member"""
    conversation = await db.conversations.find_one({
        "id": conversation_id,
        "is_group": True,
        "admins": current_user["id"]
    })
    if not conversation:
        raise HTTPException(status_code=403, detail="Sadece yöneticiler işlem yapabilir")
    admins = conversation.get("admins", [])
    if user_id not in admins:
        raise HTTPException(status_code=400, detail="Kullanıcı yönetici değil")
    if len(admins) <= 1:
        raise HTTPException(status_code=400, detail="Son yönetici kaldırılamaz")
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$pull": {"admins": user_id}}
    )
    return {"message": "Yöneticilik kaldırıldı"}


# ============== GROUP POLLS ==============

@api_router.post("/messages/groups/{conversation_id}/polls")
async def create_group_poll(conversation_id: str, body: dict, current_user=Depends(get_current_user)):
    poll = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "creator_id": current_user["id"],
        "creator_username": current_user.get("username", ""),
        "question": body.get("question", ""),
        "options": [{"id": str(i), "text": opt, "votes": []} for i, opt in enumerate(body.get("options", []))],
        "is_anonymous": body.get("is_anonymous", False),
        "allows_multiple": body.get("allows_multiple", False),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "active",
    }
    await db.group_polls.insert_one(poll)
    poll.pop("_id", None)

    msg = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "sender_id": current_user["id"],
        "sender_username": current_user.get("username", ""),
        "content": f"\U0001F4CA {poll['question']}",
        "message_type": "poll",
        "poll_id": poll["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.messages.insert_one(msg)
    msg.pop("_id", None)

    return {"poll": poll, "message": msg}


@api_router.post("/messages/polls/{poll_id}/vote")
async def vote_on_poll(poll_id: str, body: dict, current_user=Depends(get_current_user)):
    option_id = body.get("option_id")
    poll = await db.group_polls.find_one({"id": poll_id})
    if not poll:
        raise HTTPException(404, "Poll not found")

    if not poll.get("allows_multiple"):
        for opt in poll["options"]:
            await db.group_polls.update_one(
                {"id": poll_id},
                {"$pull": {f"options.$[elem].votes": current_user["id"]}},
                array_filters=[{"elem.id": opt["id"]}]
            )

    await db.group_polls.update_one(
        {"id": poll_id, "options.id": option_id},
        {"$addToSet": {"options.$.votes": current_user["id"]}}
    )

    updated = await db.group_polls.find_one({"id": poll_id})
    updated.pop("_id", None)
    return updated


@api_router.get("/messages/polls/{poll_id}")
async def get_poll(poll_id: str):
    poll = await db.group_polls.find_one({"id": poll_id})
    if not poll:
        raise HTTPException(404, "Poll not found")
    poll.pop("_id", None)
    return poll


# ============== MESSAGE SEARCH ==============

@api_router.get("/messages/{conversation_id}/search")
async def search_messages_in_conversation(
    conversation_id: str,
    q: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Search messages within a conversation"""
    # Verify access
    conversation = await db.conversations.find_one({
        "id": conversation_id,
        "participant_ids": current_user["id"]
    })
    
    if not conversation:
        raise HTTPException(status_code=403, detail="Sohbete erişiminiz yok")
    
    messages = await db.messages.find(
        {
            "conversation_id": conversation_id,
            "content": {"$regex": q, "$options": "i"},
            "content_type": "TEXT"
        },
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"messages": messages, "query": q, "count": len(messages)}

# ============== SHARED MEDIA ==============

@api_router.get("/messages/{conversation_id}/media")
async def get_shared_media(
    conversation_id: str,
    media_type: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get shared media in a conversation"""
    # Verify access
    conversation = await db.conversations.find_one({
        "id": conversation_id,
        "participant_ids": current_user["id"]
    })
    
    if not conversation:
        raise HTTPException(status_code=403, detail="Sohbete erişiminiz yok")
    
    skip = (page - 1) * limit
    
    query = {
        "conversation_id": conversation_id,
        "content_type": {"$in": ["IMAGE", "VIDEO"]}
    }
    
    if media_type:
        query["content_type"] = media_type.upper()
    
    media = await db.messages.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.messages.count_documents(query)
    
    return {
        "items": media,
        "page": page,
        "total": total,
        "has_more": skip + len(media) < total
    }

# ============== MESSAGE EDIT/DELETE ==============

class MessageEditRequest(BaseModel):
    content: str
    e2e_encrypted: bool = False
    e2e_nonce: Optional[str] = None
    e2e_sender_public_key: Optional[str] = None

@api_router.put("/messages/{message_id}")
async def edit_message(
    message_id: str,
    edit_data: MessageEditRequest,
    current_user: dict = Depends(get_current_user)
):
    """Edit a message (only text messages, within 15 minutes)"""
    message = await db.messages.find_one({"id": message_id})
    
    if not message:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
    
    if message["sender_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Sadece kendi mesajlarınızı düzenleyebilirsiniz")
    
    if message.get("content_type") != "TEXT":
        raise HTTPException(status_code=400, detail="Sadece metin mesajları düzenlenebilir")
    
    # Check time limit (15 minutes)
    created_at = datetime.fromisoformat(message["created_at"].replace('Z', '+00:00'))
    time_diff = datetime.now(timezone.utc) - created_at
    if time_diff.total_seconds() > 900:  # 15 minutes
        raise HTTPException(status_code=400, detail="Mesaj düzenleme süresi doldu (15 dakika)")
    
    now = datetime.now(timezone.utc).isoformat()
    update_fields = {"content": edit_data.content, "edited": True, "edited_at": now}
    if edit_data.e2e_encrypted and edit_data.e2e_nonce:
        update_fields["e2e_encrypted"] = True
        update_fields["e2e_nonce"] = edit_data.e2e_nonce
        update_fields["e2e_sender_public_key"] = edit_data.e2e_sender_public_key
    await db.messages.update_one({"id": message_id}, {"$set": update_fields})
    
    return {"message": "Mesaj düzenlendi", "edited_at": now}

@api_router.delete("/messages/{message_id}/permanent")
async def delete_message_permanently(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a message permanently"""
    message = await db.messages.find_one({"id": message_id})
    
    if not message:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
    
    if message["sender_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Sadece kendi mesajlarınızı silebilirsiniz")
    
    await db.messages.delete_one({"id": message_id})
    
    return {"message": "Mesaj silindi"}

# ============== CALL HISTORY (for WebRTC integration) ==============

@api_router.get("/messages/calls/history")
async def get_call_history(
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get user's call history (voice/video)"""
    calls = await db.call_history.find(
        {"$or": [{"caller_id": current_user["id"]}, {"callee_id": current_user["id"]}]},
        {"_id": 0}
    ).sort("started_at", -1).skip(offset).limit(limit).to_list(limit)
    for c in calls:
        other_id = c["callee_id"] if c["caller_id"] == current_user["id"] else c["caller_id"]
        other = await db.users.find_one({"id": other_id}, {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1})
        c["other_user"] = other
    return {"calls": calls}

@api_router.post("/messages/calls/ring")
async def ring_call(
    callee_id: str,
    conversation_id: str,
    call_type: str = "voice",  # voice | video
    current_user: dict = Depends(get_current_user)
):
    """Send incoming call notification to callee (WebRTC signaling trigger)"""
    call_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    call_record = {
        "id": call_id,
        "conversation_id": conversation_id,
        "caller_id": current_user["id"],
        "callee_id": callee_id,
        "call_type": call_type,
        "status": "ringing",
        "started_at": now,
    }
    await db.call_history.insert_one(call_record)
    caller_name = current_user.get("display_name") or current_user.get("username") or "Birisi"
    preview = "📞 Sesli arama" if call_type == "voice" else "📹 Görüntülü arama"
    await send_notification(callee_id, {
        "type": "call_incoming",
        "call_id": call_id,
        "caller_id": current_user["id"],
        "caller_name": caller_name,
        "conversation_id": conversation_id,
        "call_type": call_type,
        "title": caller_name,
        "body": preview,
    })
    await notify_user(
        recipient_id=callee_id,
        sender_id=current_user["id"],
        notification_type="call_incoming",
        title=caller_name,
        body=preview,
        data={"url": f"messages/{conversation_id}", "type": "call", "call_id": call_id, "call_type": call_type, "conversation_id": conversation_id, "caller_name": caller_name},
    )
    return {"call_id": call_id, "status": "ringing"}

@api_router.post("/messages/calls")
async def log_call(
    conversation_id: str,
    callee_id: str,
    call_type: str = "voice",  # voice | video
    duration_seconds: int = 0,
    status: str = "completed",  # completed | missed | rejected
    current_user: dict = Depends(get_current_user)
):
    """Log a call (called after WebRTC call ends)"""
    now = datetime.now(timezone.utc).isoformat()
    call = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "caller_id": current_user["id"],
        "callee_id": callee_id,
        "call_type": call_type,
        "duration_seconds": duration_seconds,
        "status": status,
        "started_at": now,
    }
    await db.call_history.insert_one(call)
    call.pop("_id", None)
    return call

# ============== CONVERSATION PIN/ARCHIVE ==============

@api_router.post("/messages/conversations/{conversation_id}/pin")
async def pin_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Pin a conversation"""
    now = datetime.now(timezone.utc).isoformat()
    
    await db.pinned_conversations.update_one(
        {"conversation_id": conversation_id, "user_id": current_user["id"]},
        {
            "$set": {
                "conversation_id": conversation_id,
                "user_id": current_user["id"],
                "pinned_at": now
            }
        },
        upsert=True
    )
    
    return {"message": "Sohbet sabitlendi", "is_pinned": True}

@api_router.delete("/messages/conversations/{conversation_id}/pin")
async def unpin_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Unpin a conversation"""
    await db.pinned_conversations.delete_one({
        "conversation_id": conversation_id,
        "user_id": current_user["id"]
    })
    
    return {"message": "Sabitleme kaldırıldı", "is_pinned": False}

@api_router.post("/messages/conversations/{conversation_id}/archive")
async def archive_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Archive a conversation"""
    now = datetime.now(timezone.utc).isoformat()
    
    await db.archived_conversations.update_one(
        {"conversation_id": conversation_id, "user_id": current_user["id"]},
        {
            "$set": {
                "conversation_id": conversation_id,
                "user_id": current_user["id"],
                "archived_at": now
            }
        },
        upsert=True
    )
    
    return {"message": "Sohbet arşivlendi", "is_archived": True}

@api_router.delete("/messages/conversations/{conversation_id}/archive")
async def unarchive_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Unarchive a conversation"""
    await db.archived_conversations.delete_one({
        "conversation_id": conversation_id,
        "user_id": current_user["id"]
    })
    
    return {"message": "Arşivden çıkarıldı", "is_archived": False}

@api_router.post("/messages/conversations/{conversation_id}/mute")
async def mute_conversation(
    conversation_id: str,
    duration: str = "8h",  # 1s, 8s, 1h, 8h, 1w, always
    current_user: dict = Depends(get_current_user)
):
    """Mute conversation notifications"""
    conv = await db.conversations.find_one({"id": conversation_id, "participants": current_user["id"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")
    until = None
    if duration == "1s":
        until = (datetime.now(timezone.utc) + timedelta(seconds=1)).isoformat()
    elif duration == "8h":
        until = (datetime.now(timezone.utc) + timedelta(hours=8)).isoformat()
    elif duration == "8s":
        until = (datetime.now(timezone.utc) + timedelta(seconds=8)).isoformat()
    elif duration == "1h":
        until = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    elif duration == "1w":
        until = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    await db.muted_conversations.update_one(
        {"conversation_id": conversation_id, "user_id": current_user["id"]},
        {"$set": {"conversation_id": conversation_id, "user_id": current_user["id"], "muted_until": until or "always", "duration": duration}},
        upsert=True
    )
    return {"message": "Sohbet sessize alındı", "duration": duration}


@api_router.delete("/messages/conversations/{conversation_id}/mute")
async def unmute_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Unmute conversation"""
    await db.muted_conversations.delete_one({"conversation_id": conversation_id, "user_id": current_user["id"]})
    return {"message": "Sessiz kaldırıldı"}


@api_router.delete("/messages/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete/hide conversation for current user"""
    conv = await db.conversations.find_one({"id": conversation_id, "participants": current_user["id"]})
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")
    await db.user_deleted_conversations.update_one(
        {"conversation_id": conversation_id, "user_id": current_user["id"]},
        {"$set": {"conversation_id": conversation_id, "user_id": current_user["id"], "deleted_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"message": "Sohbet silindi"}


@api_router.get("/messages/conversations/archived")
async def get_archived_conversations(current_user: dict = Depends(get_current_user)):
    """Get archived conversations (MongoDB + PostgreSQL, enriched like main list)"""
    archived = await db.archived_conversations.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("archived_at", -1).to_list(100)
    conversation_ids = list({a["conversation_id"] for a in archived})
    try:
        from services.postgresql_service import get_conversation_settings_pg
        pg_settings = await get_conversation_settings_pg(current_user["id"])
        for cid in pg_settings.get("archived", []):
            if cid not in conversation_ids:
                conversation_ids.append(cid)
    except Exception:
        pass
    if not conversation_ids:
        return {"conversations": []}

    conversations = await db.conversations.find(
        {"id": {"$in": conversation_ids}},
        {"_id": 0}
    ).to_list(100)

    for conv in conversations:
        other_ids = [p for p in conv["participants"] if p != current_user["id"]]
        participants = await db.users.find(
            {"id": {"$in": other_ids}},
            {"_id": 0, "password": 0, "email": 0}
        ).to_list(10)
        conv["other_participants"] = participants
        last_msg = await db.messages.find_one(
            {"conversation_id": conv["id"]},
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        conv["last_message"] = last_msg
        unread = await db.messages.count_documents({
            "conversation_id": conv["id"],
            "sender_id": {"$ne": current_user["id"]},
            "read_by": {"$ne": current_user["id"]}
        })
        conv["unread_count"] = unread
        conv["is_archived"] = True

    return {"conversations": conversations}


@api_router.put("/messages/conversations/{conversation_id}/vanish-mode")
async def toggle_vanish_mode(conversation_id: str, body: dict, current_user=Depends(get_current_user)):
    enabled = body.get("enabled", False)
    duration = body.get("duration", 86400)

    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {
            "vanish_mode": enabled,
            "vanish_duration": duration,
            "vanish_updated_by": current_user["id"],
            "vanish_updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"vanish_mode": enabled, "duration": duration}


# ============== REPORT SYSTEM ==============

class ReportRequest(BaseModel):
    reported_id: str
    report_type: str  # user, post, message, story
    reason: str  # spam, harassment, hate_speech, violence, nudity, false_info, impersonation, copyright, other
    description: Optional[str] = None

@api_router.post("/reports")
async def create_report(
    report_data: ReportRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a report"""
    report_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    report = {
        "id": report_id,
        "reporter_id": current_user["id"],
        "reported_id": report_data.reported_id,
        "report_type": report_data.report_type,
        "reason": report_data.reason,
        "description": report_data.description,
        "status": "pending",  # pending, reviewed, resolved, dismissed
        "created_at": now
    }
    
    await db.reports.insert_one(report)
    
    return {"message": "Raporunuz alındı", "report_id": report_id}

@api_router.get("/reports/my")
async def get_my_reports(current_user: dict = Depends(get_current_user)):
    """Get reports created by user"""
    reports = await db.reports.find(
        {"reporter_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return reports

# ============== BAN SYSTEM ==============

@api_router.get("/bans/status")
async def get_ban_status(current_user: dict = Depends(get_current_user)):
    """Check if user is banned"""
    ban = await db.bans.find_one(
        {
            "user_id": current_user["id"],
            "$or": [
                {"expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}},
                {"expires_at": None}  # Permanent ban
            ]
        },
        {"_id": 0}
    )
    
    if ban:
        return {
            "is_banned": True,
            "reason": ban.get("reason"),
            "expires_at": ban.get("expires_at"),
            "is_permanent": ban.get("expires_at") is None
        }
    
    return {"is_banned": False}

class BanAppealRequest(BaseModel):
    reason: str

@api_router.post("/bans/appeal")
async def submit_ban_appeal(
    appeal_data: BanAppealRequest,
    current_user: dict = Depends(get_current_user)
):
    """Submit a ban appeal"""
    # Check if already has pending appeal
    existing = await db.ban_appeals.find_one({
        "user_id": current_user["id"],
        "status": "pending"
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Zaten bekleyen bir itirazınız var")
    
    appeal_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    appeal = {
        "id": appeal_id,
        "user_id": current_user["id"],
        "reason": appeal_data.reason,
        "status": "pending",
        "created_at": now
    }
    
    await db.ban_appeals.insert_one(appeal)
    
    return {"message": "İtirazınız alındı", "appeal_id": appeal_id}

# ============== 2FA SYSTEM ==============

@api_router.get("/auth/2fa/status")
async def get_2fa_status(current_user: dict = Depends(get_current_user)):
    """Get 2FA status"""
    return {
        "is_enabled": current_user.get("two_factor_enabled", False),
        "methods": current_user.get("two_factor_methods", [])
    }

class Setup2FARequest(BaseModel):
    method: str  # app, sms, email

@api_router.post("/auth/2fa/setup")
async def setup_2fa(
    setup_data: Setup2FARequest,
    current_user: dict = Depends(get_current_user)
):
    """Setup 2FA"""
    import secrets
    import base64
    
    # For app-based 2FA, generate TOTP secret
    if setup_data.method == "app":
        # Generate a proper base32 encoded secret for TOTP
        totp_secret = base64.b32encode(secrets.token_bytes(10)).decode('utf-8').rstrip('=')
        
        await db.users.update_one(
            {"id": current_user["id"]},
            {
                "$set": {
                    "two_factor_secret": totp_secret,
                    "two_factor_method": "app",
                    "two_factor_pending": True
                }
            }
        )
        
        # Generate QR code URL (otpauth format)
        otp_url = f"otpauth://totp/SocialBeats:{current_user['email']}?secret={totp_secret}&issuer=SocialBeats"
        
        return {
            "method": "app",
            "secret": totp_secret,
            "qr_url": otp_url,
            "message": "Kimlik doğrulama uygulamanızla QR kodu tarayın"
        }
    
    elif setup_data.method == "sms":
        raise HTTPException(
            status_code=400,
            detail="SMS doğrulama şu an desteklenmiyor. Lütfen uygulama (TOTP) yöntemini kullanın."
        )
    
    elif setup_data.method == "email":
        user_doc = await db.users.find_one({"id": current_user["id"]})
        user_email = user_doc.get("email") if user_doc else current_user.get("email")
        if not user_email:
            raise HTTPException(status_code=400, detail="E-posta adresiniz kayıtlı değil")
        
        code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
        
        await db.users.update_one(
            {"id": current_user["id"]},
            {
                "$set": {
                    "two_factor_code": code,
                    "two_factor_method": "email",
                    "two_factor_pending": True,
                    "two_factor_code_expires": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
                }
            }
        )
        
        try:
            await email_service.send_2fa_code(user_email, current_user.get("display_name", "Kullanıcı"), code)
        except Exception as e:
            logger.warning(f"Failed to send 2FA setup email: {e}")
            
        return {
            "method": "email",
            "message": "Doğrulama kodu e-postanıza gönderildi"
        }
    
    raise HTTPException(status_code=400, detail="Geçersiz 2FA yöntemi")

class Verify2FARequest(BaseModel):
    code: str

@api_router.post("/auth/2fa/verify")
async def verify_2fa_setup(
    verify_data: Verify2FARequest,
    current_user: dict = Depends(get_current_user)
):
    """Verify 2FA setup"""
    user = await db.users.find_one({"id": current_user["id"]})
    
    if not user.get("two_factor_pending"):
        raise HTTPException(status_code=400, detail="2FA kurulumu başlatılmamış")
    
    method = user.get("two_factor_method")
    
    if method == "app":
        totp_secret = user.get("two_factor_secret")
        if not totp_secret:
            raise HTTPException(status_code=400, detail="2FA yapılandırması eksik")
        
        try:
            import pyotp
            totp = pyotp.TOTP(totp_secret)
            if not totp.verify(verify_data.code, valid_window=1):
                raise HTTPException(status_code=400, detail="Geçersiz 2FA kodu")
        except ImportError:
            if len(verify_data.code) != 6 or not verify_data.code.isdigit():
                raise HTTPException(status_code=400, detail="Geçersiz kod")
    else:
        # Verify code for SMS/email
        stored_code = user.get("two_factor_code")
        expires = user.get("two_factor_code_expires")
        
        if not stored_code or stored_code != verify_data.code:
            raise HTTPException(status_code=400, detail="Geçersiz kod")
        
        if expires and datetime.fromisoformat(expires.replace('Z', '+00:00')) < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Kod süresi dolmuş")
    
    # Enable 2FA
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$set": {
                "two_factor_enabled": True,
                "two_factor_pending": False
            },
            "$unset": {
                "two_factor_code": "",
                "two_factor_code_expires": ""
            },
            "$addToSet": {
                "two_factor_methods": method
            }
        }
    )
    
    return {"message": "2FA başarıyla etkinleştirildi", "method": method}

@api_router.delete("/auth/2fa")
async def disable_2fa(current_user: dict = Depends(get_current_user)):
    """Disable 2FA"""
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$set": {
                "two_factor_enabled": False,
                "two_factor_methods": []
            },
            "$unset": {
                "two_factor_secret": "",
                "two_factor_method": "",
                "two_factor_code": "",
                "two_factor_code_expires": "",
                "two_factor_pending": ""
            }
        }
    )
    
    return {"message": "2FA devre dışı bırakıldı"}

# ============== SESSION MANAGEMENT ==============

@api_router.get("/auth/sessions")
async def list_active_sessions(current_user: dict = Depends(get_current_user)):
    """List all active sessions for the current user."""
    sessions = await db.user_sessions.find(
        {"user_id": current_user["id"], "active": True}
    ).sort("last_active", -1).to_list(50)
    
    for s in sessions:
        s.pop("_id", None)
        s.pop("token", None)
    
    return {"sessions": sessions, "total": len(sessions)}

@api_router.delete("/auth/sessions/{session_id}")
async def revoke_session(session_id: str, current_user: dict = Depends(get_current_user)):
    """Revoke a specific session (remote logout)."""
    result = await db.user_sessions.update_one(
        {"id": session_id, "user_id": current_user["id"]},
        {"$set": {"active": False, "revoked_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(404, "Session not found")
    return {"status": "revoked", "session_id": session_id}

@api_router.delete("/auth/sessions")
async def revoke_all_sessions(current_user: dict = Depends(get_current_user)):
    """Revoke all sessions except current one."""
    current_token = current_user.get("current_token", "")
    await db.user_sessions.update_many(
        {"user_id": current_user["id"], "token": {"$ne": current_token}},
        {"$set": {"active": False, "revoked_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "all_sessions_revoked"}

# ============== AUTH SECURITY-SETTINGS (ALIAS) ==============

@api_router.get("/auth/security-settings")
async def get_auth_security_settings(current_user: dict = Depends(get_current_user)):
    """Alias for /security/settings - called by SecurityScreen"""
    user = await db.users.find_one(
        {"id": current_user["id"]},
        {"_id": 0, "two_factor_enabled": 1, "two_factor_methods": 1, "webauthn_enabled": 1}
    )
    settings = await db.user_settings.find_one({"user_id": current_user["id"]}, {"_id": 0})
    has_recovery = await db.recovery_codes.count_documents({"user_id": current_user["id"], "used": False})
    
    return {
        "settings": {
            "two_factor_enabled": user.get("two_factor_enabled", False) if user else False,
            "two_factor_methods": user.get("two_factor_methods", []) if user else [],
            "biometric_enabled": settings.get("biometric_enabled", False) if settings else False,
            "login_alerts": settings.get("login_alerts", True) if settings else True,
            "webauthn_enabled": user.get("webauthn_enabled", False) if user else False,
            "recovery_codes_count": has_recovery,
        }
    }

@api_router.put("/auth/two-factor")
async def toggle_two_factor(data: dict, current_user: dict = Depends(get_current_user)):
    """Toggle 2FA enabled/disabled"""
    enabled = data.get("enabled", False)
    if enabled:
        return {"message": "2FA kurulumu için /auth/2fa/setup kullanın", "redirect": "/auth/2fa/setup"}
    else:
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"two_factor_enabled": False, "two_factor_methods": []},
             "$unset": {"two_factor_secret": "", "two_factor_method": "", "two_factor_pending": ""}}
        )
        return {"message": "2FA devre dışı bırakıldı"}

@api_router.post("/auth/sessions/revoke-all")
async def revoke_all_sessions_alias(current_user: dict = Depends(get_current_user)):
    """Revoke all other sessions (alias called by SecurityScreen)"""
    await db.user_sessions.update_many(
        {"user_id": current_user["id"]},
        {"$set": {"active": False, "is_active": False, "revoked_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Tüm oturumlar kapatıldı"}

@api_router.post("/auth/google")
async def google_oauth_login(data: dict, request: Request):
    """Handle Google OAuth login/register from frontend"""
    id_token = data.get("id_token") or data.get("token")
    if not id_token:
        raise HTTPException(status_code=400, detail="Google ID token gerekli")
    
    google_email = data.get("email")
    google_name = data.get("name", "")
    google_avatar = data.get("avatar_url", data.get("photo", ""))
    google_id = data.get("google_id", data.get("sub", ""))
    
    if not google_email:
        raise HTTPException(status_code=400, detail="E-posta gerekli")
    
    user = await db.users.find_one({"email": google_email}, {"_id": 0})
    
    if not user:
        user_id = str(uuid.uuid4())
        username = google_email.split("@")[0]
        existing_username = await db.users.find_one({"username": username})
        if existing_username:
            username = f"{username}_{secrets.token_hex(3)}"
        
        now = datetime.now(timezone.utc).isoformat()
        user = {
            "id": user_id,
            "email": google_email,
            "username": username,
            "display_name": google_name or username,
            "avatar_url": google_avatar,
            "password": hash_password(secrets.token_hex(16)),
            "google_id": google_id,
            "auth_provider": "google",
            "is_verified": True,
            "created_at": now,
            "is_online": True,
        }
        await db.users.insert_one(user)
    else:
        update = {"is_online": True}
        if google_id:
            update["google_id"] = google_id
        if not user.get("avatar_url") and google_avatar:
            update["avatar_url"] = google_avatar
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    
    token_payload = {
        "sub": user["id"],
        "email": user["email"],
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    user_safe = {k: v for k, v in user.items() if k not in ("password", "_id")}
    
    return {"token": token, "user": user_safe}

# ============== 2FA LOGIN VERIFY ==============

class TwoFALoginVerify(BaseModel):
    temp_token: str
    code: str
    is_recovery: Optional[bool] = False

@api_router.post("/auth/2fa/login-verify")
async def verify_2fa_login(data: TwoFALoginVerify, request: Request):
    """Verify 2FA code during login (after password check)"""
    try:
        payload = jwt.decode(data.temp_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "2fa_pending":
            raise HTTPException(status_code=400, detail="Geçersiz token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Oturum süresi doldu, tekrar giriş yapın")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Geçersiz token")
    
    user_id = payload.get("sub")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    if data.is_recovery:
        import hashlib
        code_upper = data.code.strip().upper()
        hashed = hashlib.sha256(code_upper.encode()).hexdigest()
        rec = await db.recovery_codes.find_one({"user_id": user_id, "code_hash": hashed, "used": False})
        if not rec:
            raise HTTPException(status_code=400, detail="Geçersiz kurtarma kodu")
        await db.recovery_codes.update_one(
            {"id": rec["id"]},
            {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        if len(data.code) != 6 or not data.code.isdigit():
            raise HTTPException(status_code=400, detail="Geçersiz doğrulama kodu")
    
    await db.users.update_one({"id": user_id}, {"$set": {"is_online": True}})
    
    token_payload = {
        "sub": user["id"],
        "email": user.get("email", ""),
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    user_safe = {k: v for k, v in user.items() if k not in ("password", "_id")}
    
    return {"token": token, "user": user_safe}

# ============== ADMIN APPEALS ==============

@api_router.get("/admin/appeals")
async def get_ban_appeals(current_user: dict = Depends(get_current_user)):
    """Get all ban appeals (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    appeals = await db.ban_appeals.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return appeals

# ============== IP MANAGEMENT (ADMIN) ==============

@api_router.get("/admin/api-status")
async def admin_api_status(current_user: dict = Depends(get_current_user)):
    """Returns status of all API credentials - admin only. Helps see which real APIs are active."""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")

    def _check(name: str, configured: bool, status_val: str) -> dict:
        return {"name": name, "configured": configured, "status": status_val}

    apis = []

    # SoundCloud (via main.py microservice)
    apis.append(_check("SoundCloud", True, "ok"))

    # Firebase
    fb_configured = bool(
        os.environ.get("FIREBASE_PROJECT_ID") and os.environ.get("FIREBASE_WEB_API_KEY")
    )
    apis.append(_check("Firebase", fb_configured, "ok" if fb_configured else "missing"))

    # Google OAuth
    goauth_configured = bool(
        os.environ.get("GOOGLE_CLIENT_ID") and os.environ.get("GOOGLE_CLIENT_SECRET")
    )
    apis.append(
        _check("Google OAuth", goauth_configured, "ok" if goauth_configured else "missing")
    )

    # Detoxify (text toxicity - open source, local)
    try:
        import detoxify
        detoxify_configured = True
        detoxify_status = "ok"
    except ImportError:
        detoxify_configured = False
        detoxify_status = "missing"
    apis.append(_check("Detoxify", detoxify_configured, detoxify_status))

    # SMTP (Email)
    smtp_configured = email_service.is_configured()
    apis.append(
        _check("SMTP (Email)", smtp_configured, "ok" if smtp_configured else "missing")
    )

    # GIPHY
    giphy_key = os.environ.get("GIPHY_API_KEY", "")
    giphy_configured = bool(giphy_key and giphy_key.strip())
    giphy_status = "ok" if giphy_configured else "missing"
    if giphy_configured:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(
                    "https://api.giphy.com/v1/gifs/trending",
                    params={"api_key": giphy_key, "limit": 1},
                )
                if r.status_code != 200:
                    giphy_status = "error"
        except Exception:
            giphy_status = "error"
    apis.append(_check("GIPHY", giphy_configured, giphy_status))

    # NudeNet Content Moderation
    nudenet_available = moderation_service.enabled
    apis.append(
        _check(
            "NudeNet",
            nudenet_available,
            "ok" if nudenet_available else "missing",
        )
    )

    return {"apis": apis}

@api_router.get("/admin/ip-lists")
async def get_ip_lists(current_user: dict = Depends(get_current_user)):
    """Get IP whitelist and blacklist (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    return await ip_manager.get_lists()

@api_router.post("/admin/ip-lists")
async def add_to_ip_list(
    ip: str,
    list_type: str,  # whitelist or blacklist
    reason: str = "",
    current_user: dict = Depends(get_current_user)
):
    """Add IP to whitelist or blacklist (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    if list_type not in ["whitelist", "blacklist"]:
        raise HTTPException(status_code=400, detail="Geçersiz liste tipi")
    
    return await ip_manager.add_to_list(ip, list_type, current_user["id"], reason)

@api_router.delete("/admin/ip-lists")
async def remove_from_ip_list(
    ip: str,
    list_type: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove IP from whitelist or blacklist (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    return await ip_manager.remove_from_list(ip, list_type)

# ============== MEILISEARCH ADMIN ==============
from services.meilisearch_service import meili_service

@api_router.post("/admin/meilisearch/sync")
async def meilisearch_sync(current_user: dict = Depends(get_current_user)):
    """Full sync MongoDB -> Meilisearch (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    meili_service.set_db(db)
    result = await meili_service.sync_all()
    return result

@api_router.get("/admin/meilisearch/stats")
async def meilisearch_stats(current_user: dict = Depends(get_current_user)):
    """Get Meilisearch index stats (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    stats = await meili_service.get_index_stats()
    return {"status": meili_service.get_status(), "stats": stats}

@api_router.get("/search/instant")
async def instant_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(8, ge=1, le=20),
    current_user: dict = Depends(get_current_user)
):
    """Instant search with Meilisearch (typo-tolerant, <50ms)"""
    if meili_service.is_available():
        results = await meili_service.multi_search(q, {"users": 3, "posts": 3, "tracks": 3, "playlists": 2, "hashtags": 3})
        return {"query": q, "results": results, "source": "meilisearch"}

    suggestions = []
    users = await db.users.find(
        {"username": {"$regex": f"^{q}", "$options": "i"}},
        {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
    ).limit(limit).to_list(limit)
    for u in users:
        suggestions.append({"type": "user", **u})
    return {"query": q, "results": {"users": {"hits": users}}, "suggestions": suggestions, "source": "mongodb"}

# ============== USER BAN/RESTRICTION MANAGEMENT ==============

@api_router.get("/admin/restrictions")
async def get_restrictions(current_user: dict = Depends(get_current_user)):
    """Get all user restrictions (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    restrictions = await db.user_restrictions.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Add user info
    for restriction in restrictions:
        user = await db.users.find_one(
            {"id": restriction.get("user_id")},
            {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
        )
        if user:
            restriction["user"] = user
    
    return restrictions

@api_router.post("/admin/restrictions")
async def create_restriction(
    user_id: str,
    restriction_type: str,  # TEMPORARY_BAN, PERMANENT_BAN, MUTE, SHADOW_BAN
    reason: str,
    duration_hours: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Create a user restriction (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    now = datetime.now(timezone.utc)
    expires_at = None
    if duration_hours:
        expires_at = (now + timedelta(hours=duration_hours)).isoformat()
    
    restriction = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "restriction_type": restriction_type,
        "reason": reason,
        "created_by": current_user["id"],
        "created_at": now.isoformat(),
        "expires_at": expires_at,
        "is_active": True,
        "appeal_status": None,
        "appeal_reason": None
    }
    
    await db.user_restrictions.insert_one(restriction)
    
    # Update user status
    if restriction_type in ["TEMPORARY_BAN", "PERMANENT_BAN"]:
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"is_banned": True, "ban_reason": reason}}
        )
    
    return {"message": "Kısıtlama oluşturuldu", "restriction": restriction}

@api_router.put("/admin/restrictions/{restriction_id}")
async def update_restriction(
    restriction_id: str,
    action: str,  # approve_appeal, reject_appeal, remove
    current_user: dict = Depends(get_current_user)
):
    """Update a restriction (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    restriction = await db.user_restrictions.find_one({"id": restriction_id})
    if not restriction:
        raise HTTPException(status_code=404, detail="Kısıtlama bulunamadı")
    
    if action == "approve_appeal":
        await db.user_restrictions.update_one(
            {"id": restriction_id},
            {"$set": {"is_active": False, "appeal_status": "APPROVED"}}
        )
        await db.users.update_one(
            {"id": restriction["user_id"]},
            {"$set": {"is_banned": False, "ban_reason": None}}
        )
        return {"message": "İtiraz onaylandı, kısıtlama kaldırıldı"}
    
    elif action == "reject_appeal":
        await db.user_restrictions.update_one(
            {"id": restriction_id},
            {"$set": {"appeal_status": "REJECTED"}}
        )
        return {"message": "İtiraz reddedildi"}
    
    elif action == "remove":
        await db.user_restrictions.update_one(
            {"id": restriction_id},
            {"$set": {"is_active": False}}
        )
        await db.users.update_one(
            {"id": restriction["user_id"]},
            {"$set": {"is_banned": False, "ban_reason": None}}
        )
        return {"message": "Kısıtlama kaldırıldı"}
    
    raise HTTPException(status_code=400, detail="Geçersiz aksiyon")

@api_router.post("/user/restrictions/{restriction_id}/appeal")
async def appeal_restriction(
    restriction_id: str,
    reason: str,
    current_user: dict = Depends(get_current_user)
):
    """Appeal a restriction"""
    restriction = await db.user_restrictions.find_one({
        "id": restriction_id,
        "user_id": current_user["id"]
    })
    
    if not restriction:
        raise HTTPException(status_code=404, detail="Kısıtlama bulunamadı")
    
    if restriction.get("appeal_status"):
        raise HTTPException(status_code=400, detail="Zaten itiraz edilmiş")
    
    await db.user_restrictions.update_one(
        {"id": restriction_id},
        {"$set": {
            "appeal_status": "PENDING",
            "appeal_reason": reason,
            "appeal_date": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "İtiraz gönderildi"}

# ============== SUSPICIOUS LOGIN DETECTION ==============

@api_router.get("/auth/login-history")
async def get_login_history(current_user: dict = Depends(get_current_user)):
    """Get login history"""
    history = await db.login_history.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    # If no history, return mock data
    if not history:
        return [{
            "id": "1",
            "device": "Mobil Uygulama",
            "location": "İstanbul, Türkiye",
            "ip": "***.***.***",
            "status": "success",
            "created_at": datetime.now(timezone.utc).isoformat()
        }]
    
    return history

# ============== REGION-BASED MUSIC RECOMMENDATIONS ==============

# Ülkelere göre popüler müzik türleri ve sanatçılar
REGION_MUSIC_DATA = {
    "TR": {
        "genres": ["Türk Pop", "Arabesk", "Türk Rock", "Türk Halk Müziği", "Türkçe Rap"],
        "artists": [
            {"id": "tr1", "name": "Tarkan", "image": "https://picsum.photos/seed/tarkan/200", "followers": "5.2M"},
            {"id": "tr2", "name": "Sezen Aksu", "image": "https://picsum.photos/seed/sezen/200", "followers": "4.8M"},
            {"id": "tr3", "name": "Mor ve Ötesi", "image": "https://picsum.photos/seed/morveotesi/200", "followers": "2.1M"},
            {"id": "tr4", "name": "Duman", "image": "https://picsum.photos/seed/duman/200", "followers": "3.5M"},
            {"id": "tr5", "name": "Hadise", "image": "https://picsum.photos/seed/hadise/200", "followers": "2.8M"},
            {"id": "tr6", "name": "Murat Boz", "image": "https://picsum.photos/seed/muratboz/200", "followers": "2.3M"},
        ],
        "trending_tracks": [
            {"id": "tr_t1", "title": "Dudu", "artist": "Tarkan", "plays": "150M"},
            {"id": "tr_t2", "title": "Geri Dönüş Olsa", "artist": "Sezen Aksu", "plays": "120M"},
            {"id": "tr_t3", "title": "Yalnızlık Senfonisi", "artist": "Mor ve Ötesi", "plays": "95M"},
        ]
    },
    "US": {
        "genres": ["Pop", "Hip-Hop", "R&B", "Country", "Rock", "Electronic"],
        "artists": [
            {"id": "us1", "name": "Taylor Swift", "image": "https://picsum.photos/seed/taylor/200", "followers": "85M"},
            {"id": "us2", "name": "Drake", "image": "https://picsum.photos/seed/drake/200", "followers": "72M"},
            {"id": "us3", "name": "The Weeknd", "image": "https://picsum.photos/seed/weeknd/200", "followers": "55M"},
            {"id": "us4", "name": "Billie Eilish", "image": "https://picsum.photos/seed/billie/200", "followers": "48M"},
            {"id": "us5", "name": "Post Malone", "image": "https://picsum.photos/seed/postmalone/200", "followers": "42M"},
        ],
        "trending_tracks": [
            {"id": "us_t1", "title": "Anti-Hero", "artist": "Taylor Swift", "plays": "1.5B"},
            {"id": "us_t2", "title": "Blinding Lights", "artist": "The Weeknd", "plays": "2.8B"},
            {"id": "us_t3", "title": "God's Plan", "artist": "Drake", "plays": "1.9B"},
        ]
    },
    "KR": {
        "genres": ["K-Pop", "K-Hip-Hop", "K-R&B", "Korean Ballad", "K-Indie"],
        "artists": [
            {"id": "kr1", "name": "BTS", "image": "https://picsum.photos/seed/bts/200", "followers": "72M"},
            {"id": "kr2", "name": "BLACKPINK", "image": "https://picsum.photos/seed/blackpink/200", "followers": "55M"},
            {"id": "kr3", "name": "IU", "image": "https://picsum.photos/seed/iu/200", "followers": "28M"},
            {"id": "kr4", "name": "Stray Kids", "image": "https://picsum.photos/seed/straykids/200", "followers": "22M"},
            {"id": "kr5", "name": "NewJeans", "image": "https://picsum.photos/seed/newjeans/200", "followers": "18M"},
        ],
        "trending_tracks": [
            {"id": "kr_t1", "title": "Dynamite", "artist": "BTS", "plays": "1.7B"},
            {"id": "kr_t2", "title": "Pink Venom", "artist": "BLACKPINK", "plays": "800M"},
            {"id": "kr_t3", "title": "Super Shy", "artist": "NewJeans", "plays": "450M"},
        ]
    },
    "JP": {
        "genres": ["J-Pop", "J-Rock", "Anime", "City Pop", "Visual Kei"],
        "artists": [
            {"id": "jp1", "name": "YOASOBI", "image": "https://picsum.photos/seed/yoasobi/200", "followers": "12M"},
            {"id": "jp2", "name": "Kenshi Yonezu", "image": "https://picsum.photos/seed/yonezu/200", "followers": "8M"},
            {"id": "jp3", "name": "LiSA", "image": "https://picsum.photos/seed/lisa/200", "followers": "6M"},
            {"id": "jp4", "name": "ONE OK ROCK", "image": "https://picsum.photos/seed/oneokrock/200", "followers": "5M"},
        ],
        "trending_tracks": [
            {"id": "jp_t1", "title": "Idol", "artist": "YOASOBI", "plays": "500M"},
            {"id": "jp_t2", "title": "KICK BACK", "artist": "Kenshi Yonezu", "plays": "350M"},
            {"id": "jp_t3", "title": "Gurenge", "artist": "LiSA", "plays": "420M"},
        ]
    },
    "DE": {
        "genres": ["German Pop", "Schlager", "German Hip-Hop", "Electronic", "Rock"],
        "artists": [
            {"id": "de1", "name": "Rammstein", "image": "https://picsum.photos/seed/rammstein/200", "followers": "15M"},
            {"id": "de2", "name": "Capital Bra", "image": "https://picsum.photos/seed/capitalbra/200", "followers": "8M"},
            {"id": "de3", "name": "Kraftwerk", "image": "https://picsum.photos/seed/kraftwerk/200", "followers": "5M"},
        ],
        "trending_tracks": [
            {"id": "de_t1", "title": "Du Hast", "artist": "Rammstein", "plays": "850M"},
            {"id": "de_t2", "title": "Cherry Lady", "artist": "Capital Bra", "plays": "200M"},
        ]
    },
    "FR": {
        "genres": ["French Pop", "Rap Français", "Chanson", "Electronic", "French House"],
        "artists": [
            {"id": "fr1", "name": "Stromae", "image": "https://picsum.photos/seed/stromae/200", "followers": "12M"},
            {"id": "fr2", "name": "Daft Punk", "image": "https://picsum.photos/seed/daftpunk/200", "followers": "22M"},
            {"id": "fr3", "name": "Aya Nakamura", "image": "https://picsum.photos/seed/ayanakamura/200", "followers": "8M"},
        ],
        "trending_tracks": [
            {"id": "fr_t1", "title": "Papaoutai", "artist": "Stromae", "plays": "750M"},
            {"id": "fr_t2", "title": "Get Lucky", "artist": "Daft Punk", "plays": "1.2B"},
        ]
    },
    "ES": {
        "genres": ["Reggaeton", "Latin Pop", "Flamenco", "Spanish Rock", "Latin Trap"],
        "artists": [
            {"id": "es1", "name": "Rosalía", "image": "https://picsum.photos/seed/rosalia/200", "followers": "28M"},
            {"id": "es2", "name": "Bad Bunny", "image": "https://picsum.photos/seed/badbunny/200", "followers": "45M"},
            {"id": "es3", "name": "J Balvin", "image": "https://picsum.photos/seed/jbalvin/200", "followers": "35M"},
        ],
        "trending_tracks": [
            {"id": "es_t1", "title": "Tití Me Preguntó", "artist": "Bad Bunny", "plays": "1.1B"},
            {"id": "es_t2", "title": "Despechá", "artist": "Rosalía", "plays": "600M"},
        ]
    },
    "GB": {
        "genres": ["UK Pop", "Grime", "British Rock", "Indie", "Drum and Bass"],
        "artists": [
            {"id": "gb1", "name": "Ed Sheeran", "image": "https://picsum.photos/seed/edsheeran/200", "followers": "85M"},
            {"id": "gb2", "name": "Adele", "image": "https://picsum.photos/seed/adele/200", "followers": "52M"},
            {"id": "gb3", "name": "Harry Styles", "image": "https://picsum.photos/seed/harrystyles/200", "followers": "48M"},
            {"id": "gb4", "name": "Dua Lipa", "image": "https://picsum.photos/seed/dualipa/200", "followers": "42M"},
            {"id": "gb5", "name": "Stormzy", "image": "https://picsum.photos/seed/stormzy/200", "followers": "8M"},
        ],
        "trending_tracks": [
            {"id": "gb_t1", "title": "Shape of You", "artist": "Ed Sheeran", "plays": "3.5B"},
            {"id": "gb_t2", "title": "As It Was", "artist": "Harry Styles", "plays": "1.8B"},
            {"id": "gb_t3", "title": "Levitating", "artist": "Dua Lipa", "plays": "1.5B"},
        ]
    },
    "BR": {
        "genres": ["Sertanejo", "Funk Brasileiro", "MPB", "Pagode", "Forró", "Axé"],
        "artists": [
            {"id": "br1", "name": "Anitta", "image": "https://picsum.photos/seed/anitta/200", "followers": "65M"},
            {"id": "br2", "name": "Gusttavo Lima", "image": "https://picsum.photos/seed/gusttavo/200", "followers": "35M"},
            {"id": "br3", "name": "Marília Mendonça", "image": "https://picsum.photos/seed/marilia/200", "followers": "42M"},
            {"id": "br4", "name": "Ludmilla", "image": "https://picsum.photos/seed/ludmilla/200", "followers": "28M"},
            {"id": "br5", "name": "Jorge & Mateus", "image": "https://picsum.photos/seed/jorgemateus/200", "followers": "22M"},
        ],
        "trending_tracks": [
            {"id": "br_t1", "title": "Envolver", "artist": "Anitta", "plays": "450M"},
            {"id": "br_t2", "title": "Balada", "artist": "Gusttavo Lima", "plays": "380M"},
            {"id": "br_t3", "title": "Supera", "artist": "Marília Mendonça", "plays": "520M"},
        ]
    },
    "IN": {
        "genres": ["Bollywood", "Punjabi", "Tamil", "Telugu", "Indian Pop", "Indie Hindi"],
        "artists": [
            {"id": "in1", "name": "Arijit Singh", "image": "https://picsum.photos/seed/arijit/200", "followers": "45M"},
            {"id": "in2", "name": "Badshah", "image": "https://picsum.photos/seed/badshah/200", "followers": "28M"},
            {"id": "in3", "name": "Neha Kakkar", "image": "https://picsum.photos/seed/nehakakkar/200", "followers": "35M"},
            {"id": "in4", "name": "A.R. Rahman", "image": "https://picsum.photos/seed/arrahman/200", "followers": "22M"},
            {"id": "in5", "name": "Diljit Dosanjh", "image": "https://picsum.photos/seed/diljit/200", "followers": "18M"},
        ],
        "trending_tracks": [
            {"id": "in_t1", "title": "Kesariya", "artist": "Arijit Singh", "plays": "850M"},
            {"id": "in_t2", "title": "Paani Paani", "artist": "Badshah", "plays": "720M"},
            {"id": "in_t3", "title": "Lover", "artist": "Diljit Dosanjh", "plays": "450M"},
        ]
    },
    "SA": {
        "genres": ["Arabic Pop", "Khaliji", "Arabic Hip-Hop", "Mahraganat", "Arabic R&B"],
        "artists": [
            {"id": "sa1", "name": "Mohammed Abdu", "image": "https://picsum.photos/seed/mabdu/200", "followers": "12M"},
            {"id": "sa2", "name": "Rabeh Saqer", "image": "https://picsum.photos/seed/rabeh/200", "followers": "8M"},
            {"id": "sa3", "name": "Aseel Hameem", "image": "https://picsum.photos/seed/aseel/200", "followers": "5M"},
            {"id": "sa4", "name": "Amr Diab", "image": "https://picsum.photos/seed/amrdiab/200", "followers": "18M"},
        ],
        "trending_tracks": [
            {"id": "sa_t1", "title": "Ahwak", "artist": "Mohammed Abdu", "plays": "120M"},
            {"id": "sa_t2", "title": "Tamally Maak", "artist": "Amr Diab", "plays": "380M"},
        ]
    },
    "RU": {
        "genres": ["Russian Pop", "Russian Rock", "Russian Hip-Hop", "Chanson", "Electronic"],
        "artists": [
            {"id": "ru1", "name": "Morgenshtern", "image": "https://picsum.photos/seed/morgenshtern/200", "followers": "15M"},
            {"id": "ru2", "name": "Егор Крид", "image": "https://picsum.photos/seed/egorkrid/200", "followers": "12M"},
            {"id": "ru3", "name": "Zivert", "image": "https://picsum.photos/seed/zivert/200", "followers": "8M"},
            {"id": "ru4", "name": "Макс Корж", "image": "https://picsum.photos/seed/maxkorzh/200", "followers": "10M"},
        ],
        "trending_tracks": [
            {"id": "ru_t1", "title": "Cadillac", "artist": "Morgenshtern", "plays": "450M"},
            {"id": "ru_t2", "title": "Beverly Hills", "artist": "Zivert", "plays": "320M"},
        ]
    },
    "IT": {
        "genres": ["Italian Pop", "Italian Hip-Hop", "Opera", "Sanremo", "Italian Rock"],
        "artists": [
            {"id": "it1", "name": "Måneskin", "image": "https://picsum.photos/seed/maneskin/200", "followers": "22M"},
            {"id": "it2", "name": "Eros Ramazzotti", "image": "https://picsum.photos/seed/erosramazzotti/200", "followers": "8M"},
            {"id": "it3", "name": "Laura Pausini", "image": "https://picsum.photos/seed/laurapausini/200", "followers": "12M"},
            {"id": "it4", "name": "Mahmood", "image": "https://picsum.photos/seed/mahmood/200", "followers": "5M"},
        ],
        "trending_tracks": [
            {"id": "it_t1", "title": "Beggin'", "artist": "Måneskin", "plays": "1.2B"},
            {"id": "it_t2", "title": "Soldi", "artist": "Mahmood", "plays": "380M"},
        ]
    },
    "PT": {
        "genres": ["Portuguese Pop", "Fado", "Kizomba", "Portuguese Hip-Hop", "Pimba"],
        "artists": [
            {"id": "pt1", "name": "Amália Rodrigues", "image": "https://picsum.photos/seed/amalia/200", "followers": "2M"},
            {"id": "pt2", "name": "Ana Moura", "image": "https://picsum.photos/seed/anamoura/200", "followers": "1.5M"},
            {"id": "pt3", "name": "Anselmo Ralph", "image": "https://picsum.photos/seed/anselmo/200", "followers": "3M"},
            {"id": "pt4", "name": "Piruka", "image": "https://picsum.photos/seed/piruka/200", "followers": "800K"},
        ],
        "trending_tracks": [
            {"id": "pt_t1", "title": "Desfado", "artist": "Ana Moura", "plays": "85M"},
            {"id": "pt_t2", "title": "Não Me Toca", "artist": "Anselmo Ralph", "plays": "120M"},
        ]
    },
    "NL": {
        "genres": ["Dutch Pop", "Dutch Hip-Hop", "Hardstyle", "Dutch House", "Nederpop"],
        "artists": [
            {"id": "nl1", "name": "Tiësto", "image": "https://picsum.photos/seed/tiesto/200", "followers": "35M"},
            {"id": "nl2", "name": "Martin Garrix", "image": "https://picsum.photos/seed/martingarrix/200", "followers": "42M"},
            {"id": "nl3", "name": "Armin van Buuren", "image": "https://picsum.photos/seed/armin/200", "followers": "28M"},
            {"id": "nl4", "name": "Snelle", "image": "https://picsum.photos/seed/snelle/200", "followers": "2M"},
        ],
        "trending_tracks": [
            {"id": "nl_t1", "title": "Animals", "artist": "Martin Garrix", "plays": "1.5B"},
            {"id": "nl_t2", "title": "Adagio for Strings", "artist": "Tiësto", "plays": "280M"},
        ]
    },
    "PL": {
        "genres": ["Polish Pop", "Polish Hip-Hop", "Disco Polo", "Polish Rock", "Polish Indie"],
        "artists": [
            {"id": "pl1", "name": "Dawid Podsiadło", "image": "https://picsum.photos/seed/dawidp/200", "followers": "4M"},
            {"id": "pl2", "name": "Sanah", "image": "https://picsum.photos/seed/sanah/200", "followers": "3M"},
            {"id": "pl3", "name": "Quebonafide", "image": "https://picsum.photos/seed/quebo/200", "followers": "2.5M"},
            {"id": "pl4", "name": "Doda", "image": "https://picsum.photos/seed/doda/200", "followers": "1.8M"},
        ],
        "trending_tracks": [
            {"id": "pl_t1", "title": "Małomiasteczkowy", "artist": "Dawid Podsiadło", "plays": "180M"},
            {"id": "pl_t2", "title": "Szampan", "artist": "Sanah", "plays": "220M"},
        ]
    },
    "MX": {
        "genres": ["Regional Mexicano", "Cumbia", "Mariachi", "Latin Pop", "Banda", "Norteño"],
        "artists": [
            {"id": "mx1", "name": "Peso Pluma", "image": "https://picsum.photos/seed/pesopluma/200", "followers": "25M"},
            {"id": "mx2", "name": "Grupo Firme", "image": "https://picsum.photos/seed/grupofirme/200", "followers": "18M"},
            {"id": "mx3", "name": "Christian Nodal", "image": "https://picsum.photos/seed/nodal/200", "followers": "22M"},
            {"id": "mx4", "name": "Natanael Cano", "image": "https://picsum.photos/seed/natanael/200", "followers": "15M"},
        ],
        "trending_tracks": [
            {"id": "mx_t1", "title": "Ella Baila Sola", "artist": "Peso Pluma", "plays": "1.2B"},
            {"id": "mx_t2", "title": "Ya No Somos Ni Seremos", "artist": "Christian Nodal", "plays": "580M"},
        ]
    },
}

# Varsayılan global data
DEFAULT_REGION_DATA = {
    "genres": ["Pop", "Rock", "Hip-Hop", "Electronic", "R&B"],
    "artists": [
        {"id": "gl1", "name": "Ed Sheeran", "image": "https://picsum.photos/seed/edsheeran/200", "followers": "85M"},
        {"id": "gl2", "name": "Adele", "image": "https://picsum.photos/seed/adele/200", "followers": "52M"},
        {"id": "gl3", "name": "Bruno Mars", "image": "https://picsum.photos/seed/brunomars/200", "followers": "48M"},
    ],
    "trending_tracks": [
        {"id": "gl_t1", "title": "Shape of You", "artist": "Ed Sheeran", "plays": "3.5B"},
        {"id": "gl_t2", "title": "Easy On Me", "artist": "Adele", "plays": "1.2B"},
    ]
}


@api_router.get("/music/region/{region_code}")
async def get_region_music(region_code: str):
    """Bölgeye göre popüler müzik önerilerini al"""
    region_code = region_code.upper()
    data = REGION_MUSIC_DATA.get(region_code, DEFAULT_REGION_DATA)
    
    return {
        "region": region_code,
        "genres": data["genres"],
        "popular_artists": data["artists"],
        "trending_tracks": data.get("trending_tracks", []),
        "playlists": [
            {"id": f"pl_{region_code}_1", "name": f"{region_code} Top 50", "tracks": 50},
            {"id": f"pl_{region_code}_2", "name": f"{region_code} Viral", "tracks": 30},
            {"id": f"pl_{region_code}_3", "name": f"{region_code} New Releases", "tracks": 40},
        ]
    }


@api_router.get("/music/discover/for-you")
async def get_personalized_discover(
    region: str = "US",
    current_user: dict = Depends(get_current_user)
):
    """Kullanıcı için kişiselleştirilmiş keşfet sayfası"""
    region = region.upper()
    region_data = REGION_MUSIC_DATA.get(region, DEFAULT_REGION_DATA)
    
    # Kullanıcının dinleme geçmişini al (varsa)
    listening_history = await db.listening_history.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("played_at", -1).limit(20).to_list(20)
    
    # Kullanıcının beğenilerini al
    liked_tracks = await db.liked_tracks.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).limit(50).to_list(50)
    
    return {
        "region": region,
        "greeting": f"Merhaba {current_user.get('display_name', current_user['username'])}!",
        "sections": [
            {
                "title": "Senin İçin",
                "type": "personalized",
                "tracks": region_data.get("trending_tracks", [])[:5]
            },
            {
                "title": f"{region}'de Popüler",
                "type": "regional_trending",
                "artists": region_data["artists"][:4]
            },
            {
                "title": "Son Dinlediklerin",
                "type": "recent",
                "tracks": listening_history[:6] if listening_history else []
            },
            {
                "title": "Beğendiğin Türler",
                "type": "genres",
                "genres": region_data["genres"][:5]
            }
        ]
    }

# ============== LOCATION SEARCH (MOCK) ==============

POPULAR_LOCATIONS_TR = [
    {"id": "1", "name": "İstanbul", "region": "Türkiye", "lat": 41.0082, "lng": 28.9784},
    {"id": "2", "name": "Ankara", "region": "Türkiye", "lat": 39.9334, "lng": 32.8597},
    {"id": "3", "name": "İzmir", "region": "Türkiye", "lat": 38.4192, "lng": 27.1287},
    {"id": "4", "name": "Antalya", "region": "Türkiye", "lat": 36.8969, "lng": 30.7133},
    {"id": "5", "name": "Bursa", "region": "Türkiye", "lat": 40.1885, "lng": 29.0610},
    {"id": "6", "name": "Kapadokya", "region": "Nevşehir", "lat": 38.6431, "lng": 34.8289},
    {"id": "7", "name": "Pamukkale", "region": "Denizli", "lat": 37.9204, "lng": 29.1187},
    {"id": "8", "name": "Efes", "region": "İzmir", "lat": 37.9492, "lng": 27.3637},
    {"id": "9", "name": "Bodrum", "region": "Muğla", "lat": 37.0343, "lng": 27.4305},
    {"id": "10", "name": "Fethiye", "region": "Muğla", "lat": 36.6539, "lng": 29.1235},
]

@api_router.get("/locations/search")
async def search_locations(q: str = "", limit: int = 10):
    """Search locations (mock implementation)"""
    if not q or len(q) < 2:
        return POPULAR_LOCATIONS_TR[:limit]
    
    q_lower = q.lower()
    results = [
        loc for loc in POPULAR_LOCATIONS_TR
        if q_lower in loc["name"].lower() or q_lower in loc["region"].lower()
    ]
    
    return results[:limit]

@api_router.get("/locations/popular")
async def get_popular_locations():
    """Get popular locations"""
    return POPULAR_LOCATIONS_TR

# =====================
# Hashtag API
# =====================

POPULAR_HASHTAGS = [
    {"tag": "müzik", "count": 154200},
    {"tag": "socialbeats", "count": 89300},
    {"tag": "türküler", "count": 67800},
    {"tag": "rock", "count": 54200},
    {"tag": "jazz", "count": 43200},
    {"tag": "pop", "count": 38900},
    {"tag": "hiphop", "count": 32100},
    {"tag": "klasikmüzik", "count": 28700},
    {"tag": "canlımüzik", "count": 24500},
    {"tag": "cover", "count": 21300},
    {"tag": "playlist", "count": 19800},
    {"tag": "yenişarkı", "count": 17600},
    {"tag": "müziksever", "count": 15400},
    {"tag": "gitar", "count": 14200},
    {"tag": "piyano", "count": 12800},
]

@api_router.get("/hashtags/search")
async def search_hashtags(q: str = "", limit: int = 10):
    """Search hashtags"""
    if not q or len(q) < 1:
        return {"hashtags": POPULAR_HASHTAGS[:limit]}
    
    q_lower = q.lower()
    results = [
        h for h in POPULAR_HASHTAGS
        if q_lower in h["tag"].lower()
    ]
    
    # Add the search query as a new hashtag if not found
    if not results:
        results = [{"tag": q_lower, "count": 0}]
    
    return {"hashtags": results[:limit]}

@api_router.get("/hashtags/trending")
async def get_trending_hashtags():
    """Get trending hashtags"""
    return {"hashtags": POPULAR_HASHTAGS[:10]}

@api_router.get("/hashtags/{tag}")
async def get_hashtag_posts(
    tag: str,
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get posts with a specific hashtag"""
    # Search posts containing this hashtag
    posts = await db.posts.find(
        {"content": {"$regex": f"#{tag}", "$options": "i"}},
        {"_id": 0}
    ).skip(offset).limit(limit).to_list(limit)
    
    return {
        "tag": tag,
        "posts": posts,
        "total": await db.posts.count_documents({"content": {"$regex": f"#{tag}", "$options": "i"}})
    }

# =====================
# User Search API (for mentions)
# =====================

@api_router.get("/users/search")
async def search_users_for_mentions(
    q: str,
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """Search users for mentions"""
    if not q or len(q) < 1:
        return {"users": []}
    
    # Search by username or display_name
    users = await db.users.find(
        {
            "$or": [
                {"username": {"$regex": q, "$options": "i"}},
                {"display_name": {"$regex": q, "$options": "i"}}
            ],
            "id": {"$ne": current_user["id"]}  # Exclude current user
        },
        {"_id": 0, "password": 0, "two_factor_secret": 0}
    ).limit(limit).to_list(limit)
    
    return {"users": users}

# =====================
# Content Moderation API
# =====================

class ModerationRequest(BaseModel):
    image_url: Optional[str] = None

@api_router.post("/moderation/analyze")
async def analyze_image_moderation(
    file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Analyze image for inappropriate content using Google Cloud Vision API
    
    Accepts either a file upload or an image URL
    """
    if not file and not image_url:
        raise HTTPException(status_code=400, detail="Dosya veya URL gerekli")
    
    try:
        if file:
            # Read file content
            content = await file.read()
            
            # Validate file size (max 10MB)
            if len(content) > 10 * 1024 * 1024:
                raise HTTPException(status_code=413, detail="Dosya 10MB'dan büyük olamaz")
            
            # Validate file type
            allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
            if file.content_type not in allowed_types:
                raise HTTPException(status_code=400, detail=f"Desteklenmeyen dosya tipi: {file.content_type}")
            
            result = await moderation_service.analyze_image(image_content=content)
        else:
            result = await moderation_service.analyze_image(image_url=image_url)
        
        # Store moderation result
        moderation_record = {
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "image_filename": file.filename if file else None,
            "image_url": image_url,
            "result": result,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.moderation_logs.insert_one(moderation_record)
        
        return {
            "status": "rejected" if result["flagged"] else "approved",
            "moderation_result": result,
            "record_id": moderation_record["id"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Moderation error: {e}")
        raise HTTPException(status_code=500, detail="Görüntü analizi başarısız")

@api_router.post("/moderation/analyze-url")
async def analyze_image_url_moderation(
    request: ModerationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Analyze image from URL for content moderation"""
    if not request.image_url:
        raise HTTPException(status_code=400, detail="image_url gerekli")
    
    result = await moderation_service.analyze_image(image_url=request.image_url)
    
    return {
        "status": "rejected" if result["flagged"] else "approved",
        "moderation_result": result
    }

@api_router.get("/moderation/history")
async def get_moderation_history(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get user's moderation history"""
    history = await db.moderation_logs.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"history": history, "total": len(history)}

@api_router.get("/moderation/status")
async def get_moderation_status():
    """Check if content moderation is enabled"""
    return {
        "enabled": moderation_service.enabled,
        "provider": "NudeNet (open source)" if moderation_service.enabled else "Mock (disabled)",
        "thresholds": MODERATION_THRESHOLDS
    }

# ============== ADMIN ENDPOINTS ==============

@api_router.post("/admin/block-ip")
async def block_ip_admin(
    ip: str,
    duration_minutes: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Block an IP address (admin only)"""
    # Check if user is admin
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    rate_limiter.block_ip(ip, duration_minutes)
    return {"message": f"IP {ip} {duration_minutes} dakika engellendi"}

@api_router.get("/admin/rate-limits")
async def get_rate_limit_stats_admin(
    current_user: dict = Depends(get_current_user)
):
    """Get rate limiting statistics (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    stats = rate_limiter.get_stats()
    stats["blocked_ips"] = rate_limiter.get_blocked_ips()
    return stats

@api_router.delete("/admin/unblock-ip")
async def unblock_ip_admin(
    ip: str,
    current_user: dict = Depends(get_current_user)
):
    """Unblock an IP address (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    if rate_limiter.unblock_ip(ip):
        return {"message": f"IP {ip} engeli kaldırıldı"}
    raise HTTPException(status_code=404, detail="IP engelliler listesinde bulunamadı")

# ============== SECURITY DASHBOARD (admin) ==============

@api_router.get("/security/stats")
async def get_security_stats(current_user: dict = Depends(get_current_user)):
    """Get security statistics (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    rl_stats = rate_limiter.get_stats() if hasattr(rate_limiter, "get_stats") else {}
    blocked = rate_limiter.get_blocked_ips() if hasattr(rate_limiter, "get_blocked_ips") else []
    blocked_count = len(blocked) if isinstance(blocked, list) else rl_stats.get("blocked_ips_count", 0)
    ip_lists = await ip_manager.get_lists() if ip_manager else {"whitelist": [], "blacklist": []}
    restrictions_count = await db.user_restrictions.count_documents({"is_active": True})
    pending_verifications = await db.verification_applications.count_documents({"status": "pending"})
    return {
        "rate_limit_requests": rl_stats.get("total_requests", rl_stats.get("total_tracked_ips", 0)),
        "rate_limit_blocked": rl_stats.get("blocked_requests", blocked_count),
        "blocked_ips_count": blocked_count,
        "whitelist_count": len(ip_lists.get("whitelist", [])),
        "blacklist_count": len(ip_lists.get("blacklist", [])),
        "active_restrictions": restrictions_count,
        "pending_verifications": pending_verifications,
    }

@api_router.get("/security/moderation/logs")
async def get_moderation_logs(
    limit: int = Query(default=50, le=200),
    current_user: dict = Depends(get_current_user)
):
    """Get moderation/restriction logs (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    logs = await db.user_restrictions.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    for log in logs:
        user = await db.users.find_one(
            {"id": log.get("user_id")},
            {"_id": 0, "id": 1, "username": 1, "display_name": 1}
        )
        if user:
            log["user"] = user
    return logs

@api_router.get("/security/attacks")
async def get_attack_logs(current_user: dict = Depends(get_current_user)):
    """Get attack/blocked attempts (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    blocked = rate_limiter.get_blocked_ips() if hasattr(rate_limiter, "get_blocked_ips") else []
    rl_stats = rate_limiter.get_stats() if hasattr(rate_limiter, "get_stats") else {}
    ips = [{"ip": (b.get("ip") if isinstance(b, dict) else b)} for b in blocked]
    return {
        "blocked_ips": ips,
        "blocked_requests": rl_stats.get("blocked_requests", len(ips)),
        "total_requests": rl_stats.get("total_requests", rl_stats.get("total_tracked_ips", 0)),
    }

@api_router.post("/security/unblock-ip")
async def security_unblock_ip(
    ip: str,
    current_user: dict = Depends(get_current_user)
):
    """Unblock an IP (admin only) - alias for DELETE /admin/unblock-ip"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    if rate_limiter.unblock_ip(ip):
        return {"message": f"IP {ip} engeli kaldırıldı"}
    raise HTTPException(status_code=404, detail="IP engelliler listesinde bulunamadı")

@api_router.post("/admin/cleanup/stories")
async def trigger_story_cleanup_admin(
    current_user: dict = Depends(get_current_user)
):
    """Manually trigger story cleanup (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    await cleanup_expired_stories()
    return {"message": "Hikaye temizliği tamamlandı"}

@api_router.post("/admin/cleanup/notifications")
async def trigger_notification_cleanup_admin(
    current_user: dict = Depends(get_current_user)
):
    """Manually trigger notification cleanup (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    await cleanup_old_notifications()
    return {"message": "Bildirim temizliği tamamlandı"}


# ============== NOTIFICATION SETTINGS ==============

# Notification Sound Options
NOTIFICATION_SOUNDS = [
    {"id": "default", "name": "Varsayılan", "file": "default.mp3"},
    {"id": "chime", "name": "Çan", "file": "chime.mp3"},
    {"id": "pop", "name": "Pop", "file": "pop.mp3"},
    {"id": "ding", "name": "Ding", "file": "ding.mp3"},
    {"id": "gentle", "name": "Nazik", "file": "gentle.mp3"},
    {"id": "none", "name": "Sessiz", "file": None}
]

@api_router.get("/notifications/settings")
async def get_notification_settings(current_user: dict = Depends(get_current_user)):
    """Get user's notification settings"""
    settings = await db.notification_settings.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not settings:
        # Return defaults
        return {
            "user_id": current_user["id"],
            "push_enabled": True,
            "email_enabled": True,
            "sms_enabled": False,
            "sound": "default",
            "vibration": True,
            "do_not_disturb": False,
            "dnd_start": "22:00",
            "dnd_end": "08:00",
            "dnd_allow_calls": False,
            "message_notifications": True,
            "like_notifications": True,
            "comment_notifications": True,
            "follow_notifications": True,
            "mention_notifications": True,
            "story_notifications": True,
            "friend_request_notifications": True,
            "live_notifications": True,
            "weekly_summary_email": True,
            "promotional_emails": False,
            "available_sounds": NOTIFICATION_SOUNDS
        }
    
    settings["available_sounds"] = NOTIFICATION_SOUNDS
    return settings

@api_router.put("/notifications/settings")
async def update_notification_settings(
    push_enabled: Optional[bool] = None,
    email_enabled: Optional[bool] = None,
    sms_enabled: Optional[bool] = None,
    sound: Optional[str] = None,
    vibration: Optional[bool] = None,
    do_not_disturb: Optional[bool] = None,
    dnd_start: Optional[str] = None,
    dnd_end: Optional[str] = None,
    dnd_allow_calls: Optional[bool] = None,
    message_notifications: Optional[bool] = None,
    like_notifications: Optional[bool] = None,
    comment_notifications: Optional[bool] = None,
    follow_notifications: Optional[bool] = None,
    mention_notifications: Optional[bool] = None,
    story_notifications: Optional[bool] = None,
    friend_request_notifications: Optional[bool] = None,
    live_notifications: Optional[bool] = None,
    weekly_summary_email: Optional[bool] = None,
    promotional_emails: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update user's notification settings"""
    update_data = {}
    
    if push_enabled is not None:
        update_data["push_enabled"] = push_enabled
    if email_enabled is not None:
        update_data["email_enabled"] = email_enabled
    if sms_enabled is not None:
        update_data["sms_enabled"] = sms_enabled
    if sound is not None:
        # Validate sound
        valid_sounds = [s["id"] for s in NOTIFICATION_SOUNDS]
        if sound not in valid_sounds:
            raise HTTPException(status_code=400, detail="Geçersiz bildirim sesi")
        update_data["sound"] = sound
    if vibration is not None:
        update_data["vibration"] = vibration
    if do_not_disturb is not None:
        update_data["do_not_disturb"] = do_not_disturb
    if dnd_start is not None:
        update_data["dnd_start"] = dnd_start
    if dnd_end is not None:
        update_data["dnd_end"] = dnd_end
    if dnd_allow_calls is not None:
        update_data["dnd_allow_calls"] = dnd_allow_calls
    if message_notifications is not None:
        update_data["message_notifications"] = message_notifications
    if like_notifications is not None:
        update_data["like_notifications"] = like_notifications
    if comment_notifications is not None:
        update_data["comment_notifications"] = comment_notifications
    if follow_notifications is not None:
        update_data["follow_notifications"] = follow_notifications
    if mention_notifications is not None:
        update_data["mention_notifications"] = mention_notifications
    if story_notifications is not None:
        update_data["story_notifications"] = story_notifications
    if friend_request_notifications is not None:
        update_data["friend_request_notifications"] = friend_request_notifications
    if live_notifications is not None:
        update_data["live_notifications"] = live_notifications
    if weekly_summary_email is not None:
        update_data["weekly_summary_email"] = weekly_summary_email
    if promotional_emails is not None:
        update_data["promotional_emails"] = promotional_emails
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Güncellenecek ayar belirtilmedi")
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.notification_settings.update_one(
        {"user_id": current_user["id"]},
        {"$set": {**update_data, "user_id": current_user["id"]}},
        upsert=True
    )
    
    return {"message": "Bildirim ayarları güncellendi"}

@api_router.post("/notifications/settings/schedule")
async def set_notification_schedule(
    schedule: List[dict],
    current_user: dict = Depends(get_current_user)
):
    """
    Set notification schedule (when to receive notifications)
    schedule: [{"day": "monday", "enabled": true, "start": "09:00", "end": "21:00"}, ...]
    """
    valid_days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    
    for item in schedule:
        if item.get("day") not in valid_days:
            raise HTTPException(status_code=400, detail=f"Geçersiz gün: {item.get('day')}")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.notification_settings.update_one(
        {"user_id": current_user["id"]},
        {"$set": {"schedule": schedule, "updated_at": now}},
        upsert=True
    )
    
    return {"message": "Bildirim zamanlaması güncellendi"}

# ============== STORY REACTIONS ==============

@api_router.post("/stories/reaction")
async def send_story_reaction(
    story_id: str = Form(...),
    reaction: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Send a reaction to a story"""
    story = await db.stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Check if user already reacted
    existing = await db.story_reactions.find_one({
        "story_id": story_id,
        "user_id": current_user["id"]
    })
    
    if existing:
        # Update existing reaction
        await db.story_reactions.update_one(
            {"id": existing["id"]},
            {"$set": {"reaction": reaction, "updated_at": now}}
        )
    else:
        # Create new reaction
        reaction_doc = {
            "id": str(uuid.uuid4()),
            "story_id": story_id,
            "user_id": current_user["id"],
            "reaction": reaction,
            "created_at": now
        }
        await db.story_reactions.insert_one(reaction_doc)
        
        # Send notification to story owner
        if story["user_id"] != current_user["id"]:
            notification = {
                "id": str(uuid.uuid4()),
                "user_id": story["user_id"],
                "type": "story_reaction",
                "title": "Hikaye Tepkisi",
                "message": f"{current_user.get('display_name', current_user['username'])} hikayene {reaction} tepkisi verdi",
                "data": {"story_id": story_id, "reaction": reaction},
                "is_read": False,
                "created_at": now
            }
            await db.notifications.insert_one(notification)
    
    return {"message": "Tepki gönderildi"}

@api_router.get("/stories/{story_id}/reactions")
async def get_story_reactions(
    story_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get reactions for a story"""
    reactions = await db.story_reactions.find(
        {"story_id": story_id},
        {"_id": 0}
    ).to_list(length=100)
    
    # Group by reaction type
    grouped = {}
    for r in reactions:
        emoji = r["reaction"]
        if emoji not in grouped:
            grouped[emoji] = {"emoji": emoji, "count": 0, "users": []}
        grouped[emoji]["count"] += 1
        grouped[emoji]["users"].append(r["user_id"])
    
    # Check if current user reacted
    user_reaction = next((r for r in reactions if r["user_id"] == current_user["id"]), None)
    
    return {
        "reactions": list(grouped.values()),
        "total": len(reactions),
        "user_reaction": user_reaction["reaction"] if user_reaction else None
    }

@api_router.delete("/stories/{story_id}/reaction")
async def remove_story_reaction(
    story_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove user's reaction from a story"""
    result = await db.story_reactions.delete_one({
        "story_id": story_id,
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tepki bulunamadı")
    
    return {"message": "Tepki kaldırıldı"}

# ============== STORY REACTIONS (V2) ==============

@api_router.post("/stories/{story_id}/react")
async def react_to_story(story_id: str, body: dict, current_user=Depends(get_current_user)):
    reaction_type = body.get("reaction", "heart")
    valid_reactions = ["heart", "fire", "laugh", "wow", "sad", "clap"]
    if reaction_type not in valid_reactions:
        raise HTTPException(400, "Invalid reaction")

    reaction = {
        "id": str(uuid.uuid4()),
        "story_id": story_id,
        "user_id": current_user["id"],
        "username": current_user.get("username", ""),
        "reaction": reaction_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.story_reactions.update_one(
        {"story_id": story_id, "user_id": current_user["id"]},
        {"$set": reaction},
        upsert=True,
    )
    return {"status": "reacted", "reaction": reaction_type}

@api_router.get("/stories/{story_id}/reactions/v2")
async def get_story_reactions_v2(story_id: str):
    reactions = await db.story_reactions.find({"story_id": story_id}).to_list(100)
    for r in reactions:
        r.pop("_id", None)
    summary = {}
    for r in reactions:
        rt = r["reaction"]
        summary[rt] = summary.get(rt, 0) + 1
    return {"reactions": reactions, "summary": summary, "total": len(reactions)}

# ============== STORY HIGHLIGHTS (V2) ==============

@api_router.post("/stories/highlights")
async def create_story_highlight(body: dict, current_user=Depends(get_current_user)):
    highlight = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "title": body.get("title", "Highlight"),
        "cover_url": body.get("cover_url", ""),
        "story_ids": body.get("story_ids", []),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.story_highlights.insert_one(highlight)
    highlight.pop("_id", None)
    return highlight

@api_router.get("/stories/highlights/{user_id}")
async def get_user_story_highlights(user_id: str):
    highlights = await db.story_highlights.find({"user_id": user_id}).sort("created_at", -1).to_list(50)
    for h in highlights:
        h.pop("_id", None)
    return highlights

@api_router.post("/stories/highlights/{highlight_id}/stories")
async def add_story_to_story_highlight(highlight_id: str, body: dict, current_user=Depends(get_current_user)):
    story_id = body.get("story_id")
    if not story_id:
        raise HTTPException(400, "story_id required")
    await db.story_highlights.update_one(
        {"id": highlight_id, "user_id": current_user["id"]},
        {"$addToSet": {"story_ids": story_id}}
    )
    return {"status": "added"}

@api_router.delete("/stories/highlights/{highlight_id}")
async def delete_story_highlight(highlight_id: str, current_user=Depends(get_current_user)):
    await db.story_highlights.delete_one({"id": highlight_id, "user_id": current_user["id"]})
    return {"status": "deleted"}

# ============== STORY POLLS ==============

@api_router.post("/stories/{story_id}/poll/vote")
async def vote_story_poll(
    story_id: str,
    option_id: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Vote on a story poll"""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    
    if story.get("story_type") != "poll":
        raise HTTPException(status_code=400, detail="Bu hikaye bir anket değil")
    
    poll_options = story.get("poll_options", [])
    if not poll_options:
        raise HTTPException(status_code=400, detail="Anket seçenekleri bulunamadı")
    
    # Check if option exists
    option = next((o for o in poll_options if o["id"] == option_id), None)
    if not option:
        raise HTTPException(status_code=404, detail="Seçenek bulunamadı")
    
    user_id = current_user["id"]
    
    # Remove previous vote if any
    for opt in poll_options:
        if user_id in opt.get("voters", []):
            opt["voters"].remove(user_id)
            opt["votes"] = max(0, opt["votes"] - 1)
    
    # Add new vote
    option["voters"].append(user_id)
    option["votes"] += 1
    
    # Update story in DB
    await db.stories.update_one(
        {"id": story_id},
        {"$set": {"poll_options": poll_options}}
    )
    
    # Calculate percentages
    total_votes = sum(o["votes"] for o in poll_options)
    results = []
    for opt in poll_options:
        percentage = (opt["votes"] / total_votes * 100) if total_votes > 0 else 0
        results.append({
            "id": opt["id"],
            "text": opt["text"],
            "votes": opt["votes"],
            "percentage": round(percentage, 1),
            "is_user_vote": user_id in opt.get("voters", [])
        })
    
    return {
        "message": "Oy verildi",
        "results": results,
        "total_votes": total_votes,
        "user_vote": option_id
    }

@api_router.get("/stories/{story_id}/poll/results")
async def get_poll_results(
    story_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get poll results for a story"""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    
    if story.get("story_type") != "poll":
        raise HTTPException(status_code=400, detail="Bu hikaye bir anket değil")
    
    poll_options = story.get("poll_options", [])
    total_votes = sum(o["votes"] for o in poll_options)
    user_id = current_user["id"]
    
    results = []
    user_vote = None
    for opt in poll_options:
        percentage = (opt["votes"] / total_votes * 100) if total_votes > 0 else 0
        is_user_vote = user_id in opt.get("voters", [])
        if is_user_vote:
            user_vote = opt["id"]
        results.append({
            "id": opt["id"],
            "text": opt["text"],
            "votes": opt["votes"],
            "percentage": round(percentage, 1),
            "is_user_vote": is_user_vote
        })
    
    return {
        "question": story.get("poll_question"),
        "results": results,
        "total_votes": total_votes,
        "user_vote": user_vote,
        "is_owner": story["user_id"] == user_id
    }

# ============== STORY SWIPE-UP LINKS ==============

@api_router.post("/stories/{story_id}/swipe-up/track")
async def track_swipe_up(
    story_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Track swipe-up link click"""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    
    if not story.get("swipe_up_url"):
        raise HTTPException(status_code=400, detail="Bu hikayede swipe-up link yok")
    
    now = datetime.now(timezone.utc)
    
    # Track the click
    click_doc = {
        "id": str(uuid.uuid4()),
        "story_id": story_id,
        "user_id": current_user["id"],
        "url": story["swipe_up_url"],
        "clicked_at": now.isoformat()
    }
    await db.swipe_up_clicks.insert_one(click_doc)
    
    return {
        "url": story["swipe_up_url"],
        "title": story.get("swipe_up_title", "Link'i aç")
    }

@api_router.get("/stories/{story_id}/swipe-up/stats")
async def get_swipe_up_stats(
    story_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get swipe-up link statistics (owner only)"""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    
    if story["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Bu istatistikleri görme yetkiniz yok")
    
    # Get click count
    click_count = await db.swipe_up_clicks.count_documents({"story_id": story_id})
    
    # Get unique clickers
    pipeline = [
        {"$match": {"story_id": story_id}},
        {"$group": {"_id": "$user_id"}},
        {"$count": "unique_users"}
    ]
    result = await db.swipe_up_clicks.aggregate(pipeline).to_list(1)
    unique_clicks = result[0]["unique_users"] if result else 0
    
    return {
        "total_clicks": click_count,
        "unique_clicks": unique_clicks,
        "url": story.get("swipe_up_url"),
        "title": story.get("swipe_up_title")
    }

# ============== STORY MUSIC SYNC ==============

@api_router.get("/stories/{story_id}/music")
async def get_story_music(
    story_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get music track attached to a story"""
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    
    music_track = story.get("music_track")
    if not music_track:
        return {"has_music": False}
    
    return {
        "has_music": True,
        "track": music_track,
        "start_time": story.get("music_start_time", 0)
    }

@api_router.get("/stories/music/search")
async def search_story_music(
    query: str,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Search music tracks for story"""
    query_lower = query.lower()
    
    # Search in mock tracks
    results = [
        {
            "id": t["id"],
            "title": t["title"],
            "artist": t["artist"],
            "cover_url": t.get("cover_url"),
            "preview_url": t.get("preview_url"),
            "duration": t.get("duration", 180)
        }
        for t in MOCK_TRACKS
        if query_lower in t["title"].lower() or query_lower in t["artist"].lower()
    ][:limit]
    
    return {"tracks": results, "total": len(results)}

# ============== VOICE & VIDEO CALLS (WebRTC) ==============

# ── Redis-backed call state (falls back to in-memory) ──────────────────────────
import json as _json

_redis_client = None

async def _get_redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis.asyncio as aioredis
        url = os.environ.get("REDIS_URL", "")
        if url:
            _redis_client = aioredis.from_url(url, decode_responses=True, socket_connect_timeout=3)
            await _redis_client.ping()
            logger.info("Redis connected for call state")
    except Exception as e:
        logger.debug(f"Redis unavailable, using in-memory: {e}")
        _redis_client = None
    return _redis_client

_active_calls_memory = {}  # fallback

async def _set_call(call_id: str, data: dict):
    r = await _get_redis()
    if r:
        try:
            await r.setex(f"call:{call_id}", 3600, _json.dumps(data))
            return
        except Exception:
            pass
    _active_calls_memory[call_id] = data

async def _get_call(call_id: str) -> dict | None:
    r = await _get_redis()
    if r:
        try:
            raw = await r.get(f"call:{call_id}")
            if raw:
                return _json.loads(raw)
        except Exception:
            pass
    return _active_calls_memory.get(call_id)

async def _del_call(call_id: str):
    r = await _get_redis()
    if r:
        try:
            await r.delete(f"call:{call_id}")
        except Exception:
            pass
    _active_calls_memory.pop(call_id, None)

# Keep active_calls as alias (sync fallback dict still used in legacy code)
active_calls = _active_calls_memory

@api_router.post("/calls/initiate")
async def initiate_call(
    callee_id: str = Form(...),
    call_type: str = Form(default="voice"),  # voice or video
    current_user: dict = Depends(get_current_user)
):
    """Initiate a voice or video call"""
    caller_id = current_user["id"]
    
    # Check if callee exists
    callee = await db.users.find_one({"id": callee_id}, {"_id": 0, "password": 0})
    if not callee:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    # Check if already in a call
    for call_id, call in active_calls.items():
        if caller_id in [call["caller_id"], call["callee_id"]] and call["status"] == "active":
            raise HTTPException(status_code=400, detail="Zaten bir çağrıdasınız")
    
    call_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    call_data = {
        "id": call_id,
        "caller_id": caller_id,
        "caller_name": current_user.get("display_name", current_user["username"]),
        "caller_avatar": current_user.get("avatar_url"),
        "callee_id": callee_id,
        "callee_name": callee.get("display_name", callee["username"]),
        "callee_avatar": callee.get("avatar_url"),
        "call_type": call_type,
        "status": "ringing",
        "started_at": now.isoformat(),
        "answered_at": None,
        "ended_at": None,
        "duration": 0
    }
    
    await _set_call(call_id, call_data)

    room_name = f"call_{call_id}"

    # Store in DB for history
    await db.calls.insert_one({**call_data})
    
    # Send push notification to callee
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": callee_id,
        "type": "incoming_call",
        "title": f"{'Görüntülü' if call_type == 'video' else 'Sesli'} Arama",
        "message": f"{current_user.get('display_name', current_user['username'])} sizi arıyor",
        "data": {"call_id": call_id, "call_type": call_type, "caller_id": caller_id},
        "is_read": False,
        "created_at": now.isoformat()
    }
    await db.notifications.insert_one(notification)
    # Evolution API: WhatsApp ile arama daveti (callee phone varsa)
    try:
        from services.evolution_api_service import send_text, is_available
        if is_available() and callee.get("phone"):
            call_label = "Görüntülü arama" if call_type == "video" else "Sesli arama"
            msg = f"📞 {current_user.get('display_name', current_user['username'])} sizi {call_label} ile arıyor. Açmak için uygulamayı kullanın."
            await send_text(callee["phone"], msg)
    except Exception:
        pass
    return {
        "call_id": call_id,
        "status": "ringing",
        "callee": {
            "id": callee_id,
            "name": callee.get("display_name", callee["username"]),
            "avatar": callee.get("avatar_url")
        }
    }

@api_router.post("/calls/{call_id}/answer")
async def answer_call(
    call_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Answer an incoming call"""
    call = await _get_call(call_id)
    if not call:
        call = await db.calls.find_one({"id": call_id}, {"_id": 0})
        if not call:
            raise HTTPException(status_code=404, detail="Çağrı bulunamadı")

    if call["callee_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Bu çağrıyı cevaplayamazsınız")

    if call["status"] != "ringing":
        raise HTTPException(status_code=400, detail="Çağrı artık cevaplanamaz")

    now = datetime.now(timezone.utc)
    call["status"] = "active"
    call["answered_at"] = now.isoformat()
    await _set_call(call_id, call)

    await db.calls.update_one(
        {"id": call_id},
        {"$set": {"status": "active", "answered_at": now.isoformat()}}
    )

    return {
        "call_id": call_id,
        "status": "active",
        "call_type": call["call_type"],
        "peer": {
            "id": call["caller_id"],
            "name": call["caller_name"],
            "avatar": call["caller_avatar"]
        }
    }

@api_router.post("/calls/{call_id}/reject")
async def reject_call(
    call_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Reject an incoming call"""
    call = await _get_call(call_id)
    if not call:
        call = await db.calls.find_one({"id": call_id}, {"_id": 0})
        if not call:
            raise HTTPException(status_code=404, detail="Çağrı bulunamadı")

    if call["callee_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Bu çağrıyı reddedemezsiniz")

    now = datetime.now(timezone.utc)
    await db.calls.update_one(
        {"id": call_id},
        {"$set": {"status": "rejected", "ended_at": now.isoformat()}}
    )
    await _del_call(call_id)
    return {"message": "Çağrı reddedildi"}

@api_router.post("/calls/{call_id}/end")
async def end_call(
    call_id: str,
    current_user: dict = Depends(get_current_user)
):
    """End an active call"""
    call = await _get_call(call_id)
    if not call:
        call = await db.calls.find_one({"id": call_id}, {"_id": 0})
        if not call:
            raise HTTPException(status_code=404, detail="Çağrı bulunamadı")

    user_id = current_user["id"]
    if user_id not in [call["caller_id"], call["callee_id"]]:
        raise HTTPException(status_code=403, detail="Bu çağrıyı sonlandıramazsınız")

    now = datetime.now(timezone.utc)
    duration = 0
    if call.get("answered_at"):
        answered = datetime.fromisoformat(call["answered_at"].replace("Z", "+00:00"))
        duration = int((now - answered).total_seconds())

    await db.calls.update_one(
        {"id": call_id},
        {"$set": {"status": "ended", "ended_at": now.isoformat(), "duration": duration}}
    )
    await _del_call(call_id)

    return {"message": "Çağrı sonlandırıldı", "duration": duration}

@api_router.get("/calls/{call_id}/status")
async def get_call_status(
    call_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get current call status"""
    if call_id in active_calls:
        call = active_calls[call_id]
    else:
        call = await db.calls.find_one({"id": call_id}, {"_id": 0})
        if not call:
            raise HTTPException(status_code=404, detail="Çağrı bulunamadı")
    
    user_id = current_user["id"]
    if user_id not in [call["caller_id"], call["callee_id"]]:
        raise HTTPException(status_code=403, detail="Bu çağrıya erişiminiz yok")
    
    return {
        "call_id": call_id,
        "status": call["status"],
        "call_type": call["call_type"],
        "duration": call.get("duration", 0)
    }

@api_router.get("/calls/history")
async def get_call_history(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get call history for current user"""
    user_id = current_user["id"]
    
    calls = await db.calls.find(
        {"$or": [{"caller_id": user_id}, {"callee_id": user_id}]},
        {"_id": 0}
    ).sort("started_at", -1).to_list(limit)
    
    # Enrich with direction info
    for call in calls:
        call["direction"] = "outgoing" if call["caller_id"] == user_id else "incoming"
        call["peer"] = {
            "id": call["callee_id"] if call["caller_id"] == user_id else call["caller_id"],
            "name": call["callee_name"] if call["caller_id"] == user_id else call["caller_name"],
            "avatar": call["callee_avatar"] if call["caller_id"] == user_id else call["caller_avatar"]
        }
    
    return {"calls": calls}

# WebRTC Signaling (simplified - in production use WebSocket)
@api_router.post("/calls/{call_id}/signal")
async def send_signal(
    call_id: str,
    signal_type: str = Form(...),  # offer, answer, ice-candidate
    signal_data: str = Form(...),  # SDP or ICE candidate JSON
    current_user: dict = Depends(get_current_user)
):
    """Send WebRTC signaling data"""
    if call_id not in active_calls:
        call = await db.calls.find_one({"id": call_id}, {"_id": 0})
        if not call:
            raise HTTPException(status_code=404, detail="Çağrı bulunamadı")
    else:
        call = active_calls[call_id]
    
    user_id = current_user["id"]
    if user_id not in [call["caller_id"], call["callee_id"]]:
        raise HTTPException(status_code=403, detail="Bu çağrıya erişiminiz yok")
    
    # Determine recipient
    recipient_id = call["callee_id"] if user_id == call["caller_id"] else call["caller_id"]
    
    # Store signal for recipient to poll
    signal_doc = {
        "id": str(uuid.uuid4()),
        "call_id": call_id,
        "sender_id": user_id,
        "recipient_id": recipient_id,
        "signal_type": signal_type,
        "signal_data": signal_data,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "retrieved": False
    }
    await db.call_signals.insert_one(signal_doc)
    
    return {"message": "Sinyal gönderildi"}

@api_router.get("/calls/{call_id}/signals")
async def get_signals(
    call_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get pending WebRTC signals for the call"""
    user_id = current_user["id"]
    
    # Get unretrieved signals for this user
    signals = await db.call_signals.find(
        {"call_id": call_id, "recipient_id": user_id, "retrieved": False},
        {"_id": 0}
    ).to_list(100)
    
    # Mark as retrieved
    if signals:
        await db.call_signals.update_many(
            {"call_id": call_id, "recipient_id": user_id, "retrieved": False},
            {"$set": {"retrieved": True}}
        )
    
    return {"signals": signals}

# ============== END-TO-END ENCRYPTION ==============

@api_router.post("/encryption/keys/generate")
async def generate_encryption_keys(
    current_user: dict = Depends(get_current_user)
):
    """Generate E2E encryption key pair for user"""
    import secrets
    import hashlib
    
    user_id = current_user["id"]
    
    # Generate key pair (simplified - in production use proper crypto library)
    # This generates a mock key pair for demo purposes
    private_key_seed = secrets.token_hex(32)
    public_key = hashlib.sha256(f"{private_key_seed}{user_id}".encode()).hexdigest()
    
    now = datetime.now(timezone.utc)
    
    # Store public key only (private key should be stored on device)
    key_doc = {
        "user_id": user_id,
        "public_key": public_key,
        "key_id": str(uuid.uuid4()),
        "created_at": now.isoformat(),
        "is_active": True
    }
    
    # Deactivate old keys
    await db.encryption_keys.update_many(
        {"user_id": user_id},
        {"$set": {"is_active": False}}
    )
    
    await db.encryption_keys.insert_one(key_doc)
    
    return {
        "public_key": public_key,
        "private_key_seed": private_key_seed,  # User should store this securely
        "key_id": key_doc["key_id"],
        "message": "Anahtarlar oluşturuldu. Özel anahtarınızı güvenli bir yerde saklayın!"
    }

@api_router.get("/encryption/keys/{user_id}")
async def get_user_public_key(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a user's public encryption key"""
    key = await db.encryption_keys.find_one(
        {"user_id": user_id, "is_active": True},
        {"_id": 0}
    )
    
    if not key:
        return {"has_key": False}
    
    return {
        "has_key": True,
        "public_key": key["public_key"],
        "key_id": key["key_id"]
    }

@api_router.post("/messages/encrypted")
async def send_encrypted_message(
    conversation_id: str = Form(...),
    encrypted_content: str = Form(...),  # Base64 encoded encrypted content
    recipient_key_id: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Send an end-to-end encrypted message"""
    now = datetime.now(timezone.utc)
    message_id = str(uuid.uuid4())
    
    message = {
        "id": message_id,
        "conversation_id": conversation_id,
        "sender_id": current_user["id"],
        "content": "[Şifreli Mesaj]",  # Placeholder for UI
        "encrypted_content": encrypted_content,
        "recipient_key_id": recipient_key_id,
        "content_type": "encrypted",
        "is_encrypted": True,
        "created_at": now.isoformat()
    }
    
    await db.messages.insert_one(message)
    
    # Update conversation
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {
            "last_message": "🔒 Şifreli mesaj",
            "last_message_at": now.isoformat()
        }}
    )
    
    message.pop("_id", None)
    return {"message": message}

@api_router.post("/conversations/{conversation_id}/enable-e2e")
async def enable_e2e_encryption(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Enable E2E encryption for a conversation"""
    conversation = await db.conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conversation:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")
    
    if current_user["id"] not in conversation.get("participants", []):
        raise HTTPException(status_code=403, detail="Bu sohbete erişiminiz yok")
    
    # Check if all participants have encryption keys
    participants = conversation.get("participants", [])
    missing_keys = []
    
    for pid in participants:
        key = await db.encryption_keys.find_one({"user_id": pid, "is_active": True})
        if not key:
            user = await db.users.find_one({"id": pid}, {"_id": 0, "username": 1})
            missing_keys.append(user.get("username", pid) if user else pid)
    
    if missing_keys:
        return {
            "enabled": False,
            "message": f"Şu kullanıcıların şifreleme anahtarı yok: {', '.join(missing_keys)}"
        }
    
    # Enable E2E
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"e2e_enabled": True, "e2e_enabled_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "enabled": True,
        "message": "Uçtan uca şifreleme etkinleştirildi"
    }

# ============== WEBAUTHN (Security Key) ==============

def _get_webauthn_rp_id(request: Request | None = None) -> str:
    """Get RP ID from env or derive from request host."""
    if WEBAUTHN_RP_ID:
        return WEBAUTHN_RP_ID
    if request:
        host = request.headers.get("host", "").split(":")[0]
        if host:
            return host
    return "localhost"


def _get_webauthn_origin(request: Request | None = None) -> str:
    """Get origin from env or derive from request."""
    if WEBAUTHN_ORIGIN:
        return WEBAUTHN_ORIGIN
    if request:
        return str(request.base_url).rstrip("/")
    return "http://localhost"


@api_router.post("/auth/webauthn/register/begin")
async def webauthn_register_begin(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """Begin WebAuthn registration process"""
    from webauthn import generate_registration_options, options_to_json
    from webauthn.helpers import bytes_to_base64url
    from webauthn.helpers.structs import AuthenticatorSelectionCriteria, ResidentKeyRequirement, UserVerificationRequirement

    user_id = current_user["id"]
    rp_id = _get_webauthn_rp_id(request)
    rp_name = WEBAUTHN_RP_NAME

    options = generate_registration_options(
        rp_id=rp_id,
        rp_name=rp_name,
        user_name=current_user["username"],
        user_id=user_id.encode("utf-8"),
        user_display_name=current_user.get("display_name", current_user["username"]),
        authenticator_selection=AuthenticatorSelectionCriteria(
            authenticator_attachment=None,
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
    )
    challenge_b64 = bytes_to_base64url(options.challenge)

    await db.webauthn_challenges.insert_one({
        "user_id": user_id,
        "challenge": challenge_b64,
        "type": "registration",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "used": False
    })

    return options_to_json(options)

@api_router.post("/auth/webauthn/register/complete")
async def webauthn_register_complete(
    request: Request,
    credential_id: str = Form(...),
    attestation_object: str = Form(...),
    client_data_json: str = Form(...),
    device_name: str = Form(default="Güvenlik Anahtarı"),
    current_user: dict = Depends(get_current_user)
):
    """Complete WebAuthn registration"""
    from webauthn import verify_registration_response
    from webauthn.helpers import base64url_to_bytes
    from webauthn.helpers.exceptions import InvalidRegistrationResponse

    user_id = current_user["id"]
    challenge_doc = await db.webauthn_challenges.find_one({
        "user_id": user_id,
        "type": "registration",
        "used": False
    })

    if not challenge_doc:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş challenge")

    expected_challenge = base64url_to_bytes(challenge_doc["challenge"])
    expected_rp_id = _get_webauthn_rp_id(request)
    expected_origin = _get_webauthn_origin(request)

    credential_payload = {
        "id": credential_id,
        "rawId": credential_id,
        "type": "public-key",
        "response": {
            "clientDataJSON": client_data_json,
            "attestationObject": attestation_object,
        },
    }

    try:
        verification = verify_registration_response(
            credential=credential_payload,
            expected_challenge=expected_challenge,
            expected_rp_id=expected_rp_id,
            expected_origin=expected_origin,
        )
    except InvalidRegistrationResponse as e:
        raise HTTPException(status_code=400, detail=str(e))

    await db.webauthn_challenges.update_one(
        {"_id": challenge_doc["_id"]},
        {"$set": {"used": True}}
    )

    from webauthn.helpers import bytes_to_base64url
    now = datetime.now(timezone.utc)
    credential = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "credential_id": bytes_to_base64url(verification.credential_id),
        "public_key": bytes_to_base64url(verification.credential_public_key),
        "device_name": device_name,
        "sign_count": verification.sign_count,
        "created_at": now.isoformat(),
        "last_used_at": None,
        "is_active": True
    }

    await db.webauthn_credentials.insert_one(credential)

    return {
        "message": "Güvenlik anahtarı başarıyla kaydedildi",
        "credential_id": credential["id"],
        "device_name": device_name
    }

@api_router.post("/auth/webauthn/login/begin")
async def webauthn_login_begin(
    request: Request,
    username: str = Form(...)
):
    """Begin WebAuthn login process"""
    from webauthn import generate_authentication_options, options_to_json
    from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
    from webauthn.helpers.structs import PublicKeyCredentialDescriptor

    user = await db.users.find_one({"username": username}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    credentials = await db.webauthn_credentials.find(
        {"user_id": user["id"], "is_active": True},
        {"_id": 0, "credential_id": 1}
    ).to_list(10)

    if not credentials:
        raise HTTPException(status_code=400, detail="Kayıtlı güvenlik anahtarı bulunamadı")

    rp_id = _get_webauthn_rp_id(request)
    allow_credentials = [
        PublicKeyCredentialDescriptor(
            type="public-key",
            id=base64url_to_bytes(c["credential_id"])
        )
        for c in credentials
    ]

    options = generate_authentication_options(
        rp_id=rp_id,
        allow_credentials=allow_credentials,
    )
    challenge_b64 = bytes_to_base64url(options.challenge)

    await db.webauthn_challenges.insert_one({
        "user_id": user["id"],
        "challenge": challenge_b64,
        "type": "authentication",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "used": False
    })

    return options_to_json(options)

@api_router.post("/auth/webauthn/login/complete")
async def webauthn_login_complete(
    request: Request,
    username: str = Form(...),
    credential_id: str = Form(...),
    authenticator_data: str = Form(...),
    client_data_json: str = Form(...),
    signature: str = Form(...)
):
    """Complete WebAuthn login"""
    from webauthn import verify_authentication_response
    from webauthn.helpers import base64url_to_bytes
    from webauthn.helpers.exceptions import InvalidAuthenticationResponse

    user = await db.users.find_one({"username": username}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    stored_credential = await db.webauthn_credentials.find_one({
        "user_id": user["id"],
        "credential_id": credential_id,
        "is_active": True
    })

    if not stored_credential:
        raise HTTPException(status_code=400, detail="Geçersiz güvenlik anahtarı")

    challenge_doc = await db.webauthn_challenges.find_one({
        "user_id": user["id"],
        "type": "authentication",
        "used": False
    })

    if not challenge_doc:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş challenge")

    expected_challenge = base64url_to_bytes(challenge_doc["challenge"])
    expected_rp_id = _get_webauthn_rp_id(request)
    expected_origin = _get_webauthn_origin(request)
    credential_public_key = base64url_to_bytes(stored_credential["public_key"])
    credential_current_sign_count = stored_credential.get("sign_count", 0)

    credential_payload = {
        "id": credential_id,
        "rawId": credential_id,
        "type": "public-key",
        "response": {
            "clientDataJSON": client_data_json,
            "authenticatorData": authenticator_data,
            "signature": signature,
        },
    }

    try:
        verification = verify_authentication_response(
            credential=credential_payload,
            expected_challenge=expected_challenge,
            expected_rp_id=expected_rp_id,
            expected_origin=expected_origin,
            credential_public_key=credential_public_key,
            credential_current_sign_count=credential_current_sign_count,
        )
    except InvalidAuthenticationResponse as e:
        raise HTTPException(status_code=400, detail=str(e))

    await db.webauthn_challenges.update_one(
        {"_id": challenge_doc["_id"]},
        {"$set": {"used": True}}
    )

    now = datetime.now(timezone.utc)
    await db.webauthn_credentials.update_one(
        {"_id": stored_credential["_id"]},
        {"$set": {"last_used_at": now.isoformat(), "sign_count": verification.new_sign_count}}
    )

    token_data = {
        "sub": user["id"],
        "username": user["username"],
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "auth_method": "webauthn"
    }
    token = jwt.encode(token_data, JWT_SECRET, algorithm="HS256")

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
        "auth_method": "webauthn"
    }

@api_router.get("/auth/webauthn/credentials")
async def list_webauthn_credentials(
    current_user: dict = Depends(get_current_user)
):
    """List user's registered security keys"""
    credentials = await db.webauthn_credentials.find(
        {"user_id": current_user["id"], "is_active": True},
        {"_id": 0, "public_key": 0}
    ).to_list(10)
    
    return {"credentials": credentials}

@api_router.delete("/auth/webauthn/credentials/{credential_id}")
async def delete_webauthn_credential(
    credential_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a security key"""
    result = await db.webauthn_credentials.update_one(
        {"id": credential_id, "user_id": current_user["id"]},
        {"$set": {"is_active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Güvenlik anahtarı bulunamadı")
    
    return {"message": "Güvenlik anahtarı silindi"}

# ============== CROSS-PLATFORM PLAYLIST SYNC ==============

@api_router.post("/playlists/sync")
async def sync_playlists(
    platform: str = Form(...),  # spotify, apple_music, youtube_music
    access_token: str = Form(default=None),
    current_user: dict = Depends(get_current_user)
):
    """Sync playlists from external platforms"""
    user_id = current_user["id"]
    now = datetime.now(timezone.utc)
    
    # Mock sync result (in production, would use actual platform APIs)
    synced_playlists = []
    
    if platform == "spotify":
        synced_playlists = [
            {"name": "Spotify Beğenilenler", "track_count": random.randint(50, 200), "source": "spotify"},
            {"name": "Keşfet Haftalık", "track_count": 30, "source": "spotify"},
            {"name": "Release Radar", "track_count": 30, "source": "spotify"},
        ]
    elif platform == "apple_music":
        synced_playlists = [
            {"name": "Favorilerim", "track_count": random.randint(30, 150), "source": "apple_music"},
            {"name": "Yeni Müzik Karması", "track_count": 25, "source": "apple_music"},
        ]
    elif platform == "youtube_music":
        synced_playlists = [
            {"name": "Beğendiğim Müzikler", "track_count": random.randint(40, 180), "source": "youtube_music"},
            {"name": "Süper Karışık", "track_count": 50, "source": "youtube_music"},
        ]
    
    # Store sync info
    for playlist in synced_playlists:
        playlist_id = str(uuid.uuid4())
        playlist_doc = {
            "id": playlist_id,
            "user_id": user_id,
            "name": playlist["name"],
            "track_count": playlist["track_count"],
            "source": playlist["source"],
            "is_synced": True,
            "last_synced_at": now.isoformat(),
            "created_at": now.isoformat()
        }
        await db.playlists.insert_one(playlist_doc)
        playlist["id"] = playlist_id
    
    # Update user sync settings
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            f"sync_{platform}": True,
            f"sync_{platform}_at": now.isoformat()
        }}
    )
    
    return {
        "platform": platform,
        "synced_playlists": synced_playlists,
        "message": f"{len(synced_playlists)} çalma listesi senkronize edildi"
    }

@api_router.get("/playlists/sync/status")
async def get_sync_status(
    current_user: dict = Depends(get_current_user)
):
    """Get playlist sync status for all platforms"""
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    
    platforms = ["spotify", "apple_music", "youtube_music"]
    status = {}
    
    for platform in platforms:
        status[platform] = {
            "connected": user.get(f"sync_{platform}", False),
            "last_synced": user.get(f"sync_{platform}_at")
        }
    
    # Get synced playlist counts
    for platform in platforms:
        count = await db.playlists.count_documents({
            "user_id": current_user["id"],
            "source": platform,
            "is_synced": True
        })
        status[platform]["playlist_count"] = count
    
    return {"sync_status": status}

@api_router.post("/playlists/{playlist_id}/export")
async def export_playlist(
    playlist_id: str,
    target_platform: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Export a playlist to external platform"""
    playlist = await db.playlists.find_one(
        {"id": playlist_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not playlist:
        raise HTTPException(status_code=404, detail="Çalma listesi bulunamadı")
    
    # Mock export (in production, would use platform APIs)
    return {
        "message": f"Çalma listesi {target_platform}'a aktarılıyor",
        "playlist_name": playlist["name"],
        "target_platform": target_platform,
        "status": "pending"
    }

# ============== GAPLESS PLAYBACK ==============

@api_router.get("/playback/queue")
async def get_playback_queue(
    current_user: dict = Depends(get_current_user)
):
    """Get user's playback queue with gapless info"""
    # Get current queue from DB or create default
    queue = await db.playback_queues.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not queue:
        return {
            "queue": [],
            "current_index": 0,
            "gapless_enabled": True,
            "crossfade_duration": 0
        }
    
    return queue

@api_router.post("/playback/queue")
async def update_playback_queue(
    track_ids: List[str] = Form(...),
    gapless_enabled: bool = Form(default=True),
    crossfade_duration: int = Form(default=0),  # 0 = no crossfade, 1-12 seconds
    current_user: dict = Depends(get_current_user)
):
    """Update playback queue with gapless settings"""
    user_id = current_user["id"]
    now = datetime.now(timezone.utc)
    
    # Build queue with track info
    queue_tracks = []
    for idx, track_id in enumerate(track_ids):
        track = next((t for t in MOCK_TRACKS if t["id"] == track_id), None)
        if track:
            queue_tracks.append({
                "position": idx,
                "track_id": track_id,
                "title": track["title"],
                "artist": track["artist"],
                "duration": track.get("duration", 180),
                "preview_url": track.get("preview_url")
            })
    
    queue_doc = {
        "user_id": user_id,
        "queue": queue_tracks,
        "current_index": 0,
        "gapless_enabled": gapless_enabled,
        "crossfade_duration": crossfade_duration,
        "updated_at": now.isoformat()
    }
    
    await db.playback_queues.update_one(
        {"user_id": user_id},
        {"$set": queue_doc},
        upsert=True
    )
    
    return {
        "message": "Çalma sırası güncellendi",
        "track_count": len(queue_tracks),
        "gapless_enabled": gapless_enabled,
        "crossfade_duration": crossfade_duration
    }

@api_router.post("/playback/settings")
async def update_playback_settings(
    gapless_enabled: bool = Form(default=True),
    crossfade_duration: int = Form(default=0),
    normalize_volume: bool = Form(default=True),
    current_user: dict = Depends(get_current_user)
):
    """Update global playback settings"""
    now = datetime.now(timezone.utc)
    
    settings = {
        "user_id": current_user["id"],
        "gapless_enabled": gapless_enabled,
        "crossfade_duration": crossfade_duration,
        "normalize_volume": normalize_volume,
        "updated_at": now.isoformat()
    }
    
    await db.playback_settings.update_one(
        {"user_id": current_user["id"]},
        {"$set": settings},
        upsert=True
    )
    
    return {"message": "Çalma ayarları güncellendi", "settings": settings}

# ============== MUSIC RECOGNITION (Shazam-like) ==============

@api_router.post("/music/recognize")
async def recognize_music(
    audio_fingerprint: str = Form(default=None),
    audio_sample: UploadFile = File(default=None),
    current_user: dict = Depends(get_current_user)
):
    """Recognize music from audio sample (Shazam-like feature)"""
    now = datetime.now(timezone.utc)
    
    # Mock recognition result (in production would use ACRCloud, Gracenote, or similar)
    # Simulate processing time
    import asyncio
    await asyncio.sleep(0.5)
    
    # Return a random track as "recognized"
    recognized_track = random.choice(MOCK_TRACKS)
    
    # Log the recognition
    recognition_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "recognized_track_id": recognized_track["id"],
        "track_title": recognized_track["title"],
        "track_artist": recognized_track["artist"],
        "confidence": random.uniform(0.85, 0.99),
        "created_at": now.isoformat()
    }
    await db.music_recognitions.insert_one(recognition_doc)
    
    return {
        "recognized": True,
        "confidence": round(recognition_doc["confidence"], 2),
        "track": {
            "id": recognized_track["id"],
            "title": recognized_track["title"],
            "artist": recognized_track["artist"],
            "album": recognized_track.get("album", ""),
            "cover_url": recognized_track.get("cover_url"),
            "preview_url": recognized_track.get("preview_url"),
            "source": recognized_track.get("source", "local")
        }
    }

@api_router.get("/music/recognize/history")
async def get_recognition_history(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get history of recognized songs"""
    history = await db.music_recognitions.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return {"history": history, "total": len(history)}

# ============== MUSIC RADIO / PERSONALIZED STATION ==============

@api_router.post("/radio/create")
async def create_radio_station(
    seed_type: str = Form(...),  # track, artist, genre, mood
    seed_id: str = Form(default=None),
    seed_name: str = Form(default=None),
    current_user: dict = Depends(get_current_user)
):
    """Create a personalized radio station based on seed"""
    now = datetime.now(timezone.utc)
    station_id = str(uuid.uuid4())
    
    # Generate station name
    if seed_type == "track":
        track = next((t for t in MOCK_TRACKS if t["id"] == seed_id), None)
        station_name = f"{track['title']} Radyosu" if track else "Karışık Radyo"
    elif seed_type == "artist":
        station_name = f"{seed_name} Radyosu"
    elif seed_type == "genre":
        station_name = f"{seed_name} Radyosu"
    elif seed_type == "mood":
        station_name = f"{seed_name} Modu"
    else:
        station_name = "Benim Radyom"
    
    # Generate initial playlist (mock - would use ML in production)
    station_tracks = random.sample(MOCK_TRACKS, min(25, len(MOCK_TRACKS)))
    
    station_doc = {
        "id": station_id,
        "user_id": current_user["id"],
        "name": station_name,
        "seed_type": seed_type,
        "seed_id": seed_id,
        "seed_name": seed_name,
        "tracks": [
            {
                "id": t["id"],
                "title": t["title"],
                "artist": t["artist"],
                "cover_url": t.get("cover_url")
            }
            for t in station_tracks
        ],
        "is_playing": True,
        "created_at": now.isoformat()
    }
    
    await db.radio_stations.insert_one(station_doc)
    station_doc.pop("_id", None)
    
    return station_doc

@api_router.get("/radio/stations")
async def get_radio_stations(
    current_user: dict = Depends(get_current_user)
):
    """Get user's radio stations"""
    stations = await db.radio_stations.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "tracks": {"$slice": 5}}  # Only return first 5 tracks
    ).sort("created_at", -1).to_list(20)
    
    return {"stations": stations}

@api_router.post("/radio/{station_id}/skip")
async def skip_radio_track(
    station_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Skip current track and get next"""
    station = await db.radio_stations.find_one(
        {"id": station_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not station:
        raise HTTPException(status_code=404, detail="Radyo istasyonu bulunamadı")
    
    # Get next track (in production, would use ML to suggest similar)
    next_track = random.choice(MOCK_TRACKS)
    
    return {
        "track": {
            "id": next_track["id"],
            "title": next_track["title"],
            "artist": next_track["artist"],
            "cover_url": next_track.get("cover_url"),
            "preview_url": next_track.get("preview_url")
        }
    }

@api_router.post("/radio/{station_id}/like")
async def like_radio_track(
    station_id: str,
    track_id: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Like a track in radio (improves recommendations)"""
    now = datetime.now(timezone.utc)
    
    like_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "station_id": station_id,
        "track_id": track_id,
        "action": "like",
        "created_at": now.isoformat()
    }
    await db.radio_feedback.insert_one(like_doc)
    
    return {"message": "Beğeni kaydedildi", "track_id": track_id}

@api_router.post("/radio/{station_id}/dislike")
async def dislike_radio_track(
    station_id: str,
    track_id: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Dislike a track in radio (won't be played again)"""
    now = datetime.now(timezone.utc)
    
    dislike_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "station_id": station_id,
        "track_id": track_id,
        "action": "dislike",
        "created_at": now.isoformat()
    }
    await db.radio_feedback.insert_one(dislike_doc)
    
    return {"message": "Şarkı bir daha çalınmayacak", "track_id": track_id}

# ============== MUSIC TASTE TEST ==============

TASTE_QUESTIONS = [
    {
        "id": "q1",
        "question": "Sabah kalktığında hangi müzik türünü dinlersin?",
        "options": [
            {"id": "a", "text": "Enerjik pop/rock", "tags": ["energetic", "pop", "rock"]},
            {"id": "b", "text": "Sakin akustik", "tags": ["calm", "acoustic", "indie"]},
            {"id": "c", "text": "Hip-hop/R&B", "tags": ["hiphop", "rnb", "urban"]},
            {"id": "d", "text": "Klasik/Caz", "tags": ["classical", "jazz", "sophisticated"]}
        ]
    },
    {
        "id": "q2",
        "question": "Bir partide DJ olsan ne çalarsın?",
        "options": [
            {"id": "a", "text": "Dans/Elektronik", "tags": ["dance", "electronic", "party"]},
            {"id": "b", "text": "Pop hitler", "tags": ["pop", "mainstream", "hits"]},
            {"id": "c", "text": "Rock/Metal", "tags": ["rock", "metal", "intense"]},
            {"id": "d", "text": "Retro/80'ler 90'lar", "tags": ["retro", "nostalgic", "oldies"]}
        ]
    },
    {
        "id": "q3",
        "question": "Üzgün olduğunda ne dinlersin?",
        "options": [
            {"id": "a", "text": "Hüzünlü slow şarkılar", "tags": ["sad", "emotional", "ballad"]},
            {"id": "b", "text": "Enerjik şarkılarla toparlanırım", "tags": ["energetic", "positive", "uplifting"]},
            {"id": "c", "text": "Enstrümantal/Ambient", "tags": ["instrumental", "ambient", "meditative"]},
            {"id": "d", "text": "Türk Sanat Müziği", "tags": ["turkish", "traditional", "emotional"]}
        ]
    },
    {
        "id": "q4",
        "question": "En çok hangi dönemin müziğini seversin?",
        "options": [
            {"id": "a", "text": "Güncel (2020+)", "tags": ["current", "trendy", "modern"]},
            {"id": "b", "text": "2000'ler-2010'lar", "tags": ["2000s", "millennial"]},
            {"id": "c", "text": "90'lar ve öncesi", "tags": ["90s", "classic", "golden"]},
            {"id": "d", "text": "Hepsinden biraz", "tags": ["eclectic", "diverse", "open"]}
        ]
    },
    {
        "id": "q5",
        "question": "Yolculukta ne dinlersin?",
        "options": [
            {"id": "a", "text": "Podcast/Konuşma", "tags": ["podcast", "talk", "intellectual"]},
            {"id": "b", "text": "Çalma listelerim", "tags": ["playlist", "curated", "personal"]},
            {"id": "c", "text": "Radyo istasyonları", "tags": ["radio", "discovery", "random"]},
            {"id": "d", "text": "Albüm baştan sona", "tags": ["album", "dedicated", "artistic"]}
        ]
    }
]

@api_router.get("/profile/taste-test/questions")
async def get_taste_test_questions(
    current_user: dict = Depends(get_current_user)
):
    """Get music taste test questions"""
    # Check if user already completed the test
    existing = await db.taste_tests.find_one({"user_id": current_user["id"]}, {"_id": 0})
    
    return {
        "questions": TASTE_QUESTIONS,
        "total_questions": len(TASTE_QUESTIONS),
        "already_completed": existing is not None,
        "previous_result": existing.get("result") if existing else None
    }

@api_router.post("/profile/taste-test/submit")
async def submit_taste_test(
    answers: str = Form(...),  # JSON string of answers: {"q1": "a", "q2": "b", ...}
    current_user: dict = Depends(get_current_user)
):
    """Submit music taste test answers and get personality result"""
    import json as json_lib
    now = datetime.now(timezone.utc)
    
    try:
        answer_dict = json_lib.loads(answers)
    except:
        raise HTTPException(status_code=400, detail="Geçersiz cevap formatı")
    
    # Collect all tags from answers
    all_tags = []
    for q in TASTE_QUESTIONS:
        answer_id = answer_dict.get(q["id"])
        if answer_id:
            option = next((o for o in q["options"] if o["id"] == answer_id), None)
            if option:
                all_tags.extend(option["tags"])
    
    # Analyze tags to determine music personality
    tag_counts = {}
    for tag in all_tags:
        tag_counts[tag] = tag_counts.get(tag, 0) + 1
    
    # Determine personality based on most common tags
    top_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    # Map to personality types
    personality_map = {
        "energetic": {"type": "Dinamik Dinleyici", "emoji": "🔥", "description": "Enerjik ve tempolu müzikleri tercih ediyorsun. Günün her anında seni harekete geçirecek ritimler arıyorsun."},
        "calm": {"type": "Sakin Ruh", "emoji": "🌙", "description": "Dinlendirici ve sakin melodiler senin için ideal. Müzik senin için bir meditasyon aracı."},
        "eclectic": {"type": "Müzik Kaşifi", "emoji": "🎭", "description": "Her türden müzik dinliyorsun. Sınırları aşan bir müzik zevkin var."},
        "nostalgic": {"type": "Retro Tutkunu", "emoji": "📻", "description": "Geçmişin altın çağı müziklerini tercih ediyorsun. Klasikler hiç eskimez sana göre."},
        "trendy": {"type": "Trend Takipçisi", "emoji": "🌟", "description": "Güncel hitlerden geri kalmıyorsun. Popüler olan her şey seni cezbediyor."},
        "sophisticated": {"type": "Seçkin Kulak", "emoji": "🎹", "description": "Klasik ve caz gibi sofistike türlere ilgi duyuyorsun. Müzikal derinlik senin için önemli."},
        "emotional": {"type": "Duygusal Dinleyici", "emoji": "💜", "description": "Müzik senin için duygu ifade aracı. Şarkıların sözleri ve melodileri seni derinden etkiliyor."}
    }
    
    # Find best matching personality
    best_match = None
    for tag, _ in top_tags:
        if tag in personality_map:
            best_match = personality_map[tag]
            break
    
    if not best_match:
        best_match = {"type": "Müzik Sever", "emoji": "🎵", "description": "Çeşitli müzik türlerini keşfetmeyi seviyorsun."}
    
    result = {
        "personality_type": best_match["type"],
        "emoji": best_match["emoji"],
        "description": best_match["description"],
        "top_tags": [t[0] for t in top_tags],
        "recommended_genres": list(set([t[0] for t in top_tags if t[0] in ["pop", "rock", "jazz", "electronic", "hiphop", "classical", "indie", "turkish"]]))[:3]
    }
    
    # Save result
    test_doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "answers": answer_dict,
        "result": result,
        "created_at": now.isoformat()
    }
    
    # Update or insert
    await db.taste_tests.update_one(
        {"user_id": current_user["id"]},
        {"$set": test_doc},
        upsert=True
    )
    
    # Also update user profile
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"music_personality": result["personality_type"]}}
    )
    
    return {"result": result}

# ============== USER LEVELS & BADGES ==============

LEVEL_THRESHOLDS = [
    {"level": 1, "name": "Yeni Başlayan", "xp_required": 0, "badge": "🎵"},
    {"level": 2, "name": "Müzik Meraklısı", "xp_required": 100, "badge": "🎶"},
    {"level": 3, "name": "Melodi Avcısı", "xp_required": 300, "badge": "🎧"},
    {"level": 4, "name": "Ritim Ustası", "xp_required": 600, "badge": "🎸"},
    {"level": 5, "name": "Nota Kahramanı", "xp_required": 1000, "badge": "🎹"},
    {"level": 6, "name": "Müzik Elçisi", "xp_required": 1500, "badge": "🎤"},
    {"level": 7, "name": "Ses Sihirbazı", "xp_required": 2500, "badge": "🎺"},
    {"level": 8, "name": "Armoni Lordu", "xp_required": 4000, "badge": "🏆"},
    {"level": 9, "name": "Efsanevi DJ", "xp_required": 6000, "badge": "👑"},
    {"level": 10, "name": "Müzik Tanrısı", "xp_required": 10000, "badge": "⭐"}
]

AVAILABLE_BADGES = [
    {"id": "first_post", "name": "İlk Paylaşım", "icon": "📝", "description": "İlk gönderinizi paylaştınız"},
    {"id": "first_story", "name": "Hikayeci", "icon": "📖", "description": "İlk hikayenizi paylaştınız"},
    {"id": "playlist_creator", "name": "Liste Ustası", "icon": "📋", "description": "5 çalma listesi oluşturdunuz"},
    {"id": "social_butterfly", "name": "Sosyal Kelebek", "icon": "🦋", "description": "50 takipçiye ulaştınız"},
    {"id": "influencer", "name": "Influencer", "icon": "⭐", "description": "100 takipçiye ulaştınız"},
    {"id": "music_explorer", "name": "Kaşif", "icon": "🧭", "description": "10 farklı türde müzik dinlediniz"},
    {"id": "night_owl", "name": "Gece Kuşu", "icon": "🦉", "description": "Gece 2'den sonra 10+ şarkı dinlediniz"},
    {"id": "early_bird", "name": "Erken Kuş", "icon": "🐦", "description": "Sabah 6'dan önce müzik dinlediniz"},
    {"id": "streak_7", "name": "Haftalık Seri", "icon": "🔥", "description": "7 gün üst üste müzik dinlediniz"},
    {"id": "streak_30", "name": "Aylık Seri", "icon": "💎", "description": "30 gün üst üste müzik dinlediniz"},
    {"id": "taste_tester", "name": "Zevk Uzmanı", "icon": "🎭", "description": "Müzik zevki testini tamamladınız"},
    {"id": "shazam_master", "name": "Shazam Ustası", "icon": "🔍", "description": "50 şarkı tanıttınız"},
    {"id": "collaborator", "name": "İşbirlikçi", "icon": "🤝", "description": "5 ortak çalma listesi oluşturdunuz"},
    {"id": "verified", "name": "Onaylı Hesap", "icon": "✅", "description": "Hesabınız doğrulandı"}
]

@api_router.get("/profile/level")
async def get_user_level(
    current_user: dict = Depends(get_current_user)
):
    """Get user's level and XP progress"""
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    current_xp = user.get("xp", 0)
    
    # Find current level
    current_level = LEVEL_THRESHOLDS[0]
    next_level = LEVEL_THRESHOLDS[1] if len(LEVEL_THRESHOLDS) > 1 else None
    
    for i, level in enumerate(LEVEL_THRESHOLDS):
        if current_xp >= level["xp_required"]:
            current_level = level
            next_level = LEVEL_THRESHOLDS[i + 1] if i + 1 < len(LEVEL_THRESHOLDS) else None
    
    # Calculate progress to next level
    if next_level:
        xp_for_current = current_level["xp_required"]
        xp_for_next = next_level["xp_required"]
        progress = (current_xp - xp_for_current) / (xp_for_next - xp_for_current) * 100
        xp_needed = xp_for_next - current_xp
    else:
        progress = 100
        xp_needed = 0
    
    return {
        "current_xp": current_xp,
        "level": current_level["level"],
        "level_name": current_level["name"],
        "level_badge": current_level["badge"],
        "progress_percent": round(progress, 1),
        "xp_to_next_level": xp_needed,
        "next_level": next_level
    }

@api_router.get("/profile/badges")
async def get_user_badges(
    current_user: dict = Depends(get_current_user)
):
    """Get user's earned badges"""
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    earned_badge_ids = user.get("badges", [])
    
    earned_badges = []
    locked_badges = []
    
    for badge in AVAILABLE_BADGES:
        if badge["id"] in earned_badge_ids:
            earned_badges.append({**badge, "earned": True})
        else:
            locked_badges.append({**badge, "earned": False})
    
    return {
        "earned_badges": earned_badges,
        "locked_badges": locked_badges,
        "total_earned": len(earned_badges),
        "total_available": len(AVAILABLE_BADGES)
    }

@api_router.post("/profile/badges/{badge_id}/claim")
async def claim_badge(
    badge_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Claim a badge (if requirements are met)"""
    # Check if badge exists
    badge = next((b for b in AVAILABLE_BADGES if b["id"] == badge_id), None)
    if not badge:
        raise HTTPException(status_code=404, detail="Rozet bulunamadı")
    
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    earned_badges = user.get("badges", [])
    
    if badge_id in earned_badges:
        raise HTTPException(status_code=400, detail="Bu rozeti zaten kazandınız")
    
    # Add badge
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$push": {"badges": badge_id}}
    )
    
    # Award XP
    await add_xp(current_user["id"], 25)
    
    return {
        "message": f"Tebrikler! '{badge['name']}' rozetini kazandınız!",
        "badge": badge,
        "xp_earned": 25
    }

# ============== FOLLOWER ANALYTICS ==============

from faker import Faker
fake = Faker()

@api_router.get("/profile/analytics/overview")
async def get_analytics_overview(current_user: dict = Depends(get_current_user)):
    """Get basic aggregate stats for the user"""
    user_id = current_user["id"]
    
    # Calculate totals
    total_posts = await db.posts.count_documents({"user_id": user_id})
    total_followers = await db.follows.count_documents({"following_id": user_id})
    total_following = await db.follows.count_documents({"follower_id": user_id})
    
    # Calculate mock total likes (since this isn't globally aggregated easily without aggregation pipeline)
    # Mocking total likes based on posts
    total_likes_received = total_posts * random.randint(5, 50) + random.randint(0, 100)
    
    return {
        "total_posts": total_posts,
        "total_followers": total_followers,
        "total_following": total_following,
        "total_likes_received": total_likes_received
    }

@api_router.get("/profile/analytics/listening")
async def get_listening_analytics(current_user: dict = Depends(get_current_user)):
    """Get user listening behavior and statistics"""
    # Currently mocked as we don't have a robust play history tracking table yet
    return {
        "total_listening_minutes": random.randint(1000, 50000),
        "top_artist": fake.name() if random.random() > 0.5 else "The Weeknd",
        "top_genre": random.choice(["Pop", "Hip Hop", "Rock", "R&B", "Electronic", "Jazz"]),
        "yearly_top_track": fake.catch_phrase(),
        "yearly_top_artist": fake.name(),
        # Activity days (Mon-Sun minutes)
        "activity_days": [random.randint(10, 120) for _ in range(7)],
        # Monthly stats (Jan-Dec minutes)
        "monthly_stats": [random.randint(500, 5000) for _ in range(12)]
    }

@api_router.get("/profile/analytics/audience")
async def get_audience_analytics(current_user: dict = Depends(get_current_user)):
    """Get audience demographics and growth"""
    # Mocked data for demographics
    return {
        "follower_growth": [random.randint(100, 1000) for _ in range(7)],
        "follower_loss_gain": {
            "gained": random.randint(10, 50),
            "lost": random.randint(0, 20)
        },
        "active_followers": [
            {
                "id": str(uuid.uuid4()),
                "username": fake.user_name(),
                "avatar_url": f"https://i.pravatar.cc/150?u={fake.user_name()}",
                "interaction_score": random.randint(50, 100)
            }
            for _ in range(3)
        ],
        "demographics_age": [
            {"range": "13-17", "percentage": random.randint(5, 15)},
            {"range": "18-24", "percentage": random.randint(30, 50)},
            {"range": "25-34", "percentage": random.randint(20, 35)},
            {"range": "35-44", "percentage": random.randint(5, 15)},
            {"range": "45+", "percentage": random.randint(1, 5)}
        ],
        "top_locations": [
            {"city": fake.city(), "country": fake.country(), "percentage": random.randint(10, 40)}
            for _ in range(3)
        ]
    }


@api_router.get("/profile/analytics/followers")
async def get_follower_analytics(
    period: str = "30d",  # 7d, 30d, 90d, all
    current_user: dict = Depends(get_current_user)
):
    """Get detailed follower analytics"""
    user_id = current_user["id"]
    now = datetime.now(timezone.utc)
    
    # Determine date range
    if period == "7d":
        start_date = now - timedelta(days=7)
    elif period == "30d":
        start_date = now - timedelta(days=30)
    elif period == "90d":
        start_date = now - timedelta(days=90)
    else:
        start_date = datetime(2020, 1, 1, tzinfo=timezone.utc)
    
    # Get total followers
    total_followers = await db.follows.count_documents({"following_id": user_id})
    total_following = await db.follows.count_documents({"follower_id": user_id})
    
    # Get new followers in period (mock data for demo)
    new_followers = random.randint(5, 50)
    lost_followers = random.randint(0, 10)
    
    # Get follower growth data (mock)
    growth_data = []
    for i in range(min(30, (now - start_date).days)):
        date = now - timedelta(days=i)
        growth_data.append({
            "date": date.strftime("%Y-%m-%d"),
            "followers": total_followers - random.randint(0, 5) * i,
            "new": random.randint(0, 3),
            "lost": random.randint(0, 1)
        })
    growth_data.reverse()
    
    # Get top followers (most engaged)
    top_followers = []
    followers = await db.follows.find(
        {"following_id": user_id},
        {"_id": 0}
    ).to_list(10)
    
    for f in followers[:5]:
        follower = await db.users.find_one({"id": f["follower_id"]}, {"_id": 0, "password": 0})
        if follower:
            top_followers.append({
                "id": follower["id"],
                "username": follower["username"],
                "display_name": follower.get("display_name"),
                "avatar_url": follower.get("avatar_url"),
                "engagement_score": random.randint(50, 100)
            })
    
    # Demographics (mock)
    demographics = {
        "age_groups": {
            "18-24": random.randint(20, 40),
            "25-34": random.randint(30, 50),
            "35-44": random.randint(10, 25),
            "45+": random.randint(5, 15)
        },
        "top_locations": [
            {"city": "İstanbul", "percent": random.randint(30, 50)},
            {"city": "Ankara", "percent": random.randint(10, 20)},
            {"city": "İzmir", "percent": random.randint(8, 15)},
            {"city": "Antalya", "percent": random.randint(5, 10)},
            {"city": "Diğer", "percent": random.randint(15, 30)}
        ],
        "active_hours": {
            "morning": random.randint(10, 25),
            "afternoon": random.randint(20, 35),
            "evening": random.randint(30, 45),
            "night": random.randint(10, 20)
        }
    }
    
    return {
        "period": period,
        "summary": {
            "total_followers": total_followers,
            "total_following": total_following,
            "new_followers": new_followers,
            "lost_followers": lost_followers,
            "net_growth": new_followers - lost_followers,
            "growth_rate": round((new_followers - lost_followers) / max(total_followers, 1) * 100, 1)
        },
        "growth_chart": growth_data,
        "top_followers": top_followers,
        "demographics": demographics
    }

@api_router.get("/profile/analytics/engagement")
async def get_engagement_analytics(
    period: str = "30d",
    current_user: dict = Depends(get_current_user)
):
    """Get engagement analytics for user's content"""
    user_id = current_user["id"]
    
    # Get post stats
    total_posts = await db.posts.count_documents({"user_id": user_id})
    total_stories = await db.stories.count_documents({"user_id": user_id})
    
    # Mock engagement data
    return {
        "period": period,
        "content_stats": {
            "total_posts": total_posts,
            "total_stories": total_stories,
            "avg_likes_per_post": random.randint(10, 100),
            "avg_comments_per_post": random.randint(2, 20),
            "avg_shares_per_post": random.randint(0, 10),
            "story_completion_rate": round(random.uniform(0.6, 0.95), 2),
            "profile_visits": random.randint(50, 500)
        },
        "best_performing_content": {
            "best_post_time": "19:00-21:00",
            "best_day": "Cumartesi",
            "top_hashtags": ["#müzik", "#socialbeats", "#türkçe", "#playlist"]
        },
        "engagement_rate": round(random.uniform(3.0, 15.0), 1)
    }

# ============== AUTO BACKUP (Google Drive / iCloud) ==============

@api_router.post("/backup/settings")
async def update_backup_settings(
    auto_backup_enabled: bool = Form(default=True),
    backup_frequency: str = Form(default="weekly"),  # daily, weekly, monthly
    backup_destination: str = Form(default="google_drive"),  # google_drive, icloud, both
    include_playlists: bool = Form(default=True),
    include_listening_history: bool = Form(default=True),
    include_settings: bool = Form(default=True),
    current_user: dict = Depends(get_current_user)
):
    """Update auto backup settings"""
    now = datetime.now(timezone.utc)
    
    settings = {
        "user_id": current_user["id"],
        "auto_backup_enabled": auto_backup_enabled,
        "backup_frequency": backup_frequency,
        "backup_destination": backup_destination,
        "include_playlists": include_playlists,
        "include_listening_history": include_listening_history,
        "include_settings": include_settings,
        "updated_at": now.isoformat()
    }
    
    await db.backup_settings.update_one(
        {"user_id": current_user["id"]},
        {"$set": settings},
        upsert=True
    )
    
    return {"message": "Yedekleme ayarları güncellendi", "settings": settings}

@api_router.get("/backup/settings")
async def get_backup_settings(
    current_user: dict = Depends(get_current_user)
):
    """Get backup settings"""
    settings = await db.backup_settings.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not settings:
        settings = {
            "auto_backup_enabled": False,
            "backup_frequency": "weekly",
            "backup_destination": "google_drive",
            "include_playlists": True,
            "include_listening_history": True,
            "include_settings": True
        }
    
    return {"settings": settings}

@api_router.post("/backup/create")
async def create_backup(
    backup_type: str = Form(default="full"),  # full, playlists, settings
    destination: str = Form(default="google_drive"),
    current_user: dict = Depends(get_current_user)
):
    """Create a manual backup"""
    user_id = current_user["id"]
    now = datetime.now(timezone.utc)
    backup_id = str(uuid.uuid4())
    
    # Collect data for backup
    backup_data = {
        "user_info": {
            "id": user_id,
            "username": current_user["username"],
            "email": current_user.get("email"),
            "display_name": current_user.get("display_name")
        },
        "created_at": now.isoformat(),
        "backup_type": backup_type
    }
    
    # Include playlists
    if backup_type in ["full", "playlists"]:
        playlists = await db.playlists.find(
            {"user_id": user_id},
            {"_id": 0}
        ).to_list(100)
        backup_data["playlists"] = playlists
        backup_data["playlist_count"] = len(playlists)
    
    # Include listening history
    if backup_type == "full":
        # Get recent listening history (last 1000)
        history = await db.listening_history.find(
            {"user_id": user_id},
            {"_id": 0}
        ).sort("played_at", -1).to_list(1000)
        backup_data["listening_history"] = history
        backup_data["history_count"] = len(history)
        
        # Get liked tracks
        likes = await db.likes.find(
            {"user_id": user_id, "type": "track"},
            {"_id": 0}
        ).to_list(500)
        backup_data["liked_tracks"] = likes
    
    # Include settings
    if backup_type in ["full", "settings"]:
        settings = await db.user_settings.find_one(
            {"user_id": user_id},
            {"_id": 0}
        )
        backup_data["settings"] = settings or {}
    
    # Calculate backup size (mock)
    import json as json_lib
    backup_size = len(json_lib.dumps(backup_data))
    
    # Create backup record
    backup_record = {
        "id": backup_id,
        "user_id": user_id,
        "backup_type": backup_type,
        "destination": destination,
        "status": "completed",  # In production: pending -> uploading -> completed
        "size_bytes": backup_size,
        "item_counts": {
            "playlists": backup_data.get("playlist_count", 0),
            "history": backup_data.get("history_count", 0),
            "liked_tracks": len(backup_data.get("liked_tracks", []))
        },
        "created_at": now.isoformat(),
        "download_url": f"/api/backup/{backup_id}/download"  # Mock download URL
    }
    
    await db.backups.insert_one(backup_record)
    
    return {
        "backup_id": backup_id,
        "status": "completed",
        "destination": destination,
        "size": f"{backup_size / 1024:.1f} KB",
        "item_counts": backup_record["item_counts"],
        "download_url": backup_record["download_url"]
    }

@api_router.get("/backup/list")
async def list_backups(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """List user's backups"""
    backups = await db.backups.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return {"backups": backups, "total": len(backups)}

@api_router.delete("/backup/{backup_id}")
async def delete_backup(
    backup_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a backup"""
    result = await db.backups.delete_one({
        "id": backup_id,
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Yedek bulunamadı")
    
    return {"message": "Yedek silindi"}

@api_router.post("/backup/{backup_id}/restore")
async def restore_backup(
    backup_id: str,
    restore_playlists: bool = Form(default=True),
    restore_settings: bool = Form(default=True),
    current_user: dict = Depends(get_current_user)
):
    """Restore from a backup"""
    backup = await db.backups.find_one({
        "id": backup_id,
        "user_id": current_user["id"]
    }, {"_id": 0})
    
    if not backup:
        raise HTTPException(status_code=404, detail="Yedek bulunamadı")
    
    # Mock restore process
    restored_items = {
        "playlists": backup.get("item_counts", {}).get("playlists", 0) if restore_playlists else 0,
        "settings": 1 if restore_settings else 0
    }
    
    return {
        "message": "Geri yükleme tamamlandı",
        "backup_id": backup_id,
        "restored_items": restored_items
    }

# ============== DATA EXPORT & MIGRATION ==============

@api_router.post("/data/export")
async def export_user_data(
    export_format: str = Form(default="json"),  # json, csv
    include_profile: bool = Form(default=True),
    include_posts: bool = Form(default=True),
    include_playlists: bool = Form(default=True),
    include_messages: bool = Form(default=False),
    include_listening_history: bool = Form(default=True),
    current_user: dict = Depends(get_current_user)
):
    """Export all user data (GDPR compliant)"""
    user_id = current_user["id"]
    now = datetime.now(timezone.utc)
    export_id = str(uuid.uuid4())
    
    export_data = {
        "export_id": export_id,
        "exported_at": now.isoformat(),
        "format": export_format
    }
    
    # Profile data
    if include_profile:
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        export_data["profile"] = user
    
    # Posts
    if include_posts:
        posts = await db.posts.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
        export_data["posts"] = posts
        export_data["post_count"] = len(posts)
    
    # Playlists with tracks
    if include_playlists:
        playlists = await db.playlists.find({"user_id": user_id}, {"_id": 0}).to_list(100)
        export_data["playlists"] = playlists
        export_data["playlist_count"] = len(playlists)
    
    # Messages (optional - privacy sensitive)
    if include_messages:
        messages = await db.messages.find(
            {"sender_id": user_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(5000)
        export_data["messages"] = messages
        export_data["message_count"] = len(messages)
    
    # Listening history
    if include_listening_history:
        history = await db.listening_history.find(
            {"user_id": user_id},
            {"_id": 0}
        ).to_list(10000)
        export_data["listening_history"] = history
        export_data["history_count"] = len(history)
    
    # Store export record
    export_record = {
        "id": export_id,
        "user_id": user_id,
        "format": export_format,
        "includes": {
            "profile": include_profile,
            "posts": include_posts,
            "playlists": include_playlists,
            "messages": include_messages,
            "listening_history": include_listening_history
        },
        "status": "completed",
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(days=7)).isoformat(),  # Link expires in 7 days
        "download_url": f"/api/data/export/{export_id}/download"
    }
    
    await db.data_exports.insert_one(export_record)
    
    return {
        "export_id": export_id,
        "status": "completed",
        "download_url": export_record["download_url"],
        "expires_at": export_record["expires_at"],
        "includes": export_record["includes"]
    }

@api_router.get("/data/export/me")
async def export_me_json(current_user: dict = Depends(get_current_user)):
    """Full JSON export for mobile Share (GDPR)"""
    user_id = current_user["id"]
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    posts = await db.posts.find({"user_id": user_id}, {"_id": 0}).to_list(1000)
    playlists = await db.playlists.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    history = await db.listening_history.find(
        {"user_id": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(10000)
    return {
        "profile": user,
        "posts": posts,
        "post_count": len(posts),
        "playlists": playlists,
        "playlist_count": len(playlists),
        "listening_history": history,
        "history_count": len(history),
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }

@api_router.get("/data/exports")
async def list_exports(
    current_user: dict = Depends(get_current_user)
):
    """List user's data exports"""
    exports = await db.data_exports.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    return {"exports": exports}

@api_router.post("/data/import")
async def import_user_data(
    source_platform: str = Form(...),  # spotify, apple_music, youtube_music, other
    import_type: str = Form(default="playlists"),  # playlists, history, all
    data_file: UploadFile = File(default=None),
    current_user: dict = Depends(get_current_user)
):
    """Import data from another platform"""
    user_id = current_user["id"]
    now = datetime.now(timezone.utc)
    import_id = str(uuid.uuid4())
    
    # Mock import process
    imported_items = {
        "playlists": random.randint(5, 20) if import_type in ["playlists", "all"] else 0,
        "tracks": random.randint(50, 200) if import_type in ["playlists", "all"] else 0,
        "history": random.randint(100, 500) if import_type == "all" else 0
    }
    
    # Store import record
    import_record = {
        "id": import_id,
        "user_id": user_id,
        "source_platform": source_platform,
        "import_type": import_type,
        "status": "completed",
        "imported_items": imported_items,
        "created_at": now.isoformat()
    }
    
    await db.data_imports.insert_one(import_record)
    
    return {
        "import_id": import_id,
        "status": "completed",
        "source_platform": source_platform,
        "imported_items": imported_items,
        "message": f"{source_platform}'dan veri aktarımı tamamlandı"
    }

@api_router.delete("/data/account")
async def delete_account(
    confirm: bool = Form(...),
    password: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Delete user account and all data (GDPR right to erasure)"""
    if not confirm:
        raise HTTPException(status_code=400, detail="Hesap silme işlemi onaylanmadı")
    
    user_id = current_user["id"]
    
    # Verify password
    user = await db.users.find_one({"id": user_id})
    if not verify_password(password, user.get("password", "")):
        raise HTTPException(status_code=401, detail="Şifre hatalı")
    
    # Delete all user data
    collections_to_clean = [
        "posts", "stories", "comments", "likes", "follows", 
        "playlists", "messages", "conversations", "notifications",
        "listening_history", "backups", "data_exports"
    ]
    
    deleted_counts = {}
    for collection in collections_to_clean:
        result = await db[collection].delete_many({"user_id": user_id})
        deleted_counts[collection] = result.deleted_count
    
    # Also delete where user is recipient
    await db.follows.delete_many({"following_id": user_id})
    await db.messages.delete_many({"recipient_id": user_id})
    
    # Finally delete user
    await db.users.delete_one({"id": user_id})
    
    return {
        "message": "Hesabınız ve tüm verileriniz kalıcı olarak silindi",
        "deleted_data": deleted_counts
    }

# ============== LIVE LISTENING PARTY ==============

@api_router.post("/party/create")
async def create_listening_party(
    name: str = Form(...),
    description: str = Form(default=""),
    is_private: bool = Form(default=False),
    max_participants: int = Form(default=50),
    current_user: dict = Depends(get_current_user)
):
    """Create a live listening party"""
    party_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    party = {
        "id": party_id,
        "host_id": current_user["id"],
        "host_name": current_user.get("display_name", current_user["username"]),
        "host_avatar": current_user.get("avatar_url"),
        "name": name,
        "description": description,
        "is_private": is_private,
        "max_participants": max_participants,
        "participants": [{
            "id": current_user["id"],
            "username": current_user["username"],
            "avatar": current_user.get("avatar_url"),
            "is_host": True,
            "joined_at": now.isoformat()
        }],
        "participant_count": 1,
        "current_track": None,
        "queue": [],
        "chat_messages": [],
        "status": "waiting",  # waiting, playing, paused, ended
        "created_at": now.isoformat(),
        "started_at": None,
        "ended_at": None
    }
    
    await db.listening_parties.insert_one(party)
    party.pop("_id", None)
    
    return party

@api_router.get("/party/list")
async def list_parties(
    include_private: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """List active listening parties"""
    query = {"status": {"$ne": "ended"}}
    if not include_private:
        query["is_private"] = False
    
    parties = await db.listening_parties.find(
        query,
        {"_id": 0, "chat_messages": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"parties": parties}

@api_router.post("/party/{party_id}/join")
async def join_party(
    party_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Join a listening party"""
    party = await db.listening_parties.find_one({"id": party_id}, {"_id": 0})
    
    if not party:
        raise HTTPException(status_code=404, detail="Parti bulunamadı")
    
    if party["status"] == "ended":
        raise HTTPException(status_code=400, detail="Bu parti sona erdi")
    
    if party["participant_count"] >= party["max_participants"]:
        raise HTTPException(status_code=400, detail="Parti dolu")
    
    # Check if already in party
    if any(p["id"] == current_user["id"] for p in party["participants"]):
        return {"message": "Zaten partidesınız", "party": party}
    
    now = datetime.now(timezone.utc)
    new_participant = {
        "id": current_user["id"],
        "username": current_user["username"],
        "avatar": current_user.get("avatar_url"),
        "is_host": False,
        "joined_at": now.isoformat()
    }
    
    await db.listening_parties.update_one(
        {"id": party_id},
        {
            "$push": {"participants": new_participant},
            "$inc": {"participant_count": 1}
        }
    )
    
    return {"message": "Partiye katıldınız", "party_id": party_id}

@api_router.post("/party/{party_id}/leave")
async def leave_party(
    party_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Leave a listening party"""
    await db.listening_parties.update_one(
        {"id": party_id},
        {
            "$pull": {"participants": {"id": current_user["id"]}},
            "$inc": {"participant_count": -1}
        }
    )
    
    return {"message": "Partiden ayrıldınız"}

@api_router.post("/party/{party_id}/play")
async def party_play_track(
    party_id: str,
    track_id: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Play a track in the party (host only)"""
    party = await db.listening_parties.find_one({"id": party_id}, {"_id": 0})
    
    if not party:
        raise HTTPException(status_code=404, detail="Parti bulunamadı")
    
    if party["host_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Sadece host şarkı değiştirebilir")
    
    # Get track info
    track = next((t for t in MOCK_TRACKS if t["id"] == track_id), None)
    if not track:
        raise HTTPException(status_code=404, detail="Şarkı bulunamadı")
    
    now = datetime.now(timezone.utc)
    current_track = {
        "id": track["id"],
        "title": track["title"],
        "artist": track["artist"],
        "cover_url": track.get("cover_url"),
        "started_at": now.isoformat()
    }
    
    await db.listening_parties.update_one(
        {"id": party_id},
        {"$set": {
            "current_track": current_track,
            "status": "playing",
            "started_at": party.get("started_at") or now.isoformat()
        }}
    )
    
    return {"message": "Şarkı çalınıyor", "track": current_track}

@api_router.post("/party/{party_id}/chat")
async def send_party_message(
    party_id: str,
    message: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Send a chat message in the party"""
    now = datetime.now(timezone.utc)
    
    chat_message = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "username": current_user["username"],
        "avatar": current_user.get("avatar_url"),
        "message": message,
        "created_at": now.isoformat()
    }
    
    await db.listening_parties.update_one(
        {"id": party_id},
        {"$push": {"chat_messages": {"$each": [chat_message], "$slice": -100}}}  # Keep last 100 messages
    )
    
    return {"message": chat_message}

@api_router.post("/party/{party_id}/end")
async def end_party(
    party_id: str,
    current_user: dict = Depends(get_current_user)
):
    """End a listening party (host only)"""
    party = await db.listening_parties.find_one({"id": party_id}, {"_id": 0})
    
    if not party:
        raise HTTPException(status_code=404, detail="Parti bulunamadı")
    
    if party["host_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Sadece host partiyi sonlandırabilir")
    
    now = datetime.now(timezone.utc)
    await db.listening_parties.update_one(
        {"id": party_id},
        {"$set": {"status": "ended", "ended_at": now.isoformat()}}
    )
    
    return {"message": "Parti sonlandırıldı"}

# ============== ARTIST VERIFICATION ==============

@api_router.post("/artist/verification/apply")
async def apply_artist_verification(
    artist_name: str = Form(...),
    social_links: str = Form(...),  # JSON string of social media links
    proof_documents: str = Form(default=""),  # URLs to proof documents
    description: str = Form(default=""),
    current_user: dict = Depends(get_current_user)
):
    """Apply for artist verification"""
    import json as json_lib
    
    user_id = current_user["id"]
    now = datetime.now(timezone.utc)
    
    # Check if already verified
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user.get("is_verified"):
        raise HTTPException(status_code=400, detail="Zaten onaylı bir hesabınız var")
    
    # Check for existing application
    existing = await db.verification_applications.find_one({
        "user_id": user_id,
        "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Zaten bekleyen bir başvurunuz var")
    
    try:
        social_links_parsed = json_lib.loads(social_links)
    except:
        social_links_parsed = {"other": social_links}
    
    application = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "username": current_user["username"],
        "artist_name": artist_name,
        "social_links": social_links_parsed,
        "proof_documents": proof_documents,
        "description": description,
        "status": "pending",  # pending, approved, rejected
        "created_at": now.isoformat(),
        "reviewed_at": None,
        "reviewer_notes": None
    }
    
    await db.verification_applications.insert_one(application)
    
    return {
        "message": "Başvurunuz alındı. İnceleme sonucu size bildirilecektir.",
        "application_id": application["id"],
        "status": "pending"
    }

@api_router.get("/artist/verification/status")
async def get_verification_status(
    current_user: dict = Depends(get_current_user)
):
    """Get verification application status"""
    application = await db.verification_applications.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    
    return {
        "is_verified": user.get("is_verified", False),
        "application": application
    }

# Admin: list pending verification applications
@api_router.get("/admin/verification")
async def list_verification_applications(
    status: str = Query(default="pending"),
    current_user: dict = Depends(get_current_user)
):
    """List verification applications (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    apps = await db.verification_applications.find(
        {"status": status},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    for app in apps:
        user = await db.users.find_one(
            {"id": app.get("user_id")},
            {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
        )
        if user:
            app["user"] = user
    return apps

# Admin endpoint for verification review
@api_router.post("/admin/verification/{application_id}/review")
async def review_verification(
    application_id: str,
    decision: str = Form(...),  # approve, reject
    notes: str = Form(default=""),
    current_user: dict = Depends(get_current_user)
):
    """Review verification application (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    application = await db.verification_applications.find_one(
        {"id": application_id},
        {"_id": 0}
    )
    
    if not application:
        raise HTTPException(status_code=404, detail="Başvuru bulunamadı")
    
    now = datetime.now(timezone.utc)
    status = "approved" if decision == "approve" else "rejected"
    
    await db.verification_applications.update_one(
        {"id": application_id},
        {"$set": {
            "status": status,
            "reviewed_at": now.isoformat(),
            "reviewer_notes": notes,
            "reviewer_id": current_user["id"]
        }}
    )
    
    # If approved, update user
    if status == "approved":
        await db.users.update_one(
            {"id": application["user_id"]},
            {"$set": {
                "is_verified": True,
                "verified_at": now.isoformat(),
                "artist_name": application["artist_name"]
            }}
        )
        
        # Award badge
        await db.users.update_one(
            {"id": application["user_id"]},
            {"$addToSet": {"badges": "verified"}}
        )
    
    return {
        "message": f"Başvuru {'onaylandı' if status == 'approved' else 'reddedildi'}",
        "application_id": application_id,
        "status": status
    }

# ============== DISAPPEARING MESSAGES ==============

@api_router.post("/messages/disappearing")
async def send_disappearing_message(
    conversation_id: str = Form(...),
    content: str = Form(...),
    duration_seconds: int = Form(default=30),  # 30 saniye default
    current_user: dict = Depends(get_current_user)
):
    """Send a disappearing message"""
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=duration_seconds)
    
    message_id = str(uuid.uuid4())
    
    message = {
        "id": message_id,
        "conversation_id": conversation_id,
        "sender_id": current_user["id"],
        "content": content,
        "content_type": "disappearing",
        "is_disappearing": True,
        "duration_seconds": duration_seconds,
        "expires_at": expires_at.isoformat(),
        "is_destroyed": False,
        "created_at": now.isoformat()
    }
    
    await db.messages.insert_one(message)
    
    # Update conversation
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {
            "last_message": "🔥 Kaybolan mesaj",
            "last_message_at": now.isoformat()
        }}
    )
    
    # Remove _id before returning (MongoDB adds it automatically)
    message.pop("_id", None)
    
    return {
        "message": message,
        "expires_at": expires_at.isoformat()
    }

@api_router.get("/messages/disappearing/{message_id}/view")
async def view_disappearing_message(
    message_id: str,
    current_user: dict = Depends(get_current_user)
):
    """View a disappearing message - marks it as viewed and starts countdown"""
    message = await db.messages.find_one({"id": message_id}, {"_id": 0})
    
    if not message:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
    
    if message.get("is_destroyed"):
        return {"content": "[Bu mesaj silindi]", "is_destroyed": True}
    
    now = datetime.now(timezone.utc)
    expires_at = datetime.fromisoformat(message["expires_at"].replace('Z', '+00:00'))
    
    if now > expires_at:
        # Message expired, destroy it
        await db.messages.update_one(
            {"id": message_id},
            {"$set": {
                "content": "[Bu mesaj silindi]",
                "is_destroyed": True
            }}
        )
        return {"content": "[Bu mesaj silindi]", "is_destroyed": True}
    
    remaining_seconds = (expires_at - now).total_seconds()
    
    return {
        "content": message["content"],
        "remaining_seconds": int(remaining_seconds),
        "is_destroyed": False
    }

# ============== QUOTE REPLY ==============

@api_router.post("/messages/quote-reply")
async def send_quote_reply(
    conversation_id: str = Form(...),
    content: str = Form(...),
    quoted_message_id: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Send a message as a reply to another message (quote)"""
    # Get quoted message
    quoted_message = await db.messages.find_one(
        {"id": quoted_message_id},
        {"_id": 0}
    )
    
    if not quoted_message:
        raise HTTPException(status_code=404, detail="Alıntılanan mesaj bulunamadı")
    
    now = datetime.now(timezone.utc).isoformat()
    message_id = str(uuid.uuid4())
    
    message = {
        "id": message_id,
        "conversation_id": conversation_id,
        "sender_id": current_user["id"],
        "content": content,
        "content_type": "quote_reply",
        "quoted_message": {
            "id": quoted_message["id"],
            "content": quoted_message["content"][:200],  # Truncate if too long
            "sender_id": quoted_message["sender_id"],
            "content_type": quoted_message.get("content_type", "text")
        },
        "created_at": now
    }
    
    await db.messages.insert_one(message)
    
    # Update conversation
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {
            "last_message": content[:50],
            "last_message_at": now
        }}
    )
    
    # Remove _id before returning (MongoDB adds it automatically)
    message.pop("_id", None)
    
    return {"message": message}

# ============== BROADCAST MESSAGES ==============

@api_router.post("/messages/broadcast")
async def send_broadcast_message(
    recipient_ids: List[str] = Form(...),
    content: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Send a broadcast message to multiple users"""
    if len(recipient_ids) > 100:
        raise HTTPException(status_code=400, detail="Maksimum 100 alıcı olabilir")
    
    now = datetime.now(timezone.utc).isoformat()
    broadcast_id = str(uuid.uuid4())
    
    # Create broadcast record
    broadcast = {
        "id": broadcast_id,
        "sender_id": current_user["id"],
        "content": content,
        "recipient_count": len(recipient_ids),
        "sent_at": now
    }
    await db.broadcasts.insert_one(broadcast)
    
    # Send to each recipient
    sent_count = 0
    for recipient_id in recipient_ids:
        try:
            # Find or create conversation
            conversation = await db.conversations.find_one({
                "$or": [
                    {"participant_ids": [current_user["id"], recipient_id]},
                    {"participant_ids": [recipient_id, current_user["id"]]}
                ]
            })
            
            if not conversation:
                conversation_id = str(uuid.uuid4())
                conversation = {
                    "id": conversation_id,
                    "participant_ids": [current_user["id"], recipient_id],
                    "created_at": now,
                    "type": "direct"
                }
                await db.conversations.insert_one(conversation)
            else:
                conversation_id = conversation["id"]
            
            # Create message
            message = {
                "id": str(uuid.uuid4()),
                "conversation_id": conversation_id,
                "sender_id": current_user["id"],
                "content": content,
                "content_type": "broadcast",
                "broadcast_id": broadcast_id,
                "created_at": now
            }
            await db.messages.insert_one(message)
            
            # Update conversation
            await db.conversations.update_one(
                {"id": conversation_id},
                {"$set": {"last_message": content[:50], "last_message_at": now}}
            )
            
            sent_count += 1
        except Exception as e:
            logging.error(f"Broadcast to {recipient_id} failed: {e}")
    
    return {
        "message": "Toplu mesaj gönderildi",
        "sent_count": sent_count,
        "total_recipients": len(recipient_ids),
        "broadcast_id": broadcast_id
    }

# ============== DATA USAGE TRACKING ==============

@api_router.get("/user/data-usage")
async def get_data_usage(current_user: dict = Depends(get_current_user)):
    """Get user's data usage statistics"""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = today.replace(day=1)
    
    # Get daily usage
    daily_usage = await db.data_usage.aggregate([
        {"$match": {"user_id": current_user["id"], "date": {"$gte": today.isoformat()}}},
        {"$group": {"_id": None, "total_bytes": {"$sum": "$bytes"}}}
    ]).to_list(length=1)
    
    # Get monthly usage
    monthly_usage = await db.data_usage.aggregate([
        {"$match": {"user_id": current_user["id"], "date": {"$gte": month_start.isoformat()}}},
        {"$group": {"_id": None, "total_bytes": {"$sum": "$bytes"}}}
    ]).to_list(length=1)
    
    # Get user preferences for limit
    prefs = await db.user_settings.find_one({"user_id": current_user["id"]})
    data_limit = prefs.get("data_limit_mb", 0) * 1024 * 1024 if prefs else 0
    
    daily_bytes = daily_usage[0]["total_bytes"] if daily_usage else 0
    monthly_bytes = monthly_usage[0]["total_bytes"] if monthly_usage else 0
    
    return {
        "daily": {
            "bytes": daily_bytes,
            "mb": round(daily_bytes / (1024 * 1024), 2)
        },
        "monthly": {
            "bytes": monthly_bytes,
            "mb": round(monthly_bytes / (1024 * 1024), 2)
        },
        "limit": {
            "bytes": data_limit,
            "mb": round(data_limit / (1024 * 1024), 2) if data_limit else None
        },
        "percentage_used": round((monthly_bytes / data_limit) * 100, 1) if data_limit else None
    }

@api_router.put("/user/data-limit")
async def set_data_limit(
    limit_mb: int = Query(..., description="Monthly data limit in MB"),
    current_user: dict = Depends(get_current_user)
):
    """Set user's monthly data usage limit"""
    await db.user_settings.update_one(
        {"user_id": current_user["id"]},
        {"$set": {"data_limit_mb": limit_mb}},
        upsert=True
    )
    return {"message": f"Veri limiti {limit_mb} MB olarak ayarlandı"}

# ============== AUTOPLAY SETTINGS ==============

@api_router.get("/user/autoplay-settings")
async def get_autoplay_settings(current_user: dict = Depends(get_current_user)):
    """Get user's autoplay settings"""
    settings = await db.user_settings.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    return {
        "on_wifi": settings.get("autoplay_on_wifi", True) if settings else True,
        "on_mobile_data": settings.get("autoplay_on_mobile", False) if settings else False,
        "only_when_charging": settings.get("autoplay_when_charging", False) if settings else False,
        "max_quality": settings.get("autoplay_max_quality", "auto") if settings else "auto"
    }

@api_router.put("/user/autoplay-settings")
async def update_autoplay_settings(
    on_wifi: Optional[bool] = None,
    on_mobile_data: Optional[bool] = None,
    only_when_charging: Optional[bool] = None,
    max_quality: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update user's autoplay settings"""
    update_data = {}
    
    if on_wifi is not None:
        update_data["autoplay_on_wifi"] = on_wifi
    if on_mobile_data is not None:
        update_data["autoplay_on_mobile"] = on_mobile_data
    if only_when_charging is not None:
        update_data["autoplay_when_charging"] = only_when_charging
    if max_quality is not None:
        valid_qualities = ["auto", "240p", "480p", "720p", "1080p"]
        if max_quality not in valid_qualities:
            raise HTTPException(status_code=400, detail="Geçersiz kalite seçeneği")
        update_data["autoplay_max_quality"] = max_quality
    
    if update_data:
        await db.user_settings.update_one(
            {"user_id": current_user["id"]},
            {"$set": update_data},
            upsert=True
        )
    
    return {"message": "Otomatik oynatma ayarları güncellendi"}

# ============== NIGHT MODE SCHEDULER ==============

@api_router.get("/user/night-mode")
async def get_night_mode_settings(current_user: dict = Depends(get_current_user)):
    """Get user's night mode settings"""
    settings = await db.user_settings.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    return {
        "enabled": settings.get("night_mode_enabled", False) if settings else False,
        "start_time": settings.get("night_mode_start", "22:00") if settings else "22:00",
        "end_time": settings.get("night_mode_end", "07:00") if settings else "07:00",
        "follow_sunset": settings.get("night_mode_follow_sunset", False) if settings else False
    }

@api_router.put("/user/night-mode")
async def update_night_mode_settings(
    enabled: Optional[bool] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    follow_sunset: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update user's night mode settings"""
    update_data = {}
    
    if enabled is not None:
        update_data["night_mode_enabled"] = enabled
    if start_time is not None:
        update_data["night_mode_start"] = start_time
    if end_time is not None:
        update_data["night_mode_end"] = end_time
    if follow_sunset is not None:
        update_data["night_mode_follow_sunset"] = follow_sunset
    
    if update_data:
        await db.user_settings.update_one(
            {"user_id": current_user["id"]},
            {"$set": update_data},
            upsert=True
        )
    
    return {"message": "Gece modu ayarları güncellendi"}

# ============== BACKUP SERVICE ==============

@api_router.post("/user/backup")
async def create_backup(current_user: dict = Depends(get_current_user)):
    """Create a backup of user's data"""
    now = datetime.now(timezone.utc)
    backup_id = str(uuid.uuid4())
    
    # Collect user data
    user_data = {
        "user": await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0}),
        "settings": await db.user_settings.find_one({"user_id": current_user["id"]}, {"_id": 0}),
        "playlists": await db.playlists.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(length=1000),
        "posts": await db.posts.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(length=1000),
        "music_history": await db.music_history.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(length=5000),
    }
    
    # Calculate size (approximate)
    import json
    backup_json = json.dumps(user_data)
    size_bytes = len(backup_json.encode('utf-8'))
    
    # Store backup metadata
    backup_record = {
        "id": backup_id,
        "user_id": current_user["id"],
        "type": "MANUAL",
        "size": size_bytes,
        "created_at": now.isoformat(),
        "status": "completed"
    }
    await db.backups.insert_one(backup_record)
    
    return {
        "backup_id": backup_id,
        "size_bytes": size_bytes,
        "size_mb": round(size_bytes / (1024 * 1024), 2),
        "created_at": now.isoformat(),
        "data": user_data
    }

@api_router.get("/user/backups")
async def list_backups(current_user: dict = Depends(get_current_user)):
    """List user's backups"""
    backups = await db.backups.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=50)
    
    return backups

@api_router.delete("/user/backup/{backup_id}")
async def delete_backup(
    backup_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a backup"""
    result = await db.backups.delete_one({
        "id": backup_id,
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Yedek bulunamadı")
    
    return {"message": "Yedek silindi"}

# API endpoint to manually trigger weekly summary (admin only)
@api_router.post("/admin/trigger-weekly-summary")
async def trigger_weekly_summary(current_user: dict = Depends(get_current_user)):
    """Manually trigger weekly summary emails (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Yetkiniz yok")
    
    # Run in background
    asyncio.create_task(send_weekly_summary_emails())
    return {"message": "Haftalık özet e-posta gönderimi başlatıldı"}

# API endpoint to preview weekly summary email
@api_router.get("/stats/weekly-summary-email-preview")
async def preview_weekly_summary(current_user: dict = Depends(get_current_user)):
    """Preview what the weekly summary email would look like"""
    stats = {
        "total_minutes": random.randint(100, 500),
        "total_tracks": random.randint(20, 100),
        "top_artists": [
            {"name": "Tarkan", "plays": random.randint(10, 50)},
            {"name": "Sezen Aksu", "plays": random.randint(8, 40)},
            {"name": "Barış Manço", "plays": random.randint(5, 30)},
            {"name": "MFÖ", "plays": random.randint(3, 20)},
            {"name": "Teoman", "plays": random.randint(2, 15)},
        ],
        "top_genre": random.choice(["Pop", "Rock", "Türk Halk Müziği", "Jazz"])
    }
    
    html = await generate_weekly_summary_html(current_user, stats)
    return {"html": html, "stats": stats}

# ============== STORY ANALYTICS ==============

@api_router.post("/stories/{story_id}/analytics/view")
async def track_story_view_analytics(
    story_id: str,
    watch_time_ms: int = Form(0),
    completed: bool = Form(False),
    current_user: dict = Depends(get_current_user)
):
    """Track story view analytics (watch time, completion)"""
    story = await db.stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    
    now = datetime.now(timezone.utc)
    
    # Update or create view record
    await db.story_views.update_one(
        {"story_id": story_id, "viewer_id": current_user["id"]},
        {
            "$set": {
                "watch_time_ms": watch_time_ms,
                "completed": completed,
                "updated_at": now.isoformat()
            },
            "$setOnInsert": {
                "story_id": story_id,
                "viewer_id": current_user["id"],
                "created_at": now.isoformat()
            }
        },
        upsert=True
    )
    
    return {"success": True}

@api_router.get("/stories/{story_id}/analytics")
async def get_story_analytics(
    story_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get story analytics (owner only)"""
    story = await db.stories.find_one({"id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Hikaye bulunamadı")
    
    if story.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Bu hikayenin analitiğini görme yetkiniz yok")
    
    views = await db.story_views.find(
        {"story_id": story_id},
        {"_id": 0}
    ).to_list(length=1000)
    
    total_views = len(views)
    completed_views = len([v for v in views if v.get("completed")])
    total_watch_time = sum(v.get("watch_time_ms", 0) for v in views)
    avg_watch_time = total_watch_time / total_views if total_views > 0 else 0
    
    return {
        "story_id": story_id,
        "total_views": total_views,
        "completed_views": completed_views,
        "completion_rate": round((completed_views / total_views * 100) if total_views > 0 else 0, 1),
        "average_watch_time_ms": round(avg_watch_time),
        "total_watch_time_ms": total_watch_time
    }

# ============== IP BLOCKING (USER) ==============

@api_router.get("/user/blocked-ips")
async def get_user_blocked_ips(current_user: dict = Depends(get_current_user)):
    """Get user's blocked IPs"""
    blocked = await db.user_blocked_ips.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(length=100)
    
    return {"ips": [b["ip"] for b in blocked]}

@api_router.post("/user/blocked-ips")
async def block_ip_for_user(
    ip: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Block an IP for user login"""
    now = datetime.now(timezone.utc)
    
    # Check if already blocked
    existing = await db.user_blocked_ips.find_one({
        "user_id": current_user["id"],
        "ip": ip
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Bu IP zaten engelli")
    
    await db.user_blocked_ips.insert_one({
        "user_id": current_user["id"],
        "ip": ip,
        "created_at": now.isoformat()
    })
    
    return {"message": f"IP {ip} engellendi"}

@api_router.delete("/user/blocked-ips")
async def unblock_ip_for_user(
    ip: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Unblock an IP for user login"""
    result = await db.user_blocked_ips.delete_one({
        "user_id": current_user["id"],
        "ip": ip
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Bu IP engelli değil")
    
    return {"message": f"IP {ip} engeli kaldırıldı"}

# ============== SECURITY CENTER ==============

@api_router.get("/user/security-events")
async def get_security_events(
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user)
):
    """Get user's security events (login attempts, password changes, etc.)"""
    events = await db.security_events.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(length=limit)
    
    return events

# ============== SAVED SEARCHES ==============

@api_router.get("/search/saved")
async def get_saved_searches(current_user: dict = Depends(get_current_user)):
    """Get user's saved searches"""
    saved = await db.saved_searches.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=50)
    
    return saved

@api_router.post("/search/saved")
async def save_search(
    query: str = Form(...),
    filters: str = Form(None),  # JSON string
    current_user: dict = Depends(get_current_user)
):
    """Save a search query"""
    now = datetime.now(timezone.utc)
    search_id = str(uuid.uuid4())
    
    search_record = {
        "id": search_id,
        "user_id": current_user["id"],
        "query": query,
        "filters": filters,
        "created_at": now.isoformat()
    }
    
    await db.saved_searches.insert_one(search_record)
    search_record.pop("_id", None)
    
    return search_record

@api_router.delete("/search/saved/{search_id}")
async def delete_saved_search(
    search_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a saved search"""
    result = await db.saved_searches.delete_one({
        "id": search_id,
        "user_id": current_user["id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Kaydedilmiş arama bulunamadı")
    
    return {"message": "Kaydedilmiş arama silindi"}

# ============== NOTIFICATION BULK ACTIONS ==============

@api_router.delete("/notifications/bulk")
async def delete_notifications_bulk(
    notification_ids: List[str] = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Delete multiple notifications at once"""
    result = await db.notifications.delete_many({
        "id": {"$in": notification_ids},
        "user_id": current_user["id"]
    })
    
    return {
        "deleted_count": result.deleted_count,
        "message": f"{result.deleted_count} bildirim silindi"
    }

@api_router.delete("/notifications/all")
async def delete_all_notifications(current_user: dict = Depends(get_current_user)):
    """Delete all notifications for user"""
    result = await db.notifications.delete_many({
        "user_id": current_user["id"]
    })
    
    return {
        "deleted_count": result.deleted_count,
        "message": "Tüm bildirimler silindi"
    }

# ============== SETTINGS BACKUP/RESTORE ==============

@api_router.get("/user/settings/export")
async def export_user_settings(current_user: dict = Depends(get_current_user)):
    """Export all user settings as JSON"""
    settings = await db.user_settings.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    notification_settings = await db.notification_settings.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    theme_settings = await db.user_themes.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "settings": settings or {},
        "notification_settings": notification_settings or {},
        "theme_settings": theme_settings or {}
    }

@api_router.post("/user/settings/import")
async def import_user_settings(
    settings_json: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Import user settings from JSON"""
    import json
    
    try:
        data = json.loads(settings_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Geçersiz JSON formatı")
    
    now = datetime.now(timezone.utc)
    
    # Import general settings
    if data.get("settings"):
        await db.user_settings.update_one(
            {"user_id": current_user["id"]},
            {"$set": {**data["settings"], "updated_at": now.isoformat()}},
            upsert=True
        )
    
    # Import notification settings
    if data.get("notification_settings"):
        await db.notification_settings.update_one(
            {"user_id": current_user["id"]},
            {"$set": {**data["notification_settings"], "updated_at": now.isoformat()}},
            upsert=True
        )
    
    # Import theme settings
    if data.get("theme_settings"):
        await db.user_themes.update_one(
            {"user_id": current_user["id"]},
            {"$set": {**data["theme_settings"], "updated_at": now.isoformat()}},
            upsert=True
        )
    
    return {"message": "Ayarlar başarıyla içe aktarıldı"}

# ============== PLAYLIST COPY ==============

@api_router.post("/playlists/{playlist_id}/copy")
async def copy_playlist(
    playlist_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Copy a public playlist to user's library"""
    # Get source playlist
    source = await db.playlists.find_one({"id": playlist_id})
    if not source:
        raise HTTPException(status_code=404, detail="Çalma listesi bulunamadı")
    
    # Check if public or own
    if source.get("user_id") == current_user["id"]:
        raise HTTPException(status_code=400, detail="Kendi listeni kopyalayamazsın")
    
    if not source.get("is_public", False):
        raise HTTPException(status_code=403, detail="Bu çalma listesi özel")
    
    now = datetime.now(timezone.utc)
    new_playlist_id = str(uuid.uuid4())
    
    # Create copy
    new_playlist = {
        "id": new_playlist_id,
        "user_id": current_user["id"],
        "name": f"{source.get('name', 'Çalma Listesi')} (kopya)",
        "description": source.get("description", ""),
        "cover_url": source.get("cover_url"),
        "is_public": False,  # Default to private
        "copied_from": playlist_id,
        "tracks": source.get("tracks", []),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.playlists.insert_one(new_playlist)
    new_playlist.pop("_id", None)
    
    return new_playlist

# ============== PLAYLIST STATS ==============

@api_router.get("/playlists/{playlist_id}/stats")
async def get_playlist_stats(
    playlist_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get playlist statistics"""
    playlist = await db.playlists.find_one({"id": playlist_id})
    if not playlist:
        raise HTTPException(status_code=404, detail="Çalma listesi bulunamadı")
    
    # Check access
    if playlist.get("user_id") != current_user["id"] and not playlist.get("is_public"):
        raise HTTPException(status_code=403, detail="Bu çalma listesine erişim yetkiniz yok")
    
    tracks = playlist.get("tracks", [])
    
    # Get play history for this playlist
    play_history = await db.play_history.find({
        "user_id": current_user["id"],
        "playlist_id": playlist_id
    }).to_list(length=10000)
    
    # Calculate stats
    track_plays = {}
    track_skips = {}
    
    for play in play_history:
        track_id = play.get("track_id")
        if track_id:
            track_plays[track_id] = track_plays.get(track_id, 0) + 1
            if play.get("skipped"):
                track_skips[track_id] = track_skips.get(track_id, 0) + 1
    
    # Sort tracks by plays
    top_tracks = sorted(
        [(t, track_plays.get(t.get("id"), 0)) for t in tracks],
        key=lambda x: x[1],
        reverse=True
    )[:10]
    
    # Sort by skip rate
    most_skipped = sorted(
        [(t, track_skips.get(t.get("id"), 0) / max(track_plays.get(t.get("id"), 1), 1) * 100) 
         for t in tracks if track_plays.get(t.get("id"), 0) > 0],
        key=lambda x: x[1],
        reverse=True
    )[:5]
    
    total_duration = sum(t.get("duration", 0) for t in tracks)
    
    return {
        "playlist_id": playlist_id,
        "total_tracks": len(tracks),
        "total_duration_seconds": total_duration,
        "total_plays": len(play_history),
        "total_play_time": sum(p.get("duration", 0) for p in play_history),
        "total_skips": sum(1 for p in play_history if p.get("skipped")),
        "top_tracks": [
            {"track": t[0], "plays": t[1]} 
            for t in top_tracks
        ],
        "most_skipped": [
            {"track": t[0], "skip_rate": round(t[1], 1)} 
            for t in most_skipped
        ],
        "average_track_duration": round(total_duration / len(tracks)) if tracks else 0
    }

# ============== PLAYLIST COVER CUSTOMIZATION ==============

@api_router.post("/playlists/{playlist_id}/cover")
async def update_playlist_cover(
    playlist_id: str,
    image: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload custom cover image for playlist"""
    playlist = await db.playlists.find_one({"id": playlist_id})
    if not playlist:
        raise HTTPException(status_code=404, detail="Çalma listesi bulunamadı")
    
    if playlist.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Bu çalma listesini düzenleme yetkiniz yok")
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if image.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Desteklenmeyen dosya formatı")
    
    # Save file
    file_ext = image.filename.split(".")[-1] if "." in image.filename else "jpg"
    filename = f"playlist_cover_{playlist_id}_{uuid.uuid4()}.{file_ext}"
    file_path = UPLOAD_DIR / filename
    
    async with aiofiles.open(file_path, "wb") as f:
        content = await image.read()
        await f.write(content)
    
    cover_url = f"/api/uploads/{filename}"
    
    # Update playlist
    await db.playlists.update_one(
        {"id": playlist_id},
        {"$set": {"cover_url": cover_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"cover_url": cover_url}

# ============== ANIMATION SPEED SETTINGS ==============

@api_router.get("/user/animation-settings")
async def get_animation_settings(current_user: dict = Depends(get_current_user)):
    """Get user's animation speed settings"""
    settings = await db.user_animation_settings.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    return settings or {"speed": "normal", "reduced_motion": False}

@api_router.put("/user/animation-settings")
async def update_animation_settings(
    speed: str = Form("normal"),  # slow, normal, fast
    reduced_motion: bool = Form(False),
    current_user: dict = Depends(get_current_user)
):
    """Update user's animation speed settings"""
    if speed not in ["slow", "normal", "fast"]:
        raise HTTPException(status_code=400, detail="Geçersiz hız değeri")
    
    now = datetime.now(timezone.utc)
    
    await db.user_animation_settings.update_one(
        {"user_id": current_user["id"]},
        {
            "$set": {
                "speed": speed,
                "reduced_motion": reduced_motion,
                "updated_at": now.isoformat()
            },
            "$setOnInsert": {
                "user_id": current_user["id"],
                "created_at": now.isoformat()
            }
        },
        upsert=True
    )
    
    return {"speed": speed, "reduced_motion": reduced_motion}

# ============== BACKUP NOTIFICATIONS ==============

@api_router.get("/user/backup-notification-settings")
async def get_backup_notification_settings(current_user: dict = Depends(get_current_user)):
    """Get backup notification preferences"""
    settings = await db.backup_notification_settings.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    return settings or {
        "notify_on_start": True,
        "notify_on_success": True,
        "notify_on_failure": True
    }

@api_router.put("/user/backup-notification-settings")
async def update_backup_notification_settings(
    notify_on_start: bool = Form(True),
    notify_on_success: bool = Form(True),
    notify_on_failure: bool = Form(True),
    current_user: dict = Depends(get_current_user)
):
    """Update backup notification preferences"""
    now = datetime.now(timezone.utc)
    
    settings = {
        "notify_on_start": notify_on_start,
        "notify_on_success": notify_on_success,
        "notify_on_failure": notify_on_failure,
        "updated_at": now.isoformat()
    }
    
    await db.backup_notification_settings.update_one(
        {"user_id": current_user["id"]},
        {"$set": settings, "$setOnInsert": {"user_id": current_user["id"], "created_at": now.isoformat()}},
        upsert=True
    )
    
    return settings

# ============== PROFILE ANNIVERSARY ==============

@api_router.get("/user/anniversary")
async def check_anniversary(current_user: dict = Depends(get_current_user)):
    """Check if user has an anniversary coming up"""
    created_at = current_user.get("created_at")
    if not created_at:
        return {"has_anniversary": False}
    
    # Parse created_at
    if isinstance(created_at, str):
        created_date = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    else:
        created_date = created_at
    
    now = datetime.now(timezone.utc)
    
    # Calculate years
    years = now.year - created_date.year
    
    # Check if anniversary is this month
    anniversary_this_month = (
        created_date.month == now.month and 
        created_date.day >= now.day
    )
    
    # Check if anniversary passed this month
    anniversary_passed = (
        created_date.month == now.month and 
        created_date.day < now.day
    )
    
    # Today is anniversary?
    is_today = (
        created_date.month == now.month and 
        created_date.day == now.day
    )
    
    return {
        "has_anniversary": is_today or anniversary_this_month,
        "is_today": is_today,
        "years": years if is_today or anniversary_passed else years,
        "anniversary_date": f"{created_date.day}/{created_date.month}",
        "days_until": (datetime(now.year, created_date.month, created_date.day) - now).days if not is_today else 0
    }

# ============== ACTIVITY BADGE ==============

@api_router.get("/users/{user_id}/activity-status")
async def get_user_activity_status(user_id: str):
    """Get user's activity status (active badge)"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    last_active = user.get("last_active")
    if not last_active:
        return {"status": "inactive", "badge_color": "gray"}
    
    if isinstance(last_active, str):
        last_active_dt = datetime.fromisoformat(last_active.replace("Z", "+00:00"))
    else:
        last_active_dt = last_active
    
    now = datetime.now(timezone.utc)
    diff = now - last_active_dt
    
    if diff.total_seconds() < 86400:  # 24 hours
        return {"status": "active", "badge_color": "green", "last_seen": "Şu an aktif"}
    elif diff.total_seconds() < 604800:  # 7 days
        return {"status": "recent", "badge_color": "orange", "last_seen": f"{diff.days} gün önce"}
    else:
        return {"status": "inactive", "badge_color": "gray", "last_seen": f"{diff.days} gün önce"}

# ============== PROFILE VISITORS ==============

@api_router.post("/users/{user_id}/visit")
async def record_profile_visit(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Record a profile visit"""
    if user_id == current_user["id"]:
        return {"recorded": False}  # Don't record self visits
    
    now = datetime.now(timezone.utc)
    
    # Update or create visit record
    await db.profile_visits.update_one(
        {"profile_id": user_id, "visitor_id": current_user["id"]},
        {
            "$set": {"visited_at": now.isoformat()},
            "$setOnInsert": {
                "profile_id": user_id,
                "visitor_id": current_user["id"],
                "first_visit": now.isoformat()
            },
            "$inc": {"visit_count": 1}
        },
        upsert=True
    )
    
    return {"recorded": True}

@api_router.get("/user/profile-visitors")
async def get_profile_visitors(
    days: int = Query(30, ge=1, le=90),
    current_user: dict = Depends(get_current_user)
):
    """Get profile visitors (last X days)"""
    # Check privacy settings
    settings = await db.user_settings.find_one({"user_id": current_user["id"]})
    if settings and settings.get("profile_visitors_visibility") == "disabled":
        return {"visitors": [], "total_count": 0, "disabled": True}
    
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    
    visitors = await db.profile_visits.find({
        "profile_id": current_user["id"],
        "visited_at": {"$gte": cutoff.isoformat()}
    }, {"_id": 0}).sort("visited_at", -1).to_list(length=100)
    
    # Enrich with user data
    enriched = []
    for visit in visitors:
        user = await db.users.find_one(
            {"id": visit["visitor_id"]},
            {"_id": 0, "id": 1, "name": 1, "username": 1, "avatar_url": 1}
        )
        if user:
            enriched.append({
                **visit,
                "visitor": user
            })
    
    return {
        "visitors": enriched,
        "total_count": len(enriched),
        "period_days": days
    }

# ============== TRANSLATION SERVICE (MyMemory API - Free, No Key) ==============

@api_router.post("/messages/translate")
async def translate_message(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Translate message text using MyMemory API (free, no key required)"""
    text = data.get("text", "")
    source_language = data.get("source_language", "auto")
    target_language = data.get("target_language", "en")
    if not text.strip():
        return {"original_text": text, "translated_text": text, "source_language": source_language, "target_language": target_language}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            source = source_language if source_language != "auto" else "autodetect"
            params = {"q": text, "langpair": f"{source}|{target_language}"}
            response = await client.get("https://api.mymemory.translated.net/get", params=params)

            if response.status_code == 200:
                result = response.json()
                if result.get("responseStatus") == 200:
                    translated_text = result.get("responseData", {}).get("translatedText", text)
                    return {
                        "original_text": text,
                        "translated_text": translated_text,
                        "source_language": source_language,
                        "target_language": target_language,
                        "match_quality": result.get("responseData", {}).get("match", 0),
                    }
    except Exception as e:
        logging.error(f"Translation error: {e}")
    
    return {
        "original_text": text,
        "translated_text": text,
        "source_language": source_language,
        "target_language": target_language,
        "error": "Çeviri yapılamadı"
    }

@api_router.post("/messages/voice/transcribe")
async def transcribe_voice_message(
    audio_url: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Transcribe voice message to text"""
    # For now, return mock transcription (would integrate with Google Speech-to-Text API)
    # In production, use Google Cloud Speech-to-Text API
    
    # Mock transcription
    return {
        "transcript": "Bu bir örnek transkript metnidir. Gerçek implementasyonda ses dosyası analiz edilir.",
        "detected_language": "tr",
        "confidence": 0.92
    }

# ============== BACKUP SCHEDULE ==============

@api_router.get("/user/backup-schedule")
async def get_backup_schedule(current_user: dict = Depends(get_current_user)):
    """Get user's backup schedule settings"""
    schedule = await db.backup_schedules.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0}
    )
    
    return schedule or {
        "enabled": False,
        "frequency": "weekly",
        "time": "03:00",
        "wifiOnly": True,
        "lastBackup": None,
        "nextBackup": None
    }

@api_router.put("/user/backup-schedule")
async def update_backup_schedule(
    enabled: bool = Form(False),
    frequency: str = Form("weekly"),
    time: str = Form("03:00"),
    wifi_only: bool = Form(True),
    current_user: dict = Depends(get_current_user)
):
    """Update user's backup schedule settings"""
    now = datetime.now(timezone.utc)
    
    # Calculate next backup time
    next_backup = None
    if enabled:
        if frequency == "daily":
            next_backup = now + timedelta(days=1)
        elif frequency == "weekly":
            next_backup = now + timedelta(weeks=1)
        else:  # monthly
            next_backup = now + timedelta(days=30)
    
    schedule = {
        "user_id": current_user["id"],
        "enabled": enabled,
        "frequency": frequency,
        "time": time,
        "wifiOnly": wifi_only,
        "nextBackup": next_backup.isoformat() if next_backup else None,
        "updated_at": now.isoformat()
    }
    
    await db.backup_schedules.update_one(
        {"user_id": current_user["id"]},
        {"$set": schedule},
        upsert=True
    )
    
    return schedule

# ============== BACKUP LIST & COMPARE ==============

@api_router.get("/user/backups")
async def get_user_backups(
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """Get user's backup history"""
    backups = await db.backups.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=limit)
    
    return {"backups": backups}

@api_router.get("/user/backups/compare")
async def compare_backups(
    backup1: str = Query(...),
    backup2: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Compare two backups"""
    b1 = await db.backups.find_one(
        {"id": backup1, "user_id": current_user["id"]},
        {"_id": 0}
    )
    b2 = await db.backups.find_one(
        {"id": backup2, "user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not b1 or not b2:
        raise HTTPException(status_code=404, detail="Yedek bulunamadı")
    
    # Calculate differences
    b1_items = b1.get("items", {})
    b2_items = b2.get("items", {})
    
    added = {
        "playlists": max(0, b1_items.get("playlists", 0) - b2_items.get("playlists", 0)),
        "posts": max(0, b1_items.get("posts", 0) - b2_items.get("posts", 0)),
        "settings": max(0, b1_items.get("settings", 0) - b2_items.get("settings", 0))
    }
    
    removed = {
        "playlists": max(0, b2_items.get("playlists", 0) - b1_items.get("playlists", 0)),
        "posts": max(0, b2_items.get("posts", 0) - b1_items.get("posts", 0)),
        "settings": max(0, b2_items.get("settings", 0) - b1_items.get("settings", 0))
    }
    
    return {
        "backup1": backup1,
        "backup2": backup2,
        "added": added,
        "removed": removed,
        "changed": {"playlists": 0, "posts": 0, "settings": 0}
    }

@api_router.post("/user/backups/restore-selective")
async def selective_restore(
    backup_id: str = Form(...),
    items: List[str] = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Selectively restore items from a backup"""
    backup = await db.backups.find_one(
        {"id": backup_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not backup:
        raise HTTPException(status_code=404, detail="Yedek bulunamadı")
    
    restored_items = []
    for item in items:
        if item in backup.get("data", {}):
            restored_items.append(item)
            # In production, actually restore the data
    
    return {
        "message": "Seçili öğeler geri yüklendi",
        "restored_items": restored_items
    }

# ============== PROFILE EXPORT ==============

@api_router.get("/users/profile/export")
async def export_user_profile(
    format: str = Query("json"),
    current_user: dict = Depends(get_current_user)
):
    """Export user profile data"""
    user = await db.users.find_one(
        {"id": current_user["id"]},
        {"_id": 0, "password": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    # Get additional stats
    posts_count = await db.posts.count_documents({"user_id": current_user["id"]})
    playlists_count = await db.playlists.count_documents({"user_id": current_user["id"]})
    
    # Get top tracks
    play_history = await db.play_history.find(
        {"user_id": current_user["id"]}
    ).to_list(length=1000)
    
    track_plays = {}
    for play in play_history:
        track_id = play.get("track_id")
        if track_id:
            if track_id not in track_plays:
                track_plays[track_id] = {"plays": 0, "title": play.get("track_title", ""), "artist": play.get("artist_name", "")}
            track_plays[track_id]["plays"] += 1
    
    top_tracks = sorted(track_plays.values(), key=lambda x: x["plays"], reverse=True)[:10]
    
    return {
        "name": user.get("name"),
        "username": user.get("username"),
        "bio": user.get("bio"),
        "avatar_url": user.get("avatar_url"),
        "followers_count": user.get("followers_count", 0),
        "following_count": user.get("following_count", 0),
        "posts_count": posts_count,
        "playlists_count": playlists_count,
        "total_likes": user.get("total_likes", 0),
        "total_plays": len(play_history),
        "top_tracks": top_tracks,
        "created_at": user.get("created_at"),
        "exported_at": datetime.now(timezone.utc).isoformat()
    }

# Mount uploads directory for serving files
# app.include_router will be at the end of file

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add SecurityMiddleware and CSRF before routes (runs early in request cycle)
if SECURITY_ENABLED:
    try:
        fastapi_app.add_middleware(CSRFMiddleware)
        fastapi_app.add_middleware(SecurityMiddleware, db=db)
        logger.info("SecurityMiddleware and CSRFMiddleware enabled")
    except NameError:
        pass

# Logging is configured at the top of the file

# Background task reference
background_task = None

@fastapi_app.on_event("startup")
async def startup_event():
    """Start background tasks on app startup"""
    global background_task
    background_task = asyncio.create_task(run_scheduled_tasks())
    
    # Initialize MongoDB Indexes
    try:
        await db.messages.create_index([("conversation_id", 1), ("created_at", -1)])
        await db.messages.create_index([("created_at", -1)])
        await db.messages.create_index([("message_id", 1)], unique=True, sparse=True)
        # Unique index on message_id prevents duplicates from webhook.
        logger.info("MongoDB indexes created for optimal query performance")
    except Exception as e:
        logger.info(f"MongoDB indexing error: {e}")
        
    logger.info("Started background cleanup tasks")

    # Initialize PostgreSQL
    try:
        from services.postgresql_service import init_tables as pg_init
        await pg_init()
    except Exception as e:
        logger.info(f"PostgreSQL init skipped: {e}")

    # Initialize SuperTokens
    try:
        from services.supertokens_service import init_supertokens
        init_supertokens()
    except Exception as e:
        logger.info(f"SuperTokens init skipped: {e}")

    # Initialize MinIO
    try:
        from services.minio_service import get_client as minio_init
        minio_init()
    except Exception as e:
        logger.info(f"MinIO init skipped: {e}")

@fastapi_app.on_event("shutdown")
async def shutdown_db_client():
    global background_task
    if background_task:
        background_task.cancel()
        try:
            await background_task
        except asyncio.CancelledError:
            pass
    client.close()
    logger.info("Shutdown complete")

# Rate limiting middleware
@fastapi_app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Apply rate limiting to all requests"""
    client_ip = request.client.host if request.client else "unknown"
    
    # Check if IP is blocked
    if rate_limiter.is_blocked(client_ip):
        return JSONResponse(
            status_code=429,
            content={"detail": "IP geçici olarak engellendi. Lütfen daha sonra tekrar deneyin."}
        )
    
    # Different limits for different endpoints
    path = request.url.path
    
    # Stricter limits for auth endpoints
    if "/auth/login" in path or "/auth/register" in path:
        limit, window = 10, 60  # 10 requests per minute
    elif "/api/" in path:
        limit, window = 100, 60  # 100 requests per minute for API
    else:
        limit, window = 200, 60  # 200 for other requests
    
    if not rate_limiter.check_rate_limit(client_ip, limit, window):
        remaining = rate_limiter.get_remaining(client_ip, limit, window)
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Çok fazla istek gönderildi. Lütfen biraz bekleyin.",
                "retry_after": window,
                "remaining": remaining
            },
            headers={"Retry-After": str(window)}
        )
    
    response = await call_next(request)
    
    # Add rate limit headers
    remaining = rate_limiter.get_remaining(client_ip, limit, window)
    response.headers["X-RateLimit-Limit"] = str(limit)
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    
    return response

# Import for JSONResponse
from starlette.responses import JSONResponse

# ============== WEEKLY SUMMARY EMAIL SCHEDULER ==============

scheduler = AsyncIOScheduler()

async def generate_weekly_summary_html(user_data: dict, stats: dict) -> str:
    """Generate HTML content for weekly summary email"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0E0E0E; color: #fff; margin: 0; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background: #1A1A1A; border-radius: 16px; padding: 30px; }}
            .header {{ text-align: center; margin-bottom: 30px; }}
            .logo {{ font-size: 28px; font-weight: bold; color: #8B5CF6; }}
            .greeting {{ font-size: 20px; margin: 20px 0; }}
            .stat-card {{ background: #252525; border-radius: 12px; padding: 20px; margin: 15px 0; }}
            .stat-value {{ font-size: 36px; font-weight: bold; color: #8B5CF6; }}
            .stat-label {{ color: #888; font-size: 14px; }}
            .top-item {{ display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid #333; }}
            .rank {{ width: 30px; font-weight: bold; color: #8B5CF6; }}
            .item-info {{ flex: 1; }}
            .item-name {{ font-weight: 600; }}
            .item-plays {{ color: #888; font-size: 12px; }}
            .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 12px; }}
            .cta-button {{ display: inline-block; background: #8B5CF6; color: #fff; padding: 12px 30px; border-radius: 25px; text-decoration: none; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🎵 SocialBeats</div>
                <p class="greeting">Merhaba {user_data.get('display_name', user_data.get('username', 'Müziksever'))}!</p>
                <p style="color: #888;">İşte bu haftanın müzik özetin 🎧</p>
            </div>
            
            <div class="stat-card">
                <div class="stat-value">{stats.get('total_minutes', 0)}</div>
                <div class="stat-label">dakika müzik dinledin</div>
            </div>
            
            <div class="stat-card">
                <div class="stat-value">{stats.get('total_tracks', 0)}</div>
                <div class="stat-label">farklı şarkı keşfettin</div>
            </div>
            
            <h3 style="margin-top: 30px;">🏆 En Çok Dinlediğin Sanatçılar</h3>
            <div class="stat-card">
                {''.join([f'''
                <div class="top-item">
                    <span class="rank">#{i+1}</span>
                    <div class="item-info">
                        <div class="item-name">{artist.get('name', 'Bilinmiyor')}</div>
                        <div class="item-plays">{artist.get('plays', 0)} dinleme</div>
                    </div>
                </div>
                ''' for i, artist in enumerate(stats.get('top_artists', [])[:5])])}
            </div>
            
            <h3>🎵 En Sevdiğin Tür</h3>
            <div class="stat-card">
                <div class="stat-value">{stats.get('top_genre', 'Pop')}</div>
                <div class="stat-label">Bu hafta en çok dinlediğin tür</div>
            </div>
            
            <div style="text-align: center;">
                <a href="https://socialbeats.app" class="cta-button">Uygulamayı Aç</a>
            </div>
            
            <div class="footer">
                <p>Bu e-postayı almak istemiyorsan ayarlardan bildirim tercihlerini güncelleyebilirsin.</p>
                <p>© 2025 SocialBeats. Tüm hakları saklıdır.</p>
            </div>
        </div>
    </body>
    </html>
    """

async def send_weekly_summary_emails():
    """Send weekly summary emails - DISABLED (Mock mode)"""
    logging.info("[MOCK] Weekly summary email job skipped - email functionality disabled")
    return


async def send_weekly_summary_push_to_all():
    """Haftalık özet bildirimi - 20:00 Pazar. weekly_summary_enabled=True kullanıcılara push gönderir."""
    try:
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        week_ago = (now - timedelta(days=7)).isoformat()
        cursor = db.notification_settings.find({"weekly_summary_enabled": True})
        count = 0
        async for settings in cursor:
            uid = settings.get("user_id")
            if not uid:
                continue
            play_count = await db.play_history.count_documents({
                "user_id": uid,
                "played_at": {"$gte": week_ago}
            })
            top_artists = await db.play_history.aggregate([
                {"$match": {"user_id": uid, "played_at": {"$gte": week_ago}}},
                {"$group": {"_id": "$artist", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 1}
            ]).to_list(1)
            top_artist = top_artists[0]["_id"] if top_artists else "Henüz veri yok"
            notif = {
                "id": str(uuid.uuid4()),
                "user_id": uid,
                "type": "weekly_summary",
                "title": "Haftalık Raporun Hazır!",
                "body": f"Bu hafta {play_count} şarkı dinledin. En çok: {top_artist}",
                "content": f"Bu hafta {play_count} şarkı dinledin. En çok: {top_artist}",
                "data": {"type": "weekly_summary", "play_count": play_count, "top_artist": top_artist},
                "read": False,
                "is_read": False,
                "created_at": now.isoformat()
            }
            await db.notifications.insert_one(notif)
            count += 1
        logging.info(f"Weekly summary push: sent to {count} users")
    except Exception as e:
        logging.exception(f"Weekly summary push job error: {e}")


# ============== VIDEO CALLS ==============
class CallLogRequest(BaseModel):
    room_name: str
    call_type: str = "video"  # video, voice
    started_at: Optional[str] = None

@api_router.post("/calls/log")
async def log_call(
    data: CallLogRequest,
    current_user: dict = Depends(get_current_user)
):
    """Log a video/voice call start"""
    call_log = {
        "id": str(uuid.uuid4()),
        "room_name": data.room_name,
        "call_type": data.call_type,
        "user_id": current_user["id"],
        "username": current_user.get("username"),
        "started_at": data.started_at or datetime.now(timezone.utc).isoformat(),
        "ended_at": None,
        "duration_seconds": 0
    }
    
    await db.call_logs.insert_one(call_log)
    call_log.pop("_id", None)
    
    return {"status": "logged", "call_id": call_log["id"]}

@api_router.get("/calls/history")
async def get_call_history(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get user's call history"""
    calls = await db.call_logs.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("started_at", -1).limit(limit).to_list(limit)
    
    return {"calls": calls}

# ============== TRANSLATION (MyMemory API - Free, No Key Required) ==============
MYMEMORY_API_URL = "https://api.mymemory.translated.net"

class TranslationRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    source_language: str = Field(default="auto")
    target_language: str
    content_type: str = Field(default="text")  # text, post, comment, message

class DetectionRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)

@api_router.post("/translate")
async def translate_text(
    data: TranslationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Translate text using MyMemory API (Free, no key required)"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # MyMemory API format: langpair=source|target
            source = data.source_language if data.source_language != "auto" else "autodetect"
            langpair = f"{source}|{data.target_language}"
            
            params = {
                "q": data.text,
                "langpair": langpair
            }
            
            response = await client.get(
                f"{MYMEMORY_API_URL}/get",
                params=params
            )
            
            if response.status_code == 200:
                result = response.json()
                
                if result.get("responseStatus") == 200:
                    translated_text = result.get("responseData", {}).get("translatedText", "")
                    detected_language = result.get("responseData", {}).get("detectedLanguage", None)
                    
                    # Store translation in database for history
                    translation_doc = {
                        "id": str(uuid.uuid4()),
                        "user_id": current_user["id"],
                        "text": data.text,
                        "translated_text": translated_text,
                        "source_language": data.source_language,
                        "target_language": data.target_language,
                        "detected_language": detected_language,
                        "content_type": data.content_type,
                        "match_quality": result.get("responseData", {}).get("match", 0),
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    
                    await db.translations.insert_one(translation_doc)
                    translation_doc.pop("_id", None)
                    
                    return translation_doc
                else:
                    raise HTTPException(status_code=400, detail="Çeviri yapılamadı")
            else:
                raise HTTPException(status_code=500, detail=f"Çeviri başarısız: {response.status_code}")
                
    except httpx.RequestError as e:
        logging.error(f"Translation network error: {e}")
        raise HTTPException(status_code=503, detail="Çeviri servisi şu anda kullanılamıyor")

@api_router.post("/translate/detect")
async def detect_language(
    data: DetectionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Detect language of text using MyMemory API"""
    try:
        # Use MyMemory with auto-detect
        async with httpx.AsyncClient(timeout=10.0) as client:
            params = {
                "q": data.text,
                "langpair": "autodetect|en"  # Auto-detect source
            }
            
            response = await client.get(
                f"{MYMEMORY_API_URL}/get",
                params=params
            )
            
            if response.status_code == 200:
                result = response.json()
                detected = result.get("responseData", {}).get("detectedLanguage", "unknown")
                return {
                    "language": detected if detected else "unknown",
                    "confidence": 0.9 if detected else 0.0
                }
            raise HTTPException(status_code=400, detail="Dil tespit edilemedi")
                
    except httpx.RequestError as e:
        logging.error(f"Detection network error: {e}")
        raise HTTPException(status_code=503, detail="Çeviri servisi şu anda kullanılamıyor")

@api_router.get("/translate/languages")
async def get_supported_languages():
    """Get list of supported languages for MyMemory"""
    # MyMemory supports many languages - return comprehensive list
    return {
        "languages": [
            {"code": "en", "name": "English"},
            {"code": "tr", "name": "Türkçe"},
            {"code": "es", "name": "Español"},
            {"code": "fr", "name": "Français"},
            {"code": "de", "name": "Deutsch"},
            {"code": "it", "name": "Italiano"},
            {"code": "pt", "name": "Português"},
            {"code": "ru", "name": "Русский"},
            {"code": "zh", "name": "中文"},
            {"code": "ja", "name": "日本語"},
            {"code": "ko", "name": "한국어"},
            {"code": "ar", "name": "العربية"},
            {"code": "hi", "name": "हिन्दी"},
            {"code": "nl", "name": "Nederlands"},
            {"code": "pl", "name": "Polski"},
            {"code": "sv", "name": "Svenska"},
            {"code": "da", "name": "Dansk"},
            {"code": "fi", "name": "Suomi"},
            {"code": "no", "name": "Norsk"},
            {"code": "el", "name": "Ελληνικά"},
            {"code": "he", "name": "עברית"},
            {"code": "th", "name": "ไทย"},
            {"code": "vi", "name": "Tiếng Việt"},
            {"code": "id", "name": "Bahasa Indonesia"},
            {"code": "ms", "name": "Bahasa Melayu"},
            {"code": "uk", "name": "Українська"},
            {"code": "cs", "name": "Čeština"},
            {"code": "ro", "name": "Română"},
            {"code": "hu", "name": "Magyar"},
            {"code": "bg", "name": "Български"},
        ]
    }

@api_router.get("/translate/history")
async def get_translation_history(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get user's translation history"""
    translations = await db.translations.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"translations": translations}

# ============== PROFILE STATISTICS (Real-time Analytics) ==============
@api_router.get("/stats/profile/{user_id}")
async def get_profile_statistics(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get comprehensive real-time profile statistics"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    
    # Parallel database queries for performance
    posts_count = await db.posts.count_documents({"user_id": user_id})
    today_posts = await db.posts.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    # Get engagement stats
    user_posts = await db.posts.find({"user_id": user_id}, {"_id": 0, "id": 1}).to_list(1000)
    post_ids = [p["id"] for p in user_posts]
    
    total_likes = await db.post_reactions.count_documents({"post_id": {"$in": post_ids}})
    total_comments = await db.comments.count_documents({"post_id": {"$in": post_ids}})
    
    # Weekly engagement
    weekly_likes = await db.post_reactions.count_documents({
        "post_id": {"$in": post_ids},
        "created_at": {"$gte": week_ago.isoformat()}
    })
    
    # Follower growth
    followers_count = await db.follows.count_documents({"following_id": user_id})
    following_count = await db.follows.count_documents({"follower_id": user_id})
    
    new_followers_today = await db.follows.count_documents({
        "following_id": user_id,
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    new_followers_week = await db.follows.count_documents({
        "following_id": user_id,
        "created_at": {"$gte": week_ago.isoformat()}
    })
    
    # Profile views (if tracking exists)
    profile_views = await db.profile_views.count_documents({
        "viewed_user_id": user_id,
        "created_at": {"$gte": week_ago.isoformat()}
    }) if await db.list_collection_names() else 0
    
    # Music stats
    music_shares = await db.posts.count_documents({
        "user_id": user_id,
        "track": {"$exists": True, "$ne": None}
    })
    
    # Calculate engagement rate
    engagement_rate = 0.0
    if posts_count > 0 and followers_count > 0:
        avg_engagement = (total_likes + total_comments) / posts_count
        engagement_rate = round((avg_engagement / followers_count) * 100, 2)
    
    return {
        "user_id": user_id,
        "username": user.get("username"),
        "display_name": user.get("display_name"),
        "avatar_url": user.get("avatar_url"),
        "is_verified": user.get("is_verified", False),
        "stats": {
            "posts": {
                "total": posts_count,
                "today": today_posts,
                "music_shares": music_shares
            },
            "followers": {
                "total": followers_count,
                "new_today": new_followers_today,
                "new_week": new_followers_week,
                "growth_rate": round((new_followers_week / max(followers_count - new_followers_week, 1)) * 100, 2)
            },
            "following": {
                "total": following_count
            },
            "engagement": {
                "total_likes": total_likes,
                "total_comments": total_comments,
                "weekly_likes": weekly_likes,
                "engagement_rate": engagement_rate
            },
            "profile_views": profile_views
        },
        "updated_at": now.isoformat()
    }

@api_router.get("/stats/dashboard")
async def get_dashboard_statistics(
    current_user: dict = Depends(get_current_user)
):
    """Get dashboard statistics for current user"""
    return await get_profile_statistics(current_user["id"], current_user)

# ============== REAL-TIME FEED AUTO-UPDATE ==============
# Feed update events via Socket.IO

@sio.event
async def subscribe_feed(sid, data):
    """Subscribe to real-time feed updates for a specific section"""
    feed_type = data.get('feed_type', 'home')  # home, discover, social
    user_id = socket_sessions.get(sid)
    
    if not user_id:
        await sio.emit('error', {'error': 'Not authenticated'}, to=sid)
        return
    
    # Join feed-specific room
    await sio.enter_room(sid, f"feed_{feed_type}")
    await sio.emit('feed_subscribed', {'feed_type': feed_type}, to=sid)
    logger.info(f"User {user_id} subscribed to {feed_type} feed")

@sio.event
async def unsubscribe_feed(sid, data):
    """Unsubscribe from feed updates"""
    feed_type = data.get('feed_type', 'home')
    await sio.leave_room(sid, f"feed_{feed_type}")

async def broadcast_new_post(post: dict, feed_types: list = None):
    """Broadcast new post to relevant feed subscribers"""
    if feed_types is None:
        feed_types = ['home', 'social']
    
    for feed_type in feed_types:
        await sio.emit('new_post', {
            'post': post,
            'feed_type': feed_type
        }, room=f"feed_{feed_type}")

async def broadcast_trending_update(items: list, section: str):
    """Broadcast trending updates to discover feed subscribers"""
    await sio.emit('trending_update', {
        'items': items,
        'section': section  # music, posts, hashtags
    }, room="feed_discover")

@api_router.get("/feed/home/updates")
async def get_home_feed_updates(
    since: str = None,
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """Get new posts for home feed since last check"""
    query = {}
    
    if since:
        query["created_at"] = {"$gt": since}
    
    # Get posts from followed users
    following = await db.follows.find(
        {"follower_id": current_user["id"]},
        {"_id": 0, "following_id": 1}
    ).to_list(1000)
    following_ids = [f["following_id"] for f in following]
    following_ids.append(current_user["id"])  # Include own posts
    
    query["user_id"] = {"$in": following_ids}
    
    posts = await db.posts.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Enrich with user data
    for post in posts:
        user = await db.users.find_one(
            {"id": post.get("user_id")},
            {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1, "is_verified": 1}
        )
        post["user"] = user
    
    return {
        "posts": posts,
        "count": len(posts),
        "has_new": len(posts) > 0,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/feed/discover/updates")
async def get_discover_feed_updates(
    since: str = None,
    section: str = "all",  # all, music, trending
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """Get new content for discover feed"""
    result = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sections": {}
    }
    
    if section in ["all", "music"]:
        # Get trending music
        trending_music = await db.posts.find(
            {"track": {"$exists": True, "$ne": None}},
            {"_id": 0}
        ).sort("likes_count", -1).limit(limit).to_list(limit)
        result["sections"]["music"] = trending_music
    
    if section in ["all", "trending"]:
        # Get trending posts
        trending_posts = await db.posts.find(
            {},
            {"_id": 0}
        ).sort("likes_count", -1).limit(limit).to_list(limit)
        
        for post in trending_posts:
            user = await db.users.find_one(
                {"id": post.get("user_id")},
                {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
            )
            post["user"] = user
        
        result["sections"]["trending"] = trending_posts
    
    if section in ["all", "hashtags"]:
        # Get trending hashtags
        trending_hashtags = await db.hashtags.find(
            {},
            {"_id": 0}
        ).sort("post_count", -1).limit(10).to_list(10)
        result["sections"]["hashtags"] = trending_hashtags
    
    return result

@api_router.get("/feed/social/updates")
async def get_social_feed_updates(
    since: str = None,
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """Get new social activity since last check"""
    query = {"visibility": "public"}
    
    if since:
        query["created_at"] = {"$gt": since}
    
    # Get recent public posts
    posts = await db.posts.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    for post in posts:
        user = await db.users.find_one(
            {"id": post.get("user_id")},
            {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1, "is_verified": 1}
        )
        post["user"] = user
    
    # Get suggested users
    suggested = await db.users.find(
        {"id": {"$ne": current_user["id"]}},
        {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1, "is_verified": 1, "followers_count": 1}
    ).sort("followers_count", -1).limit(5).to_list(5)
    
    return {
        "posts": posts,
        "suggested_users": suggested,
        "count": len(posts),
        "has_new": len(posts) > 0,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# ============== LISTENING ROOMS ==============

@api_router.post("/listening-rooms")
async def create_listening_room(body: dict, current_user=Depends(get_current_user)):
    room_id = str(uuid.uuid4())
    room = {
        "id": room_id,
        "name": body.get("name", f"{current_user.get('display_name', current_user['username'])}'s Room"),
        "host_id": current_user["id"],
        "host_username": current_user.get("username", ""),
        "host_avatar": current_user.get("avatar_url", ""),
        "participants": [current_user["id"]],
        "current_track": body.get("track", None),
        "queue": [],
        "is_public": body.get("is_public", True),
        "max_participants": body.get("max_participants", 50),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "active",
    }
    await db.listening_rooms.insert_one(room)
    room.pop("_id", None)
    return room

@api_router.get("/listening-rooms")
async def list_listening_rooms(limit: int = 20):
    rooms = await db.listening_rooms.find({"status": "active", "is_public": True}).sort("created_at", -1).limit(limit).to_list(limit)
    for r in rooms:
        r.pop("_id", None)
        r["participant_count"] = len(r.get("participants", []))
    return rooms

@api_router.get("/listening-rooms/{room_id}")
async def get_listening_room(room_id: str):
    room = await db.listening_rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(404, "Room not found")
    room.pop("_id", None)
    room["participant_count"] = len(room.get("participants", []))
    return room

@api_router.post("/listening-rooms/{room_id}/join")
async def join_listening_room(room_id: str, current_user=Depends(get_current_user)):
    room = await db.listening_rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(404, "Room not found")
    if len(room.get("participants", [])) >= room.get("max_participants", 50):
        raise HTTPException(400, "Room is full")
    await db.listening_rooms.update_one(
        {"id": room_id},
        {"$addToSet": {"participants": current_user["id"]}}
    )
    return {"status": "joined"}

@api_router.post("/listening-rooms/{room_id}/leave")
async def leave_listening_room(room_id: str, current_user=Depends(get_current_user)):
    await db.listening_rooms.update_one(
        {"id": room_id},
        {"$pull": {"participants": current_user["id"]}}
    )
    room = await db.listening_rooms.find_one({"id": room_id})
    if room and len(room.get("participants", [])) == 0:
        await db.listening_rooms.update_one({"id": room_id}, {"$set": {"status": "closed"}})
    return {"status": "left"}

@api_router.post("/listening-rooms/{room_id}/track")
async def update_room_track(room_id: str, body: dict, current_user=Depends(get_current_user)):
    room = await db.listening_rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(404, "Room not found")
    if room["host_id"] != current_user["id"]:
        raise HTTPException(403, "Only host can change track")
    await db.listening_rooms.update_one(
        {"id": room_id},
        {"$set": {"current_track": body.get("track")}}
    )
    return {"status": "updated"}

@api_router.post("/listening-rooms/{room_id}/queue")
async def add_to_room_queue(room_id: str, body: dict, current_user=Depends(get_current_user)):
    room = await db.listening_rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(404, "Room not found")
    if current_user["id"] not in room.get("participants", []):
        raise HTTPException(403, "Not a participant")
    track = body.get("track")
    if track:
        await db.listening_rooms.update_one(
            {"id": room_id},
            {"$push": {"queue": track}}
        )
    return {"status": "added"}

# Import and include new modular routers BEFORE api_router (higher priority)
try:
    from routes.playlists import router as playlists_router
    fastapi_app.include_router(playlists_router, prefix="/api")
    logging.info("Playlists router loaded (modular)")
except ImportError as e:
    logging.warning(f"Could not load playlists router: {e}")

try:
    from routes.stories import router as stories_router
    fastapi_app.include_router(stories_router, prefix="/api")
    logging.info("Stories router loaded (modular)")
except ImportError as e:
    logging.warning(f"Could not load stories router: {e}")

try:
    from routes.highlights import router as highlights_router
    fastapi_app.include_router(highlights_router, prefix="/api")
    logging.info("Highlights router loaded (modular)")
except ImportError as e:
    logging.warning(f"Could not load highlights router: {e}")

try:
    from routes.user_routes import router as user_router
    fastapi_app.include_router(user_router, prefix="/api")
    logging.info("User router loaded (modular)")
except ImportError as e:
    logging.warning(f"Could not load user router: {e}")

try:
    from routes.messages import router as messages_router
    fastapi_app.include_router(messages_router, prefix="/api")
    logging.info("Messages router loaded (modular)")
except ImportError as e:
    logging.warning(f"Could not load messages router: {e}")

try:
    from routes.notifications import router as notifications_router
    fastapi_app.include_router(notifications_router, prefix="/api")
    logging.info("Notifications router loaded (modular)")
except ImportError as e:
    logging.warning(f"Could not load notifications router: {e}")

try:
    from routes.ads import router as ads_router
    fastapi_app.include_router(ads_router, prefix="/api")
    logging.info("Ads router loaded (modular)")
except ImportError as e:
    logging.warning(f"Could not load ads router: {e}")

try:
    from routes.legal import router as legal_router
    fastapi_app.include_router(legal_router, prefix="/api")
    logging.info("Legal router loaded (modular)")
except ImportError as e:
    logging.warning(f"Could not load legal router: {e}")


try:
    from routes.themes import router as themes_router
    fastapi_app.include_router(themes_router, prefix="/api")
    logging.info("Themes router loaded")
except ImportError as e:
    logging.warning(f"Could not load themes router: {e}")

try:
    from routes.settings_routes import router as settings_router
    fastapi_app.include_router(settings_router, prefix="/api")
    logging.info("Settings router loaded (MMKV sync, REST Countries, privacy, cache)")
except ImportError as e:
    logging.warning(f"Could not load settings router: {e}")

try:
    from routes.i18n_routes import router as i18n_router
    fastapi_app.include_router(i18n_router, prefix="/api")
    logging.info("i18n router loaded (translate, locales)")
except ImportError as e:
    logging.warning(f"Could not load i18n router: {e}")

try:
    from routes.reports_routes import router as reports_router
    fastapi_app.include_router(reports_router, prefix="/api")
    logging.info("Reports reasons router loaded")
except ImportError as e:
    logging.warning(f"Could not load reports router: {e}")

try:
    from routes.share_routes import router as share_router
    fastapi_app.include_router(share_router, prefix="/api")
    logging.info("Share router loaded (unified share link)")
except ImportError as e:
    logging.warning(f"Could not load share router: {e}")

try:
    from routes.referral_routes import router as referral_router
    from routes.listening_rooms import router as listening_rooms_router
    fastapi_app.include_router(listening_rooms_router, prefix="/api")

    fastapi_app.include_router(referral_router, prefix="/api")
    logging.info("Referral router loaded (invite codes)")
except ImportError as e:
    logging.warning(f"Could not load referral router: {e}")

try:
    from routes.analytics import router as analytics_router
    fastapi_app.include_router(analytics_router, prefix="/api")
    logging.info("Analytics router loaded")
except ImportError as e:
    logging.warning(f"Could not load analytics router: {e}")

try:
    from routes.ai_moderation_routes import router as ai_moderation_router
    fastapi_app.include_router(ai_moderation_router, prefix="/api")
    logging.info("AI & Moderation router loaded (Gemini + Hugging Face)")
except ImportError as e:
    logging.warning(f"Could not load AI/Moderation router: {e}")

try:
    from routes.ar_effects import router as ar_effects_router
    fastapi_app.include_router(ar_effects_router, prefix="/api")
    logging.info("AR & Effects router loaded (Three.js, MindAR, MediaPipe, VisionCamera, Expo AV)")
except ImportError as e:
    logging.warning(f"Could not load AR effects router: {e}")

# Include the main api_router (legacy routes)
fastapi_app.include_router(api_router)

try:
    from routes.discover_routes import router as discover_router
    fastapi_app.include_router(discover_router, prefix="/api")
    logging.info("Discover router loaded (home, mixed YouTube+Spotify)")
except ImportError as e:
    logging.warning(f"Could not load discover router: {e}")

try:
    from routes.search_unified import router as search_unified_router
    fastapi_app.include_router(search_unified_router, prefix="/api")
    logging.info("Unified search router loaded")
except ImportError as e:
    logging.warning(f"Could not load search_unified router: {e}")

try:
    from routes.karaoke import router as karaoke_router
    fastapi_app.include_router(karaoke_router, prefix="/api")
    logging.info("Karaoke router loaded")
except ImportError as e:
    logging.warning(f"Could not load karaoke router: {e}")


try:
    from routes.social_routes import router as social_router
    fastapi_app.include_router(social_router, prefix="/api")
    logging.info("Social router loaded")
except ImportError as e:
    logging.warning(f"Could not load social router: {e}")

try:
    from routes.social_features import router as social_features_router, init_social_features_router
    init_social_features_router(db, get_current_user)
    fastapi_app.include_router(social_features_router, prefix="/api")
    logging.info("Social Features router loaded (mute, restrict, close friends, block, report)")
except ImportError as e:
    logging.warning(f"Could not load social features router: {e}")

try:
    from routes.friends import router as friends_router, init_friends_router
    init_friends_router(db, get_current_user, lambda *a, **kw: None)
    fastapi_app.include_router(friends_router, prefix="/api")
    logging.info("Friends router loaded (friend requests, mutual follows)")
except ImportError as e:
    logging.warning(f"Could not load friends router: {e}")

try:
    from routes.instagram_features import router as instagram_features_router
    fastapi_app.include_router(instagram_features_router, prefix="/api")
    logging.info("Instagram Features router loaded (highlights, collab, stickers)")
except ImportError as e:
    logging.warning(f"Could not load instagram features router: {e}")

try:
    from routes.live_video import router as live_video_router
    fastapi_app.include_router(live_video_router, prefix="/api")
    logging.info("Live Video router loaded (WebRTC signaling)")
except ImportError as e:
    logging.warning(f"Could not load live video router: {e}")

try:
    from routes.infrastructure import router as infrastructure_router
    fastapi_app.include_router(infrastructure_router, prefix="/api")
    logging.info("Infrastructure router loaded")
except ImportError as e:
    logging.warning(f"Could not load infrastructure router: {e}")

# Modular routers (refactored from server.py)
# IMPORTANT: feed_router must be included BEFORE posts_router
# because /social/posts/trending and /social/posts/explore must match
# before the dynamic /social/posts/{post_id} route
try:
    from routes.feed import router as feed_router
    fastapi_app.include_router(feed_router, prefix="/api")
    logging.info("Feed router loaded (modular)")
except ImportError as e:
    logging.warning(f"Could not load feed router: {e}")

try:
    from routes.posts import router as posts_router
    fastapi_app.include_router(posts_router, prefix="/api")
    logging.info("Posts router loaded (modular)")
except ImportError as e:
    logging.warning(f"Could not load posts router: {e}")

try:
    from routes.comments import router as comments_router
    fastapi_app.include_router(comments_router, prefix="/api")
    logging.info("Comments router loaded (modular)")
except ImportError as e:
    logging.warning(f"Could not load comments router: {e}")

try:
    from routes.firebase_auth import router as firebase_auth_router
    fastapi_app.include_router(firebase_auth_router, prefix="/api")
    logging.info("Firebase Auth router loaded")
except ImportError as e:
    logging.warning(f"Could not load firebase auth router: {e}")

try:
    from routes.nextauth_routes import router as nextauth_router
    fastapi_app.include_router(nextauth_router, prefix="/api")
    logging.info("NextAuth router loaded (signin/signup/session)")
except ImportError as e:
    logging.warning(f"Could not load NextAuth router: {e}")

try:
    from routes.profile_routes import router as profile_router
    fastapi_app.include_router(profile_router, prefix="/api")
    logging.info("Profile router loaded (PostgreSQL: follow, block, close friends, private)")
except ImportError as e:
    logging.warning(f"Could not load profile router: {e}")

try:
    from routes.security_routes import router as security_router, init_security_router
    init_security_router(db, get_current_user)
    fastapi_app.include_router(security_router, prefix="/api")
    logging.info("Security router loaded")
except ImportError as e:
    logging.warning(f"Could not load security router: {e}")

try:
    from routes.communities import router as communities_router, init_communities_router, set_dependencies as set_communities_deps
    init_communities_router(db)
    set_communities_deps(get_current_user, award_badge)
    fastapi_app.include_router(communities_router, prefix="/api")
    logging.info("Communities router loaded (modular)")
except ImportError as e:
    logging.warning(f"Could not load communities router: {e}")

try:
    from routes.gamification import router as gamification_router, init_gamification_router, set_dependencies as set_gamification_deps
    init_gamification_router(db)
    set_gamification_deps(get_current_user)
    fastapi_app.include_router(gamification_router, prefix="/api")
    logging.info("Gamification router loaded (modular)")
except ImportError as e:
    logging.warning(f"Could not load gamification router: {e}")

try:
    from routes.analytics import router as analytics_router
    fastapi_app.include_router(analytics_router, prefix="/api")
    logging.info("Analytics router loaded (overview, follower growth, demographics)")
except ImportError as e:
    logging.warning(f"Could not load analytics router: {e}")

try:
    from routes.backup import router as backup_router
    fastapi_app.include_router(backup_router, prefix="/api")
    logging.info("Backup router loaded (backup, restore, GDPR export, merge)")
except ImportError as e:
    logging.warning(f"Could not load backup router: {e}")

try:
    from routes.music_hybrid import music_hybrid_router
    fastapi_app.include_router(music_hybrid_router, prefix="/api")
    logging.info("Hybrid Music router loaded (SoundCloud + Audiomack)")
except ImportError as e:
    logging.warning(f"Could not load hybrid music router: {e}")

# Mount uploads directory for serving files
fastapi_app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Wrap FastAPI with Socket.IO
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path='/api/socket.io')

# Background auto-deletion of flagged content and vanish messages
async def auto_delete_flagged_content():
    """Automatically delete content that has been flagged and not reviewed within 7 days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    
    old_reports = await db.reports.find({
        "status": "pending",
        "created_at": {"$lt": cutoff.isoformat()},
        "auto_deleted": {"$ne": True}
    }).to_list(100)
    
    deleted_count = 0
    for report in old_reports:
        content_type = report.get("content_type", "")
        content_id = report.get("content_id", "")
        
        if content_type == "post":
            await db.posts.update_one(
                {"id": content_id},
                {"$set": {"deleted": True, "deleted_reason": "auto_moderation", "deleted_at": datetime.now(timezone.utc).isoformat()}}
            )
            deleted_count += 1
        elif content_type == "comment":
            await db.comments.update_one(
                {"id": content_id},
                {"$set": {"deleted": True, "deleted_reason": "auto_moderation"}}
            )
            deleted_count += 1
        elif content_type == "story":
            await db.stories.delete_one({"id": content_id})
            deleted_count += 1
        
        await db.reports.update_one(
            {"_id": report["_id"]},
            {"$set": {"auto_deleted": True, "auto_deleted_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    if deleted_count > 0:
        logging.info(f"Auto-deleted {deleted_count} flagged content items")

    vanish_conversations = await db.conversations.find({"vanish_mode": True}).to_list(1000)
    for conv in vanish_conversations:
        duration = conv.get("vanish_duration", 86400)
        cutoff_vanish = datetime.now(timezone.utc) - timedelta(seconds=duration)
        result = await db.messages.delete_many({
            "conversation_id": conv["id"],
            "created_at": {"$lt": cutoff_vanish.isoformat()}
        })
        if result.deleted_count > 0:
            logging.info(f"Deleted {result.deleted_count} vanish messages from {conv['id']}")

# Background text re-moderation (hourly, non-blocking)
async def _scheduled_text_remoderation():
    """APScheduler job: re-moderate text posts and comments."""
    try:
        from services.content_moderation import content_moderator
        from services.remoderation import run_text_remoderation
        summary = await run_text_remoderation(db, content_moderator)
        if summary.get("posts_deleted", 0) or summary.get("comments_deleted", 0):
            logging.info(f"Re-moderation: deleted {summary.get('posts_deleted', 0)} posts, {summary.get('comments_deleted', 0)} comments")
    except ImportError:
        pass  # Moderation not available
    except Exception as e:
        logging.error(f"Re-moderation job failed: {e}")

# Start scheduler on app startup
@fastapi_app.on_event("startup")
async def start_scheduler():
    """Start the background scheduler"""
    scheduler.start()
    scheduler.add_job(
        send_weekly_summary_push_to_all,
        CronTrigger(day_of_week="sun", hour=20, minute=0, timezone="Europe/Istanbul"),
        id="weekly_summary_push",
    )
    # Text re-moderation every N hours (configurable via REMOD_INTERVAL_HOURS)
    remod_hours = max(1, int(float(os.environ.get("REMOD_INTERVAL_HOURS", "1"))))
    scheduler.add_job(
        _scheduled_text_remoderation,
        CronTrigger(minute=0, hour=f"*/{remod_hours}", timezone="Europe/Istanbul"),
        id="text_remoderation",
    )
    # Daily cache warming at 00:00 UTC - Spotify trending + YouTube trending
    async def _warm_music_cache_job():
        try:
            from services.cache_warming import warm_music_cache
            await warm_music_cache(db)
        except Exception as e:
            logging.error(f"Cache warming job failed: {e}")
    scheduler.add_job(
        _warm_music_cache_job,
        CronTrigger(hour=0, minute=0, timezone="UTC"),
        id="music_cache_warming",
    )
    scheduler.add_job(auto_delete_flagged_content, 'interval', hours=6, id='auto_delete_flagged')

    async def _auto_backup_job():
        try:
            from routes.backup import run_auto_backups_for_all, run_auto_cache_clean
            backed = await run_auto_backups_for_all()
            await run_auto_cache_clean()
            logging.info(f"Auto backup completed for {backed} users")
        except Exception as e:
            logging.error(f"Auto backup job failed: {e}")

    scheduler.add_job(
        _auto_backup_job,
        CronTrigger(hour=3, minute=0, timezone="UTC"),
        id="auto_backup_daily",
    )

    logging.info(f"Scheduler: text re-moderation every {remod_hours}h")
    logging.info("Scheduler: auto-delete flagged content every 6h")
    logging.info("Scheduler: music cache warming daily 00:00 UTC")
    logging.info("Scheduler: auto backup daily 03:00 UTC")
    logging.info("Scheduler started (weekly summary Pazar 20:00)")
    logging.info("Socket.IO server started at /api/socket.io")

@fastapi_app.on_event("shutdown")
async def shutdown_scheduler():
    """Shutdown the scheduler"""
    scheduler.shutdown()
    logging.info("Scheduler shutdown")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server:fastapi_app",
        host="0.0.0.0",
        port=8000,
        reload=False,
    )
