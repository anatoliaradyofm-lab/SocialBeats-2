# Ayarlar: Tema (MMKV + NativeWind), Dil (MMKV + REST Countries), Müzik kalitesi (MMKV + Expo AV),
# Bildirim tercihleri (PostgreSQL + MMKV), Gizlilik (PostgreSQL), Önbellek temizleme (MMKV)
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
import sys
import os
import logging
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.auth import get_current_user
try:
    from core.database import db as mongo_db
except Exception:
    mongo_db = None

router = APIRouter(prefix="/settings", tags=["settings"])
logger = logging.getLogger(__name__)

REST_COUNTRIES_ALL = "https://restcountries.com/v3.1/all?fields=name,cca2,languages"


def get_current_user_dep():
    from server import get_current_user
    return get_current_user


@router.get("/languages")
async def get_languages_list(current_user: dict = Depends(get_current_user_dep())):
    """Dil listesi - REST Countries API (sınırsız). MMKV ile client tarafında seçilen dil saklanır."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(REST_COUNTRIES_ALL)
            if resp.status_code != 200:
                return {"languages": _fallback_languages(), "source": "fallback"}
            data = resp.json()
        langs = set()
        for c in data:
            for code, name in (c.get("languages") or {}).items():
                langs.add((code, name))
        lang_list = [{"code": code, "name": name} for code, name in sorted(langs, key=lambda x: (x[1] or ""))]
        return {"languages": lang_list[:400], "source": "restcountries"}
    except Exception as e:
        logger.debug(f"REST Countries error: {e}")
        return {"languages": _fallback_languages(), "source": "fallback"}


def _fallback_languages():
    return [
        {"code": "tr", "name": "Türkçe"},
        {"code": "en", "name": "English"},
        {"code": "de", "name": "Deutsch"},
        {"code": "fr", "name": "Français"},
        {"code": "es", "name": "Español"},
        {"code": "ar", "name": "العربية"},
        {"code": "ru", "name": "Русский"},
        {"code": "ja", "name": "日本語"},
        {"code": "ko", "name": "한국어"},
        {"code": "zh", "name": "中文"},
    ]


@router.get("/me")
async def get_my_settings(current_user: dict = Depends(get_current_user_dep())):
    """Tema, dil, müzik kalitesi, zaman dilimi, para birimi - PostgreSQL (MMKV sync)."""
    from services.postgresql_service import get_user_settings_pg
    pg = await get_user_settings_pg(current_user["id"])
    return {
        "theme": pg.get("theme", "dark"),
        "profile_theme": pg.get("profile_theme", "default"),
        "locale": pg.get("locale", "tr"),
        "music_quality": pg.get("music_quality", "high"),
        "timezone": pg.get("timezone", "UTC"),
        "currency": pg.get("currency", "USD"),
    }


class SettingsUpdate(BaseModel):
    theme: Optional[str] = None
    profile_theme: Optional[str] = None
    locale: Optional[str] = None
    music_quality: Optional[str] = None
    timezone: Optional[str] = None
    currency: Optional[str] = None


@router.put("/me")
async def update_my_settings(body: SettingsUpdate, current_user: dict = Depends(get_current_user_dep())):
    """Tema / dil / müzik kalitesi - PostgreSQL + MMKV sync."""
    from services.postgresql_service import set_user_settings_pg
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if body.music_quality is not None and body.music_quality not in ("low", "medium", "high"):
        raise HTTPException(status_code=400, detail="music_quality must be low, medium, or high")
    if body.currency is not None and len(body.currency) > 10:
        raise HTTPException(status_code=400, detail="currency code max 10 chars")
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    ok = await set_user_settings_pg(current_user["id"], **updates)
    if not ok:
        raise HTTPException(status_code=500, detail="Update failed")
    return {"message": "Ayarlar güncellendi", "updated": list(updates.keys())}


@router.get("/music-quality")
async def get_music_quality(current_user: dict = Depends(get_current_user_dep())):
    """Müzik kalitesi - PostgreSQL (Expo AV + MMKV)."""
    from services.postgresql_service import get_user_settings_pg
    pg = await get_user_settings_pg(current_user["id"])
    return {"music_quality": pg.get("music_quality", "high")}


@router.put("/music-quality")
async def set_music_quality(
    quality: str = Query(..., pattern="^(low|medium|high)$"),
    current_user: dict = Depends(get_current_user_dep()),
):
    """Müzik kalitesi - PostgreSQL + MMKV + Expo AV."""
    from services.postgresql_service import set_user_settings_pg
    ok = await set_user_settings_pg(current_user["id"], music_quality=quality)
    if not ok:
        raise HTTPException(status_code=500, detail="Update failed")
    return {"music_quality": quality}


@router.get("/notifications")
async def get_notification_preferences(current_user: dict = Depends(get_current_user_dep())):
    """Bildirim tercihleri - PostgreSQL + MMKV."""
    from services.postgresql_service import get_notification_preferences_pg
    prefs = await get_notification_preferences_pg(current_user["id"])
    if not prefs:
        prefs = {
            "push_enabled": True,
            "like_notifications": True,
            "comment_notifications": True,
            "follow_notifications": True,
            "message_notifications": True,
            "tag_notifications": True,
            "new_content_notifications": True,
            "weekly_summary_enabled": True,
            "notification_sound": "default",
        }
    prefs["user_id"] = current_user["id"]
    return prefs


@router.get("/privacy")
async def get_privacy_settings(current_user: dict = Depends(get_current_user_dep())):
    """Gizlilik ayarları - PostgreSQL."""
    from services.postgresql_service import get_privacy_settings_pg
    prefs = await get_privacy_settings_pg(current_user["id"])
    if not prefs:
        prefs = {
            "profile_visible": True,
            "show_activity_status": True,
            "allow_messages_from": "everyone",
            "show_listening_activity": True,
        }
    prefs["user_id"] = current_user["id"]
    return prefs


class PrivacyUpdate(BaseModel):
    profile_visible: Optional[bool] = None
    show_activity_status: Optional[bool] = None
    allow_messages_from: Optional[str] = None
    show_listening_activity: Optional[bool] = None
    allow_tags_from: Optional[str] = None  # "everyone" | "followers" | "none"


@router.put("/privacy")
async def update_privacy_settings(body: PrivacyUpdate, current_user: dict = Depends(get_current_user_dep())):
    """Gizlilik ayarları - PostgreSQL + MongoDB (allow_tags_from)."""
    from services.postgresql_service import set_privacy_settings_pg
    pg_fields = ["profile_visible", "show_activity_status", "allow_messages_from", "show_listening_activity"]
    pg_updates = {k: v for k, v in body.model_dump().items() if v is not None and k in pg_fields}
    if body.allow_messages_from is not None and body.allow_messages_from not in ("everyone", "followers", "nobody"):
        raise HTTPException(status_code=400, detail="allow_messages_from: everyone, followers, or nobody")
    if body.allow_tags_from is not None and body.allow_tags_from not in ("everyone", "followers", "none"):
        raise HTTPException(status_code=400, detail="allow_tags_from: everyone, followers, or none")
    if not pg_updates and body.allow_tags_from is None:
        raise HTTPException(status_code=400, detail="No fields to update")
    if pg_updates:
        ok = await set_privacy_settings_pg(current_user["id"], **pg_updates)
        if not ok:
            raise HTTPException(status_code=500, detail="Update failed")
    if body.allow_tags_from is not None and mongo_db is not None:
        await mongo_db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"allow_tags_from": body.allow_tags_from}}
        )
    return {"message": "Gizlilik ayarları güncellendi"}


@router.get("/currencies")
async def get_currencies_list(current_user: dict = Depends(get_current_user_dep())):
    """Para birimleri listesi - uluslararası uygulama için."""
    return {
        "currencies": [
            {"code": "USD", "name": "US Dollar"},
            {"code": "EUR", "name": "Euro"},
            {"code": "TRY", "name": "Turkish Lira"},
            {"code": "GBP", "name": "British Pound"},
            {"code": "JPY", "name": "Japanese Yen"},
            {"code": "AUD", "name": "Australian Dollar"},
            {"code": "CAD", "name": "Canadian Dollar"},
            {"code": "CHF", "name": "Swiss Franc"},
            {"code": "INR", "name": "Indian Rupee"},
            {"code": "BRL", "name": "Brazilian Real"},
        ]
    }


# Frankfurter.app - ücretsiz, açık kaynak döviz kurları
EXCHANGE_RATES_API = "https://api.frankfurter.app/latest"


@router.get("/exchange-rates")
async def get_exchange_rates(
    base: str = "USD",
    current_user: dict = Depends(get_current_user_dep()),
):
    """Döviz kurları - Frankfurter.app (ücretsiz, API key yok)."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{EXCHANGE_RATES_API}?base={base[:3]}")
            if resp.status_code != 200:
                return {"base": base, "rates": {}, "source": "none"}
            data = resp.json()
            return {
                "base": data.get("base", base),
                "rates": data.get("rates", {}),
                "date": data.get("date"),
                "source": "frankfurter",
            }
    except Exception as e:
        logger.debug(f"Exchange rates error: {e}")
        return {"base": base, "rates": {}, "source": "none"}


