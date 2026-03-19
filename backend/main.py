"""
SocialBeats — Music Backend v4.0
Frankfurt (europe-west3) · Cloud Run
SoundCloud v2 transcoding + Audius fallback + Redis 24h cache
"""
import os, re, json, random, asyncio, logging
from typing import List, Optional, Dict
from urllib.parse import quote
from dotenv import load_dotenv

import httpx
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from upstash_redis.asyncio import Redis

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("music-backend")

# ── Config ────────────────────────────────────────────────────────────────────
UPSTASH_URL   = os.getenv("UPSTASH_REDIS_REST_URL", "")
UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")

SC_ID_TTL       = 86400  # 24h
SEARCH_TTL      = 86400  # 24h — search results
TRANSCODING_TTL = 3600   # 1h  — transcoding URLs
CDN_TTL         = 300    # 5m  — CDN URLs (they expire ~1h, safe margin)

# Browser-like headers — SoundCloud blocks non-browser UA with "Quota exceeded"
SC_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://soundcloud.com",
    "Referer": "https://soundcloud.com/",
}

SC_UA_LIST = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

SC_BASE = "https://soundcloud.com"
SC_API  = "https://api-v2.soundcloud.com"
SC_ID_KEY = "sc:client_id"

# ── Redis ─────────────────────────────────────────────────────────────────────
redis = Redis(url=UPSTASH_URL, token=UPSTASH_TOKEN)

# ── SoundCloud client_id ──────────────────────────────────────────────────────
async def sc_discover_id() -> Optional[str]:
    """Scrape SoundCloud homepage JS assets to extract current client_id."""
    ua = random.choice(SC_UA_LIST)
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(SC_BASE, headers={"User-Agent": ua, "Accept": "text/html,*/*"})
            js_urls = re.findall(r'https://a-v2\.sndcdn\.com/assets/[^"\']+\.js', resp.text)
            for src in reversed(js_urls[-6:]):
                try:
                    js = await client.get(src, headers={"User-Agent": ua})
                    m = re.search(r'client_id:"([a-zA-Z0-9]{32})"', js.text)
                    if m:
                        cid = m.group(1)
                        await redis.setex(SC_ID_KEY, SC_ID_TTL, cid)
                        logger.info(f"[sc] fresh client_id: {cid[:8]}…")
                        return cid
                except Exception:
                    continue
    except Exception as e:
        logger.error(f"[sc] scrape error: {e}")
    return None

async def sc_get_id() -> Optional[str]:
    try:
        cached = await redis.get(SC_ID_KEY)
        if cached:
            return cached
    except Exception:
        pass
    return await sc_discover_id()

async def sc_invalidate_and_refresh() -> Optional[str]:
    try:
        await redis.delete(SC_ID_KEY)
    except Exception:
        pass
    logger.warning("[sc] client_id invalidated, scraping fresh…")
    return await sc_discover_id()

# ── SoundCloud search ─────────────────────────────────────────────────────────
async def sc_search(q: str, limit: int = 15, _retried: bool = False) -> List[Dict]:
    cid = await sc_get_id()
    if not cid:
        return []
    try:
        async with httpx.AsyncClient(headers=SC_HEADERS, timeout=8.0) as client:
            r = await client.get(
                f"{SC_API}/search/tracks",
                params={"q": q, "client_id": cid, "limit": min(limit * 2, 30)},
            )
            if r.status_code in (401, 403):
                if not _retried:
                    cid = await sc_invalidate_and_refresh()
                    if cid:
                        return await sc_search(q, limit, _retried=True)
                logger.error(f"[sc] still {r.status_code} after refresh")
                return []

            tracks = []
            for t in r.json().get("collection", []):
                tcs = t.get("media", {}).get("transcodings", [])
                # Only full (non-snipped) tracks
                full_prog = next((x for x in tcs if x.get("format", {}).get("protocol") == "progressive" and not x.get("snipped")), None)
                full_hls  = next((x for x in tcs if x.get("format", {}).get("protocol") == "hls"         and not x.get("snipped")), None)
                tc = full_prog or full_hls
                if not tc:
                    continue

                track_id = str(t["id"])
                # Cache transcoding URL so /stream/{id} can resolve it
                try:
                    await redis.setex(f"sc:transcoding:{track_id}", TRANSCODING_TTL, tc["url"])
                except Exception:
                    pass

                tracks.append({
                    "id":          track_id,
                    "source":      "soundcloud",
                    "title":       t.get("title", ""),
                    "artist":      t.get("user", {}).get("username", ""),
                    "artist_name": t.get("user", {}).get("username", ""),
                    "cover_url":   (t.get("artwork_url") or "").replace("-large", "-t500x500"),
                    "thumbnail":   (t.get("artwork_url") or "").replace("-large", "-t500x500"),
                    "duration":    (t.get("duration") or 0) // 1000,
                    "audio_url":   f"/stream/{track_id}",  # resolved at play time
                })
                if len(tracks) >= limit:
                    break
            return tracks
    except Exception as e:
        logger.warning(f"[sc] search error: {e}")
        return []

