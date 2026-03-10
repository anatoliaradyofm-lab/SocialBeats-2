import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

const DAYS_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function BarChart({ data, colors, height = 100 }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <View style={[chartStyles.chart, { height }]}>
      {data.map((d, i) => (
        <View key={i} style={chartStyles.barCol}>
          <View style={[chartStyles.bar, { height: (d.value / max) * height, backgroundColor: d.isToday ? BRAND.primary : BRAND.primaryLight, opacity: d.isToday ? 1 : 0.5 }]} />
          <Text style={{ color: d.isToday ? BRAND.primary : colors.textMuted, fontSize: 10, marginTop: 4, fontWeight: d.isToday ? '700' : '400' }}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '65%', borderRadius: 6, minHeight: 2 },
});

export default function ScreenTimeScreen({ navigation }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState(7);

  const fetchData = async () => {
    try {
      const res = await api.get(`/user/screen-time?days=${period}`, token);
      setData(res);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { setLoading(true); fetchData(); }, [period]);

  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const formatTime = (minutes) => {
    if (minutes < 60) return `${minutes} dk`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}s ${m}dk`;
  };

  if (loading) return (
    <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={BRAND.primary} />
    </View>
  );

  const records = data?.records || [];
  const todayIdx = new Date().getDay();
  const chartData = [];
  for (let i = 0; i < period && i < 7; i++) {
    const rec = records[i];
    const dayIdx = (todayIdx - i + 7) % 7;
    chartData.unshift({
      label: DAYS_LABELS[dayIdx === 0 ? 6 : dayIdx - 1],
      value: rec ? Math.round(rec.total_seconds / 60) : 0,
      isToday: i === 0,
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Ekran Süresi</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Period Selector */}
        <View style={[styles.periodRow, { backgroundColor: colors.surfaceElevated }]}>
          {[{ val: 7, label: '7 gün' }, { val: 14, label: '14 gün' }, { val: 30, label: '30 gün' }].map(p => (
            <TouchableOpacity key={p.val} style={[styles.periodBtn, period === p.val && { backgroundColor: BRAND.primary }]} onPress={() => setPeriod(p.val)}>
              <Text style={{ color: period === p.val ? '#FFF' : colors.textMuted, fontSize: 13, fontWeight: period === p.val ? '600' : '400' }}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="time" size={24} color={BRAND.primary} />
            <Text style={[styles.summaryValue, { color: colors.text }]}>{formatTime(data?.total_minutes || 0)}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>Toplam</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="bar-chart" size={24} color={BRAND.accent} />
            <Text style={[styles.summaryValue, { color: colors.text }]}>{formatTime(data?.daily_average_minutes || 0)}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>Günlük Ort.</Text>
          </View>
        </View>

        {/* Chart */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Günlük Kullanım</Text>
          <BarChart data={chartData} colors={colors} />
        </View>

        {/* Daily Detail */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Günlük Detay</Text>
          {records.slice(0, 7).map((rec, i) => (
            <View key={i} style={[styles.dayRow, { borderBottomColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>{rec.date}</Text>
              <Text style={{ color: BRAND.primary, fontSize: 13, fontWeight: '600' }}>{formatTime(Math.round(rec.total_seconds / 60))}</Text>
            </View>
          ))}
          {records.length === 0 && (
            <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>Henüz veri yok</Text>
          )}
        </View>

        {/* Tips */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Ionicons name="bulb" size={18} color="#F59E0B" />
            <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>İpucu</Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
            Günlük ekran sürenizi takip ederek dijital dengenizi koruyabilirsiniz. Uzmanlar günde 2 saatten fazla sosyal medya kullanımını önermemektedir.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  periodRow: { flexDirection: 'row', borderRadius: 14, padding: 4, marginBottom: 16 },
  periodBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  summaryCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', gap: 6 },
  summaryValue: { fontSize: 18, fontWeight: '800' },
  card: { borderRadius: 16, padding: 16, marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5 },
});
