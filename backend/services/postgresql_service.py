"""
PostgreSQL Service - Relational data storage for structured data
Uses asyncpg for async operations, SQLAlchemy for ORM
Falls back gracefully if PostgreSQL is not available
"""
import os
import logging
from typing import Optional, Any

logger = logging.getLogger(__name__)

PG_URL = os.getenv("POSTGRES_URL", os.getenv("DATABASE_URL", ""))
_pool = None
_engine = None


async def get_pool():
    global _pool
    if _pool is not None:
        return _pool
    if not PG_URL:
        logger.info("PostgreSQL URL not configured, skipping")
        return None
    try:
        import asyncpg
        _pool = await asyncpg.create_pool(
            PG_URL,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
        logger.info("PostgreSQL connection pool created")
        return _pool
    except Exception as e:
        logger.warning(f"PostgreSQL connection failed: {e}")
        return None


async def init_tables():
    pool = await get_pool()
    if not pool:
        return
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS analytics_events (
                id BIGSERIAL PRIMARY KEY,
                event_type VARCHAR(100) NOT NULL,
                user_id VARCHAR(100),
                data JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS user_sessions (
                id BIGSERIAL PRIMARY KEY,
                user_id VARCHAR(100) NOT NULL,
                token_hash VARCHAR(255),
                device_info JSONB DEFAULT '{}',
                ip_address VARCHAR(45),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                expires_at TIMESTAMPTZ,
                is_active BOOLEAN DEFAULT TRUE
            );
            CREATE TABLE IF NOT EXISTS audit_log (
                id BIGSERIAL PRIMARY KEY,
                user_id VARCHAR(100),
                action VARCHAR(100) NOT NULL,
                resource_type VARCHAR(50),
                resource_id VARCHAR(100),
                details JSONB DEFAULT '{}',
                ip_address VARCHAR(45),
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id);
            CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
            CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);
            CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);

            CREATE TABLE IF NOT EXISTS profiles (
                id VARCHAR(100) PRIMARY KEY,
                user_id VARCHAR(100) UNIQUE NOT NULL,
                username VARCHAR(100) UNIQUE NOT NULL,
                full_name VARCHAR(200),
                bio TEXT,
                avatar_url TEXT,
                cover_url TEXT,
                is_private BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS followers (
                id BIGSERIAL PRIMARY KEY,
                follower_id VARCHAR(100) NOT NULL,
                following_id VARCHAR(100) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(follower_id, following_id)
            );
            CREATE TABLE IF NOT EXISTS blocked_users (
                id BIGSERIAL PRIMARY KEY,
                blocker_id VARCHAR(100) NOT NULL,
                blocked_id VARCHAR(100) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(blocker_id, blocked_id)
            );
            CREATE TABLE IF NOT EXISTS close_friends (
                id BIGSERIAL PRIMARY KEY,
                user_id VARCHAR(100) NOT NULL,
                friend_id VARCHAR(100) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, friend_id)
            );
            CREATE TABLE IF NOT EXISTS playlists (
                id VARCHAR(100) PRIMARY KEY,
                owner_id VARCHAR(100) NOT NULL,
                title VARCHAR(200) NOT NULL,
                description TEXT,
                is_public BOOLEAN DEFAULT TRUE,
                is_collaborative BOOLEAN DEFAULT FALSE,
                cover_url TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS playlist_tracks (
                id BIGSERIAL PRIMARY KEY,
                playlist_id VARCHAR(100) NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
                track_id VARCHAR(100) NOT NULL,
                position INT NOT NULL,
                added_at TIMESTAMPTZ DEFAULT NOW(),
                added_by VARCHAR(100)
            );
            CREATE TABLE IF NOT EXISTS playlist_collaborators (
                id BIGSERIAL PRIMARY KEY,
                playlist_id VARCHAR(100) NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
                user_id VARCHAR(100) NOT NULL,
                role VARCHAR(20) DEFAULT 'editor',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(playlist_id, user_id)
            );

            CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
            CREATE INDEX IF NOT EXISTS idx_followers_follower ON followers(follower_id);
            CREATE INDEX IF NOT EXISTS idx_followers_following ON followers(following_id);
            CREATE INDEX IF NOT EXISTS idx_blocked_blocker ON blocked_users(blocker_id);
            CREATE INDEX IF NOT EXISTS idx_close_friends_user ON close_friends(user_id);
            CREATE INDEX IF NOT EXISTS idx_playlists_owner ON playlists(owner_id);

            CREATE TABLE IF NOT EXISTS posts_pg (
                id VARCHAR(100) PRIMARY KEY,
                user_id VARCHAR(100) NOT NULL,
                content TEXT,
                media_urls JSONB DEFAULT '[]',
                location_name VARCHAR(200),
                latitude DECIMAL(10,7),
                longitude DECIMAL(10,7),
                country_code VARCHAR(3),
                mentions JSONB DEFAULT '[]',
                hashtags JSONB DEFAULT '[]',
                visibility VARCHAR(20) DEFAULT 'public',
                allow_comments BOOLEAN DEFAULT TRUE,
                is_pinned BOOLEAN DEFAULT FALSE,
                repost_of VARCHAR(100),
                views_count INT DEFAULT 0,
                likes_count INT DEFAULT 0,
                comments_count INT DEFAULT 0,
                reposts_count INT DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS post_likes_pg (
                id BIGSERIAL PRIMARY KEY,
                post_id VARCHAR(100) NOT NULL,
                user_id VARCHAR(100) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(post_id, user_id)
            );
            CREATE TABLE IF NOT EXISTS post_comments_pg (
                id VARCHAR(100) PRIMARY KEY,
                post_id VARCHAR(100) NOT NULL,
                user_id VARCHAR(100) NOT NULL,
                content TEXT NOT NULL,
                parent_id VARCHAR(100),
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS post_reposts_pg (
                id VARCHAR(100) PRIMARY KEY,
                post_id VARCHAR(100) NOT NULL,
                user_id VARCHAR(100) NOT NULL,
                comment TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(post_id, user_id)
            );
            CREATE TABLE IF NOT EXISTS post_views_pg (
                id BIGSERIAL PRIMARY KEY,
                post_id VARCHAR(100) NOT NULL,
                user_id VARCHAR(100),
                viewed_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_posts_pg_user ON posts_pg(user_id);
            CREATE INDEX IF NOT EXISTS idx_posts_pg_created ON posts_pg(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_posts_pg_repost ON posts_pg(repost_of);
            CREATE INDEX IF NOT EXISTS idx_post_likes_pg_post ON post_likes_pg(post_id);
            CREATE INDEX IF NOT EXISTS idx_post_comments_pg_post ON post_comments_pg(post_id);
            CREATE INDEX IF NOT EXISTS idx_post_reposts_pg_post ON post_reposts_pg(post_id);

            CREATE TABLE IF NOT EXISTS search_history (
                id BIGSERIAL PRIMARY KEY,
                user_id VARCHAR(100) NOT NULL,
                query VARCHAR(500) NOT NULL,
                search_type VARCHAR(50) DEFAULT 'all',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, query)
            );
            CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);
            CREATE INDEX IF NOT EXISTS idx_search_history_created ON search_history(created_at DESC);

            CREATE TABLE IF NOT EXISTS user_levels (
                user_id VARCHAR(100) PRIMARY KEY,
                xp INT DEFAULT 0,
                level INT DEFAULT 1,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS badges (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                icon_url TEXT
            );
            CREATE TABLE IF NOT EXISTS user_badges (
                id BIGSERIAL PRIMARY KEY,
                user_id VARCHAR(100) NOT NULL,
                badge_id VARCHAR(50) NOT NULL REFERENCES badges(id),
                earned_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, badge_id)
            );
            CREATE TABLE IF NOT EXISTS achievements (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                xp_reward INT DEFAULT 0,
                criteria VARCHAR(200)
            );
            CREATE TABLE IF NOT EXISTS user_achievements (
                id BIGSERIAL PRIMARY KEY,
                user_id VARCHAR(100) NOT NULL,
                achievement_id VARCHAR(50) NOT NULL REFERENCES achievements(id),
                earned_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, achievement_id)
            );
            CREATE TABLE IF NOT EXISTS follower_demographics (
                id BIGSERIAL PRIMARY KEY,
                user_id VARCHAR(100) NOT NULL,
                country_code VARCHAR(3),
                age_bucket VARCHAR(20),
                count INT DEFAULT 1,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_user_levels_xp ON user_levels(xp DESC);
            CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
            CREATE INDEX IF NOT EXISTS idx_follower_demographics_user ON follower_demographics(user_id);

            CREATE TABLE IF NOT EXISTS notifications_pg (
                id VARCHAR(100) PRIMARY KEY,
                user_id VARCHAR(100) NOT NULL,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(500),
                body TEXT,
                data JSONB DEFAULT '{}',
                sender_id VARCHAR(100),
                is_read BOOLEAN DEFAULT FALSE,
                read_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS notification_preferences_pg (
                user_id VARCHAR(100) PRIMARY KEY,
                push_enabled BOOLEAN DEFAULT TRUE,
                like_notifications BOOLEAN DEFAULT TRUE,
                comment_notifications BOOLEAN DEFAULT TRUE,
                follow_notifications BOOLEAN DEFAULT TRUE,
                message_notifications BOOLEAN DEFAULT TRUE,
                tag_notifications BOOLEAN DEFAULT TRUE,
                new_content_notifications BOOLEAN DEFAULT TRUE,
                weekly_summary_enabled BOOLEAN DEFAULT TRUE,
                notification_sound VARCHAR(100) DEFAULT 'default',
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS dnd_settings_pg (
                user_id VARCHAR(100) PRIMARY KEY,
                enabled BOOLEAN DEFAULT FALSE,
                start_time VARCHAR(10) DEFAULT '22:00',
                end_time VARCHAR(10) DEFAULT '08:00',
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_notifications_pg_user ON notifications_pg(user_id);
            CREATE INDEX IF NOT EXISTS idx_notifications_pg_created ON notifications_pg(created_at DESC);

            CREATE TABLE IF NOT EXISTS linked_accounts_pg (
                id VARCHAR(100) PRIMARY KEY,
                owner_id VARCHAR(100) NOT NULL,
                linked_user_id VARCHAR(100) NOT NULL,
                provider VARCHAR(50) DEFAULT 'credentials',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(owner_id, linked_user_id)
            );
            CREATE INDEX IF NOT EXISTS idx_linked_accounts_owner ON linked_accounts_pg(owner_id);

            CREATE TABLE IF NOT EXISTS user_settings_pg (
                user_id VARCHAR(100) PRIMARY KEY,
                theme VARCHAR(50) DEFAULT 'dark',
                profile_theme VARCHAR(50) DEFAULT 'default',
                locale VARCHAR(20) DEFAULT 'tr',
                music_quality VARCHAR(20) DEFAULT 'high',
                timezone VARCHAR(50) DEFAULT 'UTC',
                currency VARCHAR(10) DEFAULT 'USD',
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            DO $$ BEGIN
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='user_settings_pg' AND column_name='timezone') THEN
                ALTER TABLE user_settings_pg ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC';
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='user_settings_pg' AND column_name='currency') THEN
                ALTER TABLE user_settings_pg ADD COLUMN currency VARCHAR(10) DEFAULT 'USD';
              END IF;
            END $$;
            CREATE TABLE IF NOT EXISTS privacy_settings_pg (
                user_id VARCHAR(100) PRIMARY KEY,
                profile_visible BOOLEAN DEFAULT TRUE,
                show_activity_status BOOLEAN DEFAULT TRUE,
                allow_messages_from VARCHAR(30) DEFAULT 'everyone',
                show_listening_activity BOOLEAN DEFAULT TRUE,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS referral_codes_pg (
                user_id VARCHAR(100) PRIMARY KEY,
                code VARCHAR(32) UNIQUE NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS referral_tracking_pg (
                id BIGSERIAL PRIMARY KEY,
                referrer_id VARCHAR(100) NOT NULL,
                referred_id VARCHAR(100) NOT NULL,
                code VARCHAR(32) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(referred_id)
            );
            CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes_pg(code);
            CREATE INDEX IF NOT EXISTS idx_referral_tracking_referrer ON referral_tracking_pg(referrer_id);
        """)
        logger.info("PostgreSQL tables initialized")


async def log_event(event_type: str, user_id: str = None, data: dict = None):
    pool = await get_pool()
    if not pool:
        return
    try:
        import json
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO analytics_events (event_type, user_id, data) VALUES ($1, $2, $3)",
                event_type, user_id, json.dumps(data or {}),
            )
    except Exception as e:
        logger.debug(f"PG log_event error: {e}")


async def create_session(user_id: str, token_hash: str, device_info: dict = None, ip: str = None):
    pool = await get_pool()
    if not pool:
        return None
    try:
        import json
        from datetime import datetime, timezone, timedelta
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """INSERT INTO user_sessions (user_id, token_hash, device_info, ip_address, expires_at)
                   VALUES ($1, $2, $3, $4, $5) RETURNING id""",
                user_id, token_hash, json.dumps(device_info or {}), ip,
                datetime.now(timezone.utc) + timedelta(days=30),
            )
            return row["id"] if row else None
    except Exception as e:
        logger.debug(f"PG create_session error: {e}")
        return None


async def log_audit(user_id: str, action: str, resource_type: str = None,
                    resource_id: str = None, details: dict = None, ip: str = None):
    pool = await get_pool()
    if not pool:
        return
    try:
        import json
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, ip_address)
                   VALUES ($1, $2, $3, $4, $5, $6)""",
                user_id, action, resource_type, resource_id, json.dumps(details or {}), ip,
            )
    except Exception as e:
        logger.debug(f"PG audit error: {e}")


async def query(sql: str, *args) -> list:
    pool = await get_pool()
    if not pool:
        return []
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, *args)
            return [dict(r) for r in rows]
    except Exception as e:
        logger.debug(f"PG query error: {e}")
        return []


async def add_search_history_pg(user_id: str, query: str, search_type: str = "all") -> bool:
    """Add or update search history in PostgreSQL (sync with MMKV/mobile)"""
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO search_history (user_id, query, search_type)
                   VALUES ($1, $2, $3)
                   ON CONFLICT (user_id, query) DO UPDATE SET created_at = NOW()""",
                user_id, (query or "")[:500], search_type,
            )
        return True
    except Exception as e:
        logger.debug(f"PG add_search_history error: {e}")
        return False


async def get_user_level_pg(user_id: str) -> dict:
    pool = await get_pool()
    if not pool:
        return {"xp": 0, "level": 1}
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT xp, level FROM user_levels WHERE user_id = $1", user_id
            )
            if row:
                return {"xp": row["xp"], "level": row["level"]}
    except Exception as e:
        logger.debug(f"PG get_user_level error: {e}")
    return {"xp": 0, "level": 1}


async def add_xp_pg(user_id: str, amount: int) -> None:
    pool = await get_pool()
    if not pool:
        return
    try:
        XP_PER_LEVEL = 100
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT xp, level FROM user_levels WHERE user_id = $1", user_id
            )
            xp = (row["xp"] if row else 0) + amount
            level = (row["level"] if row else 1)
            while xp >= level * XP_PER_LEVEL:
                level += 1
            await conn.execute(
                """INSERT INTO user_levels (user_id, xp, level, updated_at)
                   VALUES ($1, $2, $3, NOW())
                   ON CONFLICT (user_id) DO UPDATE SET xp = $2, level = $3, updated_at = NOW()""",
                user_id, xp, level,
            )
    except Exception as e:
        logger.debug(f"PG add_xp error: {e}")


async def get_user_badges_pg(user_id: str) -> list:
    pool = await get_pool()
    if not pool:
        return []
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT b.id, b.name, b.description, b.icon_url, ub.earned_at
                   FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
                   WHERE ub.user_id = $1 ORDER BY ub.earned_at DESC""",
                user_id,
            )
            return [dict(r) for r in rows]
    except Exception as e:
        logger.debug(f"PG get_user_badges error: {e}")
        return []


async def get_user_achievements_pg(user_id: str) -> list:
    pool = await get_pool()
    if not pool:
        return []
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT a.id, a.name, a.description, a.xp_reward, ua.earned_at
                   FROM user_achievements ua JOIN achievements a ON a.id = ua.achievement_id
                   WHERE ua.user_id = $1 ORDER BY ua.earned_at DESC""",
                user_id,
            )
            return [dict(r) for r in rows]
    except Exception as e:
        logger.debug(f"PG get_user_achievements error: {e}")
        return []


async def insert_notification_pg(notif_id: str, user_id: str, notif_type: str, title: str,
                                   body: str, data: dict = None, sender_id: str = None) -> bool:
    pool = await get_pool()
    if not pool:
        return False
    try:
        import json
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO notifications_pg (id, user_id, type, title, body, data, sender_id)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)""",
                notif_id, user_id, notif_type, (title or "")[:500], body or "",
                json.dumps(data or {}), sender_id,
            )
        return True
    except Exception as e:
        logger.debug(f"PG insert_notification error: {e}")
        return False


async def mark_notification_read_pg(notif_id: str, user_id: str) -> bool:
    pool = await get_pool()
    if not pool:
        return False
    try:
        from datetime import datetime, timezone
        async with pool.acquire() as conn:
            await conn.execute(
                """UPDATE notifications_pg SET is_read = TRUE, read_at = $1
                   WHERE id = $2 AND user_id = $3""",
                datetime.now(timezone.utc), notif_id, user_id,
            )
        return True
    except Exception as e:
        logger.debug(f"PG mark_notification_read error: {e}")
        return False


async def mark_all_notifications_read_pg(user_id: str) -> bool:
    pool = await get_pool()
    if not pool:
        return False
    try:
        from datetime import datetime, timezone
        async with pool.acquire() as conn:
            await conn.execute(
                """UPDATE notifications_pg SET is_read = TRUE, read_at = $1 WHERE user_id = $2""",
                datetime.now(timezone.utc), user_id,
            )
        return True
    except Exception as e:
        logger.debug(f"PG mark_all_read error: {e}")
        return False


async def get_notifications_pg(user_id: str, limit: int = 20, offset: int = 0) -> list:
    pool = await get_pool()
    if not pool:
        return []
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, user_id, type, title, body, data, sender_id, is_read, read_at, created_at
                   FROM notifications_pg WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3""",
                user_id, limit, offset,
            )
            return [dict(r) for r in rows]
    except Exception as e:
        logger.debug(f"PG get_notifications error: {e}")
        return []


async def get_unread_count_pg(user_id: str) -> int:
    pool = await get_pool()
    if not pool:
        return 0
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT count(*) FROM notifications_pg WHERE user_id = $1 AND is_read = FALSE",
                user_id,
            )
            return row[0] if row else 0
    except Exception as e:
        logger.debug(f"PG unread_count error: {e}")
        return 0


async def get_notification_preferences_pg(user_id: str) -> dict:
    pool = await get_pool()
    if not pool:
        return {}
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM notification_preferences_pg WHERE user_id = $1", user_id
            )
            return dict(row) if row else {}
    except Exception as e:
        logger.debug(f"PG get_preferences error: {e}")
        return {}


async def set_notification_preferences_pg(user_id: str, **kwargs) -> bool:
    pool = await get_pool()
    if not pool:
        return False
    allowed = {"push_enabled", "like_notifications", "comment_notifications", "follow_notifications",
               "message_notifications", "tag_notifications", "new_content_notifications",
               "weekly_summary_enabled", "notification_sound"}
    updates = {k: v for k, v in kwargs.items() if k in allowed}
    if not updates:
        return True
    try:
        from datetime import datetime, timezone
        updates["updated_at"] = datetime.now(timezone.utc)
        cols = list(updates.keys())
        vals = list(updates.values())
        placeholders = ", ".join(f"${i+2}" for i in range(len(vals)))
        set_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols)
        async with pool.acquire() as conn:
            await conn.execute(
                f"""INSERT INTO notification_preferences_pg (user_id, {", ".join(cols)})
                   VALUES ($1, {placeholders})
                   ON CONFLICT (user_id) DO UPDATE SET {set_clause}""",
                user_id, *vals,
            )
        return True
    except Exception as e:
        logger.debug(f"PG set_preferences error: {e}")
        return False


async def get_dnd_settings_pg(user_id: str) -> dict:
    pool = await get_pool()
    if not pool:
        return {"enabled": False, "start_time": "22:00", "end_time": "08:00"}
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT enabled, start_time, end_time FROM dnd_settings_pg WHERE user_id = $1",
                user_id,
            )
            if row:
                return {"enabled": row["enabled"], "start_time": row["start_time"], "end_time": row["end_time"]}
    except Exception as e:
        logger.debug(f"PG get_dnd error: {e}")
    return {"enabled": False, "start_time": "22:00", "end_time": "08:00"}


async def set_dnd_settings_pg(user_id: str, enabled: bool = False,
                               start_time: str = "22:00", end_time: str = "08:00") -> bool:
    pool = await get_pool()
    if not pool:
        return False
    try:
        from datetime import datetime, timezone
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO dnd_settings_pg (user_id, enabled, start_time, end_time, updated_at)
                   VALUES ($1, $2, $3, $4, $5)
                   ON CONFLICT (user_id) DO UPDATE SET enabled = $2, start_time = $3, end_time = $4, updated_at = $5""",
                user_id, enabled, start_time, end_time, datetime.now(timezone.utc),
            )
        return True
    except Exception as e:
        logger.debug(f"PG set_dnd error: {e}")
        return False


async def is_in_dnd_window_pg(user_id: str) -> bool:
    """Returns True if current time is inside user's DND window (no push)."""
    dnd = await get_dnd_settings_pg(user_id)
    if not dnd.get("enabled"):
        return False
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).strftime("%H:%M")
    start, end = dnd.get("start_time", "22:00"), dnd.get("end_time", "08:00")
    if start <= end:
        return start <= now <= end
    return now >= start or now <= end


async def get_search_history_pg(user_id: str, limit: int = 10) -> list:
    """Get search history from PostgreSQL"""
    pool = await get_pool()
    if not pool:
        return []
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, query, search_type, created_at
                   FROM search_history WHERE user_id = $1
                   ORDER BY created_at DESC LIMIT $2""",
                user_id, limit,
            )
            return [dict(r) for r in rows]
    except Exception as e:
        logger.debug(f"PG get_search_history error: {e}")
        return []


async def insert_linked_account_pg(link_id: str, owner_id: str, linked_user_id: str, provider: str = "credentials") -> bool:
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO linked_accounts_pg (id, owner_id, linked_user_id, provider)
                   VALUES ($1, $2, $3, $4) ON CONFLICT (owner_id, linked_user_id) DO NOTHING""",
                link_id, owner_id, linked_user_id, provider,
            )
        return True
    except Exception as e:
        logger.debug(f"PG insert_linked_account error: {e}")
        return False


