"""
Keycloak Service - Open-source Identity and Access Management (IAM)
Provides SSO, OIDC, SAML, social login, MFA, and user federation
Can be used alongside or as replacement for SuperTokens/NextAuth
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "socialbeats")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "socialbeats-app")
KEYCLOAK_CLIENT_SECRET = os.getenv("KEYCLOAK_CLIENT_SECRET", "")
KEYCLOAK_ADMIN_USER = os.getenv("KEYCLOAK_ADMIN_USER", "admin")
KEYCLOAK_ADMIN_PASSWORD = os.getenv("KEYCLOAK_ADMIN_PASSWORD", "")

_admin_token = None


def is_available() -> bool:
    return bool(KEYCLOAK_URL and KEYCLOAK_REALM)


async def _get_admin_token() -> Optional[str]:
    global _admin_token
    if _admin_token:
        return _admin_token
    if not KEYCLOAK_URL or not KEYCLOAK_ADMIN_PASSWORD:
        return None
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{KEYCLOAK_URL}/realms/master/protocol/openid-connect/token",
                data={
                    "grant_type": "password",
                    "client_id": "admin-cli",
                    "username": KEYCLOAK_ADMIN_USER,
                    "password": KEYCLOAK_ADMIN_PASSWORD,
                },
            )
            if resp.status_code == 200:
                _admin_token = resp.json().get("access_token")
                return _admin_token
    except Exception as e:
        logger.debug(f"Keycloak admin token error: {e}")
    return None


async def verify_token(access_token: str) -> Optional[dict]:
    """Verify a Keycloak access token"""
    if not is_available():
        return None
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        logger.debug(f"Keycloak verify error: {e}")
    return None


async def get_login_url(redirect_uri: str, state: str = "") -> str:
    """Get the Keycloak login URL for OIDC flow"""
    if not is_available():
        return ""
    base = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/auth"
    params = (
        f"?client_id={KEYCLOAK_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope=openid profile email"
    )
    if state:
        params += f"&state={state}"
    return base + params


async def exchange_code(code: str, redirect_uri: str) -> Optional[dict]:
    """Exchange authorization code for tokens"""
    if not is_available():
        return None
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token",
                data={
                    "grant_type": "authorization_code",
                    "client_id": KEYCLOAK_CLIENT_ID,
                    "client_secret": KEYCLOAK_CLIENT_SECRET,
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        logger.debug(f"Keycloak exchange_code error: {e}")
    return None


async def create_user(email: str, username: str, password: str,
                      first_name: str = "", last_name: str = "") -> Optional[str]:
    """Create a user in Keycloak"""
    token = await _get_admin_token()
    if not token:
        return None
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{KEYCLOAK_URL}/admin/realms/{KEYCLOAK_REALM}/users",
                json={
                    "email": email,
                    "username": username,
                    "firstName": first_name,
                    "lastName": last_name,
                    "enabled": True,
                    "credentials": [{"type": "password", "value": password, "temporary": False}],
                },
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            )
            if resp.status_code == 201:
                location = resp.headers.get("Location", "")
                return location.split("/")[-1] if location else None
    except Exception as e:
        logger.debug(f"Keycloak create_user error: {e}")
    return None


async def get_user(user_id: str) -> Optional[dict]:
    """Get user info from Keycloak"""
    token = await _get_admin_token()
    if not token:
        return None
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{KEYCLOAK_URL}/admin/realms/{KEYCLOAK_REALM}/users/{user_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        logger.debug(f"Keycloak get_user error: {e}")
    return None


def get_oidc_config() -> dict:
    """Get OIDC configuration for the frontend"""
    if not is_available():
        return {"available": False}
    return {
        "available": True,
        "issuer": f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}",
        "authorization_endpoint": f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/auth",
        "token_endpoint": f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token",
        "userinfo_endpoint": f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/userinfo",
        "client_id": KEYCLOAK_CLIENT_ID,
    }
