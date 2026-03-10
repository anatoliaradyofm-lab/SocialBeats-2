# Security Routes - Admin security dashboard, 2FA, recovery codes, device management
# Provides security stats, moderation logs, attack monitoring, and user security features

from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
import uuid
import secrets
import hashlib
import base64
import os

router = APIRouter(prefix="/security", tags=["Security"])

db = None
get_current_user = None

def init_security_router(database, auth_func):
    global db, get_current_user
    db = database
    get_current_user = auth_func


# =====================================================
# USER SECURITY SETTINGS
# =====================================================

@router.get("/settings")
async def get_security_settings(current_user: dict = Depends(lambda: get_current_user)):
    """Get user security settings (called by SecurityScreen as /auth/security-settings)"""
    user = await db.users.find_one(
        {"id": current_user["id"]},
        {"_id": 0, "two_factor_enabled": 1, "two_factor_methods": 1, "biometric_enabled": 1, "login_alerts": 1, "webauthn_enabled": 1}
    )
    settings = await db.user_settings.find_one({"user_id": current_user["id"]}, {"_id": 0})
    
    has_recovery = await db.recovery_codes.count_documents({"user_id": current_user["id"], "used": False})
    
    return {
        "settings": {
            "two_factor_enabled": user.get("two_factor_enabled", False) if user else False,
            "two_factor_methods": user.get("two_factor_methods", []) if user else [],
            "biometric_enabled": settings.get("biometric_enabled", False) if settings else False,
            "login_alerts": settings.get("login_alerts", True) if settings else True,
            "webauthn_enabled": user.get("webauthn_enabled", False) if user else False,
            "recovery_codes_count": has_recovery,
        }
    }


# =====================================================
# RECOVERY CODES (10 printable codes)
# =====================================================

@router.post("/recovery-codes/generate")
async def generate_recovery_codes(current_user: dict = Depends(lambda: get_current_user)):
    """Generate 10 recovery codes. Old codes are invalidated."""
    await db.recovery_codes.delete_many({"user_id": current_user["id"]})
    
    codes = []
    now = datetime.now(timezone.utc).isoformat()
    for _ in range(10):
        raw = secrets.token_hex(4).upper()
        code_str = f"{raw[:4]}-{raw[4:]}"
        hashed = hashlib.sha256(code_str.encode()).hexdigest()
        codes.append(code_str)
        await db.recovery_codes.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "code_hash": hashed,
            "used": False,
            "created_at": now,
        })
    
    return {"codes": codes, "count": 10, "message": "Bu kodları güvenli bir yere kaydedin. Her kod sadece bir kez kullanılabilir."}

@router.post("/recovery-codes/verify")
async def verify_recovery_code(data: Dict[str, Any], current_user: dict = Depends(lambda: get_current_user)):
    """Verify and consume a recovery code (for 2FA bypass)"""
    code = data.get("code", "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Kod gerekli")
    
    hashed = hashlib.sha256(code.encode()).hexdigest()
    result = await db.recovery_codes.find_one({
        "user_id": current_user["id"],
        "code_hash": hashed,
        "used": False,
    })
    
    if not result:
        raise HTTPException(status_code=400, detail="Geçersiz veya kullanılmış kod")
    
    await db.recovery_codes.update_one(
        {"id": result["id"]},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"valid": True, "remaining": await db.recovery_codes.count_documents({"user_id": current_user["id"], "used": False})}

@router.get("/recovery-codes/count")
async def get_recovery_codes_count(current_user: dict = Depends(lambda: get_current_user)):
    count = await db.recovery_codes.count_documents({"user_id": current_user["id"], "used": False})
    return {"remaining": count}


# =====================================================
# DEVICE MANAGEMENT
# =====================================================

@router.get("/devices")
async def get_trusted_devices(current_user: dict = Depends(lambda: get_current_user)):
    """Get user's known devices"""
    devices = await db.user_devices.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("last_active", -1).to_list(20)
    return {"devices": devices}

