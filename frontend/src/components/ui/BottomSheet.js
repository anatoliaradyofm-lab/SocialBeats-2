import React, { useRef, useEffect } from 'react';
import { View, Modal, Animated, TouchableOpacity, StyleSheet, Dimensions, PanResponder, Platform } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

const { height: SH } = Dimensions.get('window');

export default function BottomSheet({ visible, onClose, children, height = 0.5, showHandle = true }) {
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(SH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetHeight = typeof height === 'number' && height <= 1 ? SH * height : height;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: SH, duration: 250, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
    onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > sheetHeight * 0.3 || g.vy > 0.8) onClose();
      else Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    },
  })).current;

  if (!visible) return null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[styles.sheet, { height: sheetHeight, backgroundColor: colors.surface, transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          {showHandle && <View style={[styles.handle, { backgroundColor: colors.border }]} />}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 8, overflow: 'hidden' },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
});
