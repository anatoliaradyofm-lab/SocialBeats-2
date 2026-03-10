/**
 * useAdFreeStatus - Merkezi reklamsız süre yönetimi
 * TÜM reklam bileşenleri bu hook'u kullanarak reklamsız süre aktifse hiç reklam GÖSTERMESİN
 */
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'adFreeUntil';

export function setAdFreeUntilStorage(minutes) {
  const until = Date.now() + minutes * 60 * 1000;
  return AsyncStorage.setItem(STORAGE_KEY, String(until));
}

export async function getAdFreeUntil() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? parseInt(raw, 10) : 0;
  } catch {
    return 0;
  }
}

export async function isAdFreeActive() {
  const until = await getAdFreeUntil();
  return Date.now() < until;
}

export default function useAdFreeStatus(pollIntervalMs = 5000) {
  const [adFreeUntil, setAdFreeUntilState] = useState(0);
  const [minutesLeft, setMinutesLeft] = useState(0);
  const isAdFree = Date.now() < adFreeUntil;

  const refresh = useCallback(async () => {
    const until = await getAdFreeUntil();
    setAdFreeUntilState(until);
    const now = Date.now();
    if (now < until) {
      setMinutesLeft(Math.max(0, Math.ceil((until - now) / 60000)));
    } else {
      setMinutesLeft(0);
      if (until > 0) AsyncStorage.setItem(STORAGE_KEY, '0');
    }
  }, []);

  const setAdFree = useCallback(async (minutes) => {
    await setAdFreeUntilStorage(minutes);
    setAdFreeUntilState(Date.now() + minutes * 60 * 1000);
    setMinutesLeft(minutes);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(id);
  }, [refresh, pollIntervalMs]);

  return {
    isAdFree,
    minutesLeft,
    setAdFree,
    refresh,
  };
}
