"""
Expo Notifications Service - Push + local payloads + notification sounds
Push: Expo Push API. Local: client schedules from payload. Sounds: Freesound API (sınırsız).
"""
import os
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = os.getenv("EXPO_PUSH_URL", "https://exp.host/--/api/v2/push/send")
FREESOUND_API_KEY = os.getenv("FREESOUND_API_KEY", "")


async def send_push(
    tokens: List[str],
    title: str,
    body: str,
    data: dict = None,
    sound: str = "default",
    channel_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Send push notifications via Expo. sound can be "default", "none", or a URL (custom).
    For local notifications the client uses the same payload shape; backend only sends push.
    """
    if not tokens:
        return {"success": True, "reason": "no_tokens"}
    messages = []
    for token in tokens:
        msg = {
            "to": token,
            "sound": sound if sound else "default",
            "title": title,
            "body": body,
            "data": data or {},
        }
        if channel_id:
            msg["channelId"] = channel_id
        messages.append(msg)
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={"Accept": "application/json", "Content-Type": "application/json"},
            )
            result = resp.json()
            return {"success": True, "data": result}
    except Exception as e:
        logger.warning(f"Expo push error: {e}")
        return {"success": False, "error": str(e)}


def build_local_notification_payload(
    title: str,
    body: str,
    data: dict = None,
    sound: Optional[str] = None,
) -> Dict[str, Any]:
    """Payload for client to schedule a local notification (Expo LocalNotifications)."""
    return {
        "title": title,
        "body": body,
        "data": data or {},
        "sound": sound or "default",
    }


async def search_freesound_sounds(query: str = "notification", limit: int = 20) -> List[Dict]:
    """Fetch notification-style sounds from Freesound API (sınırsız)."""
    if not FREESOUND_API_KEY:
        return []
    try:
        import httpx
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                "https://freesound.org/apiv2/search/text/",
                params={
                    "token": FREESOUND_API_KEY,
                    "query": query,
                    "filter": "duration:[0 TO 5] type:sfx",
                    "fields": "id,name,previews",
                    "page_size": limit,
                },
            )
            if resp.status_code != 200:
                return []
            j = resp.json()
            results = j.get("results", [])
            out = []
            for r in results:
                previews = r.get("previews", {})
                preview_mp3 = previews.get("preview-hq-mp3") or previews.get("preview-lq-mp3")
                out.append({
                    "id": str(r.get("id", "")),
                    "name": r.get("name", ""),
                    "preview_url": preview_mp3,
                })
            return out
    except Exception as e:
        logger.debug(f"Freesound error: {e}")
        return []


async def get_notification_sounds(include_freesound: bool = True) -> List[Dict]:
    """Default list + optional Freesound results for notification sounds."""
    defaults = [
        {"id": "default", "name": "Varsayılan", "preview_url": None},
        {"id": "chime", "name": "Zil Sesi", "preview_url": None},
        {"id": "pop", "name": "Pop", "preview_url": None},
        {"id": "ding", "name": "Ding", "preview_url": None},
        {"id": "none", "name": "Sessiz", "preview_url": None},
    ]
    if include_freesound and FREESOUND_API_KEY:
        extra = await search_freesound_sounds("notification chime", 15)
        for s in extra:
            s["id"] = f"freesound_{s['id']}"
        return defaults + extra
    return defaults
