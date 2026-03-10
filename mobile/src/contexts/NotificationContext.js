/**
 * NotificationContext - Okunmamış bildirim sayısı ve yenileme
 * Tab bar badge ve bildirim merkezi için kullanılır.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!token) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await api.get('/notifications?limit=1&offset=0', token);
      setUnreadCount(res?.unread_count ?? 0);
    } catch {
      setUnreadCount(0);
    }
  }, [token]);

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 60000); // her 1 dk
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) return { unreadCount: 0, refreshUnreadCount: () => {} };
  return ctx;
}
