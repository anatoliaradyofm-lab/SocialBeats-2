/**
 * likedStore — module-level liked tracks store, persisted to localStorage.
 * Import isLiked / toggleLike / getLikedTracks anywhere.
 */

const KEY = 'sb_liked_tracks_v1';

// { [trackId]: track }
let _store = {};
try {
  const raw = localStorage.getItem(KEY);
  if (raw) _store = JSON.parse(raw);
} catch {}

// Listeners — components subscribe to re-render on change
const _listeners = new Set();

function _save() {
  try { localStorage.setItem(KEY, JSON.stringify(_store)); } catch {}
  _listeners.forEach(fn => fn());
}

export function isLiked(trackId) {
  return !!_store[String(trackId)];
}

export function getLikedTracks() {
  return Object.values(_store).sort((a, b) => (b.likedAt || 0) - (a.likedAt || 0));
}

export function toggleLike(track) {
  const id = String(track.id || track.song_id || '');
  if (!id) return false;
  if (_store[id]) {
    delete _store[id];
  } else {
    _store[id] = {
      id,
      title:     track.title || track.name || '',
      artist:    track.artist || '',
      thumbnail: track.thumbnail || track.cover_url || '',
      cover_url: track.thumbnail || track.cover_url || '',
      audio_url: track.audio_url || track.stream_url || '',
      duration:  track.duration || 0,
      source:    track.source || '',
      likedAt:   Date.now(),
    };
  }
  _save();
  return !!_store[id];
}

/** Subscribe to like changes — call returned fn to unsubscribe */
export function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
