"""
Geocoding & Location Service
- Photon API (Komoot): Free geocoding, no API key required, OpenStreetMap data
- REST Countries API: Free country/region info, no API key required
- ip-api.com: Free IP geolocation
"""

import httpx
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

PHOTON_API_URL = "https://photon.komoot.io/api"
PHOTON_REVERSE_URL = "https://photon.komoot.io/reverse"
REST_COUNTRIES_URL = "https://restcountries.com/v3.1"
IP_API_URL = "http://ip-api.com/json"


class GeocodingService:
    def __init__(self, db=None):
        self.db = db

    def set_db(self, database):
        self.db = database

    # ── Photon API (Geocoding) ──

    async def search_location(self, query: str, lang: str = "default", limit: int = 5, lat: float = None, lon: float = None) -> List[Dict]:
        """
        Search locations by text query using Photon API.
        Free, no key, powered by OpenStreetMap.
        """
        if not query or len(query.strip()) < 2:
            return []

        params: Dict[str, Any] = {"q": query.strip(), "limit": limit}
        if lang and lang != "default":
            params["lang"] = lang
        if lat is not None and lon is not None:
            params["lat"] = lat
            params["lon"] = lon

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(PHOTON_API_URL, params=params)
                if resp.status_code != 200:
                    logging.error(f"Photon API error: {resp.status_code}")
                    return []

                data = resp.json()
                results = []
                for feature in data.get("features", []):
                    props = feature.get("properties", {})
                    coords = feature.get("geometry", {}).get("coordinates", [])
                    results.append({
                        "name": props.get("name", ""),
                        "city": props.get("city", props.get("name", "")),
                        "state": props.get("state", ""),
                        "country": props.get("country", ""),
                        "country_code": props.get("countrycode", ""),
                        "district": props.get("district", ""),
                        "street": props.get("street", ""),
                        "postcode": props.get("postcode", ""),
                        "osm_type": props.get("osm_type", ""),
                        "osm_id": props.get("osm_id", ""),
                        "type": props.get("type", ""),
                        "longitude": coords[0] if len(coords) > 0 else None,
                        "latitude": coords[1] if len(coords) > 1 else None,
                        "display_name": self._build_display_name(props),
                    })
                return results
        except Exception as e:
            logging.error(f"Photon search error: {e}")
            return []

    async def reverse_geocode(self, lat: float, lon: float) -> Optional[Dict]:
        """
        Reverse geocode: coordinates → address using Photon API.
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                params = {"lat": lat, "lon": lon}
                resp = await client.get(PHOTON_REVERSE_URL, params=params)
                if resp.status_code != 200:
                    return None

                data = resp.json()
                features = data.get("features", [])
                if not features:
                    return None

                props = features[0].get("properties", {})
                return {
                    "name": props.get("name", ""),
                    "city": props.get("city", ""),
                    "state": props.get("state", ""),
                    "country": props.get("country", ""),
                    "country_code": props.get("countrycode", ""),
                    "street": props.get("street", ""),
                    "postcode": props.get("postcode", ""),
                    "display_name": self._build_display_name(props),
                    "latitude": lat,
                    "longitude": lon,
                }
        except Exception as e:
            logging.error(f"Photon reverse geocode error: {e}")
            return None

    @staticmethod
    def _build_display_name(props: dict) -> str:
        parts = []
        for key in ("name", "city", "state", "country"):
            val = props.get(key, "")
            if val and val not in parts:
                parts.append(val)
        return ", ".join(parts)

    # ── REST Countries API ──

    async def get_all_countries(self, fields: str = "name,cca2,cca3,capital,region,subregion,flags,languages,currencies,population") -> List[Dict]:
        """Get all countries with selected fields."""
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(f"{REST_COUNTRIES_URL}/all", params={"fields": fields})
                if resp.status_code != 200:
                    return []
                countries = resp.json()
                return [self._format_country(c) for c in countries]
        except Exception as e:
            logging.error(f"REST Countries all error: {e}")
            return []

    async def search_country(self, query: str) -> List[Dict]:
        """Search countries by name."""
        if not query or len(query.strip()) < 2:
            return []
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{REST_COUNTRIES_URL}/name/{query.strip()}")
                if resp.status_code != 200:
                    return []
                return [self._format_country(c) for c in resp.json()]
        except Exception as e:
            logging.error(f"REST Countries search error: {e}")
            return []

    async def get_country_by_code(self, code: str) -> Optional[Dict]:
        """Get country by ISO 3166-1 alpha-2 code (e.g. 'TR', 'US')."""
        if not code:
            return None
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{REST_COUNTRIES_URL}/alpha/{code.strip().upper()}")
                if resp.status_code != 200:
                    return None
                data = resp.json()
                if isinstance(data, list) and data:
                    return self._format_country(data[0])
                elif isinstance(data, dict):
                    return self._format_country(data)
                return None
        except Exception as e:
            logging.error(f"REST Countries code error: {e}")
            return None

    async def get_countries_by_region(self, region: str) -> List[Dict]:
        """Get countries by region (Africa, Americas, Asia, Europe, Oceania)."""
        if not region:
            return []
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{REST_COUNTRIES_URL}/region/{region.strip().lower()}")
                if resp.status_code != 200:
                    return []
                return [self._format_country(c) for c in resp.json()]
        except Exception as e:
            logging.error(f"REST Countries region error: {e}")
            return []

    async def get_countries_by_subregion(self, subregion: str) -> List[Dict]:
        """Get countries by subregion (e.g. 'Western Europe', 'Southern Asia')."""
        if not subregion:
            return []
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{REST_COUNTRIES_URL}/subregion/{subregion.strip()}")
                if resp.status_code != 200:
                    return []
                return [self._format_country(c) for c in resp.json()]
        except Exception as e:
            logging.error(f"REST Countries subregion error: {e}")
            return []

    # ── IP Geolocation ──

    async def geolocate_ip(self, ip: str = None) -> Optional[Dict]:
        """Get location from IP using ip-api.com (free, no key)."""
        try:
            url = f"{IP_API_URL}/{ip}" if ip else IP_API_URL
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url)
                if resp.status_code != 200:
                    return None
                data = resp.json()
                if data.get("status") != "success":
                    return None
                return {
                    "ip": data.get("query", ip),
                    "country": data.get("country", ""),
                    "country_code": data.get("countryCode", ""),
                    "region": data.get("regionName", ""),
                    "region_code": data.get("region", ""),
                    "city": data.get("city", ""),
                    "zip": data.get("zip", ""),
                    "latitude": data.get("lat"),
                    "longitude": data.get("lon"),
                    "timezone": data.get("timezone", ""),
                    "isp": data.get("isp", ""),
                }
        except Exception as e:
            logging.error(f"IP geolocation error: {e}")
            return None

    @staticmethod
    def _format_country(c: dict) -> Dict:
        name_data = c.get("name", {})
        return {
            "name": name_data.get("common", "") if isinstance(name_data, dict) else str(name_data),
            "official_name": name_data.get("official", "") if isinstance(name_data, dict) else "",
            "code": c.get("cca2", ""),
            "code3": c.get("cca3", ""),
            "capital": c.get("capital", [None])[0] if isinstance(c.get("capital"), list) else c.get("capital", ""),
            "region": c.get("region", ""),
            "subregion": c.get("subregion", ""),
            "population": c.get("population", 0),
            "flag_emoji": c.get("flag", ""),
            "flag_url": c.get("flags", {}).get("svg", c.get("flags", {}).get("png", "")),
            "languages": c.get("languages", {}),
            "currencies": c.get("currencies", {}),
        }


geocoding_service = GeocodingService()
