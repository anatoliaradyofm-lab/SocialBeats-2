import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

import en from './translations-en';
import tr from './translations-tr';
import de from './translations-de';
import fr from './translations-fr';
import es from './translations-es';
import it from './translations-it';
import ar from './translations-ar';
import ru from './translations-ru';
import zh from './translations-zh';
import ja from './translations-ja';
import pt from './translations-pt';
import ptBR from './translations-ptBR';
import nl from './translations-nl';
import pl from './translations-pl';
import el from './translations-el';
import hi from './translations-hi';
import id from './translations-id';
import vi from './translations-vi';
import fil from './translations-fil';
import th from './translations-th';
import ur from './translations-ur';
import ms from './translations-ms';
import ko from './translations-ko';
import uk from './translations-uk';
import zhTW from './translations-zhTW';
import af from './translations-af';
import bn from './translations-bn';
import ha from './translations-ha';
import yo from './translations-yo';
import zu from './translations-zu';
import sw from './translations-sw';
import fa from './translations-fa';
import ta from './translations-ta';
import te from './translations-te';
import ro from './translations-ro';

export const SUPPORTED_LANGUAGES = [
  { code: 'tr',    name: 'Türkçe',              flag: '🇹🇷' },
  { code: 'en',    name: 'English',              flag: '🇺🇸' },
  { code: 'de',    name: 'Deutsch',              flag: '🇩🇪' },
  { code: 'fr',    name: 'Français',             flag: '🇫🇷' },
  { code: 'es',    name: 'Español',              flag: '🇪🇸' },
  { code: 'it',    name: 'Italiano',             flag: '🇮🇹' },
  { code: 'ar',    name: 'العربية',              flag: '🇸🇦' },
  { code: 'ru',    name: 'Русский',              flag: '🇷🇺' },
  { code: 'zh',    name: '中文 (简体)',           flag: '🇨🇳' },
  { code: 'zh-TW', name: '繁體中文 (台灣)',       flag: '🇹🇼' },
  { code: 'ja',    name: '日本語',               flag: '🇯🇵' },
  { code: 'ko',    name: '한국어',               flag: '🇰🇷' },
  { code: 'pt',    name: 'Português',            flag: '🇵🇹' },
  { code: 'pt-BR', name: 'Português (Brasil)',   flag: '🇧🇷' },
  { code: 'nl',    name: 'Nederlands',           flag: '🇳🇱' },
  { code: 'pl',    name: 'Polski',               flag: '🇵🇱' },
  { code: 'el',    name: 'Ελληνικά',             flag: '🇬🇷' },
  { code: 'hi',    name: 'हिन्दी',              flag: '🇮🇳' },
  { code: 'bn',    name: 'বাংলা',               flag: '🇧🇩' },
  { code: 'id',    name: 'Bahasa Indonesia',     flag: '🇮🇩' },
  { code: 'ms',    name: 'Bahasa Melayu',        flag: '🇲🇾' },
  { code: 'vi',    name: 'Tiếng Việt',           flag: '🇻🇳' },
  { code: 'fil',   name: 'Filipino',             flag: '🇵🇭' },
  { code: 'th',    name: 'ไทย',                 flag: '🇹🇭' },
  { code: 'ur',    name: 'اردو',                flag: '🇵🇰' },
  { code: 'fa',    name: 'فارسی',               flag: '🇮🇷' },
  { code: 'ta',    name: 'தமிழ்',              flag: '🇮🇳' },
  { code: 'te',    name: 'తెలుగు',             flag: '🇮🇳' },
  { code: 'uk',    name: 'Українська',           flag: '🇺🇦' },
  { code: 'ro',    name: 'Română',              flag: '🇷🇴' },
  { code: 'af',    name: 'Afrikaans',            flag: '🇿🇦' },
  { code: 'sw',    name: 'Kiswahili',            flag: '🇰🇪' },
  { code: 'ha',    name: 'Hausa',               flag: '🇳🇬' },
  { code: 'yo',    name: 'Yorùbá',              flag: '🇳🇬' },
  { code: 'zu',    name: 'isiZulu',             flag: '🇿🇦' },
];

const resources = {
  en:    { translation: en },
  tr:    { translation: tr },
  de:    { translation: de },
  fr:    { translation: fr },
  es:    { translation: es },
  it:    { translation: it },
  ar:    { translation: ar },
  ru:    { translation: ru },
  zh:    { translation: zh },
  ja:    { translation: ja },
  ko:    { translation: ko },
  pt:    { translation: pt },
  'pt-BR': { translation: ptBR },
  nl:    { translation: nl },
  pl:    { translation: pl },
  el:    { translation: el },
  hi:    { translation: hi },
  bn:    { translation: bn },
  id:    { translation: id },
  vi:    { translation: vi },
  fil:   { translation: fil },
  th:    { translation: th },
  ur:    { translation: ur },
  fa:    { translation: fa },
  ta:    { translation: ta },
  te:    { translation: te },
  ms:    { translation: ms },
  uk:    { translation: uk },
  'zh-TW': { translation: zhTW },
  ro:    { translation: ro },
  af:    { translation: af },
  sw:    { translation: sw },
  ha:    { translation: ha },
  yo:    { translation: yo },
  zu:    { translation: zu },
};

export const RTL_LANGUAGES = ['ar', 'ur', 'fa'];

// Restore saved language on web (localStorage) or fall back to device language
let _savedLang = null;
try { _savedLang = typeof localStorage !== 'undefined' ? localStorage.getItem('sb_language') : null; } catch {}

i18n.use(initReactI18next).init({
  resources,
  lng: _savedLang || undefined,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export function applyRTL(langCode) {
  const shouldBeRTL = RTL_LANGUAGES.includes(langCode);
  if (I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.forceRTL(shouldBeRTL);
    I18nManager.allowRTL(shouldBeRTL);
    return true; // restart needed
  }
  return false;
}

export const isRTL = () => I18nManager.isRTL;
export default i18n;
