"""
PostgreSQL Posts Service - Gönderi, beğeni, yorum, repost, görüntülenme, sabitleme
MongoDB ile dual-write (mevcut feed korunur)
"""
import os
import logging
import uuid
from typing import Optional, List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


async def _pool():
    from services.postgresql_service import get_pool
    return await get_pool()


async def create_post_pg(user_id: str, content: str, media_urls: list = None,
                         location_name: str = None, latitude: float = None, longitude: float = None,
                         country_code: str = None, mentions: list = None, hashtags: list = None,
                         visibility: str = "public", allow_comments: bool = True,
                         repost_of: str = None, post_id: str = None) -> Optional[str]:
    pool = await _pool()
    if not pool:
        return None
    pid = post_id or str(uuid.uuid4())
    try:
        import json
        async with pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO posts_pg (id, user_id, content, media_urls, location_name, latitude, longitude,
                    country_code, mentions, hashtags, visibility, allow_comments, repost_of, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            """, pid, user_id, content or "", json.dumps(media_urls or []),
                location_name or "", latitude, longitude, country_code or "",
                json.dumps(mentions or []), json.dumps(hashtags or []), visibility, allow_comments,
                repost_of, datetime.now(timezone.utc))
        return pid
    except Exception as e:
        logger.debug(f"PG create_post: {e}")
        return None


async def like_post_pg(post_id: str, user_id: str) -> bool:
    pool = await _pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO post_likes_pg (post_id, user_id) VALUES ($1, $2) ON CONFLICT (post_id, user_id) DO NOTHING",
                post_id, user_id
            )
            await conn.execute("UPDATE posts_pg SET likes_count = (SELECT COUNT(*) FROM post_likes_pg WHERE post_id = $1), updated_at = $2 WHERE id = $1", post_id, datetime.now(timezone.utc))
        return True
    except Exception as e:
        logger.debug(f"PG like: {e}")
        return False


async def unlike_post_pg(post_id: str, user_id: str) -> bool:
    pool = await _pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM post_likes_pg WHERE post_id = $1 AND user_id = $2", post_id, user_id)
            await conn.execute("UPDATE posts_pg SET likes_count = (SELECT COUNT(*) FROM post_likes_pg WHERE post_id = $1), updated_at = $2 WHERE id = $1", post_id, datetime.now(timezone.utc))
        return True
    except Exception as e:
        logger.debug(f"PG unlike: {e}")
        return False


async def add_comment_pg(post_id: str, user_id: str, content: str, parent_id: str = None) -> Optional[str]:
    pool = await _pool()
    if not pool:
        return None
    cid = str(uuid.uuid4())
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO post_comments_pg (id, post_id, user_id, content, parent_id) VALUES ($1, $2, $3, $4, $5)",
                cid, post_id, user_id, content or "", parent_id
            )
            await conn.execute("UPDATE posts_pg SET comments_count = (SELECT COUNT(*) FROM post_comments_pg WHERE post_id = $1), updated_at = $2 WHERE id = $1", post_id, datetime.now(timezone.utc))
        return cid
    except Exception as e:
        logger.debug(f"PG add_comment: {e}")
        return None


async def repost_pg(post_id: str, user_id: str, comment: str = None) -> Optional[str]:
    pool = await _pool()
    if not pool:
        return None
    rid = str(uuid.uuid4())
    try:
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO post_reposts_pg (id, post_id, user_id, comment) VALUES ($1, $2, $3, $4) ON CONFLICT (post_id, user_id) DO NOTHING",
                rid, post_id, user_id, comment or ""
            )
            await conn.execute("UPDATE posts_pg SET reposts_count = (SELECT COUNT(*) FROM post_reposts_pg WHERE post_id = $1), updated_at = $2 WHERE id = $1", post_id, datetime.now(timezone.utc))
        return rid
    except Exception as e:
        logger.debug(f"PG repost: {e}")
        return None


async def increment_view_pg(post_id: str, user_id: str = None) -> bool:
    pool = await _pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute("INSERT INTO post_views_pg (post_id, user_id) VALUES ($1, $2)", post_id, user_id or "")
            await conn.execute("UPDATE posts_pg SET views_count = views_count + 1, updated_at = $2 WHERE id = $1", post_id, datetime.now(timezone.utc))
        return True
    except Exception as e:
        logger.debug(f"PG view: {e}")
        return False


async def update_post_pg(post_id: str, user_id: str, content: str = None, media_urls: list = None,
                         visibility: str = None, allow_comments: bool = None,
                         mentions: list = None, hashtags: list = None) -> bool:
    pool = await _pool()
    if not pool:
        return False
    try:
        import json
        updates = ["updated_at = $2"]
        params = [post_id, datetime.now(timezone.utc)]
        idx = 3
        if content is not None:
            updates.append(f"content = ${idx}")
            params.append(content)
            idx += 1
        if media_urls is not None:
            updates.append(f"media_urls = ${idx}")
            params.append(json.dumps(media_urls))
            idx += 1
        if visibility is not None:
            updates.append(f"visibility = ${idx}")
            params.append(visibility)
            idx += 1
        if allow_comments is not None:
            updates.append(f"allow_comments = ${idx}")
            params.append(allow_comments)
            idx += 1
        if mentions is not None:
            updates.append(f"mentions = ${idx}")
            params.append(json.dumps(mentions))
            idx += 1
        if hashtags is not None:
            updates.append(f"hashtags = ${idx}")
            params.append(json.dumps(hashtags))
            idx += 1
        if len(updates) <= 1:
            return True
        async with pool.acquire() as conn:
            await conn.execute(
                f"UPDATE posts_pg SET {', '.join(updates)} WHERE id = $1 AND user_id = $2",
                *params, user_id
            )
        return True
    except Exception as e:
        logger.debug(f"PG update_post: {e}")
        return False


async def delete_post_pg(post_id: str, user_id: str) -> bool:
    pool = await _pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            await conn.execute("DELETE FROM post_likes_pg WHERE post_id = $1", post_id)
            await conn.execute("DELETE FROM post_comments_pg WHERE post_id = $1", post_id)
            await conn.execute("DELETE FROM post_reposts_pg WHERE post_id = $1", post_id)
            await conn.execute("DELETE FROM post_views_pg WHERE post_id = $1", post_id)
            await conn.execute("DELETE FROM posts_pg WHERE id = $1 AND user_id = $2", post_id, user_id)
        return True
    except Exception as e:
        logger.debug(f"PG delete_post: {e}")
        return False


async def pin_post_pg(post_id: str, user_id: str, is_pinned: bool) -> bool:
    pool = await _pool()
    if not pool:
        return False
    try:
        async with pool.acquire() as conn:
            if is_pinned:
                await conn.execute("UPDATE posts_pg SET is_pinned = FALSE WHERE user_id = $1", user_id)
            await conn.execute("UPDATE posts_pg SET is_pinned = $2, updated_at = $3 WHERE id = $1 AND user_id = $4", post_id, is_pinned, datetime.now(timezone.utc), user_id)
        return True
    except Exception as e:
        logger.debug(f"PG pin_post: {e}")
        return False


async def get_feed_pg(user_id: str, following_ids: list, excluded_ids: list,
                      cursor: str = None, limit: int = 20) -> tuple:
    """Cursor-based infinite feed. Returns (posts, next_cursor)."""
    pool = await _pool()
    if not pool:
        return [], None
    try:
        async with pool.acquire() as conn:
            exclude = list(set(excluded_ids)) if excluded_ids else []
            include = list(set(following_ids + [user_id])) if following_ids else [user_id]
            if cursor:
                rows = await conn.fetch("""
                    SELECT * FROM posts_pg
                    WHERE user_id = ANY($1::varchar[]) AND user_id != ALL($2::varchar[])
                    AND (visibility = 'public' OR user_id = ANY($1::varchar[]))
                    AND created_at < (SELECT created_at FROM posts_pg WHERE id = $3)
                    ORDER BY created_at DESC
                    LIMIT $4
                """, include, exclude or [""], cursor, limit + 1)
            else:
                rows = await conn.fetch("""
                    SELECT * FROM posts_pg
                    WHERE user_id = ANY($1::varchar[]) AND ($2::varchar[] IS NULL OR user_id != ALL($2::varchar[]))
                    AND (visibility = 'public' OR user_id = ANY($1::varchar[]))
                    ORDER BY created_at DESC
                    LIMIT $3
                """, include, exclude or [""], limit + 1)
            posts = [dict(r) for r in rows[:limit]]
            next_cursor = str(rows[limit]["id"]) if len(rows) > limit else None
            return posts, next_cursor
    except Exception as e:
        logger.debug(f"PG feed: {e}")
        return [], None
