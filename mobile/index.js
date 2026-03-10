if (typeof window !== 'undefined') {
    window.onerror = function (msg, url, lineNo, columnNo, error) {
        console.warn("GLOBAL ERROR:", msg, error);
        return false;
    };
    window.addEventListener('unhandledrejection', function (event) {
        console.warn("UNHANDLED PROMISE REJECTION:", event.reason);
    });
}

import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

import App from './App';

registerRootComponent(App);

import { TrackPlayer } from './src/lib/trackPlayer';
if (Platform.OS !== 'web') {
    TrackPlayer.registerPlaybackService(() => require('./service'));
}
