/**
 * Arka plan müzik: React Native Track Player (ana) + expo-av (yedek)
 */
let useTrackPlayer = false;

export async function initPlayerBackend() {
  try {
    const TrackPlayer = require('react-native-track-player');
    await TrackPlayer.setupPlayer();
    useTrackPlayer = true;
    return 'track-player';
  } catch (e) {
    useTrackPlayer = false;
    return 'expo-av';
  }
}

export function getPlayerBackend() {
  return useTrackPlayer ? 'track-player' : 'expo-av';
}

export function isTrackPlayerAvailable() {
  return useTrackPlayer;
}
