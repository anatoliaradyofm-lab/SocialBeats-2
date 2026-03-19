// expo-secure-store → localStorage fallback on web
export const getItemAsync    = (key) => Promise.resolve(localStorage.getItem(key));
export const setItemAsync    = (key, val) => { localStorage.setItem(key, val); return Promise.resolve(); };
export const deleteItemAsync = (key) => { localStorage.removeItem(key); return Promise.resolve(); };