@router.delete("/devices/{device_id}")
async def remove_device(device_id: str, current_user: dict = Depends(lambda: get_current_user)):
    """Remove a trusted device"""
    result = await db.user_devices.delete_one({
        "id": device_id, "user_id": current_user["id"]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cihaz bulunamadı")
    return {"message": "Cihaz kaldırıldı"}

@router.post("/devices/{device_id}/trust")
async def trust_device(device_id: str, current_user: dict = Depends(lambda: get_current_user)):
    """Mark device as trusted"""
    await db.user_devices.update_one(
        {"id": device_id, "user_id": current_user["id"]},
        {"$set": {"is_trusted": True, "trusted_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Cihaz güvenilir olarak işaretlendi"}


# =====================================================
# SUSPICIOUS LOGIN DETECTION
# =====================================================

@router.get("/login-history")
async def get_login_history(
    limit: int = Query(20, le=50),
    current_user: dict = Depends(lambda: get_current_user)
):
    """Get login history with suspicious flags"""
    logins = await db.login_history.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    return {"logins": logins}


# =====================================================
# WEBAUTHN (Security Key) BASIC ENDPOINTS
# =====================================================

@router.post("/webauthn/register-begin")
async def webauthn_register_begin(current_user: dict = Depends(lambda: get_current_user)):
    """Begin WebAuthn registration (returns challenge)"""
    challenge = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc).isoformat()
    
    await db.webauthn_challenges.update_one(
        {"user_id": current_user["id"]},
        {"$set": {
            "user_id": current_user["id"],
            "challenge": challenge,
            "type": "registration",
            "created_at": now,
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
        }},
        upsert=True
    )
    
    rp_id = os.environ.get("WEBAUTHN_RP_ID", "socialbeats.app")
    rp_name = os.environ.get("WEBAUTHN_RP_NAME", "SocialBeats")
    
    return {
        "challenge": challenge,
        "rp": {"id": rp_id, "name": rp_name},
        "user": {
            "id": current_user["id"],
            "name": current_user.get("username", current_user.get("email", "")),
            "displayName": current_user.get("display_name", current_user.get("username", "")),
        },
        "pubKeyCredParams": [
            {"type": "public-key", "alg": -7},
            {"type": "public-key", "alg": -257},
        ],
        "timeout": 60000,
        "attestation": "none",
    }

@router.post("/webauthn/register-complete")
async def webauthn_register_complete(data: Dict[str, Any], current_user: dict = Depends(lambda: get_current_user)):
    """Complete WebAuthn registration (store credential)"""
    challenge_doc = await db.webauthn_challenges.find_one({
        "user_id": current_user["id"],
        "type": "registration",
    })
    
    if not challenge_doc:
        raise HTTPException(status_code=400, detail="Kayıt oturumu bulunamadı")
    
    expires = datetime.fromisoformat(challenge_doc["expires_at"].replace("Z", "+00:00"))
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Oturum süresi doldu")
    
    now = datetime.now(timezone.utc).isoformat()
    credential_id = data.get("credential_id", str(uuid.uuid4()))
    
    await db.webauthn_credentials.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "credential_id": credential_id,
        "public_key": data.get("public_key", ""),
        "sign_count": 0,
        "name": data.get("name", "Güvenlik Anahtarı"),
        "created_at": now,
    })
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"webauthn_enabled": True}}
    )
    
    await db.webauthn_challenges.delete_one({"user_id": current_user["id"], "type": "registration"})
    
    return {"message": "Güvenlik anahtarı kaydedildi", "credential_id": credential_id}

@router.get("/webauthn/credentials")
async def get_webauthn_credentials(current_user: dict = Depends(lambda: get_current_user)):
    """List registered security keys"""
    creds = await db.webauthn_credentials.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "public_key": 0}
    ).to_list(10)
    return {"credentials": creds}

