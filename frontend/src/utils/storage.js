/**
 * Unified storage - MMKV (fast) with AsyncStorage fallback
 * MMKV: ~10x faster, synchronous, encryptable
 */
import { Platform } from 'react-native';

let storage = null;
let useMMKV = false;

try {
  const { MMKV } = require('react-native-mmkv');
  storage = new MMKV({ id: 'socialbeats-storage' });
  useMMKV = true;
} catch (e) {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  storage = AsyncStorage;
}

export const isMMKV = () => useMMKV;

export async function getItem(key) {
  if (useMMKV) {
    try {
      return storage.getString(key) ?? null;
    } catch {
      return null;
    }
  }
  return storage.getItem(key);
}

export async function setItem(key, value) {
  if (useMMKV) {
    try {
      storage.set(key, String(value));
    } catch (_) {}
    return;
  }
  await storage.setItem(key, String(value));
}

export async function removeItem(key) {
  if (useMMKV) {
    storage.delete(key);
    return;
  }
  await storage.removeItem(key);
}

export async function getObject(key) {
  const raw = await getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function setObject(key, obj) {
  await setItem(key, JSON.stringify(obj));
}
