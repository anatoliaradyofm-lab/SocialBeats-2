import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { addToListeningHistory } from '../../../mobile/src/services/historyService';

const MUSIC_BACKEND = '/music-api';

const Ctx = createContext(null);

export function PlayerProvider({ children }) {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [progress, setProgress]         = useState(0);
  const [duration, setDuration]         = useState(0);
  const [queue, setQueueState]          = useState([]);
  const [queueIdx, setQueueIdx]         = useState(0);
  const [volume, setVolumeState]        = useState(1);
  const [repeatMode, setRepeatMode]     = useState('off');
  const [shuffleMode, setShuffleMode]   = useState(false);
  const [loading, setLoading]           = useState(false);

  const audioRef = useRef(null);

  // Ensure single Audio instance
  const getAudio = () => {
    if (!audioRef.current) {
      const a = new Audio();
      a.addEventListener('timeupdate',    () => setProgress(a.currentTime));
      a.addEventListener('loadedmetadata',() => setDuration(a.duration || 0));
      a.addEventListener('ended',         () => { setIsPlaying(false); setProgress(0); });
      a.addEventListener('play',          () => setIsPlaying(true));
      a.addEventListener('pause',         () => setIsPlaying(false));
      a.addEventListener('error',         (e) => {
        console.error('[Player] Audio error', e, a.error);
        setIsPlaying(false);
        setLoading(false);
      });
      audioRef.current = a;
    }
    return audioRef.current;
  };

  // Resolve actual stream URL.
  // /sc-stream-v2/media/... (SC transcoding via proxy) → fetch JSON → { url: "https://cf-media.sndcdn.com/..." } → audio.src
  // https://cf-* CDN URLs → use directly
  // /music-api/... backend URLs → fetch JSON → extract .url
  const resolveStreamUrl = useCallback(async (track) => {
    const raw = track.audio_url || track.stream_url || track.preview_url || null;
    if (!raw) return null;

    // Already a direct CDN audio URL
    if (raw.startsWith('https://cf-')) {
      return raw;
    }

    // SoundCloud transcoding URL or backend URL — fetch to get actual CDN URL
    if (raw.startsWith('/sc-api') || raw.startsWith('/sc-stream-v2') || raw.startsWith('/music-api')) {
      try {
        const res = await fetch(raw);
        if (!res.ok) { console.error('[Player] stream fetch', res.status, raw.slice(0, 80)); return null; }
        const json = await res.json();
        const cdnUrl = json.url || null;
        console.log('[Player] CDN:', cdnUrl?.slice(0, 80));
        return cdnUrl;
      } catch (e) {
        console.error('[Player] resolveStreamUrl error', e);
        return null;
      }
    }

    // Any https URL — use directly
    if (raw.startsWith('https://')) return raw;
    return null;
  }, []);

  const playTrack = useCallback(async (track) => {
    if (!track) return;
    setLoading(true);
    // If track not in current queue, set a single-item queue so prev/next work
    const key = String(track.id || track.song_id || '');
    setQueueState(q => {
      const idx = q.findIndex(t => String(t.id || t.song_id) === key);
      if (idx < 0) { setQueueIdx(0); return [track]; }
      setQueueIdx(idx);
      return q;
    });
    // Show mini player immediately (optimistic)
    setCurrentTrack(track);
    setProgress(0);
    try {
      const url = await resolveStreamUrl(track);
      if (!url) { console.error('[Player] No stream URL for', track.title); setLoading(false); return; }
      console.log('[Player] Playing:', track.title, '→', url);
      addToListeningHistory(track);
      const audio = getAudio();
      audio.pause();
      audio.src = url;
      audio.volume = volume;
      audio.load();
      const p = audio.play();
      if (p) p.catch(e => {
        // Retry without crossOrigin if blocked
        if (e.name === 'NotSupportedError' || e.name === 'NotAllowedError') {
          audio.src = url;
          audio.load();
          audio.play().catch(e2 => console.error('[Player] play failed', e2));
        } else {
          console.error('[Player] play error', e);
        }
      });
    } catch (e) {
      console.error('[Player] playTrack error', e);
    } finally {
      setLoading(false);
    }
  }, [resolveStreamUrl, volume]);

  const play = useCallback(async () => {
    const audio = getAudio();
    if (audio.src) {
      try { await audio.play(); } catch {}
    }
  }, []);

  const pause = useCallback(() => {
    getAudio().pause();
  }, []);

  const seekTo = useCallback((secs) => {
    const audio = getAudio();
    audio.currentTime = secs;
    setProgress(secs);
  }, []);

  const setVolume = useCallback((v) => {
    setVolumeState(v);
    getAudio().volume = v;
  }, []);

  const setQueue = useCallback((tracks, startIdx = 0) => {
    setQueueState(tracks);
    setQueueIdx(startIdx);
    if (tracks[startIdx]) playTrack(tracks[startIdx]);
  }, [playTrack]);

  const addToQueue = useCallback((track) => {
    setQueueState(prev => [...prev, track]);
  }, []);

  const skip = useCallback(() => {
    const next = (queueIdx + 1) % (queue.length || 1);
    setQueueIdx(next);
    if (queue[next]) playTrack(queue[next]);
  }, [queueIdx, queue, playTrack]);

  const prev = useCallback(() => {
    const p = (queueIdx - 1 + (queue.length || 1)) % (queue.length || 1);
    setQueueIdx(p);
    if (queue[p]) playTrack(queue[p]);
  }, [queueIdx, queue, playTrack]);

  const toggleRepeat  = useCallback(() => setRepeatMode(m => m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'), []);
  const toggleShuffle = useCallback(() => setShuffleMode(s => !s), []);

  const value = {
    currentTrack, isPlaying, progress, duration,
    queue, addToQueue, setQueue,
    volume, setVolume,
    repeatMode, shuffleMode,
    toggleRepeat, toggleShuffle,
    loading,
    playTrack, play, pause, skip, prev, seekTo,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePlayer = () => useContext(Ctx);
export default Ctx;