async def get_linked_accounts_pg(owner_id: str) -> list:
    pool = await get_pool()
    if not pool:
        return []
    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT id, owner_id, linked_user_id, provider, created_at FROM linked_accounts_pg WHERE owner_id = $1",
                owner_id,
            )
            return [dict(r) for r in rows]
    except Exception as e:
        logger.debug(f"PG get_linked_accounts error: {e}")
        return []


async def delete_linked_account_pg(owner_id: str, linked_user_id: str) -> bool:
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM linked_accounts_pg WHERE owner_id = $1 AND linked_user_id = $2",
                owner_id, linked_user_id,
            )
        return True
    except Exception as e:
        logger.debug(f"PG delete_linked_account error: {e}")
        return False


async def get_user_settings_pg(user_id: str) -> dict:
    pool = await get_pool()
    if not pool:
        return {}
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT theme, profile_theme, locale, music_quality, timezone, currency, updated_at FROM user_settings_pg WHERE user_id = $1",
                user_id,
            )
            return dict(row) if row else {}
    except Exception as e:
        logger.debug(f"PG get_user_settings error: {e}")
        return {}


async def set_user_settings_pg(user_id: str, **kwargs) -> bool:
    pool = await get_pool()
    if not pool:
        return False
    allowed = {"theme", "profile_theme", "locale", "music_quality", "timezone", "currency"}
    updates = {k: v for k, v in kwargs.items() if k in allowed}
    if not updates:
        return True
    try:
        from datetime import datetime, timezone
        updates["updated_at"] = datetime.now(timezone.utc)
        cols = list(updates.keys())
        vals = list(updates.values())
        placeholders = ", ".join(f"${i+2}" for i in range(len(vals)))
        set_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols)
        async with pool.acquire() as conn:
            await conn.execute(
                f"""INSERT INTO user_settings_pg (user_id, {", ".join(cols)})
                   VALUES ($1, {placeholders})
                   ON CONFLICT (user_id) DO UPDATE SET {set_clause}""",
                user_id, *vals,
            )
        return True
    except Exception as e:
        logger.debug(f"PG set_user_settings error: {e}")
        return False


