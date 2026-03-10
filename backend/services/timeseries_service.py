"""
Time Series DB - ClickHouse (primary) + PostgreSQL (fallback)
Analitik olaylar, müzik dinleme, DAU, metrikler
"""
import os
import logging
import json
from typing import Optional, List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def track_event(event_type: str, user_id: str = "", properties: dict = None, country: str = "") -> bool:
    """ClickHouse (ana), başarısızsa PostgreSQL (yedek)"""
    props = json.dumps(properties or {})
    try:
        from services.clickhouse_service import track_event as ch_track
        ch_track(event_type, user_id, properties or {}, country=country)
        return True
    except Exception as e:
        logger.debug(f"ClickHouse track failed: {e}")

    try:
        import asyncio
        from services.postgresql_service import log_event
        asyncio.get_event_loop().run_until_complete(log_event(event_type, user_id, properties))
        return True
    except Exception as e:
        logger.debug(f"PostgreSQL track failed: {e}")
    return False


async def track_event_async(event_type: str, user_id: str = "", properties: dict = None) -> bool:
    """Async: ClickHouse (ana) -> PostgreSQL (yedek)"""
    try:
        from services.clickhouse_service import track_event as ch_track
        ch_track(event_type, user_id, properties or {})
        return True
    except Exception as e:
        logger.debug(f"CH track failed: {e}")

    try:
        from services.postgresql_service import log_event
        await log_event(event_type, user_id, properties)
        return True
    except Exception as e:
        logger.debug(f"PG track failed: {e}")
    return False


def get_top_tracks(days: int = 7, limit: int = 20, country: str = "") -> list:
    """ClickHouse (ana) -> PostgreSQL (yedek)"""
    try:
        from services.clickhouse_service import get_top_tracks as ch_top
        return ch_top(days, limit, country)
    except Exception as e:
        logger.debug(f"CH get_top_tracks failed: {e}")

    try:
        import asyncio
        from services.postgresql_service import query
        loop = asyncio.new_event_loop()
        rows = loop.run_until_complete(query(
            "SELECT event_type, COUNT(*) as cnt FROM analytics_events WHERE created_at > NOW() - make_interval(days => $1) GROUP BY event_type LIMIT $2",
            days, limit
        ))
        return [{"track_id": r.get("event_type"), "play_count": r.get("cnt", 0)} for r in rows] if rows else []
    except Exception:
        return []


def get_backend() -> str:
    try:
        from services.clickhouse_service import get_client
        return "clickhouse" if get_client() else "postgresql"
    except Exception:
        return "postgresql"
