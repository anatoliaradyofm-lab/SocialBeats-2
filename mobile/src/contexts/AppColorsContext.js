/**
 * AppColorsContext - Renk körü modu için erişilebilir renk paleti
 * colorblindMode: off | protanopia | deuteranopia | tritanopia
 */
import React, { createContext, useContext } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

const COLOR_PALETTES = {
  off: {
    primary: '#8B5CF6',
    primaryLight: '#A78BFA',
    accent: '#8B5CF6',
    success: '#22C55E',
    danger: '#DC2626',
    warning: '#F59E0B',
    info: '#3B82F6',
  },
  protanopia: {
    primary: '#3B82F6',
    primaryLight: '#60A5FA',
    accent: '#3B82F6',
    success: '#22C55E',
    danger: '#DC2626',
    warning: '#F59E0B',
    info: '#3B82F6',
  },
  deuteranopia: {
    primary: '#3B82F6',
    primaryLight: '#60A5FA',
    accent: '#3B82F6',
    success: '#22C55E',
    danger: '#DC2626',
    warning: '#F59E0B',
    info: '#3B82F6',
  },
  tritanopia: {
    primary: '#8B5CF6',
    primaryLight: '#A78BFA',
    accent: '#8B5CF6',
    success: '#22C55E',
    danger: '#DC2626',
    warning: '#F59E0B',
    info: '#3B82F6',
  },
};

const AppColorsContext = createContext(COLOR_PALETTES.off);

export function AppColorsProvider({ children }) {
  const colorblindMode = useSettingsStore((s) => s.colorblindMode) || 'off';
  const colors = COLOR_PALETTES[colorblindMode] || COLOR_PALETTES.off;
  return <AppColorsContext.Provider value={colors}>{children}</AppColorsContext.Provider>;
}

export function useAppColors() {
  const ctx = useContext(AppColorsContext);
  return ctx || COLOR_PALETTES.off;
}
