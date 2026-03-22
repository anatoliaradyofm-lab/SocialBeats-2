/**
 * useInterstitialAd — Google AdMob Interstitial hook
 * Native build gerektirir (Expo Go desteklemez)
 * Platform.OS === 'web' durumunda sessizce pas geçer
 */
import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';

const DEFAULT_UNIT_ID = (typeof __DEV__ !== 'undefined' && __DEV__)
  ? (TestIds?.INTERSTITIAL ?? 'ca-app-pub-3940256099942544/1033173712')
  : (process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID ?? 'ca-app-pub-3940256099942544/1033173712');

const STORY_UNIT_ID = (typeof __DEV__ !== 'undefined' && __DEV__)
  ? (TestIds?.INTERSTITIAL ?? 'ca-app-pub-3940256099942544/1033173712')
  : (process.env.EXPO_PUBLIC_ADMOB_STORY_INTERSTITIAL ?? DEFAULT_UNIT_ID);

export const AD_UNITS = {
  interstitial:      DEFAULT_UNIT_ID,
  storyInterstitial: STORY_UNIT_ID,
  rewarded:          (typeof __DEV__ !== 'undefined' && __DEV__)
                       ? (TestIds?.REWARDED ?? 'ca-app-pub-3940256099942544/5354046379')
                       : (process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID ?? 'ca-app-pub-3940256099942544/5354046379'),
  native:            (typeof __DEV__ !== 'undefined' && __DEV__)
                       ? (TestIds?.NATIVE ?? 'ca-app-pub-3940256099942544/2247696110')
                       : (process.env.EXPO_PUBLIC_ADMOB_NATIVE_UNIT_ID ?? 'ca-app-pub-3940256099942544/2247696110'),
};

// Session başına ekran ziyaret sayaçları
const sessionCounts = {};

export function shouldTriggerInterstitialHome() { return false; }
export function shouldTriggerInterstitialFeed() { return false; }

/**
 * @param {object} opts
 * @param {function} opts.onClosed   - Reklam kapandığında callback
 * @param {string}  opts.placement   - Hangi ekrandan tetiklendiği (istatistik için)
 * @param {number}  opts.frequency   - Her kaçıncı ziyarette reklam gösterilsin (default 3)
 * @param {string}  opts.unitId      - Özel unit ID (default: INTERSTITIAL_ID)
 */
export default function useInterstitialAd({ onClosed, placement = 'default', frequency = 3, unitId } = {}) {
  const adRef    = useRef(null);
  const loadedRef = useRef(false);
  const subsRef  = useRef([]);
  const resolvedUnit = unitId ?? DEFAULT_UNIT_ID;

  const loadAd = useCallback(() => {
    if (Platform.OS === 'web') return;
    try {
      subsRef.current.forEach(fn => { try { fn?.(); } catch {} });
      subsRef.current = [];

      const ad = InterstitialAd.createForAdRequest(resolvedUnit, {
        requestNonPersonalizedAdsOnly: false,
      });
      adRef.current = ad;

      subsRef.current.push(
        ad.addAdEventListener(AdEventType.LOADED, () => {
          loadedRef.current = true;
        }),
        ad.addAdEventListener(AdEventType.CLOSED, () => {
          loadedRef.current = false;
          onClosed?.();
          loadAd(); // bir sonraki reklam için önceden yükle
        }),
        ad.addAdEventListener(AdEventType.ERROR, () => {
          loadedRef.current = false;
        }),
      );
      ad.load();
    } catch {}
  }, [onClosed]);

  useEffect(() => {
    loadAd();
    return () => { subsRef.current.forEach(fn => { try { fn?.(); } catch {} }); };
  }, [loadAd]);

  /**
   * trigger() — ekrana her girişte çağır.
   * frequency'ye göre karar verir, gereksiz yüklenmelerde reklam göstermez.
   */
  const trigger = useCallback(async () => {
    if (Platform.OS === 'web') return;
    sessionCounts[placement] = (sessionCounts[placement] || 0) + 1;
    if (sessionCounts[placement] % frequency !== 0) return;
    if (!loadedRef.current || !adRef.current) return;
    try {
      await adRef.current.show();
    } catch {}
  }, [placement, frequency]);

  return { trigger, loadAd };
}
