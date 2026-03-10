"""
WebSocket Service - Socket.IO gercek zamanli iletisim
Uygulama ici mesajlasma, typing indicator, presence yonetimi.
WhatsApp entegrasyonu YOK.
"""
import logging

logger = logging.getLogger(__name__)


async def emit_to_user(user_id: str, event: str, data: dict) -> bool:
    """Socket.IO ile kullaniciya event gonder"""
    try:
        from server import sio, user_sockets
        sids = list(user_sockets.get(user_id, set()))
        for sid in sids:
            await sio.emit(event, data, room=sid)
        return len(sids) > 0
    except Exception as e:
        logger.debug(f"Socket.IO emit failed: {e}")
        return False


async def broadcast_to_conversation(conversation_id: str, event: str, data: dict,
                                     exclude_user: str = None) -> int:
    """Bir sohbetteki tum katilimcilara event gonder"""
    delivered = 0
    try:
        from core.database import db
        conv = await db.conversations.find_one({"id": conversation_id}, {"participants": 1})
        if conv:
            for pid in conv.get("participants", []):
                if pid != exclude_user:
                    ok = await emit_to_user(pid, event, data)
                    if ok:
                        delivered += 1
    except Exception as e:
        logger.debug(f"Broadcast error: {e}")
    return delivered


def get_backend() -> str:
    """Kullanilan mesajlasma backend'i"""
    return "socketio"
