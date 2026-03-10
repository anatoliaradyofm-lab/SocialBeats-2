import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Animated, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../contexts/ThemeContext';

const { width: SW } = Dimensions.get('window');

export default function Tooltip({ id, text, children, position = 'bottom', showOnce = true }) {
  const { colors } = useTheme();
  const [show, setShow] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (!showOnce || !id) { setShow(true); return; }
    AsyncStorage.getItem(`@tooltip_${id}`).then(v => {
      if (!v) {
        setShow(true);
        AsyncStorage.setItem(`@tooltip_${id}`, '1').catch(() => {});
      }
    }).catch(() => setShow(true));
  }, [id, showOnce]);

  useEffect(() => {
    if (show) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, delay: 500, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, delay: 500, useNativeDriver: true, tension: 100, friction: 8 }),
      ]).start(() => {
        setTimeout(() => dismiss(), 4000);
      });
    }
  }, [show]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.8, duration: 200, useNativeDriver: true }),
    ]).start(() => setShow(false));
  };

  const posStyle = position === 'top' ? { bottom: '105%' } : position === 'left' ? { right: '105%', top: 0 } : position === 'right' ? { left: '105%', top: 0 } : { top: '105%' };

  return (
    <View>
      {children}
      {show && (
        <Animated.View style={[styles.tooltip, posStyle, { backgroundColor: colors.card, borderColor: colors.border, opacity, transform: [{ scale }] }]}>
          <TouchableOpacity onPress={dismiss} activeOpacity={0.8}>
            <Text style={[styles.text, { color: colors.text }]}>{text}</Text>
          </TouchableOpacity>
          <View style={[styles.arrow, position === 'top' ? styles.arrowDown : styles.arrowUp, { borderTopColor: colors.card, borderBottomColor: colors.card }]} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tooltip: { position: 'absolute', zIndex: 999, minWidth: 120, maxWidth: SW * 0.7, borderRadius: 10, borderWidth: 0.5, padding: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 10 },
  text: { fontSize: 12, lineHeight: 17 },
  arrow: { position: 'absolute', alignSelf: 'center' },
  arrowUp: { top: -6, width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  arrowDown: { bottom: -6, width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
});