async def get_privacy_settings_pg(user_id: str) -> dict:
    pool = await get_pool()
    if not pool:
        return {}
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT profile_visible, show_activity_status, allow_messages_from, show_listening_activity, updated_at FROM privacy_settings_pg WHERE user_id = $1",
                user_id,
            )
            return dict(row) if row else {}
    except Exception as e:
        logger.debug(f"PG get_privacy_settings error: {e}")
        return {}


async def set_privacy_settings_pg(user_id: str, **kwargs) -> bool:
    pool = await get_pool()
    if not pool:
        return False
    allowed = {"profile_visible", "show_activity_status", "allow_messages_from", "show_listening_activity"}
    updates = {k: v for k, v in kwargs.items() if k in allowed}
    if not updates:
        return True
    try:
        from datetime import datetime, timezone
        updates["updated_at"] = datetime.now(timezone.utc)
        cols = list(updates.keys())
        vals = list(updates.values())
        placeholders = ", ".join(f"${i+2}" for i in range(len(vals)))
        set_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols)
        async with pool.acquire() as conn:
            await conn.execute(
                f"""INSERT INTO privacy_settings_pg (user_id, {", ".join(cols)})
                   VALUES ($1, {placeholders})
                   ON CONFLICT (user_id) DO UPDATE SET {set_clause}""",
                user_id, *vals,
            )
        return True
    except Exception as e:
        logger.debug(f"PG set_privacy_settings error: {e}")
        return False


