import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

export default function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

export function PostSkeleton() {
  return (
    <View style={styles.postSkeleton}>
      <View style={styles.postSkeletonHeader}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width={120} height={14} />
          <Skeleton width={80} height={10} />
        </View>
      </View>
      <Skeleton width="100%" height={14} style={{ marginBottom: 8 }} />
      <Skeleton width="80%" height={14} style={{ marginBottom: 12 }} />
      <Skeleton width="100%" height={180} borderRadius={12} />
    </View>
  );
}

export function TrackSkeleton() {
  return (
    <View style={styles.trackSkeleton}>
      <Skeleton width={48} height={48} borderRadius={8} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width={160} height={14} />
        <Skeleton width={100} height={12} />
      </View>
    </View>
  );
}

export function UserSkeleton() {
  return (
    <View style={styles.userSkeleton}>
      <Skeleton width={44} height={44} borderRadius={22} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width={120} height={14} />
        <Skeleton width={80} height={12} />
      </View>
      <Skeleton width={70} height={32} borderRadius={8} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: { backgroundColor: '#374151' },
  postSkeleton: { backgroundColor: '#1F2937', borderRadius: 12, padding: 16, marginBottom: 16 },
  postSkeletonHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  trackSkeleton: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  userSkeleton: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
});
