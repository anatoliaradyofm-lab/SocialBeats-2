export const TrackPlayer = {
    setupPlayer: async () => { },
    updateOptions: async () => { },
    reset: async () => { },
    add: async () => { },
    play: async () => { },
    pause: async () => { },
    stop: async () => { },
    seekTo: async () => { },
    setVolume: async () => { },
    setRate: async () => { },
    getState: async () => 0,
    getPosition: async () => 0,
    getDuration: async () => 0,
    getActiveTrack: async () => null,
    registerPlaybackService: () => { },
};
export const State = { None: 0, Playing: 1, Paused: 2 };
export const Capability = { Play: 1, Pause: 2, SkipToNext: 3, SkipToPrevious: 4, Stop: 5 };
export const usePlaybackState = () => ({ state: 0 });
