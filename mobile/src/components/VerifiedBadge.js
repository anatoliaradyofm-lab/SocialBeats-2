import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function VerifiedBadge({ size = 16, color = '#3B82F6', style }) {
  return (
    <View style={[styles.badge, style]}>
      <Ionicons name="checkmark-circle" size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { marginLeft: 4 },
});
