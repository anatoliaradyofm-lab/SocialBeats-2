/**
 * ScreenTimeScreen - Ekran süresi takibi
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useScreenTime } from '../contexts/ScreenTimeContext';
import { formatDate as formatLocaleDate } from '../lib/localeUtils';
import { useTheme } from '../contexts/ThemeContext';

function formatDuration(sec) {
  if (!sec || sec < 0) return '0 dk';
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h} sa ${m % 60} dk`;
  return `${m} dk`;
}

function formatDateShort(isoDate) {
  try {
    const d = new Date(isoDate);
    return formatLocaleDate(d, { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return isoDate;
  }
}

export default function ScreenTimeScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { todaySeconds, weeklyData } = useScreenTime();

  const maxSec = Math.max(...weeklyData.map((d) => d.seconds), 1);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ekran süresi</Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.todayCard}>
          <Ionicons name="phone-portrait-outline" size={48} color="#8B5CF6" />
          <Text style={styles.todayLabel}>Bugün</Text>
          <Text style={styles.todayValue}>{formatDuration(todaySeconds)}</Text>
        </View>
        <Text style={styles.sectionTitle}>Son 7 gün</Text>
        <View style={styles.weekList}>
          {weeklyData.map((d) => (
            <View key={d.date} style={styles.weekRow}>
              <Text style={styles.weekDate}>{formatDateShort(d.date)}</Text>
              <View style={styles.weekBarBg}>
                <View
                  style={[
                    styles.weekBar,
                    { width: `${Math.min(100, (d.seconds / maxSec) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.weekValue}>{formatDuration(d.seconds)}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.footer}>Uygulama kullanım süreniz yalnızca cihazınızda saklanır.</Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  backBtn: {},
  backText: { color: colors.accent, fontSize: 16 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginLeft: 16 },
  content: { padding: 20 },
  todayCard: {
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 32,
    marginBottom: 24,
  },
  todayLabel: { fontSize: 16, color: '#9CA3AF', marginTop: 12 },
  todayValue: { fontSize: 32, fontWeight: '700', color: colors.text, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 16 },
  weekList: { gap: 12 },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  weekDate: { width: 80, fontSize: 13, color: '#9CA3AF' },
  weekBarBg: { flex: 1, height: 8, backgroundColor: '#374151', borderRadius: 4, overflow: 'hidden' },
  weekBar: { height: '100%', backgroundColor: '#8B5CF6', borderRadius: 4 },
  weekValue: { width: 60, fontSize: 13, color: colors.text, textAlign: 'right' },
  footer: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 32 },
});
