# Referral (davet kodu) - açık kaynak, PostgreSQL
from fastapi import APIRouter, Depends, HTTPException, Query
import sys
import os
import secrets
import string

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.auth import get_current_user

router = APIRouter(prefix="/referral", tags=["referral"])


def get_current_user_dep():
    from server import get_current_user
    return get_current_user


def _generate_code(length: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


@router.post("/generate")
async def generate_referral_code(current_user: dict = Depends(get_current_user_dep())):
    """Kullanıcı için davet kodu oluştur veya mevcut kodu döndür."""
    from services.postgresql_service import get_referral_code_pg, create_referral_code_pg
    existing = await get_referral_code_pg(current_user["id"])
    if existing:
        return {"code": existing, "message": "Mevcut kod"}
    code = _generate_code(8)
    ok = await create_referral_code_pg(current_user["id"], code)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to create code")
    return {"code": code, "message": "Kod oluşturuldu"}


@router.get("/me")
async def get_my_referral(current_user: dict = Depends(get_current_user_dep())):
    """Benim davet kodum ve kaç kişi davet ettiğim."""
    from services.postgresql_service import get_referral_stats_pg
    return await get_referral_stats_pg(current_user["id"])


@router.post("/apply")
async def apply_referral_code(
    code: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user_dep()),
):
    """Kayıt sonrası davet kodunu uygula (yeni kullanıcı)."""
    from services.postgresql_service import apply_referral_code_pg
    referrer_id = await apply_referral_code_pg(code.strip().upper(), current_user["id"])
    if not referrer_id:
        raise HTTPException(status_code=400, detail="Geçersiz veya zaten kullanılmış kod")
    return {"message": "Davet kodu uygulandı", "referrer_id": referrer_id}
