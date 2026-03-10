"""
Analytics Service - Unified event tracking and aggregation
Trench + ClickHouse + Jitsu for real-time event tracking
MongoDB + PostgreSQL as primary data sources
"""
import os
import asyncio
import logging
from typing import Optional, Dict, List, Any
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)


async def track_event(event_name: str, user_id: str = "", properties: dict = None,
                      context: dict = None) -> None:
    """Track event to Trench + ClickHouse + Jitsu (fire-and-forget)"""
    props = properties or {}
    # Trench
    try:
        from services.trench_service import track, is_available
        if is_available():
            await track(event_name, user_id, props, context)
    except Exception as e:
        logger.debug(f"Trench track error: {e}")
    # ClickHouse
    try:
        from services.clickhouse_service import track_event as ch_track, get_client
        if get_client():
            ch_track(event_name, user_id, props)
    except Exception as e:
        logger.debug(f"ClickHouse track error: {e}")
    # Jitsu
    try:
        from services.jitsu_service import track as jitsu_track, is_available as jitsu_avail
        if jitsu_avail():
            await jitsu_track(event_name, user_id, props, context)
    except Exception as e:
        logger.debug(f"Jitsu track error: {e}")


async def track_music_play(user_id: str, track_id: str, artist: str = "",
                           genre: str = "", duration_ms: int = 0, source: str = "", country: str = "") -> None:
    """Track music play to Trench + ClickHouse + Jitsu"""
    await track_event("track_played", user_id, {
        "track_id": track_id, "artist": artist, "genre": genre,
        "duration_ms": duration_ms, "source": source,
    })
    try:
        from services.clickhouse_service import track_music_play as ch_play, get_client
        if get_client():
            ch_play(user_id, track_id, artist, genre, duration_ms, source, country)
    except Exception as e:
        logger.debug(f"CH music_play error: {e}")


async def track_post_like(post_id: str, user_id: str, reaction_type: str = "heart") -> None:
    """Track post like - Trench + ClickHouse"""
    await track_event("post_like", user_id, {"post_id": post_id, "reaction_type": reaction_type})
    try:
        from services.clickhouse_service import track_post_like as ch_like, get_client
        if get_client():
            ch_like(post_id, user_id, reaction_type)
    except Exception as e:
        logger.debug(f"CH post_like error: {e}")


async def track_view(event_type: str, user_id: str = "", target_id: str = "",
                     target_type: str = "post", properties: dict = None) -> None:
    """Track view (post, story, profile) - Trench + Jitsu + ClickHouse"""
    props = (properties or {}) | {"target_id": target_id, "target_type": target_type}
    await track_event(event_type, user_id, props)
    try:
        from services.jitsu_service import track as jitsu_track, is_available
        if is_available():
            await jitsu_track(event_type, user_id, props)
    except Exception as e:
        logger.debug(f"Jitsu view track error: {e}")
    try:
        from services.clickhouse_service import track_view_event, get_client
        if get_client() and target_id:
            track_view_event(target_type, target_id, user_id)
    except Exception as e:
        logger.debug(f"CH view_event error: {e}")


async def track_follower_change(user_id: str, follower_id: str, action: str = "follow") -> None:
    """Track follower add/remove - Trench + ClickHouse"""
    await track_event("follower_change", user_id, {"follower_id": follower_id, "action": action})
    try:
        from services.clickhouse_service import track_follower_event, get_client
        if get_client():
            track_follower_event(user_id, follower_id, action)
    except Exception as e:
        logger.debug(f"CH follower_event error: {e}")


# --- Aggregation helpers ---

async def get_total_listening_time(user_id: str, days: int = 30) -> int:
    """Toplam dinleme süresi (ms) - ClickHouse primary"""
    try:
        from services.clickhouse_service import get_client, get_user_stats
        if get_client():
            stats = get_user_stats(user_id, days)
            return stats.get("total_duration_ms", 0)
    except Exception as e:
        logger.debug(f"CH total_listening error: {e}")
    return 0


async def get_top_artists(user_id: str, days: int = 30, limit: int = 10) -> List[Dict]:
    """En çok dinlenen sanatçı - ClickHouse"""
    try:
        from services.clickhouse_service import get_client, get_user_stats
        if get_client():
            stats = get_user_stats(user_id, days)
            artists = stats.get("top_artists", []) or []
            return [{"artist": a, "rank": i + 1} for i, a in enumerate(artists[:limit])]
    except Exception as e:
        logger.debug(f"CH top_artists error: {e}")
    return []


