# Analytics Router - Trench + ClickHouse + Jitsu + Grafana + Gemini + Expo
from fastapi import APIRouter, Depends, Query
from typing import Optional, List
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.auth import get_current_user
from core.database import db

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/likes")
async def get_like_counts(
    post_ids: str = Query("", description="Virgülle ayrılmış post id listesi"),
    current_user: dict = Depends(get_current_user),
):
    """Anlık beğeni sayıları - Trench + ClickHouse"""
    from services.analytics_service import get_post_like_counts
    ids = [x.strip() for x in post_ids.split(",") if x.strip()]
    result = await get_post_like_counts(ids)
    return {"counts": result}


@router.get("/listening")
async def get_listening(
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
):
    """Toplam dinleme süresi - Trench + Jitsu/ClickHouse"""
    from services.analytics_service import get_total_listening_time
    ms = await get_total_listening_time(current_user["id"], days)
    return {"total_listening_ms": ms, "total_minutes": ms // 60000}


@router.get("/top-artists")
async def get_top_artists(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    """En çok dinlenen sanatçı - Trench + ClickHouse"""
    from services.analytics_service import get_top_artists
    artists = await get_top_artists(current_user["id"], days, limit)
    return {"artists": artists}


@router.get("/top-genres")
async def get_top_genres(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    """En çok dinlenen tür - Trench + ClickHouse"""
    from services.analytics_service import get_top_genres
    genres = await get_top_genres(current_user["id"], days, limit)
    return {"genres": genres}


@router.get("/monthly-report")
async def get_monthly_report(current_user: dict = Depends(get_current_user)):
    """Aylık dinleme raporu - Trench + Grafana dashboard URL"""
    from services.analytics_service import get_monthly_report_url
    url = await get_monthly_report_url()
    return {"dashboard_url": url}


@router.get("/yearly-summary")
async def get_yearly_summary(
    year: Optional[int] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Yıllık özet - Trench + Gemini"""
    from services.analytics_service import get_yearly_summary
    data = await get_yearly_summary(current_user["id"], year)
    return data


@router.get("/weekly-summary")
async def get_weekly_summary(current_user: dict = Depends(get_current_user)):
    """Haftalık özet - Trench + Expo push tetikleme"""
    from services.analytics_service import prepare_weekly_summary
    payload = await prepare_weekly_summary(current_user["id"])
    try:
        from server import send_push_notification
        await send_push_notification(
            current_user["id"],
            payload["title"],
            payload["body"],
            "weekly_summary",
            payload.get("data", {}),
        )
        return {"sent": True, "payload": payload}
    except Exception:
        return {"sent": False, "payload": payload}


@router.get("/followers/growth")
async def get_followers_growth(
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
):
    """Takipçi büyüme grafiği - Trench + Grafana/ClickHouse"""
    from core.database import db
    from datetime import datetime, timezone, timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    follows = await db.follows.find(
        {"following_id": current_user["id"]},
        {"created_at": 1}
    ).to_list(10000)
    by_day = {}
    for f in follows:
        d = (f.get("created_at") or "")[:10]
        if d:
            by_day[d] = by_day.get(d, 0) + 1
    sorted_days = sorted(by_day.items())
    return {"data": [{"date": d, "count": c} for d, c in sorted_days]}


@router.get("/followers/delta")
async def get_followers_delta(
    days: int = Query(7, ge=1, le=90),
    current_user: dict = Depends(get_current_user),
):
    """Takipçi kaybı/kazanımı - Trench + ClickHouse"""
    from services.analytics_service import get_follower_delta
    delta = await get_follower_delta(current_user["id"], days)
    return delta


@router.get("/followers/most-active")
async def get_most_active_followers(
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    """En aktif takipçiler - Trench + ClickHouse"""
    from core.database import db
    from services.clickhouse_service import get_client
    follower_ids = [f["follower_id"] for f in await db.follows.find(
        {"following_id": current_user["id"]},
        {"follower_id": 1}
    ).to_list(1000)]
    if not follower_ids or not get_client():
        return {"followers": []}
    from services.clickhouse_service import get_client as ch_client
    client = ch_client()
    if not client:
        return {"followers": []}
    ids_str = ",".join(f"'{x}'" for x in follower_ids[:100])
    try:
        result = client.query(f"""
            SELECT user_id, count() as activity_count
            FROM event_log WHERE user_id IN ({ids_str})
            AND timestamp > now() - INTERVAL 30 DAY
            GROUP BY user_id ORDER BY activity_count DESC LIMIT {limit}
        """)
        rows = result.result_rows
        users = await db.users.find(
            {"id": {"$in": [r[0] for r in rows]}},
            {"_id": 0, "id": 1, "username": 1, "display_name": 1, "avatar_url": 1}
        ).to_list(len(rows))
        user_map = {u["id"]: u for u in users}
        out = []
        for user_id, cnt in rows:
            u = user_map.get(user_id, {})
            u["activity_count"] = cnt
            out.append(u)
        return {"followers": out}
    except Exception:
        return {"followers": []}


@router.get("/followers/demographics")
async def get_follower_demographics(current_user: dict = Depends(get_current_user)):
    """Takipçi demografisi - Trench + PostgreSQL (yaş/konum)"""
    from core.database import db
    follower_ids = [f["follower_id"] for f in await db.follows.find(
        {"following_id": current_user["id"]},
        {"follower_id": 1}
    ).to_list(1000)]
    users = await db.users.find(
        {"id": {"$in": follower_ids}},
        {"_id": 0, "id": 1, "country": 1, "birth_date": 1}
    ).to_list(len(follower_ids))
    by_country = {}
    by_age = {}
    for u in users:
        c = u.get("country") or u.get("country_code") or "unknown"
        by_country[c] = by_country.get(c, 0) + 1
        bd = u.get("birth_date")
        if bd:
            try:
                from datetime import datetime
                y = int(str(bd)[:4])
                age = datetime.now().year - y
                bucket = "18-24" if age < 25 else "25-34" if age < 35 else "35-44" if age < 45 else "45+"
                by_age[bucket] = by_age.get(bucket, 0) + 1
            except Exception:
                pass
    return {"by_country": by_country, "by_age": by_age}


@router.get("/views/post")
async def get_post_views(
    post_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    """Gönderi görüntülenme - Trench + Jitsu"""
    from core.database import db
    post = await db.posts.find_one({"id": post_id, "user_id": current_user["id"]}, {"views_count": 1})
    if not post:
        return {"views": 0}
    return {"views": post.get("views_count", 0)}


@router.get("/views/story")
async def get_story_views(
    story_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    """Hikaye görüntülenme - Trench + Jitsu"""
    from core.database import db
    story = await db.stories.find_one({"id": story_id, "user_id": current_user["id"]}, {"viewers": 1})
    if not story:
        return {"views": 0, "viewers": []}
    v = story.get("viewers") or []
    return {"views": len(v), "viewers": v[:50]}


@router.get("/views/profile")
async def get_profile_views(
    current_user: dict = Depends(get_current_user),
):
    """Profil görüntülenme - Trench + Jitsu"""
    from core.database import db
    u = await db.users.find_one({"id": current_user["id"]}, {"profile_views_count": 1})
    return {"views": u.get("profile_views_count", 0)}


@router.get("/posts/most-liked")
async def get_most_liked_post(
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
):
    """En çok beğeni alan gönderi - Trench + ClickHouse"""
    from core.database import db
    from services.analytics_service import get_most_liked_post
    post_ids = [p["id"] for p in await db.posts.find({"user_id": current_user["id"]}, {"id": 1}).to_list(1000)]
    row = await get_most_liked_post(current_user["id"], post_ids, days)
    if not row:
        return {"post_id": None, "like_count": 0}
    post = await db.posts.find_one({"id": row["post_id"]}, {"_id": 0})
    return {"post": post, "like_count": row.get("like_count", 0)}


@router.get("/active-hours")
async def get_active_hours(
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
):
    """En aktif saatler - Trench + Grafana heatmap"""
    from services.analytics_service import get_active_hours
    data = await get_active_hours(current_user["id"], days)
    return {"hours": data}


@router.get("/levels")
async def get_levels(current_user: dict = Depends(get_current_user)):
    """Kullanıcı seviyeleri (XP) - Trench + PostgreSQL"""
    from services.postgresql_service import get_user_level_pg
    xp_level = await get_user_level_pg(current_user["id"])
    xp = current_user.get("xp", xp_level.get("xp", 0))
    level = current_user.get("level", xp_level.get("level", 1))
    return {"xp": xp, "level": level}


@router.get("/badges")
async def get_badges(current_user: dict = Depends(get_current_user)):
    """Rozet ve başarımlar - Trench + PostgreSQL"""
    from services.postgresql_service import get_user_badges_pg, get_user_achievements_pg
    badges = await get_user_badges_pg(current_user["id"])
    achievements = await get_user_achievements_pg(current_user["id"])
    mongo_badges = current_user.get("badges") or []
    return {
        "badges": badges or [{"id": b, "name": b} for b in mongo_badges],
        "achievements": achievements,
    }
