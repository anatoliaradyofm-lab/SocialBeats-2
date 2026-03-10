import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

export default function LiveStreamScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('liveStream.title')}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="radio-outline" size={64} color="#8B5CF6" />
        </View>
        <Text style={styles.emptyTitle}>{t('liveStream.noLive')}</Text>
        <Text style={styles.emptySub}>{t('liveStream.noLiveSub')}</Text>
        <TouchableOpacity style={styles.goLiveBtn} onPress={() => {
          // Placeholder - would navigate to camera/streaming setup
        }}>
          <View style={styles.liveDot} />
          <Text style={styles.goLiveText}>{t('liveStream.goLive')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937', gap: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  iconCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#1E1B4B', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 32, maxWidth: 280 },
  goLiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EF4444', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  goLiveText: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