@router.post("/cache/clear")
async def clear_cache(current_user: dict = Depends(get_current_user_dep())):
    """Önbellek temizleme - Client MMKV önbelleğini temizlemeli."""
    return {"cleared": True, "message": "Client should clear local MMKV cache."}


# ============== AUDIO ENGINE SETTINGS ==============

class AudioSettingsUpdate(BaseModel):
    music_quality_cellular: Optional[str] = None   # low | normal | high | lossless
    music_quality_wifi: Optional[str] = None
    music_quality_download: Optional[str] = None
    gapless_playback: Optional[bool] = None
    crossfade_duration: Optional[int] = None        # 0–12 seconds
    normalize_volume: Optional[bool] = None
    spatial_audio: Optional[bool] = None
    bt_codec_priority: Optional[List[str]] = None   # ["ldac","aptx_hd","aptx","aac","sbc"]
    car_mode: Optional[bool] = None


@router.get("/audio")
async def get_audio_settings(current_user: dict = Depends(get_current_user_dep())):
    """Ses kalitesi ve oynatma ayarları - MongoDB."""
    if mongo_db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    user = await mongo_db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return {
        "music_quality_cellular": user.get("music_quality_cellular", "high"),
        "music_quality_wifi": user.get("music_quality_wifi", "lossless"),
        "music_quality_download": user.get("music_quality_download", "high"),
        "gapless_playback": user.get("gapless_playback", True),
        "crossfade_duration": user.get("crossfade_duration", 0),
        "normalize_volume": user.get("normalize_volume", True),
        "spatial_audio": user.get("spatial_audio", False),
        "bt_codec_priority": user.get("bt_codec_priority", ["ldac", "aptx_hd", "aptx", "aac", "sbc"]),
        "car_mode": user.get("car_mode", False),
    }


