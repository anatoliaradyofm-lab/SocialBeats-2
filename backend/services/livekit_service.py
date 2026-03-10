"""
LiveKit Service - Real-time voice/video calls via WebRTC
Open-source, self-hostable alternative to Twilio/Agora
Falls back to basic Socket.IO signaling if LiveKit server is not available
"""
import os
import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)

LIVEKIT_URL = os.getenv("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")

_available = False


def is_available() -> bool:
    return bool(LIVEKIT_URL and LIVEKIT_API_KEY and LIVEKIT_API_SECRET)


def generate_token(user_id: str, room_name: str, can_publish: bool = True,
                   can_subscribe: bool = True, ttl_seconds: int = 3600) -> Optional[str]:
    """Generate a LiveKit access token for a user to join a room"""
    if not is_available():
        return _fallback_token(user_id, room_name)
    try:
        from livekit.api import AccessToken, VideoGrant
        token = AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        token.identity = user_id
        token.name = user_id
        token.ttl = ttl_seconds

        grant = VideoGrant(
            room_join=True,
            room=room_name,
            can_publish=can_publish,
            can_subscribe=can_subscribe,
        )
        token.video_grant = grant
        return token.to_jwt()
    except ImportError:
        logger.info("livekit-api not installed, using fallback")
        return _fallback_token(user_id, room_name)
    except Exception as e:
        logger.warning(f"LiveKit token generation failed: {e}")
        return _fallback_token(user_id, room_name)


def _fallback_token(user_id: str, room_name: str) -> str:
    """Simple fallback token for Socket.IO based signaling"""
    import hashlib
    ts = str(int(time.time()))
    raw = f"{user_id}:{room_name}:{ts}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


async def create_room(room_name: str, max_participants: int = 10) -> dict:
    if not is_available():
        return {"room": room_name, "backend": "socketio"}
    try:
        from livekit.api import LiveKitAPI
        api = LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        room = await api.room.create_room(name=room_name, max_participants=max_participants)
        return {"room": room.name, "sid": room.sid, "backend": "livekit"}
    except Exception as e:
        logger.warning(f"LiveKit create_room failed: {e}")
        return {"room": room_name, "backend": "socketio"}


async def list_participants(room_name: str) -> list:
    if not is_available():
        return []
    try:
        from livekit.api import LiveKitAPI
        api = LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        participants = await api.room.list_participants(room_name)
        return [{"identity": p.identity, "name": p.name, "state": str(p.state)}
                for p in participants]
    except Exception as e:
        logger.debug(f"LiveKit list_participants error: {e}")
        return []


async def end_room(room_name: str) -> bool:
    if not is_available():
        return True
    try:
        from livekit.api import LiveKitAPI
        api = LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        await api.room.delete_room(room_name)
        return True
    except Exception as e:
        logger.debug(f"LiveKit end_room error: {e}")
        return False


def get_connection_info() -> dict:
    return {
        "url": LIVEKIT_URL or None,
        "available": is_available(),
        "backend": "livekit" if is_available() else "socketio",
    }
