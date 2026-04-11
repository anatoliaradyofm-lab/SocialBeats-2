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

// Home data cache: per-country, 24h local cache
const _homeCacheMap = new Map(); // region → { data, expiresAt }

const _COUNTRY_TO_ISO = {
  'turkey':'TR','türkiye':'TR','turkiye':'TR',
  'united states':'US','usa':'US','america':'US',
  'united kingdom':'GB','uk':'GB','britain':'GB',
  'germany':'DE','almanya':'DE','france':'FR','fransa':'FR',
  'brazil':'BR','brasil':'BR','brezilya':'BR',
  'australia':'AU','canada':'CA','italy':'IT','spain':'ES',
  'netherlands':'NL','sweden':'SE','norway':'NO','denmark':'DK',
  'finland':'FI','austria':'AT','switzerland':'CH','belgium':'BE',
  'poland':'PL','russia':'RU','japan':'JP','south korea':'KR',
  'india':'IN','mexico':'MX','argentina':'AR','chile':'CL',
  'colombia':'CO','south africa':'ZA','portugal':'PT',
  'hungary':'HU','czech republic':'CZ','romania':'RO','greece':'GR',
  'israel':'IL','nigeria':'NG','egypt':'EG','indonesia':'ID',
  'philippines':'PH','thailand':'TH','malaysia':'MY','singapore':'SG',
  'ukraine':'UA','azerbaijan':'AZ',
};
const _SC_SUPPORTED = new Set([
  'TR','US','GB','DE','FR','BR','AU','CA','IT','ES','NL','SE','NZ','IE',
  'NO','DK','FI','AT','CH','BE','PL','RU','JP','KR','IN','MX','AR','CL',
  'CO','ZA','PT','HU','CZ','RO','GR','IL','NG','EG','ID','PH','TH','MY',
  'SG','UA','AZ',
]);

function _resolveRegion(country) {
  if (!country) return null;
  const key = country.trim().toLowerCase();
  const iso = _COUNTRY_TO_ISO[key] || country.trim().toUpperCase();
  return _SC_SUPPORTED.has(iso) ? iso : null;
}

