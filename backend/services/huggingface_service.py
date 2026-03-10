"""
Hugging Face Transformers Service - AI/ML capabilities
Sentiment analysis, text classification, music genre prediction,
content recommendations, and language detection
Uses free Hugging Face Inference API with local model fallback
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

HF_API_TOKEN = os.getenv("HF_API_TOKEN", os.getenv("HUGGINGFACE_TOKEN", ""))
HF_API_URL = "https://api-inference.huggingface.co/models"

_sentiment_pipeline = None
_lang_pipeline = None


async def analyze_sentiment(text: str) -> dict:
    """Analyze text sentiment using HuggingFace models"""
    if HF_API_TOKEN:
        result = await _api_call("distilbert-base-uncased-finetuned-sst-2-english", text)
        if result:
            return _parse_sentiment(result)
    return _local_sentiment(text)


async def detect_language(text: str) -> dict:
    """Detect text language"""
    if HF_API_TOKEN:
        result = await _api_call("papluca/xlm-roberta-base-language-detection", text)
        if result:
            return _parse_language(result)
    return _simple_language_detect(text)


async def classify_text(text: str, labels: list = None) -> dict:
    """Zero-shot text classification"""
    if not labels:
        labels = ["music", "social", "news", "sports", "tech", "entertainment"]
    if HF_API_TOKEN:
        result = await _api_call(
            "facebook/bart-large-mnli", text,
            extra_params={"parameters": {"candidate_labels": labels}}
        )
        if result:
            return result
    return {"labels": labels, "scores": [1.0 / len(labels)] * len(labels)}


async def generate_caption(text: str) -> str:
    """Generate a short caption or summary"""
    if HF_API_TOKEN:
        result = await _api_call("facebook/bart-large-cnn", text,
                                 extra_params={"parameters": {"max_length": 60, "min_length": 10}})
        if result and isinstance(result, list) and len(result) > 0:
            return result[0].get("summary_text", text[:60])
    return text[:60] + "..." if len(text) > 60 else text


async def music_genre_classify(text: str) -> dict:
    """Classify text into music genre"""
    genres = ["pop", "rock", "hip-hop", "electronic", "jazz", "classical",
              "r&b", "country", "metal", "indie", "latin", "k-pop"]
    return await classify_text(text, genres)


async def moderate_text(text: str) -> dict:
    """Check text for toxicity using HuggingFace"""
    if HF_API_TOKEN:
        result = await _api_call("unitary/toxic-bert", text)
        if result:
            return _parse_moderation(result)
    try:
        from detoxify import Detoxify
        results = Detoxify('original').predict(text)
        return {k: float(v) for k, v in results.items()}
    except Exception:
        return {"toxicity": 0.0}


async def _api_call(model: str, text: str, extra_params: dict = None) -> Optional[dict]:
    """Make API call to HuggingFace Inference API"""
    try:
        import httpx
        headers = {"Authorization": f"Bearer {HF_API_TOKEN}"}
        payload = {"inputs": text}
        if extra_params:
            payload.update(extra_params)

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(f"{HF_API_URL}/{model}", json=payload, headers=headers)
            if resp.status_code == 200:
                return resp.json()
            logger.debug(f"HF API {model} returned {resp.status_code}")
            return None
    except Exception as e:
        logger.debug(f"HF API call error: {e}")
        return None


def _parse_sentiment(result) -> dict:
    if isinstance(result, list) and len(result) > 0:
        if isinstance(result[0], list):
            result = result[0]
        top = max(result, key=lambda x: x.get("score", 0))
        return {"label": top.get("label", "NEUTRAL").lower(), "score": top.get("score", 0.5)}
    return {"label": "neutral", "score": 0.5}


def _parse_language(result) -> dict:
    if isinstance(result, list) and len(result) > 0:
        if isinstance(result[0], list):
            result = result[0]
        top = max(result, key=lambda x: x.get("score", 0))
        return {"language": top.get("label", "en"), "confidence": top.get("score", 0.5)}
    return {"language": "en", "confidence": 0.5}


def _parse_moderation(result) -> dict:
    if isinstance(result, list) and len(result) > 0:
        if isinstance(result[0], list):
            result = result[0]
        return {item["label"]: item["score"] for item in result}
    return {"toxicity": 0.0}


def _local_sentiment(text: str) -> dict:
    """Basic sentiment without ML model"""
    positive = ["good", "great", "love", "amazing", "best", "happy", "awesome", "nice"]
    negative = ["bad", "hate", "worst", "terrible", "awful", "ugly", "stupid", "boring"]
    words = text.lower().split()
    pos = sum(1 for w in words if w in positive)
    neg = sum(1 for w in words if w in negative)
    if pos > neg:
        return {"label": "positive", "score": min(0.9, 0.5 + pos * 0.1)}
    elif neg > pos:
        return {"label": "negative", "score": min(0.9, 0.5 + neg * 0.1)}
    return {"label": "neutral", "score": 0.5}


def _simple_language_detect(text: str) -> dict:
    """Basic language detection by character ranges"""
    if not text:
        return {"language": "en", "confidence": 0.5}
    for ch in text:
        code = ord(ch)
        if 0x0600 <= code <= 0x06FF:
            return {"language": "ar", "confidence": 0.7}
        if 0x4E00 <= code <= 0x9FFF:
            return {"language": "zh", "confidence": 0.7}
        if 0x3040 <= code <= 0x309F or 0x30A0 <= code <= 0x30FF:
            return {"language": "ja", "confidence": 0.7}
        if 0xAC00 <= code <= 0xD7AF:
            return {"language": "ko", "confidence": 0.7}
        if 0x0400 <= code <= 0x04FF:
            return {"language": "ru", "confidence": 0.7}
    tr_chars = set("çğıöşüÇĞİÖŞÜ")
    if any(ch in tr_chars for ch in text):
        return {"language": "tr", "confidence": 0.8}
    return {"language": "en", "confidence": 0.5}
