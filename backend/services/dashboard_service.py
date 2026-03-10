"""
Dashboard Service - Grafana (primary) + Umami (yedek)
Görsel dashboard, metrikler, aktif kullanıcılar
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

GRAFANA_URL = os.getenv("GRAFANA_URL", "")
GRAFANA_API_KEY = os.getenv("GRAFANA_API_KEY", "")
UMAMI_URL = os.getenv("UMAMI_URL", "")
UMAMI_WEBSITE_ID = os.getenv("UMAMI_WEBSITE_ID", "")


async def get_analytics() -> dict:
    """Grafana (ana) dashboard, yoksa Umami istatistikleri"""
    if GRAFANA_URL and GRAFANA_API_KEY:
        try:
            from services.grafana_service import health_check
            h = await health_check()
            if h.get("database") == "ok":
                return {"backend": "grafana", "url": GRAFANA_URL, "status": "ok"}
        except Exception as e:
            logger.debug(f"Grafana failed: {e}")

    if UMAMI_URL and UMAMI_WEBSITE_ID:
        try:
            from services.umami_service import get_stats, get_active_users
            stats = await get_stats()
            active = await get_active_users()
            return {"backend": "umami", "stats": stats, "active_users": active}
        except Exception as e:
            logger.debug(f"Umami failed: {e}")

    return {"backend": "none"}


def get_dashboard_url() -> Optional[str]:
    """Dashboard URL döndür"""
    if GRAFANA_URL:
        return GRAFANA_URL
    if UMAMI_URL:
        return UMAMI_URL
    return None


def get_backend() -> str:
    return "grafana" if (GRAFANA_URL and GRAFANA_API_KEY) else ("umami" if (UMAMI_URL and UMAMI_WEBSITE_ID) else "none")
