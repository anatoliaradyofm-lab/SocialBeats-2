// api.js — mock API for web preview
const delay = (ms = 200) => new Promise(r => setTimeout(r, ms));

const MUSIC_BACKEND_URL = '/music-api';
const SC_PROXY = '/sc-api'; // Custom Vite middleware → https://api-v2.soundcloud.com (proper UA)

// SoundCloud client_id — with multi-source fallback and 12h local cache
let _cidCache = { id: null, expiresAt: 0 };

async function getScCid() {
  if (_cidCache.id && Date.now() < _cidCache.expiresAt) return _cidCache.id;

  // Source 1: Vite middleware scrapes fresh client_id from SoundCloud JS assets
  try {
    const r = await fetch('/sc-cid');
    if (r.ok) {
      const { client_id } = await r.json();
      if (client_id) {
        _cidCache = { id: client_id, expiresAt: Date.now() + 12 * 3600 * 1000 };
        return client_id;
      }
    }
  } catch {}

  // Source 2: Backend stream endpoint (extracts client_id from SoundCloud v1 URL)
  try {
    const r = await fetch(`${MUSIC_BACKEND_URL}/stream/soundcloud/255770309`);
    if (r.ok) {
      const { url } = await r.json();
      const m = url && url.match(/client_id=([^&]+)/);
      if (m) {
        _cidCache = { id: m[1], expiresAt: Date.now() + 3 * 3600 * 1000 };
        return m[1];
      }
    }
  } catch {}

  return null;
}

