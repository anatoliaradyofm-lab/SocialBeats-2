// localeUtils mock
export const getFullLocale = () => 'en-US';
export const formatDate = (date, opts) => new Date(date).toLocaleDateString('en-US', opts);
export const formatTime = (date, opts) => new Date(date).toLocaleTimeString('en-US', opts);
