import AsyncStorage from '@react-native-async-storage/async-storage';

export const HISTORY_KEY = '@listening_history';
export const MAX_HISTORY = 200;

export async function addToListeningHistory(track) {
    if (!track?.title) return;
    try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY);
        const history = raw ? JSON.parse(raw) : [];
        const entry = {
            trackId:   String(track.id || track.song_id || ''),
            title:     track.title || track.name || '',
            artist:    track.artist || '',
            thumbnail: track.thumbnail || track.cover_url || '',
            audio_url: track.audio_url || track.stream_url || '',
            playedAt:  new Date().toISOString(),
            source:    track.source || '',
        };
        // Deduplicate: aynı track'i listeden çıkar, başa ekle
        const deduped = history.filter(h => h.trackId !== entry.trackId);
        deduped.unshift(entry);
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(deduped.slice(0, MAX_HISTORY)));
    } catch { }
}

export async function getRecentTracks(limit = 15) {
    try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY);
        const history = raw ? JSON.parse(raw) : [];
        return history.slice(0, limit);
    } catch {
        return [];
    }
}
