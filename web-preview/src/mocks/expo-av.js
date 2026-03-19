// expo-av mock for web preview
export const Audio = {
  setAudioModeAsync: () => Promise.resolve(),
  requestPermissionsAsync: () => Promise.resolve({ granted: true }),
  Sound: {
    createAsync: () => Promise.resolve({ sound: { playAsync: () => {}, stopAsync: () => {}, unloadAsync: () => {} }, status: {} }),
  },
  Recording: class {
    prepareToRecordAsync() { return Promise.resolve(); }
    startAsync() { return Promise.resolve(); }
    stopAndUnloadAsync() { return Promise.resolve(); }
    getURI() { return null; }
    getStatusAsync() { return Promise.resolve({ isRecording: false }); }
  },
  RecordingOptionsPresets: { HIGH_QUALITY: {} },
  InterruptionModeIOS: {},
  InterruptionModeAndroid: {},
};

export const Video = () => null;
export const ResizeMode = { CONTAIN: 'contain', COVER: 'cover', STRETCH: 'stretch' };
export const AVPlaybackStatus = {};

export default { Audio, Video, ResizeMode };
