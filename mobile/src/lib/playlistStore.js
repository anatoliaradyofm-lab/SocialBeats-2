/**
 * playlistStore — shared module-level store for playlists and their tracks.
 * Breaks the circular dependency between PlaylistsScreen ↔ PlaylistDetailScreen.
 * Persisted to localStorage.
 */

// ─── Playlist list cache (PlaylistsScreen) ────────────────────────────────────
const _PL_KEY = 'sb_playlists_v1';

function _loadPl() {
  try { const r = localStorage.getItem(_PL_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function _savePl(data) {
  try { localStorage.setItem(_PL_KEY, JSON.stringify(data)); } catch {}
}

let _plCache = _loadPl();

export function getPlaylistsCache() {
  return _plCache || [];
}

export function setPlaylistsCache(data) {
  _plCache = data;
  _savePl(data);
}

export function removePlaylistFromCache(playlistId) {
  _plCache = (_plCache || []).filter(p => String(p.id) !== String(playlistId));
  _savePl(_plCache);
}

// ─── Track store (PlaylistDetailScreen) ──────────────────────────────────────
const _TS_KEY = 'sb_trackstore_v1';

// { [playlistId]: Track[] }
const _trackStore = {};
const _pending = {};

(function _init() {
  try {
    const r = localStorage.getItem(_TS_KEY);
    if (r) Object.assign(_trackStore, JSON.parse(r));
  } catch {}
})();

function _saveTS() {
  try { localStorage.setItem(_TS_KEY, JSON.stringify(_trackStore)); } catch {}
}

export function getStoredTracks(playlistId) {
  return _trackStore[playlistId] || [];
}

export function getStoredTrackCount(playlistId) {
  return _trackStore[playlistId]?.length ?? null;
}

export function enqueuePendingTrack(playlistId, track) {
  if (!playlistId || !track) return;
  const key = String(track.id || track.song_id);

  if (!_pending[playlistId]) _pending[playlistId] = [];
  if (!_pending[playlistId].some(t => String(t.id || t.song_id) === key))
    _pending[playlistId].push(track);

  if (!_trackStore[playlistId]) _trackStore[playlistId] = [];
  if (!_trackStore[playlistId].some(t => String(t.id || t.song_id) === key)) {
    _trackStore[playlistId].push(track);
    _saveTS();
  }
}

export function flushPendingTracks(playlistId) {
  const pending = _pending[playlistId] || [];
  if (pending.length) delete _pending[playlistId];
  return pending;
}

export function removeStoredTrack(playlistId, trackId) {
  if (_trackStore[playlistId]) {
    _trackStore[playlistId] = _trackStore[playlistId].filter(
      t => String(t.id || t.song_id) !== String(trackId)
    );
    _saveTS();
  }
}
