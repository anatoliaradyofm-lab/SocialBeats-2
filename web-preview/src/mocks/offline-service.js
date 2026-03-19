// offlineService mock for web preview
export const cacheData    = () => Promise.resolve();
export const getCachedData = () => Promise.resolve(null);
export const isOnline     = () => true;
export const useNetworkStatus = () => ({ isOnline: true });
export const onNetworkChange  = () => () => {};
export const addOnlineListener = () => () => {};
