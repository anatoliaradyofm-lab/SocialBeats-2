from fastapi import APIRouter, HTTPException, Query
import asyncio
import os
import httpx
import re
import json
import logging
from upstash_redis.asyncio import Redis
from urllib.parse import quote

logger = logging.getLogger(__name__)

# Browser-like headers — SoundCloud blocks Node/Python default UA with "Quota exceeded"
SC_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://soundcloud.com",
    "Referer": "https://soundcloud.com/",
}


class SoundCloudScraper:
    """Scrapes a fresh client_id from SoundCloud's own JS assets and caches in Redis."""

    def __init__(self, redis_client: Redis):
        self.redis = redis_client

    async def get_client_id(self) -> str | None:
        cached = await self.redis.get("sc_client_id")
        if cached:
            return cached
        return await self._scrape_fresh()

    async def invalidate_and_refresh(self) -> str | None:
        """Called when a request returns 401/403 — wipe stale id and get fresh one."""
        await self.redis.delete("sc_client_id")
        logger.warning("[sc-scraper] client_id invalidated, scraping fresh...")
        return await self._scrape_fresh()

    async def _scrape_fresh(self) -> str | None:
        try:
            async with httpx.AsyncClient(headers=SC_HEADERS, timeout=12.0) as client:
                home = await client.get("https://soundcloud.com")
                js_urls = re.findall(r'https://a-v2\.sndcdn\.com/assets/[^"\']+\.js', home.text)
                # Try last few bundles — they're most likely to contain client_id
                for js_url in reversed(js_urls[-6:]):
                    try:
                        js = await client.get(js_url)
                        m = re.search(r'client_id:"([a-zA-Z0-9]{32})"', js.text)
                        if m:
                            cid = m.group(1)
                            await self.redis.set("sc_client_id", cid, ex=86400)  # 24h
                            logger.info(f"[sc-scraper] scraped fresh client_id: {cid[:8]}...")
                            return cid
                    except Exception:
                        continue
        except Exception as e:
            logger.error(f"[sc-scraper] failed: {e}")
        return None


# --- Router ---
music_hybrid_router = APIRouter(prefix="/music-hybrid", tags=["music-hybrid"])

UPSTASH_URL   = os.getenv("UPSTASH_REDIS_REST_URL")
UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN")
redis_client  = Redis(url=UPSTASH_URL, token=UPSTASH_TOKEN)
sc_scraper    = SoundCloudScraper(redis_client)


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

@music_hybrid_router.get("/search")
async def search_hybrid(q: str = Query(..., min_length=2), limit: int = Query(15, le=30)):
    cache_key = f"search:{q.lower().strip()}:{limit}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    results = await _sc_search(q, limit)
    if not results:
        logger.info(f"[search] SC returned nothing for '{q}', trying Audius")
        results = await _audius_search(q, limit)

    if results:
        await redis_client.set(cache_key, json.dumps(results), ex=86400)  # 24h cache
    return results


