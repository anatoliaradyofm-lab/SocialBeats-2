"""
Grafana Service - Open-source monitoring and observability platform
Provides dashboard management, alerting, and metrics visualization
Integrates with ClickHouse, PostgreSQL, and other data sources
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

GRAFANA_URL = os.getenv("GRAFANA_URL", "")
GRAFANA_API_KEY = os.getenv("GRAFANA_API_KEY", "")
GRAFANA_SERVICE_ACCOUNT_TOKEN = os.getenv("GRAFANA_SA_TOKEN", "")


def is_available() -> bool:
    return bool(GRAFANA_URL and (GRAFANA_API_KEY or GRAFANA_SERVICE_ACCOUNT_TOKEN))


def _get_headers() -> dict:
    token = GRAFANA_SERVICE_ACCOUNT_TOKEN or GRAFANA_API_KEY
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


async def _request(method: str, path: str, data: dict = None) -> Optional[dict]:
    if not is_available():
        return None
    try:
        import httpx
        url = f"{GRAFANA_URL}/api{path}"
        async with httpx.AsyncClient(timeout=10) as client:
            if method == "GET":
                resp = await client.get(url, headers=_get_headers())
            elif method == "POST":
                resp = await client.post(url, json=data or {}, headers=_get_headers())
            elif method == "PUT":
                resp = await client.put(url, json=data or {}, headers=_get_headers())
            elif method == "DELETE":
                resp = await client.delete(url, headers=_get_headers())
            else:
                return None
            if resp.status_code in (200, 201):
                return resp.json()
            logger.debug(f"Grafana API {path} returned {resp.status_code}")
            return None
    except Exception as e:
        logger.debug(f"Grafana API error: {e}")
        return None


async def health_check() -> dict:
    """Check Grafana health status"""
    if not GRAFANA_URL:
        return {"status": "not_configured"}
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{GRAFANA_URL}/api/health")
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return {"status": "unreachable"}


async def create_dashboard(title: str, panels: list = None, folder_id: int = 0) -> Optional[dict]:
    """Create or update a Grafana dashboard"""
    dashboard = {
        "dashboard": {
            "title": title,
            "panels": panels or [],
            "editable": True,
            "timezone": "browser",
            "refresh": "5m",
        },
        "folderId": folder_id,
        "overwrite": True,
    }
    return await _request("POST", "/dashboards/db", dashboard)


async def create_socialbeats_dashboard() -> Optional[dict]:
    """Create the default SocialBeats monitoring dashboard"""
    panels = [
        {
            "title": "Active Users (24h)",
            "type": "stat",
            "gridPos": {"h": 4, "w": 6, "x": 0, "y": 0},
            "targets": [{"rawSql": "SELECT count(DISTINCT user_id) FROM event_log WHERE timestamp > now() - INTERVAL 1 DAY"}],
        },
        {
            "title": "Music Plays (24h)",
            "type": "stat",
            "gridPos": {"h": 4, "w": 6, "x": 6, "y": 0},
            "targets": [{"rawSql": "SELECT count() FROM music_plays WHERE timestamp > now() - INTERVAL 1 DAY"}],
        },
        {
            "title": "Top Tracks",
            "type": "table",
            "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
            "targets": [{"rawSql": "SELECT track_id, artist, count() as plays FROM music_plays WHERE timestamp > now() - INTERVAL 7 DAY GROUP BY track_id, artist ORDER BY plays DESC LIMIT 10"}],
        },
        {
            "title": "Daily Active Users",
            "type": "timeseries",
            "gridPos": {"h": 8, "w": 12, "x": 0, "y": 4},
            "targets": [{"rawSql": "SELECT toDate(timestamp) as time, uniq(user_id) as dau FROM event_log WHERE timestamp > now() - INTERVAL 30 DAY GROUP BY time ORDER BY time"}],
        },
        {
            "title": "Events by Type",
            "type": "piechart",
            "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8},
            "targets": [{"rawSql": "SELECT event_type, count() as cnt FROM event_log WHERE timestamp > now() - INTERVAL 7 DAY GROUP BY event_type ORDER BY cnt DESC LIMIT 10"}],
        },
    ]
    return await create_dashboard("SocialBeats Overview", panels)


async def add_datasource(name: str, ds_type: str, url: str,
                         database: str = "", **kwargs) -> Optional[dict]:
    """Add a data source to Grafana"""
    payload = {
        "name": name,
        "type": ds_type,
        "url": url,
        "database": database,
        "access": "proxy",
        "isDefault": False,
        **kwargs,
    }
    return await _request("POST", "/datasources", payload)


async def setup_clickhouse_datasource() -> Optional[dict]:
    """Add ClickHouse as a Grafana data source"""
    ch_host = os.getenv("CLICKHOUSE_HOST", "localhost")
    ch_port = os.getenv("CLICKHOUSE_PORT", "8123")
    return await add_datasource(
        "ClickHouse", "grafana-clickhouse-datasource",
        f"http://{ch_host}:{ch_port}",
        database=os.getenv("CLICKHOUSE_DB", "socialbeats"),
    )


async def get_dashboards() -> list:
    """List all dashboards"""
    result = await _request("GET", "/search?type=dash-db")
    return result if isinstance(result, list) else []


async def create_alert_rule(name: str, condition: str, frequency: str = "5m") -> Optional[dict]:
    """Create an alert rule"""
    payload = {
        "name": name,
        "condition": condition,
        "frequency": frequency,
        "handler": 1,
        "notifications": [],
    }
    return await _request("POST", "/alert-notifications", payload)


def get_status() -> dict:
    return {
        "available": is_available(),
        "url": GRAFANA_URL[:30] + "..." if GRAFANA_URL else None,
    }
