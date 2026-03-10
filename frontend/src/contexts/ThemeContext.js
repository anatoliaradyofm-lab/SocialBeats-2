import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@app_theme';
const ACCENT_KEY = '@app_accent_hsl';

export const BRAND = {
  primary: '#7C3AED',
  primaryLight: '#A78BFA',
  primaryDark: '#5B21B6',
  accent: '#06B6D4',
  accentLight: '#67E8F9',
  pink: '#EC4899',
  pinkLight: '#F9A8D4',
  gradient: ['#7C3AED', '#06B6D4'],
  gradientWarm: ['#7C3AED', '#EC4899'],
};

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); };
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function hexToHSL(hex) {
  let r = 0, g = 0, b = 0;
  if (hex.length === 7) { r = parseInt(hex.slice(1, 3), 16) / 255; g = parseInt(hex.slice(3, 5), 16) / 255; b = parseInt(hex.slice(5, 7), 16) / 255; }
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function buildBrandFromHSL(h, s, l) {
  return {
    ...BRAND,
    primary: hslToHex(h, s, l),
    primaryLight: hslToHex(h, Math.max(s - 15, 20), Math.min(l + 20, 85)),
    primaryDark: hslToHex(h, Math.min(s + 10, 100), Math.max(l - 18, 15)),
    gradient: [hslToHex(h, s, l), BRAND.accent],
    gradientWarm: [hslToHex(h, s, l), BRAND.pink],
  };
}

const baseThemes = {
  dark: {
    background: '#09090B', surface: '#18181B', surfaceElevated: '#1E1E22',
    card: '#27272A', cardHover: '#2E2E33',
    text: '#FAFAFA', textSecondary: '#A1A1AA', textMuted: '#71717A',
    border: '#2E2E33', borderLight: '#3F3F46',
    tabBar: '#09090B', tabBarBorder: '#1E1E22',
    success: '#10B981', danger: '#EF4444', warning: '#F59E0B',
    overlay: 'rgba(0,0,0,0.6)', skeleton: '#27272A', inputBg: '#1E1E22',
  },
  light: {
    background: '#FAFAFA', surface: '#FFFFFF', surfaceElevated: '#F4F4F5',
    card: '#F4F4F5', cardHover: '#E4E4E7',
    text: '#09090B', textSecondary: '#52525B', textMuted: '#A1A1AA',
    border: '#E4E4E7', borderLight: '#D4D4D8',
    tabBar: '#FFFFFF', tabBarBorder: '#E4E4E7',
    success: '#059669', danger: '#DC2626', warning: '#D97706',
    overlay: 'rgba(0,0,0,0.4)', skeleton: '#E4E4E7', inputBg: '#F4F4F5',
  },
};

function buildColors(baseId, brand) {
  const base = baseThemes[baseId] || baseThemes.dark;
  return {
    ...base,
    primary: brand.primary,
    primaryLight: brand.primaryLight,
    accent: brand.accent,
    accentLight: baseId === 'dark' ? brand.accentLight : '#0E7490',
    pink: brand.pink,
  };
}

const defaultCtx = {
  themeMode: 'dark', resolvedTheme: 'dark',
  colors: buildColors('dark', BRAND), brand: BRAND,
  accentHSL: hexToHSL(BRAND.primary),
  setTheme: () => {}, setAccentHSL: () => {}, resetAccent: () => {},
};

const ThemeContext = createContext(defaultCtx);

export function ThemeProvider({ children }) {
  const [themeMode, setThemeMode] = useState('dark');
  const [accentHSL, setAccentHSLState] = useState(hexToHSL(BRAND.primary));
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme() || 'dark');

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme || 'dark');
    });
    return () => sub?.remove?.();
  }, []);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(THEME_KEY),
      AsyncStorage.getItem(ACCENT_KEY),
    ]).then(([savedTheme, savedAccent]) => {
      if (savedTheme) setThemeMode(savedTheme);
      if (savedAccent) {
        try { setAccentHSLState(JSON.parse(savedAccent)); } catch {}
      }
    }).catch(() => {});
  }, []);

  const resolvedTheme = themeMode === 'system' ? systemScheme : themeMode;
  const brand = buildBrandFromHSL(accentHSL.h, accentHSL.s, accentHSL.l);
  const colors = buildColors(resolvedTheme === 'light' ? 'light' : 'dark', brand);

  const setTheme = useCallback((mode) => {
    const valid = ['dark', 'light', 'system'];
    if (valid.includes(mode)) {
      setThemeMode(mode);
      AsyncStorage.setItem(THEME_KEY, mode).catch(() => {});
    }
  }, []);

  const setAccentHSL = useCallback((hsl) => {
    setAccentHSLState(hsl);
    AsyncStorage.setItem(ACCENT_KEY, JSON.stringify(hsl)).catch(() => {});
  }, []);

  const resetAccent = useCallback(() => {
    const def = hexToHSL(BRAND.primary);
    setAccentHSLState(def);
    AsyncStorage.removeItem(ACCENT_KEY).catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{
      themeMode, resolvedTheme, colors, brand, accentHSL,
      setTheme, setAccentHSL, resetAccent,
      themeId: resolvedTheme,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
