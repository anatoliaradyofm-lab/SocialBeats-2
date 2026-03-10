/**
 * ThemeContext - Tema yönetimi (açık/koyu/lacivert/sistem)
 * settingsStore ile senkronize
 * Dark, Light, Navy renk paletleri sunar + sistem teması desteği
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import { useSettingsStore } from '../stores/settingsStore';

const THEMES = {
  dark: {
    background: '#0A0A0B',
    surface: '#1E1E2E',
    card: '#1A1A2E',
    cardAlt: '#151520',
    text: '#FFFFFF',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    primary: '#7C3AED',
    accent: '#8B5CF6',
    border: '#2D2D3D',
    borderLight: '#1A1A2A',
    inputBg: '#1A1A1A',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    badge: '#FF3366',
    overlay: 'rgba(0,0,0,0.6)',
    statusBar: 'light',
    skeleton: '#1E1E2E',
    searchBg: '#1A1A1A',
    tabBar: '#0E0E12',
    headerBg: '#0A0A0B',
  },
  light: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    card: '#F1F5F9',
    cardAlt: '#E2E8F0',
    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    primary: '#7C3AED',
    accent: '#8B5CF6',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    inputBg: '#F1F5F9',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    badge: '#FF3366',
    overlay: 'rgba(0,0,0,0.3)',
    statusBar: 'dark',
    skeleton: '#E2E8F0',
    searchBg: '#F1F5F9',
    tabBar: '#FFFFFF',
    headerBg: '#FFFFFF',
  },
  navy: {
    background: '#0F1A2E',
    surface: '#1A2C4E',
    card: '#1E3456',
    cardAlt: '#152440',
    text: '#FFFFFF',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    primary: '#7C3AED',
    accent: '#8B5CF6',
    border: '#253B5E',
    borderLight: '#1A2C4E',
    inputBg: '#152440',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    badge: '#FF3366',
    overlay: 'rgba(0,0,0,0.6)',
    statusBar: 'light',
    skeleton: '#1A2C4E',
    searchBg: '#152440',
    tabBar: '#0B1526',
    headerBg: '#0F1A2E',
  },
};

const ThemeContext = createContext({ themeId: 'dark', setTheme: () => { }, colors: THEMES.dark });

export function ThemeProvider({ children }) {
  const store = useSettingsStore();
  const themeId = store.themeId || 'dark';
  const setTheme = store.setTheme || (() => { });
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme() || 'dark');

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme || 'dark');
    });
    return () => sub?.remove?.();
  }, []);

  const resolvedThemeId = themeId === 'system' ? systemScheme : themeId;
  const colors = useMemo(() => THEMES[resolvedThemeId] || THEMES.dark, [resolvedThemeId]);

  useEffect(() => {
    if (store.hydrate && !store._hydrated) store.hydrate();
  }, []);

  return (
    <ThemeContext.Provider value={{ themeId, setTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  return ctx || { themeId: 'dark', setTheme: () => { }, colors: THEMES.dark };
}

export { THEMES };
