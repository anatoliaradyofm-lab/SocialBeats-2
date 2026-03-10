import React, { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function PulseIcon({ name, size = 24, color = '#FFF', duration = 1500 }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.25, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={{ transform: [{ scale }] }}><Ionicons name={name} size={size} color={color} /></Animated.View>;
}

export function BounceIcon({ name, size = 24, color = '#FFF', duration = 800 }) {
  const translateY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(translateY, { toValue: -6, duration: duration / 2, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: duration / 2, easing: Easing.bounce, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={{ transform: [{ translateY }] }}><Ionicons name={name} size={size} color={color} /></Animated.View>;
}

export function SpinIcon({ name, size = 24, color = '#FFF', duration = 2000 }) {
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.timing(rotation, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true })).start();
  }, []);
  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return <Animated.View style={{ transform: [{ rotate: spin }] }}><Ionicons name={name} size={size} color={color} /></Animated.View>;
}

export function ShakeIcon({ name, size = 24, color = '#FFF', active = false }) {
  const translateX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (active) {
      Animated.sequence([
        Animated.timing(translateX, { toValue: -4, duration: 50, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 4, duration: 80, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -3, duration: 60, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 3, duration: 60, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 40, useNativeDriver: true }),
      ]).start();
    }
  }, [active]);
  return <Animated.View style={{ transform: [{ translateX }] }}><Ionicons name={name} size={size} color={color} /></Animated.View>;
}

export function HeartbeatIcon({ name, size = 24, color = '#EF4444', duration = 1200 }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.2, duration: duration * 0.15, easing: Easing.ease, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: duration * 0.1, easing: Easing.ease, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1.15, duration: duration * 0.12, easing: Easing.ease, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: duration * 0.63, easing: Easing.ease, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={{ transform: [{ scale }] }}><Ionicons name={name} size={size} color={color} /></Animated.View>;
}
