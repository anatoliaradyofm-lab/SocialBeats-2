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

export const SUPPORTED_LANGUAGES = [
  { code: 'tr', name: 'Türkçe' },
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
  { code: 'ar', name: 'العربية' },
  { code: 'ru', name: 'Русский' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'pt', name: 'Português' },
  { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'el', name: 'Ελληνικά' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'fil', name: 'Filipino' },
  { code: 'th', name: 'ไทย' },
  { code: 'ur', name: 'اردو' },
  { code: 'ms', name: 'Bahasa Melayu' },
  { code: 'uk', name: 'Українська' },
  { code: 'zh-TW', name: '繁體中文 (台灣)' },
  { code: 'af', name: 'Afrikaans' },
];

const resources = {
  en: { translation: en },
  tr: { translation: tr },
  de: { translation: de },
  fr: { translation: fr },
  es: { translation: es },
  it: { translation: it },
  ar: { translation: ar },
  ru: { translation: ru },
  zh: { translation: zh },
  ja: { translation: ja },
  ko: { translation: ko },
  pt: { translation: pt },
  'pt-BR': { translation: ptBR },
  nl: { translation: nl },
  pl: { translation: pl },
  el: { translation: el },
  hi: { translation: hi },
  id: { translation: id },
  vi: { translation: vi },
  fil: { translation: fil },
  th: { translation: th },
  ur: { translation: ur },
  ms: { translation: ms },
  uk: { translation: uk },
  'zh-TW': { translation: zhTW },
  af: { translation: af },
};

export const RTL_LANGUAGES = ['ar', 'ur'];

i18n.use(initReactI18next).init({
  resources,
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
