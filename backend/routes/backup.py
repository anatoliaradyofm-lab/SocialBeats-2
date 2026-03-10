from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid, json, io, zipfile, csv, os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import db
from core.auth import get_current_user

router = APIRouter(prefix="/backup", tags=["Backup & Data"])

COLLECTIONS_TO_BACKUP = [
    "posts", "comments", "playlists", "listening_history",
    "messages", "follows", "stories", "notifications",
]


async def _collect_user_data(user_id: str, collections: list = None):
    cols = collections or COLLECTIONS_TO_BACKUP
    data = {}
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    data["profile"] = user or {}

    for col_name in cols:
        col = db[col_name]
        query = {"$or": [{"user_id": user_id}, {"sender_id": user_id}]}
        docs = await col.find(query, {"_id": 0}).to_list(50000)
        if docs:
            data[col_name] = docs
    return data


async def _collect_pg_and_r2_media(user_id: str):
    """PostgreSQL + Cloudflare R2: GDPR veri indirme için PG kayıtları ve medya URL listesi."""
    out = {"postgres": {}, "media_urls": []}
    try:
        from services.postgresql_service import get_pool
        from services.postgres_social_service import get_profile_pg
        pool = await get_pool()
        if pool:
            async with pool.acquire() as conn:
                row = await conn.fetchrow("SELECT * FROM profiles WHERE user_id = $1", user_id)
                if row:
                    out["postgres"]["profile"] = dict(row)
                row = await conn.fetchrow("SELECT * FROM notification_preferences_pg WHERE user_id = $1", user_id)
                if row:
                    out["postgres"]["notification_preferences"] = dict(row)
                row = await conn.fetchrow("SELECT * FROM privacy_settings_pg WHERE user_id = $1", user_id)
                if row:
                    out["postgres"]["privacy_settings"] = dict(row)
                row = await conn.fetchrow("SELECT * FROM user_settings_pg WHERE user_id = $1", user_id)
                if row:
                    out["postgres"]["user_settings"] = dict(row)
    except Exception:
        pass
    pg_profile = out["postgres"].get("profile") or {}
    if pg_profile.get("avatar_url"):
        out["media_urls"].append({"type": "avatar", "url": pg_profile["avatar_url"]})
    if pg_profile.get("cover_url"):
        out["media_urls"].append({"type": "cover", "url": pg_profile["cover_url"]})
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "avatar_url": 1})
    if user and user.get("avatar_url") and not any(m.get("type") == "avatar" for m in out["media_urls"]):
        out["media_urls"].append({"type": "avatar", "url": user["avatar_url"]})
    posts = await db.posts.find({"user_id": user_id}, {"_id": 0, "media_urls": 1}).to_list(5000)
    for p in posts:
        for url in (p.get("media_urls") or []):
            if url and isinstance(url, str):
                out["media_urls"].append({"type": "post", "url": url})
    stories = await db.stories.find({"user_id": user_id}, {"_id": 0, "media_url": 1}).to_list(1000)
    for s in stories:
        if s.get("media_url"):
            out["media_urls"].append({"type": "story", "url": s["media_url"]})
    return out


