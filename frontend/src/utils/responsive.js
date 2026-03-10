import { Dimensions, PixelRatio, Platform, StatusBar } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

export const wp = (pct) => SCREEN_WIDTH * (pct / 100);
export const hp = (pct) => SCREEN_HEIGHT * (pct / 100);

export function scale(size) {
  return Math.round(PixelRatio.roundToNearestPixel(size * (SCREEN_WIDTH / BASE_WIDTH)));
}

export function verticalScale(size) {
  return Math.round(PixelRatio.roundToNearestPixel(size * (SCREEN_HEIGHT / BASE_HEIGHT)));
}

export function moderateScale(size, factor = 0.5) {
  return Math.round(size + (scale(size) - size) * factor);
}

export const BREAKPOINTS = { sm: 0, md: 768, lg: 1024, xl: 1440 };

export function getBreakpoint(w = SCREEN_WIDTH) {
  if (w >= BREAKPOINTS.xl) return 'xl';
  if (w >= BREAKPOINTS.lg) return 'lg';
  if (w >= BREAKPOINTS.md) return 'md';
  return 'sm';
}

export function responsive(values) {
  const bp = getBreakpoint();
  return values[bp] ?? values.md ?? values.sm;
}

export function gridColumns(minItemWidth = 160) {
  return Math.max(1, Math.floor(SCREEN_WIDTH / minItemWidth));
}

export const isSmall = SCREEN_WIDTH < 360;
export const isMedium = SCREEN_WIDTH >= 360 && SCREEN_WIDTH < 768;
export const isTablet = SCREEN_WIDTH >= 768;
export const isLargeScreen = SCREEN_WIDTH >= 1024;

export const safeTop = Platform.OS === 'ios' ? (SCREEN_HEIGHT >= 812 ? 44 : 20) : StatusBar.currentHeight || 24;
export const safeBottom = Platform.OS === 'ios' ? (SCREEN_HEIGHT >= 812 ? 34 : 0) : 0;
