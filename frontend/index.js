import { registerRootComponent } from 'expo';
import App from './App';

try {
  const TrackPlayer = require('react-native-track-player').default;
  TrackPlayer.registerPlaybackService(() => require('./src/services/trackPlayerService'));
} catch (_) {
  // Track Player yoksa expo-av kullanılır (PlayerContext)
}

registerRootComponent(App);
