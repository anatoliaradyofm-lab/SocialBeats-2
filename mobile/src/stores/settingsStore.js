/**
 * Zustand settings store with persistence
 * Uses AsyncStorage for Expo compatibility (MMKV for dev builds if needed)
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@settings_store';

const loadStored = async () => {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const useSettingsStore = create((set, get) => ({
  themeId: 'dark',
  language: null,
  // Accessibility
  fontSizeScale: 1.0,
  highContrast: false,
  colorBlindMode: 'none',
  reduceMotion: false,
  _hydrated: false,

  setTheme: (themeId) => {
    set({ themeId });
    get()._persist();
  },

  setLanguage: (language) => {
    set({ language });
    get()._persist();
  },

  setFontSizeScale: (fontSizeScale) => { set({ fontSizeScale }); get()._persist(); },
  setHighContrast: (highContrast) => { set({ highContrast }); get()._persist(); },
  setColorBlindMode: (colorBlindMode) => { set({ colorBlindMode }); get()._persist(); },
  setReduceMotion: (reduceMotion) => { set({ reduceMotion }); get()._persist(); },

  hydrate: async () => {
    const stored = await loadStored();
    set({ ...stored, _hydrated: true });
  },

  _persist: async () => {
    const { themeId, language, fontSizeScale, highContrast, colorBlindMode, reduceMotion } = get();
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({
        themeId, language, fontSizeScale, highContrast, colorBlindMode, reduceMotion,
      }));
    } catch (e) {
      console.warn('Settings persist error:', e);
    }
  },
}));
