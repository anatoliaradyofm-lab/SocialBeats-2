"""
Infrastructure routes - Service status, LiveKit calls, MinIO uploads, analytics
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from typing import Optional, List
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


def get_current_user_dep():
    from server import get_current_user
    return get_current_user


# ========== SERVICE STATUS ==========

@router.get("/locations/countries")
async def get_countries(
    search: Optional[str] = None,
    limit: int = 250,
    current_user: dict = Depends(get_current_user_dep())
):
    """REST Countries API - ülke listesi (Leaflet/konum için). search ile filtre."""
    try:
        import httpx
        url = "https://restcountries.com/v3.1/all?fields=name,cca2,latlng,capital,region"
        if search:
            url = f"https://restcountries.com/v3.1/name/{search}?fields=name,cca2,latlng,capital,region"
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                countries = []
                for c in (data if isinstance(data, list) else [data])[:limit]:
                    name = c.get("name", {})
                    countries.append({
                        "code": c.get("cca2", ""),
                        "name": name.get("common", name.get("official", "")),
                        "latlng": c.get("latlng", []),
                        "capital": (c.get("capital") or [""])[0],
                        "region": c.get("region", ""),
                    })
                return {"countries": countries}
    except Exception as e:
        logger.debug(f"REST Countries error: {e}")
    return {"countries": []}


@router.get("/infrastructure/status")
async def get_infrastructure_status():
    """Get status of all infrastructure services"""
    status = {}

    try:
        from services.postgresql_service import get_pool
        pool = await get_pool()
        status["postgresql"] = {"available": pool is not None}
    except Exception:
        status["postgresql"] = {"available": False}

    try:
        from services.clickhouse_service import get_client
        client = get_client()
        status["clickhouse"] = {"available": client is not None}
    except Exception:
        status["clickhouse"] = {"available": False}

    try:
        from services.minio_service import get_client as minio_client
        mc = minio_client()
        status["minio"] = {"available": mc is not None}
    except Exception:
        status["minio"] = {"available": False}

    try:
        from services.livekit_service import get_connection_info
        status["livekit"] = get_connection_info()
    except Exception:
        status["livekit"] = {"available": False}

    try:
        from services.supertokens_service import get_status
        status["supertokens"] = get_status()
    except Exception:
        status["supertokens"] = {"available": False}

    try:
        from services.keycloak_service import is_available as kc_avail
        status["keycloak"] = {"available": kc_avail()}
    except Exception:
        status["keycloak"] = {"available": False}

    try:
        from services.grafana_service import get_status as gf_status
        status["grafana"] = gf_status()
    except Exception:
        status["grafana"] = {"available": False}

    try:
        from services.umami_service import UMAMI_URL, UMAMI_WEBSITE_ID
        status["umami"] = {"available": bool(UMAMI_URL and UMAMI_WEBSITE_ID)}
    except Exception:
        status["umami"] = {"available": False}

    try:
        from services.trench_service import get_status as tr_status
        status["trench"] = tr_status()
    except Exception:
        status["trench"] = {"available": False}

    try:
        from services.jitsu_service import is_available as jitsu_avail
        status["jitsu"] = {"available": jitsu_avail()}
    except Exception:
        status["jitsu"] = {"available": False}

    try:
        from services.evolution_api_service import get_status as evo_status
        status["evolution_api"] = evo_status()
    except Exception:
        status["evolution_api"] = {"available": False}

    try:
        from services.huggingface_service import HF_API_TOKEN
        status["huggingface"] = {"available": bool(HF_API_TOKEN)}
    except Exception:
        status["huggingface"] = {"available": False}

    import redis as redis_lib
    try:
        import os
        r = redis_lib.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))
        r.ping()
        status["redis"] = {"available": True}
    except Exception:
        status["redis"] = {"available": False}

    try:
        from services.meilisearch_service import get_client as ms_client
        status["meilisearch"] = {"available": ms_client() is not None}
    except Exception:
        status["meilisearch"] = {"available": False}

    return status


# ========== LIVEKIT / WEBRTC CALLS ==========

from pydantic import BaseModel


class CallTokenRequest(BaseModel):
    room_name: str


@router.post("/calls/token")
async def get_call_token(
    body: CallTokenRequest,
    current_user: dict = Depends(get_current_user_dep())
):
    """Get a LiveKit token to join a voice/video call room (JSON body: {room_name})"""
    from services.livekit_service import generate_token, get_connection_info
    token = generate_token(current_user["id"], body.room_name)
    info = get_connection_info()
    return {"token": token, "room": body.room_name, **info}


@router.post("/calls/create-room")
async def create_call_room(
    room_name: str = Form(...),
    max_participants: int = Form(10),
    current_user: dict = Depends(get_current_user_dep())
):
    """Create a LiveKit room for calls"""
    from services.livekit_service import create_room
    result = await create_room(room_name, max_participants)
    return result


@router.get("/calls/participants/{room_name}")
async def get_call_participants(
    room_name: str,
    current_user: dict = Depends(get_current_user_dep())
):
    """Get participants in a call room"""
    from services.livekit_service import list_participants
    participants = await list_participants(room_name)
    return {"participants": participants}


@router.delete("/calls/room/{room_name}")
async def end_call_room(
    room_name: str,
    current_user: dict = Depends(get_current_user_dep())
):
    """End a call room"""
    from services.livekit_service import end_room
    success = await end_room(room_name)
    return {"ended": success}


# ========== MINIO FILE UPLOADS ==========

@router.post("/storage/upload")
async def upload_file_to_storage(
    file: UploadFile = File(...),
    folder: str = Form("uploads"),
    current_user: dict = Depends(get_current_user_dep())
):
    """R2 (ana) veya MinIO (yedek) object storage"""
    from services.storage_service import upload_file as storage_upload, get_storage_backend
    contents = await file.read()
    url = storage_upload(contents, file.filename, file.content_type or "application/octet-stream", folder)
    if url:
        return {"url": url, "storage": get_storage_backend()}
    import base64
    data_uri = f"data:{file.content_type};base64,{base64.b64encode(contents).decode()}"
    return {"url": data_uri, "storage": "fallback"}


@router.post("/storage/post-media")
async def upload_post_media_to_r2(
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    current_user: dict = Depends(get_current_user_dep())
):
    """Tek/çoklu fotoğraf/video - R2 (Cloudflare R2). FormData: file veya files[]"""
    from services.storage_service import upload_file as storage_upload, get_storage_backend
    to_upload = (([file] if file else []) + (files or []))
    to_upload = [f for f in to_upload if f and f.filename]
    urls = []
    for i, f in enumerate(to_upload[:10]):
        try:
            contents = await f.read()
            ct = f.content_type or "image/jpeg"
            ext = ".jpg" if "image" in ct else (".mp4" if "video" in ct else ".bin")
            fname = f"post_{current_user['id']}_{uuid.uuid4().hex}{ext}"
            url = storage_upload(contents, fname, ct, "posts")
            if url:
                urls.append({"url": url, "type": "video" if "video" in ct else "image"})
        except Exception as e:
            logger.debug(f"Post media upload #{i} failed: {e}")
    return {"urls": urls, "storage": get_storage_backend()}


@router.post("/storage/avatar")
async def upload_avatar_to_storage(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user_dep())
):
    """Upload avatar - R2 (ana) veya MinIO (yedek)"""
    from services.storage_service import upload_file as storage_upload, get_storage_backend
    contents = await file.read()
    ext = ".jpg" if "jpeg" in (file.content_type or "") else ".png"
    url = storage_upload(contents, f"{current_user['id']}{ext}", file.content_type or "image/jpeg", "avatars")
    if url:
        import os
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
            client_m = AsyncIOMotorClient(os.environ["MONGO_URL"])
            db_m = client_m[os.environ["DB_NAME"]]
            await db_m.users.update_one({"id": current_user["id"]}, {"$set": {"avatar": url}})
        except Exception:
            pass
        try:
            from services.postgres_social_service import upsert_profile, get_profile_pg
            pg_profile = await get_profile_pg(user_id=current_user["id"])
            username = (pg_profile or {}).get("username") or current_user.get("username", "")
            if username:
                await upsert_profile(
                    user_id=current_user["id"],
                    username=username,
                    full_name=(pg_profile or {}).get("full_name") or current_user.get("display_name"),
                    bio=(pg_profile or {}).get("bio") or "",
                    avatar_url=url,
                    is_private=(pg_profile or {}).get("is_private", False),
                )
        except Exception:
            pass
        return {"avatar_url": url, "storage": get_storage_backend()}
    return {"error": "Upload failed, MinIO not available"}


@router.get("/storage/files")
async def list_storage_files(
    prefix: str = Query("", description="File prefix to filter"),
    limit: int = Query(50, le=200),
    current_user: dict = Depends(get_current_user_dep())
):
    """List files in MinIO storage"""
    from services.minio_service import list_files
    files = list_files(prefix, limit)
    return {"files": files}


# ========== REST COUNTRIES (Konum ekleme - Leaflet.js uyumlu) ==========

@router.get("/countries")
async def get_countries(
    search: str = Query("", description="Ülke adı arama"),
    limit: int = Query(50, le=250),
):
    """REST Countries API - Konum seçimi için ülke listesi (Leaflet.js + konum)"""
    try:
        import httpx
        url = "https://restcountries.com/v3.1/all"
        if search:
            url = f"https://restcountries.com/v3.1/name/{search}"
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url, params={"fields": "name,cca2,capital,latlng,flag,region"})
            if r.status_code != 200:
                return {"countries": []}
            data = r.json()
            if not isinstance(data, list):
                data = [data] if data else []
            countries = []
            for c in data[:limit]:
                name = c.get("name", {})
                countries.append({
                    "code": c.get("cca2", ""),
                    "name": name.get("common", ""),
                    "official": name.get("official", ""),
                    "capital": c.get("capital", [""])[0] if c.get("capital") else "",
                    "latlng": c.get("latlng", [0, 0]),
                    "flag": c.get("flag", ""),
                    "region": c.get("region", ""),
                })
            return {"countries": countries}
    except Exception as e:
        logger.debug(f"REST Countries error: {e}")
        return {"countries": []}


# ========== HUGGINGFACE AI ==========

@router.post("/ai/sentiment")
async def analyze_sentiment_api(
    text: str = Form(...),
    current_user: dict = Depends(get_current_user_dep())
):
    """Analyze text sentiment using HuggingFace"""
    from services.huggingface_service import analyze_sentiment
    result = await analyze_sentiment(text)
    return result


@router.post("/ai/detect-language")
async def detect_language_api(
    text: str = Form(...),
    current_user: dict = Depends(get_current_user_dep())
):
    """Detect text language"""
    from services.huggingface_service import detect_language
    result = await detect_language(text)
    return result


@router.post("/ai/classify")
async def classify_text_api(
    text: str = Form(...),
    current_user: dict = Depends(get_current_user_dep())
):
    """Zero-shot text classification"""
    from services.huggingface_service import classify_text
    result = await classify_text(text)
    return result


@router.post("/ai/playlist")
async def generate_ai_playlist_api(
    mood: str = Form(""),
    activity: str = Form(""),
    limit: int = Form(20, le=50),
    current_user: dict = Depends(get_current_user_dep()),
):
    """AI çalma listesi - ruh haline/aktiviteye göre (Gemini API + Trench analytics)"""
    from services.ai_text_service import generate_ai_playlist, get_backend
    from services.trench_service import track
    tracks = await generate_ai_playlist(mood=mood or None, activity=activity or None, limit=limit)
    await track("ai_playlist_generated", current_user["id"], {"mood": mood, "activity": activity, "count": len(tracks or [])})
    if not tracks:
        return {"tracks": [], "backend": get_backend(), "message": "No recommendations (Gemini not configured)"}
    return {"tracks": tracks, "backend": get_backend()}


@router.post("/ai/caption")
async def generate_caption_api(
    text: str = Form(...),
    current_user: dict = Depends(get_current_user_dep())
):
    """AI metin üretimi - Gemini (ana) + HuggingFace (yedek)"""
    from services.ai_text_service import generate_caption
    result = await generate_caption(text)
    return {"caption": result, "backend": __import__("services.ai_text_service", fromlist=["get_backend"]).get_backend()}


@router.post("/ai/playlist")
async def generate_ai_playlist_api(
    mood: str = Form(None),
    activity: str = Form(None),
    limit: int = Form(20, le=50),
    current_user: dict = Depends(get_current_user_dep())
):
    """AI çalma listesi - ruh haline/aktiviteye göre Gemini + Trench analytics"""
    from services.ai_text_service import generate_ai_playlist, get_backend
    from services.trench_service import track
    tracks = await generate_ai_playlist(mood=mood, activity=activity, limit=limit)
    await track("ai_playlist_generated", current_user["id"], {
        "mood": mood, "activity": activity, "track_count": len(tracks or []), "backend": get_backend()
    })
    if not tracks:
        return {"tracks": [], "backend": get_backend(), "message": "AI playlist unavailable (GEMINI_API_KEY required)"}
    return {"tracks": tracks, "backend": get_backend()}


# ========== CLICKHOUSE ANALYTICS ==========

@router.post("/analytics/track")
async def track_analytics_event(
    event_type: str = Form(...),
    properties: str = Form("{}"),
    current_user: dict = Depends(get_current_user_dep())
):
    """Event tracking - Trench (ana) + Jitsu (yedek)"""
    import json
    from services.event_tracking_service import track, get_backend
    props = json.loads(properties) if properties else {}
    ok = track(event_type, current_user["id"], props)
    return {"tracked": ok, "backend": get_backend()}


@router.get("/analytics/top-tracks")
async def get_top_tracks_analytics(
    days: int = Query(7, le=365),
    limit: int = Query(20, le=100),
    country: str = Query(""),
    current_user: dict = Depends(get_current_user_dep())
):
    """Get top tracks from ClickHouse analytics"""
    from services.clickhouse_service import get_top_tracks
    tracks = get_top_tracks(days, limit, country)
    return {"tracks": tracks}


@router.get("/analytics/user-stats")
async def get_user_analytics_stats(
    days: int = Query(30, le=365),
    current_user: dict = Depends(get_current_user_dep())
):
    """Get user listening stats from ClickHouse"""
    from services.clickhouse_service import get_user_stats
    stats = get_user_stats(current_user["id"], days)
    return stats


@router.get("/analytics/dau")
async def get_daily_active_users_api(
    days: int = Query(30, le=365),
    current_user: dict = Depends(get_current_user_dep())
):
    """Get daily active users from ClickHouse"""
    from services.clickhouse_service import get_daily_active_users
    data = get_daily_active_users(days)
    return {"data": data}


# ========== KEYCLOAK AUTH ==========

@router.get("/auth/keycloak/login-url")
async def get_keycloak_login_url(redirect_uri: str = Query(...)):
    """Get Keycloak OIDC login URL"""
    from services.keycloak_service import get_login_url, is_available
    if not is_available():
        raise HTTPException(status_code=503, detail="Keycloak not configured")
    url = await get_login_url(redirect_uri)
    return {"login_url": url}


@router.post("/auth/keycloak/callback")
async def keycloak_callback(code: str = Form(...), redirect_uri: str = Form(...)):
    """Exchange Keycloak auth code for tokens"""
    from services.keycloak_service import exchange_code, is_available
    if not is_available():
        raise HTTPException(status_code=503, detail="Keycloak not configured")
    tokens = await exchange_code(code, redirect_uri)
    if not tokens:
        raise HTTPException(status_code=401, detail="Invalid code")
    return tokens


@router.get("/auth/keycloak/config")
async def get_keycloak_config():
    """Get Keycloak OIDC config for frontend"""
    from services.keycloak_service import get_oidc_config
    return get_oidc_config()


# ========== EVOLUTION API / WHATSAPP ==========

@router.get("/whatsapp/status")
async def get_whatsapp_status(
    current_user: dict = Depends(get_current_user_dep())
):
    """Get WhatsApp connection status"""
    from services.evolution_api_service import get_instance_status, get_status
    status = get_status()
    if status["available"]:
        instance_status = await get_instance_status()
        status["instance"] = instance_status
    return status


@router.post("/whatsapp/send")
async def send_whatsapp_message(
    phone: str = Form(...),
    message: str = Form(...),
    current_user: dict = Depends(get_current_user_dep())
):
    """Send a WhatsApp message via Evolution API"""
    from services.evolution_api_service import send_text, is_available
    if not is_available():
        raise HTTPException(status_code=503, detail="WhatsApp not configured")
    result = await send_text(phone, message)
    return {"sent": result is not None, "result": result}


@router.post("/listening-rooms/{room_id}/invite-whatsapp")
async def invite_to_listening_room_whatsapp(
    room_id: str,
    phone: str = Form(...),
    current_user: dict = Depends(get_current_user_dep())
):
    """Grup dinleme odasına WhatsApp ile davet gönder (Evolution API + Track Player)"""
    import os
    from server import db
    from services.evolution_api_service import send_text, is_available
    room = await db.listening_rooms.find_one({"id": room_id})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.get("host_id") != current_user["id"] and current_user["id"] not in room.get("participants", []):
        raise HTTPException(status_code=403, detail="Not authorized to invite")
    if not is_available():
        raise HTTPException(status_code=503, detail="WhatsApp (Evolution API) not configured")
    base_url = os.environ.get("FRONTEND_URL", "https://socialbeats.app")
    invite_url = f"{base_url}/listening-room/{room_id}"
    msg = f"🎧 {current_user.get('display_name', current_user.get('username', 'Bir arkadaşın'))} seni bir grup dinleme odasına davet ediyor! Katıl: {invite_url}"
    result = await send_text(phone, msg)
    return {"sent": result is not None, "room_id": room_id}


# ========== UMAMI ANALYTICS ==========

@router.get("/umami/stats")
async def get_umami_stats(
    current_user: dict = Depends(get_current_user_dep())
):
    """Get website analytics from Umami"""
    from services.umami_service import get_stats, get_active_users
    stats = await get_stats()
    active = await get_active_users()
    return {"stats": stats, "active_users": active}


@router.get("/umami/tracking-script")
async def get_umami_tracking():
    """Get Umami tracking script for WebViews"""
    from services.umami_service import get_tracking_script
    return {"script": get_tracking_script()}
