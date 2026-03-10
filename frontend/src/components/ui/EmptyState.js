import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, BRAND } from '../../contexts/ThemeContext';

export default function EmptyState({ icon = 'albums-outline', title = 'Burada henüz bir şey yok', message, actionLabel, onAction }) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={48} color={BRAND.primaryLight} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {message ? <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.btn} onPress={onAction}>
          <Text style={{ color: '#FFF', fontWeight: '600' }}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  iconWrap: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(124,58,237,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  message: { fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  btn: { marginTop: 20, backgroundColor: BRAND.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 },
});
