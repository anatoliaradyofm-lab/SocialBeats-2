# i18n - Uluslararasılaştırma: dil listesi, içerik çevirisi (MyMemory + Lingva, ücretsiz)
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.auth import get_current_user

router = APIRouter(prefix="/i18n", tags=["i18n"])


def get_current_user_dep():
    from server import get_current_user
    return get_current_user


# Desteklenen locale'ler (client dropdown için)
SUPPORTED_LOCALES = [
    {"code": "tr", "name": "Türkçe", "flag": "🇹🇷", "countries": ["TR"]},
    {"code": "en", "name": "English", "flag": "🇬🇧", "countries": ["US", "GB", "ZA", "NG", "SG"]},
    {"code": "de", "name": "Deutsch", "flag": "🇩🇪", "countries": ["DE"]},
    {"code": "fr", "name": "Français", "flag": "🇫🇷", "countries": ["FR"]},
    {"code": "es", "name": "Español", "flag": "🇪🇸", "countries": ["ES", "MX", "AR", "CO", "CL", "PE"]},
    {"code": "ar", "name": "العربية", "flag": "🇸🇦", "rtl": True, "countries": ["EG", "SA", "AE"]},
    {"code": "ru", "name": "Русский", "flag": "🇷🇺", "countries": ["RU"]},
    {"code": "ja", "name": "日本語", "flag": "🇯🇵", "countries": ["JP"]},
    {"code": "ko", "name": "한국어", "flag": "🇰🇷", "countries": ["KR"]},
    {"code": "zh", "name": "中文", "flag": "🇨🇳", "countries": ["CN", "SG"]},
    {"code": "it", "name": "Italiano", "flag": "🇮🇹", "countries": ["IT"]},
    {"code": "pt", "name": "Português", "flag": "🇧🇷", "countries": ["BR", "PT"]},
    {"code": "hi", "name": "हिन्दी", "flag": "🇮🇳", "countries": ["IN"]},
    {"code": "id", "name": "Bahasa Indonesia", "flag": "🇮🇩", "countries": ["ID"]},
    {"code": "vi", "name": "Tiếng Việt", "flag": "🇻🇳", "countries": ["VN"]},
    {"code": "th", "name": "ไทย", "flag": "🇹🇭", "countries": ["TH"]},
    {"code": "fil", "name": "Filipino", "flag": "🇵🇭", "countries": ["PH"]},
    {"code": "ur", "name": "اردو", "flag": "🇵🇰", "rtl": True, "countries": ["PK"]},
    {"code": "ms", "name": "Bahasa Melayu", "flag": "🇲🇾", "countries": ["MY", "SG"]},
    {"code": "pl", "name": "Polski", "flag": "🇵🇱", "countries": ["PL"]},
    {"code": "bn", "name": "বাংলা", "flag": "🇮🇳", "countries": ["IN", "BD"]},
    {"code": "ta", "name": "தமிழ்", "flag": "🇮🇳", "countries": ["IN", "SG"]},
    {"code": "te", "name": "తెలుగు", "flag": "🇮🇳", "countries": ["IN"]},
    {"code": "af", "name": "Afrikaans", "flag": "🇿🇦", "countries": ["ZA"]},
    {"code": "zu", "name": "isiZulu", "flag": "🇿🇦", "countries": ["ZA"]},
    {"code": "ha", "name": "Hausa", "flag": "🇳🇬", "countries": ["NG"]},
    {"code": "yo", "name": "Yorùbá", "flag": "🇳🇬", "countries": ["NG"]},
    {"code": "nl", "name": "Nederlands", "flag": "🇳🇱", "countries": ["NL"]},
    {"code": "uk", "name": "Українська", "flag": "🇺🇦", "countries": ["UA"]},
]



@router.get("/locales")
async def get_locales(current_user: dict = Depends(get_current_user_dep())):
    """Desteklenen diller (client i18n dropdown)."""
    return {"locales": SUPPORTED_LOCALES}


class TranslateBody(BaseModel):
    text: str
    target_language: str = "tr"
    source_language: str = "auto"


@router.post("/translate")
async def translate_content(
    body: TranslateBody,
    current_user: dict = Depends(get_current_user_dep()),
):
    """İçerik çevirisi - MyMemory + Lingva (ücretsiz, açık kaynak)."""
    if not body.text or not body.text.strip():
        return {"translated": body.text, "source_language": body.source_language}
    try:
        from services.translation_service import translate_text
        result = await translate_text(
            body.text[:5000],
            target_language=body.target_language,
            source_language=body.source_language,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Translation failed: {e}")
