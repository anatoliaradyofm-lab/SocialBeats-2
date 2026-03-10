"""
AR & Visual Effects Service - Config and presets for client-side integration
- 3D ekolayzır: Three.js
- Yüz filtreleri: MindAR + MediaPipe
- Partikül efektleri: Three.js
- AR müzik deneyimi: Three.js + MindAR
- Ses dalgası animasyonu: Three.js + Expo AV
- Kamera efektleri: VisionCamera + MindAR
- Hareket takibi: MediaPipe
Client (web/mobile) uses these configs with Three.js, MindAR, MediaPipe, VisionCamera, Expo AV.
"""
import os
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

# CDN / static base for MindAR and assets (client can override)
MINDAR_BASE = os.getenv("MINDAR_BASE", "https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist")
MEDIAPIPE_FACE_MODEL = os.getenv("MEDIAPIPE_FACE_MODEL", "face_landmark")


# ---------------------------------------------------------------------------
# 3D Ekolayzır - Three.js (açık kaynak)
# ---------------------------------------------------------------------------
def get_equalizer_config(preset: str = "default") -> Dict[str, Any]:
    """3D ekolayzır preset. Client renders with Three.js bars/cubes."""
    presets = {
        "default": {
            "bands": 16,
            "barWidth": 0.4,
            "gap": 0.1,
            "heightScale": 2.0,
            "colorLow": "#00ff88",
            "colorMid": "#ffaa00",
            "colorHigh": "#ff3366",
            "smoothing": 0.7,
        },
        "neon": {
            "bands": 32,
            "barWidth": 0.25,
            "gap": 0.05,
            "heightScale": 2.5,
            "colorLow": "#00ffff",
            "colorMid": "#ff00ff",
            "colorHigh": "#ffff00",
            "smoothing": 0.5,
        },
        "minimal": {
            "bands": 8,
            "barWidth": 0.6,
            "gap": 0.15,
            "heightScale": 1.5,
            "colorLow": "#ffffff",
            "colorMid": "#ffffff",
            "colorHigh": "#ffffff",
            "smoothing": 0.8,
        },
    }
    return presets.get(preset, presets["default"])


def list_equalizer_presets() -> List[Dict[str, str]]:
    return [
        {"id": "default", "name": "Varsayılan", "description": "16 bant klasik"},
        {"id": "neon", "name": "Neon", "description": "32 bant renkli"},
        {"id": "minimal", "name": "Minimal", "description": "8 bant sade"},
    ]


# ---------------------------------------------------------------------------
# Yüz filtreleri - MindAR + MediaPipe
# ---------------------------------------------------------------------------
def get_face_filters_config() -> Dict[str, Any]:
    """Yüz filtreleri: MindAR (tarayıcı) veya MediaPipe (yüz landmark)."""
    return {
        "mindar": {
            "enabled": True,
            "scriptUrl": f"{MINDAR_BASE}/mindar-face.production.js",
            "faceMesh": True,
        },
        "mediapipe": {
            "enabled": True,
            "model": MEDIAPIPE_FACE_MODEL,
            "maxFaces": 1,
            "refineLandmarks": True,
        },
        "filters": [
            {"id": "none", "name": "Yok", "overlayUrl": None},
            {"id": "glasses", "name": "Gözlük", "overlayUrl": "/static/effects/glasses.png"},
            {"id": "hat", "name": "Şapka", "overlayUrl": "/static/effects/hat.png"},
            {"id": "mask", "name": "Maske", "overlayUrl": "/static/effects/mask.png"},
        ],
    }


# ---------------------------------------------------------------------------
# Partikül efektleri - Three.js
# ---------------------------------------------------------------------------
def get_particle_presets(preset: str = "default") -> Dict[str, Any]:
    """Partikül efektleri preset (Three.js Points/BufferGeometry)."""
    presets = {
        "default": {
            "count": 2000,
            "size": 0.02,
            "color": "#ffffff",
            "opacity": 0.8,
            "sizeAttenuation": True,
            "reactToAudio": True,
        },
        "fireworks": {
            "count": 5000,
            "size": 0.03,
            "color": "#ff6600",
            "opacity": 0.9,
            "sizeAttenuation": True,
            "reactToAudio": True,
        },
        "snow": {
            "count": 3000,
            "size": 0.015,
            "color": "#eeeeff",
            "opacity": 0.7,
            "sizeAttenuation": True,
            "reactToAudio": False,
        },
    }
    return presets.get(preset, presets["default"])


def list_particle_presets() -> List[Dict[str, str]]:
    return [
        {"id": "default", "name": "Varsayılan", "description": "Ses reaktif partiküller"},
        {"id": "fireworks", "name": "Havai fişek", "description": "Yoğun renkli"},
        {"id": "snow", "name": "Kar", "description": "Sakin partiküller"},
    ]


