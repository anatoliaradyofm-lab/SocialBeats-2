/**
 * React Native Track Player - arka planda çalma servisi
 * Ana çalar: Track Player. Yedek: expo-av (PlayerContext)
 */
module.exports = async function () {
  const TrackPlayer = require('react-native-track-player');

  TrackPlayer.addEventListener('remote-play', () => TrackPlayer.play());
  TrackPlayer.addEventListener('remote-pause', () => TrackPlayer.pause());
  TrackPlayer.addEventListener('remote-stop', () => TrackPlayer.reset());
  TrackPlayer.addEventListener('remote-next', () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener('remote-previous', () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener('remote-seek', (e) => TrackPlayer.seekTo(e.position));
};
