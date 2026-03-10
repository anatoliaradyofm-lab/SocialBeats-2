"""
Mesajlaşma Sunucusu - Evolution API (ana) + python-socketio (yedek)
Evolution: WhatsApp üzerinden mesaj. Socket.IO: uygulama içi gerçek zamanlı.
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

EVOLUTION_URL = os.getenv("EVOLUTION_API_URL", "")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "")
EVOLUTION_INSTANCE = os.getenv("EVOLUTION_INSTANCE", "socialbeats")


def use_evolution() -> bool:
    return bool(EVOLUTION_URL and EVOLUTION_API_KEY)


async def send_message_via_evolution(phone: str, message: str) -> bool:
    """Evolution API (ana) ile mesaj gönder - WhatsApp"""
    if not use_evolution():
        return False
    try:
        from services.evolution_api_service import send_text
        result = await send_text(phone, message)
        return result is not None
    except Exception as e:
        logger.debug(f"Evolution send failed: {e}")
        return False


async def deliver_message(user_id: str, recipient_id: str, content: str, channel: str = "in_app") -> bool:
    """
    Mesaj teslim: Evolution (WhatsApp) veya Socket.IO (in-app).
    channel: 'whatsapp' -> Evolution, 'in_app' -> Socket.IO
    """
    if channel == "whatsapp":
        return await send_message_via_evolution(recipient_id, content)

    # in_app: Socket.IO kullan (server.sio)
    try:
        from server import sio, user_sockets
        sids = user_sockets.get(recipient_id, set())
        for sid in sids:
            await sio.emit("new_message", {"content": content, "sender_id": user_id}, room=sid)
        return len(sids) > 0
    except Exception as e:
        logger.debug(f"Socket.IO deliver failed: {e}")
        return False


def get_backend() -> str:
    return "evolution" if use_evolution() else "socketio"
