# AR & Visual Effects API - Three.js, MindAR, MediaPipe, VisionCamera, Expo AV
from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.auth import get_current_user

router = APIRouter(prefix="/effects", tags=["AR & Effects"])


# ---------- 3D Ekolayzır (Three.js) ----------
@router.get("/equalizer/config")
async def get_equalizer_config(
    preset: str = Query("default", description="Preset: default, neon, minimal"),
    current_user: dict = Depends(get_current_user),
):
    """3D ekolayzır konfigürasyonu - Three.js ile istemcide çizilir."""
    from services.ar_effects_service import get_equalizer_config
    return get_equalizer_config(preset)


@router.get("/equalizer/presets")
async def list_equalizer_presets(current_user: dict = Depends(get_current_user)):
    """3D ekolayzır preset listesi."""
    from services.ar_effects_service import list_equalizer_presets
    return {"presets": list_equalizer_presets()}


# ---------- Yüz filtreleri (MindAR + MediaPipe) ----------
@router.get("/face-filters")
async def get_face_filters(current_user: dict = Depends(get_current_user)):
    """Yüz filtreleri config - MindAR + MediaPipe."""
    from services.ar_effects_service import get_face_filters_config
    return get_face_filters_config()


# ---------- Partikül efektleri (Three.js) ----------
@router.get("/particles/config")
async def get_particles_config(
    preset: str = Query("default", description="default, fireworks, snow"),
    current_user: dict = Depends(get_current_user),
):
    """Partikül efektleri preset - Three.js."""
    from services.ar_effects_service import get_particle_presets
    return get_particle_presets(preset)


@router.get("/particles/presets")
async def list_particle_presets(current_user: dict = Depends(get_current_user)):
    """Partikül preset listesi."""
    from services.ar_effects_service import list_particle_presets
    return {"presets": list_particle_presets()}


# ---------- AR müzik deneyimi (Three.js + MindAR) ----------
@router.get("/ar-music")
async def get_ar_music_config(current_user: dict = Depends(get_current_user)):
    """AR müzik deneyimi - Three.js + MindAR sahne config."""
    from services.ar_effects_service import get_ar_music_config
    return get_ar_music_config()


# ---------- Ses dalgası animasyonu (Three.js + Expo AV) ----------
@router.get("/waveform/config")
async def get_waveform_config(
    preset: str = Query("default", description="default, spectrum"),
    current_user: dict = Depends(get_current_user),
):
    """Ses dalgası animasyonu - Expo AV seviyeleri + Three.js/Canvas."""
    from services.ar_effects_service import get_waveform_config
    return get_waveform_config(preset)


# ---------- Kamera efektleri (VisionCamera + MindAR) ----------
@router.get("/camera")
async def get_camera_effects(current_user: dict = Depends(get_current_user)):
    """Kamera efektleri - VisionCamera + MindAR (mobil)."""
    from services.ar_effects_service import get_camera_effects_config
    return get_camera_effects_config()


# ---------- Hareket takibi (MediaPipe) ----------
@router.get("/motion-tracking/config")
async def get_motion_tracking_config(
    mode: str = Query("pose", description="pose, face, hands"),
    current_user: dict = Depends(get_current_user),
):
    """Hareket takibi config - MediaPipe Pose/Face/Hands."""
    from services.ar_effects_service import get_motion_tracking_config
    return get_motion_tracking_config(mode)


@router.get("/motion-tracking/modes")
async def list_motion_modes(current_user: dict = Depends(get_current_user)):
    """Hareket takibi modları."""
    from services.ar_effects_service import list_motion_modes
    return {"modes": list_motion_modes()}


# ---------- Opsiyonel: Sunucu taraflı MediaPipe (yüz/pose landmark) ----------
@router.post("/motion-tracking/process/face")
async def process_face_image(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Görüntü gönder, yüz landmark'ları al (MediaPipe server-side)."""
    image_base64 = body.get("image_base64")
    if not image_base64:
        raise HTTPException(status_code=400, detail="image_base64 gerekli")
    from services.ar_effects_service import process_mediapipe_face
    result = await process_mediapipe_face(image_base64)
    if result is None:
        raise HTTPException(
            status_code=501,
            detail="MediaPipe sunucu tarafında yüklü değil (pip install mediapipe)",
        )
    return result


@router.post("/motion-tracking/process/pose")
async def process_pose_image(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    """Görüntü gönder, pose landmark'ları al (MediaPipe server-side)."""
    image_base64 = body.get("image_base64")
    if not image_base64:
        raise HTTPException(status_code=400, detail="image_base64 gerekli")
    from services.ar_effects_service import process_mediapipe_pose
    result = await process_mediapipe_pose(image_base64)
    if result is None:
        raise HTTPException(
            status_code=501,
            detail="MediaPipe sunucu tarafında yüklü değil (pip install mediapipe)",
        )
    return result
