// audioService mock for web preview
export const play  = () => Promise.resolve();
export const pause = () => Promise.resolve();
export const stop  = () => Promise.resolve();
export const seekTo = () => Promise.resolve();
export const setVolume = () => Promise.resolve();
export const setRate   = () => Promise.resolve();
export const getStatus = () => Promise.resolve({ isPlaying: false, positionMillis: 0, durationMillis: 0 });
export const loadTrack = () => Promise.resolve();
export const unload    = () => Promise.resolve();
export const onStatusUpdate = () => () => {};
export const onPlaybackEvent = () => () => {};
export const setupPlayer   = () => Promise.resolve();
export const addTrack       = () => Promise.resolve();
export const skipToNext     = () => Promise.resolve();
export const skipToPrevious = () => Promise.resolve();
export const reset          = () => Promise.resolve();
export const getQueue       = () => Promise.resolve([]);
export const getCurrentTrack = () => Promise.resolve(null);
export const getState = () => Promise.resolve('stopped');

// Named namespace (import * as audioService)
export default {
  play, pause, stop, seekTo, setVolume, setRate, getStatus,
  loadTrack, unload, onStatusUpdate, onPlaybackEvent, setupPlayer,
  addTrack, skipToNext, skipToPrevious, reset, getQueue, getCurrentTrack, getState,
};
