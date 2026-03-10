/**
 * InterstitialAdContext - Geçiş reklamı için global tetikleyici
 * Provider tek reklam örneği tutar, trigger() her yerden çağrılabilir
 */
import React, { createContext, useContext } from 'react';
import useInterstitialAd from '../hooks/useInterstitialAd';

const InterstitialAdContext = createContext(null);

export function InterstitialAdProvider({ children, onClosed }) {
  const { trigger, loadAd } = useInterstitialAd({ onClosed, placement: 'transition' });
  return (
    <InterstitialAdContext.Provider value={{ trigger, loadAd }}>
      {children}
    </InterstitialAdContext.Provider>
  );
}

export function useInterstitialAdContext() {
  const ctx = useContext(InterstitialAdContext);
  return ctx || { trigger: () => {}, loadAd: () => {} };
}
