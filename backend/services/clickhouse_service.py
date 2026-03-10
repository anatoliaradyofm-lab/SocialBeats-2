"""
ClickHouse Service - High-performance analytics database
Used for real-time analytics, event tracking, and metrics aggregation
Falls back gracefully if ClickHouse is not available
"""
import os
import logging
from typing import Optional, List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

CH_HOST = os.getenv("CLICKHOUSE_HOST", "localhost")
CH_PORT = int(os.getenv("CLICKHOUSE_PORT", "8123"))
CH_USER = os.getenv("CLICKHOUSE_USER", "default")
CH_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "")
CH_DB = os.getenv("CLICKHOUSE_DB", "socialbeats")

_client = None


def get_client():
    global _client
    if _client is not None:
        return _client
    try:
        import clickhouse_connect
        _client = clickhouse_connect.get_client(
            host=CH_HOST, port=CH_PORT,
            username=CH_USER, password=CH_PASSWORD,
            database=CH_DB, secure=(CH_PORT == 443)
        )
        logger.info("ClickHouse client connected")
        return _client
    except Exception as e:
        logger.info(f"ClickHouse not available: {e}")
        return None


def init_tables():
    client = get_client()
    if not client:
        return
    try:
        client.command("""
            CREATE TABLE IF NOT EXISTS event_log (
                event_id UUID DEFAULT generateUUIDv4(),
                event_type String,
                user_id String,
                properties String DEFAULT '{}',
                country String DEFAULT '',
                device String DEFAULT '',
                timestamp DateTime64(3) DEFAULT now64()
            ) ENGINE = MergeTree()
            ORDER BY (event_type, timestamp)
            PARTITION BY toYYYYMM(timestamp)
        """)
        client.command("""
            CREATE TABLE IF NOT EXISTS page_views (
                view_id UUID DEFAULT generateUUIDv4(),
                user_id String,
                page String,
                referrer String DEFAULT '',
                duration_ms UInt32 DEFAULT 0,
                country String DEFAULT '',
                timestamp DateTime64(3) DEFAULT now64()
            ) ENGINE = MergeTree()
            ORDER BY (page, timestamp)
            PARTITION BY toYYYYMM(timestamp)
        """)
        client.command("""
            CREATE TABLE IF NOT EXISTS music_plays (
                play_id UUID DEFAULT generateUUIDv4(),
                user_id String,
                track_id String,
                artist String DEFAULT '',
                genre String DEFAULT '',
                duration_ms UInt32 DEFAULT 0,
                source String DEFAULT '',
                country String DEFAULT '',
                timestamp DateTime64(3) DEFAULT now64()
            ) ENGINE = MergeTree()
            ORDER BY (track_id, timestamp)
            PARTITION BY toYYYYMM(timestamp)
        """)
        client.command("""
            CREATE TABLE IF NOT EXISTS post_likes_ch (
                like_id UUID DEFAULT generateUUIDv4(),
                post_id String,
                user_id String,
                reaction_type String DEFAULT 'heart',
                timestamp DateTime64(3) DEFAULT now64()
            ) ENGINE = MergeTree()
            ORDER BY (post_id, timestamp)
            PARTITION BY toYYYYMM(timestamp)
        """)
        client.command("""
            CREATE TABLE IF NOT EXISTS follower_events (
                event_id UUID DEFAULT generateUUIDv4(),
                user_id String,
                follower_id String,
                action String,
                timestamp DateTime64(3) DEFAULT now64()
            ) ENGINE = MergeTree()
            ORDER BY (user_id, timestamp)
            PARTITION BY toYYYYMM(timestamp)
        """)
        client.command("""
            CREATE TABLE IF NOT EXISTS view_events (
                view_id UUID DEFAULT generateUUIDv4(),
                view_type String,
                target_id String,
                user_id String,
                timestamp DateTime64(3) DEFAULT now64()
            ) ENGINE = MergeTree()
            ORDER BY (view_type, target_id, timestamp)
            PARTITION BY toYYYYMM(timestamp)
        """)
        client.command("""
            CREATE TABLE IF NOT EXISTS monthly_aggregated_stats (
                month Date,
                view_type String,
                total_views UInt64,
                unique_users UInt64
            ) ENGINE = MergeTree()
            ORDER BY (month, view_type)
        """)
        logger.info("ClickHouse tables initialized")
    except Exception as e:
        logger.warning(f"ClickHouse init error: {e}")