async def get_top_genres(user_id: str, days: int = 30, limit: int = 10) -> List[Dict]:
    """En çok dinlenen tür - ClickHouse"""
    try:
        from services.clickhouse_service import get_client, get_user_stats
        if get_client():
            stats = get_user_stats(user_id, days)
            genres = stats.get("top_genres", []) or []
            return [{"genre": g, "rank": i + 1} for i, g in enumerate(genres[:limit])]
    except Exception as e:
        logger.debug(f"CH top_genres error: {e}")
    return []


async def get_post_like_counts(post_ids: List[str]) -> Dict[str, int]:
    """Anlık beğeni sayıları - ClickHouse"""
    result = {}
    try:
        from services.clickhouse_service import get_client, get_post_like_count
        if get_client():
            for pid in post_ids:
                result[pid] = get_post_like_count(pid)
    except Exception as e:
        logger.debug(f"CH post_like_counts error: {e}")
    return result


async def get_most_liked_post(user_id: str, post_ids: list = None, days: int = 30) -> Optional[Dict]:
    """En çok beğeni alan gönderi - ClickHouse (post_ids opsiyonel, yoksa tüm postlar)"""
    try:
        from services.clickhouse_service import get_client, get_most_liked_posts
        if get_client():
            rows = get_most_liked_posts(post_ids or [], days, 1)
            if rows:
                return rows[0]
    except Exception as e:
        logger.debug(f"CH most_liked error: {e}")
    return None


async def get_follower_delta(user_id: str, days: int = 7) -> Dict[str, int]:
    """Takipçi kaybı/kazanımı - ClickHouse"""
    try:
        from services.clickhouse_service import get_client, get_follower_delta as ch_delta
        if get_client():
            return ch_delta(user_id, days)
    except Exception as e:
        logger.debug(f"CH follower_delta error: {e}")
    return {"gained": 0, "lost": 0}


async def get_active_hours(user_id: str, days: int = 30) -> List[Dict]:
    """En aktif saatler - ClickHouse"""
    try:
        from services.clickhouse_service import get_client, get_active_hours as ch_hours
        if get_client():
            return ch_hours(user_id, days)
    except Exception as e:
        logger.debug(f"CH active_hours error: {e}")
    return []


async def get_monthly_report_url() -> Optional[str]:
    """Aylık dinleme raporu - Grafana dashboard URL"""
    try:
        from services.grafana_service import is_available, GRAFANA_URL
        if is_available() and GRAFANA_URL:
            return f"{GRAFANA_URL}/d/socialbeats-overview"
    except Exception:
        pass
    return None


async def get_yearly_summary(user_id: str, year: int = None) -> Dict:
    """Yıllık özet (Spotify Wrapped) - Trench + ClickHouse + Gemini"""
    from datetime import datetime
    y = year or datetime.now().year
    data = {
        "year": y,
        "total_listening_ms": await get_total_listening_time(user_id, days=365),
        "top_artists": await get_top_artists(user_id, days=365, limit=5),
        "top_genres": await get_top_genres(user_id, days=365, limit=5),
        "ai_summary": None,
    }
    try:
        import os
        gemini_key = os.getenv("GEMINI_API_KEY", "")
        if gemini_key:
            import httpx
            text = f"Kullanıcının {y} yılı verileri: Toplam dinleme {data['total_listening_ms']//60000} dk, en çok dinlenen sanatçılar {[a['artist'] for a in data['top_artists']]}, türler {[g['genre'] for g in data['top_genres']]}. 2 cümleyle yıllık özet yaz."
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}",
                    json={"contents": [{"parts": [{"text": text}]}]},
                )
                if resp.status_code == 200:
                    j = resp.json()
                    data["ai_summary"] = j.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    except Exception as e:
        logger.debug(f"Gemini yearly summary error: {e}")
    return data


async def prepare_weekly_summary(user_id: str) -> Dict:
    """Haftalık özet verisi - Trench + ClickHouse (Expo push için kullanılacak)"""
    data = {
        "total_listening_ms": await get_total_listening_time(user_id, days=7),
        "top_artists": await get_top_artists(user_id, days=7, limit=3),
    }
    mins = (data.get("total_listening_ms") or 0) // 60000
    artists = ", ".join(a.get("artist", "") for a in (data.get("top_artists") or [])[:2]) or "yok"
    return {
        "title": "Haftalık Dinleme Özetin",
        "body": f"Bu hafta {mins} dakika dinledin. En çok dinlenen: {artists}.",
        "data": data,
    }
