/**
 * OfflineBanner - Displays a warning banner when the device is offline.
 * Auto-hides when connectivity is restored.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '../services/offlineService';

export default function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOnline ? -80 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOnline, slideAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingTop: insets.top + 4, transform: [{ translateY: slideAnim }] },
      ]}
      pointerEvents="none"
    >
      <View style={styles.inner}>
        <Ionicons name="cloud-offline-outline" size={18} color="#78350F" />
        <Text style={styles.text}>
          {t('offline.message')}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#F59E0B',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    color: '#78350F',
    fontSize: 13,
    fontWeight: '600',
  },
});