def track_event(event_type: str, user_id: str = "", properties: dict = None,
                country: str = "", device: str = ""):
    client = get_client()
    if not client:
        return
    try:
        import json
        client.insert("event_log", [[
            event_type, user_id, json.dumps(properties or {}),
            country, device, datetime.now(timezone.utc),
        ]], column_names=["event_type", "user_id", "properties", "country", "device", "timestamp"])
    except Exception as e:
        logger.debug(f"CH track_event error: {e}")


def track_music_play(user_id: str, track_id: str, artist: str = "",
                     genre: str = "", duration_ms: int = 0, source: str = "", country: str = ""):
    client = get_client()
    if not client:
        return
    try:
        client.insert("music_plays", [[
            user_id, track_id, artist, genre, duration_ms, source, country,
            datetime.now(timezone.utc),
        ]], column_names=["user_id", "track_id", "artist", "genre", "duration_ms", "source", "country", "timestamp"])
    except Exception as e:
        logger.debug(f"CH music_play error: {e}")


def get_top_tracks(days: int = 7, limit: int = 20, country: str = "") -> list:
    client = get_client()
    if not client:
        return []
    try:
        where = f"AND country = '{country}'" if country else ""
        result = client.query(f"""
            SELECT track_id, artist, count() as play_count
            FROM music_plays
            WHERE timestamp > now() - INTERVAL {days} DAY {where}
            GROUP BY track_id, artist
            ORDER BY play_count DESC
            LIMIT {limit}
        """)
        return [{"track_id": r[0], "artist": r[1], "play_count": r[2]} for r in result.result_rows]
    except Exception as e:
        logger.debug(f"CH get_top_tracks error: {e}")
        return []


def get_user_stats(user_id: str, days: int = 30) -> dict:
    client = get_client()
    if not client:
        return {}
    try:
        result = client.query(f"""
            SELECT
                count() as total_plays,
                sum(duration_ms) as total_duration_ms,
                uniq(track_id) as unique_tracks,
                topK(5)(artist) as top_artists,
                topK(5)(genre) as top_genres
            FROM music_plays
            WHERE user_id = '{user_id}' AND timestamp > now() - INTERVAL {days} DAY
        """)
        if result.result_rows:
            r = result.result_rows[0]
            return {
                "total_plays": r[0], "total_duration_ms": r[1],
                "unique_tracks": r[2], "top_artists": r[3], "top_genres": r[4],
            }
        return {}
    except Exception as e:
        logger.debug(f"CH user_stats error: {e}")
        return {}


def track_post_like(post_id: str, user_id: str, reaction_type: str = "heart"):
    client = get_client()
    if not client:
        return
    try:
        client.insert("post_likes_ch", [[post_id, user_id, reaction_type, datetime.now(timezone.utc)]],
                      column_names=["post_id", "user_id", "reaction_type", "timestamp"])
    except Exception as e:
        logger.debug(f"CH post_like error: {e}")


def track_follower_event(user_id: str, follower_id: str, action: str = "follow"):
    client = get_client()
    if not client:
        return
    try:
        client.insert("follower_events", [[user_id, follower_id, action, datetime.now(timezone.utc)]],
                      column_names=["user_id", "follower_id", "action", "timestamp"])
    except Exception as e:
        logger.debug(f"CH follower_event error: {e}")


def track_view_event(view_type: str, target_id: str, user_id: str = ""):
    client = get_client()
    if not client:
        return
    try:
        client.insert("view_events", [[view_type, target_id, user_id, datetime.now(timezone.utc)]],
                      column_names=["view_type", "target_id", "user_id", "timestamp"])
    except Exception as e:
        logger.debug(f"CH view_event error: {e}")


