"""
NextAuth.js uyumlu auth endpoint'leri
Kullanıcı kaydı ve giriş - web/mobile için JWT
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr
from typing import Optional
import logging
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

router = APIRouter(prefix="/auth/nextauth", tags=["nextauth"])
logger = logging.getLogger(__name__)


class NextAuthCredentials(BaseModel):
    email: str
    password: str


class NextAuthRegister(BaseModel):
    email: EmailStr
    password: str
    username: str
    full_name: Optional[str] = None


@router.post("/signin/credentials")
async def nextauth_signin_credentials(body: NextAuthCredentials):
    """NextAuth Credentials provider"""
    from server import db
    from utils.helpers import verify_password, create_access_token
    try:
        user = await db.users.find_one({"email": body.email})
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        pw_hash = user.get("password_hash") or user.get("password", "")
        if not verify_password(body.password, pw_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        token = create_access_token(user["id"], user.get("email", ""))
        return {
            "user": {
                "id": user["id"],
                "email": user.get("email"),
                "name": user.get("display_name") or user.get("username"),
                "image": user.get("avatar_url"),
            },
            "token": token,
            "expires": "24h",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"NextAuth signin error: {e}")
        raise HTTPException(status_code=401, detail="Invalid credentials")


@router.post("/signup")
async def nextauth_signup(body: NextAuthRegister):
    """NextAuth uyumlu kayıt - PostgreSQL profil oluşturur"""
    from server import db
    from utils.helpers import hash_password, create_access_token, generate_id, sanitize_username
    existing = await db.users.find_one({"$or": [{"email": body.email}, {"username": body.username}]})
    if existing:
        raise HTTPException(status_code=400, detail="Email or username already exists")
    user_id = generate_id()
    password_hash = hash_password(body.password)
    username = sanitize_username(body.username)
    user = {
        "id": user_id,
        "email": body.email,
        "username": username,
        "display_name": body.full_name or username,
        "password": password_hash,
        "password_hash": password_hash,
        "avatar_url": None,
        "bio": "",
        "created_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    try:
        from services.postgres_social_service import upsert_profile
        await upsert_profile(user_id, username, body.full_name, "", None, False)
    except Exception:
        pass
    token = create_access_token(user_id, body.email)
    return {"user": {"id": user_id, "email": body.email, "name": body.full_name or username}, "token": token}


class SwitchAccountBody(BaseModel):
    account_id: str


@router.post("/switch-account")
async def nextauth_switch_account(
    body: SwitchAccountBody,
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """Hesap geçişi - NextAuth.js + PostgreSQL. Bağlı hesaplardan birine geçiş; yeni JWT döner."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization[7:]
    from utils.helpers import verify_token, create_access_token
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    current_user_id = payload.get("sub")
    if not current_user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Kendi hesabına veya bağlı hesaplardan birine geçiş
    if body.account_id == current_user_id:
        # Zaten bu hesaptayız; yeni token yine aynı kullanıcı için
        from server import db
        user = await db.users.find_one({"id": body.account_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        new_token = create_access_token(user["id"], user.get("email", ""))
        return {"user": {"id": user["id"], "email": user.get("email"), "name": user.get("display_name") or user.get("username"), "image": user.get("avatar_url")}, "token": new_token, "expires": "24h"}

    # Bağlı hesaplar (PostgreSQL öncelikli)
    from services.postgresql_service import get_linked_accounts_pg
    links = await get_linked_accounts_pg(current_user_id)
    linked_ids = [r["linked_user_id"] for r in links]
    if not linked_ids:
        from server import db
        link_docs = await db.linked_accounts.find({"owner_id": current_user_id}, {"linked_user_id": 1}).to_list(10)
        linked_ids = [d["linked_user_id"] for d in link_docs]
    if body.account_id not in linked_ids:
        raise HTTPException(status_code=403, detail="Account not linked or switch not allowed")

    from server import db
    user = await db.users.find_one({"id": body.account_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    new_token = create_access_token(user["id"], user.get("email", ""))
    return {
        "user": {"id": user["id"], "email": user.get("email"), "name": user.get("display_name") or user.get("username"), "image": user.get("avatar_url")},
        "token": new_token,
        "expires": "24h",
    }


@router.get("/session")
async def nextauth_session(authorization: Optional[str] = Header(None, alias="Authorization")):
    """NextAuth session - JWT doğrula"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization[7:]
    from utils.helpers import verify_token
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    from server import db
    user = await db.users.find_one({"id": payload.get("sub")})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user": {
            "id": user["id"],
            "email": user.get("email"),
            "name": user.get("display_name") or user.get("username"),
            "image": user.get("avatar_url"),
        },
        "expires": "24h",
    }
