"""
Jitsu Service - Open-source data ingestion engine
Server-side event tracking, user identification, and data pipeline
Alternative to Segment for collecting and routing analytics data
"""
import os
import logging
from typing import Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

JITSU_HOST = os.getenv("JITSU_HOST", "")
JITSU_WRITE_KEY = os.getenv("JITSU_WRITE_KEY", "")
JITSU_SERVER_TOKEN = os.getenv("JITSU_SERVER_TOKEN", "")


def is_available() -> bool:
    return bool(JITSU_HOST and (JITSU_WRITE_KEY or JITSU_SERVER_TOKEN))


async def track(event_name: str, user_id: str = "", properties: dict = None,
                context: dict = None) -> bool:
    """Send a track event to Jitsu"""
    if not is_available():
        return False
    try:
        import httpx
        payload = {
            "type": "track",
            "event": event_name,
            "userId": user_id,
            "properties": properties or {},
            "context": context or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "writeKey": JITSU_WRITE_KEY,
        }
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(
                f"{JITSU_HOST}/api/s/s2s/track",
                json=payload,
                headers={"X-Auth-Token": JITSU_SERVER_TOKEN} if JITSU_SERVER_TOKEN else {},
            )
            return resp.status_code in (200, 201, 202)
    except Exception as e:
        logger.debug(f"Jitsu track error: {e}")
        return False


async def identify(user_id: str, traits: dict = None) -> bool:
    """Identify a user in Jitsu"""
    if not is_available():
        return False
    try:
        import httpx
        payload = {
            "type": "identify",
            "userId": user_id,
            "traits": traits or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "writeKey": JITSU_WRITE_KEY,
        }
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(
                f"{JITSU_HOST}/api/s/s2s/identify",
                json=payload,
                headers={"X-Auth-Token": JITSU_SERVER_TOKEN} if JITSU_SERVER_TOKEN else {},
            )
            return resp.status_code in (200, 201, 202)
    except Exception as e:
        logger.debug(f"Jitsu identify error: {e}")
        return False


async def page(user_id: str = "", page_name: str = "", url: str = "",
               referrer: str = "", properties: dict = None) -> bool:
    """Track a page view in Jitsu"""
    if not is_available():
        return False
    try:
        import httpx
        payload = {
            "type": "page",
            "userId": user_id,
            "name": page_name,
            "properties": {"url": url, "referrer": referrer, **(properties or {})},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "writeKey": JITSU_WRITE_KEY,
        }
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(
                f"{JITSU_HOST}/api/s/s2s/page",
                json=payload,
                headers={"X-Auth-Token": JITSU_SERVER_TOKEN} if JITSU_SERVER_TOKEN else {},
            )
            return resp.status_code in (200, 201, 202)
    except Exception as e:
        logger.debug(f"Jitsu page error: {e}")
        return False


async def batch_events(events: list) -> bool:
    """Send a batch of events to Jitsu"""
    if not is_available() or not events:
        return False
    try:
        import httpx
        payload = {
            "batch": events,
            "writeKey": JITSU_WRITE_KEY,
        }
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{JITSU_HOST}/api/s/s2s/batch",
                json=payload,
                headers={"X-Auth-Token": JITSU_SERVER_TOKEN} if JITSU_SERVER_TOKEN else {},
            )
            return resp.status_code in (200, 201, 202)
    except Exception as e:
        logger.debug(f"Jitsu batch error: {e}")
        return False


def get_client_config() -> dict:
    """Get Jitsu client configuration for frontend"""
    return {
        "host": JITSU_HOST or None,
        "writeKey": JITSU_WRITE_KEY or None,
        "available": is_available(),
    }
