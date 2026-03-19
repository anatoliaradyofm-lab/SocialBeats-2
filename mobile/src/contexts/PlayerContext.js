import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import * as audioService from '../services/audioService';
import { addToListeningHistory } from '../services/historyService';
import { getCachedData, cacheData, isOnline } from '../services/offlineService';
import { useAuth } from './AuthContext';
import api from '../services/api';

const PlayerContext = createContext(null);

const MUSIC_API_BASE = process.env.EXPO_PUBLIC_MUSIC_API_URL || 'https://music-backend-45365938370.europe-west3.run.app';

function normalizeTrack(track) {
  if (!track) return null;
  return {
    id: track.id || track.song_id,
    title: track.title || track.name,
    artist: track.artist || '',
    thumbnail: track.thumbnail || track.cover_url,
    // audio_url may be a relative path (/music-hybrid/stream/{id}) — resolved at play time
    audio_url: track.audio_url || track.stream_url || null,
    embedUrl: track.embed_url || `https://www.youtube.com/embed/${track.id || track.song_id}`,
    youtubeUrl: track.youtube_url || `https://www.youtube.com/watch?v=${track.id || track.song_id}`,
    source: track.source || null,
  };
}

/**
 * If audio_url is a relative /music-hybrid/stream/{id} path,
 * call the music backend to get the actual CDN URL.
 */
