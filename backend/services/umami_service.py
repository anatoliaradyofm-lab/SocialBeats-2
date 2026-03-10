"""
Umami Service - Open-source web analytics (privacy-focused)
Tracks page views, events, and user behavior without cookies
Self-hostable alternative to Google Analytics
"""
import os
import logging
from typing import Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

UMAMI_URL = os.getenv("UMAMI_URL", "")
UMAMI_WEBSITE_ID = os.getenv("UMAMI_WEBSITE_ID", "")
UMAMI_API_TOKEN = os.getenv("UMAMI_API_TOKEN", "")
UMAMI_USERNAME = os.getenv("UMAMI_USERNAME", "admin")
UMAMI_PASSWORD = os.getenv("UMAMI_PASSWORD", "")

_token = None


async def _get_token() -> Optional[str]:
    global _token
    if _token:
        return _token
    if UMAMI_API_TOKEN:
        _token = UMAMI_API_TOKEN
        return _token
    if not UMAMI_URL or not UMAMI_PASSWORD:
        return None
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(f"{UMAMI_URL}/api/auth/login", json={
                "username": UMAMI_USERNAME, "password": UMAMI_PASSWORD,
            })
            if resp.status_code == 200:
                data = resp.json()
                _token = data.get("token")
                return _token
    except Exception as e:
        logger.debug(f"Umami auth error: {e}")
    return None


async def track_event(event_name: str, event_data: dict = None,
                      url: str = "/", user_agent: str = "", language: str = "en"):
    """Track a custom event"""
    if not UMAMI_URL or not UMAMI_WEBSITE_ID:
        return
    try:
        import httpx
        payload = {
            "payload": {
                "website": UMAMI_WEBSITE_ID,
                "url": url,
                "name": event_name,
                "data": event_data or {},
                "language": language,
            },
            "type": "event",
        }
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(f"{UMAMI_URL}/api/send", json=payload,
                              headers={"User-Agent": user_agent or "SocialBeats/1.0"})
    except Exception as e:
        logger.debug(f"Umami track error: {e}")


async def track_pageview(url: str, referrer: str = "", user_agent: str = "", language: str = "en"):
    """Track a page view"""
    if not UMAMI_URL or not UMAMI_WEBSITE_ID:
        return
    try:
        import httpx
        payload = {
            "payload": {
                "website": UMAMI_WEBSITE_ID,
                "url": url,
                "referrer": referrer,
                "language": language,
            },
            "type": "event",
        }
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(f"{UMAMI_URL}/api/send", json=payload,
                              headers={"User-Agent": user_agent or "SocialBeats/1.0"})
    except Exception as e:
        logger.debug(f"Umami pageview error: {e}")


async def get_stats(start_date: str = None, end_date: str = None) -> dict:
    """Get website statistics from Umami"""
    token = await _get_token()
    if not token or not UMAMI_URL:
        return {}
    try:
        import httpx
        now = datetime.now(timezone.utc)
        if not start_date:
            start_ms = int((now.replace(day=1, hour=0, minute=0, second=0)).timestamp() * 1000)
        else:
            start_ms = int(datetime.fromisoformat(start_date).timestamp() * 1000)
        end_ms = int(now.timestamp() * 1000)

        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{UMAMI_URL}/api/websites/{UMAMI_WEBSITE_ID}/stats",
                params={"startAt": start_ms, "endAt": end_ms},
                headers=headers,
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        logger.debug(f"Umami stats error: {e}")
    return {}


async def get_active_users() -> int:
    """Get current active users count"""
    token = await _get_token()
    if not token or not UMAMI_URL:
        return 0
    try:
        import httpx
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{UMAMI_URL}/api/websites/{UMAMI_WEBSITE_ID}/active",
                headers=headers,
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("x", 0) if isinstance(data, dict) else 0
    except Exception as e:
        logger.debug(f"Umami active users error: {e}")
    return 0


def get_tracking_script() -> str:
    """Get the Umami tracking script tag for web views"""
    if not UMAMI_URL or not UMAMI_WEBSITE_ID:
        return ""
    return f'<script async src="{UMAMI_URL}/script.js" data-website-id="{UMAMI_WEBSITE_ID}"></script>'
