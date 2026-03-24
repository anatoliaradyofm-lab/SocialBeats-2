from fastapi import APIRouter, HTTPException, Query
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
