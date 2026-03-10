# Birleşik paylaşım API - post, track, playlist, profile (link üretir)
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Literal
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.auth import get_current_user

router = APIRouter(prefix="/share", tags=["share"])


def get_current_user_dep():
    from server import get_current_user
    return get_current_user


def _base_url():
    return os.getenv("FRONTEND_URL", os.getenv("APP_BASE_URL", "https://socialbeats.app")).rstrip("/")


class ShareBody(BaseModel):
    type: Literal["post", "track", "playlist", "profile"]
    id: str


@router.post("")
async def create_share(
    body: ShareBody,
    current_user: dict = Depends(get_current_user_dep()),
):
    """Paylaşım linki üret - post, track, playlist veya profile."""
    base = _base_url()
    if body.type == "post":
        url = f"{base}/post/{body.id}"
    elif body.type == "track":
        url = f"{base}/track/{body.id}"
    elif body.type == "playlist":
        url = f"{base}/playlist/{body.id}"
    elif body.type == "profile":
        url = f"{base}/profile/{body.id}"
    else:
        raise HTTPException(status_code=400, detail="type must be post, track, playlist, or profile")
    return {
        "url": url,
        "type": body.type,
        "id": body.id,
        "qr_data": url,
    }
