/**
 * ThemeContext — NOVA Design System v3.1
 * 2025 Ultra-Premium Mobile Design Language
 * Inspired by: Mobbin · Dribbble 2025 · UI8 · Behance · Refero · Uplabs · Pageflows
 *
 * v3.1 — Full semantic token set for all 2 themes
 * Every hardcoded color in screens is now a token here.
 * dark · light — zero inconsistencies.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import { useSettingsStore } from '../stores/settingsStore';

const THEMES = {
  // ════════════════════════════════════════════════════════════
  //  DARK — QENARA Design System 2025
  //  Pixel-accurate: dribbble.com/shots/26207882
  //  Dark Navy #0D0B1E · Vivid Purple #9333EA · Hot Pink #EC4899
  // ════════════════════════════════════════════════════════════
  dark: {
    // ── Core Surfaces ─────────────────────────────────────────
    background:    '#08060F',          // Ultra-dark near-black warm
    surface:       'rgba(255,255,255,0.04)',
    surfaceHigh:   'rgba(255,255,255,0.07)',
    card:          'rgba(255,255,255,0.055)',
    cardAlt:       'rgba(255,255,255,0.025)',
    glass:         'rgba(255,255,255,0.07)',
    glassBorder:   'rgba(255,255,255,0.08)',

    // ── Typography ────────────────────────────────────────────
    text:          '#F8F8F8',          // warm white
    textSecondary: 'rgba(248,248,248,0.55)',
    textMuted:     'rgba(248,248,248,0.32)',
    textGhost:     'rgba(248,248,248,0.14)',

    // ── Brand — QENARA Luminous Violet ────────────────────────
    primary:       '#C084FC',          // luminous violet
    primaryGlow:   'rgba(192,132,252,0.32)',
    primaryDeep:   '#9333EA',
    primaryDark:   '#7E22CE',

    // ── Accent — Warm Amber-Orange (CTA energy) ───────────────
    accent:        '#FB923C',
    accentGlow:    'rgba(251,146,60,0.28)',
    accentDeep:    '#EA580C',
    highlight:     '#FCD34D',          // golden highlight
    highlightGlow: 'rgba(252,211,77,0.18)',

    // ── Coral ─────────────────────────────────────────────────
    coral:         '#F87171',
    coralGlow:     'rgba(248,113,113,0.20)',
    coralDeep:     '#E11D48',
    badge:         '#FB923C',

    // ── Functional ────────────────────────────────────────────
    error:         '#F87171',
    errorBg:       'rgba(248,113,113,0.12)',
    success:       '#34D399',
    successBg:     'rgba(52,211,153,0.12)',
    warning:       '#FBBF24',
    warningBg:     'rgba(251,191,36,0.12)',

    // ── UI Elements ───────────────────────────────────────────
    border:        'rgba(255,255,255,0.06)',
    borderLight:   'rgba(255,255,255,0.03)',
    inputBg:       'rgba(255,255,255,0.055)',
    inputBorder:   'rgba(255,255,255,0.09)',
    overlay:       'rgba(0,0,0,0.82)',
    scrim:         'rgba(8,6,15,0.95)',

    // ── Navigation ────────────────────────────────────────────
    tabBar:        'rgba(8,6,15,0.98)',
    tabBarBorder:  'rgba(192,132,252,0.10)',
    headerBg:      'rgba(8,6,15,0.96)',

    // ── Skeleton ──────────────────────────────────────────────
    skeleton:      'rgba(255,255,255,0.06)',
    skeletonShine: 'rgba(255,255,255,0.10)',
    searchBg:      'rgba(255,255,255,0.06)',

    // ── Gradients ─────────────────────────────────────────────
    gradPrimary:  ['#6B21A8', '#9333EA', '#C084FC'],
    gradAccent:   ['#9A3412', '#EA580C', '#FB923C'],
    gradBrand:    ['#9333EA', '#FB923C'],    // QENARA signature: violet → orange
    gradSunset:   ['#9A3412', '#EA580C', '#FB923C'],
    gradCard:     ['rgba(192,132,252,0.14)', 'rgba(251,146,60,0.04)'],

    // ── Scene-specific Gradients ──────────────────────────────
    authBgGrad:      ['#1A0A2E', '#100620', '#08060F'],
    heroGrad:        ['#1A0A2E', '#0D0618', '#08060F'],
    profileHeroGrad: ['#1A0A2E', '#0D0618', '#08060F'],
    playerBgGrad:    ['rgba(26,10,46,0.98)', 'rgba(8,6,15,0.98)'],
    miniPlayerBgGrad:['rgba(16,8,32,0.98)', 'rgba(8,6,15,0.97)'],
    playerAmbient:   'rgba(192,132,252,0.22)',

    // ── Decorative Orb Colors ─────────────────────────────────
    orbColor1: '#3B0764',    // deep violet
    orbColor2: '#7C2D12',    // deep orange

    // ── Semantic Icon Colors ───────────────────────────────────
    iconViolet: '#C084FC',
    iconCyan:   '#34D399',
    iconGreen:  '#34D399',
    iconCoral:  '#FB923C',
    iconPink:   '#F472B6',
    iconBlue:   '#60A5FA',
    iconAmber:  '#FBBF24',
    iconRed:    '#F87171',

    // ── Notification border ───────────────────────────────────
    notifBorder: '#08060F',

    statusBar: 'light',
  },

  // ════════════════════════════════════════════════════════════
  //  LIGHT — Soft lavender · Vibrant accents · Clean whites
  // ════════════════════════════════════════════════════════════
  light: {
    // ── Core Surfaces ─────────────────────────────────────────
    background:    '#F4F2FF',
    surface:       '#FFFFFF',
    surfaceHigh:   '#FAFAFE',
    card:          '#FFFFFF',
    cardAlt:       '#EDE9FF',
    glass:         'rgba(255,255,255,0.85)',
    glassBorder:   'rgba(109,40,217,0.12)',

    // ── Typography ────────────────────────────────────────────
    text:          '#0D0B1E',
    textSecondary: '#4A3F70',
    textMuted:     '#8878B0',
    textGhost:     '#C0B8D8',

    // ── Brand ─────────────────────────────────────────────────
    primary:       '#7C3AED',
    primaryGlow:   'rgba(124,58,237,0.15)',
    primaryDeep:   '#5B21B6',
    primaryDark:   '#4C1D95',

    // ── Accent ────────────────────────────────────────────────
    accent:        '#0891B2',
    accentGlow:    'rgba(8,145,178,0.15)',
    accentDeep:    '#0E7490',
    highlight:     '#0891B2',
    highlightGlow: 'rgba(8,145,178,0.15)',

    // ── Coral ─────────────────────────────────────────────────
    coral:         '#E11D48',
    coralGlow:     'rgba(225,29,72,0.12)',
    coralDeep:     '#9F1239',
    badge:         '#E11D48',

    // ── Functional ────────────────────────────────────────────
    error:         '#DC2626',
    errorBg:       'rgba(220,38,38,0.09)',
    success:       '#059669',
    successBg:     'rgba(5,150,105,0.09)',
    warning:       '#B45309',
    warningBg:     'rgba(180,83,9,0.09)',

    // ── UI Elements ───────────────────────────────────────────
    border:        'rgba(109,40,217,0.10)',
    borderLight:   'rgba(109,40,217,0.06)',
    inputBg:       '#EDEAFF',
    inputBorder:   'rgba(109,40,217,0.20)',
    overlay:       'rgba(13,11,30,0.40)',
    scrim:         'rgba(244,242,255,0.96)',

    // ── Navigation ────────────────────────────────────────────
    tabBar:        'rgba(255,255,255,0.97)',
    tabBarBorder:  'rgba(109,40,217,0.09)',
    headerBg:      'rgba(255,255,255,0.97)',

    // ── Skeleton ──────────────────────────────────────────────
    skeleton:      '#E4DFFF',
    skeletonShine: '#F4F2FF',
    searchBg:      '#EBE7FF',

    // ── Gradients ─────────────────────────────────────────────
    gradPrimary: ['#4C1D95', '#7C3AED', '#A855F7'],
    gradAccent:  ['#0E7490', '#0891B2'],
    gradSunset:  ['#9F1239', '#E11D48', '#F43F5E'],
    gradCard:    ['rgba(124,58,237,0.10)', 'rgba(124,58,237,0.02)'],

    // ── Scene-specific Gradients ──────────────────────────────
    authBgGrad:      ['#EDE9FE', '#F3F0FF', '#F4F2FF'],
    heroGrad:        ['#DDD6FE', '#EDE9FE', '#F4F2FF'],
    profileHeroGrad: ['#DDD6FE', '#EDE9FE', '#F4F2FF'],
    playerBgGrad:    ['rgba(237,233,254,0.97)', 'rgba(244,242,255,0.98)'],
    miniPlayerBgGrad:['rgba(255,255,255,0.97)', 'rgba(244,242,255,0.97)'],
    playerAmbient:   'rgba(124,58,237,0.08)',

    // ── Decorative Orbs ───────────────────────────────────────
    orbColor1: '#C4B5FD',      // soft violet
    orbColor2: '#99F6E4',      // soft teal

    // ── Semantic Icon Colors ───────────────────────────────────
    iconViolet: '#7C3AED',
    iconCyan:   '#0891B2',
    iconGreen:  '#059669',
    iconCoral:  '#E11D48',
    iconPink:   '#DB2777',
    iconBlue:   '#1D4ED8',
    iconAmber:  '#B45309',
    iconRed:    '#DC2626',

    // ── Notification border ───────────────────────────────────
    notifBorder: '#F4F2FF',

    statusBar: 'dark',
  },
};

const ThemeContext = createContext({
  themeId: 'dark',
  setTheme: () => {},
  colors: THEMES.dark,
});

export function ThemeProvider({ children }) {
  const store   = useSettingsStore();
  const themeId = store.themeId || 'dark';
  const setTheme = store.setTheme || (() => {});
  const [systemScheme, setSystemScheme] = useState(
    Appearance.getColorScheme() || 'dark'
  );

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme || 'dark');
    });
    return () => sub?.remove?.();
  }, []);

  const resolvedThemeId = themeId === 'system' ? systemScheme : themeId;
  const colors = useMemo(
    () => THEMES[resolvedThemeId] || THEMES.dark,
    [resolvedThemeId]
  );

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
  return ctx || { themeId: 'dark', setTheme: () => {}, colors: THEMES.dark };
}

export { THEMES };
