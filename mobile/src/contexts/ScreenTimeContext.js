/**
 * ScreenTimeContext - Uygulama kullanım süresi takibi (AppState ile)
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@screen_time';
const DAY_MS = 24 * 60 * 60 * 1000;

const ScreenTimeContext = createContext(null);

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function ScreenTimeProvider({ children }) {
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [weeklyData, setWeeklyData] = useState([]);
  const appState = useRef(AppState.currentState);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const load = async () => {
      try {
        const key = todayKey();
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const data = raw ? JSON.parse(raw) : {};
        setTodaySeconds(data[key] || 0);
        const week = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const k = d.toISOString().slice(0, 10);
          week.push({ date: k, seconds: data[k] || 0 });
        }
        setWeeklyData(week);
      } catch {
        setTodaySeconds(0);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const now = Date.now();
      const key = todayKey();
      if (appState.current === 'active' && nextState !== 'active') {
        const elapsed = Math.round((now - startRef.current) / 1000);
        const save = async () => {
          try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY);
            const data = raw ? JSON.parse(raw) : {};
            data[key] = (data[key] || 0) + elapsed;
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            setTodaySeconds(data[key]);
            const week = [];
            for (let i = 6; i >= 0; i--) {
              const d = new Date();
              d.setDate(d.getDate() - i);
              const k = d.toISOString().slice(0, 10);
              week.push({ date: k, seconds: data[k] || 0 });
            }
            setWeeklyData(week);
          } catch {}
        };
        save();
      } else if (nextState === 'active') {
        startRef.current = Date.now();
      }
      appState.current = nextState;
    });
    return () => sub?.remove?.();
  }, []);

  const value = { todaySeconds, weeklyData };
  return <ScreenTimeContext.Provider value={value}>{children}</ScreenTimeContext.Provider>;
}

export function useScreenTime() {
  const ctx = useContext(ScreenTimeContext);
  return ctx || { todaySeconds: 0, weeklyData: [] };
}
