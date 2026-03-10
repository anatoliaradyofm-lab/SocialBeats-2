import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useSettingsStore = create((set, get) => ({
  themeId: 'dark',
  language: 'tr',
  notificationsEnabled: true,
  _hydrated: false,

  setTheme: (themeId) => {
    set({ themeId });
    AsyncStorage.setItem('@settings_theme', themeId).catch(() => {});
  },

  setLanguage: (language) => {
    set({ language });
    AsyncStorage.setItem('@settings_language', language).catch(() => {});
  },

  setNotificationsEnabled: (enabled) => {
    set({ notificationsEnabled: enabled });
    AsyncStorage.setItem('@settings_notifications', String(enabled)).catch(() => {});
  },

  hydrate: async () => {
    if (get()._hydrated) return;
    try {
      const [theme, lang, notif] = await Promise.all([
        AsyncStorage.getItem('@settings_theme'),
        AsyncStorage.getItem('@settings_language'),
        AsyncStorage.getItem('@settings_notifications'),
      ]);
      set({
        themeId: theme || 'dark',
        language: lang || 'tr',
        notificationsEnabled: notif !== 'false',
        _hydrated: true,
      });
    } catch {
      set({ _hydrated: true });
    }
  },
}));
