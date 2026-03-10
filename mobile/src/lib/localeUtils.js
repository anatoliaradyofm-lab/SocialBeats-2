import i18n from '../i18n';

const LOCALE_MAP = {
  tr: 'tr-TR', en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES',
  ar: 'ar-SA', ru: 'ru-RU', ja: 'ja-JP', ko: 'ko-KR', zh: 'zh-CN',
  hi: 'hi-IN', 'pt-BR': 'pt-BR', pt: 'pt-PT', id: 'id-ID', vi: 'vi-VN',
  fil: 'fil-PH', th: 'th-TH', ur: 'ur-PK', ms: 'ms-MY', it: 'it-IT', pl: 'pl-PL',
};

export function getFullLocale() {
  return LOCALE_MAP[i18n.language] || 'en-US';
}

export function formatDate(date, options) {
  return new Date(date).toLocaleDateString(getFullLocale(), options);
}

export function formatTime(date, options) {
  return new Date(date).toLocaleTimeString(getFullLocale(), options);
}