async function musicHybridHomeData(country = '') {
  const region = _resolveRegion(country);
  const cacheKey = region || 'global';
  const cached = _homeCacheMap.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const labels = ['TRENDING','HOT NOW','NEW RELEASE','FEATURED','TOP PICK','VIRAL','CHART','RISING','POPULAR','MUST HEAR'];

  try {
    const cid = await getScCid();
    if (!cid) throw new Error('no cid');

    const regionParam = region ? `&region=${encodeURIComponent(`soundcloud:regions:${region}`)}` : '';
    const [trendRes, forYouRes] = await Promise.all([
      fetch(`${SC_PROXY}/charts?kind=trending&genre=soundcloud%3Agenres%3Aall-music&limit=20&client_id=${cid}&linked_partitioning=1${regionParam}`),
      fetch(`${SC_PROXY}/charts?kind=top&genre=soundcloud%3Agenres%3Aall-music&limit=10&client_id=${cid}&linked_partitioning=1${regionParam}`),
    ]);

    const parseTrack = (item, rank) => {
      const t = item.track || item;
      if (!t?.id) return null;
      const tcs = t.media?.transcodings || [];
      const tc = tcs.find(x => x.format?.protocol === 'progressive' && !x.snipped)
               || tcs.find(x => x.format?.protocol === 'hls'         && !x.snipped);
      if (!tc) return null;  // oynatılamayan track'i atla
      const id = String(t.id);
      // Aynı pattern search ile aynı: Vite proxy üzerinden direkt transcoding URL
      const tcProxyUrl = tc.url.replace('https://api-v2.soundcloud.com', SC_PROXY) + `?client_id=${cid}`;
      const plays = t.playback_count || 0;
      const fmtPlays = plays >= 1e6 ? `${(plays/1e6).toFixed(1)}M` : plays >= 1e3 ? `${(plays/1e3).toFixed(0)}K` : String(plays);
      return {
        id, rank,
        title:        t.title || '',
        artist:       t.user?.username || '',
        artist_name:  t.user?.username || '',
        cover_url:    (t.artwork_url || '').replace('-large', '-t500x500'),
        thumbnail:    (t.artwork_url || '').replace('-large', '-t500x500'),
        duration:     Math.floor((t.duration || 0) / 1000),
        plays_approx: fmtPlays,
        source:       'soundcloud',
        stream_url:   tcProxyUrl,   // PlayerContext: audio_url || stream_url → bu kullanılır
        audio_url:    tcProxyUrl,   // fallback
      };
    };

    const trendData   = trendRes.ok  ? (await trendRes.json()).collection  || [] : [];
    const forYouData  = forYouRes.ok ? (await forYouRes.json()).collection || [] : [];

    const featured = trendData.slice(0, 10).map((item, i) => {
      const t = parseTrack(item, i + 1);
      return t ? { ...t, label: labels[i] } : null;
    }).filter(Boolean);

    const trending = trendData.slice(10, 20).map((item, i) => parseTrack(item, i + 11)).filter(Boolean);
    const for_you  = forYouData.slice(0, 10).map((item, i) => parseTrack(item, i + 1)).filter(Boolean);

    // Ülke için sonuç boşsa global'e fallback
    let finalFeatured = featured, finalTrending = trending, finalForYou = for_you;
    if (region && featured.length === 0) {
      console.warn(`[homeData] ${region} için veri yok, global'e düşüyor`);
      const globalData = await musicHybridHomeData('');
      return globalData;
    }

    const result = { featured: finalFeatured, trending: finalTrending, for_you: finalForYou, region: cacheKey };
    _homeCacheMap.set(cacheKey, { data: result, expiresAt: Date.now() + 24 * 3600 * 1000 });
    return result;
  } catch (e) {
    console.warn('[homeData] SC failed, returning empty', e);
    return { featured: [], trending: [], for_you: [] };
  }
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

/* Mutable mock user — persisted in localStorage so changes survive page refresh */
const _DEFAULT_USER = { id: 'preview-1', username: 'socialbeats_user', display_name: 'SocialBeats User', email: 'preview@socialbeats.app', avatar_url: 'https://i.pravatar.cc/200?u=preview1', bio: '', followers_count: 1200, following_count: 450, posts_count: 2, instagram: '', twitter: '', country: '', city: '', location: '', website: '', is_private: false };
function _loadMockUser() {
  try { const s = localStorage.getItem('_mock_user'); if (s) return { ..._DEFAULT_USER, ...JSON.parse(s) }; } catch {}
  return { ..._DEFAULT_USER };
}
function _saveMockUser(u) {
  try { localStorage.setItem('_mock_user', JSON.stringify(u)); } catch {}
}
let _mockUser = _loadMockUser();
const MOCK_USER = _mockUser;
const MOCK_AUTH = { access_token: 'preview-token', token: 'preview-token', user: _mockUser };

const MOCK_DISCOVER_USERS = [
  { id: 'u1',  username: 'demo_ahmet',   display_name: 'Ahmet Yılmaz',     instagram: 'ahmet.music',    twitter: 'ahmetyilmaz',   avatar_url: 'https://i.pravatar.cc/300?img=12', cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80', bio: 'Müzik benim hayatım 🎵 | İstanbul | DJ & Prodüktör',         country: 'Türkiye', city: 'İstanbul', gender: 'male',   music_genres: ['Electronic', 'Hip-Hop', 'R&B'],   is_verified: true,  follower_count: 1240, following_count: 380, post_count: 87,  mutual_friends: 3 },
  { id: 'u2',  username: 'demo_zeynep',  display_name: 'Zeynep Kaya',      avatar_url: 'https://i.pravatar.cc/300?img=5',  cover_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80', bio: 'Pop & Soul lover. Ankara native, music addict.',               country: 'Türkiye', city: 'Ankara',   gender: 'female', music_genres: ['Pop', 'Soul', 'Jazz'],             is_verified: false, follower_count: 432,  following_count: 210, post_count: 34,  mutual_friends: 0 },
  { id: 'u3',  username: 'demo_carlos',  display_name: 'Carlos Rivera',    avatar_url: 'https://i.pravatar.cc/300?img=33', cover_url: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80', bio: 'Latin vibes | Madrid | Guitar player 🎸',                      country: 'Spain',   city: 'Madrid',   gender: 'male',   music_genres: ['Latin', 'Flamenco', 'Pop'],        is_verified: true,  follower_count: 3800, following_count: 920, post_count: 215, mutual_friends: 1 },
  { id: 'u4',  username: 'demo_sofia',   display_name: 'Sofia Dubois',     avatar_url: 'https://i.pravatar.cc/300?img=47', cover_url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800&q=80', bio: 'Electronic music producer from Paris. Peace & bass 🎛️',      country: 'France',  city: 'Paris',    gender: 'female', music_genres: ['Electronic', 'House', 'Techno'],   is_verified: true,  follower_count: 8200, following_count: 540, post_count: 312, mutual_friends: 0 },
  { id: 'u5',  username: 'demo_mehmet',  display_name: 'Mehmet Demir',     avatar_url: 'https://i.pravatar.cc/300?img=68', cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80', bio: 'Hip-hop producer | İzmir | Beats & bars 🎤',                  country: 'Türkiye', city: 'İzmir',    gender: 'male',   music_genres: ['Hip-Hop', 'Trap', 'R&B'],          is_verified: false, follower_count: 760,  following_count: 450, post_count: 62,  mutual_friends: 2 },
  { id: 'u6',  username: 'demo_lena',    display_name: 'Lena Fischer',     avatar_url: 'https://i.pravatar.cc/300?img=9',  cover_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80', bio: 'Classical meets Electronic | Berlin | Piano & Synths 🎹',     country: 'Germany', city: 'Berlin',   gender: 'female', music_genres: ['Classical', 'Electronic', 'Ambient'], is_verified: true,  follower_count: 5100, following_count: 290, post_count: 178, mutual_friends: 0 },
  { id: 'u7',  username: 'demo_james',   display_name: 'James Okafor',     avatar_url: 'https://i.pravatar.cc/300?img=70', cover_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80', bio: 'Afrobeats & Highlife from Lagos 🌍 | Music is life',           country: 'Nigeria', city: 'Lagos',    gender: 'male',   music_genres: ['Afrobeats', 'Highlife', 'R&B'],    is_verified: false, follower_count: 2300, following_count: 610, post_count: 94,  mutual_friends: 0 },
  { id: 'u8',  username: 'demo_ana',     display_name: 'Ana Beatriz',      avatar_url: 'https://i.pravatar.cc/300?img=25', cover_url: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800&q=80', bio: 'Samba & Bossa Nova | São Paulo 🇧🇷 | Soul singer',            country: 'Brazil',  city: 'São Paulo',gender: 'female', music_genres: ['Bossa Nova', 'Samba', 'Jazz'],     is_verified: true,  follower_count: 4700, following_count: 330, post_count: 201, mutual_friends: 1 },
  { id: 'u9',  username: 'demo_yuki',    display_name: 'Yuki Tanaka',      avatar_url: 'https://i.pravatar.cc/300?img=44', cover_url: 'https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=800&q=80', bio: 'J-Pop & City Pop 🎌 | Tokyo | Vinyl collector',               country: 'Japan',   city: 'Tokyo',    gender: 'female', music_genres: ['J-Pop', 'City Pop', 'Electronic'], is_verified: false, follower_count: 1890, following_count: 420, post_count: 133, mutual_friends: 0 },
  { id: 'u10', username: 'demo_ivan',    display_name: 'Ivan Petrov',      avatar_url: 'https://i.pravatar.cc/300?img=60', cover_url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=80', bio: 'EDM & Techno | Moscow → Berlin 🎛️ | DJ since 2015',          country: 'Russia',  city: 'Moscow',   gender: 'male',   music_genres: ['Techno', 'EDM', 'Trance'],         is_verified: false, follower_count: 3200, following_count: 780, post_count: 156, mutual_friends: 0 },
  { id: 'u11', username: 'demo_fatima',  display_name: 'Fatima Al-Rashid', avatar_url: 'https://i.pravatar.cc/300?img=16', cover_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&q=80', bio: 'Oriental fusion & Arabic pop 🎵 | Cairo | Oud player',        country: 'Egypt',   city: 'Cairo',    gender: 'female', music_genres: ['Arabic Pop', 'Oriental', 'Folk'],  is_verified: true,  follower_count: 6800, following_count: 290, post_count: 247, mutual_friends: 0 },
  { id: 'u12', username: 'demo_arjun',   display_name: 'Arjun Sharma',     avatar_url: 'https://i.pravatar.cc/300?img=57', cover_url: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&q=80', bio: 'Bollywood & Indie | Mumbai 🎶 | Music producer & composer',   country: 'India',   city: 'Mumbai',   gender: 'male',   music_genres: ['Bollywood', 'Indie', 'Electronic'], is_verified: false, follower_count: 4100, following_count: 510, post_count: 189, mutual_friends: 2 },
  { id: 'u13', username: 'demo_emma',    display_name: 'Emma Clarke',      avatar_url: 'https://i.pravatar.cc/300?img=20', cover_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80', bio: 'Indie & Alternative | London 🎸 | Singer-songwriter',         country: 'United Kingdom', city: 'London', gender: 'female', music_genres: ['Indie', 'Alternative', 'Folk'], is_verified: true, follower_count: 9200, following_count: 460, post_count: 385, mutual_friends: 0 },
  { id: 'u14', username: 'demo_elvin',   display_name: 'Elvin Həsənov',    avatar_url: 'https://i.pravatar.cc/300?img=65', cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80', bio: 'Mugham & Jazz fusion | Baku 🎺 | Tar & saxophone',            country: 'Azerbaijan', city: 'Baku', gender: 'male',   music_genres: ['Mugham', 'Jazz', 'Folk'],          is_verified: false, follower_count: 920,  following_count: 340, post_count: 51,  mutual_friends: 1 },
  { id: 'u15', username: 'demo_giulia',  display_name: 'Giulia Romano',    avatar_url: 'https://i.pravatar.cc/300?img=30', cover_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80', bio: 'Opera & Classical | Milan 🎻 | Soprano & music teacher',      country: 'Italy',   city: 'Milan',    gender: 'female', music_genres: ['Opera', 'Classical', 'Pop'],       is_verified: true,  follower_count: 7300, following_count: 180, post_count: 290, mutual_friends: 0 },
];

/* ── Following / Followers persistence ── */
const _DEFAULT_FOLLOWING_IDS = ['u3', 'u4', 'u5'];

function _loadSet(key, defaults) {
  try { const s = localStorage.getItem(key); if (s) return new Set(JSON.parse(s)); } catch {}
  return new Set(defaults || []);
}
function _saveSet(key, set) {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch {}
}
function _loadMap(key) {
  try { const s = localStorage.getItem(key); if (s) return new Map(JSON.parse(s)); } catch {}
  return new Map();
}
function _saveMap(key, map) {
  try { localStorage.setItem(key, JSON.stringify([...map])); } catch {}
}

// Engellenen kullanıcı ID'leri — her çağrıda localStorage'dan taze oku
function _blockedIds() {
  try { return new Set((JSON.parse(localStorage.getItem('_mock_blocked') || '[]')).map(b => b.id)); } catch { return new Set(); }
}

// ── Story helpers ─────────────────────────────────────────────────────────────
function _getStories() {
  try { return JSON.parse(localStorage.getItem('_mock_stories') || '[]'); } catch { return []; }
}
function _saveStories(arr) {
  try { localStorage.setItem('_mock_stories', JSON.stringify(arr)); } catch {}
}

// Seed mock stories for other users (shown once if localStorage is empty)
function _seedStoriesIfEmpty() {
  try {
    if (localStorage.getItem('_mock_stories_seeded')) return;
    localStorage.setItem('_mock_stories_seeded', '1');
    const now = Date.now();
    const seed = [
      {
        id: 'seed_s1', user_id: 'dj1', username: 'djauroramusic',
        user_avatar: 'https://i.pravatar.cc/300?u=dj1', user_display_name: 'DJ Aurora',
        story_type: 'photo', text: 'On stage tonight 🎧', media_url: 'https://picsum.photos/seed/story1/400/700',
        media_type: 'image', background_color: '#1A0A2E', filter_id: 'none',
        viewers: [], viewers_count: 42, is_viewed: false, is_expired: false,
        created_at: new Date(now - 3600000).toISOString(),
        expires_at: new Date(now + 20 * 3600000).toISOString(),
      },
      {
        id: 'seed_s2', user_id: 'ml3', username: 'melodica_tr',
        user_avatar: 'https://i.pravatar.cc/300?u=ml3', user_display_name: 'Melodica TR',
        story_type: 'text', text: 'Müzik ruhun gıdasıdır 🎵', media_url: null,
        media_type: null, background_color: '#7C3AED', filter_id: 'none',
        viewers: [], viewers_count: 18, is_viewed: false, is_expired: false,
        created_at: new Date(now - 7200000).toISOString(),
        expires_at: new Date(now + 17 * 3600000).toISOString(),
      },
      {
        id: 'seed_s3', user_id: 'nb1', username: 'nova.beats',
        user_avatar: 'https://i.pravatar.cc/300?u=nb1', user_display_name: 'Nova Beats',
        story_type: 'photo', text: null, media_url: 'https://picsum.photos/seed/story3/400/700',
        media_type: 'image', background_color: '#065F46', filter_id: 'none',
        viewers: [], viewers_count: 7, is_viewed: false, is_expired: false,
        created_at: new Date(now - 1800000).toISOString(),
        expires_at: new Date(now + 22 * 3600000).toISOString(),
      },
    ];
    _saveStories(seed);
  } catch {}
}
_seedStoriesIfEmpty();

let _following        = _loadSet('_mock_following', _DEFAULT_FOLLOWING_IDS);
let _removedFollowers = _loadSet('_mock_removed_followers', []);
let _userDeltas       = _loadMap('_mock_user_deltas'); // id → {followers_count, following_count}
let _acceptedFollowers  = _loadSet('_mock_accepted_followers', []); // user IDs accepted from follow requests
let _deletedNotifIds    = _loadSet('_mock_deleted_notifs', []);    // silinen bildirim ID'leri
let _readNotifIds       = _loadSet('_mock_read_notifs', []);       // okundu işaretlenen bildirim ID'leri
let _readConvIds        = _loadSet('_mock_read_convs', []);        // okundu işaretlenen konuşma ID'leri

const MOCK_UNREAD_CONVS = { c1: 3, c3: 1 }; // id → unreadCount (başlangıç)

// Bildirim mock'undaki takip isteği sahiplerinin profil verisi
const MOCK_NOTIF_USERS = {
  'nova.beats':    { id: 'nb1', username: 'nova.beats',    display_name: 'Nova Beats',    avatar_url: 'https://i.pravatar.cc/300?u=nb1', bio: 'Electronic & Ambient | Berlin 🎛️', followers_count: 312, following_count: 180, posts_count: 24, is_verified: false, music_genres: ['Electronic', 'Ambient'], country: 'Germany', city: 'Berlin' },
  'djauroramusic': { id: 'dj1', username: 'djauroramusic', display_name: 'DJ Aurora',     avatar_url: 'https://i.pravatar.cc/300?u=dj1', bio: 'DJ & Producer 🎧 | Techno & House', followers_count: 4200, following_count: 310, posts_count: 156, is_verified: true,  music_genres: ['Techno', 'House', 'Electronic'], country: 'Netherlands', city: 'Amsterdam' },
  'beatmaker99':   { id: 'bm2', username: 'beatmaker99',   display_name: 'BeatMaker 99',  avatar_url: 'https://i.pravatar.cc/300?u=bm2', bio: 'Hip-hop beats | Chicago 🎤',        followers_count: 890, following_count: 240, posts_count: 67, is_verified: false, music_genres: ['Hip-Hop', 'Trap'], country: 'USA', city: 'Chicago' },
  'melodica_tr':   { id: 'ml3', username: 'melodica_tr',   display_name: 'Melodica TR',   avatar_url: 'https://i.pravatar.cc/300?u=ml3', bio: 'Müzik & sanat | İstanbul 🎵',       followers_count: 1100, following_count: 430, posts_count: 88, is_verified: false, music_genres: ['Pop', 'Indie'], country: 'Türkiye', city: 'İstanbul' },
  'synthwave_fan': { id: 'sw5', username: 'synthwave_fan', display_name: 'Synthwave Fan', avatar_url: 'https://i.pravatar.cc/300?u=sw5', bio: 'Retro synth lover 🌆 | LA',          followers_count: 560, following_count: 200, posts_count: 43, is_verified: false, music_genres: ['Synthwave', 'Retrowave'], country: 'USA', city: 'Los Angeles' },
  'themidnight':   { id: 'tm6', username: 'themidnight',   display_name: 'The Midnight',  avatar_url: 'https://picsum.photos/seed/tm/300/300', bio: 'Synthwave & Indie Pop 🎹',   followers_count: 92000, following_count: 150, posts_count: 412, is_verified: true, music_genres: ['Synthwave', 'Indie Pop'], country: 'USA', city: 'Los Angeles' },
  'karamuzik':     { id: 'km6', username: 'karamuzik',     display_name: 'Kara Müzik',    avatar_url: 'https://i.pravatar.cc/300?u=km6', bio: 'Dark ambient & drone | Ankara 🖤',  followers_count: 234, following_count: 98, posts_count: 19, is_verified: false, music_genres: ['Dark Ambient', 'Drone'], country: 'Türkiye', city: 'Ankara' },
};
// request_id → kullanıcı id eşlemesi (bildirim mock'u için)
const MOCK_REQUEST_MAP = { 'req1': 'nb1' };

const api = {
  // Auth — returns data directly (no .data wrapper), matching real api.js fetch behavior
  login:    (data) => delay().then(() => MOCK_AUTH),
  register: (data) => delay().then(() => MOCK_AUTH),
  logout:   ()     => delay().then(() => ({})),

  // Profile
  getProfile:       (id) => delay().then(() => ({ data: { id, username: id || _mockUser.username, followers_count: 1200, following_count: 450 } })),
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
    // Notification preferences
    if (url === '/notifications/preferences') {
      try {
        const saved = localStorage.getItem('_mock_notif_prefs');
        if (saved) return delay().then(() => JSON.parse(saved));
      } catch {}
      return delay().then(() => ({ push: true, messages: true, likes: true, comments: true, follows: true }));
    }
    // Data export
    if (url === '/account/data-export') {
      return delay(1200).then(() => ({ message: 'Dışa aktarma işleminiz hazırlandı. E-postanızı kontrol edin.' }));
    }
    // Blocked users list
    if (url === '/social/blocked-users') {
      const blocks = (() => { try { return JSON.parse(localStorage.getItem('_mock_blocked') || '[]'); } catch { return []; } })();
      return delay(300).then(() => blocks);
    }
    // Current user
    if (url === '/auth/me') {
      return delay(100).then(() => ({ ..._mockUser, following_count: _following.size, followers_count: _mockUser.followers_count }));
    }
    // Stats user: /stats/user?period=...
    if (url.startsWith('/stats/user')) {
      const _sp = new URLSearchParams(url.includes('?') ? url.slice(url.indexOf('?') + 1) : '');
      const _per = _sp.get('period') || 'month';
      const _m = _per === 'week' ? 0.25 : _per === 'month' ? 1 : _per === '90d' ? 3 : _per === '180d' ? 6 : 12;
      const _r = (base, rng) => Math.round(base * _m + (Math.random() - 0.5) * rng * _m);
      return delay(200).then(() => ({
        listening: {
          total_minutes: _r(3240, 200), total_tracks: _r(480, 40), unique_artists: _r(62, 10),
          daily_average: Math.round(108 + (Math.random() - 0.5) * 20),
          top_artists: [
            { name: 'The Weeknd',        play_count: _r(58, 10) },
            { name: 'Daft Punk',         play_count: _r(41, 8)  },
            { name: 'Frank Ocean',       play_count: _r(34, 6)  },
            { name: 'Billie Eilish',     play_count: _r(28, 5)  },
            { name: 'Tyler the Creator', play_count: _r(21, 4)  },
          ],
          top_tracks: [
            { title: 'Blinding Lights', artist: 'The Weeknd',  play_count: _r(28, 6) },
            { title: 'Get Lucky',       artist: 'Daft Punk',   play_count: _r(22, 5) },
            { title: 'Nights',          artist: 'Frank Ocean', play_count: _r(18, 4) },
            { title: 'Starboy',         artist: 'The Weeknd',  play_count: _r(15, 3) },
            { title: 'Redbone',         artist: 'Childish Gambino', play_count: _r(12, 3) },
          ],
        },
        social: {
          likes_received: _r(342, 50), posts_created: _mockUser.posts_count || 2,
          comments_received: _r(87, 15),
        },
        activity: { days_active: Math.min(Math.round(7 * _m), 365), streak_days: 5, longest_streak: 12 },
      }));
    }
    // Followers analytics
    if (url.startsWith('/profile/analytics/followers')) {
      return delay(200).then(() => ({
        summary: {
          total_followers: _mockUser.followers_count,
          new_followers:   48,
          lost_followers:  12,
          net_growth:      36,
        },
        top_followers: [
          { id: 'u1', username: 'demo_ahmet',  display_name: 'Ahmet Yılmaz', avatar_url: 'https://i.pravatar.cc/80?img=12', engagement_score: 94 },
          { id: 'u3', username: 'demo_carlos', display_name: 'Carlos Rivera', avatar_url: 'https://i.pravatar.cc/80?img=33', engagement_score: 87 },
          { id: 'u4', username: 'demo_sofia',  display_name: 'Sofia Dubois',  avatar_url: 'https://i.pravatar.cc/80?img=47', engagement_score: 76 },
        ],
      }));
    }
    // Profile analytics
    if (url === '/profile/analytics/overview') {
      return delay(200).then(() => ({
        total_followers: _mockUser.followers_count,
        total_following: _following.size,
        total_likes_received: 342,
        total_posts: _mockUser.posts_count || 2,
        reach: '2.4k',
        profile_views: 1280,
        follower_growth: '+12%',
      }));
    }
    if (url === '/profile/analytics/listening') {
      return delay(200).then(() => ({
        total_listening_minutes: 3240,
        top_artist: 'The Weeknd',
        top_genre: 'R&B',
        activity_days: [45, 90, 60, 120, 80, 150, 110],
        top_tracks: [
          { title: 'Blinding Lights', artist: 'The Weeknd', play_count: 28 },
          { title: 'Save Your Tears',  artist: 'The Weeknd', play_count: 21 },
        ],
      }));
    }
    if (url === '/profile/analytics/audience') {
      return delay(200).then(() => ({
        follower_loss_gain: { gained: 48, lost: 12 },
        follower_growth: [1180, 1195, 1200, 1205, 1210, 1218, _mockUser.followers_count],
        demographics_age: [
          { range: '18-24', percentage: 35 },
          { range: '25-34', percentage: 40 },
          { range: '35-44', percentage: 15 },
          { range: '45+',   percentage: 10 },
        ],
        top_locations: [
          { city: 'İstanbul', country: 'Türkiye', percentage: 28 },
          { city: 'Ankara',   country: 'Türkiye', percentage: 14 },
          { city: 'Berlin',   country: 'Germany', percentage: 18 },
          { city: 'New York', country: 'USA',     percentage: 12 },
        ],
      }));
    }
    // User search
    if (url.startsWith('/users/search')) {
      const params = new URLSearchParams(url.includes('?') ? url.slice(url.indexOf('?') + 1) : '');
      const q = (params.get('q') || '').toLowerCase().trim();
      const limit = parseInt(params.get('limit') || '30', 10);
      const blocked = _blockedIds();
      const allUsers = [...MOCK_DISCOVER_USERS, ...Object.values(MOCK_NOTIF_USERS)].filter(u => !blocked.has(u.id));
      const results = q
        ? allUsers.filter(u =>
            u.username?.toLowerCase().includes(q) ||
            u.display_name?.toLowerCase().includes(q) ||
            u.name?.toLowerCase().includes(q)
          ).slice(0, limit)
        : allUsers.slice(0, limit);
      return delay(200).then(() => ({ users: results.map(u => ({ ...u, is_following: _following.has(u.id) })) }));
    }
    // Discover countries
    if (url === '/users/discover/countries') {
      const countries = [...new Set(MOCK_DISCOVER_USERS.map(u => u.country).filter(Boolean))].sort();
      const genders   = ['male', 'female', 'other'];
      return delay(200).then(() => ({ countries, genders }));
    }
    // Discover users (with country/gender filtering)
    if (url.startsWith('/users/discover')) {
      const params  = new URLSearchParams(url.includes('?') ? url.slice(url.indexOf('?') + 1) : '');
      const country = params.get('country') || '';
      const gender  = params.get('gender')  || '';
      const limit   = parseInt(params.get('limit')  || '15', 10);
      const offset  = parseInt(params.get('offset') || '0',  10);
      const blocked = _blockedIds();
      let list = MOCK_DISCOVER_USERS.filter(u => u.id !== 'preview-1' && !blocked.has(u.id));
      if (country) list = list.filter(u => u.country?.toLowerCase().includes(country.toLowerCase()));
      if (gender)  list = list.filter(u => u.gender?.toLowerCase() === gender.toLowerCase());
      const page = list.slice(offset, offset + limit);
      return delay(300).then(() => ({ users: page.map(u => ({ ...u, is_following: _following.has(u.id) })), total: list.length, has_more: offset + page.length < list.length }));
    }
    // Now playing for a user: /users/{id}/now-playing
    if (url.includes('/now-playing')) {
      const uid = url.split('/users/')[1]?.split('/')[0];
      const playingMap = {
        'u1':  { title: 'Blinding Lights', artist: 'The Weeknd',  cover_url: 'https://picsum.photos/seed/blindinglights/80/80' },
        'u4':  { title: 'One More Time',   artist: 'Daft Punk',   cover_url: 'https://picsum.photos/seed/omt/80/80' },
        'dj1': { title: 'Sandstorm',       artist: 'Darude',      cover_url: 'https://picsum.photos/seed/sandstorm/80/80' },
      };
      return delay(200).then(() => ({ now_playing: playingMap[uid] || null }));
    }
    // Listening stats for a user: /users/{id}/listening-stats
    if (url.includes('/listening-stats')) {
      const uid = url.split('/users/')[1]?.split('/')[0];
      const allUsers = [...MOCK_DISCOVER_USERS, ...Object.values(MOCK_NOTIF_USERS)];
      const found = allUsers.find(u => u.id === uid);
      const genres = found?.music_genres || ['Pop', 'Electronic', 'Hip-Hop', 'R&B', 'Indie'];
      const counts = genres.map((_, i) => 100 - i * 16);
      const totalC = counts.reduce((a, b) => a + b, 1);
      const weeklyMins = [42, 95, 58, 120, 75, 160, 88];
      return delay(200).then(() => ({
        total_minutes: 1840,
        total_tracks: 247,
        unique_artists: 38,
        top_genres: genres.map((g, i) => ({
          genre: g, label: g, count: counts[i],
          percentage: Math.round(counts[i] * 100 / totalC),
        })),
        top_artists: [
          { name: 'The Weeknd',  play_count: 48 },
          { name: 'Daft Punk',   play_count: 35 },
          { name: 'Frank Ocean', play_count: 28 },
        ],
        weekly_minutes_per_day: weeklyMins,
        total_hours_this_week: Math.round(weeklyMins.reduce((a, b) => a + b, 0) / 60),
      }));
    }
    // Taste match: /users/{id}/taste-match
    if (url.includes('/taste-match')) {
      const uid = url.split('/users/')[1]?.split('/')[0];
      const allUsers = [...MOCK_DISCOVER_USERS, ...Object.values(MOCK_NOTIF_USERS)];
      const found = allUsers.find(u => u.id === uid);
      const genres = found?.music_genres || [];
      const myGenres = ['Electronic', 'Hip-Hop', 'R&B', 'Pop'];
      const common = genres.filter(g => myGenres.includes(g));
      const pct = Math.min(92, Math.max(12, common.length * 28 + 15));
      return delay(200).then(() => ({
        match_percentage: pct,
        common_genres:  common.length > 0 ? common : [genres[0] || 'Pop'],
        common_artists: ['The Weeknd', 'Daft Punk', 'Frank Ocean'].slice(0, common.length + 1),
      }));
    }
    // Playlists for a specific user
    if (url.startsWith('/playlists/user/')) {
      const uid = url.split('/playlists/user/')[1]?.split('?')[0];
      const allUsers = [...MOCK_DISCOVER_USERS, ...Object.values(MOCK_NOTIF_USERS)];
      const found = allUsers.find(u => u.id === uid);
      if (!found) return delay(200).then(() => ({ playlists: [] }));
      const uname = found.username;
      return delay(200).then(() => ({ playlists: [
        { id: `${uid}-pl1`, name: 'En Sevdiklerim',  cover_url: `https://picsum.photos/seed/${uname}pl1/200/200`, track_count: 24 },
        { id: `${uid}-pl2`, name: 'Sabah Müziği',    cover_url: `https://picsum.photos/seed/${uname}pl2/200/200`, track_count: 12 },
        { id: `${uid}-pl3`, name: 'Gece Playlistim', cover_url: `https://picsum.photos/seed/${uname}pl3/200/200`, track_count: 18 },
      ]}));
    }
    // Recent tracks for a user
    if (url.includes('/recent-tracks')) {
      const uid = url.split('/users/')[1]?.split('/')[0];
      // For own profile, use real play history from localStorage
      if (uid === 'preview-1' || uid === _mockUser.id) {
        try {
          const raw = localStorage.getItem('_mock_play_history');
          if (raw) {
            const hist = JSON.parse(raw).slice(0, 5);
            if (hist.length > 0) return delay(150).then(() => ({ tracks: hist }));
          }
        } catch {}
      }
      // Fallback demo tracks
      return delay(200).then(() => ({ tracks: [
        { id: 't1', title: 'Blinding Lights', artist: 'The Weeknd',  cover_url: 'https://picsum.photos/seed/bl/60/60'     },
        { id: 't2', title: 'One More Time',   artist: 'Daft Punk',   cover_url: 'https://picsum.photos/seed/omt/60/60'    },
        { id: 't3', title: 'Nights',          artist: 'Frank Ocean', cover_url: 'https://picsum.photos/seed/nights/60/60' },
        { id: 't4', title: 'Levitating',      artist: 'Dua Lipa',    cover_url: 'https://picsum.photos/seed/lev/60/60'    },
        { id: 't5', title: 'Save Your Tears', artist: 'The Weeknd',  cover_url: 'https://picsum.photos/seed/syt/60/60'    },
      ]}));
    }
    // /users/me/followers
    if (url.startsWith('/users/me/followers')) {
      const blocked = _blockedIds();
      const acceptedUsers = Object.values(MOCK_NOTIF_USERS).filter(u => _acceptedFollowers.has(u.id) && !blocked.has(u.id));
      const followers = [
        ...acceptedUsers,
        ...MOCK_DISCOVER_USERS.filter(u => !_removedFollowers.has(u.id) && !blocked.has(u.id)),
      ].map(u => ({ ...u, type: 'follower', is_following: _following.has(u.id) }));
      return delay(200).then(() => ({ users: followers }));
    }
    // /users/me/following
    if (url.startsWith('/users/me/following')) {
      const blocked = _blockedIds();
      const ALL_USERS = [...MOCK_DISCOVER_USERS, ...Object.values(MOCK_NOTIF_USERS)];
      const following = ALL_USERS.filter(u => _following.has(u.id) && !blocked.has(u.id))
        .map(u => ({ ...u, type: 'following', is_following: true }));
      return delay(200).then(() => ({ users: following }));
    }
    // Followers list: /users/{id}/followers
    if (/^\/users\/[^/]+\/followers/.test(url)) {
      const uid = url.split('/users/')[1].split('/')[0];
      let followers;
      const isOwnProfile = uid === 'preview-1' || uid === _mockUser.id;
      const blocked = _blockedIds();
      if (isOwnProfile) {
        // Benim takipçilerim = removed olmayanlar + kabul edilenler (engellenmiş hariç)
        const acceptedUsers = Object.values(MOCK_NOTIF_USERS).filter(u => _acceptedFollowers.has(u.id) && !blocked.has(u.id));
        followers = [
          ...acceptedUsers,
          ...MOCK_DISCOVER_USERS.filter(u => !_removedFollowers.has(u.id) && !blocked.has(u.id)),
        ];
      } else {
        const baseFollowers = MOCK_DISCOVER_USERS.filter(u => u.id !== uid).slice(0, 5);
        // Eğer mevcut kullanıcı (preview-1) bu kişiyi takip ediyorsa → kendi profilim de takipçiler arasında görünür
        if (_following.has(uid)) {
          const me = {
            ..._mockUser,
            id: _mockUser.id || 'preview-1',
            follower_count: _mockUser.followers_count,
          };
          followers = [me, ...baseFollowers];
        } else {
          followers = baseFollowers;
        }
      }
      const mapped = followers.map(u => ({
        ...u,
        followers_count: (u.follower_count ?? u.followers_count ?? 0) + (_userDeltas.get(u.id)?.followers_count ?? 0),
        following_count: u.following_count ?? 0,
        // is_following: mevcut kullanıcı bu takipçiyi takip ediyor mu?
        is_following: _following.has(u.id),
        // is_mutual: kendi takipçi listesinde → ben de onları takip ediyorsam karşılıklı
        is_mutual: isOwnProfile ? _following.has(u.id) : false,
      }));
      return delay(200).then(() => ({ users: mapped }));
    }
    // Following list: /users/{id}/following
    if (/^\/users\/[^/]+\/following/.test(url)) {
      const uid = url.split('/users/')[1].split('/')[0];
      const isOwnProfile = uid === 'preview-1' || uid === _mockUser.id;
      const blocked = _blockedIds();
      // Tüm kullanıcı havuzu (ben dahil, engellenmiş hariç)
      const ALL_USERS = [...MOCK_DISCOVER_USERS, ...Object.values(MOCK_NOTIF_USERS)].filter(u => !blocked.has(u.id));
      let followingList;
      if (isOwnProfile) {
        // Benim takip ettiklerim → _following seti (engellenmiş hariç)
        followingList = ALL_USERS.filter(u => _following.has(u.id));
      } else {
        // Başkasının (uid) takip ettikleri
        // uid beni (preview-1) takip ediyor mu? → uid benim takipçilerimde ve kaldırılmamışsa evet
        const uidFollowsMe = (
          MOCK_DISCOVER_USERS.some(u => u.id === uid) && !_removedFollowers.has(uid)
        ) || (
          Object.values(MOCK_NOTIF_USERS).some(u => u.id === uid) && _acceptedFollowers.has(uid)
        );
        // Örnek takip listesi (uid hariç, ben hariç)
        const base = ALL_USERS.filter(u => u.id !== uid && u.id !== (_mockUser.id || 'preview-1')).slice(0, 4);
        // uid beni takip ediyorsa → listesine beni de ekle
        if (uidFollowsMe) {
          followingList = [{ ..._mockUser, follower_count: _mockUser.followers_count }, ...base];
        } else {
          followingList = base;
        }
      }
      const mapped = followingList.map(u => {
        const isMockUser = u.id === (_mockUser.id || 'preview-1');
        return {
          ...u,
          followers_count: isMockUser
            ? (_mockUser.followers_count || 0)
            : (u.follower_count ?? u.followers_count ?? 0) + (_userDeltas.get(u.id)?.followers_count ?? 0),
          following_count: isMockUser ? (_mockUser.following_count || 0) : (u.following_count ?? 0),
          // is_following: mevcut kullanıcı (ben) bu kişiyi takip ediyor mu?
          is_following: isMockUser ? false : _following.has(u.id),
          // is_mutual: yalnızca kendi listesinde anlamlı
          is_mutual: isOwnProfile ? (_following.has(u.id) && !_removedFollowers.has(u.id)) : false,
        };
      });
      return delay(200).then(() => ({ users: mapped }));
    }
    // Mutual followers
    if (url.includes('/mutual-followers')) {
      const uid = url.split('/mutual-followers/')[1]?.split('?')[0];
      const following = MOCK_DISCOVER_USERS.filter(u => _following.has(u.id)).slice(0, 3);
      return delay(200).then(() => ({ users: following.map(u => ({
        ...u, followers_count: u.follower_count ?? 0, following_count: u.following_count ?? 0,
      }))}));
    }
    // User profile by username: /user/{username}
    if (url.startsWith('/user/')) {
      const uname = url.split('/user/')[1]?.split('?')[0];
      let found = MOCK_DISCOVER_USERS.find(u => u.username === uname)
        || MOCK_NOTIF_USERS[uname]
        || MOCK_DISCOVER_USERS.find(u => u.id === uname)
        || Object.values(MOCK_NOTIF_USERS).find(u => u.id === uname)
        || (uname === _mockUser.username || uname === _mockUser.id ? _mockUser : null);
      if (!found) {
        // Generate a basic profile for mock conversation users not in discover list
        found = {
          id: uname,
          username: uname,
          display_name: uname.charAt(0).toUpperCase() + uname.slice(1).replace(/_/g, ' '),
          avatar_url: `https://i.pravatar.cc/300?u=${uname}`,
          bio: 'Müzik severi 🎵',
          music_genres: ['Pop', 'Electronic'],
          country: '',
          city: '',
          follower_count: Math.floor(Math.random() * 500) + 50,
          following_count: Math.floor(Math.random() * 200) + 20,
          post_count: Math.floor(Math.random() * 30) + 1,
          is_verified: false,
        };
      }
      const deltas = _userDeltas.get(found.id) || {};
      const isFollowing = _following.has(found.id);
      const isBlocked = _blockedIds().has(found.id);
      return delay(200).then(() => ({
        ...found,
        followers_count: (found.follower_count ?? found.followers_count ?? 0) + (deltas.followers_count ?? 0),
        following_count: (found.following_count ?? 0),
        posts_count:     found.post_count ?? found.posts_count ?? 0,
        is_following:    isBlocked ? false : isFollowing,
        is_blocked_by_me: isBlocked,
        is_locked:       false,
        friend_request_status: 'none',
        instagram:       found.instagram || found.username,
        twitter:         found.twitter   || found.username,
        favorite_artists: found.favorite_artists || ['The Weeknd', 'Billie Eilish', 'Daft Punk', 'Frank Ocean'],
        badges:          found.badges || ['new_user', 'music_lover', 'explorer'],
      }));
    }
    // /music-hybrid/home — ana sayfa günlük SC verileri (mock)
    if (url === '/music-hybrid/home' || url.startsWith('/music-hybrid/home?')) {
      const params = new URLSearchParams(url.includes('?') ? url.slice(url.indexOf('?') + 1) : '');
      return musicHybridHomeData(params.get('country') || '');
    }

    if (url.startsWith('/search') || url.startsWith('/music-hybrid')) {
      const params = new URLSearchParams(url.includes('?') ? url.slice(url.indexOf('?') + 1) : '');
      const q = (params.get('q') || '').toLowerCase();
      const limit = parseInt(params.get('limit') || '8', 10);
      const type = params.get('type') || '';
      if (!q) return Promise.resolve({ tracks: [], users: [], playlists: [], posts: [] });
      // User search
      if (type === 'users') {
        const blocked = _blockedIds();
        const allPool = [...MOCK_DISCOVER_USERS, ...Object.values(MOCK_NOTIF_USERS)].filter(u => !blocked.has(u.id));
        const allUsers = allPool.filter(u =>
          (u.username || '').toLowerCase().includes(q) ||
          (u.display_name || '').toLowerCase().includes(q) ||
          (u.name || '').toLowerCase().includes(q)
        ).slice(0, limit);
        return delay(200).then(() => ({ users: allUsers.map(u => ({ ...u, is_following: _following.has(u.id) })) }));
      }
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
    // Notifications list
    if (url === '/notifications' || url.startsWith('/notifications?')) {
      const now = Date.now();
      const all = [
        { id:'n1', type:'follow_request', actor_username:'nova.beats',    actor_avatar:'https://i.pravatar.cc/80?u=nb1', body:'nova.beats seni takip etmek istiyor',         reference_id:'req1', read:false, created_at: new Date(now - 2*60000).toISOString() },
        { id:'n2', type:'follow',         actor_username:'djauroramusic', actor_avatar:'https://i.pravatar.cc/80?u=dj1', body:'djauroramusic seni takip etmeye başladı',      reference_id:null,   read:false, created_at: new Date(now - 5*60000).toISOString() },
        { id:'n3', type:'like',           actor_username:'beatmaker99',   actor_avatar:'https://i.pravatar.cc/80?u=bm2', body:'beatmaker99 paylaşımını beğendi',             reference_id:'post1',read:false, created_at: new Date(now - 12*60000).toISOString() },
        { id:'n4', type:'comment',        actor_username:'melodica_tr',   actor_avatar:'https://i.pravatar.cc/80?u=ml3', body:'Harika bir parça 🔥',                          reference_id:'post1',read:false, created_at: new Date(now - 30*60000).toISOString() },
        { id:'n5', type:'mention',        actor_username:'synthwave_fan', actor_avatar:'https://i.pravatar.cc/80?u=sw5', body:'bu parçayı mutlaka dinle',                    reference_id:'post2',read:false, created_at: new Date(now - 60*60000).toISOString() },
        { id:'n6', type:'follow_accepted',actor_username:'themidnight',   actor_avatar:'https://picsum.photos/seed/tm/80/80', body:'The Midnight takip isteğini kabul etti', reference_id:null,   read:true,  created_at: new Date(now - 2*3600000).toISOString() },
        { id:'n7', type:'release',        actor_username:'themidnight',   actor_avatar:'https://picsum.photos/seed/alb/80/80', body:'Heroes',                               reference_id:null,   read:true,  created_at: new Date(now - 3*3600000).toISOString() },
        { id:'n8', type:'story_react',    actor_username:'karamuzik',     actor_avatar:'https://i.pravatar.cc/80?u=km6', body:'hikayene tepki verdi',                       reference_id:null,   read:true,  created_at: new Date(now - 2*86400000).toISOString() },
      ];
      return delay(150).then(() =>
        all
          .filter(n => !_deletedNotifIds.has(n.id))
          .map(n => _readNotifIds.has(n.id) ? { ...n, read: true } : n)
      );
    }
    // Unread count — _readNotifIds'e göre hesapla
    // Chat messages for a conversation: GET /messages/{convId}
    if (/^\/messages\/[^/?/]+(\?.*)?$/.test(url) && !url.includes('/unread-count') && !url.includes('/conversations')) {
      const convId = url.split('/messages/')[1].split('?')[0];
      const stored = (() => { try { return JSON.parse(localStorage.getItem(`_mock_msgs_${convId}`) || '[]'); } catch { return []; } })();
      // Provide default messages only for non-group conversations
      const isGroup = convId.startsWith('grp_');
      const otherUser = MOCK_DISCOVER_USERS[0] || { id: 'u2', username: 'melodikbeat', display_name: 'MelodikBeat', avatar_url: 'https://i.pravatar.cc/80?u=u2' };
      const base = stored.length ? stored : isGroup ? [] : [
        { id: 'm1', content: 'Merhaba! 👋', content_type: 'TEXT', sender_id: otherUser.id, sender: { id: otherUser.id, username: otherUser.username, display_name: otherUser.display_name, avatar_url: otherUser.avatar_url }, created_at: new Date(Date.now() - 3600000).toISOString(), is_read: true },
        { id: 'm2', content: 'Hey, nasılsın?', content_type: 'TEXT', sender_id: 'preview-1', sender: { id: 'preview-1', username: _mockUser.username, display_name: _mockUser.display_name, avatar_url: _mockUser.avatar_url }, created_at: new Date(Date.now() - 3500000).toISOString(), is_read: true },
        { id: 'm3', content: 'İyiyim, teşekkürler 🎵', content_type: 'TEXT', sender_id: otherUser.id, sender: { id: otherUser.id, username: otherUser.username, display_name: otherUser.display_name, avatar_url: otherUser.avatar_url }, created_at: new Date(Date.now() - 600000).toISOString(), is_read: false },
      ];
      return delay(250).then(() => ({ messages: base, total: base.length }));
    }
    if (url === '/messages/unread-count') {
      const count = Object.entries(MOCK_UNREAD_CONVS)
        .filter(([id]) => !_readConvIds.has(id))
        .reduce((sum, [, n]) => sum + n, 0);
      return delay().then(() => ({ count }));
    }
    if (url === '/notifications/unread-count') {
      const allIds = ['n1','n2','n3','n4','n5'];
      const count = allIds.filter(id => !_deletedNotifIds.has(id) && !_readNotifIds.has(id)).length;
      return delay().then(() => ({ count }));
    }
    // ── Stories GET ───────────────────────────────────────────────────────────
    // GET /stories/my
    if (url === '/stories/my') {
      const mine = _getStories().filter(s => s.user_id === 'preview-1' && new Date(s.expires_at) > new Date());
      return delay(200).then(() => mine);
    }
    // GET /stories/feed
    if (url === '/stories/feed') {
      const all = _getStories().filter(s => new Date(s.expires_at) > new Date());
      const grouped = {};
      for (const story of all) {
        if (!grouped[story.user_id]) {
          grouped[story.user_id] = {
            user_id: story.user_id,
            username: story.username,
            user_avatar: story.user_avatar,
            user_display_name: story.user_display_name,
            stories: [],
            has_unviewed: false,
          };
        }
        grouped[story.user_id].stories.push(story);
        if (!story.is_viewed) grouped[story.user_id].has_unviewed = true;
      }
      // Her kullanıcının hikayeleri: eskiden yeniye sırala (soldan sağa)
      for (const g of Object.values(grouped)) {
        g.stories.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      }
      // Kendi hikayesi önce, diğerleri en son görüntülemeden yeniye
      const vals = Object.values(grouped);
      vals.sort((a, b) => (a.user_id === 'preview-1' ? -1 : b.user_id === 'preview-1' ? 1 : 0));
      return delay(200).then(() => vals);
    }
    // GET /stories/user/{id}
    if (url.match(/^\/stories\/user\/([^/?]+)/)) {
      const userId = url.match(/^\/stories\/user\/([^/?]+)/)[1];
      const stories = _getStories()
        .filter(s => s.user_id === userId && new Date(s.expires_at) > new Date())
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      return delay(200).then(() => stories);
    }
    // GET /stories/{id}/viewers
    if (url.match(/^\/stories\/[^/]+\/viewers/)) {
      return delay(200).then(() => []);
    }
    // GET /stories/{id}/poll/results
    if (url.match(/^\/stories\/[^/]+\/poll\/results/)) {
      return delay(200).then(() => ({ options: [] }));
    }
    return delay().then(() => ({}));
  },
  post:   (url, data) => {
    // Send message: POST /messages (ChatScreen uses this endpoint)
    if (url === '/messages') {
      const convId = data?.conversation_id;
      const newMsg = {
        id: 'msg_' + Date.now(),
        content: data?.content || '',
        content_type: data?.content_type || 'TEXT',
        sender_id: 'preview-1',
        sender: { id: 'preview-1', username: _mockUser.username, display_name: _mockUser.display_name, avatar_url: _mockUser.avatar_url },
        conversation_id: convId,
        created_at: new Date().toISOString(),
        is_read: false,
      };
      if (convId) {
        try {
          const key = `_mock_msgs_${convId}`;
          const existing = JSON.parse(localStorage.getItem(key) || '[]');
          localStorage.setItem(key, JSON.stringify([...existing, newMsg]));
        } catch {}
        // Update lastMsg in _mock_groups for group conversations
        try {
          const groups = JSON.parse(localStorage.getItem('_mock_groups') || '[]');
          const updatedGroups = groups.map(g => g.id === convId
            ? { ...g, lastMsg: data?.content || '📎 Medya', time: 'Şimdi' } : g);
          localStorage.setItem('_mock_groups', JSON.stringify(updatedGroups));
        } catch {}
      }
      return delay(200).then(() => newMsg);
    }
    if (url.match(/\/messages\/conversations\/(.+)\/read/)) {
      const id = url.match(/\/messages\/conversations\/(.+)\/read/)[1];
      _readConvIds.add(id);
      try { localStorage.setItem('_mock_read_convs', JSON.stringify([..._readConvIds])); } catch {}
      return delay().then(() => ({ status: 'ok' }));
    }
    if (url.includes('/auth/login')) {
      if (!data?.email || !data?.password) return delay().then(() => Promise.reject(Object.assign(new Error('Invalid credentials'), { data: { detail: 'Email and password required' } })));
      return delay().then(() => MOCK_AUTH);
    }
    // Track played — persist to localStorage for stats
    if (url.includes('/users/me/track-played') || url.includes('/users/me/now-playing')) {
      if (url.includes('/track-played') && data?.track?.title) {
        try {
          const key = '_mock_play_history';
          const raw = localStorage.getItem(key);
          const hist = raw ? JSON.parse(raw) : [];
          hist.unshift({ ...data.track, played_at: new Date().toISOString(), user_id: 'preview-1' });
          localStorage.setItem(key, JSON.stringify(hist.slice(0, 200)));
        } catch {}
      }
      return delay(100).then(() => ({ status: 'recorded' }));
    }
    // Create group
    if (url === '/messages/groups') {
      const groupId = 'grp_' + Date.now();
      const allUsers = [...MOCK_DISCOVER_USERS, ...Object.values(MOCK_NOTIF_USERS), _mockUser];
      const participants = (data?.participant_ids || [])
        .map(id => allUsers.find(u => u.id === id))
        .filter(Boolean)
        .map(u => ({ id: u.id, username: u.username, display_name: u.display_name || u.name || u.username, avatar_url: u.avatar_url }));
      const group = {
        id: groupId,
        name: data?.name || 'Grup',
        group_name: data?.name || 'Grup',
        is_group: true,
        participants,
        lastMsg: `Grup oluşturuldu · ${participants.length + 1} üye`,
        time: 'Şimdi',
        unread: 0,
        online: false,
        created_at: new Date().toISOString(),
        last_message: null,
      };
      // Also persist to localStorage so ConversationsScreen can show it immediately
      try {
        const existing = JSON.parse(localStorage.getItem('_mock_groups') || '[]');
        if (!existing.find(g => g.id === groupId)) {
          localStorage.setItem('_mock_groups', JSON.stringify([group, ...existing]));
        }
      } catch {}
      return delay(400).then(() => group);
    }
    // ── Stories POST ──────────────────────────────────────────────────────────
    // POST /stories
    if (url === '/stories') {
      const story = {
        id: 'story_' + Date.now(),
        user_id: 'preview-1',
        username: _mockUser.username,
        user_avatar: _mockUser.avatar_url,
        user_display_name: _mockUser.display_name,
        is_verified: _mockUser.is_verified || false,
        story_type: data?.story_type || 'photo',
        text: data?.text || null,
        media_url: data?.media_url || null,
        media_type: data?.media_type || null,
        background_color: data?.background_color || '#8B5CF6',
        filter_id: data?.filter_id || null,
        close_friends_only: data?.close_friends_only || false,
        poll_question: data?.poll_question || null,
        poll_options: data?.poll_options
          ? data.poll_options.map((opt, i) => ({ id: 'opt_' + i, text: opt, votes: 0 }))
          : null,
        music_track_id: data?.music_track_id || null,
        music_start_time: data?.music_start_time || 0,
        music_track: data?.music_track || null,
        photo_scale:    data?.photo_scale    || null,
        photo_offset_x: data?.photo_offset_x || null,
        photo_offset_y: data?.photo_offset_y || null,
        text_pos_x:     data?.text_pos_x     ?? null,
        text_pos_y:     data?.text_pos_y     ?? null,
        text_scale:     data?.text_scale     ?? null,
        text_align:     data?.text_align     ?? null,
        text_style_id:  data?.text_style_id  ?? null,
        viewers: [], viewers_count: 0,
        is_viewed: true, is_expired: false,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      };
      const existing = _getStories();
      _saveStories([story, ...existing]);
      return delay(300).then(() => story);
    }
    // POST /stories/{id}/view
    if (url.match(/^\/stories\/[^/]+\/view$/)) {
      return delay(100).then(() => ({ status: 'ok' }));
    }
    // POST /stories/{id}/react  → DM + bildirim simülasyonu
    if (url.match(/^\/stories\/[^/]+\/react$/)) {
      const storyId = url.split('/')[2];
      const reaction = data?.reaction || '❤️';
      // DM konuşması mock'a kaydet
      try {
        const convs = JSON.parse(localStorage.getItem('_mock_convs') || '[]');
        let conv = convs.find(c => c.story_id === storyId);
        if (!conv) {
          conv = { id: 'conv_react_' + storyId, story_id: storyId, is_group: false, last_message: reaction, last_message_at: new Date().toISOString() };
          convs.push(conv);
          localStorage.setItem('_mock_convs', JSON.stringify(convs));
        }
      } catch {}
      return delay(100).then(() => ({ status: 'ok', reaction, dm_sent: true }));
    }
    // POST /stories/{id}/reply
    if (url.match(/^\/stories\/[^/]+\/reply$/)) {
      return delay(200).then(() => ({ status: 'ok', id: 'reply_' + Date.now() }));
    }
    // POST /stories/{id}/poll/vote
    if (url.match(/^\/stories\/[^/]+\/poll\/vote$/)) {
      return delay(200).then(() => ({ status: 'ok' }));
    }
    // POST /stories/{id}/report
    if (url.match(/^\/stories\/[^/]+\/report$/)) {
      return delay(200).then(() => ({ status: 'reported' }));
    }
    if (url.includes('/auth/register'))      return delay().then(() => MOCK_AUTH);
    if (url.includes('/auth/verify-token'))  return delay().then(() => MOCK_AUTH);
    // Phone password reset (WhatsApp OTP)
    if (url.includes('/auth/phone/reset-password/send-otp')) {
      const phone = data?.phone || '';
      const exists = phone.length >= 8; // mock: any valid phone is "found"
      if (!exists) return delay(400).then(() => Promise.reject(Object.assign(new Error('Kayıtlı hesap yok'), { data: { detail: 'Bu telefon numarası ile kayıtlı hesap bulunamadı' } })));
      try { localStorage.setItem('_mock_reset_otp', JSON.stringify({ phone, code: '123456', expires: Date.now() + 600000 })); } catch {}
      return delay(600).then(() => ({ message: 'Şifre sıfırlama kodu WhatsApp\'a gönderildi', sent: true }));
    }
    if (url.includes('/auth/phone/reset-password/verify')) {
      const stored = (() => { try { return JSON.parse(localStorage.getItem('_mock_reset_otp') || '{}'); } catch { return {}; } })();
      const code = String(data?.code || '').trim();
      if (code !== '123456' && code !== (stored.code || '123456')) {
        return delay(400).then(() => Promise.reject(Object.assign(new Error('Geçersiz kod'), { data: { detail: 'Geçersiz kod' } })));
      }
      return delay(500).then(() => ({ message: 'Şifre başarıyla sıfırlandı' }));
    }
    // Phone auth (Evolution WhatsApp OTP)
    if (url.includes('/auth/phone/send-otp')) {
      const phone = data?.phone || '';
      try { localStorage.setItem('_mock_phone_otp', JSON.stringify({ phone, code: '123456', expires: Date.now() + 600000 })); } catch {}
      return delay(600).then(() => ({ message: 'Doğrulama kodu WhatsApp\'a gönderildi', sent: true }));
    }
    if (url.includes('/auth/phone/verify')) {
      const stored = (() => { try { return JSON.parse(localStorage.getItem('_mock_phone_otp') || '{}'); } catch { return {}; } })();
      const code = String(data?.code || '').trim();
      if (code !== '123456' && code !== (stored.code || '123456')) {
        return delay(400).then(() => Promise.reject(Object.assign(new Error('Geçersiz kod'), { data: { detail: 'Geçersiz kod' } })));
      }
      const isNew = !!(data?.username);
      const mockUser = { ..._mockUser };
      if (isNew) {
        mockUser.username     = data.username || mockUser.username;
        mockUser.display_name = data.display_name || mockUser.display_name;
        mockUser.country      = data.country || null;
        mockUser.gender       = data.gender || null;
        _saveMockUser(mockUser);
      }
      return delay(500).then(() => ({ ...MOCK_AUTH, user: mockUser, is_new_user: isNew }));
    }
    // Freeze account
    if (url.includes('/account/freeze')) {
      try { localStorage.setItem('_mock_frozen', '1'); } catch {}
      return delay(700).then(() => ({ message: 'Hesabınız donduruldu' }));
    }
    // Delete account — step 1: request code
    if (url.includes('/account/delete/request')) {
      try { localStorage.setItem('_mock_del_code', '654321'); } catch {}
      return delay(600).then(() => ({ message: 'Doğrulama kodu e-posta adresinize gönderildi', step: 1 }));
    }
    // Delete account — step 2: verify code
    if (url.includes('/account/delete/verify-code')) {
      const codeParam = url.includes('?code=') ? decodeURIComponent(url.split('?code=')[1]) : String(data?.code || '');
      const stored = (() => { try { return localStorage.getItem('_mock_del_code') || '654321'; } catch { return '654321'; } })();
      if (codeParam !== stored && codeParam !== '654321') {
        return delay(400).then(() => Promise.reject(Object.assign(new Error('Geçersiz kod'), { data: { detail: 'Geçersiz kod' } })));
      }
      return delay(400).then(() => ({ message: 'Kod doğrulandı', step: 2, code_verified: true }));
    }
    // Block user
    if (/\/social\/block\/([^/]+)$/.test(url)) {
      const uid = url.match(/\/social\/block\/([^/]+)$/)[1];
      const blocks = (() => { try { return JSON.parse(localStorage.getItem('_mock_blocked') || '[]'); } catch { return []; } })();
      if (!blocks.find(b => b.id === uid)) {
        const bu = MOCK_DISCOVER_USERS.find(u => u.id === uid) || { id: uid, username: uid, display_name: uid };
        blocks.push(bu);
        try { localStorage.setItem('_mock_blocked', JSON.stringify(blocks)); } catch {}
      }
      // Engelleme: takip ilişkisini her iki yönde kaldır
      const wasFollowing = _following.has(uid);
      if (wasFollowing) {
        _following.delete(uid);
        _saveSet('_mock_following', _following);
        // Kendi takip ettiğim kişiyi engelledim → following_count düşer
        _mockUser.following_count = Math.max(0, (_mockUser.following_count || 1) - 1);
      }
      // Engellenen kişi beni takip ediyorsa takipçilerden çıkar
      const wasFollower = !_removedFollowers.has(uid);
      if (wasFollower) {
        _removedFollowers.add(uid);
        _saveSet('_mock_removed_followers', _removedFollowers);
        // Engellenen kişi beni takip ediyordu → kendi followers_count düşer
        _mockUser.followers_count = Math.max(0, (_mockUser.followers_count || 1) - 1);
      }
      _saveMockUser(_mockUser);
      // Engellenen kullanıcının followers_count deltaını güncelle (ben onun takipçisiydim)
      if (wasFollowing) {
        const bd = _userDeltas.get(uid) || {};
        _userDeltas.set(uid, { ...bd, followers_count: (bd.followers_count || 0) - 1 });
        _saveMap('_mock_user_deltas', _userDeltas);
      }
      return delay(300).then(() => ({ message: 'Kullanıcı engellendi' }));
    }
    // Follow user: POST /social/follow/{id}
    if (/\/social\/follow\/([^/]+)$/.test(url)) {
      const uid = url.match(/\/social\/follow\/([^/]+)$/)[1];
      if (!_following.has(uid)) {
        _following.add(uid);
        _saveSet('_mock_following', _following);
        const d = _userDeltas.get(uid) || {};
        d.followers_count = (d.followers_count || 0) + 1;
        _userDeltas.set(uid, d);
        _saveMap('_mock_user_deltas', _userDeltas);
        _mockUser.following_count = (_mockUser.following_count || 0) + 1;
        _saveMockUser(_mockUser);
      }
      return delay(200).then(() => ({ message: 'Following', status: 'following' }));
    }
    // Follow request accept/reject
    if (/\/social\/follow-request\/([^/]+)\/accept/.test(url)) {
      const reqId = url.match(/\/social\/follow-request\/([^/]+)\/accept/)[1];
      const senderId = MOCK_REQUEST_MAP[reqId];
      if (senderId && !_acceptedFollowers.has(senderId)) {
        _acceptedFollowers.add(senderId);
        try { localStorage.setItem('_mock_accepted_followers', JSON.stringify([..._acceptedFollowers])); } catch {}
        _mockUser.followers_count = (_mockUser.followers_count || 0) + 1;
        _saveMockUser(_mockUser);
      }
      return delay(200).then(() => ({ status: 'accepted' }));
    }
    if (/\/social\/follow-request\/[^/]+\/reject/.test(url)) return delay(200).then(() => ({ status: 'rejected' }));
    // Notification mark-read (tek bildirim)
    if (/\/notifications\/([^/]+)\/read/.test(url)) {
      const nid = url.match(/\/notifications\/([^/]+)\/read/)[1];
      _readNotifIds.add(nid);
      try { localStorage.setItem('_mock_read_notifs', JSON.stringify([..._readNotifIds])); } catch {}
      return delay().then(() => ({}));
    }
    // Tümünü okundu işaretle
    if (url.includes('/notifications/mark-read') || url.includes('/notifications/read-all')) {
      // Silinmemiş tüm bildirimleri okundu işaretle
      ['n1','n2','n3','n4','n5','n6','n7','n8'].filter(id => !_deletedNotifIds.has(id)).forEach(id => _readNotifIds.add(id));
      try { localStorage.setItem('_mock_read_notifs', JSON.stringify([..._readNotifIds])); } catch {}
      return delay().then(() => ({}));
    }
    return delay().then(() => ({}));
  },
  put: (url, data) => {
    if (url === '/user/profile' || url.includes('/user/profile')) {
      Object.assign(_mockUser, data || {});
      _saveMockUser(_mockUser);
      return delay().then(() => ({ ..._mockUser }));
    }
    if (url === '/notifications/preferences') {
      try { localStorage.setItem('_mock_notif_prefs', JSON.stringify(data || {})); } catch {}
      return delay().then(() => ({ success: true }));
    }
    return delay().then(() => ({}));
  },
  delete: (url) => {
    // Unfollow: DELETE /social/follow/{id}
    if (/\/social\/follow\/([^/]+)$/.test(url)) {
      const uid = url.match(/\/social\/follow\/([^/]+)$/)[1];
      if (_following.has(uid)) {
        _following.delete(uid);
        _saveSet('_mock_following', _following);
        const d = _userDeltas.get(uid) || {};
        d.followers_count = (d.followers_count || 0) - 1;
        _userDeltas.set(uid, d);
        _saveMap('_mock_user_deltas', _userDeltas);
        _mockUser.following_count = Math.max(0, (_mockUser.following_count || 1) - 1);
        _saveMockUser(_mockUser);
      }
      return delay(200).then(() => ({ message: 'Unfollowed' }));
    }
    // Remove follower: DELETE /social/follower/{id}
    if (/\/social\/follower\/([^/]+)$/.test(url)) {
      const uid = url.match(/\/social\/follower\/([^/]+)$/)[1];
      _removedFollowers.add(uid);
      _saveSet('_mock_removed_followers', _removedFollowers);
      _mockUser.followers_count = Math.max(0, (_mockUser.followers_count || 1) - 1);
      _saveMockUser(_mockUser);
      return delay(200).then(() => ({ message: 'Follower removed' }));
    }
    // Unblock user: DELETE /social/unblock/{id}
    if (/\/social\/unblock\/([^/]+)$/.test(url)) {
      const uid = url.match(/\/social\/unblock\/([^/]+)$/)[1];
      const blocks = (() => { try { return JSON.parse(localStorage.getItem('_mock_blocked') || '[]'); } catch { return []; } })();
      const updated = blocks.filter(b => b.id !== uid);
      try { localStorage.setItem('_mock_blocked', JSON.stringify(updated)); } catch {}
      // Engel kaldırınca takip ilişkisi otomatik restore edilmez.
      // Kişi yeniden takip etmek isterse manuel takip etmeli veya takip isteği göndermeli.
      return delay(300).then(() => ({ message: 'Engel kaldırıldı' }));
    }
    // Delete playlist: DELETE /playlists/{id}
    if (/^\/playlists\/[^/]+$/.test(url)) {
      return delay(300).then(() => ({ message: 'Playlist silindi' }));
    }
    // Delete track from playlist: DELETE /playlists/{id}/tracks/{trackId}
    if (/^\/playlists\/[^/]+\/tracks\/[^/]+$/.test(url)) {
      return delay(200).then(() => ({ message: 'Şarkı kaldırıldı' }));
    }
    // Delete account — final: DELETE /account/delete
    if (url.includes('/account/delete')) {
      try { localStorage.removeItem('_mock_user'); localStorage.removeItem('_mockAuth'); } catch {}
      return delay(800).then(() => ({ message: 'Hesabınız kalıcı olarak silindi' }));
    }
    // Delete story: DELETE /stories/{id}
    if (/^\/stories\/[^/]+$/.test(url)) {
      const id = url.split('/stories/')[1];
      _saveStories(_getStories().filter(s => s.id !== id));
      return delay(300).then(() => ({ status: 'ok' }));
    }
    // Delete notification: DELETE /notifications/{id}
    if (/^\/notifications\/[^/]+$/.test(url)) {
      const nid = url.split('/notifications/')[1];
      _deletedNotifIds.add(nid);
      try { localStorage.setItem('_mock_deleted_notifs', JSON.stringify([..._deletedNotifIds])); } catch {}
      return delay().then(() => ({}));
    }
    return delay().then(() => ({}));
  },
  patch:  (url, data) => delay().then(() => ({})),
  request:(endpoint, opts) => delay().then(() => ({})),

  // File upload — blob URL'yi küçültülmüş JPEG data URL'e çevir (localStorage quota koruması)
  uploadFile: async (fileUri) => {
    await delay(300);
    if (typeof fileUri === 'string' && fileUri.startsWith('blob:')) {
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const img = new globalThis.Image();
          img.onload = () => {
            const MAX = 800;
            const scale = Math.min(1, MAX / Math.max(img.width || MAX, img.height || MAX));
            const canvas = document.createElement('canvas');
            canvas.width  = Math.round((img.width  || MAX) * scale);
            canvas.height = Math.round((img.height || MAX) * scale);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
          };
          img.onerror = reject;
          img.src = fileUri;
        });
        return dataUrl;
      } catch {
        return fileUri;
      }
    }
    return fileUri;
  },
};

// Named utility exports used by some screens
export const getApiUrl = (path = '') => `https://api.socialbeats.app${path}`;
export const BASE_URL  = 'https://api.socialbeats.app';

// Named + default export (both used across screens)
export { api };
export default api;