# ---------------------------------------------------------------------------
# AR müzik deneyimi - Three.js + MindAR
# ---------------------------------------------------------------------------
def get_ar_music_config() -> Dict[str, Any]:
    """AR müzik: MindAR ile yüz/ortam + Three.js sahne."""
    return {
        "mindar": {
            "imageTargetUrl": "/static/ar/targets.mind",
            "maxTrack": 1,
        },
        "three": {
            "scene": "music_ar",
            "audioReactive": True,
            "showWaveform": True,
            "showParticles": True,
        },
        "assets": {
            "modelUrl": "/static/ar/music_scene.glb",
            "envMapUrl": "/static/ar/env.hdr",
        },
    }


# ---------------------------------------------------------------------------
# Ses dalgası animasyonu - Three.js + Expo AV
# ---------------------------------------------------------------------------
def get_waveform_config(preset: str = "default") -> Dict[str, Any]:
    """Ses dalgası: Expo AV (getLevels / FFT) + Three.js veya Canvas çizimi."""
    presets = {
        "default": {
            "fftSize": 256,
            "smoothingTimeConstant": 0.8,
            "barCount": 64,
            "color": "#00ff88",
            "heightScale": 1.0,
        },
        "spectrum": {
            "fftSize": 512,
            "smoothingTimeConstant": 0.6,
            "barCount": 128,
            "color": "gradient",
            "heightScale": 1.2,
        },
    }
    return presets.get(preset, presets["default"])


# ---------------------------------------------------------------------------
# Kamera efektleri - VisionCamera + MindAR
# ---------------------------------------------------------------------------
def get_camera_effects_config() -> Dict[str, Any]:
    """Kamera efektleri: VisionCamera (RN) + MindAR (yüz/AR)."""
    return {
        "visionCamera": {
            "enableFrameProcessors": True,
            "enableHighQualityPhotos": True,
        },
        "mindar": {
            "faceTracking": True,
            "imageTracking": False,
        },
        "effects": [
            {"id": "none", "name": "Yok"},
            {"id": "blur", "name": "Bulank"},
            {"id": "vignette", "name": "Vinyet"},
            {"id": "warm", "name": "Sıcak ton"},
            {"id": "cool", "name": "Soğuk ton"},
        ],
    }


# ---------------------------------------------------------------------------
# Hareket takibi - MediaPipe
# ---------------------------------------------------------------------------
def get_motion_tracking_config(mode: str = "pose") -> Dict[str, Any]:
    """Hareket takibi: MediaPipe Pose/Face/Hands."""
    return {
        "solution": "mediapipe",
        "mode": mode,
        "options": {
            "pose": {"modelComplexity": 1, "smoothLandmarks": True},
            "face": {"maxFaces": 1},
            "hands": {"maxNumHands": 2},
        },
        "output": "landmarks",
    }


def list_motion_modes() -> List[Dict[str, str]]:
    return [
        {"id": "pose", "name": "Pose", "description": "Vücut hareketleri"},
        {"id": "face", "name": "Yüz", "description": "Yüz landmark"},
        {"id": "hands", "name": "El", "description": "El hareketleri"},
    ]


# ---------------------------------------------------------------------------
# Optional: MediaPipe server-side (Python) - process image and return landmarks
# ---------------------------------------------------------------------------
async def process_mediapipe_face(image_base64: str) -> Optional[Dict[str, Any]]:
    """Server-side MediaPipe face mesh (optional). Returns landmarks for overlay."""
    try:
        import mediapipe as mp
        import base64
        import numpy as np
        from PIL import Image
        import io
    except ImportError:
        logger.debug("MediaPipe or PIL not installed for server-side face processing")
        return None
    try:
        img_data = base64.b64decode(image_base64)
        img = Image.open(io.BytesIO(img_data)).convert("RGB")
        img_np = np.array(img)
        mp_face = mp.solutions.face_mesh
        with mp_face.FaceMesh(static_image_mode=True, max_num_faces=1) as face_mesh:
            results = face_mesh.process(img_np)
            if not results.multi_face_landmarks:
                return {"faces": []}
            landmarks = []
            for lm in results.multi_face_landmarks[0].landmark:
                landmarks.append({"x": lm.x, "y": lm.y, "z": lm.z})
            return {"faces": [{"landmarks": landmarks}]}
    except Exception as e:
        logger.debug(f"MediaPipe face error: {e}")
        return None


async def process_mediapipe_pose(image_base64: str) -> Optional[Dict[str, Any]]:
    """Server-side MediaPipe pose (optional). Returns pose landmarks."""
    try:
        import mediapipe as mp
        import base64
        import numpy as np
        from PIL import Image
        import io
    except ImportError:
        return None
    try:
        img_data = base64.b64decode(image_base64)
        img = Image.open(io.BytesIO(img_data)).convert("RGB")
        img_np = np.array(img)
        mp_pose = mp.solutions.pose
        with mp_pose.Pose(static_image_mode=True) as pose:
            results = pose.process(img_np)
            if not results.pose_landmarks:
                return {"pose_landmarks": []}
            landmarks = [
                {"x": lm.x, "y": lm.y, "z": lm.z, "visibility": getattr(lm, "visibility", 1)}
                for lm in results.pose_landmarks.landmark
            ]
            return {"pose_landmarks": landmarks}
    except Exception as e:
        logger.debug(f"MediaPipe pose error: {e}")
        return None
