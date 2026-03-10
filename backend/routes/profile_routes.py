"""
Profile Routes - PostgreSQL tabanlı profil, takip, engel, yakın arkadaş, gizli hesap
NextAuth + PostgreSQL kullanan uygulamalar için
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(prefix="/profile", tags=["profile"])


def get_current_user_dep():
    from server import get_current_user
    return get_current_user


# ========== Profil ==========

@router.get("/me")
async def get_my_profile(current_user: dict = Depends(get_current_user_dep())):
    """PostgreSQL profil bilgisi (varsa) + MongoDB user merge"""
    from services.postgres_social_service import get_profile_pg
    pg = await get_profile_pg(user_id=current_user["id"])
    if pg:
        return {
            "id": pg.get("user_id"),
            "username": pg.get("username"),
            "full_name": pg.get("full_name"),
            "bio": pg.get("bio"),
            "avatar_url": pg.get("avatar_url"),
            "cover_url": pg.get("cover_url"),
            "is_private": pg.get("is_private", False),
            "updated_at": pg.get("updated_at"),
        }
    return {
        "id": current_user["id"],
        "username": current_user.get("username"),
        "full_name": current_user.get("display_name"),
        "avatar_url": current_user.get("avatar_url") or current_user.get("avatar"),
        "cover_url": None,
        "is_private": False,
    }


@router.get("/{user_id_or_username}")
async def get_profile(
    user_id_or_username: str,
    current_user: dict = Depends(get_current_user_dep()),
):
    """Kullanıcı profil bilgisi - user_id veya username"""
    from services.postgres_social_service import get_profile_pg, is_blocked
    from services.postgresql_service import get_pool

    is_likely_id = len(user_id_or_username) >= 20 and user_id_or_username.replace("-", "").replace("_", "").isalnum()
    user_id_param = user_id_or_username if is_likely_id else None
    username_param = None if is_likely_id else user_id_or_username

    pg = await get_profile_pg(user_id=user_id_param, username=username_param)
    if not pg:
        raise HTTPException(status_code=404, detail="Profile not found")

    if await is_blocked(current_user["id"], pg["user_id"]):
        raise HTTPException(status_code=403, detail="Blocked")

    from services.postgresql_service import get_pool
    pool = await get_pool()
    followers_count = 0
    following_count = 0
    is_following = False
    if pool:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT COUNT(*) as c FROM followers WHERE following_id = $1",
                pg["user_id"],
            )
            followers_count = row["c"] if row else 0
            row = await conn.fetchrow(
                "SELECT COUNT(*) as c FROM followers WHERE follower_id = $1",
                pg["user_id"],
            )
            following_count = row["c"] if row else 0
            row = await conn.fetchrow(
                "SELECT 1 FROM followers WHERE follower_id = $1 AND following_id = $2",
                current_user["id"],
                pg["user_id"],
            )
            is_following = row is not None

    return {
        "id": pg["user_id"],
        "username": pg["username"],
        "full_name": pg["full_name"],
        "bio": pg["bio"],
        "avatar_url": pg.get("avatar_url"),
        "cover_url": pg.get("cover_url"),
        "is_private": pg.get("is_private", False),
        "followers_count": followers_count,
        "following_count": following_count,
        "is_following": is_following,
    }


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None


@router.put("/me")
async def update_profile(
    body: ProfileUpdate,
    current_user: dict = Depends(get_current_user_dep()),
):
    """Profil güncelle (PostgreSQL + Cloudflare R2 URL'leri avatar/cover için)"""
    from services.postgres_social_service import upsert_profile, get_profile_pg
    pg = await get_profile_pg(user_id=current_user["id"])
    username = (pg or {}).get("username") or current_user.get("username", "")
    if not username:
        raise HTTPException(status_code=400, detail="Username required")
    avatar_url = body.avatar_url if body.avatar_url is not None else (pg or {}).get("avatar_url")
    cover_url = body.cover_url if body.cover_url is not None else (pg or {}).get("cover_url")
    ok = await upsert_profile(
        user_id=current_user["id"],
        username=username,
        full_name=body.full_name if body.full_name is not None else (pg or {}).get("full_name"),
        bio=body.bio if body.bio is not None else (pg or {}).get("bio", ""),
        avatar_url=avatar_url or "",
        cover_url=cover_url or "",
        is_private=(pg or {}).get("is_private", False),
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Update failed")
    return {"message": "Profile updated"}


# ========== Gizli Hesap ==========

class PrivateBody(BaseModel):
    is_private: bool


@router.put("/me/private")
async def set_private(
    body: PrivateBody,
    current_user: dict = Depends(get_current_user_dep()),
):
    """Gizli hesap aç/kapat"""
    from services.postgres_social_service import set_private_account
    ok = await set_private_account(current_user["id"], body.is_private)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to update")
    return {"is_private": body.is_private}


# ========== Takip ==========

@router.post("/follow/{user_id}")
async def follow_user(
    user_id: str,
    current_user: dict = Depends(get_current_user_dep()),
):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    from services.postgres_social_service import follow, is_blocked
    if await is_blocked(current_user["id"], user_id):
        raise HTTPException(status_code=403, detail="Blocked")
    ok = await follow(current_user["id"], user_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Follow failed")
    # MongoDB sync: feed, posts, stories takip listesini MongoDB'den okuyor
    try:
        from core.database import db
        await db.follows.insert_one({
            "follower_id": current_user["id"],
            "following_id": user_id,
        })
    except Exception:
        pass
    return {"message": "Following"}


@router.delete("/follow/{user_id}")
async def unfollow_user(
    user_id: str,
    current_user: dict = Depends(get_current_user_dep()),
):
    from services.postgres_social_service import unfollow
    ok = await unfollow(current_user["id"], user_id)
    try:
        from core.database import db
        await db.follows.delete_many({
            "follower_id": current_user["id"],
            "following_id": user_id,
        })
    except Exception:
        pass
    return {"message": "Unfollowed"}


# ========== Engelleme ==========

@router.post("/block/{user_id}")
async def block_user_route(
    user_id: str,
    current_user: dict = Depends(get_current_user_dep()),
):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    from services.postgres_social_service import block_user, unfollow
    await unfollow(current_user["id"], user_id)
    await unfollow(user_id, current_user["id"])
    ok = await block_user(current_user["id"], user_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Block failed")
    # MongoDB sync: feed, posts engelli listesini MongoDB'den okuyor
    try:
        from core.database import db
        await db.follows.delete_many({
            "$or": [
                {"follower_id": current_user["id"], "following_id": user_id},
                {"follower_id": user_id, "following_id": current_user["id"]},
            ]
        })
        await db.blocked_users.insert_one({
            "blocker_id": current_user["id"],
            "blocked_id": user_id,
        })
    except Exception:
        pass
    return {"message": "User blocked"}


@router.delete("/block/{user_id}")
async def unblock_user_route(
    user_id: str,
    current_user: dict = Depends(get_current_user_dep()),
):
    from services.postgres_social_service import unblock_user
    ok = await unblock_user(current_user["id"], user_id)
    try:
        from core.database import db
        await db.blocked_users.delete_many({
            "blocker_id": current_user["id"],
            "blocked_id": user_id,
        })
    except Exception:
        pass
    return {"message": "User unblocked"}


# ========== Yakın Arkadaşlar ==========

@router.post("/close-friends/{user_id}")
async def add_close_friend_route(
    user_id: str,
    current_user: dict = Depends(get_current_user_dep()),
):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot add yourself")
    from services.postgres_social_service import add_close_friend
    ok = await add_close_friend(current_user["id"], user_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Add failed")
    return {"message": "Added to close friends"}


@router.delete("/close-friends/{user_id}")
async def remove_close_friend_route(
    user_id: str,
    current_user: dict = Depends(get_current_user_dep()),
):
    from services.postgres_social_service import remove_close_friend
    await remove_close_friend(current_user["id"], user_id)
    return {"message": "Removed from close friends"}


# ========== Profil istatistikleri (Trench + Grafana) ==========

@router.get("/me/stats")
async def get_my_profile_stats(current_user: dict = Depends(get_current_user_dep())):
    """Profil istatistikleri - Trench + Grafana dashboard URL (açık kaynak, Cloud Run)"""
    from services.analytics_service import get_monthly_report_url
    from services.trench_service import query_events, is_available
    stats = {"grafana_dashboard_url": None, "trench_events_count": 0}
    try:
        url = await get_monthly_report_url()
        if url:
            stats["grafana_dashboard_url"] = url
    except Exception:
        pass
    if is_available():
        try:
            events = await query_events(user_id=current_user["id"], limit=500)
            stats["trench_events_count"] = len(events) if events else 0
        except Exception:
            pass
    return stats


# ========== Rozetler ve başarımlar (PostgreSQL + Trench) ==========

@router.get("/me/level")
async def get_my_level(current_user: dict = Depends(get_current_user_dep())):
    """Kullanıcı seviyesi - PostgreSQL + Trench XP"""
    from services.postgresql_service import get_user_level_pg
    return await get_user_level_pg(current_user["id"])


@router.get("/me/badges")
async def get_my_badges(current_user: dict = Depends(get_current_user_dep())):
    """Rozetler - PostgreSQL"""
    from services.postgresql_service import get_user_badges_pg
    badges = await get_user_badges_pg(current_user["id"])
    return {"badges": badges}


@router.get("/me/achievements")
async def get_my_achievements(current_user: dict = Depends(get_current_user_dep())):
    """Başarımlar - PostgreSQL"""
    from services.postgresql_service import get_user_achievements_pg
    achievements = await get_user_achievements_pg(current_user["id"])
    return {"achievements": achievements}


# ========== QR kod ile profil paylaşma (URL; React Native QR Code ile gösterilir) ==========

def _profile_share_base_url():
    import os
    return os.getenv("APP_BASE_URL", os.getenv("NEXT_PUBLIC_APP_URL", "https://app.socialbeats.com"))


@router.get("/me/share-url")
async def get_my_share_url(current_user: dict = Depends(get_current_user_dep())):
    """Profil paylaşım URL'i - QR kod için (React Native: react-native-qrcode-svg ile bu URL gösterilir)"""
    from services.postgres_social_service import get_profile_pg
    pg = await get_profile_pg(user_id=current_user["id"])
    username = (pg or {}).get("username") or current_user.get("username") or current_user["id"]
    base = _profile_share_base_url().rstrip("/")
    url = f"{base}/profile/{username}"
    return {"url": url, "username": username}


@router.get("/{user_id_or_username}/share-url")
async def get_profile_share_url(
    user_id_or_username: str,
    current_user: dict = Depends(get_current_user_dep()),
):
    """Başka kullanıcı profil paylaşım URL'i - QR kod için"""
    from services.postgres_social_service import get_profile_pg, is_blocked
    is_likely_id = len(user_id_or_username) >= 20 and user_id_or_username.replace("-", "").replace("_", "").isalnum()
    pg = await get_profile_pg(user_id=user_id_or_username if is_likely_id else None, username=None if is_likely_id else user_id_or_username)
    if not pg:
        raise HTTPException(status_code=404, detail="Profile not found")
    if await is_blocked(current_user["id"], pg["user_id"]):
        raise HTTPException(status_code=403, detail="Blocked")
    base = _profile_share_base_url().rstrip("/")
    url = f"{base}/profile/{pg['username']}"
    return {"url": url, "username": pg["username"]}


# ========== Yakın Arkadaşlar ==========

@router.get("/close-friends/list")
async def list_close_friends(
    current_user: dict = Depends(get_current_user_dep()),
    limit: int = Query(100, le=200),
):
    """Yakın arkadaşlar listesi"""
    from services.postgresql_service import get_pool
    pool = await get_pool()
    if not pool:
        return {"friends": []}
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT friend_id FROM close_friends WHERE user_id = $1 LIMIT $2",
            current_user["id"],
            limit,
        )
        friend_ids = [r["friend_id"] for r in rows]
    if not friend_ids:
        return {"friends": []}
    from services.postgres_social_service import get_profile_pg
    friends = []
    for fid in friend_ids:
        p = await get_profile_pg(user_id=fid)
        if p:
            friends.append({
                "id": p["user_id"],
                "username": p["username"],
                "full_name": p["full_name"],
                "avatar_url": p.get("avatar_url"),
            })
    return {"friends": friends}