async def _sc_search(q: str, limit: int, _retried: bool = False) -> list:
    cid = await sc_scraper.get_client_id()
    if not cid:
        return []
    try:
        async with httpx.AsyncClient(headers=SC_HEADERS, timeout=8.0) as client:
            url = (
                f"https://api-v2.soundcloud.com/search/tracks"
                f"?q={quote(q)}&client_id={cid}&limit={min(limit * 2, 30)}"
            )
            resp = await client.get(url)

            if resp.status_code in (401, 403):
                if not _retried:
                    cid = await sc_scraper.invalidate_and_refresh()
                    if cid:
                        return await _sc_search(q, limit, _retried=True)
                logger.error(f"[sc-search] still 403 after refresh for '{q}'")
                return []

            data = resp.json()
            tracks = []
            for t in data.get("collection", []):
                tcs = t.get("media", {}).get("transcodings", [])
                # Only full (non-snipped) tracks
                full_prog = next((x for x in tcs if x.get("format", {}).get("protocol") == "progressive" and not x.get("snipped")), None)
                full_hls  = next((x for x in tcs if x.get("format", {}).get("protocol") == "hls"         and not x.get("snipped")), None)
                tc = full_prog or full_hls
                if not tc:
                    continue

                track_id = str(t["id"])
                title  = t.get("title", "")
                artist = t.get("user", {}).get("username", "")
                # Cache transcoding URL + meta in Redis so /stream/{id} can resolve later
                await redis_client.set(f"sc_transcoding:{track_id}", tc["url"], ex=3600)
                await redis_client.set(f"sc_meta:{track_id}", json.dumps({"title": title, "artist": artist}), ex=3600)

                tracks.append({
                    "id":          track_id,
                    "title":       title,
                    "artist":      artist,
                    "artist_name": artist,
                    "cover_url":   (t.get("artwork_url") or "").replace("-large", "-t500x500"),
                    "thumbnail":   (t.get("artwork_url") or "").replace("-large", "-t500x500"),
                    "duration":    t.get("duration", 0) // 1000,
                    "source":      "soundcloud",
                    "audio_url":   f"/music-hybrid/stream/{track_id}",
                })
                if len(tracks) >= limit:
                    break
            return tracks
    except Exception as e:
        logger.error(f"[sc-search] exception: {e}")
        return []


async def _audius_search(q: str, limit: int = 15) -> list:
    """
    Audius — decentralized music platform, no auth, no rate limits.
    Returns direct stream URLs via /v1/tracks/{id}/stream.
    """
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            # Get a healthy discovery node first
            nodes_resp = await client.get("https://api.audius.co")
            node = nodes_resp.json().get("data", [])[0]

            search_url = (
                f"{node}/v1/tracks/search"
                f"?query={quote(q)}&limit={limit}&app_name=SocialBeats"
            )
            resp = await client.get(search_url)
            data = resp.json()
            results = []
            for item in data.get("data", []):
                track_id = item.get("id")
                if not track_id:
                    continue
                # /stream endpoint returns 302 → CDN audio, react-native-track-player follows redirects
                audio_url = f"{node}/v1/tracks/{track_id}/stream?app_name=SocialBeats"
                artwork = (item.get("artwork") or {})
                cover = artwork.get("_1000x1000") or artwork.get("_480x480") or ""
                results.append({
                    "id":          track_id,
                    "title":       item.get("title", ""),
                    "artist":      (item.get("user") or {}).get("name", ""),
                    "artist_name": (item.get("user") or {}).get("name", ""),
                    "cover_url":   cover,
                    "thumbnail":   cover,
                    "duration":    item.get("duration", 0),
                    "source":      "audius",
                    "audio_url":   audio_url,
                })
            return results
    except Exception as e:
        logger.error(f"[audius-search] {e}")
        return []


# ---------------------------------------------------------------------------
# Stream resolution — called by mobile PlayerContext at play time
# ---------------------------------------------------------------------------

