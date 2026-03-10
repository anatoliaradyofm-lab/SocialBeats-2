import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import tr from './locales/tr.json';
import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import ar from './locales/ar.json';
import ru from './locales/ru.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import pt from './locales/pt.json';
import it from './locales/it.json';
import zh from './locales/zh.json';
import hi from './locales/hi.json';
import id from './locales/id.json';
import vi from './locales/vi.json';
import th from './locales/th.json';
import fil from './locales/fil.json';
import ur from './locales/ur.json';
import ms from './locales/ms.json';
import pl from './locales/pl.json';
import bn from './locales/bn.json';
import ta from './locales/ta.json';
import te from './locales/te.json';
import af from './locales/af.json';
import zu from './locales/zu.json';
import ha from './locales/ha.json';
import yo from './locales/yo.json';
import nl from './locales/nl.json';
import uk from './locales/uk.json';

const LANG_STORAGE_KEY = '@app_language';

const resources = {
  tr: { translation: tr },
  en: { translation: en },
  de: { translation: de },
  fr: { translation: fr },
  es: { translation: es },
  ar: { translation: ar },
  ru: { translation: ru },
  ja: { translation: ja },
  ko: { translation: ko },
  pt: { translation: pt },
  it: { translation: it },
  zh: { translation: zh },
  hi: { translation: hi },
  id: { translation: id },
  vi: { translation: vi },
  th: { translation: th },
  fil: { translation: fil },
  ur: { translation: ur },
  ms: { translation: ms },
  pl: { translation: pl },
  bn: { translation: bn },
  ta: { translation: ta },
  te: { translation: te },
  af: { translation: af },
  zu: { translation: zu },
  ha: { translation: ha },
  yo: { translation: yo },
  nl: { translation: nl },
  uk: { translation: uk },
};

const languageDetector = {
  type: 'languageDetector',
  async: true,
  detect: async (callback) => {
    try {
      const stored = await AsyncStorage.getItem(LANG_STORAGE_KEY);
      if (stored && resources[stored]) {
        callback(stored);
        return;
      }
    } catch {}
    const deviceLang = Localization.getLocales()?.[0]?.languageCode || 'en';
    const supported = Object.keys(resources);
    callback(supported.includes(deviceLang) ? deviceLang : 'en');
  },
  init: () => {},
  cacheUserLanguage: async (lang) => {
    try { await AsyncStorage.setItem(LANG_STORAGE_KEY, lang); } catch {}
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    compatibilityJSON: 'v3',
  });

export default i18n;
