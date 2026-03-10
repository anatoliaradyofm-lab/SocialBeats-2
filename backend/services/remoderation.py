# Background Re-Moderation Service
# Periodically re-checks text posts and comments for toxicity.
# If content is flagged as unsafe: deletes it, logs to content_violations, optionally notifies user.

import os
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Configuration (env overridable)
REMOD_DAYS = int(os.environ.get("REMOD_DAYS", "7"))
REMOD_BATCH_SIZE = int(os.environ.get("REMOD_BATCH_SIZE", "100"))
REMOD_INTERVAL_HOURS = float(os.environ.get("REMOD_INTERVAL_HOURS", "1"))
REMOD_INCLUDE_COMMENTS = os.environ.get("REMOD_INCLUDE_COMMENTS", "true").lower() in ("true", "1", "yes")


async def run_text_remoderation(
    db,
    content_moderator,
    *,
    days: Optional[int] = None,
    batch_size: Optional[int] = None,
    include_comments: bool = True,
) -> Dict[str, Any]:
    """
    Re-moderate text posts and optionally comments from the last N days.
    If check_text_toxicity returns safe=False: delete content, log violation, notify user.
    Returns summary of the run.
    """
    days = days if days is not None else REMOD_DAYS
    batch_size = batch_size if batch_size is not None else REMOD_BATCH_SIZE

    if not content_moderator:
        logger.warning("Content moderator not available - skipping re-moderation")
        return {"error": "Content moderator not available", "skipped": True}

    run_id = str(uuid.uuid4())
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    summary: Dict[str, Any] = {
        "run_id": run_id,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "days": days,
        "batch_size": batch_size,
        "posts_checked": 0,
        "posts_deleted": 0,
        "comments_checked": 0,
        "comments_deleted": 0,
        "errors": 0,
    }

    try:
        # -------- Posts (text-only: has content, no media or empty media) --------
        query_posts = {
            "created_at": {"$gte": cutoff},
            "content": {"$exists": True, "$ne": "", "$type": "string"},
            "$or": [{"media_urls": {"$exists": False}}, {"media_urls": []}],
        }
        posts_cursor = db.posts.find(query_posts, {"id": 1, "content": 1, "user_id": 1, "username": 1}).limit(batch_size)
        posts_batch = await posts_cursor.to_list(length=batch_size)

        for post in posts_batch:
            summary["posts_checked"] += 1
            content = (post.get("content") or "").strip()
            if not content:
                continue
            try:
                result = await content_moderator.check_text_toxicity(content)
                if not result.get("safe", True):
                    await _delete_post_and_handle_violation(db, post, result, summary)
            except Exception as e:
                logger.error(f"Re-moderation error for post {post.get('id')}: {e}")
                summary["errors"] += 1

        # -------- Comments --------
        if include_comments:
            query_comments = {
                "created_at": {"$gte": cutoff},
                "content": {"$exists": True, "$ne": "", "$type": "string"},
            }
            comments_cursor = db.comments.find(
                query_comments, {"id": 1, "content": 1, "user_id": 1, "post_id": 1}
            ).limit(batch_size)
            comments_batch = await comments_cursor.to_list(length=batch_size)

            for comment in comments_batch:
                summary["comments_checked"] += 1
                content = (comment.get("content") or "").strip()
                if not content:
                    continue
                try:
                    result = await content_moderator.check_text_toxicity(content)
                    if not result.get("safe", True):
                        await _delete_comment_and_handle_violation(db, comment, result, summary)
                except Exception as e:
                    logger.error(f"Re-moderation error for comment {comment.get('id')}: {e}")
                    summary["errors"] += 1

    except Exception as e:
        logger.error(f"Re-moderation run failed: {e}")
        summary["error"] = str(e)
        summary["errors"] = summary.get("errors", 0) + 1

    summary["finished_at"] = datetime.now(timezone.utc).isoformat()

    # Log run to moderation_logs
    if db:
        try:
            await db.moderation_logs.insert_one({
                "type": "remoderation_run",
                "run_id": run_id,
                "summary": summary,
                "created_at": summary["finished_at"],
            })
        except Exception as e:
            logger.error(f"Failed to log remoderation run: {e}")

    return summary


async def _delete_post_and_handle_violation(db, post: dict, result: dict, summary: dict):
    """Delete post and perform optional actions: content_violations, notify user."""
    post_id = post.get("id")
    user_id = post.get("user_id")

    await db.posts.delete_one({"id": post_id})
    await db.comments.delete_many({"post_id": post_id})
    await db.post_reactions.delete_many({"post_id": post_id})
    await db.saved_posts.delete_many({"post_id": post_id})
    await db.users.update_one({"id": user_id}, {"$inc": {"posts_count": -1}})

    summary["posts_deleted"] = summary.get("posts_deleted", 0) + 1

    # content_violations
    await db.content_violations.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "content_type": "post",
        "content_id": post_id,
        "violation_type": "text_toxicity",
        "details": result,
        "action_taken": "deleted",
        "source": "remoderation",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    # Optional: notify user
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "content_violation",
        "title": "İçerik Kaldırıldı",
        "body": "Gönderiniz topluluk kurallarımızı ihlal ettiği için kaldırıldı. Lütfen içerik politikamızı inceleyin.",
        "data": {"post_id": post_id, "reason": "remoderation"},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    logger.info(f"Re-moderation: deleted post {post_id} (user {user_id})")


async def _delete_comment_and_handle_violation(db, comment: dict, result: dict, summary: dict):
    """Delete comment and perform optional actions."""
    comment_id = comment.get("id")
    post_id = comment.get("post_id")
    user_id = comment.get("user_id")

    # Delete comment and its replies
    await db.comments.delete_many({
        "$or": [{"id": comment_id}, {"parent_id": comment_id}]
    })
    # Decrement post comments_count if top-level
    if not comment.get("parent_id"):
        await db.posts.update_one({"id": post_id}, {"$inc": {"comments_count": -1}})
    else:
        await db.comments.update_one({"id": comment.get("parent_id")}, {"$inc": {"replies_count": -1}})

    await db.comment_likes.delete_many({"comment_id": comment_id})

    summary["comments_deleted"] = summary.get("comments_deleted", 0) + 1

    await db.content_violations.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "content_type": "comment",
        "content_id": comment_id,
        "post_id": post_id,
        "violation_type": "text_toxicity",
        "details": result,
        "action_taken": "deleted",
        "source": "remoderation",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "content_violation",
        "title": "Yorum Kaldırıldı",
        "body": "Yorumunuz topluluk kurallarımızı ihlal ettiği için kaldırıldı.",
        "data": {"comment_id": comment_id, "post_id": post_id},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    logger.info(f"Re-moderation: deleted comment {comment_id} (user {user_id})")