async def get_referral_code_pg(user_id: str) -> Optional[str]:
    pool = await get_pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT code FROM referral_codes_pg WHERE user_id = $1", user_id
            )
            return row["code"] if row else None
    except Exception as e:
        logger.debug(f"PG get_referral_code error: {e}")
        return None


async def create_referral_code_pg(user_id: str, code: str) -> bool:
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO referral_codes_pg (user_id, code) VALUES ($1, $2)
                   ON CONFLICT (user_id) DO UPDATE SET code = EXCLUDED.code""",
                user_id, code,
            )
        return True
    except Exception as e:
        logger.debug(f"PG create_referral_code error: {e}")
        return False


async def apply_referral_code_pg(code: str, referred_user_id: str) -> Optional[str]:
    """Returns referrer_id if code valid and applied, else None."""
    pool = await get_pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            existing = await conn.fetchrow(
                "SELECT 1 FROM referral_tracking_pg WHERE referred_id = $1", referred_user_id
            )
            if existing:
                return None
            row = await conn.fetchrow(
                "SELECT user_id FROM referral_codes_pg WHERE code = $1", code.strip().upper()
            )
            if not row:
                return None
            referrer_id = row["user_id"]
            if referrer_id == referred_user_id:
                return None
            await conn.execute(
                """INSERT INTO referral_tracking_pg (referrer_id, referred_id, code)
                   VALUES ($1, $2, $3) ON CONFLICT (referred_id) DO NOTHING""",
                referrer_id, referred_user_id, code.strip().upper(),
            )
            return referrer_id
    except Exception as e:
        logger.debug(f"PG apply_referral_code error: {e}")
        return None


async def get_referral_stats_pg(user_id: str) -> dict:
    pool = await get_pool()
    if not pool:
        return {"code": None, "referred_count": 0}
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT code FROM referral_codes_pg WHERE user_id = $1", user_id
            )
            code = row["code"] if row else None
            row = await conn.fetchrow(
                "SELECT COUNT(*) as c FROM referral_tracking_pg WHERE referrer_id = $1", user_id
            )
            count = row["c"] if row else 0
            return {"code": code, "referred_count": count}
    except Exception as e:
        logger.debug(f"PG get_referral_stats error: {e}")
        return {"code": None, "referred_count": 0}


async def delete_user_data_pg(user_id: str) -> bool:
    """Remove all PG data for a user (hesap silme / GDPR erasure)."""
    pool = await get_pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM profiles WHERE user_id = $1", user_id)
            await conn.execute("DELETE FROM followers WHERE follower_id = $1 OR following_id = $1", user_id, user_id)
            await conn.execute("DELETE FROM blocked_users WHERE blocker_id = $1 OR blocked_id = $1", user_id, user_id)
            await conn.execute("DELETE FROM close_friends WHERE user_id = $1 OR friend_id = $1", user_id, user_id)
            await conn.execute("DELETE FROM notification_preferences_pg WHERE user_id = $1", user_id)
            await conn.execute("DELETE FROM dnd_settings_pg WHERE user_id = $1", user_id)
            await conn.execute("DELETE FROM linked_accounts_pg WHERE owner_id = $1 OR linked_user_id = $2", user_id, user_id)
            await conn.execute("DELETE FROM user_settings_pg WHERE user_id = $1", user_id)
            await conn.execute("DELETE FROM privacy_settings_pg WHERE user_id = $1", user_id)
            await conn.execute("DELETE FROM user_sessions WHERE user_id = $1", user_id)
            await conn.execute("DELETE FROM notifications_pg WHERE user_id = $1 OR sender_id = $2", user_id, user_id)
            await conn.execute("DELETE FROM user_levels WHERE user_id = $1", user_id)
            await conn.execute("DELETE FROM user_badges WHERE user_id = $1", user_id)
            await conn.execute("DELETE FROM user_achievements WHERE user_id = $1", user_id)
            await conn.execute("DELETE FROM referral_codes_pg WHERE user_id = $1", user_id)
            await conn.execute("DELETE FROM referral_tracking_pg WHERE referrer_id = $1 OR referred_id = $2", user_id, user_id)
        return True
    except Exception as e:
        logger.debug(f"PG delete_user_data error: {e}")
        return False


async def close():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
