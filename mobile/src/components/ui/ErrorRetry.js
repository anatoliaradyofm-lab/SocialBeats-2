import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import haptic from '../../hooks/useHaptic';

export default function ErrorRetry({ message, onRetry, icon = 'alert-circle-outline' }) {
  const { t } = useTranslation();

  const handleRetry = () => {
    haptic.medium();
    onRetry?.();
  };

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={48} color="#EF4444" />
      <Text style={styles.message}>{message || t('common.operationFailed')}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.button} onPress={handleRetry} activeOpacity={0.7}>
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={styles.buttonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  message: { color: '#9CA3AF', fontSize: 15, textAlign: 'center', marginTop: 12, marginBottom: 20 },
  button: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#8B5CF6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
