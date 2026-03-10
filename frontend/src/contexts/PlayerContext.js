import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

let mmkvStorage = null;
try {
  const { MMKV } = require('react-native-mmkv');
  mmkvStorage = new MMKV({ id: 'player-settings' });
} catch {}

const getItem = (key) => {
  if (mmkvStorage) try { return mmkvStorage.getString(key) ?? null; } catch { return null; }
  return null;
};
const saveItem = (key, val) => {
  if (mmkvStorage) try { mmkvStorage.set(key, val); } catch {}
  else AsyncStorage.setItem(key, String(val)).catch(() => {});
};
import api from '../services/api';

const PlayerContext = createContext(null);

const QUALITY_BITRATE = { low: 64, normal: 128, high: 256, auto: 0 };
const CROSSFADE_MS = 3000;
const DEFAULT_EQ_VALUES = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const EQ_BANDS = ['32', '64', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'];

function normalizeTrack(track) {
  if (!track) return null;
  return {
    id: track.id || track.song_id || track._id,
    title: track.title || track.name || '',
    artist: track.artist || '',
    thumbnail: track.thumbnail || track.cover_url,
    audio_url: track.audio_url || track.preview_url,
    duration: track.duration,
    duration_ms: track.duration_ms,
    lyrics: track.lyrics,
    source: track.source || 'youtube',
    spotify_id: track.spotify_id,
    youtube_id: track.youtube_id,
    embedUrl: track.embed_url || `https://www.youtube.com/embed/${track.id || track.song_id}`,
    youtubeUrl: track.youtube_url || `https://www.youtube.com/watch?v=${track.id || track.song_id}`,
  };
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function PlayerProvider({ children }) {
  const { token } = useAuth();
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullVisible, setIsFullVisible] = useState(false);
  const [queue, setQueue] = useState([]);
  const [originalQueue, setOriginalQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [repeatMode, setRepeatMode] = useState('off');
  const [shuffleMode, setShuffleMode] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [volume, setVolumeState] = useState(1.0);
  const [audioQuality, setAudioQualityState] = useState('auto');
  const [crossfadeEnabled, setCrossfadeEnabled] = useState(false);
  const [sleepTimerEnd, setSleepTimerEnd] = useState(null);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState(0);
  const [equalizerEnabled, setEqualizerEnabled] = useState(true);
  const [equalizerValues, setEqualizerValuesState] = useState([...DEFAULT_EQ_VALUES]);
  const [equalizerPreset, setEqualizerPresetState] = useState('Düz');
  const [isBuffering, setIsBuffering] = useState(false);
  const soundRef = useRef(null);
  const nextSoundRef = useRef(null);
  const preloadedSoundRef = useRef(null);
  const sleepTimerRef = useRef(null);
  const crossfadeTimerRef = useRef(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        if (mmkvStorage) {
          const quality = getItem('@audio_quality');
          const crossfade = getItem('@crossfade');
          const vol = getItem('@volume');
          const eqEnabled = getItem('@eq_enabled');
          const eqValues = getItem('@eq_values');
          const eqPreset = getItem('@eq_preset');
          if (quality) setAudioQualityState(quality);
          if (crossfade === 'true') setCrossfadeEnabled(true);
          if (vol) setVolumeState(parseFloat(vol));
          if (eqEnabled !== null) setEqualizerEnabled(eqEnabled === 'true');
          if (eqValues) try { setEqualizerValuesState(JSON.parse(eqValues)); } catch {}
          if (eqPreset) setEqualizerPresetState(eqPreset);
        } else {
          const [quality, crossfade, vol, eqEnabled, eqValues, eqPreset] = await Promise.all([
            AsyncStorage.getItem('@audio_quality'),
            AsyncStorage.getItem('@crossfade'),
            AsyncStorage.getItem('@volume'),
            AsyncStorage.getItem('@eq_enabled'),
            AsyncStorage.getItem('@eq_values'),
            AsyncStorage.getItem('@eq_preset'),
          ]);
          if (quality) setAudioQualityState(quality);
          if (crossfade === 'true') setCrossfadeEnabled(true);
          if (vol) setVolumeState(parseFloat(vol));
          if (eqEnabled !== null) setEqualizerEnabled(eqEnabled === 'true');
          if (eqValues) setEqualizerValuesState(JSON.parse(eqValues));
          if (eqPreset) setEqualizerPresetState(eqPreset);
        }
      } catch {}
    };
    loadSettings();
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
  }, []);

  const unloadSound = useCallback(async () => {
    if (crossfadeTimerRef.current) { clearInterval(crossfadeTimerRef.current); crossfadeTimerRef.current = null; }
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
    if (nextSoundRef.current) {
      try { await nextSoundRef.current.unloadAsync(); } catch {}
      nextSoundRef.current = null;
    }
  }, []);

  const skipNext = useCallback(async () => {
    if (queue.length === 0) return;

    if (token && currentTrack?.id) {
      const listenedMs = positionMillis || 0;
      if (listenedMs > 5000) {
        api.post('/library/history/record', {
          track: currentTrack,
          listened_duration_ms: listenedMs,
        }, token).catch(() => {});
      }
    }

    let nextIdx = currentIndex + 1;
    if (repeatMode === 'one') nextIdx = currentIndex;
    else if (nextIdx >= queue.length) {
      if (repeatMode === 'all') nextIdx = 0;
      else { setIsPlaying(false); return; }
    }
    setCurrentIndex(nextIdx);
    const nextTrack = queue[nextIdx];
    if (!nextTrack) return;

    if (crossfadeEnabled && soundRef.current) {
      try {
        const oldSound = soundRef.current;
        soundRef.current = null;
        const n = normalizeTrack(nextTrack);
        setCurrentTrack(n);
        if (n?.audio_url) {
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: n.audio_url },
            { shouldPlay: true, volume: 0 },
            (status) => {
              if (!status.isLoaded) return;
              setPositionMillis(status.positionMillis || 0);
              setDurationMillis(status.durationMillis || 0);
              if (status.didJustFinish) skipNext();
            }
          );
          soundRef.current = newSound;
          let step = 0;
          const steps = CROSSFADE_MS / 50;
          crossfadeTimerRef.current = setInterval(async () => {
            step++;
            const pct = step / steps;
            try {
              await oldSound.setVolumeAsync(Math.max(0, volume * (1 - pct)));
              if (soundRef.current) await soundRef.current.setVolumeAsync(volume * pct);
            } catch {}
            if (step >= steps) {
              clearInterval(crossfadeTimerRef.current);
              crossfadeTimerRef.current = null;
              try { await oldSound.unloadAsync(); } catch {}
            }
          }, 50);
        }
        setIsPlaying(true);
      } catch {
        await playTrackInternal(nextTrack);
      }
    } else {
      await playTrackInternal(nextTrack);
    }

    if (token) {
      const n = normalizeTrack(nextTrack);
      api.post('/listening-history', { song_id: n?.id, title: n?.title, artist: n?.artist }, token).catch(() => {});
    }
  }, [queue, currentIndex, repeatMode, crossfadeEnabled, volume, token, currentTrack, positionMillis]);

  const playTrackInternal = useCallback(async (track) => {
    const normalized = normalizeTrack(track);
    if (!normalized) return;
    await unloadSound();
    setCurrentTrack(normalized);
    setIsPlaying(true);
    setPositionMillis(0);
    setDurationMillis(0);

    if (normalized.audio_url) {
      try {
        setIsBuffering(true);
        const { sound } = await Audio.Sound.createAsync(
          { uri: normalized.audio_url },
          { shouldPlay: true, volume },
          (status) => {
            if (!status.isLoaded) return;
            setPositionMillis(status.positionMillis || 0);
            setDurationMillis(status.durationMillis || 0);
            setIsBuffering(status.isBuffering || false);
            if (status.didJustFinish) {
              if (preloadedSoundRef.current && !crossfadeEnabled) {
                const preloaded = preloadedSoundRef.current;
                preloadedSoundRef.current = null;
                soundRef.current = preloaded;
                preloaded.setVolumeAsync(volume).catch(() => {});
                preloaded.playAsync().catch(() => {});
                skipNext();
              } else {
                skipNext();
              }
            }
          }
        );
        soundRef.current = sound;
        setIsBuffering(false);
      } catch (err) {
        setIsBuffering(false);
        console.error('Audio playback error:', err);
      }
    }
  }, [unloadSound, volume, skipNext]);

  const playTrack = useCallback(async (track, trackList) => {
    const normalized = normalizeTrack(track);
    if (!normalized) return;

    if (trackList) {
      const normalizedList = trackList.map(normalizeTrack).filter(Boolean);
      setOriginalQueue(normalizedList);
      if (shuffleMode) {
        const idx = normalizedList.findIndex(t => t.id === normalized.id);
        const shuffled = shuffleArray(normalizedList.filter((_, i) => i !== idx));
        const newQueue = [normalized, ...shuffled];
        setQueue(newQueue);
        setCurrentIndex(0);
      } else {
        setQueue(normalizedList);
        const idx = normalizedList.findIndex(t => t.id === normalized.id);
        setCurrentIndex(idx >= 0 ? idx : 0);
      }
    }

    if (token && currentTrack?.id) {
      const listenedMs = positionMillis || 0;
      if (listenedMs > 5000) {
        api.post('/library/history/record', {
          track: currentTrack,
          listened_duration_ms: listenedMs,
        }, token).catch(() => {});
      }
    }

    await playTrackInternal(track);

    if (token) {
      api.post('/listening-history', { song_id: normalized.id, title: normalized.title, artist: normalized.artist }, token).catch(() => {});
    }
  }, [token, shuffleMode, playTrackInternal, currentTrack, positionMillis]);

  const togglePlay = useCallback(async () => {
    if (!soundRef.current) return;
    try {
      if (isPlaying) await soundRef.current.pauseAsync();
      else await soundRef.current.playAsync();
      setIsPlaying(!isPlaying);
    } catch {}
  }, [isPlaying]);

  const skipPrev = useCallback(async () => {
    if (queue.length === 0) return;
    if (positionMillis > 3000) {
      await seekTo(0);
      return;
    }
    const prevIdx = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;
    setCurrentIndex(prevIdx);
    await playTrackInternal(queue[prevIdx]);
  }, [queue, currentIndex, positionMillis, playTrackInternal]);

  const seekTo = useCallback(async (millis) => {
    if (soundRef.current) {
      try { await soundRef.current.setPositionAsync(millis); } catch {}
    }
  }, []);

  const setVolume = useCallback(async (v) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    saveItem('@volume', String(clamped));
    if (soundRef.current) {
      try { await soundRef.current.setVolumeAsync(clamped); } catch {}
    }
  }, []);

  const toggleShuffle = useCallback(() => {
    if (!shuffleMode) {
      const current = queue[currentIndex];
      const others = queue.filter((_, i) => i !== currentIndex);
      const shuffled = shuffleArray(others);
      setQueue([current, ...shuffled]);
      setCurrentIndex(0);
    } else {
      const current = queue[currentIndex];
      setQueue(originalQueue);
      const idx = originalQueue.findIndex(t => t.id === current?.id);
      setCurrentIndex(idx >= 0 ? idx : 0);
    }
    setShuffleMode(!shuffleMode);
  }, [shuffleMode, queue, currentIndex, originalQueue]);

  const cycleRepeatMode = useCallback(() => {
    const modes = ['off', 'all', 'one'];
    const idx = modes.indexOf(repeatMode);
    setRepeatMode(modes[(idx + 1) % modes.length]);
  }, [repeatMode]);

  const setSleepTimer = useCallback((minutes) => {
    if (sleepTimerRef.current) { clearTimeout(sleepTimerRef.current); sleepTimerRef.current = null; }
    if (minutes <= 0) { setSleepTimerEnd(null); setSleepTimerMinutes(0); return; }
    setSleepTimerMinutes(minutes);
    const endTime = Date.now() + minutes * 60 * 1000;
    setSleepTimerEnd(endTime);
    sleepTimerRef.current = setTimeout(async () => {
      if (soundRef.current) {
        let vol = volume;
        const fadeInterval = setInterval(async () => {
          vol -= 0.05;
          if (vol <= 0) {
            clearInterval(fadeInterval);
            await stopPlayer();
            setSleepTimerEnd(null);
            setSleepTimerMinutes(0);
          } else {
            try { if (soundRef.current) await soundRef.current.setVolumeAsync(vol); } catch {}
          }
        }, 100);
      }
    }, minutes * 60 * 1000);
  }, [volume]);

  const cancelSleepTimer = useCallback(() => {
    if (sleepTimerRef.current) { clearTimeout(sleepTimerRef.current); sleepTimerRef.current = null; }
    setSleepTimerEnd(null);
    setSleepTimerMinutes(0);
  }, []);

  const setAudioQuality = useCallback((q) => {
    setAudioQualityState(q);
    saveItem('@audio_quality', q);
  }, []);

  const toggleCrossfade = useCallback(() => {
    const next = !crossfadeEnabled;
    setCrossfadeEnabled(next);
    saveItem('@crossfade', String(next));
  }, [crossfadeEnabled]);

  const preloadNext = useCallback(async () => {
    if (queue.length === 0 || crossfadeEnabled) return;
    let nextIdx = currentIndex + 1;
    if (nextIdx >= queue.length) {
      if (repeatMode === 'all') nextIdx = 0;
      else return;
    }
    const nextTrack = normalizeTrack(queue[nextIdx]);
    if (!nextTrack?.audio_url) return;
    if (preloadedSoundRef.current) {
      try { await preloadedSoundRef.current.unloadAsync(); } catch {}
      preloadedSoundRef.current = null;
    }
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: nextTrack.audio_url },
        { shouldPlay: false, volume: 0 }
      );
      preloadedSoundRef.current = sound;
    } catch {}
  }, [queue, currentIndex, repeatMode, crossfadeEnabled]);

  useEffect(() => {
    if (durationMillis > 0 && positionMillis > 0) {
      const remaining = durationMillis - positionMillis;
      if (remaining < 10000 && remaining > 9000) {
        preloadNext();
      }
    }
  }, [positionMillis, durationMillis, preloadNext]);

  const addToQueue = useCallback((track) => {
    const n = normalizeTrack(track);
    if (n) setQueue(prev => [...prev, n]);
  }, []);

  const removeFromQueue = useCallback((index) => {
    setQueue(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (index < currentIndex) setCurrentIndex(ci => ci - 1);
      else if (index === currentIndex && next.length > 0) {
        const newIdx = Math.min(currentIndex, next.length - 1);
        setCurrentIndex(newIdx);
        playTrackInternal(next[newIdx]);
      }
      return next;
    });
  }, [currentIndex, playTrackInternal]);

  const moveInQueue = useCallback((from, to) => {
    setQueue(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      if (from === currentIndex) setCurrentIndex(to);
      else if (from < currentIndex && to >= currentIndex) setCurrentIndex(ci => ci - 1);
      else if (from > currentIndex && to <= currentIndex) setCurrentIndex(ci => ci + 1);
      return next;
    });
  }, [currentIndex]);

  const clearQueue = useCallback(() => {
    const current = queue[currentIndex];
    if (current) {
      setQueue([current]);
      setCurrentIndex(0);
    } else {
      setQueue([]);
      setCurrentIndex(0);
    }
  }, [queue, currentIndex]);

  const playQueueItem = useCallback(async (index) => {
    if (index >= 0 && index < queue.length) {
      setCurrentIndex(index);
      await playTrackInternal(queue[index]);
    }
  }, [queue, playTrackInternal]);

  const stopPlayer = useCallback(async () => {
    await unloadSound();
    if (preloadedSoundRef.current) {
      try { await preloadedSoundRef.current.unloadAsync(); } catch {}
      preloadedSoundRef.current = null;
    }
    setCurrentTrack(null);
    setIsPlaying(false);
    setPositionMillis(0);
    setDurationMillis(0);
    cancelSleepTimer();
  }, [unloadSound, cancelSleepTimer]);

  const setEqualizerValues = useCallback((values) => {
    setEqualizerValuesState(values);
    saveItem('@eq_values', JSON.stringify(values));
  }, []);

  const setEqualizerPreset = useCallback((preset) => {
    setEqualizerPresetState(preset);
    saveItem('@eq_preset', preset);
  }, []);

  const toggleEqualizer = useCallback(() => {
    const next = !equalizerEnabled;
    setEqualizerEnabled(next);
    saveItem('@eq_enabled', String(next));
  }, [equalizerEnabled]);

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      if (crossfadeTimerRef.current) clearInterval(crossfadeTimerRef.current);
    };
  }, []);

  return (
    <PlayerContext.Provider value={{
      currentTrack, isPlaying, isFullVisible, queue, currentIndex,
      repeatMode, shuffleMode, positionMillis, durationMillis,
      volume, audioQuality, crossfadeEnabled, sleepTimerEnd, sleepTimerMinutes,
      equalizerEnabled, equalizerValues, equalizerPreset, isBuffering,
      playTrack, togglePlay, skipNext, skipPrev, seekTo, stopPlayer,
      setIsFullVisible, setRepeatMode, cycleRepeatMode, setQueue,
      toggleShuffle, setVolume, setAudioQuality, toggleCrossfade,
      setSleepTimer, cancelSleepTimer,
      addToQueue, removeFromQueue, moveInQueue, clearQueue, playQueueItem,
      setEqualizerValues, setEqualizerPreset, toggleEqualizer,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}
