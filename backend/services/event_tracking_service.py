"""
Event Tracking Service - Trench (ana) + Jitsu (yedek)
Olay takibi: sayfa görüntüleme, müzik dinleme, kullanıcı etkileşimleri
"""
import os
import logging
import asyncio
from typing import Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

TRENCH_URL = os.getenv("TRENCH_URL", "")
TRENCH_API_KEY = os.getenv("TRENCH_API_KEY", "")
JITSU_HOST = os.getenv("JITSU_HOST", "")
JITSU_WRITE_KEY = os.getenv("JITSU_WRITE_KEY", "")
JITSU_SERVER_TOKEN = os.getenv("JITSU_SERVER_TOKEN", "")


async def _async_track(event_name: str, user_id: str, props: dict, ctx: dict, ts: str):
    """Asenkron olarak Trench veya Jitsu'ya gonder"""
    # 1. Trench dene
    if TRENCH_URL:
        try:
            import httpx
            payload = {"events": [{"type": "track", "event": event_name, "userId": user_id,
                                   "properties": props, "context": ctx, "timestamp": ts}]}
            headers = {"Content-Type": "application/json"}
            if TRENCH_API_KEY:
                headers["Authorization"] = f"Bearer {TRENCH_API_KEY}"
            async with httpx.AsyncClient(timeout=5) as c:
                r = await c.post(f"{TRENCH_URL}/api/events", json=payload, headers=headers)
            if r.status_code in (200, 201, 202):
                return
        except Exception as e:
            logger.debug(f"Trench track failed: {e}")

    # 2. Jitsu yedek
    if JITSU_HOST and (JITSU_WRITE_KEY or JITSU_SERVER_TOKEN):
        try:
            import httpx
            payload = {"type": "track", "event": event_name, "userId": user_id,
                       "properties": props, "context": ctx, "timestamp": ts, "writeKey": JITSU_WRITE_KEY}
            headers = {}
            if JITSU_SERVER_TOKEN:
                headers["X-Auth-Token"] = JITSU_SERVER_TOKEN
            async with httpx.AsyncClient(timeout=5) as c:
                await c.post(f"{JITSU_HOST}/api/s/s2s/track", json=payload, headers=headers or None)
        except Exception as e:
            logger.debug(f"Jitsu track failed: {e}")


def track(event_name: str, user_id: str = "", properties: dict = None, context: dict = None) -> bool:
    """Trench (ana), başarısızsa Jitsu (yedek) - Fire and Forget"""
    props = properties or {}
    ctx = context or {}
    ts = datetime.now(timezone.utc).isoformat()
    
    # Asenkron bir task olarak çalıştır (ana uygulamayı tıkamasın)
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_async_track(event_name, user_id, props, ctx, ts))
    except RuntimeError:
        # Loop yoksa senkron çalışabilir ama fastapi de genelde loop olur
        pass
    
    return True


def get_backend() -> str:
    return "trench" if TRENCH_URL else ("jitsu" if JITSU_HOST else "none")