VALID_QUALITY = {"low", "normal", "high", "lossless"}

@router.put("/audio")
async def update_audio_settings(body: AudioSettingsUpdate, current_user: dict = Depends(get_current_user_dep())):
    """Ses kalitesi ve oynatma ayarları güncelle - MongoDB."""
    if mongo_db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    for qf in ("music_quality_cellular", "music_quality_wifi", "music_quality_download"):
        if qf in updates and updates[qf] not in VALID_QUALITY:
            raise HTTPException(status_code=400, detail=f"{qf} must be one of: {', '.join(VALID_QUALITY)}")
    if "crossfade_duration" in updates:
        updates["crossfade_duration"] = max(0, min(12, updates["crossfade_duration"]))
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    await mongo_db.users.update_one({"id": current_user["id"]}, {"$set": updates})
    return {"message": "Ses ayarları güncellendi", "updated": list(updates.keys())}


# ============== ACCESSIBILITY SETTINGS ==============

class AccessibilityUpdate(BaseModel):
    font_size_scale: Optional[float] = None     # 0.85 | 1.0 | 1.15 | 1.3
    high_contrast: Optional[bool] = None
    color_blind_mode: Optional[str] = None      # none | deuteranopia | protanopia | tritanopia
    reduce_motion: Optional[bool] = None
    analytics_consent: Optional[bool] = None


@router.get("/accessibility")
async def get_accessibility_settings(current_user: dict = Depends(get_current_user_dep())):
    """Erişilebilirlik ayarları - MongoDB."""
    if mongo_db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    user = await mongo_db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return {
        "font_size_scale": user.get("font_size_scale", 1.0),
        "high_contrast": user.get("high_contrast", False),
        "color_blind_mode": user.get("color_blind_mode", "none"),
        "reduce_motion": user.get("reduce_motion", False),
        "analytics_consent": user.get("analytics_consent", True),
    }


VALID_COLOR_BLIND = {"none", "deuteranopia", "protanopia", "tritanopia"}

