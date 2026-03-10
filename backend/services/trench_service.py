"""
Trench Service - Open-source event tracking and analytics pipeline
Lightweight alternative to Segment/Mixpanel for event ingestion
Supports real-time event streaming and batch processing
"""
import os
import logging
from typing import Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

TRENCH_URL = os.getenv("TRENCH_URL", "")
TRENCH_API_KEY = os.getenv("TRENCH_API_KEY", "")
TRENCH_PUBLIC_KEY = os.getenv("TRENCH_PUBLIC_KEY", "")


def is_available() -> bool:
    return bool(TRENCH_URL)


async def track(event_name: str, user_id: str = "", properties: dict = None,
                context: dict = None) -> bool:
    """Track an event through Trench"""
    if not is_available():
        return False
    try:
        import httpx
        payload = {
            "events": [{
                "type": "track",
                "event": event_name,
                "userId": user_id,
                "properties": properties or {},
                "context": context or {},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }]
        }
        headers = {"Content-Type": "application/json"}
        if TRENCH_API_KEY:
            headers["Authorization"] = f"Bearer {TRENCH_API_KEY}"

        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(f"{TRENCH_URL}/api/events", json=payload, headers=headers)
            return resp.status_code in (200, 201, 202)
    except Exception as e:
        logger.debug(f"Trench track error: {e}")
        return False


async def identify(user_id: str, traits: dict = None) -> bool:
    """Identify a user with traits"""
    if not is_available():
        return False
    try:
        import httpx
        payload = {
            "events": [{
                "type": "identify",
                "userId": user_id,
                "traits": traits or {},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }]
        }
        headers = {"Content-Type": "application/json"}
        if TRENCH_API_KEY:
            headers["Authorization"] = f"Bearer {TRENCH_API_KEY}"

        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(f"{TRENCH_URL}/api/events", json=payload, headers=headers)
            return resp.status_code in (200, 201, 202)
    except Exception as e:
        logger.debug(f"Trench identify error: {e}")
        return False


async def page_view(user_id: str = "", page: str = "", referrer: str = "",
                    properties: dict = None) -> bool:
    """Track a page view"""
    if not is_available():
        return False
    try:
        import httpx
        payload = {
            "events": [{
                "type": "page",
                "userId": user_id,
                "properties": {
                    "url": page,
                    "referrer": referrer,
                    **(properties or {}),
                },
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }]
        }
        headers = {"Content-Type": "application/json"}
        if TRENCH_API_KEY:
            headers["Authorization"] = f"Bearer {TRENCH_API_KEY}"

        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(f"{TRENCH_URL}/api/events", json=payload, headers=headers)
            return resp.status_code in (200, 201, 202)
    except Exception as e:
        logger.debug(f"Trench page error: {e}")
        return False


async def query_events(event_name: str = "", user_id: str = "",
                       start_date: str = None, limit: int = 100) -> list:
    """Query events from Trench"""
    if not is_available():
        return []
    try:
        import httpx
        params = {"limit": limit}
        if event_name:
            params["event"] = event_name
        if user_id:
            params["userId"] = user_id
        if start_date:
            params["startDate"] = start_date

        headers = {}
        if TRENCH_API_KEY:
            headers["Authorization"] = f"Bearer {TRENCH_API_KEY}"

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{TRENCH_URL}/api/events", params=params, headers=headers)
            if resp.status_code == 200:
                return resp.json().get("events", [])
    except Exception as e:
        logger.debug(f"Trench query error: {e}")
    return []


def get_status() -> dict:
    return {
        "available": is_available(),
        "url": TRENCH_URL[:30] + "..." if TRENCH_URL else None,
    }