@router.delete("/webauthn/credentials/{credential_id}")
async def delete_webauthn_credential(credential_id: str, current_user: dict = Depends(lambda: get_current_user)):
    """Remove a security key"""
    await db.webauthn_credentials.delete_one({
        "id": credential_id, "user_id": current_user["id"]
    })
    remaining = await db.webauthn_credentials.count_documents({"user_id": current_user["id"]})
    if remaining == 0:
        await db.users.update_one({"id": current_user["id"]}, {"$set": {"webauthn_enabled": False}})
    return {"message": "Güvenlik anahtarı silindi"}


# =====================================================
# AES-256-GCM ENCRYPTION UTILITY
# =====================================================

@router.get("/encryption/status")
async def get_encryption_status(current_user: dict = Depends(lambda: get_current_user)):
    """Check if encryption key is configured"""
    key = os.environ.get("ENCRYPTION_KEY", "")
    return {
        "configured": len(key) >= 32,
        "algorithm": "AES-256-GCM",
        "key_size": 256,
    }


@router.get("/stats")
async def get_security_stats(current_user: dict = Depends(lambda: get_current_user)):
    """Get security statistics (admin only)"""
    # Check if user is admin
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        from services.security_middleware import rate_limiter, brute_force_protection
        from services.content_moderation import content_moderator
        from services.async_moderation import moderation_queue
        
        # Get rate limiter stats
        rate_stats = rate_limiter.get_stats()
        
        # Get content moderation stats
        mod_stats = await content_moderator.get_moderation_stats()
        
        # Get async moderation queue stats
        queue_stats = moderation_queue.get_stats()
        
        # Get recent security logs from DB
        recent_attacks = []
        if db:
            cursor = db.security_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(20)
            recent_attacks = await cursor.to_list(20)
        
        return {
            "rate_limiting": rate_stats,
            "content_moderation": mod_stats,
            "async_moderation_queue": queue_stats,
            "brute_force": {
                "locked_accounts": len(brute_force_protection.locked_accounts)
            },
            "recent_security_events": recent_attacks,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except ImportError as e:
        return {
            "error": f"Security services not available: {e}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


@router.get("/moderation/logs")
async def get_moderation_logs(
    limit: int = 50,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Get content moderation logs (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not db:
        return {"logs": [], "error": "Database not available"}
    
    cursor = db.moderation_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
    logs = await cursor.to_list(limit)
    
    return {
        "logs": logs,
        "count": len(logs)
    }


@router.get("/attacks")
async def get_attack_logs(
    limit: int = 100,
    attack_type: str = None,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Get attack logs (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not db:
        return {"attacks": [], "error": "Database not available"}
    
    query = {}
    if attack_type:
        query["type"] = attack_type
    
    cursor = db.security_logs.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit)
    attacks = await cursor.to_list(limit)
    
    return {
        "attacks": attacks,
        "count": len(attacks)
    }


@router.post("/unblock-ip")
async def unblock_ip(
    ip: str,
    current_user: dict = Depends(lambda: get_current_user)
):
    """Unblock an IP address (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        from services.security_middleware import rate_limiter
        
        if ip in rate_limiter.blocked_ips:
            del rate_limiter.blocked_ips[ip]
            return {"message": f"IP {ip} unblocked", "success": True}
        else:
            return {"message": f"IP {ip} was not blocked", "success": False}
    except ImportError:
        raise HTTPException(status_code=500, detail="Security service not available")


@router.get("/health")
async def security_health():
    """Check security services health"""
    status = {
        "security_middleware": False,
        "content_moderation": False,
        "nudenet_detector": False
    }
    
    try:
        from services.security_middleware import rate_limiter
        status["security_middleware"] = True
    except ImportError:
        pass
    
    try:
        from services.content_moderation import content_moderator
        status["content_moderation"] = True
        status["nudenet_detector"] = content_moderator.detector is not None
    except ImportError:
        pass
    
    return {
        "status": status,
        "all_healthy": all(status.values()),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
