# Firebase Auth Routes
# Backend endpoint'leri for Firebase Authentication
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timezone
import uuid
import httpx
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from core.database import db
from core.auth import create_token

router = APIRouter(prefix="/auth", tags=["firebase-auth"])

# Firebase yapılandırması
FIREBASE_PROJECT_ID = os.environ.get('FIREBASE_PROJECT_ID', '')
FIREBASE_WEB_API_KEY = os.environ.get('FIREBASE_WEB_API_KEY', '')
DEV_MODE = os.environ.get('DEV_MODE', 'false').lower() == 'true'

# =====================================================
# MODELLER
# =====================================================
class FirebaseRegisterRequest(BaseModel):
    firebase_uid: str
    email: EmailStr
    username: str
    display_name: Optional[str] = None
    firebase_id_token: str

class FirebaseLoginRequest(BaseModel):
    firebase_id_token: str
    firebase_uid: Optional[str] = None  # optional, for faster lookup

class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    access_token: str
    firebase_uid: Optional[str] = None

# =====================================================
# FIREBASE TOKEN DOĞRULAMA
# =====================================================
async def verify_firebase_token(id_token: str, expected_uid: str = None) -> dict:
    """
    Firebase ID token'ı doğrula
    Google'ın public key'leri ile JWT doğrulaması yapar
    """
    if not FIREBASE_PROJECT_ID:
        if DEV_MODE:
            import logging as _log
            _log.warning("⚠️  Firebase mock mode active — set DEV_MODE=false in production")
            mock_uid = expected_uid or ("mock_uid_" + id_token[:10])
            return {
                "uid": mock_uid,
                "email": "dev@localhost",
                "email_verified": True,
                "is_mock": True
            }
        raise HTTPException(status_code=503, detail="Firebase authentication is not configured.")
    
    try:
        # Firebase Auth REST API ile token doğrulama
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={FIREBASE_WEB_API_KEY}",
                json={"idToken": id_token},
                timeout=10.0
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("users") and len(data["users"]) > 0:
                    user = data["users"][0]
                    return {
                        "uid": user.get("localId"),
                        "email": user.get("email"),
                        "email_verified": user.get("emailVerified", False),
                        "display_name": user.get("displayName")
                    }
            
            raise HTTPException(status_code=401, detail="Geçersiz Firebase token")
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Firebase doğrulama hatası: {str(e)}")

# =====================================================
# ENDPOINT'LER
# =====================================================

@router.post("/firebase-register", response_model=UserResponse)
async def firebase_register(data: FirebaseRegisterRequest):
    """
    Firebase ile kayıt olan kullanıcıyı backend'e kaydet
    """
    # Firebase token doğrula (mock modda expected_uid'yi gönder)
    firebase_user = await verify_firebase_token(data.firebase_id_token, data.firebase_uid)
    
    # Firebase UID eşleşmeli
    if firebase_user["uid"] != data.firebase_uid:
        raise HTTPException(status_code=401, detail="Firebase UID eşleşmiyor")
    
    # Email veya username zaten var mı kontrol et
    existing = await db.users.find_one({
        "$or": [
            {"email": data.email},
            {"username": data.username},
            {"firebase_uid": data.firebase_uid}
        ]
    })
    
    if existing:
        if existing.get("firebase_uid") == data.firebase_uid:
            # Zaten kayıtlı, giriş yap
            token = create_token(existing["id"], existing["email"])
            return UserResponse(
                id=existing["id"],
                email=existing["email"],
                username=existing["username"],
                display_name=existing.get("display_name"),
                avatar_url=existing.get("avatar_url"),
                access_token=token,
                firebase_uid=existing.get("firebase_uid")
            )
        raise HTTPException(status_code=400, detail="E-posta veya kullanıcı adı zaten kullanılıyor")
    
    # Yeni kullanıcı oluştur
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "firebase_uid": data.firebase_uid,
        "email": data.email,
        "username": data.username,
        "display_name": data.display_name or data.username,
        "avatar_url": f"https://api.dicebear.com/7.x/avataaars/svg?seed={data.username}",
        "bio": None,
        "password": None,  # Firebase auth kullanıldığında şifre yok
        "auth_provider": "firebase",
        "connected_services": [],
        "created_at": now,
        "subscription_type": "free",
        "followers_count": 0,
        "following_count": 0,
        "posts_count": 0,
        "favorite_genres": [],
        "favorite_artists": [],
        "is_verified": False,
        "level": 1,
        "xp": 0,
        "badges": ["new_user"],
        "profile_theme": "default",
        "is_online": True,
        "is_private": False
    }
    
    await db.users.insert_one(user_doc)
    
    # JWT token oluştur
    token = create_token(user_id, data.email)
    
    return UserResponse(
        id=user_id,
        email=data.email,
        username=data.username,
        display_name=data.display_name or data.username,
        avatar_url=user_doc["avatar_url"],
        access_token=token,
        firebase_uid=data.firebase_uid
    )

@router.post("/firebase-login", response_model=UserResponse)
async def firebase_login(data: FirebaseLoginRequest):
    """
    Firebase token ile giriş yap
    """
    # Firebase token doğrula (firebase_uid optional, for mock/faster lookup)
    firebase_user = await verify_firebase_token(data.firebase_id_token, data.firebase_uid)
    
    # Kullanıcıyı bul - önce firebase_uid ile ara
    user = await db.users.find_one({"firebase_uid": firebase_user["uid"]}, {"_id": 0})
    
    # Mock modda token'ın kendisi UID olabilir
    if not user and firebase_user.get("is_mock"):
        user = await db.users.find_one({"firebase_uid": data.firebase_id_token}, {"_id": 0})
    
    if not user:
        # Firebase'de kayıtlı ama backend'de kayıtlı değil
        # E-posta ile eşleştirmeyi dene
        user = await db.users.find_one({"email": firebase_user.get("email")}, {"_id": 0})
        
        if user:
            # Mevcut kullanıcıyı Firebase ile ilişkilendir
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {
                    "firebase_uid": firebase_user["uid"],
                    "auth_provider": "firebase"
                }}
            )
        else:
            raise HTTPException(
                status_code=404, 
                detail="Kullanıcı bulunamadı. Lütfen önce kayıt olun."
            )
    
    # Online durumunu güncelle
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"is_online": True}}
    )
    
    # JWT token oluştur
    token = create_token(user["id"], user["email"])
    
    return UserResponse(
        id=user["id"],
        email=user["email"],
        username=user["username"],
        display_name=user.get("display_name"),
        avatar_url=user.get("avatar_url"),
        access_token=token,
        firebase_uid=user.get("firebase_uid")
    )

@router.post("/firebase-verify-token")
async def verify_token_endpoint(data: FirebaseLoginRequest):
    """
    Firebase token'ı doğrula (test endpoint)
    """
    firebase_user = await verify_firebase_token(data.firebase_id_token)
    return {
        "valid": True,
        "uid": firebase_user["uid"],
        "email": firebase_user["email"]
    }