def get_post_like_count(post_id: str) -> int:
    client = get_client()
    if not client:
        return 0
    try:
        result = client.query(f"""
            SELECT count() FROM post_likes_ch WHERE post_id = '{post_id}'
        """)
        return result.result_rows[0][0] if result.result_rows else 0
    except Exception as e:
        logger.debug(f"CH post_like_count error: {e}")
        return 0


def get_most_liked_posts(post_ids: list = None, days: int = 30, limit: int = 10) -> list:
    client = get_client()
    if not client:
        return []
    try:
        where = ""
        if post_ids:
            ids_str = ",".join(f"'{x}'" for x in post_ids[:500])
            where = f"AND post_id IN ({ids_str})"
        result = client.query(f"""
            SELECT post_id, count() as like_count FROM post_likes_ch
            WHERE timestamp > now() - INTERVAL {days} DAY {where}
            GROUP BY post_id ORDER BY like_count DESC LIMIT {limit}
        """)
        return [{"post_id": r[0], "like_count": r[1]} for r in result.result_rows]
    except Exception as e:
        logger.debug(f"CH most_liked error: {e}")
        return []


def get_follower_delta(user_id: str, days: int = 7) -> dict:
    client = get_client()
    if not client:
        return {"gained": 0, "lost": 0}
    try:
        result = client.query(f"""
            SELECT action, count() FROM follower_events
            WHERE user_id = '{user_id}' AND timestamp > now() - INTERVAL {days} DAY
            GROUP BY action
        """)
        gained = lost = 0
        for r in result.result_rows:
            if r[0] == "follow":
                gained = r[1]
            elif r[0] == "unfollow":
                lost = r[1]
        return {"gained": gained, "lost": lost}
    except Exception as e:
        logger.debug(f"CH follower_delta error: {e}")
        return {"gained": 0, "lost": 0}


def get_active_hours(user_id: str, days: int = 30) -> list:
    client = get_client()
    if not client:
        return []
    try:
        result = client.query(f"""
            SELECT toHour(timestamp) as hour, count() as cnt
            FROM event_log WHERE user_id = '{user_id}' AND timestamp > now() - INTERVAL {days} DAY
            GROUP BY hour ORDER BY hour
        """)
        return [{"hour": r[0], "count": r[1]} for r in result.result_rows]
    except Exception as e:
        logger.debug(f"CH active_hours error: {e}")
        return []


def get_daily_active_users(days: int = 30) -> list:
    client = get_client()
    if not client:
        return []
    try:
        result = client.query(f"""
            SELECT toDate(timestamp) as day, uniq(user_id) as dau
            FROM event_log
            WHERE timestamp > now() - INTERVAL {days} DAY
            GROUP BY day ORDER BY day
        """)
        return [{"date": str(r[0]), "dau": r[1]} for r in result.result_rows]
    except Exception as e:
        logger.debug(f"CH DAU error: {e}")
        return []

def aggregate_monthly_stats():
    """Trench/ClickHouse sayfa görüntüleme istatistiklerini her ay oncesi icin sıkıstırıp arşivler."""
    client = get_client()
    if not client:
        return
    try:
        # Aggregation from view_events to monthly_aggregated_stats
        client.command("""
            INSERT INTO monthly_aggregated_stats
            SELECT
                toStartOfMonth(timestamp) as month,
                view_type,
                count() as total_views,
                uniq(user_id) as unique_users
            FROM view_events
            WHERE timestamp < toStartOfMonth(now())
            GROUP BY month, view_type
        """)
        # Cleanup original data older than 1 month to save storage
        client.command("""
            ALTER TABLE view_events DELETE WHERE timestamp < toStartOfMonth(now())
        """)
        logger.info("ClickHouse monthly aggregation completed successfully")
    except Exception as e:
        logger.error(f"ClickHouse aggregation error: {e}")
