"""
PostgreSQL Social Service - Profil, takipçi, engel, yakın arkadaş, gizli hesap, çalma listesi
MongoDB ile senkron çalışır (mevcut veriler korunur)
"""
import os
import logging
import uuid
from typing import Optional, List

logger = logging.getLogger(__name__)


async def _pool():
    from services.postgresql_service import get_pool
    return await get_pool()


async def upsert_profile(user_id: str, username: str, full_name: str = None,
                         bio: str = None, avatar_url: str = None, cover_url: str = None, is_private: bool = False):
    pool = await _pool()
    if not pool:
        return None
    try:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO profiles (id, user_id, username, full_name, bio, avatar_url, cover_url, is_private, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (user_id) DO UPDATE SET
                    username = EXCLUDED.username, full_name = EXCLUDED.full_name,
                    bio = EXCLUDED.bio, avatar_url = EXCLUDED.avatar_url,
                    cover_url = EXCLUDED.cover_url,
                    is_private = EXCLUDED.is_private, updated_at = EXCLUDED.updated_at
            """, str(uuid.uuid4()), user_id, username, full_name or "", bio or "", avatar_url or "", cover_url or "", is_private, now)
        return True
    except Exception as e:
        logger.debug(f"PG upsert_profile: {e}")
        return False


async def get_profile_pg(user_id: str = None, username: str = None) -> Optional[dict]:
    pool = await _pool()
    if not pool:
        return None
    try:
        async with pool.acquire() as conn:
            if user_id:
                row = await conn.fetchrow("SELECT * FROM profiles WHERE user_id = $1", user_id)
            elif username:
                row = await conn.fetchrow("SELECT * FROM profiles WHERE username = $1", username)
            else:
                return None
            return dict(row) if row else None
    except Exception as e:
        logger.debug(f"PG get_profile: {e}")
        return None


async def follow(follower_id: str, following_id: str) -> bool:
    pool = await _pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO followers (follower_id, following_id) VALUES ($1, $2) ON CONFLICT (follower_id, following_id) DO NOTHING",
                follower_id, following_id
            )
        return True
    except Exception as e:
        logger.debug(f"PG follow: {e}")
        return False


async def unfollow(follower_id: str, following_id: str) -> bool:
    pool = await _pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM followers WHERE follower_id = $1 AND following_id = $2", follower_id, following_id)
        return True
    except Exception as e:
        logger.debug(f"PG unfollow: {e}")
        return False


async def block_user(blocker_id: str, blocked_id: str) -> bool:
    pool = await _pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT (blocker_id, blocked_id) DO NOTHING",
                blocker_id, blocked_id
            )
        return True
    except Exception as e:
        logger.debug(f"PG block: {e}")
        return False


async def unblock_user(blocker_id: str, blocked_id: str) -> bool:
    pool = await _pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2", blocker_id, blocked_id)
        return True
    except Exception as e:
        logger.debug(f"PG unblock: {e}")
        return False


async def is_blocked(blocker_id: str, blocked_id: str) -> bool:
    pool = await _pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT 1 FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2",
                blocker_id, blocked_id
            )
            return row is not None
    except Exception:
        return False


async def add_close_friend(user_id: str, friend_id: str) -> bool:
    pool = await _pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO close_friends (user_id, friend_id) VALUES ($1, $2) ON CONFLICT (user_id, friend_id) DO NOTHING",
                user_id, friend_id
            )
        return True
    except Exception as e:
        logger.debug(f"PG add_close_friend: {e}")
        return False


async def remove_close_friend(user_id: str, friend_id: str) -> bool:
    pool = await _pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM close_friends WHERE user_id = $1 AND friend_id = $2", user_id, friend_id)
        return True
    except Exception:
        return False


async def set_private_account(user_id: str, is_private: bool) -> bool:
    pool = await _pool()
    if not pool:
        return False
    try:
        from datetime import datetime, timezone
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE profiles SET is_private = $1, updated_at = $2 WHERE user_id = $3",
                is_private, datetime.now(timezone.utc), user_id
            )
        return True
    except Exception as e:
        logger.debug(f"PG set_private: {e}")
        return False


async def create_playlist_pg(owner_id: str, title: str, description: str = None,
                              is_public: bool = True, is_collaborative: bool = False) -> Optional[str]:
    pool = await _pool()
    if not pool:
        return None
    pid = str(uuid.uuid4())
    try:
        from datetime import datetime, timezone
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO playlists (id, owner_id, title, description, is_public, is_collaborative, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)""",
                pid, owner_id, title, description or "", is_public, is_collaborative, datetime.now(timezone.utc)
            )
        return pid
    except Exception as e:
        logger.debug(f"PG create_playlist: {e}")
        return None


async def add_playlist_collaborator(playlist_id: str, user_id: str, inviter_id: str) -> bool:
    pool = await _pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO playlist_collaborators (playlist_id, user_id, role) VALUES ($1, $2, 'editor') ON CONFLICT (playlist_id, user_id) DO NOTHING",
                playlist_id, user_id
            )
        return True
    except Exception as e:
        logger.debug(f"PG add_collaborator: {e}")
        return False
