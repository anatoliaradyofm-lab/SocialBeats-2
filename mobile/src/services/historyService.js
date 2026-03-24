import AsyncStorage from '@react-native-async-storage/async-storage';

export const HISTORY_KEY = '@listening_history';
export const MAX_HISTORY = 200;

export async function addToListeningHistory(track) {
    if (!track?.title) return;
    try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY);
        const history = raw ? JSON.parse(raw) : [];
        const entry = {
            trackId: track.id || track.song_id || '',
            title: track.title || track.name || '',
            artist: track.artist || '',
            thumbnail: track.thumbnail || track.cover_url || '',
            playedAt: new Date().toISOString(),
            source: track.source || '',
        };
        history.unshift(entry);
        const trimmed = history.slice(0, MAX_HISTORY);
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    } catch { }
}