@music_hybrid_router.get("/stream/{track_id}")
async def get_stream_url(track_id: str):
    """
    Resolves audio URL for a track.
    Flow: Redis CDN cache → SC transcoding → SC retry (fresh client_id) → Audius fallback
    """
    # Fast path: CDN URL already cached
    cdn_key = f"sc_cdn:{track_id}"
    cached_cdn = await redis_client.get(cdn_key)
    if cached_cdn:
        return {"url": cached_cdn, "source": "soundcloud"}

    # Get the transcoding URL stored during search
    transcoding_url = await redis_client.get(f"sc_transcoding:{track_id}")

    if transcoding_url:
        cid = await sc_scraper.get_client_id()
        cdn_url = None

        if cid:
            cdn_url = await _resolve_transcoding(transcoding_url, cid)

        if cdn_url is None:
            # client_id might have expired — refresh and retry once
            cid = await sc_scraper.invalidate_and_refresh()
            if cid:
                cdn_url = await _resolve_transcoding(transcoding_url, cid)

        if cdn_url:
            await redis_client.set(cdn_key, cdn_url, ex=300)
            return {"url": cdn_url, "source": "soundcloud"}

        logger.warning(f"[stream] SC failed for {track_id}, trying Audius fallback")

    # ── Audius fallback ──────────────────────────────────────────────────────
    # Use cached title+artist to search Audius for the same track
    meta_raw = await redis_client.get(f"sc_meta:{track_id}")
    if meta_raw:
        try:
            meta = json.loads(meta_raw)
            query = f"{meta.get('title', '')} {meta.get('artist', '')}".strip()
            if query:
                audius_results = await _audius_search(query, limit=3)
                if audius_results:
                    best = audius_results[0]
                    # Cache the Audius URL briefly so repeated plays are fast
                    await redis_client.set(cdn_key, best["audio_url"], ex=300)
                    logger.info(f"[stream] Audius fallback OK for '{query}'")
                    return {"url": best["audio_url"], "source": "audius"}
        except Exception as e:
            logger.error(f"[stream] Audius fallback error: {e}")

    if not transcoding_url:
        raise HTTPException(404, detail="Track not in cache. Search for it again to refresh.")

    raise HTTPException(502, detail="Could not resolve audio stream from SoundCloud or Audius")


async def _resolve_transcoding(transcoding_url: str, client_id: str) -> str | None:
    """Calls SC transcoding endpoint → returns CDN URL or None."""
    try:
        async with httpx.AsyncClient(headers=SC_HEADERS, timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(f"{transcoding_url}?client_id={client_id}")
            if resp.status_code in (401, 403):
                return None
            data = resp.json()
            return data.get("url") or None
    except Exception as e:
        logger.error(f"[resolve-transcoding] {e}")
        return None


# ---------------------------------------------------------------------------
# Home — günlük ana sayfa verileri (24h cache)
# ---------------------------------------------------------------------------

def _fmt_plays(n: int) -> str:
    """Oynatma sayısını okunabilir formata çevirir: 1234567 → '1.2M'"""
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.0f}K"
    return str(n)


def _parse_sc_chart_track(item: dict, rank: int) -> dict | None:
    """SC charts collection item'ını düz track dict'e çevirir."""
    t = item.get("track") or item  # charts wrap in {"score":…, "track":{…}}
    if not t or not t.get("id"):
        return None
    tcs = t.get("media", {}).get("transcodings", [])
    full_prog = next((x for x in tcs if x.get("format", {}).get("protocol") == "progressive" and not x.get("snipped")), None)
    full_hls  = next((x for x in tcs if x.get("format", {}).get("protocol") == "hls"         and not x.get("snipped")), None)
    tc = full_prog or full_hls
    track_id = str(t["id"])
    return {
        "id":          track_id,
        "rank":        rank,
        "title":       t.get("title", ""),
        "artist":      t.get("user", {}).get("username", ""),
        "artist_name": t.get("user", {}).get("username", ""),
        "cover_url":   (t.get("artwork_url") or "").replace("-large", "-t500x500"),
        "thumbnail":   (t.get("artwork_url") or "").replace("-large", "-t500x500"),
        "duration":    t.get("duration", 0) // 1000,
        "plays_approx": _fmt_plays(t.get("playback_count") or 0),
        "source":      "soundcloud",
        "audio_url":   f"/music-hybrid/stream/{track_id}",
        # store transcoding for stream resolution
        "_tc_url":     tc["url"] if tc else None,
    }


# ---------------------------------------------------------------------------
# Ülke → SoundCloud region kodu eşlemesi
# ---------------------------------------------------------------------------

# SC'nin chart API'sinde desteklediği region kodları (ISO alpha-2)
_SC_SUPPORTED_REGIONS: set[str] = {
    "TR", "US", "GB", "DE", "FR", "BR", "AU", "CA", "IT", "ES",
    "NL", "SE", "NZ", "IE", "NO", "DK", "FI", "AT", "CH", "BE",
    "PL", "RU", "JP", "KR", "IN", "MX", "AR", "CL", "CO", "ZA",
    "PT", "HU", "CZ", "RO", "GR", "IL", "NG", "EG", "ID", "PH",
    "TH", "MY", "SG", "PK", "UA", "AZ",
}