async function resolveAudioUrl(audioUrl) {
  if (!audioUrl) return null;
  // Already absolute — use directly
  if (audioUrl.startsWith('https://') || audioUrl.startsWith('http://')) return audioUrl;
  // Relative backend path — resolve to CDN URL
  if (audioUrl.startsWith('/music-hybrid/stream/') || audioUrl.startsWith('/stream/')) {
    try {
      const res = await fetch(`${MUSIC_API_BASE}${audioUrl}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.url || null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

export function PlayerProvider({ children }) {
  const { token } = useAuth();
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isFullVisible, setIsFullVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState(null);
  const sleepTimerRef = useRef(null);
  const hasAudioUrl = useRef(false);

  // Queue state
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Repeat mode: 'off' | 'all' | 'one'
  const [repeatMode, setRepeatMode] = useState('off');

  // Shuffle state
  const [isShuffle, setIsShuffle] = useState(false);

  // Playback speed
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // Crossfade (0=off, 2, 5, 8, 12 seconds)
  const [crossfadeDuration, setCrossfadeDuration] = useState(0);
  const crossfadeTriggeredRef = useRef(false);

  // Progress state
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);

  const advanceToNext = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex((prev) => {
      if (repeatMode === 'one') {
        setTimeout(() => playTrackInternal(queue[prev], false), 100);
        return prev;
      }
      const nextIdx = prev + 1;
      if (nextIdx < queue.length) {
        const nextTrack = queue[nextIdx];
        setTimeout(() => playTrackInternal(nextTrack, false), 100);
        return nextIdx;
      }
      if (repeatMode === 'all' && queue.length > 0) {
        const firstTrack = queue[0];
        setTimeout(() => playTrackInternal(firstTrack, false), 100);
        return 0;
      }
      return prev;
    });
  }, [queue, repeatMode]);

  const onPlaybackStatusUpdate = useCallback((status) => {
    if (!status?.isLoaded) return;
    setPositionMillis(status.positionMillis || 0);
    setDurationMillis(status.durationMillis || 0);

    const remaining = (status.durationMillis || 0) - (status.positionMillis || 0);
    if (
      crossfadeDuration > 0 &&
      status.durationMillis > 0 &&
      remaining <= crossfadeDuration * 1000 &&
      remaining > 0 &&
      !crossfadeTriggeredRef.current
    ) {
      crossfadeTriggeredRef.current = true;
      advanceToNext();
      return;
    }

    if (status.didJustFinish) {
      advanceToNext();
    }
  }, [queue, repeatMode, crossfadeDuration, advanceToNext]);

  useEffect(() => {
    audioService.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
  }, [onPlaybackStatusUpdate]);

  // Poll position/duration every second since TrackPlayer uses event-based
  // listeners (not the legacy callback pattern)
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(async () => {
      const status = await audioService.getStatus();
      if (!status?.isLoaded) return;
      setPositionMillis(status.positionMillis || 0);
      setDurationMillis(status.durationMillis || 0);
      if (status.positionMillis > 0 && status.durationMillis > 0) {
        const remaining = status.durationMillis - status.positionMillis;
        if (
          crossfadeDuration > 0 &&
          remaining <= crossfadeDuration * 1000 &&
          remaining > 0 &&
          !crossfadeTriggeredRef.current
        ) {
          crossfadeTriggeredRef.current = true;
          advanceToNext();
        } else if (remaining <= 500) {
          advanceToNext();
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, crossfadeDuration, advanceToNext]);

  const playTrackInternal = async (track, showFull = true) => {
    if (!track) return;
    const normalized = normalizeTrack(track);
    setCurrentTrack(normalized);
    setIsPlaying(true);
    setPositionMillis(0);
    setDurationMillis(0);
    if (showFull) setIsFullVisible(true);

    // Check offline cache first
    let audioUrl = null;
    if (!isOnline()) {
      audioUrl = await getCachedData(`track:audio:${normalized.id}`);
    }

    if (!audioUrl) {
      // Resolve relative /music-hybrid/stream/{id} → CDN URL
      audioUrl = await resolveAudioUrl(normalized.audio_url);
    }

    if (audioUrl) {
      hasAudioUrl.current = true;
      // Cache the resolved CDN URL for offline use
      cacheData(`track:audio:${normalized.id}`, audioUrl).catch(() => { });
      await audioService.loadAndPlay(audioUrl);
      await audioService.setRate(playbackSpeed);
    } else {
      hasAudioUrl.current = false;
    }
    crossfadeTriggeredRef.current = false;
  };

  const cycleSpeed = () => {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const idx = speeds.indexOf(playbackSpeed);
    setPlaybackSpeed(speeds[(idx + 1) % speeds.length]);
  };

  useEffect(() => {
    if (hasAudioUrl.current) {
      audioService.setRate(playbackSpeed);
    }
  }, [playbackSpeed]);

  const playTrack = async (track, trackList = null) => {
    if (!track) return;
    const normalized = normalizeTrack(track);

    if (trackList && trackList.length > 0) {
      const normalizedList = trackList.map(normalizeTrack).filter(Boolean);
      setQueue(normalizedList);
      const idx = normalizedList.findIndex((t) => t.id === normalized.id);
      setCurrentIndex(idx >= 0 ? idx : 0);
    } else if (queue.length === 0) {
      setQueue([normalized]);
      setCurrentIndex(0);
    }

    await playTrackInternal(track, true);
    addToListeningHistory(normalized).catch(() => { });
  };

  const togglePlay = async () => {
    if (!currentTrack) return;
    if (hasAudioUrl.current) {
      const status = await audioService.getStatus();
      if (status?.isLoaded) {
        if (status.isPlaying) {
          await audioService.pause();
          setIsPlaying(false);
        } else {
          await audioService.play();
          setIsPlaying(true);
        }
      }
    } else {
      setIsPlaying((p) => !p);
    }
  };

  const closePlayer = async () => {
    if (hasAudioUrl.current) await audioService.stop();
    setIsFullVisible(false);
  };

  const setVolume = async (v) => {
    const val = Math.max(0, Math.min(1, v));
    setVolumeState(val);
    await audioService.setVolume(val);
  };

  const seekTo = async (millis) => {
    const clamped = Math.max(0, Math.min(millis, durationMillis));
    setPositionMillis(clamped);
    if (hasAudioUrl.current) {
      await audioService.seekTo(clamped);
    }
  };

  // --- Queue management ---

  const addToQueue = (track) => {
    const normalized = normalizeTrack(track);
    if (!normalized) return;
    setQueue((prev) => [...prev, normalized]);
  };

  const removeFromQueue = (index) => {
    setQueue((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
    setCurrentIndex((prev) => {
      if (index < prev) return prev - 1;
      return prev;
    });
  };

  const clearQueue = () => {
    setQueue([]);
    setCurrentIndex(0);
  };

  const playNext = async () => {
    if (currentIndex + 1 >= queue.length) return;
    const nextIdx = currentIndex + 1;
    setCurrentIndex(nextIdx);
    await playTrackInternal(queue[nextIdx], false);
  };

  const playPrevious = async () => {
    if (currentIndex <= 0) return;
    const prevIdx = currentIndex - 1;
    setCurrentIndex(prevIdx);
    await playTrackInternal(queue[prevIdx], false);
  };

  const shuffleQueue = () => {
    setQueue((prev) => {
      if (prev.length <= 1) return prev;
      const current = prev[currentIndex];
      const rest = prev.filter((_, i) => i !== currentIndex);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      return [current, ...rest];
    });
    setCurrentIndex(0);
  };

  const toggleShuffle = () => {
    setIsShuffle((prev) => {
      if (!prev) shuffleQueue();
      return !prev;
    });
  };

  const toggleRepeat = () => {
    setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'));
  };

  const canPlayNext = currentIndex + 1 < queue.length;
  const canPlayPrevious = currentIndex > 0;

  const startSleepTimer = (minutes) => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    setSleepTimerMinutes(minutes);
    sleepTimerRef.current = setTimeout(() => {
      setIsPlaying(false);
      if (hasAudioUrl.current) audioService.pause();
      setSleepTimerMinutes(null);
    }, minutes * 60 * 1000);
  };

  const cancelSleepTimer = () => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    sleepTimerRef.current = null;
    setSleepTimerMinutes(null);
  };

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      audioService.stop();
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    if (currentTrack && isPlaying) {
      const trackInfo = {
        id: currentTrack.id,
        title: currentTrack.title,
        artist: currentTrack.artist,
        thumbnail: currentTrack.thumbnail,
      };
      api.post('/users/me/now-playing', { track: trackInfo }, token).catch(() => { });
    } else {
      api.post('/users/me/now-playing', { track: null }, token).catch(() => { });
    }
  }, [currentTrack?.id, isPlaying, token]);

  const hideFullPlayer = () => setIsFullVisible(false);

  return (
    <PlayerContext.Provider value={{
      currentTrack,
      isPlaying,
      playTrack,
      togglePlay,
      closePlayer,
      isFullVisible,
      hideFullPlayer,
      volume,
      setVolume,
      sleepTimerMinutes,
      startSleepTimer,
      cancelSleepTimer,
      // Queue
      queue,
      currentIndex,
      addToQueue,
      removeFromQueue,
      clearQueue,
      playNext,
      playPrevious,
      shuffleQueue,
      isShuffle,
      toggleShuffle,
      repeatMode,
      toggleRepeat,
      canPlayNext,
      canPlayPrevious,
      // Progress
      positionMillis,
      durationMillis,
      seekTo,
      // Speed
      playbackSpeed,
      cycleSpeed,
      // Crossfade
      crossfadeDuration,
      setCrossfadeDuration,
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
