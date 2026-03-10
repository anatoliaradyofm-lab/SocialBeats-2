# AI (Gemini) + Moderation (Hugging Face) API routes
# - Şarkı sözü analizi, duygu analizi, otomatik etiketleme (Gemini)
# - İçerik moderasyonu, toksik yorum tespiti (Hugging Face Moderation)
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.auth import get_current_user

router = APIRouter(tags=["AI & Moderation"])


class TextBody(BaseModel):
    text: str = Field(..., min_length=1, max_length=50000)


# ---------- Gemini: şarkı sözü analizi, duygu analizi, otomatik etiketleme ----------

@router.post("/ai/lyrics-analysis")
async def lyrics_analysis(
    body: TextBody,
    current_user: dict = Depends(get_current_user),
):
    """Şarkı sözü analizi - Google Gemini (özet, temalar, ruh hali)."""
    from services.ai_text_service import analyze_lyrics
    result = await analyze_lyrics(body.text)
    if result is None:
        raise HTTPException(status_code=503, detail="Lyrics analysis unavailable (Gemini not configured or error)")
    return {"source": "gemini", "result": result}


@router.post("/ai/sentiment")
async def sentiment_analysis(
    body: TextBody,
    current_user: dict = Depends(get_current_user),
):
    """Duygu analizi - Google Gemini (ana), Hugging Face (yedek)."""
    from services.ai_text_service import analyze_sentiment
    result = await analyze_sentiment(body.text)
    if result is None:
        raise HTTPException(status_code=503, detail="Sentiment analysis unavailable")
    return {"source": "gemini", "result": result}


@router.post("/ai/auto-tag")
async def auto_tag_text(
    body: TextBody,
    current_user: dict = Depends(get_current_user),
):
    """Otomatik etiketleme - Google Gemini (mood, tür, tema)."""
    from services.ai_text_service import auto_tag
    tags = await auto_tag(body.text)
    if tags is None:
        raise HTTPException(status_code=503, detail="Auto-tag unavailable (Gemini not configured or error)")
    return {"source": "gemini", "tags": tags}


# ---------- Hugging Face: içerik moderasyonu, toksik yorum tespiti ----------

@router.post("/moderation/check")
async def moderation_check(
    body: TextBody,
    current_user: dict = Depends(get_current_user),
):
    """İçerik moderasyonu - Hugging Face Moderation (toksiklik skorları)."""
    from services.huggingface_service import moderate_text
    scores = await moderate_text(body.text)
    if not scores:
        return {"safe": True, "scores": {}, "source": "none"}
    # En yüksek toksiklik skoruna göre güvenli mi
    max_score = max((float(v) for v in scores.values() if isinstance(v, (int, float))), default=0.0)
    return {
        "safe": max_score < 0.5,
        "scores": scores,
        "source": "huggingface",
    }


@router.post("/moderation/toxic")
async def toxic_comment_check(
    body: TextBody,
    current_user: dict = Depends(get_current_user),
):
    """Toksik yorum tespiti - Hugging Face Moderation."""
    from services.huggingface_service import moderate_text
    scores = await moderate_text(body.text)
    if not scores:
        return {"toxic": False, "scores": {}, "source": "none"}
    max_score = max((float(v) for v in scores.values() if isinstance(v, (int, float))), default=0.0)
    return {
        "toxic": max_score >= 0.5,
        "scores": scores,
        "source": "huggingface",
    }
