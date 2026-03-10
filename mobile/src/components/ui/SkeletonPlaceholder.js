/**
 * SkeletonPlaceholder - Loading skeleton (içerik yüklenirken pulse animasyonu)
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export function SkeletonBox({ width, height, borderRadius = 8, style }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width || '100%', height: height || 20, borderRadius, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonTrackRow() {
  return (
    <View style={styles.trackRow}>
      <SkeletonBox width={24} height={24} borderRadius={4} />
      <SkeletonBox width={48} height={48} borderRadius={8} />
      <View style={styles.trackInfo}>
        <SkeletonBox width="80%" height={16} style={{ marginBottom: 8 }} />
        <SkeletonBox width="60%" height={12} />
      </View>
    </View>
  );
}

export function SkeletonPostCard() {
  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <SkeletonBox width={40} height={40} borderRadius={20} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <SkeletonBox width="40%" height={14} style={{ marginBottom: 6 }} />
          <SkeletonBox width="60%" height={12} />
        </View>
      </View>
      <SkeletonBox height={80} style={{ marginTop: 12 }} />
    </View>
  );
}

export function SkeletonPlaylistGrid() {
  return (
    <View style={styles.grid}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.gridItem}>
          <SkeletonBox width={120} height={120} borderRadius={8} />
          <SkeletonBox width={80} height={14} style={{ marginTop: 8 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: { backgroundColor: '#374151' },
  trackRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  trackInfo: { flex: 1 },
  postCard: { padding: 16, marginBottom: 16, backgroundColor: '#1a1a1a', borderRadius: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  gridItem: { width: '47%' },
});
