/**
 * InterstitialAdSlot — Yerleştirme noktası bileşeni
 * placement='story' → ADMOB_STORY_INTERSTITIAL unit ID kullanır
 * Diğerleri        → ADMOB_INTERSTITIAL_ID kullanır
 */
import { useEffect } from 'react';
import useInterstitialAd, { AD_UNITS } from '../../hooks/useInterstitialAd';

export default function InterstitialAdSlot({ placement = 'slot', onClose, frequency = 1 }) {
  const unitId = placement === 'story' ? AD_UNITS.storyInterstitial : AD_UNITS.interstitial;
  const { trigger } = useInterstitialAd({ onClosed: onClose, placement, frequency, unitId });
  useEffect(() => { trigger(); }, []);
  return null;
}
