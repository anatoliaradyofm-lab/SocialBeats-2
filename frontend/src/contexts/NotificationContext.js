import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { AppState, Platform, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import api from '../services/api';

const NotificationContext = createContext(null);

const BADGE_KEY = '@notif_badge_count';
const POPUP_DURATION = 4000;

export function NotificationProvider({ children }) {
  const { token, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [popup, setPopup] = useState(null);
  const [expoPushToken, setExpoPushToken] = useState(null);
  const popupTimer = useRef(null);
  const appState = useRef(AppState.currentState);

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/notifications', token);
      const count = res?.unread_count ?? (res?.notifications || []).filter(n => !n.read).length;
      setUnreadCount(count);
      AsyncStorage.setItem(BADGE_KEY, String(count)).catch(() => {});
      setBadgeCount(count);
    } catch {}
  }, [token]);

  const setBadgeCount = async (count) => {
    try {
      const Notifications = await getExpoNotifications();
      if (Notifications?.setBadgeCountAsync) {
        await Notifications.setBadgeCountAsync(count);
      }
    } catch {}
  };

  const getExpoNotifications = async () => {
    try {
      return require('expo-notifications');
    } catch {
      return null;
    }
  };

  const registerPushToken = useCallback(async () => {
    if (!token || !user) return;
    try {
      const Notifications = await getExpoNotifications();
      if (!Notifications) return;

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const pushToken = tokenData?.data;
      if (!pushToken) return;

      setExpoPushToken(pushToken);
      await api.post('/notifications/register-token', {
        expo_token: pushToken,
        platform: Platform.OS,
        device_name: `${Platform.OS}_${user.id}`,
      }, token);

      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
          name: 'Varsayılan',
          importance: Notifications.AndroidImportance?.MAX || 4,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#7C3AED',
        });
      }
    } catch {}
  }, [token, user]);

  useEffect(() => {
    if (token && user) {
      registerPushToken();
      fetchUnreadCount();
    }
  }, [token, user, registerPushToken, fetchUnreadCount]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        fetchUnreadCount();
      }
      appState.current = nextState;
    });
    return () => sub?.remove();
  }, [fetchUnreadCount]);

  useEffect(() => {
    let interval;
    if (token) {
      interval = setInterval(fetchUnreadCount, 30000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [token, fetchUnreadCount]);

  useEffect(() => {
    const setupListeners = async () => {
      try {
        const Notifications = await getExpoNotifications();
        if (!Notifications) return;

        const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
          fetchUnreadCount();
          const content = notification?.request?.content;
          if (content) {
            showPopup({
              title: content.title || '',
              body: content.body || '',
              data: content.data || {},
            });
          }
        });

        const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response?.notification?.request?.content?.data || {};
          if (data.navigate) {
            // Navigation handled by the app
          }
        });

        return () => {
          Notifications.removeNotificationSubscription(receivedSub);
          Notifications.removeNotificationSubscription(responseSub);
        };
      } catch {}
    };
    setupListeners();
  }, [fetchUnreadCount]);

  const showPopup = useCallback((notif) => {
    if (popupTimer.current) clearTimeout(popupTimer.current);
    setPopup(notif);
    try { Vibration.vibrate(100); } catch {}
    popupTimer.current = setTimeout(() => setPopup(null), POPUP_DURATION);
  }, []);

  const dismissPopup = useCallback(() => {
    if (popupTimer.current) clearTimeout(popupTimer.current);
    setPopup(null);
  }, []);

  const scheduleLocalNotification = useCallback(async (title, body, triggerSeconds = 1, data = {}) => {
    try {
      const Notifications = await getExpoNotifications();
      if (!Notifications) return;

      await Notifications.scheduleNotificationAsync({
        content: { title, body, data, sound: 'default' },
        trigger: triggerSeconds > 0 ? { seconds: triggerSeconds } : null,
      });
    } catch {}
  }, []);

  const markAsRead = useCallback(async (id) => {
    try {
      await api.post(`/notifications/${id}/read`, {}, token);
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  }, [token]);

  const markAllRead = useCallback(async () => {
    try {
      await api.post('/notifications/read-all', {}, token);
      setUnreadCount(0);
      setBadgeCount(0);
    } catch {}
  }, [token]);

  return (
    <NotificationContext.Provider value={{
      unreadCount,
      popup,
      expoPushToken,
      fetchUnreadCount,
      showPopup,
      dismissPopup,
      scheduleLocalNotification,
      markAsRead,
      markAllRead,
      registerPushToken,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) return {
    unreadCount: 0, popup: null, expoPushToken: null,
    fetchUnreadCount: () => {}, showPopup: () => {}, dismissPopup: () => {},
    scheduleLocalNotification: () => {}, markAsRead: () => {}, markAllRead: () => {},
    registerPushToken: () => {},
  };
  return ctx;
}
