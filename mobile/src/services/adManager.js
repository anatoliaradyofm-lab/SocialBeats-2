/**
 * adManager — Merkezi Interstitial Reklam Yöneticisi
 *
 * Kural:
 *  - Ekranlar arası geçişte tetiklenir (AppNavigator onStateChange)
 *  - Min 3 dakika aralık (COOLDOWN_MS)
 *  - Her MIN_TRANSITIONS geçişte bir gösterim
 *  - Hariç tutulan ekranlarda ve story'de gösterilmez (story kendi akışını yönetir)
 *  - Platform.OS === 'web' → sessizce pas geçer
 */
import { Platform } from 'react-native';
import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';

const UNIT_ID = (typeof __DEV__ !== 'undefined' && __DEV__)
  ? (TestIds?.INTERSTITIAL ?? 'ca-app-pub-3940256099942544/1033173712')
  : (process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID ?? 'ca-app-pub-3940256099942544/1033173712');

const COOLDOWN_MS     = 30 * 60 * 1000; // 30 dakika
const MIN_TRANSITIONS = 20;             // her 20 tab geçişinde bir

// Sadece bu tab ekranları arasındaki geçişlerde reklam gösterilir
const TAB_SCREENS = new Set(['Home', 'Library', 'AR', 'Rooms']);

let adInstance   = null;
let isLoaded     = false;
let lastShownAt  = 0;
let transCount   = 0;
let prevScreen   = null;

function loadAd() {
  if (Platform.OS === 'web') return;
  try {
    const ad = InterstitialAd.createForAdRequest(UNIT_ID, {
      requestNonPersonalizedAdsOnly: false,
    });
    adInstance = ad;
    ad.addAdEventListener(AdEventType.LOADED, () => { isLoaded = true; });
    ad.addAdEventListener(AdEventType.CLOSED, () => {
      isLoaded    = false;
      lastShownAt = Date.now();
      loadAd(); // bir sonraki için önceden yükle
    });
    ad.addAdEventListener(AdEventType.ERROR, () => { isLoaded = false; });
    ad.load();
  } catch {}
}

// Uygulama başlarken ilk yüklemeyi başlat
loadAd();

/**
 * onScreenChange(screenName)
 * AppNavigator → onStateChange içinden çağrılır.
 */
export function onScreenChange(screenName) {
  if (Platform.OS === 'web') return;
  if (!screenName || screenName === prevScreen) return;
  const wasTab = TAB_SCREENS.has(prevScreen);
  prevScreen = screenName;

  // Sadece tab → tab geçişlerinde say
  if (!wasTab || !TAB_SCREENS.has(screenName)) return;

  transCount++;
  if (transCount < MIN_TRANSITIONS) return;

  const now = Date.now();
  if (now - lastShownAt < COOLDOWN_MS) return;

  if (!isLoaded || !adInstance) return;

  transCount = 0; // sayacı sıfırla
  try {
    adInstance.show();
  } catch {}
}
