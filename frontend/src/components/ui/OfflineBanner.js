import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import networkService from '../../services/networkService';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const slideAnim = useState(new Animated.Value(-40))[0];

  useEffect(() => {
    const unsub = networkService.onChange((connected) => {
      setIsOffline(!connected);
      Animated.timing(slideAnim, {
        toValue: connected ? -40 : 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
    const stopMonitor = networkService.startMonitoring();
    return () => { unsub(); stopMonitor(); };
  }, []);

  if (!isOffline) return null;

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
      <Ionicons name="cloud-offline" size={16} color="#FFF" />
      <Text style={styles.text}>Çevrimdışı - İnternet bağlantısı yok</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', top: 44, left: 16, right: 16, backgroundColor: '#EF4444', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 999, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  text: { color: '#FFF', fontSize: 12, fontWeight: '600' },
});
