# Rapor nedenleri - client dropdown için (spam, harassment, vb.)
from fastapi import APIRouter, Depends
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.auth import get_current_user

router = APIRouter(prefix="/reports", tags=["reports"])


def get_current_user_dep():
    from server import get_current_user
    return get_current_user


REPORT_REASONS = [
    {"id": "spam", "label_tr": "Spam", "label_en": "Spam"},
    {"id": "harassment", "label_tr": "Taciz", "label_en": "Harassment"},
    {"id": "hate_speech", "label_tr": "Nefret söylemi", "label_en": "Hate speech"},
    {"id": "violence", "label_tr": "Şiddet", "label_en": "Violence"},
    {"id": "nudity", "label_tr": "Çıplaklık", "label_en": "Nudity"},
    {"id": "false_info", "label_tr": "Yanıltıcı bilgi", "label_en": "False information"},
    {"id": "impersonation", "label_tr": "Kimlik taklidi", "label_en": "Impersonation"},
    {"id": "copyright", "label_tr": "Telif ihlali", "label_en": "Copyright"},
    {"id": "other", "label_tr": "Diğer", "label_en": "Other"},
]

REPORT_TYPES = [
    {"id": "user", "label_tr": "Kullanıcı", "label_en": "User"},
    {"id": "post", "label_tr": "Gönderi", "label_en": "Post"},
    {"id": "message", "label_tr": "Mesaj", "label_en": "Message"},
    {"id": "story", "label_tr": "Hikaye", "label_en": "Story"},
    {"id": "comment", "label_tr": "Yorum", "label_en": "Comment"},
]


@router.get("/reasons")
async def get_report_reasons(
    locale: str = "tr",
    current_user: dict = Depends(get_current_user_dep()),
):
    """Rapor nedenleri listesi - client dropdown (POST /api/reports ile kullanılır)."""
    use_en = (locale or "").lower().startswith("en")
    key = "label_en" if use_en else "label_tr"
    return {
        "reasons": [{**r, "label": r[key]} for r in REPORT_REASONS],
        "types": [{**t, "label": t[key]} for t in REPORT_TYPES],
    }
