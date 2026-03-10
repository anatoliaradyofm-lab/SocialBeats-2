import React, { useRef, useEffect } from 'react';
import { Animated, StyleSheet } from 'react-native';

export function FadeIn({ children, duration = 400, delay = 0, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration, delay, useNativeDriver: true }).start();
  }, []);
  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}

export function FadeInUp({ children, duration = 500, delay = 0, distance = 20, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration, delay, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay, useNativeDriver: true, tension: 60, friction: 10 }),
    ]).start();
  }, []);
  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

export function SlideInRight({ children, duration = 400, delay = 0, distance = 50, style }) {
  const translateX = useRef(new Animated.Value(distance)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, { toValue: 0, delay, useNativeDriver: true, tension: 60, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: duration * 0.6, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={[style, { opacity, transform: [{ translateX }] }]}>{children}</Animated.View>;
}

export function SlideInLeft({ children, duration = 400, delay = 0, distance = 50, style }) {
  const translateX = useRef(new Animated.Value(-distance)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, { toValue: 0, delay, useNativeDriver: true, tension: 60, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: duration * 0.6, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={[style, { opacity, transform: [{ translateX }] }]}>{children}</Animated.View>;
}

export function ScaleIn({ children, duration = 400, delay = 0, style }) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, delay, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>{children}</Animated.View>;
}

export function PulseView({ children, style, minOpacity = 0.4, duration = 1200 }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: minOpacity, duration, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}

export function StaggeredList({ children, stagger = 80 }) {
  return React.Children.map(children, (child, i) => (
    <FadeInUp delay={i * stagger} distance={15}>{child}</FadeInUp>
  ));
}
