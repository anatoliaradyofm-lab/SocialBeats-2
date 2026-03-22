/**
 * useRewardedInterstitialAd — Ödüllü reklam hook
 * show() çağrısıyla gösterilir; kullanıcı izlerse onEarned tetiklenir.
 */
import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { RewardedInterstitialAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';
import { AD_UNITS } from '../../hooks/useInterstitialAd';
const UNIT_ID = (typeof __DEV__ !== 'undefined' && __DEV__)
  ? (TestIds?.REWARDED_INTERSTITIAL ?? 'ca-app-pub-3940256099942544/5224354917')
  : AD_UNITS.rewarded;

export function useRewardedInterstitialAd({ onEarned, onClosed } = {}) {
  const adRef    = useRef(null);
  const loadedRef = useRef(false);

  const loadAd = useCallback(() => {
    if (Platform.OS === 'web') return;
    try {
      const ad = RewardedInterstitialAd.createForAdRequest(UNIT_ID);
      adRef.current = ad;
      ad.addAdEventListener(RewardedAdEventType.LOADED,        () => { loadedRef.current = true; });
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (r)  => onEarned?.(r));
      ad.addAdEventListener('closed',                          ()   => {
        loadedRef.current = false;
        onClosed?.();
        loadAd();
      });
      ad.load();
    } catch {}
  }, [onEarned, onClosed]);

  useEffect(() => { loadAd(); }, [loadAd]);

  /** Reklamı göster. Yüklü değilse onClosed'u çağırıp devam eder. */
  const show = useCallback(async () => {
    if (Platform.OS === 'web' || !loadedRef.current || !adRef.current) {
      onClosed?.();
      return false;
    }
    try {
      await adRef.current.show();
      return true;
    } catch {
      onClosed?.();
      return false;
    }
  }, [onClosed]);

  return { show, isLoaded: () => loadedRef.current };
}

export default function RewardedInterstitialAdSlot() { return null; }
