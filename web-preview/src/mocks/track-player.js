// react-native-track-player — mock
const TrackPlayer = {
  setupPlayer:     () => Promise.resolve(),
  add:             () => Promise.resolve(),
  play:            () => Promise.resolve(),
  pause:           () => Promise.resolve(),
  stop:            () => Promise.resolve(),
  skipToNext:      () => Promise.resolve(),
  skipToPrevious:  () => Promise.resolve(),
  seekTo:          () => Promise.resolve(),
  setVolume:       () => Promise.resolve(),
  setRate:         () => Promise.resolve(),
  reset:           () => Promise.resolve(),
  getPosition:     () => Promise.resolve(0),
  getDuration:     () => Promise.resolve(0),
  getState:        () => Promise.resolve('stopped'),
  getQueue:        () => Promise.resolve([]),
  getCurrentTrack: () => Promise.resolve(null),
  updateOptions:   () => Promise.resolve(),
  destroy:         () => Promise.resolve(),
};
export default TrackPlayer;
export const useProgress     = () => ({ position: 0, duration: 0, buffered: 0 });
export const usePlaybackState= () => ({ state: 'stopped' });
export const useActiveTrack  = () => null;
export const Event           = {};
export const State           = { Playing:'playing', Paused:'paused', Stopped:'stopped', Buffering:'buffering' };
export const Capability      = { Play:0, Pause:1, Stop:2, SeekTo:3, SkipToNext:4, SkipToPrevious:5 };
export const RepeatMode      = { Off:0, Track:1, Queue:2 };