@router.post("/create")
async def create_backup(
    label: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["id"]
    now = datetime.now(timezone.utc)

    data = await _collect_user_data(uid)

    backup_id = str(uuid.uuid4())
    backup_record = {
        "id": backup_id,
        "user_id": uid,
        "label": label or f"Yedek - {now.strftime('%d.%m.%Y %H:%M')}",
        "created_at": now.isoformat(),
        "size_bytes": len(json.dumps(data, default=str).encode()),
        "collections": list(data.keys()),
        "item_counts": {k: len(v) if isinstance(v, list) else 1 for k, v in data.items()},
        "data": data,
        "type": "manual",
    }

    await db.user_backups.insert_one(backup_record)

    return {
        "id": backup_id,
        "label": backup_record["label"],
        "created_at": backup_record["created_at"],
        "size_bytes": backup_record["size_bytes"],
        "collections": backup_record["collections"],
        "item_counts": backup_record["item_counts"],
    }


@router.get("/list")
async def list_backups(current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    backups = await db.user_backups.find(
        {"user_id": uid},
        {"_id": 0, "data": 0}
    ).sort("created_at", -1).to_list(50)

    return {"backups": backups, "total": len(backups)}


@router.get("/{backup_id}")
async def get_backup_details(backup_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    backup = await db.user_backups.find_one(
        {"id": backup_id, "user_id": uid},
        {"_id": 0, "data": 0}
    )
    if not backup:
        raise HTTPException(404, "Yedek bulunamadı")
    return backup


@router.post("/{backup_id}/restore")
async def restore_backup(
    backup_id: str,
    collections: Optional[str] = Query(None, description="Comma-separated collection names to restore selectively"),
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["id"]
    backup = await db.user_backups.find_one({"id": backup_id, "user_id": uid})
    if not backup:
        raise HTTPException(404, "Yedek bulunamadı")

    data = backup.get("data", {})
    selected = collections.split(",") if collections else list(data.keys())
    restored = {}

    for col_name in selected:
        if col_name == "profile":
            profile_data = data.get("profile", {})
            safe_fields = {k: v for k, v in profile_data.items() if k not in ("id", "password", "email")}
            if safe_fields:
                await db.users.update_one({"id": uid}, {"$set": safe_fields})
                restored["profile"] = 1
            continue

        if col_name not in data:
            continue

        docs = data[col_name]
        col = db[col_name]
        count = 0
        for doc in docs:
            doc.pop("_id", None)
            existing = await col.find_one({"id": doc.get("id")}) if doc.get("id") else None
            if not existing:
                await col.insert_one(doc)
                count += 1
        restored[col_name] = count

    await db.user_backups.update_one(
        {"id": backup_id},
        {"$set": {"last_restored_at": datetime.now(timezone.utc).isoformat()}}
    )

    return {"restored": restored, "backup_id": backup_id}


@router.delete("/{backup_id}")
async def delete_backup(backup_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    result = await db.user_backups.delete_one({"id": backup_id, "user_id": uid})
    if result.deleted_count == 0:
        raise HTTPException(404, "Yedek bulunamadı")
    return {"deleted": True}


@router.get("/{backup_id}/compare")
async def compare_backup(backup_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    backup = await db.user_backups.find_one({"id": backup_id, "user_id": uid})
    if not backup:
        raise HTTPException(404, "Yedek bulunamadı")

    current_data = await _collect_user_data(uid)
    backup_data = backup.get("data", {})
    diff = {}

    all_keys = set(list(current_data.keys()) + list(backup_data.keys()))
    for key in all_keys:
        cur = current_data.get(key)
        bak = backup_data.get(key)

        cur_count = len(cur) if isinstance(cur, list) else (1 if cur else 0)
        bak_count = len(bak) if isinstance(bak, list) else (1 if bak else 0)

        if isinstance(cur, list) and isinstance(bak, list):
            cur_ids = {d.get("id") for d in cur if d.get("id")}
            bak_ids = {d.get("id") for d in bak if d.get("id")}
            added = len(cur_ids - bak_ids)
            removed = len(bak_ids - cur_ids)
        else:
            added = max(cur_count - bak_count, 0)
            removed = max(bak_count - cur_count, 0)

        diff[key] = {
            "current_count": cur_count,
            "backup_count": bak_count,
            "added_since_backup": added,
            "removed_since_backup": removed,
        }

    return {
        "backup_id": backup_id,
        "backup_date": backup.get("created_at"),
        "diff": diff,
    }


@router.get("/export/gdpr")
async def export_gdpr_data(
    fmt: str = Query("json", pattern="^(json|csv|zip)$"),
    current_user: dict = Depends(get_current_user),
):
    """Veri indirme (GDPR) - PostgreSQL + Cloudflare R2 medya URL'leri dahil."""
    uid = current_user["id"]
    data = await _collect_user_data(uid)
    pg_media = await _collect_pg_and_r2_media(uid)
    data["postgres_export"] = pg_media.get("postgres", {})
    data["media_urls"] = pg_media.get("media_urls", [])

    export_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    export_record = {
        "id": export_id,
        "user_id": uid,
        "format": fmt,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(days=7)).isoformat(),
        "status": "ready",
        "data": data,
        "size_bytes": len(json.dumps(data, default=str).encode()),
    }

    await db.data_exports.insert_one(export_record)

    summary = {k: len(v) if isinstance(v, list) else 1 for k, v in data.items()}

    return {
        "export_id": export_id,
        "format": fmt,
        "status": "ready",
        "size_bytes": export_record["size_bytes"],
        "summary": summary,
        "expires_at": export_record["expires_at"],
        "download_url": f"/api/backup/export/{export_id}/download",
    }


@router.get("/export/{export_id}/download")
async def download_export(export_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    record = await db.data_exports.find_one({"id": export_id, "user_id": uid})
    if not record:
        raise HTTPException(404, "Dışa aktarma bulunamadı")

    if record.get("expires_at"):
        exp = datetime.fromisoformat(record["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > exp:
            raise HTTPException(410, "İndirme süresi doldu")

    data = record.get("data", {})

    return JSONResponse({
        "export_id": export_id,
        "data": json.loads(json.dumps(data, default=str)),
    })


@router.post("/merge-accounts")
async def merge_accounts(
    source_user_id: str,
    password: str,
    current_user: dict = Depends(get_current_user),
):
    target_uid = current_user["id"]

    source_user = await db.users.find_one({"id": source_user_id})
    if not source_user:
        raise HTTPException(404, "Kaynak hesap bulunamadı")

    import bcrypt
    if not bcrypt.checkpw(password.encode(), source_user.get("password", "").encode()):
        raise HTTPException(403, "Kaynak hesap şifresi yanlış")

    migrated = {}
    for col_name in COLLECTIONS_TO_BACKUP:
        col = db[col_name]
        result = await col.update_many(
            {"user_id": source_user_id},
            {"$set": {"user_id": target_uid, "_migrated_from": source_user_id}}
        )
        if result.modified_count > 0:
            migrated[col_name] = result.modified_count

    await col.update_many(
        {"sender_id": source_user_id},
        {"$set": {"sender_id": target_uid, "_migrated_from": source_user_id}}
    )

    source_followers = await db.follows.count_documents({"following_id": source_user_id})
    if source_followers > 0:
        await db.follows.update_many(
            {"following_id": source_user_id},
            {"$set": {"following_id": target_uid}}
        )
        migrated["followers_transferred"] = source_followers

    await db.users.update_one(
        {"id": source_user_id},
        {"$set": {
            "merged_into": target_uid,
            "merged_at": datetime.now(timezone.utc).isoformat(),
            "is_active": False,
        }}
    )

    return {
        "merged": True,
        "source_user_id": source_user_id,
        "target_user_id": target_uid,
        "migrated": migrated,
    }


@router.get("/settings")
async def get_backup_settings(current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]
    settings = await db.backup_settings.find_one({"user_id": uid}, {"_id": 0})
    if not settings:
        settings = {
            "user_id": uid,
            "auto_backup_enabled": True,
            "auto_backup_frequency": "daily",
            "auto_backup_time": "03:00",
            "google_drive_enabled": False,
            "icloud_enabled": False,
            "auto_cache_clean_days": 30,
            "max_backups_kept": 10,
        }
    return settings


@router.put("/settings")
async def update_backup_settings(
    settings: dict,
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["id"]
    allowed = [
        "auto_backup_enabled", "auto_backup_frequency", "auto_backup_time",
        "google_drive_enabled", "icloud_enabled", "auto_cache_clean_days",
        "max_backups_kept",
    ]
    update = {k: v for k, v in settings.items() if k in allowed}
    update["user_id"] = uid
    update["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.backup_settings.update_one(
        {"user_id": uid}, {"$set": update}, upsert=True
    )
    return {"updated": True, "settings": update}


@router.get("/storage-usage")
async def get_storage_usage(current_user: dict = Depends(get_current_user)):
    uid = current_user["id"]

    categories = {}
    for col_name in COLLECTIONS_TO_BACKUP + ["user_backups", "data_exports"]:
        col = db[col_name]
        docs = await col.find(
            {"$or": [{"user_id": uid}, {"sender_id": uid}]},
            {"_id": 0}
        ).to_list(50000)
        size = len(json.dumps(docs, default=str).encode()) if docs else 0
        categories[col_name] = {"count": len(docs), "size_bytes": size}

    total = sum(c["size_bytes"] for c in categories.values())

    return {
        "total_bytes": total,
        "total_display": _fmt_size(total),
        "categories": {
            k: {**v, "size_display": _fmt_size(v["size_bytes"])}
            for k, v in categories.items()
        },
    }


def _fmt_size(b):
    if b < 1024:
        return f"{b} B"
    if b < 1024 * 1024:
        return f"{b / 1024:.1f} KB"
    if b < 1024 * 1024 * 1024:
        return f"{b / (1024 * 1024):.1f} MB"
    return f"{b / (1024 * 1024 * 1024):.2f} GB"


async def run_auto_backup(user_id: str):
    data = await _collect_user_data(user_id)
    now = datetime.now(timezone.utc)
    backup_id = str(uuid.uuid4())

    record = {
        "id": backup_id,
        "user_id": user_id,
        "label": f"Otomatik Yedek - {now.strftime('%d.%m.%Y')}",
        "created_at": now.isoformat(),
        "size_bytes": len(json.dumps(data, default=str).encode()),
        "collections": list(data.keys()),
        "item_counts": {k: len(v) if isinstance(v, list) else 1 for k, v in data.items()},
        "data": data,
        "type": "auto",
    }
    await db.user_backups.insert_one(record)

    settings = await db.backup_settings.find_one({"user_id": user_id})
    max_kept = (settings or {}).get("max_backups_kept", 10)
    all_backups = await db.user_backups.find(
        {"user_id": user_id, "type": "auto"}
    ).sort("created_at", -1).to_list(1000)

    if len(all_backups) > max_kept:
        to_delete = [b["id"] for b in all_backups[max_kept:]]
        await db.user_backups.delete_many({"id": {"$in": to_delete}})

    return backup_id


async def run_auto_backups_for_all():
    settings_list = await db.backup_settings.find(
        {"auto_backup_enabled": True}
    ).to_list(10000)

    users_backed = 0
    for s in settings_list:
        try:
            await run_auto_backup(s["user_id"])
            users_backed += 1
        except Exception:
            pass

    all_users_without_settings = await db.users.find(
        {"id": {"$nin": [s["user_id"] for s in settings_list]}, "is_active": {"$ne": False}},
        {"id": 1}
    ).to_list(10000)
    for u in all_users_without_settings:
        try:
            await run_auto_backup(u["id"])
            users_backed += 1
        except Exception:
            pass

    return users_backed


async def run_auto_cache_clean():
    settings_list = await db.backup_settings.find(
        {"auto_cache_clean_days": {"$gt": 0}}
    ).to_list(10000)

    for s in settings_list:
        days = s.get("auto_cache_clean_days", 30)
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        uid = s["user_id"]
        await db.data_exports.delete_many({"user_id": uid, "created_at": {"$lt": cutoff}})
