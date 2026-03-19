// historyService mock — persists to localStorage (AsyncStorage bridge)
const HISTORY_KEY = '@listening_history';
const MAX_HISTORY = 100;

function _load() {
  try { const r = localStorage.getItem(HISTORY_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function _save(data) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(data)); } catch {}
}

export { HISTORY_KEY, MAX_HISTORY };

export function addToListeningHistory(track) {
  if (!track?.title) return Promise.resolve();
  try {
    const history = _load();
    const entry = {
      trackId:   String(track.id || track.song_id || ''),
      title:     track.title || track.name || '',
      artist:    track.artist || '',
      thumbnail: track.thumbnail || track.cover_url || '',
      audio_url: track.audio_url || track.stream_url || '',
      playedAt:  new Date().toISOString(),
      source:    track.source || 'soundcloud',
    };
    // Deduplicate: remove previous entry for same track, push to top
    const deduped = history.filter(h => h.trackId !== entry.trackId);
    deduped.unshift(entry);
    _save(deduped.slice(0, MAX_HISTORY));
  } catch {}
  return Promise.resolve();
}

export function getListeningHistory() {
  return Promise.resolve(_load());
}

export function getRecentTracks(limit = 15) {
  return Promise.resolve(_load().slice(0, limit));
}

export function clearHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
  return Promise.resolve();
}

export function getListeningStats() {
  const h = _load();
  return Promise.resolve({ totalTracks: h.length, totalMinutes: h.length * 3, topArtists: [], topGenres: [] });
}
