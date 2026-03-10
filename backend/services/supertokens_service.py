"""
SuperTokens Service - Open-source authentication and session management
Provides enhanced auth features: session management, MFA, social login
Falls back to existing JWT/PyJWT auth if SuperTokens core is not running
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

SUPERTOKENS_URI = os.getenv("SUPERTOKENS_CONNECTION_URI", "")
SUPERTOKENS_API_KEY = os.getenv("SUPERTOKENS_API_KEY", "")
APP_NAME = os.getenv("APP_NAME", "SocialBeats")
API_DOMAIN = os.getenv("API_DOMAIN", "http://localhost:8000")
WEBSITE_DOMAIN = os.getenv("WEBSITE_DOMAIN", "http://localhost:3000")

_initialized = False


def is_available() -> bool:
    return bool(SUPERTOKENS_URI)


def init_supertokens():
    """Initialize SuperTokens SDK if connection URI is configured"""
    global _initialized
    if _initialized or not is_available():
        return False
    try:
        from supertokens_python import init as st_init, InputAppInfo
        from supertokens_python.recipe import emailpassword, session, thirdparty, dashboard
        from supertokens_python import SupertokensConfig

        st_init(
            app_info=InputAppInfo(
                app_name=APP_NAME,
                api_domain=API_DOMAIN,
                website_domain=WEBSITE_DOMAIN,
                api_base_path="/auth",
                website_base_path="/auth",
            ),
            supertokens_config=SupertokensConfig(
                connection_uri=SUPERTOKENS_URI,
                api_key=SUPERTOKENS_API_KEY if SUPERTOKENS_API_KEY else None,
            ),
            framework="fastapi",
            recipe_list=[
                emailpassword.init(),
                thirdparty.init(
                    sign_in_and_up_feature=thirdparty.SignInAndUpFeature(
                        providers=[
                            thirdparty.ProviderInput(
                                config=thirdparty.ProviderConfig(
                                    third_party_id="google",
                                    clients=[
                                        thirdparty.ProviderClientConfig(
                                            client_id=os.getenv("GOOGLE_CLIENT_ID", ""),
                                            client_secret=os.getenv("GOOGLE_CLIENT_SECRET", ""),
                                        ),
                                    ],
                                ),
                            ),
                        ],
                    ),
                ),
                session.init(),
                dashboard.init(),
            ],
        )
        _initialized = True
        logger.info("SuperTokens initialized")
        return True
    except ImportError:
        logger.info("supertokens-python not installed")
        return False
    except Exception as e:
        logger.warning(f"SuperTokens init failed: {e}")
        return False


async def create_session_st(user_id: str, request=None, response=None) -> Optional[dict]:
    """Create a SuperTokens session"""
    if not _initialized:
        return None
    try:
        from supertokens_python.recipe.session.asyncio import create_new_session
        session_container = await create_new_session(request, "public", user_id)
        return {
            "session_handle": session_container.get_handle(),
            "user_id": session_container.get_user_id(),
        }
    except Exception as e:
        logger.debug(f"SuperTokens create session error: {e}")
        return None


async def verify_session_st(access_token: str) -> Optional[dict]:
    """Verify a SuperTokens session token"""
    if not _initialized:
        return None
    try:
        from supertokens_python.recipe.session.asyncio import get_session_information
        session_info = await get_session_information(access_token)
        if session_info:
            return {"user_id": session_info.user_id, "session_handle": session_info.session_handle}
        return None
    except Exception as e:
        logger.debug(f"SuperTokens verify error: {e}")
        return None


def get_middleware():
    """Get SuperTokens middleware for FastAPI"""
    if not _initialized:
        return None
    try:
        from supertokens_python.framework.fastapi import get_middleware as st_middleware
        return st_middleware()
    except Exception:
        return None


def get_status() -> dict:
    return {
        "available": is_available(),
        "initialized": _initialized,
        "connection_uri": SUPERTOKENS_URI[:20] + "..." if SUPERTOKENS_URI else None,
    }
