import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { View, Text, Animated, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ICONS = { success: 'checkmark-circle', error: 'alert-circle', info: 'information-circle', warning: 'warning' };
const BG = { success: '#059669', error: '#DC2626', info: '#2563EB', warning: '#D97706' };

const ToastContext = createContext({ show: () => {} });

export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  const current = queue[0] || null;

  useEffect(() => {
    if (!current) return;
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    timer.current = setTimeout(() => dismiss(), current.duration || 3000);
    return () => clearTimeout(timer.current);
  }, [current]);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -100, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setQueue(q => q.slice(1)));
  }, []);

  const show = useCallback((message, type = 'info', duration = 3000) => {
    setQueue(q => [...q, { message, type, duration, id: Date.now() }]);
  }, []);

  return (
    <ToastContext.Provider value={{ show, success: (m, d) => show(m, 'success', d), error: (m, d) => show(m, 'error', d), info: (m, d) => show(m, 'info', d), warning: (m, d) => show(m, 'warning', d) }}>
      {children}
      {current && (
        <Animated.View style={[styles.toast, { backgroundColor: BG[current.type] || BG.info, transform: [{ translateY }], opacity }]} pointerEvents="box-none">
          <TouchableOpacity style={styles.inner} onPress={dismiss} activeOpacity={0.8}>
            <Ionicons name={ICONS[current.type] || ICONS.info} size={20} color="#FFF" />
            <Text style={styles.text} numberOfLines={2}>{current.message}</Text>
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 40, left: 16, right: 16, borderRadius: 14, zIndex: 9999, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  inner: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  text: { flex: 1, color: '#FFF', fontSize: 14, fontWeight: '500', lineHeight: 19 },
});
