/**
 * LocalizationService - Auto language and region detection
 * Priority: 1) preferred_language (AsyncStorage) 2) geo/me 3) device locale (expo-localization)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

let Localization = null;
try {
  Localization = require('expo-localization');
} catch (_) {}
import { setLocale } from '../lib/localeStore';

const PREFERRED_LANGUAGE_KEY = 'preferred_language';
const CACHE_KEY = '@SocialBeats/locale_cache';
const SUPPORTED_LANGS = ['tr', 'en', 'de', 'fr', 'es', 'it', 'ar', 'ru', 'zh', 'zh-TW', 'ja', 'ko', 'pt', 'pt-BR', 'nl', 'pl', 'el', 'hi', 'bn', 'id', 'ms', 'vi', 'fil', 'th', 'ur', 'fa', 'ta', 'te', 'uk', 'ro', 'af', 'sw', 'ha', 'yo', 'zu'];

function normalizeLang(code) {
  if (!code || typeof code !== 'string') return 'en';
  const base = code.split(/[-_]/)[0].toLowerCase();
  if (code.toLowerCase().includes('pt-br')) return 'pt-BR';
  const map = { pt: 'pt', 'pt-br': 'pt-BR', fil: 'fil', ur: 'ur', fa: 'fa', ta: 'ta', te: 'te', zh: 'zh', 'zh-tw': 'zh-TW', hi: 'hi', bn: 'bn', id: 'id', vi: 'vi', th: 'th', ms: 'ms', ar: 'ar', ja: 'ja', ko: 'ko', de: 'de', fr: 'fr', es: 'es', it: 'it', ru: 'ru', tr: 'tr', pl: 'pl', nl: 'nl', el: 'el', en: 'en', uk: 'uk', ro: 'ro', af: 'af', sw: 'sw', ha: 'ha', yo: 'yo', zu: 'zu' };
  return map[base] || (SUPPORTED_LANGS.includes(base) ? base : 'en');
}

export default {
  async initialize() {
    try {
      const preferred = await AsyncStorage.getItem(PREFERRED_LANGUAGE_KEY);
      if (preferred && SUPPORTED_LANGS.includes(preferred)) {
        const cached = await this._loadFromCache();
        const countryCode = cached?.countryCode || 'US';
        setLocale(preferred, countryCode);
        return { language: preferred, countryCode };
      }
      const cached = await this._loadFromCache();
      if (cached?.countryCode && !cached?.manuallySelected) {
        const lang = SUPPORTED_LANGS.includes(cached.language) ? cached.language : 'en';
        setLocale(lang, cached.countryCode);
        return { language: lang, countryCode: cached.countryCode };
      }
      try {
        const geo = await api.get('/geo/me');
        const lang = SUPPORTED_LANGS.includes(geo.language) ? geo.language : 'en';
        const cc = geo.countryCode || 'US';
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
          language: lang,
          countryCode: cc,
          region: geo.region,
          city: geo.city,
          timezone: geo.timezone,
          manuallySelected: false,
        }));
        setLocale(lang, cc);
        return { language: lang, countryCode: cc };
      } catch (e) {
        const locales = (Localization && Localization.getLocales && Localization.getLocales()) || [];
        const deviceLang = locales[0]?.languageTag || locales[0]?.languageCode || 'en';
        const lang = normalizeLang(deviceLang);
        const finalLang = SUPPORTED_LANGS.includes(lang) ? lang : 'en';
        const cc = cached?.countryCode || 'US';
        setLocale(finalLang, cc);
        return { language: finalLang, countryCode: cc };
      }
    } catch (e) {
      console.warn('Locale init failed:', e.message);
      setLocale('en', 'US');
      return { language: 'en', countryCode: 'US' };
    }
  },

  async saveLanguage(lang) {
    await AsyncStorage.setItem(PREFERRED_LANGUAGE_KEY, lang);
    const cached = await this._loadFromCache();
    const countryCode = cached?.countryCode || 'US';
    setLocale(lang, countryCode);
    const next = cached
      ? { ...cached, language: lang, manuallySelected: true }
      : { language: lang, countryCode, manuallySelected: true };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next));
  },

  async _loadFromCache() {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
};
