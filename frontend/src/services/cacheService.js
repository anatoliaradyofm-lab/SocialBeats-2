import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@cache_';
const DEFAULT_TTL = 5 * 60 * 1000;
const AUTO_CLEAN_KEY = '@last_auto_clean';
const AUTO_CLEAN_INTERVAL = 30 * 24 * 60 * 60 * 1000;

export const cacheService = {
  async get(key) {
    try {
      const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const { data, expiry } = JSON.parse(raw);
      if (expiry && Date.now() > expiry) {
        await AsyncStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }
      return data;
    } catch { return null; }
  },

  async set(key, data, ttl = DEFAULT_TTL) {
    try {
      await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, expiry: Date.now() + ttl }));
    } catch {}
  },

  async remove(key) {
    try { await AsyncStorage.removeItem(CACHE_PREFIX + key); } catch {}
  },

  async clear() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
      if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
    } catch {}
  },

  async clearExpired() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
      const toRemove = [];
      for (const key of cacheKeys) {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          try {
            const { expiry } = JSON.parse(raw);
            if (expiry && Date.now() > expiry) toRemove.push(key);
          } catch { toRemove.push(key); }
        }
      }
      if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
      return toRemove.length;
    } catch { return 0; }
  },

  async getStorageSize() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let total = 0;
      for (const key of keys) {
        const val = await AsyncStorage.getItem(key);
        if (val) total += val.length * 2;
      }
      return total;
    } catch { return 0; }
  },

  async getStorageBreakdown() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const categories = {
        cache: { size: 0, count: 0 },
        auth: { size: 0, count: 0 },
        settings: { size: 0, count: 0 },
        search: { size: 0, count: 0 },
        other: { size: 0, count: 0 },
      };
      let total = 0;
      for (const key of keys) {
        const val = await AsyncStorage.getItem(key);
        const size = val ? val.length * 2 : 0;
        total += size;

        if (key.startsWith(CACHE_PREFIX)) {
          categories.cache.size += size;
          categories.cache.count++;
        } else if (key.includes('token') || key.includes('auth') || key.includes('user')) {
          categories.auth.size += size;
          categories.auth.count++;
        } else if (key.includes('settings') || key.includes('theme') || key.includes('language')) {
          categories.settings.size += size;
          categories.settings.count++;
        } else if (key.includes('search') || key.includes('history')) {
          categories.search.size += size;
          categories.search.count++;
        } else {
          categories.other.size += size;
          categories.other.count++;
        }
      }
      return { total, totalKeys: keys.length, categories };
    } catch { return { total: 0, totalKeys: 0, categories: {} }; }
  },

  async autoCleanIfNeeded() {
    try {
      const last = await AsyncStorage.getItem(AUTO_CLEAN_KEY);
      const lastTime = last ? parseInt(last, 10) : 0;
      if (Date.now() - lastTime > AUTO_CLEAN_INTERVAL) {
        const cleaned = await this.clearExpired();
        await AsyncStorage.setItem(AUTO_CLEAN_KEY, String(Date.now()));
        return cleaned;
      }
      return 0;
    } catch { return 0; }
  },
};

export default cacheService;
