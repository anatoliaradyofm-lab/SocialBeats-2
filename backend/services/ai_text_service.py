"""
AI Text Service - Google Gemini (primary) + Hugging Face (fallback)
Metin üretimi: caption, özet, öneri, chat
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_AI_API_KEY", ""))
HF_API_TOKEN = os.getenv("HF_API_TOKEN", os.getenv("HUGGINGFACE_TOKEN", ""))


async def generate_text(prompt: str, max_tokens: int = 150) -> Optional[str]:
    """Gemini (ana) -> Hugging Face (yedek)"""
    if GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")
            resp = model.generate_content(prompt)
            if resp and resp.text:
                return resp.text.strip()[:max_tokens * 4]
        except Exception as e:
            logger.debug(f"Gemini failed: {e}")

    if HF_API_TOKEN:
        try:
            from services.huggingface_service import generate_caption
            return await generate_caption(prompt)
        except Exception as e:
            logger.debug(f"HF generate failed: {e}")

    return None


async def generate_caption(text: str) -> Optional[str]:
    """Kısa caption/özet üret - Gemini (ana) + HuggingFace (yedek)"""
    out = await generate_text(f"Summarize in 1-2 sentences: {text}", max_tokens=80)
    if out:
        return out
    try:
        from services.huggingface_service import generate_caption as hf_cap
        return await hf_cap(text)
    except Exception:
        return None


def get_backend() -> str:
    return "gemini" if GEMINI_API_KEY else ("huggingface" if HF_API_TOKEN else "none")


async def generate_ai_playlist(mood: str = None, activity: str = None, limit: int = 20) -> Optional[list]:
    """
    Ruh haline veya aktiviteye göre AI çalma listesi önerisi - Gemini
    Dönen: [{"title": str, "artist": str, "query": str}, ...]
    """
    if not GEMINI_API_KEY:
        return None
    prompt_parts = []
    if mood:
        prompt_parts.append(f"ruh hali: {mood}")
    if activity:
        prompt_parts.append(f"aktiviteler: {activity}")
    if not prompt_parts:
        prompt_parts.append("genel popüler müzik")
    prompt = f"""Aşağıdaki kriterlere uygun {limit} şarkı öner. Her satır formatı: SANATÇI - ŞARKI
Kriter: {', '.join(prompt_parts)}
Sadece şarkı listesi ver, numara veya açıklama ekleme. Her satır: Sanatçı - Şarkı Adı"""
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")
        resp = model.generate_content(prompt)
        if not resp or not resp.text:
            return None
        lines = [l.strip() for l in resp.text.strip().split("\n") if " - " in l][:limit]
        tracks = []
        for line in lines:
            if " - " in line:
                parts = line.split(" - ", 1)
                artist = parts[0].strip()
                title = parts[1].strip() if len(parts) > 1 else ""
                if artist and title:
                    tracks.append({
                        "title": title,
                        "artist": artist,
                        "query": f"{artist} {title}",
                    })
        return tracks
    except Exception as e:
        logger.debug(f"Gemini playlist failed: {e}")
        return None


def _gemini_generate(prompt: str, max_tokens: int = 1024) -> Optional[str]:
    """Gemini ile metin üret; hata durumunda None."""
    if not GEMINI_API_KEY:
        return None
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")
        resp = model.generate_content(prompt)
        if resp and resp.text:
            return resp.text.strip()[: max_tokens * 4]
    except Exception as e:
        logger.debug(f"Gemini _gemini_generate failed: {e}")
    return None


async def analyze_lyrics(lyrics: str) -> Optional[dict]:
    """
    Şarkı sözü analizi - Google Gemini.
    Dönen: { "summary": str, "themes": list[str], "mood": str }
    """
    if not lyrics or not GEMINI_API_KEY:
        return None
    prompt = f"""Aşağıdaki şarkı sözlerini analiz et. Yanıtı SADECE şu JSON formatında ver, başka metin ekleme:
{{"summary": "1-2 cümle özet", "themes": ["tema1", "tema2", "tema3"], "mood": "tek kelime ruh hali (örn: hüzünlü, enerjik, romantik)"}}

Şarkı sözleri:
{lyrics[:8000]}
"""
    out = _gemini_generate(prompt, max_tokens=400)
    if not out:
        return None
    try:
        import json
        # Extract JSON block if model added markdown
        text = out.strip()
        if "```" in text:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                text = text[start:end]
        return json.loads(text)
    except Exception as e:
        logger.debug(f"analyze_lyrics parse failed: {e}")
        return {"summary": out[:300], "themes": [], "mood": "unknown"}


async def analyze_sentiment(text: str) -> Optional[dict]:
    """
    Duygu analizi - Google Gemini (ana). HF yedek için huggingface_service.analyze_sentiment kullanılabilir.
    Dönen: { "label": "positive"|"negative"|"neutral", "score": float }
    """
    if not text or not GEMINI_API_KEY:
        try:
            from services.huggingface_service import analyze_sentiment as hf_sentiment
            return await hf_sentiment(text)
        except Exception:
            return None
    prompt = f"""Aşağıdaki metnin duygu analizini yap. Yanıtı SADECE şu JSON formatında ver:
{{"label": "positive veya negative veya neutral", "score": 0.0-1.0 arası sayı}}

Metin: {text[:2000]}
"""
    out = _gemini_generate(prompt, max_tokens=80)
    if not out:
        try:
            from services.huggingface_service import analyze_sentiment as hf_sentiment
            return await hf_sentiment(text)
        except Exception:
            return None
    try:
        import json
        text = out.strip()
        if "```" in text:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                text = text[start:end]
        data = json.loads(text)
        label = (data.get("label") or "neutral").lower()
        if "posit" in label or "pozitif" in label or "olumlu" in label:
            label = "positive"
        elif "negat" in label or "negatif" in label or "olumsuz" in label:
            label = "negative"
        else:
            label = "neutral"
        score = float(data.get("score", 0.5))
        return {"label": label, "score": min(1.0, max(0.0, score))}
    except Exception as e:
        logger.debug(f"analyze_sentiment parse failed: {e}")
        try:
            from services.huggingface_service import analyze_sentiment as hf_sentiment
            return await hf_sentiment(text)
        except Exception:
            return {"label": "neutral", "score": 0.5}


async def auto_tag(text: str) -> Optional[list]:
    """
    Otomatik etiketleme - Google Gemini. Metin veya şarkı sözü için mood, tür, tema etiketleri.
    Dönen: ["etiket1", "etiket2", ...]
    """
    if not text or not GEMINI_API_KEY:
        return None
    prompt = f"""Aşağıdaki metin/şarkı sözü için müzik/içerik etiketleri üret. Sadece virgülle ayrılmış etiket listesi ver (örn: romantik, pop, hüzünlü, yaz). En fazla 10 etiket, Türkçe veya İngilizce.

Metin: {text[:6000]}
"""
    out = _gemini_generate(prompt, max_tokens=200)
    if not out:
        return None
    tags = []
    for part in out.replace("\n", ",").split(","):
        t = part.strip().strip(".").strip()
        if t and len(t) < 50:
            tags.append(t)
    return tags[:15] if tags else None
