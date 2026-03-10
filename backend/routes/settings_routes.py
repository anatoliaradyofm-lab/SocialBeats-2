# Ayarlar: Tema (MMKV + NativeWind), Dil (MMKV + REST Countries), Müzik kalitesi (MMKV + Expo AV),
# Bildirim tercihleri (PostgreSQL + MMKV), Gizlilik (PostgreSQL), Önbellek temizleme (MMKV)
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
import sys
import os
import logging

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.auth import get_current_user

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


@router.put("/privacy")
async def update_privacy_settings(body: PrivacyUpdate, current_user: dict = Depends(get_current_user_dep())):
    """Gizlilik ayarları - PostgreSQL."""
    from services.postgresql_service import set_privacy_settings_pg
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if body.allow_messages_from is not None and body.allow_messages_from not in ("everyone", "followers", "nobody"):
        raise HTTPException(status_code=400, detail="allow_messages_from: everyone, followers, or nobody")
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    ok = await set_privacy_settings_pg(current_user["id"], **updates)
    if not ok:
        raise HTTPException(status_code=500, detail="Update failed")
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
