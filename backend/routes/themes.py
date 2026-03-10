# Theme Routes
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import db
from core.auth import get_current_user

router = APIRouter(prefix="/themes", tags=["themes"])

# App Themes
APP_THEMES = {
    "dark": {
        "id": "dark",
        "name": "Koyu Tema",
        "description": "Karanlık mod - göz yorgunluğunu azaltır",
        "colors": {
            "background": "#0A0A0B",
            "surface": "#141416",
            "surfaceLight": "#1C1C1F",
            "primary": "#8B5CF6",
            "primaryLight": "#A78BFA",
            "primaryDark": "#7C3AED",
            "secondary": "#A78BFA",
            "text": "#FFFFFF",
            "textSecondary": "#9CA3AF",
            "textMuted": "#6B7280",
            "border": "rgba(255,255,255,0.1)",
            "error": "#EF4444",
            "success": "#22C55E",
            "warning": "#F59E0B",
            "overlay": "rgba(0,0,0,0.5)",
            "glass": "rgba(255,255,255,0.05)",
            "backgroundLight": "#1A1A1A"
        },
        "is_default": True
    },
    "light": {
        "id": "light",
        "name": "Açık Tema",
        "description": "Aydınlık mod - gündüz kullanımı için ideal",
        "colors": {
            "background": "#FFFFFF",
            "surface": "#F5F5F5",
            "surfaceLight": "#EEEEEE",
            "primary": "#7C3AED",
            "primaryLight": "#8B5CF6",
            "primaryDark": "#6D28D9",
            "secondary": "#8B5CF6",
            "text": "#1A1A1A",
            "textSecondary": "#4B5563",
            "textMuted": "#6B7280",
            "border": "rgba(0,0,0,0.1)",
            "error": "#DC2626",
            "success": "#16A34A",
            "warning": "#D97706",
            "overlay": "rgba(0,0,0,0.3)",
            "glass": "rgba(0,0,0,0.05)",
            "backgroundLight": "#E5E5E5"
        },
        "is_default": False
    },
    "midnight": {
        "id": "midnight",
        "name": "Gece Mavisi",
        "description": "Koyu mavi tonlarıyla rahatlatıcı tema",
        "colors": {
            "background": "#0A0F1E",
            "surface": "#111827",
            "surfaceLight": "#1F2937",
            "primary": "#3B82F6",
            "primaryLight": "#60A5FA",
            "primaryDark": "#2563EB",
            "secondary": "#60A5FA",
            "text": "#F9FAFB",
            "textSecondary": "#D1D5DB",
            "textMuted": "#9CA3AF",
            "border": "#374151",
            "error": "#F87171",
            "success": "#34D399",
            "warning": "#FBBF24",
            "overlay": "rgba(0,0,0,0.5)",
            "glass": "rgba(255,255,255,0.05)",
            "backgroundLight": "#1F2937"
        },
        "is_default": False
    },
    "sunset": {
        "id": "sunset",
        "name": "Gün Batımı",
        "description": "Sıcak turuncu ve pembe tonları",
        "colors": {
            "background": "#1A0A0A",
            "surface": "#2D1515",
            "surfaceLight": "#3D2020",
            "primary": "#F97316",
            "primaryLight": "#FB923C",
            "primaryDark": "#EA580C",
            "secondary": "#FB923C",
            "text": "#FFF7ED",
            "textSecondary": "#FED7AA",
            "textMuted": "#FDBA74",
            "border": "#4A2020",
            "error": "#EF4444",
            "success": "#22C55E",
            "warning": "#FBBF24",
            "overlay": "rgba(0,0,0,0.5)",
            "glass": "rgba(255,255,255,0.05)",
            "backgroundLight": "#3D2020"
        },
        "is_default": False
    },
    "forest": {
        "id": "forest",
        "name": "Orman",
        "description": "Doğal yeşil tonlarıyla huzurlu tema",
        "colors": {
            "background": "#0A1A0A",
            "surface": "#152515",
            "surfaceLight": "#1F351F",
            "primary": "#22C55E",
            "primaryLight": "#4ADE80",
            "primaryDark": "#16A34A",
            "secondary": "#4ADE80",
            "text": "#F0FDF4",
            "textSecondary": "#BBF7D0",
            "textMuted": "#86EFAC",
            "border": "#2D4A2D",
            "error": "#F87171",
            "success": "#4ADE80",
            "warning": "#FBBF24",
            "overlay": "rgba(0,0,0,0.5)",
            "glass": "rgba(255,255,255,0.05)",
            "backgroundLight": "#1F351F"
        },
        "is_default": False
    },
    "neon": {
        "id": "neon",
        "name": "Neon",
        "description": "Canlı neon renklerle retro tema",
        "colors": {
            "background": "#0A0A0A",
            "surface": "#1A1A1A",
            "surfaceLight": "#2A2A2A",
            "primary": "#F0ABFC",
            "primaryLight": "#F5D0FE",
            "primaryDark": "#E879F9",
            "secondary": "#E879F9",
            "text": "#FFFFFF",
            "textSecondary": "#E9D5FF",
            "textMuted": "#D946EF",
            "border": "#581C87",
            "error": "#FF6B6B",
            "success": "#00FF88",
            "warning": "#FFE66D",
            "overlay": "rgba(0,0,0,0.5)",
            "glass": "rgba(255,255,255,0.05)",
            "backgroundLight": "#2A2A2A"
        },
        "is_default": False
    }
}

