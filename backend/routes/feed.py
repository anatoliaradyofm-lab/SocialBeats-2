# Feed Router - Akış işlemleri için modüler API
# server.py'den ayrılmış feed endpoint'leri

from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, timezone
from typing import Optional, List
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import db
from core.auth import get_current_user

router = APIRouter(tags=["Feed"])


async def _get_cursor_date(db, cursor: str):
    """Get created_at of post for cursor-based pagination."""
    doc = await db.posts.find_one({"id": cursor}, {"created_at": 1})
    return doc.get("created_at") if doc else datetime(9999, 12, 31, tzinfo=timezone.utc)


def _get_country(request: Request, query_country: Optional[str] = None) -> Optional[str]:
    """Get country from X-Country-Code header, ?country= query, or None."""
    if query_country:
        return query_country.upper()[:2] if len(query_country) >= 2 else None
    h = request.headers.get("X-Country-Code")
    return h.upper()[:2] if h and len(h) >= 2 else None


# ============================================
# MAIN FEED
# ============================================

@router.get("/social/feed")
async def get_feed(
    request: Request,
    page: int = 1,
    limit: int = 20,
    cursor: Optional[str] = None,
    country: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Ana akış - sonsuz scroll için cursor kullan. cursor yoksa page ile."""
    skip = (page - 1) * limit if not cursor else 0
    
    # Get blocked users
    blocked = await db.blocked_users.find({"blocker_id": current_user["id"]}, {"blocked_id": 1}).to_list(1000)
    blocked_ids = [b["blocked_id"] for b in blocked]
    
    # Get users who blocked me
    blocked_by = await db.blocked_users.find({"blocked_id": current_user["id"]}, {"blocker_id": 1}).to_list(1000)
    blocked_by_ids = [b["blocker_id"] for b in blocked_by]
    
    # Kısıtlı hesap: users who have restricted me - I can't see their posts (sadece mesaj görebilir)
    restricted_me = await db.restricted_users.find(
        {"restricted_id": current_user["id"]},
        {"restricter_id": 1}
    ).to_list(1000)
    restricter_ids = [r["restricter_id"] for r in restricted_me]
    
    # Get muted users (for posts)
    muted = await db.muted_users.find(
        {"user_id": current_user["id"], "mute_posts": True},
        {"muted_user_id": 1}
    ).to_list(1000)
    muted_ids = [m["muted_user_id"] for m in muted]
    
    # Combine all excluded users (blocked, blocked_by, restricted_me, muted)
    excluded_user_ids = list(set(blocked_ids + blocked_by_ids + restricter_ids + muted_ids))
    
    # Get following list
    following = await db.follows.find({"follower_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    following_ids = [f["following_id"] for f in following]
    following_ids.append(current_user["id"])
    
    # Remove excluded users from following
    following_ids = [uid for uid in following_ids if uid not in excluded_user_ids]
    
    private_users_cursor = db.users.find(
        {"$or": [{"is_private": True}, {"is_private_account": True}]},
        {"id": 1}
    )
    private_users = await private_users_cursor.to_list(5000)
    private_user_ids = [u["id"] for u in private_users if u["id"] not in following_ids]

    country_code = _get_country(request, country)
    query = {
        "$and": [
            {"user_id": {"$nin": excluded_user_ids}},
            {"is_archived": {"$ne": True}},
            {"$or": [
                {"user_id": {"$in": following_ids}},
                {"visibility": "public", "user_id": {"$nin": following_ids + private_user_ids}}
            ]}
        ]
    }
    if cursor:
        posts = await db.posts.find(
            {**query, "created_at": {"$lt": await _get_cursor_date(db, cursor)}},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit + 1).to_list(limit + 1)
        next_cursor = posts[limit]["id"] if len(posts) > limit else None
        posts = posts[:limit]
    else:
        posts = await db.posts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        next_cursor = None

    if country_code and posts and any(p.get("country") for p in posts):
        same_country = [p for p in posts if p.get("country") == country_code]
        other = [p for p in posts if p.get("country") != country_code]
        posts = same_country + other

    for post in posts:
        reaction = await db.post_reactions.find_one({"post_id": post["id"], "user_id": current_user["id"]})
        post["user_reaction"] = reaction["reaction_type"] if reaction else None
        saved = await db.saved_posts.find_one({"post_id": post["id"], "user_id": current_user["id"]})
        post["is_saved"] = saved is not None

    if cursor:
        return {"posts": posts, "next_cursor": next_cursor}
    return posts


# ============================================
# USER POSTS
# ============================================

@router.get("/social/posts/user/{user_id}")
async def get_user_posts(
    user_id: str,
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Kullanıcının gönderilerini getir"""
    skip = (page - 1) * limit
    
    # Check if blocked
    blocked = await db.blocked_users.find_one({
        "$or": [
            {"blocker_id": current_user["id"], "blocked_id": user_id},
            {"blocker_id": user_id, "blocked_id": current_user["id"]}
        ]
    })
    
    if blocked:
        return []
    
    # Build query - hide: only affects when viewing own profile
    query = {"user_id": user_id, "is_archived": {"$ne": True}}
    if user_id == current_user["id"]:
        query["is_hidden"] = {"$ne": True}
    
    # If not own profile, only show public posts
    if user_id != current_user["id"]:
        # Check if following
        following = await db.follows.find_one({
            "follower_id": current_user["id"],
            "following_id": user_id
        })
        
        if not following:
            query["visibility"] = "public"
    
    posts = await db.posts.find(
        query,
        {"_id": 0}
    ).sort([("is_pinned", -1), ("created_at", -1)]).skip(skip).limit(limit).to_list(limit)
    
    # Enrich posts
    for post in posts:
        reaction = await db.post_reactions.find_one({
            "post_id": post["id"],
            "user_id": current_user["id"]
        })
        post["user_reaction"] = reaction["reaction_type"] if reaction else None
        
        saved = await db.saved_posts.find_one({
            "post_id": post["id"],
            "user_id": current_user["id"]
        })
        post["is_saved"] = saved is not None
    
    return posts


# ============================================
# TRENDING POSTS
# ============================================

@router.get("/social/posts/trending")
async def get_trending_posts(
    request: Request,
    limit: int = 20,
    country: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Trend gönderileri getir. country from ?country= or X-Country-Code."""
    # Get blocked users
    blocked = await db.blocked_users.find(
        {"$or": [
            {"blocker_id": current_user["id"]},
            {"blocked_id": current_user["id"]}
        ]}
    ).to_list(1000)
    
    blocked_ids = set()
    for b in blocked:
        blocked_ids.add(b.get("blocker_id"))
        blocked_ids.add(b.get("blocked_id"))
    blocked_ids.discard(current_user["id"])
    
    # Get trending posts based on engagement
    pipeline = [
        {
            "$match": {
                "user_id": {"$nin": list(blocked_ids)},
                "visibility": "public",
                "is_archived": {"$ne": True}
            }
        },
        {
            "$addFields": {
                "engagement_score": {
                    "$add": [
                        {"$multiply": [{"$ifNull": ["$comments_count", 0]}, 3]},
                        {"$multiply": [{"$ifNull": ["$shares_count", 0]}, 5]},
                        {"$reduce": {
                            "input": {"$objectToArray": {"$ifNull": ["$reactions", {}]}},
                            "initialValue": 0,
                            "in": {"$add": ["$$value", "$$this.v"]}
                        }}
                    ]
                }
            }
        },
        {"$sort": {"engagement_score": -1, "created_at": -1}},
        {"$limit": limit},
        {"$project": {"_id": 0}}
    ]
    
    posts = await db.posts.aggregate(pipeline).to_list(limit)
    country_code = _get_country(request, country)
    if country_code and posts and any(p.get("country") for p in posts):
        same_country = [p for p in posts if p.get("country") == country_code]
        other = [p for p in posts if p.get("country") != country_code]
        posts = same_country + other

    # Enrich posts
    for post in posts:
        reaction = await db.post_reactions.find_one({
            "post_id": post["id"],
            "user_id": current_user["id"]
        })
        post["user_reaction"] = reaction["reaction_type"] if reaction else None
        
        saved = await db.saved_posts.find_one({
            "post_id": post["id"],
            "user_id": current_user["id"]
        })
        post["is_saved"] = saved is not None
    
    return posts


# ============================================
# EXPLORE FEED
# ============================================

@router.get("/social/posts/explore")
async def get_explore_posts(
    request: Request,
    page: int = 1,
    limit: int = 30,
    category: Optional[str] = None,
    country: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Keşfet akışını getir. country from ?country= or X-Country-Code."""
    skip = (page - 1) * limit
    
    # Get blocked users
    blocked = await db.blocked_users.find(
        {"$or": [
            {"blocker_id": current_user["id"]},
            {"blocked_id": current_user["id"]}
        ]}
    ).to_list(1000)
    
    blocked_ids = set()
    for b in blocked:
        blocked_ids.add(b.get("blocker_id"))
        blocked_ids.add(b.get("blocked_id"))
    blocked_ids.discard(current_user["id"])
    
    # Get following to exclude
    following = await db.follows.find({"follower_id": current_user["id"]}).to_list(1000)
    following_ids = [f["following_id"] for f in following]
    following_ids.append(current_user["id"])
    
    query = {
        "user_id": {"$nin": list(blocked_ids) + following_ids},
        "visibility": "public",
        "is_archived": {"$ne": True}
    }
    
    if category:
        query["post_type"] = category
    
    posts = await db.posts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    country_code = _get_country(request, country)
    if country_code and posts and any(p.get("country") for p in posts):
        same_country = [p for p in posts if p.get("country") == country_code]
        other = [p for p in posts if p.get("country") != country_code]
        posts = same_country + other

    for post in posts:
        reaction = await db.post_reactions.find_one({
            "post_id": post["id"],
            "user_id": current_user["id"]
        })
        post["user_reaction"] = reaction["reaction_type"] if reaction else None
        saved = await db.saved_posts.find_one({
            "post_id": post["id"],
            "user_id": current_user["id"]
        })
        post["is_saved"] = saved is not None

    return posts


# ============================================
# REELS (Instagram Reels tarzı - video/foto akışı)
# ============================================

@router.get("/social/reels")
async def get_reels(
    request: Request,
    page: int = 1,
    limit: int = 20,
    country: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Reels akışı. country from ?country= or X-Country-Code."""
    skip = (page - 1) * limit

    blocked = await db.blocked_users.find(
        {"$or": [
            {"blocker_id": current_user["id"]},
            {"blocked_id": current_user["id"]}
        ]}
    ).to_list(1000)
    blocked_ids = set()
    for b in blocked:
        blocked_ids.add(b.get("blocker_id"))
        blocked_ids.add(b.get("blocked_id"))
    blocked_ids.discard(current_user["id"])

    query = {
        "user_id": {"$nin": list(blocked_ids)},
        "visibility": "public",
        "is_archived": {"$ne": True},
        "post_type": {"$in": ["video", "reel", "music_video"]}
    }

    posts = await db.posts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    country_code = _get_country(request, country)
    if country_code and posts and any(p.get("country") for p in posts):
        same_country = [p for p in posts if p.get("country") == country_code]
        other = [p for p in posts if p.get("country") != country_code]
        posts = same_country + other

    for post in posts:
        if not post.get("media_urls") and post.get("media_url"):
            post["media_urls"] = [post["media_url"]]
        reaction = await db.post_reactions.find_one({
            "post_id": post["id"],
            "user_id": current_user["id"]
        })
        post["user_reaction"] = reaction["reaction_type"] if reaction else None
        saved = await db.saved_posts.find_one({
            "post_id": post["id"],
            "user_id": current_user["id"]
        })
        post["is_saved"] = saved is not None

        user = await db.users.find_one(
            {"id": post["user_id"]},
            {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
        )
        if user:
            post["username"] = user.get("username", "unknown")
            post["user_avatar"] = user.get("avatar_url")
            post["user_display_name"] = user.get("display_name") or user.get("username")

    return posts


# ============================================
# FOLLOWING FEED
# ============================================

@router.get("/social/feed/following")
async def get_following_feed(
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Sadece takip edilenlerin gönderileri"""
    skip = (page - 1) * limit
    
    # Get following
    following = await db.follows.find({"follower_id": current_user["id"]}).to_list(1000)
    following_ids = [f["following_id"] for f in following]
    
    if not following_ids:
        return []
    
    # Get muted users
    muted = await db.muted_users.find(
        {"user_id": current_user["id"], "mute_posts": True}
    ).to_list(1000)
    muted_ids = [m["muted_user_id"] for m in muted]
    
    # Filter out muted
    following_ids = [uid for uid in following_ids if uid not in muted_ids]
    
    posts = await db.posts.find(
        {
            "user_id": {"$in": following_ids},
            "is_archived": {"$ne": True}
        },
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich posts
    for post in posts:
        reaction = await db.post_reactions.find_one({
            "post_id": post["id"],
            "user_id": current_user["id"]
        })
        post["user_reaction"] = reaction["reaction_type"] if reaction else None
        
        saved = await db.saved_posts.find_one({
            "post_id": post["id"],
            "user_id": current_user["id"]
        })
        post["is_saved"] = saved is not None
    
    return posts
