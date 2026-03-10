/**
 * Module-level store for current language and country.
 * Used by api.js to add Accept-Language and X-Country-Code headers.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREF_KEY = 'preferred_language';
const GEO_CACHE_KEY = '@SocialBeats/locale_cache';

let currentLanguage = 'en';
let countryCode = 'US';

export function setLocale(language, country) {
  currentLanguage = language || currentLanguage;
  if (country != null) countryCode = country;
}

export function getLocale() {
  return { language: currentLanguage, countryCode };
}

export function useLocaleStore() {
  return getLocale();
}

export async function initFromStorage() {
  try {
    const [pref, geo] = await Promise.all([
      AsyncStorage.getItem(PREF_KEY),
      AsyncStorage.getItem(GEO_CACHE_KEY),
    ]);
    if (pref) currentLanguage = pref;
    if (geo) {
      const g = JSON.parse(geo);
      if (g.countryCode) countryCode = g.countryCode;
      if (g.language && !pref) currentLanguage = g.language;
    }
  } catch (_) {}
}