# Profile Themes
PROFILE_THEMES = {
    "default": {
        "id": "default",
        "name": "Varsayılan",
        "gradient": ["#8B5CF6", "#A78BFA"],
        "accent": "#8B5CF6"
    },
    "ocean": {
        "id": "ocean",
        "name": "Okyanus",
        "gradient": ["#0EA5E9", "#38BDF8"],
        "accent": "#0EA5E9"
    },
    "fire": {
        "id": "fire",
        "name": "Ateş",
        "gradient": ["#EF4444", "#F97316"],
        "accent": "#EF4444"
    },
    "aurora": {
        "id": "aurora",
        "name": "Kuzey Işıkları",
        "gradient": ["#22C55E", "#3B82F6"],
        "accent": "#22C55E"
    },
    "sunset_profile": {
        "id": "sunset_profile",
        "name": "Gün Batımı",
        "gradient": ["#F97316", "#EC4899"],
        "accent": "#F97316"
    },
    "royal": {
        "id": "royal",
        "name": "Kraliyet",
        "gradient": ["#7C3AED", "#4F46E5"],
        "accent": "#7C3AED"
    },
    "rose": {
        "id": "rose",
        "name": "Gül",
        "gradient": ["#EC4899", "#F472B6"],
        "accent": "#EC4899"
    }
}

@router.get("")
async def get_all_themes(current_user: dict = Depends(get_current_user)):
    """Get all available app themes"""
    return {
        "app_themes": list(APP_THEMES.values()),
        "profile_themes": list(PROFILE_THEMES.values())
    }

@router.get("/app")
async def get_app_themes(current_user: dict = Depends(get_current_user)):
    """Get available app themes"""
    return list(APP_THEMES.values())

@router.get("/profile")
async def get_profile_themes(current_user: dict = Depends(get_current_user)):
    """Get available profile themes"""
    return list(PROFILE_THEMES.values())

@router.get("/user")
async def get_user_theme_settings(current_user: dict = Depends(get_current_user)):
    """Get current user's theme settings - PostgreSQL (MMKV sync) öncelikli, sonra MongoDB"""
    app_theme_id = "dark"
    profile_theme_id = "default"
    try:
        from services.postgresql_service import get_user_settings_pg
        pg = await get_user_settings_pg(current_user["id"])
        if pg:
            app_theme_id = pg.get("theme", "dark")
            profile_theme_id = pg.get("profile_theme", "default")
    except Exception:
        pass
    if app_theme_id == "dark" and profile_theme_id == "default":
        settings = await db.user_settings.find_one(
            {"user_id": current_user["id"]},
            {"_id": 0}
        )
        if settings:
            app_theme_id = settings.get("theme", "dark")
            profile_theme_id = settings.get("profile_theme", "default")
        if current_user.get("profile_theme"):
            profile_theme_id = current_user.get("profile_theme")
    return {
        "app_theme": APP_THEMES.get(app_theme_id, APP_THEMES["dark"]),
        "profile_theme": PROFILE_THEMES.get(profile_theme_id, PROFILE_THEMES["default"]),
        "app_theme_id": app_theme_id,
        "profile_theme_id": profile_theme_id
    }

@router.put("/user/app")
async def update_user_app_theme(
    theme_id: str = Query(..., description="Theme ID (dark, light, midnight, sunset, forest, neon)"),
    current_user: dict = Depends(get_current_user)
):
    """Update user's app theme - PostgreSQL (MMKV + NativeWind sync) + MongoDB"""
    if theme_id not in APP_THEMES:
        raise HTTPException(status_code=400, detail="Geçersiz tema ID'si")
    try:
        from services.postgresql_service import set_user_settings_pg
        await set_user_settings_pg(current_user["id"], theme=theme_id)
    except Exception:
        pass
    now = datetime.now(timezone.utc).isoformat()
    await db.user_settings.update_one(
        {"user_id": current_user["id"]},
        {"$set": {"theme": theme_id, "updated_at": now}},
        upsert=True
    )
    return {
        "message": "Tema güncellendi",
        "theme": APP_THEMES[theme_id]
    }

@router.put("/user/profile")
async def update_user_profile_theme(
    theme_id: str = Query(..., description="Profile theme ID"),
    current_user: dict = Depends(get_current_user)
):
    """Update user's profile theme - PostgreSQL (MMKV + NativeWind sync) + MongoDB"""
    if theme_id not in PROFILE_THEMES:
        raise HTTPException(status_code=400, detail="Geçersiz profil teması ID'si")
    try:
        from services.postgresql_service import set_user_settings_pg
        await set_user_settings_pg(current_user["id"], profile_theme=theme_id)
    except Exception:
        pass
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"profile_theme": theme_id}}
    )
    await db.user_settings.update_one(
        {"user_id": current_user["id"]},
        {"$set": {"profile_theme": theme_id, "updated_at": now}},
        upsert=True
    )
    return {
        "message": "Profil teması güncellendi",
        "profile_theme": PROFILE_THEMES[theme_id]
    }
