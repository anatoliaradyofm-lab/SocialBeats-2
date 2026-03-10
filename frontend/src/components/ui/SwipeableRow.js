import React, { useRef } from 'react';
import { View, Text, Animated, PanResponder, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import haptic from '../../utils/haptics';

const ACTION_WIDTH = 80;

export default function SwipeableRow({ children, leftActions = [], rightActions = [], onSwipeLeft, onSwipeRight }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const triggered = useRef(false);

  const totalLeft = leftActions.length * ACTION_WIDTH;
  const totalRight = rightActions.length * ACTION_WIDTH;

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dy) < 20,
    onPanResponderMove: (_, g) => {
      const clamp = Math.max(-totalRight, Math.min(totalLeft, g.dx));
      translateX.setValue(clamp);
      if (Math.abs(clamp) > ACTION_WIDTH * 0.5 && !triggered.current) {
        triggered.current = true;
        haptic.light();
      }
    },
    onPanResponderRelease: (_, g) => {
      triggered.current = false;
      if (g.dx > totalLeft * 0.5 && leftActions.length) {
        Animated.spring(translateX, { toValue: totalLeft, useNativeDriver: true, tension: 80, friction: 10 }).start();
      } else if (g.dx < -totalRight * 0.5 && rightActions.length) {
        Animated.spring(translateX, { toValue: -totalRight, useNativeDriver: true, tension: 80, friction: 10 }).start();
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
      }
    },
  })).current;

  const close = () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();

  return (
    <View style={styles.container}>
      <View style={[styles.actions, styles.actionsLeft]}>
        {leftActions.map((a, i) => (
          <TouchableOpacity key={i} style={[styles.action, { backgroundColor: a.color || '#10B981', width: ACTION_WIDTH }]}
            onPress={() => { a.onPress?.(); close(); }}>
            <Ionicons name={a.icon || 'checkmark'} size={22} color="#FFF" />
            {a.label && <Text style={styles.actionLabel}>{a.label}</Text>}
          </TouchableOpacity>
        ))}
      </View>
      <View style={[styles.actions, styles.actionsRight]}>
        {rightActions.map((a, i) => (
          <TouchableOpacity key={i} style={[styles.action, { backgroundColor: a.color || '#EF4444', width: ACTION_WIDTH }]}
            onPress={() => { a.onPress?.(); close(); }}>
            <Ionicons name={a.icon || 'trash'} size={22} color="#FFF" />
            {a.label && <Text style={styles.actionLabel}>{a.label}</Text>}
          </TouchableOpacity>
        ))}
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  actions: { position: 'absolute', top: 0, bottom: 0, flexDirection: 'row' },
  actionsLeft: { left: 0 },
  actionsRight: { right: 0 },
  action: { justifyContent: 'center', alignItems: 'center' },
  actionLabel: { color: '#FFF', fontSize: 10, fontWeight: '600', marginTop: 3 },
});
