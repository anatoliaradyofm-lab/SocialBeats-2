"""
Meilisearch Integration Service
- Free, open-source full-text search engine
- Typo-tolerant, instant search, faceted filtering
- Indexes: users, posts, tracks, playlists, hashtags
- Falls back to MongoDB regex when Meilisearch is unavailable
"""

import os
import logging
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

MEILI_URL = os.environ.get("MEILISEARCH_URL", "http://localhost:7700")
MEILI_KEY = os.environ.get("MEILISEARCH_MASTER_KEY", "")

logger = logging.getLogger(__name__)

try:
    import meilisearch
    MEILI_AVAILABLE = True
except ImportError:
    MEILI_AVAILABLE = False
    logger.warning("meilisearch package not installed. pip install meilisearch")


class MeilisearchService:
    INDEX_USERS = "users"
    INDEX_POSTS = "posts"
    INDEX_TRACKS = "tracks"
    INDEX_PLAYLISTS = "playlists"
    INDEX_HASHTAGS = "hashtags"

    def __init__(self):
        self.client = None
        self.db = None
        self.connected = False
        self._init_client()

    def _init_client(self):
        if not MEILI_AVAILABLE:
            return
        try:
            self.client = meilisearch.Client(MEILI_URL, MEILI_KEY or None)
            health = self.client.health()
            self.connected = health.get("status") == "available"
            if self.connected:
                logger.info(f"Meilisearch connected: {MEILI_URL}")
                self._configure_indexes()
            else:
                logger.warning("Meilisearch not healthy")
        except Exception as e:
            logger.warning(f"Meilisearch connection failed: {e} (MongoDB fallback active)")
            self.connected = False

    def _configure_indexes(self):
        """Configure indexes with searchable/filterable/sortable attributes."""
        if not self.connected:
            return
        try:
            # Users index
            users_idx = self.client.index(self.INDEX_USERS)
            users_idx.update_settings({
                "searchableAttributes": ["username", "display_name", "bio", "location"],
                "filterableAttributes": ["is_verified", "is_private", "level"],
                "sortableAttributes": ["followers_count", "created_at"],
                "rankingRules": ["words", "typo", "proximity", "attribute", "sort", "exactness"],
                "typoTolerance": {"enabled": True, "minWordSizeForTypos": {"oneTypo": 3, "twoTypos": 6}},
            })

            # Posts index
            posts_idx = self.client.index(self.INDEX_POSTS)
            posts_idx.update_settings({
                "searchableAttributes": ["content", "username", "location_name", "tags"],
                "filterableAttributes": ["post_type", "visibility", "user_id", "has_media", "created_at", "platform"],
                "sortableAttributes": ["likes_count", "comments_count", "created_at"],
                "rankingRules": ["words", "typo", "proximity", "attribute", "sort", "exactness"],
            })

            # Tracks index
            tracks_idx = self.client.index(self.INDEX_TRACKS)
            tracks_idx.update_settings({
                "searchableAttributes": ["title", "artist", "album", "genre", "category"],
                "filterableAttributes": ["source", "platform", "genre", "category"],
                "sortableAttributes": ["play_count", "created_at"],
                "rankingRules": ["words", "typo", "proximity", "attribute", "sort", "exactness"],
            })

            # Playlists index
            playlists_idx = self.client.index(self.INDEX_PLAYLISTS)
            playlists_idx.update_settings({
                "searchableAttributes": ["name", "description", "creator_name", "tags", "genre"],
                "filterableAttributes": ["is_public", "genre", "creator_id", "platform"],
                "sortableAttributes": ["followers_count", "track_count", "created_at"],
            })

            # Hashtags index
            hashtags_idx = self.client.index(self.INDEX_HASHTAGS)
            hashtags_idx.update_settings({
                "searchableAttributes": ["tag"],
                "sortableAttributes": ["post_count", "trending_score"],
            })

            logger.info("Meilisearch indexes configured")
        except Exception as e:
            logger.error(f"Meilisearch index config error: {e}")

    def set_db(self, database):
        self.db = database

    def is_available(self) -> bool:
        if not self.connected or not self.client:
            return False
        try:
            h = self.client.health()
            return h.get("status") == "available"
        except Exception:
            self.connected = False
            return False

    def get_status(self) -> Dict:
        return {
            "status": "ok" if self.connected else ("not_installed" if not MEILI_AVAILABLE else "not_connected"),
            "message": (
                f"Meilisearch aktif ({MEILI_URL})" if self.connected
                else ("pip install meilisearch gerekli" if not MEILI_AVAILABLE
                      else f"Meilisearch bağlantısı başarısız ({MEILI_URL})")
            ),
            "url": MEILI_URL,
            "connected": self.connected,
            "free": True, "key_required": False, "open_source": True,
        }

    async def get_search_key(self) -> str:
        """Sadece arama (okuma) yapabilen istemci anahtari (Tenant token / Search key) olustur."""
        if not self.connected:
            return ""
        try:
            # Client.get_keys() returns standard keys. We can find one containing 'search'
            keys = await asyncio.to_thread(self.client.get_keys)
            for k in keys.get("results", []):
                if isinstance(k, dict) and "search" in k.get("actions", []) and "*" not in k.get("actions", []):
                    return k.get("key", "")
            return MEILI_KEY  # If not found, will be nullified on frontend ideally or generated logic
        except Exception:
            return ""

    # ── Index Operations ──

    async def index_user(self, user: Dict):
        if not self.connected:
            return
        try:
            doc = {
                "id": str(user.get("id", user.get("_id", ""))),
                "username": user.get("username", ""),
                "display_name": user.get("display_name", ""),
                "bio": user.get("bio", ""),
                "location": user.get("location", ""),
                "avatar_url": user.get("avatar_url", ""),
                "is_verified": user.get("is_verified", False),
                "is_private": user.get("is_private", False),
                "level": user.get("level", 1),
                "followers_count": user.get("followers_count", 0),
                "created_at": user.get("created_at", ""),
            }
            await asyncio.to_thread(self.client.index(self.INDEX_USERS).add_documents, [doc])
        except Exception as e:
            logger.error(f"Meilisearch index_user error: {e}")

    async def index_post(self, post: Dict):
        if not self.connected:
            return
        try:
            doc = {
                "id": str(post.get("id", post.get("_id", ""))),
                "content": post.get("content", ""),
                "user_id": post.get("user_id", ""),
                "username": post.get("username", ""),
                "post_type": post.get("post_type", "text"),
                "visibility": post.get("visibility", "public"),
                "location_name": post.get("location_name", post.get("location", "")),
                "tags": post.get("tags", []),
                "has_media": bool(post.get("media_urls")),
                "likes_count": post.get("likes_count", 0),
                "comments_count": post.get("comments_count", 0),
                "created_at": post.get("created_at", ""),
            }
            await asyncio.to_thread(self.client.index(self.INDEX_POSTS).add_documents, [doc])
        except Exception as e:
            logger.error(f"Meilisearch index_post error: {e}")

    async def index_track(self, track: Dict):
        if not self.connected:
            return
        try:
            doc = {
                "id": str(track.get("id", track.get("_id", track.get("song_id", "")))),
                "title": track.get("title", ""),
                "artist": track.get("artist", ""),
                "album": track.get("album", ""),
                "genre": track.get("genre", ""),
                "source": track.get("source", ""),
                "thumbnail": track.get("thumbnail", track.get("cover_url", "")),
                "duration": track.get("duration", 0),
                "play_count": track.get("play_count", 0),
                "created_at": track.get("created_at", ""),
            }
            await asyncio.to_thread(self.client.index(self.INDEX_TRACKS).add_documents, [doc])
        except Exception as e:
            logger.error(f"Meilisearch index_track error: {e}")

    async def index_playlist(self, playlist: Dict):
        if not self.connected:
            return
        try:
            doc = {
                "id": str(playlist.get("id", playlist.get("_id", ""))),
                "name": playlist.get("name", ""),
                "description": playlist.get("description", ""),
                "creator_id": playlist.get("creator_id", ""),
                "creator_name": playlist.get("creator_name", ""),
                "is_public": playlist.get("is_public", True),
                "genre": playlist.get("genre", ""),
                "tags": playlist.get("tags", []),
                "track_count": playlist.get("track_count", 0),
                "followers_count": playlist.get("followers_count", 0),
                "cover_url": playlist.get("cover_url", ""),
                "created_at": playlist.get("created_at", ""),
            }
            await asyncio.to_thread(self.client.index(self.INDEX_PLAYLISTS).add_documents, [doc])
        except Exception as e:
            logger.error(f"Meilisearch index_playlist error: {e}")

    async def index_hashtag(self, tag: str, post_count: int = 0, trending_score: float = 0):
        if not self.connected:
            return
        try:
            doc = {"id": tag.lower().replace("#", ""), "tag": tag.lower(), "post_count": post_count, "trending_score": trending_score}
            await asyncio.to_thread(self.client.index(self.INDEX_HASHTAGS).add_documents, [doc])
        except Exception as e:
            logger.error(f"Meilisearch index_hashtag error: {e}")

    async def delete_document(self, index_name: str, doc_id: str):
        if not self.connected:
            return
        try:
            await asyncio.to_thread(self.client.index(index_name).delete_document, doc_id)
        except Exception as e:
            logger.error(f"Meilisearch delete error: {e}")

    # ── Search Operations ──

    async def search(self, index_name: str, query: str, limit: int = 20, offset: int = 0,
                     filter_str: str = None, sort: List[str] = None,
                     attributes_to_retrieve: List[str] = None) -> Dict:
        """
        Universal Meilisearch query. Returns {hits, estimatedTotalHits, query, processingTimeMs}.
        Falls back to empty result if unavailable.
        """
        if not self.connected or not query:
            return {"hits": [], "estimatedTotalHits": 0, "query": query, "processingTimeMs": 0, "source": "none"}

        try:
            params: Dict[str, Any] = {"limit": limit, "offset": offset}
            if filter_str:
                params["filter"] = filter_str
            if sort:
                params["sort"] = sort
            if attributes_to_retrieve:
                params["attributesToRetrieve"] = attributes_to_retrieve
            params["attributesToHighlight"] = ["*"]
            params["highlightPreTag"] = "<mark>"
            params["highlightPostTag"] = "</mark>"

            result = await asyncio.to_thread(self.client.index(index_name).search, query, params)
            result["source"] = "meilisearch"
            return result
        except Exception as e:
            logger.error(f"Meilisearch search error ({index_name}): {e}")
            return {"hits": [], "estimatedTotalHits": 0, "query": query, "processingTimeMs": 0, "source": "error"}

    async def search_users(self, query: str, limit: int = 10, offset: int = 0) -> Dict:
        return await self.search(self.INDEX_USERS, query, limit, offset,
                                 filter_str="is_private = false",
                                 sort=["followers_count:desc"])

    async def search_posts(self, query: str, limit: int = 20, offset: int = 0,
                           platform: str = None, post_type: str = None, date: str = None) -> Dict:
        filt = ['visibility = "public"']
        if platform and platform != "all":
            filt.append(f'platform = "{platform}"')
        if post_type and post_type != "all":
            filt.append(f'post_type = "{post_type}"')
        if date and date != "all":
            from datetime import datetime, timezone, timedelta
            now = datetime.now(timezone.utc)
            m = {"hour": 1, "day": 24, "week": 168, "month": 720}
            h = m.get(date, 0)
            if h:
                cutoff = (now - timedelta(hours=h)).isoformat()
                filt.append(f'created_at >= "{cutoff}"')
        return await self.search(self.INDEX_POSTS, query, limit, offset,
                                 filter_str=" AND ".join(filt) if filt else 'visibility = "public"',
                                 sort=["likes_count:desc"])

    async def search_tracks(self, query: str, limit: int = 20, offset: int = 0,
                            platform: str = None, genre: str = None) -> Dict:
        filt = []
        if platform and platform != "all":
            filt.append(f'source = "{platform}"' if '"' not in platform else f"source = {platform}")
        if genre:
            filt.append(f'genre = "{genre}"' if '"' not in genre else f"genre = {genre}")
        return await self.search(self.INDEX_TRACKS, query, limit, offset,
                                 filter_str=" AND ".join(filt) if filt else None,
                                 sort=["play_count:desc"])

    async def search_playlists(self, query: str, limit: int = 10, offset: int = 0,
                               platform: str = None, genre: str = None) -> Dict:
        filt = ["is_public = true"]
        if platform and platform != "all":
            filt.append(f'platform = "{platform}"')
        if genre:
            filt.append(f'genre = "{genre}"')
        return await self.search(self.INDEX_PLAYLISTS, query, limit, offset,
                                 filter_str=" AND ".join(filt),
                                 sort=["followers_count:desc"])

    async def search_hashtags(self, query: str, limit: int = 10) -> Dict:
        return await self.search(self.INDEX_HASHTAGS, query, limit,
                                 sort=["post_count:desc"])

    async def discover_categories(self, limit: int = 20) -> Dict:
        """Discover categories/genres from tracks index - facet distribution."""
        if not self.connected:
            return {"categories": [], "genres": []}
        try:
            faceted = await asyncio.to_thread(
                self.client.index(self.INDEX_TRACKS).search, "",
                {"limit": 1, "facets": ["genre", "source"], "attributesToRetrieve": []}
            )
            facets = faceted.get("facetDistribution", {})
            genres = list(facets.get("genre", {}).keys())[:limit] if facets.get("genre") else []
            platforms = list(facets.get("source", {}).keys())[:limit] if facets.get("source") else []
            return {"genres": genres, "platforms": platforms}
        except Exception as e:
            logger.debug(f"Meilisearch discover_categories error: {e}")
            return {"genres": [], "platforms": []}

    async def multi_search(self, query: str, limits: Dict[str, int] = None) -> Dict:
        """Search across all indexes simultaneously."""
        if not limits:
            limits = {"users": 5, "posts": 10, "tracks": 10, "playlists": 5, "hashtags": 5}

        if not self.connected:
            return {k: {"hits": [], "estimatedTotalHits": 0} for k in limits}

        try:
            queries = []
            for idx, lim in limits.items():
                q = {"indexUid": idx, "q": query, "limit": lim}
                if idx == "users":
                    q["filter"] = "is_private = false"
                elif idx == "posts":
                    q["filter"] = 'visibility = "public"'
                elif idx == "playlists":
                    q["filter"] = "is_public = true"
                queries.append(q)

            result = await asyncio.to_thread(self.client.multi_search, queries)
            out = {}
            for r in result.get("results", []):
                out[r["indexUid"]] = {
                    "hits": r.get("hits", []),
                    "estimatedTotalHits": r.get("estimatedTotalHits", 0),
                    "processingTimeMs": r.get("processingTimeMs", 0),
                }
            return out
        except Exception as e:
            logger.error(f"Meilisearch multi_search error: {e}")
            return {k: {"hits": [], "estimatedTotalHits": 0} for k in limits}

    # ── Bulk Sync from MongoDB ──

    async def sync_all(self):
        """Full sync: pull all data from MongoDB and index into Meilisearch."""
        if not self.connected or not self.db:
            logger.warning("Cannot sync: Meilisearch not connected or db not set")
            return {"synced": False}

        counts = {}
        try:
            # Users
            users = []
            async for u in self.db.users.find({}, {"password_hash": 0}):
                u["id"] = str(u.pop("_id", ""))
                users.append({
                    "id": u["id"], "username": u.get("username", ""),
                    "display_name": u.get("display_name", ""), "bio": u.get("bio", ""),
                    "location": u.get("location", ""), "avatar_url": u.get("avatar_url", ""),
                    "is_verified": u.get("is_verified", False), "is_private": u.get("is_private", False),
                    "level": u.get("level", 1), "followers_count": u.get("followers_count", 0),
                    "created_at": str(u.get("created_at", "")),
                })
            if users:
                await asyncio.to_thread(self.client.index(self.INDEX_USERS).add_documents, users)
            counts["users"] = len(users)

            # Posts
            posts = []
            async for p in self.db.posts.find({"visibility": "public"}):
                p["id"] = str(p.pop("_id", ""))
                posts.append({
                    "id": p["id"], "content": p.get("content", ""),
                    "user_id": p.get("user_id", ""), "username": p.get("username", ""),
                    "post_type": p.get("post_type", "text"),
                    "visibility": p.get("visibility", "public"),
                    "location_name": p.get("location_name", p.get("location", "")),
                    "tags": p.get("tags", []), "has_media": bool(p.get("media_urls")),
                    "likes_count": p.get("likes_count", 0),
                    "comments_count": p.get("comments_count", 0),
                    "created_at": str(p.get("created_at", "")),
                })
            if posts:
                await asyncio.to_thread(self.client.index(self.INDEX_POSTS).add_documents, posts)
            counts["posts"] = len(posts)

            # Playlists
            playlists = []
            async for pl in self.db.playlists.find({"is_public": True}):
                pl["id"] = str(pl.pop("_id", ""))
                playlists.append({
                    "id": pl["id"], "name": pl.get("name", ""),
                    "description": pl.get("description", ""),
                    "creator_id": pl.get("creator_id", ""), "creator_name": pl.get("creator_name", ""),
                    "is_public": True, "genre": pl.get("genre", ""),
                    "tags": pl.get("tags", []), "track_count": pl.get("track_count", 0),
                    "followers_count": pl.get("followers_count", 0),
                    "cover_url": pl.get("cover_url", ""),
                    "created_at": str(pl.get("created_at", "")),
                })
            if playlists:
                await asyncio.to_thread(self.client.index(self.INDEX_PLAYLISTS).add_documents, playlists)
            counts["playlists"] = len(playlists)

            # Tracks from cache
            tracks = []
            async for t in self.db.music_cache.find({"cache_key": {"$regex": "^yt_info"}}):
                data = t.get("data") or t.get("video_info") or {}
                if data.get("title"):
                    tid = data.get("song_id", data.get("id", str(t.get("_id", ""))))
                    tracks.append({
                        "id": str(tid), "title": data.get("title", ""),
                        "artist": data.get("artist", ""), "album": data.get("album", ""),
                        "genre": data.get("genre", ""), "source": data.get("source", "YouTube"),
                        "thumbnail": data.get("thumbnail", data.get("cover_url", "")),
                        "duration": data.get("duration", 0), "play_count": data.get("play_count", 0),
                        "created_at": str(t.get("cached_at", "")),
                    })
            if tracks:
                await asyncio.to_thread(self.client.index(self.INDEX_TRACKS).add_documents, tracks)
            counts["tracks"] = len(tracks)

            logger.info(f"Meilisearch sync complete: {counts}")
            return {"synced": True, "counts": counts}
        except Exception as e:
            logger.error(f"Meilisearch sync error: {e}")
            return {"synced": False, "error": str(e)}

    async def get_index_stats(self) -> Dict:
        if not self.connected:
            return {}
        try:
            stats = await asyncio.to_thread(self.client.get_all_stats)
            return {
                "database_size": stats.get("databaseSize", 0),
                "indexes": {
                    name: {"documents": idx.get("numberOfDocuments", 0), "indexing": idx.get("isIndexing", False)}
                    for name, idx in stats.get("indexes", {}).items()
                },
            }
        except Exception as e:
            logger.error(f"Meilisearch stats error: {e}")
            return {}


meili_service = MeilisearchService()
