import React, { useRef, useEffect, useState } from 'react';
import { Animated, View, StyleSheet, Easing } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

export default function AdTransition({ visible, children, type = 'fade', duration = 600, onDismiss }) {
  const { colors } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else {
      Animated.timing(progress, { toValue: 0, duration: duration * 0.6, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (finished) { setMounted(false); onDismiss?.(); }
      });
    }
  }, [visible]);

  if (!mounted) return null;

  const animStyles = {
    fade: { opacity: progress },
    slideUp: {
      opacity: progress,
      transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }],
    },
    scaleCenter: {
      opacity: progress,
      transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
    },
    slideRight: {
      opacity: progress,
      transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [200, 0] }) }],
    },
  };

  return (
    <Animated.View style={[styles.container, animStyles[type] || animStyles.fade]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
});
