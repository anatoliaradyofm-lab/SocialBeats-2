/**
 * Audio service - react-native-track-player for background audio playback
 * Replaces expo-av as requested for better background and hardware integration.
 */
import { TrackPlayer, State, Capability } from '../lib/trackPlayer';

let configDone = false;
let statusCallback = null;

async function ensureAudioConfig() {
  if (configDone) return;
  try {
    await TrackPlayer.setupPlayer();
    await TrackPlayer.updateOptions({
      stopWithApp: false,
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.Stop,
      ],
      compactCapabilities: [Capability.Play, Capability.Pause],
    });
    configDone = true;
  } catch (e) {
    if (!e.message.includes('The player has already been initialized')) {
      console.warn('Audio config error:', e);
    } else {
      configDone = true;
    }
  }
}

export function setOnPlaybackStatusUpdate(callback) {
  statusCallback = callback;
  // TrackPlayer relies on event listeners (useTrackPlayerEvents) in React components,
  // but for legacy compatibility we just set the callback here if needed by older components.
}

export async function loadAndPlay(audioUrl, title = 'Track', artist = 'Unknown') {
  if (!audioUrl) return false;
  await ensureAudioConfig();
  try {
    await TrackPlayer.reset();
    await TrackPlayer.add({
      id: audioUrl,
      url: audioUrl,
      title: title,
      artist: artist,
    });
    await TrackPlayer.play();
    return true;
  } catch (e) {
    console.warn('Audio play error:', e);
    return false;
  }
}

export async function pause() {
  try {
    await TrackPlayer.pause();
    return true;
  } catch {
    return false;
  }
}

export async function play() {
  try {
    await TrackPlayer.play();
    return true;
  } catch {
    return false;
  }
}

export async function stop() {
  try {
    await TrackPlayer.stop();
    return true;
  } catch {
    return false;
  }
}

export async function seekTo(positionMillis) {
  try {
    await TrackPlayer.seekTo(positionMillis / 1000);
    return true;
  } catch {
    return false;
  }
}

export async function setVolume(vol) {
  try {
    await TrackPlayer.setVolume(vol);
    return true;
  } catch {
    return false;
  }
}

export async function setRate(rate) {
  try {
    await TrackPlayer.setRate(rate);
    return true;
  } catch {
    return false;
  }
}

export async function getStatus() {
  try {
    const state = await TrackPlayer.getState();
    const position = await TrackPlayer.getPosition();
    const duration = await TrackPlayer.getDuration();

    return {
      isPlaying: state === State.Playing,
      positionMillis: position * 1000,
      durationMillis: duration * 1000,
      isLoaded: state !== State.None,
    };
  } catch {
    return null;
  }
}
