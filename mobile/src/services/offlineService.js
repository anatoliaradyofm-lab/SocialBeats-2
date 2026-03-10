/**
 * Offline Service - Network detection and data caching for SocialBeats
 * Uses expo-network for connectivity checks and AsyncStorage for caching.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@offline_cache:';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let _isOnline = true;
const _listeners = new Set();
const _onOnlineListeners = new Set();

function notifyListeners() {
  _listeners.forEach((fn) => fn(_isOnline));
}

function notifyOnOnline() {
  _onOnlineListeners.forEach((fn) => fn());
}

async function checkNetwork() {
  try {
    const state = await Network.getNetworkStateAsync();
    const nowOnline = !!(state.isConnected && state.isInternetReachable !== false);
    const wasOffline = !_isOnline;
    if (wasOffline && nowOnline) {
      notifyOnOnline();
    }
    _isOnline = nowOnline;
  } catch {
    _isOnline = true;
  }
  notifyListeners();
  return _isOnline;
}

// Initial check
checkNetwork();

export function isOnline() {
  return _isOnline;
}

export async function cacheData(key, data) {
  try {
    const payload = JSON.stringify({ data, timestamp: Date.now() });
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, payload);
  } catch (err) {
    console.warn('offlineService.cacheData error:', err);
  }
}

export async function getCachedData(key) {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL_MS) {
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function clearCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) await AsyncStorage.multiRemove(cacheKeys);
  } catch (err) {
    console.warn('offlineService.clearCache error:', err);
  }
}

/**
 * React hook that tracks online/offline status.
 * Polls every 10 seconds and provides real-time updates.
 */
export function useNetworkStatus() {
  const [online, setOnline] = useState(_isOnline);
  const intervalRef = useRef(null);

  useEffect(() => {
    const handler = (status) => setOnline(status);
    _listeners.add(handler);

    checkNetwork();

    intervalRef.current = setInterval(checkNetwork, 10000);

    return () => {
      _listeners.delete(handler);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const refresh = useCallback(() => checkNetwork(), []);

  return { isOnline: online, refresh };
}

/**
 * Offline Action Queue - stores POST/PUT/DELETE when offline and replays when online.
 */
class OfflineQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  async init() {
    try {
      const saved = await AsyncStorage.getItem('offline_queue');
      if (saved) this.queue = JSON.parse(saved);
    } catch {}
  }

  async enqueue(action) {
    this.queue.push({
      id: Date.now().toString(),
      ...action,
      timestamp: new Date().toISOString(),
    });
    await this._save();
  }

  async _save() {
    try {
      await AsyncStorage.setItem('offline_queue', JSON.stringify(this.queue));
    } catch {}
  }

  async processQueue(apiInstance) {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    const failed = [];
    for (const action of this.queue) {
      try {
        if (action.method === 'POST') {
          await apiInstance.post(action.url, action.body, action.token);
        } else if (action.method === 'PUT') {
          await apiInstance.put(action.url, action.body, action.token);
        } else if (action.method === 'DELETE') {
          await apiInstance.delete(action.url, action.token);
        }
      } catch {
        failed.push(action);
      }
    }

    this.queue = failed;
    await this._save();
    this.processing = false;
  }

  getQueueLength() {
    return this.queue.length;
  }
}

const offlineQueue = new OfflineQueue();
offlineQueue.init();

let _apiRef = null;

export function setApiRef(api) {
  _apiRef = api;
}

export function getOfflineQueue() {
  return offlineQueue;
}

export { OfflineQueue };

export function registerOnOnline(callback) {
  _onOnlineListeners.add(callback);
  return () => _onOnlineListeners.delete(callback);
}

async function _handleOnlineTransition() {
  if (_apiRef && offlineQueue.getQueueLength() > 0) {
    await offlineQueue.processQueue(_apiRef);
  }
}

registerOnOnline(_handleOnlineTransition);

export default {
  isOnline,
  cacheData,
  getCachedData,
  clearCache,
  useNetworkStatus,
  OfflineQueue,
  offlineQueue,
  setApiRef,
  getOfflineQueue,
  registerOnOnline,
};
