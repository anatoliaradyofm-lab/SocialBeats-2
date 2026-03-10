import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import haptic from '../../hooks/useHaptic';

export default function EmptyState({ icon = 'albums-outline', title, subtitle, actionLabel, onAction }) {
  const handleAction = () => {
    haptic.light();
    onAction?.();
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={56} color="#8B5CF6" />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.button} onPress={handleAction} activeOpacity={0.7}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  iconContainer: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  button: {
    backgroundColor: '#8B5CF6', paddingHorizontal: 28, paddingVertical: 12,
    borderRadius: 24, marginTop: 20,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