# ── Audius fallback ───────────────────────────────────────────────────────────
async def audius_search(q: str, limit: int = 15) -> List[Dict]:
    """Audius — decentralized, no auth, no rate limits, full songs."""
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            nodes = await client.get("https://api.audius.co")
            node = nodes.json().get("data", [])[0]
            r = await client.get(
                f"{node}/v1/tracks/search",
                params={"query": q, "limit": limit, "app_name": "SocialBeats"},
            )
            tracks = []
            for t in r.json().get("data", []):
                tid = t.get("id")
                if not tid:
                    continue
                art = (t.get("artwork") or {})
                cover = art.get("_1000x1000") or art.get("_480x480") or ""
                tracks.append({
                    "id":          tid,
                    "source":      "audius",
                    "title":       t.get("title", ""),
                    "artist":      (t.get("user") or {}).get("name", ""),
                    "artist_name": (t.get("user") or {}).get("name", ""),
                    "cover_url":   cover,
                    "thumbnail":   cover,
                    "duration":    t.get("duration", 0),
                    "audio_url":   f"{node}/v1/tracks/{tid}/stream?app_name=SocialBeats",
                })
            return tracks
    except Exception as e:
        logger.error(f"[audius] search error: {e}")
        return []

# ── Stream resolution ─────────────────────────────────────────────────────────
async def _resolve_transcoding(transcoding_url: str, cid: str) -> Optional[str]:
    try:
        async with httpx.AsyncClient(headers=SC_HEADERS, timeout=10.0, follow_redirects=True) as client:
            r = await client.get(f"{transcoding_url}?client_id={cid}")
            if r.status_code in (401, 403):
                return None
            return r.json().get("url")
    except Exception as e:
        logger.error(f"[stream] resolve error: {e}")
        return None

# ── FastAPI ───────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SocialBeats Music Backend",
    description="SoundCloud v2 + Audius · Frankfurt Cloud Run",
    version="4.0.0",
)
_cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/search")
async def search(q: str = Query(..., min_length=1), limit: int = Query(15, le=50)):
    """
    Layer 1 → Redis 24h cache
    Layer 2 → SoundCloud v2 (full songs, auto client_id refresh)
    Layer 3 → Audius (decentralized, no limits)
    """
    cache_key = f"search:{q.lower().strip()}:{limit}"
    try:
        cached = await redis.get(cache_key)
        if cached:
            return {"results": json.loads(cached), "source": "cache"}
    except Exception:
        pass

    results = await sc_search(q, limit)
    source = "soundcloud"

    if not results:
        logger.info(f"[search] SC empty for '{q}', trying Audius")
        results = await audius_search(q, limit)
        source = "audius"

    if not results:
        raise HTTPException(503, detail="Search unavailable. Try again shortly.")

    try:
        await redis.setex(cache_key, SEARCH_TTL, json.dumps(results))
    except Exception:
        pass

    return {"results": results, "source": source}


@app.get("/stream/{track_id}")
async def stream(track_id: str):
    """
    Resolves SoundCloud track_id → playable CDN audio URL.
    Layer 1 → Redis CDN cache (5 min)
    Layer 2 → Transcoding URL from Redis → SC v2 API → CDN URL
    """
    cdn_key = f"sc:cdn:{track_id}"
    try:
        cached = await redis.get(cdn_key)
        if cached:
            return {"url": cached, "cached": True}
    except Exception:
        pass

    transcoding_url = None
    try:
        transcoding_url = await redis.get(f"sc:transcoding:{track_id}")
    except Exception:
        pass

    if not transcoding_url:
        raise HTTPException(404, detail="Track not in cache. Search again to refresh.")

    cid = await sc_get_id()
    if not cid:
        raise HTTPException(503, detail="SoundCloud client unavailable")

    cdn_url = await _resolve_transcoding(transcoding_url, cid)

    if cdn_url is None:
        # client_id may have expired mid-session — refresh and retry once
        cid = await sc_invalidate_and_refresh()
        if cid:
            cdn_url = await _resolve_transcoding(transcoding_url, cid)

    if not cdn_url:
        raise HTTPException(502, detail="Could not resolve audio stream")

    try:
        await redis.setex(cdn_key, CDN_TTL, cdn_url)
    except Exception:
        pass

    return {"url": cdn_url, "cached": False}


@app.get("/health")
async def health():
    sc_id_cached = False
    try:
        sc_id_cached = bool(await redis.get(SC_ID_KEY))
    except Exception:
        pass
    return {
        "status":       "ok",
        "location":     "europe-west3",
        "sc_id_cached": sc_id_cached,
        "version":      "4.0.0",
    }


@app.on_event("startup")
async def startup():
    cid = await sc_get_id()
    if cid:
        logger.info(f"[startup] SC client_id ready ({cid[:8]}…)")
    else:
        logger.warning("[startup] SC client_id not available")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8080)), workers=2)