# Ülke adı (küçük harf) veya ISO kodu → ISO alpha-2
_COUNTRY_TO_ISO: dict[str, str] = {
    # ISO kodlar (kendileri)
    **{c: c for c in _SC_SUPPORTED_REGIONS},
    # Türkçe ve İngilizce isimler
    "turkey": "TR", "türkiye": "TR", "turkiye": "TR",
    "united states": "US", "usa": "US", "america": "US",
    "united kingdom": "GB", "uk": "GB", "britain": "GB", "england": "GB",
    "germany": "DE", "deutschland": "DE", "almanya": "DE",
    "france": "FR", "fransa": "FR",
    "brazil": "BR", "brasil": "BR", "brezilya": "BR",
    "australia": "AU", "avustralya": "AU",
    "canada": "CA", "kanada": "CA",
    "italy": "IT", "italia": "IT", "italya": "IT",
    "spain": "ES", "españa": "ES", "ispanya": "ES",
    "netherlands": "NL", "holland": "NL", "hollanda": "NL",
    "sweden": "SE", "isvec": "SE", "isveç": "SE",
    "new zealand": "NZ", "yeni zelanda": "NZ",
    "ireland": "IE", "irlanda": "IE",
    "norway": "NO", "norveç": "NO", "norvec": "NO",
    "denmark": "DK", "danimarka": "DK",
    "finland": "FI", "finlandiya": "FI",
    "austria": "AT", "avusturya": "AT",
    "switzerland": "CH", "isvicre": "CH", "isviçre": "CH",
    "belgium": "BE", "belçika": "BE", "belcika": "BE",
    "poland": "PL", "polonya": "PL",
    "russia": "RU", "rusya": "RU",
    "japan": "JP", "japonya": "JP",
    "south korea": "KR", "korea": "KR", "güney kore": "KR", "guney kore": "KR",
    "india": "IN", "hindistan": "IN",
    "mexico": "MX", "méxico": "MX", "meksika": "MX",
    "argentina": "AR", "arjantin": "AR",
    "chile": "CL", "şili": "CL", "sili": "CL",
    "colombia": "CO", "kolombiya": "CO",
    "south africa": "ZA", "güney afrika": "ZA", "guney afrika": "ZA",
    "portugal": "PT", "portekiz": "PT",
    "hungary": "HU", "macaristan": "HU",
    "czech republic": "CZ", "czechia": "CZ", "çek cumhuriyeti": "CZ",
    "romania": "RO", "romanya": "RO",
    "greece": "GR", "yunanistan": "GR",
    "israel": "IL", "israil": "IL",
    "nigeria": "NG", "nijerya": "NG",
    "egypt": "EG", "mısır": "EG", "misir": "EG",
    "indonesia": "ID", "endonezya": "ID",
    "philippines": "PH", "filipinler": "PH",
    "thailand": "TH", "tayland": "TH",
    "malaysia": "MY", "malezya": "MY",
    "singapore": "SG", "singapur": "SG",
    "pakistan": "PK",
    "ukraine": "UA", "ukrayna": "UA",
    "azerbaijan": "AZ", "azerbaycan": "AZ",
}


def _resolve_sc_region(country: str | None) -> str | None:
    """Ülke adı veya ISO kodu → desteklenen SC region kodu (yoksa None → global)."""
    if not country:
        return None
    key = country.strip().lower()
    iso = _COUNTRY_TO_ISO.get(key) or _COUNTRY_TO_ISO.get(country.strip().upper())
    return iso if iso and iso in _SC_SUPPORTED_REGIONS else None


