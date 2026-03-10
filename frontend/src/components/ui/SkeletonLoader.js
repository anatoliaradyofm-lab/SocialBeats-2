import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, useColorScheme } from 'react-native';

export default function SkeletonLoader({ width = '100%', height = 16, borderRadius = 8, style }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  const scheme = useColorScheme();
  const bgColor = scheme === 'light' ? '#E4E4E7' : '#3F3F46';

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View style={[{ width, height, borderRadius, backgroundColor: bgColor, opacity }, style]} />
  );
}

export function SkeletonCard({ style }) {
  return (
    <View style={[styles.card, style]}>
      <SkeletonLoader width={60} height={60} borderRadius={12} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonLoader height={14} width="80%" />
        <SkeletonLoader height={10} width="50%" />
      </View>
    </View>
  );
}

export function SkeletonList({ count = 4, style }) {
  return (
    <View style={style}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} style={{ marginBottom: 12 }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
});