// Search result cache: query → { tracks, expiresAt }
const _searchCache = new Map();
const SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function musicHybridSearch(query, limit = 15) {
  const cacheKey = `${query}:${limit}`;
  const cached = _searchCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.tracks;

  try {
    const cid = await getScCid();
    if (!cid) return [];

    // SoundCloud v2 search via Vite proxy (proxy sets browser User-Agent to avoid quota)
    const res = await fetch(`${SC_PROXY}/search/tracks?q=${encodeURIComponent(query)}&client_id=${cid}&limit=${Math.min(limit * 2, 30)}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.collection) return [];

    const tracks = [];
    for (const t of data.collection) {
      const tcs = t.media?.transcodings || [];
      // Only full (non-snipped) tracks — skip 30s previews entirely
      const fullProg = tcs.find(x => x.format?.protocol === 'progressive' && !x.snipped);
      const fullHls  = tcs.find(x => x.format?.protocol === 'hls'         && !x.snipped);
      const tc = fullProg || fullHls;
      if (!tc) continue;

      // Rewrite transcoding URL to go through Vite proxy
      const tcProxyUrl = tc.url.replace('https://api-v2.soundcloud.com', SC_PROXY) + `?client_id=${cid}`;

      tracks.push({
        id:          String(t.id),
        title:       t.title || '',
        artist:      t.user?.username || '',
        artist_name: t.user?.username || '',
        cover_url:   (t.artwork_url || '').replace('-large', '-t500x500'),
        cover:       (t.artwork_url || '').replace('-large', '-t500x500'),
        stream_url:  tcProxyUrl,   // /sc-stream-v2/media/... → fetched at play time → CDN URL
        preview_url: tcProxyUrl,
        duration:    Math.floor((t.duration || 0) / 1000),
        source:      'soundcloud',
        _snipped:    false,
      });
      if (tracks.length >= limit) break;
    }
    _searchCache.set(cacheKey, { tracks, expiresAt: Date.now() + SEARCH_CACHE_TTL });
    return tracks;
  } catch (e) {
    console.error('[musicHybridSearch]', e);
    return [];
  }
}

const MOCK_POSTS = [
  { id: 'p1', user: { username: 'djvibe', avatar_url: 'https://i.pravatar.cc/60?u=djvibe' }, content: 'New track dropping tonight! 🔥', likes_count: 142, comments_count: 23, is_liked: false, created_at: new Date().toISOString() },
  { id: 'p2', user: { username: 'melodikbeat', avatar_url: 'https://i.pravatar.cc/60?u=melodikbeat' }, content: 'Chill lo-fi session 🌙', likes_count: 89, comments_count: 11, is_liked: true, created_at: new Date().toISOString() },
];

const MOCK_USER = { id: 'preview-1', username: 'anatolia', display_name: 'Anatolia Radio FM', email: 'preview@socialbeats.app', avatar_url: 'https://i.pravatar.cc/200?u=anatolia', followers_count: 1200, following_count: 450, posts_count: 2 };
const MOCK_AUTH = { access_token: 'preview-token', token: 'preview-token', user: MOCK_USER };

const api = {
  // Auth — returns data directly (no .data wrapper), matching real api.js fetch behavior
  login:    (data) => delay().then(() => MOCK_AUTH),
  register: (data) => delay().then(() => MOCK_AUTH),
  logout:   ()     => delay().then(() => ({})),

  // Profile
  getProfile:       (id) => delay().then(() => ({ data: { id, username: id || 'anatolia', followers_count: 1200, following_count: 450 } })),
  updateProfile:    (data) => delay().then(() => ({ data })),
  followUser:       (id) => delay().then(() => ({ data: { is_following: true } })),
  unfollowUser:     (id) => delay().then(() => ({ data: { is_following: false } })),

  // Feed & Posts
  getFeed:          () => delay().then(() => ({ data: { posts: MOCK_POSTS, has_more: false } })),
  getPost:          (id) => delay().then(() => ({ data: MOCK_POSTS[0] })),
  likePost:         (id) => delay().then(() => ({ data: { is_liked: true } })),
  unlikePost:       (id) => delay().then(() => ({ data: { is_liked: false } })),
  createPost:       (data) => delay().then(() => ({ data: { id: 'new', ...data } })),

  // Notifications
  getNotifications: () => delay().then(() => ({ data: { notifications: [], has_more: false } })),
  markAsRead:       (id) => delay().then(() => ({ data: {} })),
  markAllAsRead:    () => delay().then(() => ({ data: {} })),

  // Search
  search:           (q) => delay().then(() => ({ data: { users: [], posts: [], tracks: [] } })),

  // Music
  searchTracks:     (q) => delay().then(() => ({ data: { results: [] } })),
  getTrack:         (id) => delay().then(() => ({ data: { id, title: 'Preview Track', artist: 'Preview Artist' } })),

  // Playlists
  getPlaylists:     () => delay().then(() => ({ data: { playlists: [] } })),
  getPlaylist:      (id) => delay().then(() => ({ data: { id, name: 'Preview Playlist', tracks: [] } })),
  createPlaylist:   (data) => delay().then(() => ({ data: { id: 'new', ...data } })),

  // Settings
  updateSettings:   (data) => delay().then(() => ({ data })),
  getSettings:      () => delay().then(() => ({ data: {} })),

  // Messages
  getConversations: () => delay().then(() => ({ data: { conversations: [] } })),
  getMessages:      (id) => delay().then(() => ({ data: { messages: [] } })),
  sendMessage:      (data) => delay().then(() => ({ data: { id: 'new', ...data } })),

  // Fallback — SoundCloud hybrid for /search & /music/search, mock for the rest
  get: (url) => {
    if (url.startsWith('/search') || url.startsWith('/music-hybrid')) {
      const params = new URLSearchParams(url.includes('?') ? url.slice(url.indexOf('?') + 1) : '');
      const q = params.get('q') || '';
      const limit = parseInt(params.get('limit') || '8', 10);
      if (!q) return Promise.resolve({ tracks: [], users: [], playlists: [], posts: [] });
      return musicHybridSearch(q, limit).then(tracks => ({ tracks, users: [], playlists: [], posts: [] }));
    }
    // AddSongsToPlaylistScreen: /music/search/{query}?limit=N
    if (url.startsWith('/music/search/')) {
      const parts = url.split('/music/search/')[1] || '';
      const q = decodeURIComponent(parts.split('?')[0]);
      const params = new URLSearchParams(url.includes('?') ? url.slice(url.indexOf('?') + 1) : '');
      const limit = parseInt(params.get('limit') || '15', 10);
      if (!q) return Promise.resolve({ results: [], tracks: [] });
      return musicHybridSearch(q, limit).then(tracks => ({ results: tracks, tracks }));
    }
    return delay().then(() => ({}));
  },
  post:   (url, data) => {
    if (url.includes('/auth/login')) {
      if (!data?.email || !data?.password) return delay().then(() => Promise.reject(Object.assign(new Error('Invalid credentials'), { data: { detail: 'Email and password required' } })));
      return delay().then(() => MOCK_AUTH);
    }
    if (url.includes('/auth/register'))      return delay().then(() => MOCK_AUTH);
    if (url.includes('/auth/google'))        return delay().then(() => MOCK_AUTH);
    if (url.includes('/auth/verify-token'))  return delay().then(() => MOCK_AUTH);
    if (url.includes('/auth/forgot'))        return delay().then(() => ({ message: 'Reset link sent' }));
    return delay().then(() => ({}));
  },
  put:    (url, data) => delay().then(() => ({})),
  delete: (url) => delay().then(() => ({})),
  patch:  (url, data) => delay().then(() => ({})),
  request:(endpoint, opts) => delay().then(() => ({})),
};

// Named utility exports used by some screens
export const getApiUrl = (path = '') => `https://api.socialbeats.app${path}`;
export const BASE_URL  = 'https://api.socialbeats.app';

// Also export as default (axios-like)
export default api;
