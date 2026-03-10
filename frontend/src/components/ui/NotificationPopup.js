import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../../contexts/NotificationContext';
import { useTheme, BRAND } from '../../contexts/ThemeContext';

const { width: SW } = Dimensions.get('window');

const TYPE_ICONS = {
  like: { name: 'heart', color: BRAND.pink },
  comment: { name: 'chatbubble', color: BRAND.accent },
  follow: { name: 'person-add', color: BRAND.primary },
  message: { name: 'mail', color: '#10B981' },
  mention: { name: 'at', color: '#F59E0B' },
  story_reply: { name: 'chatbubble-ellipses', color: '#8B5CF6' },
  repost: { name: 'repeat', color: '#3B82F6' },
  music: { name: 'musical-note', color: BRAND.primaryLight },
  weekly_summary: { name: 'bar-chart', color: BRAND.primary },
  system: { name: 'notifications', color: '#6B7280' },
};

export default function NotificationPopup() {
  const { popup, dismissPopup } = useNotifications();
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (popup) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -120, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [popup]);

  if (!popup) return null;

  const iconInfo = TYPE_ICONS[popup.data?.type] || TYPE_ICONS.system;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity }]}>
      <TouchableOpacity
        style={[styles.popup, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
        onPress={dismissPopup}
        activeOpacity={0.9}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${iconInfo.color}18` }]}>
          <Ionicons name={iconInfo.name} size={18} color={iconInfo.color} />
        </View>
        <View style={{ flex: 1 }}>
          {popup.title ? (
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{popup.title}</Text>
          ) : null}
          <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={2}>{popup.body}</Text>
        </View>
        <TouchableOpacity onPress={dismissPopup} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
  },
  popup: {
    width: SW - 24,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    gap: 10,
    borderWidth: 0.5,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