async def _fetch_sc_charts(kind: str, genre: str, limit: int, cid: str,
                           region: str | None = None) -> list:  # type: ignore[return]
    """SoundCloud charts endpoint'ini çağırır. region=None → global."""
    try:
        url = (
            f"https://api-v2.soundcloud.com/charts"
            f"?kind={kind}&genre={quote(genre)}&limit={limit}"
            f"&client_id={cid}&linked_partitioning=1"
        )
        if region:
            url += f"&region={quote(f'soundcloud:regions:{region}')}"
        async with httpx.AsyncClient(headers=SC_HEADERS, timeout=12.0) as client:
            resp = await client.get(url)
            if resp.status_code in (401, 403):
                return []
            data = resp.json()
            return data.get("collection", [])
    except Exception as e:
        logger.error(f"[charts] {kind}/{genre} region={region}: {e}")
        return []


async def _build_home_data(region: str | None = None) -> dict:
    """SC'den günlük home verilerini çeker ve formatlar. region=None → global."""
    cid = await sc_scraper.get_client_id()
    if not cid:
        cid = await sc_scraper.invalidate_and_refresh()
    if not cid:
        logger.error("[home] SC client_id alınamadı")
        return {"featured": [], "trending": [], "for_you": []}

    results = await asyncio.gather(
        _fetch_sc_charts("trending", "soundcloud:genres:all-music", 20, cid, region),
        _fetch_sc_charts("top",      "soundcloud:genres:all-music", 10, cid, region),
    )
    trending_raw: list = results[0]
    for_you_raw: list  = results[1]

    # Ülke verisi yoksa fallback: global trending
    if not trending_raw and region:
        logger.info(f"[home] {region} için veri yok, global'e düşüyor")
        fallback = await asyncio.gather(
            _fetch_sc_charts("trending", "soundcloud:genres:all-music", 20, cid, None),
            _fetch_sc_charts("top",      "soundcloud:genres:all-music", 10, cid, None),
        )
        trending_raw = fallback[0]
        for_you_raw  = fallback[1]

    featured  = []
    trending  = []
    for_you   = []
    labels    = ["TRENDING", "HOT NOW", "NEW RELEASE", "FEATURED", "TOP PICK",
                 "VIRAL",    "CHART",   "RISING",      "POPULAR",  "MUST HEAR"]

    for i, item in enumerate(trending_raw[:20]):
        track = _parse_sc_chart_track(item, i + 1)
        if not track:
            continue
        if track.get("_tc_url"):
            await redis_client.set(f"sc_transcoding:{track['id']}", track["_tc_url"], ex=3600)
        clean = {k: v for k, v in track.items() if k != "_tc_url"}
        if i < 10:
            clean["label"] = labels[i % len(labels)]
            featured.append(clean)
        else:
            trending.append(clean)

    for i, item in enumerate(for_you_raw):
        track = _parse_sc_chart_track(item, i + 1)
        if not track:
            continue
        if track.get("_tc_url"):
            await redis_client.set(f"sc_transcoding:{track['id']}", track["_tc_url"], ex=3600)
        clean = {k: v for k, v in track.items() if k != "_tc_url"}
        for_you.append(clean)

    return {"featured": featured, "trending": trending, "for_you": for_you,
            "region": region or "global"}


@music_hybrid_router.get("/home")
async def get_home_data(
    country: str | None = Query(None, description="Ülke adı veya ISO kodu (TR, Brazil, Türkiye…)"),
    force_refresh: bool = Query(False),
):
    """
    Ana sayfa müzik verileri — ülkeye özgü, 24 saat SoundCloud cache.
    country parametresi boşsa global trending döner.
    """
    region = _resolve_sc_region(country)
    cache_key = f"dashboard:home:v2:{region or 'global'}"

    if not force_refresh:
        cached = await redis_client.get(cache_key)
        if cached:
            return json.loads(cached)

    data = await _build_home_data(region)

    if data.get("featured") or data.get("trending"):
        await redis_client.set(cache_key, json.dumps(data), ex=86400)  # 24 saat

    logger.info(f"[home] region={region or 'global'} → {len(data['featured'])} featured")
    return data