@router.put("/accessibility")
async def update_accessibility_settings(body: AccessibilityUpdate, current_user: dict = Depends(get_current_user_dep())):
    """Erişilebilirlik ayarları güncelle - MongoDB."""
    if mongo_db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "font_size_scale" in updates and updates["font_size_scale"] not in (0.85, 1.0, 1.15, 1.3):
        updates["font_size_scale"] = 1.0
    if "color_blind_mode" in updates and updates["color_blind_mode"] not in VALID_COLOR_BLIND:
        raise HTTPException(status_code=400, detail=f"color_blind_mode must be one of: {', '.join(VALID_COLOR_BLIND)}")
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    await mongo_db.users.update_one({"id": current_user["id"]}, {"$set": updates})
    return {"message": "Erişilebilirlik ayarları güncellendi", "updated": list(updates.keys())}


# ============== COMMENT FILTER ENDPOINTS ==============

@router.get("/comment-filters")
async def get_comment_filters(current_user: dict = Depends(get_current_user_dep())):
    """Yorum filtresi anahtar kelime listesi - MongoDB."""
    if mongo_db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    doc = await mongo_db.comment_filters.find_one({"user_id": current_user["id"]}, {"_id": 0})
    return {"keywords": (doc or {}).get("keywords", [])}


@router.post("/comment-filters")
async def add_comment_filter(body: dict, current_user: dict = Depends(get_current_user_dep())):
    """Yorum filtresi anahtar kelime ekle - MongoDB."""
    if mongo_db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    keyword = (body.get("keyword") or "").strip().lower()
    if not keyword:
        raise HTTPException(status_code=400, detail="keyword required")
    if len(keyword) > 50:
        raise HTTPException(status_code=400, detail="Keyword too long (max 50 chars)")
    await mongo_db.comment_filters.update_one(
        {"user_id": current_user["id"]},
        {"$addToSet": {"keywords": keyword}},
        upsert=True
    )
    return {"message": "Keyword added", "keyword": keyword}


@router.delete("/comment-filters/{keyword}")
async def remove_comment_filter(keyword: str, current_user: dict = Depends(get_current_user_dep())):
    """Yorum filtresi anahtar kelime sil - MongoDB."""
    if mongo_db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    keyword = keyword.strip().lower()
    await mongo_db.comment_filters.update_one(
        {"user_id": current_user["id"]},
        {"$pull": {"keywords": keyword}}
    )
    return {"message": "Keyword removed", "keyword": keyword}


# ============== ACCOUNT FREEZE ENDPOINTS ==============

account_router = APIRouter(prefix="/account", tags=["account"])


@account_router.post("/freeze")
async def freeze_account(body: dict, current_user: dict = Depends(get_current_user_dep())):
    """Hesabı dondur (30 gün) - MongoDB."""
    if mongo_db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    reason = (body.get("reason") or "not_specified")[:100]
    now = datetime.now(timezone.utc).isoformat()
    await mongo_db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "account_frozen": True,
            "frozen_at": now,
            "frozen_reason": reason,
        }}
    )
    return {"frozen": True, "frozen_at": now, "reason": reason}


@account_router.delete("/freeze")
async def unfreeze_account(current_user: dict = Depends(get_current_user_dep())):
    """Hesabı aktifleştir - MongoDB."""
    if mongo_db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    await mongo_db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"account_frozen": False, "frozen_at": None, "frozen_reason": None}}
    )
    return {"frozen": False}


# ============== DATA EXPORT ENDPOINTS (GDPR/KVKK) ==============

@account_router.post("/data-export")
async def request_data_export(current_user: dict = Depends(get_current_user_dep())):
    """GDPR veri dışa aktarma isteği başlat - MongoDB."""
    if mongo_db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    await mongo_db.data_export_jobs.insert_one({
        "id": job_id,
        "user_id": current_user["id"],
        "status": "pending",     # pending | processing | ready | failed
        "requested_at": now,
        "completed_at": None,
        "download_url": None,
    })
    return {"job_id": job_id, "status": "pending", "message": "Export job started. You will be notified when ready."}


@account_router.get("/data-export/status")
async def get_data_export_status(current_user: dict = Depends(get_current_user_dep())):
    """Veri dışa aktarma işi durumu - MongoDB."""
    if mongo_db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    job = await mongo_db.data_export_jobs.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0},
        sort=[("requested_at", -1)]
    )
    if not job:
        return {"status": "none"}
    return {
        "job_id": job.get("id"),
        "status": job.get("status"),
        "requested_at": job.get("requested_at"),
        "completed_at": job.get("completed_at"),
        "download_url": job.get("download_url"),
    }
