import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';
import { LineChart, BarChart, DonutChart } from '../components/ui/Charts';

const { width: SW } = Dimensions.get('window');
const CHART_W = SW - 48;
const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function StatCard({ icon, label, value, color, colors }) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surfaceElevated }]}>
      <View style={[styles.statIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export default function ListeningStatsScreen({ navigation }) {
  const { user, token } = useAuth();
  const { colors } = useTheme();
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('month');
  const [activeView, setActiveView] = useState('overview');
  const [monthly, setMonthly] = useState(null);
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get(`/library/listening-stats?period=${period}`, token);
        setStats(res.stats || res);
      } catch { setStats({}); }
  }, [token, period]);

  const fetchMonthly = useCallback(async () => {
    try {
      const res = await api.get(`/library/listening-stats/monthly?year=${selectedYear}&month=${selectedMonth}`, token);
      setMonthly(res);
    } catch { setMonthly(null); }
  }, [token, selectedMonth, selectedYear]);

  const fetchWeekly = useCallback(async () => {
    try {
      const res = await api.get('/library/listening-stats/weekly-summary', token);
      setWeeklySummary(res);
    } catch { setWeeklySummary(null); }
  }, [token]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { if (activeView === 'monthly') fetchMonthly(); }, [activeView, fetchMonthly]);
  useEffect(() => { if (activeView === 'weekly') fetchWeekly(); }, [activeView, fetchWeekly]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    if (activeView === 'monthly') await fetchMonthly();
    if (activeView === 'weekly') await fetchWeekly();
    setRefreshing(false);
  };

  const totalMinutes = stats?.total_listening_minutes || 0;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const topArtists = stats?.top_artists || [];
  const topGenres = stats?.top_genres || [];
  const dailyData = stats?.daily_data || [];

  const genreDonut = topGenres.slice(0, 6).map(g => ({
    label: (g.name || g.genre || '').substring(0, 10),
    value: g.percentage || g.count || 0,
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Dinleme İstatistikleri</Text>
        <TouchableOpacity onPress={() => navigation.navigate('YearlyWrap')}>
          <Ionicons name="trophy" size={22} color="#F59E0B" />
        </TouchableOpacity>
      </View>

      {/* View Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.viewRow}>
        {[
          { id: 'overview', label: 'Genel', icon: 'bar-chart' },
          { id: 'monthly', label: 'Aylık Rapor', icon: 'calendar' },
          { id: 'weekly', label: 'Haftalık Özet', icon: 'today' },
        ].map(v => (
          <TouchableOpacity
            key={v.id}
            style={[styles.viewChip, { backgroundColor: activeView === v.id ? BRAND.primary : colors.surfaceElevated }]}
            onPress={() => setActiveView(v.id)}
          >
            <Ionicons name={v.icon} size={14} color={activeView === v.id ? '#FFF' : colors.textMuted} />
            <Text style={{ color: activeView === v.id ? '#FFF' : colors.textSecondary, fontSize: 12, fontWeight: '500' }}>{v.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}
      >
        {/* ===== OVERVIEW TAB ===== */}
        {activeView === 'overview' && (
          <>
      <View style={styles.periodRow}>
        {['week', 'month', 'year'].map(p => (
          <TouchableOpacity key={p} style={[styles.periodChip, { backgroundColor: period === p ? BRAND.primary : colors.surfaceElevated }]} onPress={() => setPeriod(p)}>
            <Text style={{ color: period === p ? '#FFF' : colors.textSecondary, fontSize: 13, fontWeight: '500' }}>
              {p === 'week' ? 'Hafta' : p === 'month' ? 'Ay' : 'Yıl'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

        <View style={styles.statsRow}>
              <StatCard icon="time" label="Dinleme Süresi" value={`${hours}s ${mins}dk`} color={BRAND.primary} colors={colors} />
          <StatCard icon="musical-notes" label="Dinlenen Parça" value={stats?.total_tracks || 0} color={BRAND.accent} colors={colors} />
        </View>
        <View style={styles.statsRow}>
          <StatCard icon="people" label="Sanatçı" value={stats?.unique_artists || 0} color={BRAND.pink} colors={colors} />
          <StatCard icon="albums" label="Tür" value={stats?.unique_genres || 0} color="#F59E0B" colors={colors} />
        </View>

            {/* Daily Listening Line Chart */}
            {dailyData.length > 0 && (
              <View style={[styles.chartCard, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={[styles.chartTitle, { color: colors.text }]}>Günlük Dinleme Dağılımı</Text>
                <LineChart
                  data={dailyData}
                  width={CHART_W}
                  height={160}
                  lineColor={BRAND.primary}
                  fillColor={`${BRAND.primary}18`}
                  dotColor={BRAND.primary}
                  labelColor={colors.textMuted}
                  gridColor={colors.border}
                  showFill
                  showDots={dailyData.length <= 14}
                />
              </View>
            )}

            {/* Genre Distribution Donut */}
            {genreDonut.length > 0 && (
        <View style={[styles.chartCard, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={[styles.chartTitle, { color: colors.text }]}>Tür Dağılımı</Text>
                <DonutChart
                  data={genreDonut}
                  size={130}
                  centerLabel="Tür"
                  centerValue={String(stats?.unique_genres || genreDonut.length)}
                  labelColor={colors.textMuted}
                />
        </View>
            )}

            {/* Top Artists */}
        {topArtists.length > 0 && (
          <View style={[styles.listCard, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>En Çok Dinlenen Sanatçılar</Text>
            {topArtists.slice(0, 5).map((a, i) => (
              <View key={i} style={[styles.listRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.rankBadge, { backgroundColor: i < 3 ? `${BRAND.primary}18` : 'transparent' }]}>
                <Text style={[styles.listRank, { color: i < 3 ? BRAND.primary : colors.textMuted }]}>{i + 1}</Text>
                    </View>
                <Text style={{ color: colors.text, flex: 1, fontSize: 14 }}>{a.name || a.artist}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{a.count || a.plays} oynatma</Text>
              </View>
            ))}
          </View>
        )}

            {/* Top Genres Bar */}
        {topGenres.length > 0 && (
          <View style={[styles.listCard, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Favori Türler</Text>
                {topGenres.slice(0, 5).map((g, i) => {
                  const pct = g.percentage || 0;
                  return (
                    <View key={i} style={[styles.genreRow, { borderBottomColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 14 }}>{g.name || g.genre}</Text>
                        <View style={[styles.genreBar, { backgroundColor: colors.border }]}>
                          <View style={[styles.genreBarFill, { width: `${pct}%`, backgroundColor: BRAND.accent }]} />
                        </View>
                      </View>
                      <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600', width: 40, textAlign: 'right' }}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* ===== MONTHLY REPORT TAB ===== */}
        {activeView === 'monthly' && (
          <>
            <View style={styles.monthSelector}>
              <TouchableOpacity onPress={() => {
                if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(selectedYear - 1); }
                else setSelectedMonth(selectedMonth - 1);
              }}>
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.monthLabel, { color: colors.text }]}>
                {MONTHS_TR[selectedMonth - 1]} {selectedYear}
              </Text>
              <TouchableOpacity onPress={() => {
                if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(selectedYear + 1); }
                else setSelectedMonth(selectedMonth + 1);
              }}>
                <Ionicons name="chevron-forward" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {monthly && (
              <>
                <View style={styles.statsRow}>
                  <StatCard icon="musical-notes" label="Dinlenen Parça" value={monthly.total_tracks || 0} color={BRAND.primary} colors={colors} />
                  <StatCard icon="time" label="Toplam Süre" value={`${Math.floor((monthly.total_minutes || 0) / 60)}s ${(monthly.total_minutes || 0) % 60}dk`} color={BRAND.accent} colors={colors} />
                </View>

                {monthly.daily_data?.length > 0 && (
                  <View style={[styles.chartCard, { backgroundColor: colors.surfaceElevated }]}>
                    <Text style={[styles.chartTitle, { color: colors.text }]}>Günlük Dinleme</Text>
                    <BarChart
                      data={monthly.daily_data.map(d => ({
                        label: d.day || d.label || '',
                        value: d.minutes || d.tracks || d.value || 0,
                      }))}
                      width={CHART_W}
                      height={140}
                      barColor={BRAND.primary}
                      labelColor={colors.textMuted}
                      gridColor={colors.border}
                    />
                  </View>
                )}

                {monthly.top_artists?.length > 0 && (
                  <View style={[styles.listCard, { backgroundColor: colors.surfaceElevated }]}>
                    <Text style={[styles.chartTitle, { color: colors.text }]}>Bu Ayın Sanatçıları</Text>
                    {monthly.top_artists.map((a, i) => (
              <View key={i} style={[styles.listRow, { borderBottomColor: colors.border }]}>
                        <View style={[styles.rankBadge, { backgroundColor: i < 3 ? `${BRAND.primary}18` : 'transparent' }]}>
                          <Text style={[styles.listRank, { color: i < 3 ? BRAND.primary : colors.textMuted }]}>{i + 1}</Text>
                        </View>
                        <Text style={{ color: colors.text, flex: 1, fontSize: 14 }}>{a.name}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{a.count} oynatma</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {!monthly && (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, marginTop: 12 }}>Bu ay için veri yok</Text>
              </View>
            )}
          </>
        )}

        {/* ===== WEEKLY SUMMARY TAB ===== */}
        {activeView === 'weekly' && (
          <>
            {weeklySummary ? (
              <>
                <View style={[styles.weeklyHero, { backgroundColor: BRAND.primary }]}>
                  <Text style={styles.weeklyHeroLabel}>Bu Hafta</Text>
                  <Text style={styles.weeklyHeroValue}>{weeklySummary.total_tracks || 0}</Text>
                  <Text style={styles.weeklyHeroUnit}>parça dinledin</Text>
                  <View style={styles.weeklyHeroDivider} />
                  <Text style={styles.weeklyHeroValue}>{Math.floor((weeklySummary.total_minutes || 0) / 60)}s {(weeklySummary.total_minutes || 0) % 60}dk</Text>
                  <Text style={styles.weeklyHeroUnit}>toplam dinleme</Text>
                </View>

                {weeklySummary.change_from_last_week !== undefined && (
                  <View style={[styles.changeCard, { backgroundColor: colors.surfaceElevated }]}>
                    <Ionicons
                      name={weeklySummary.change_from_last_week >= 0 ? 'trending-up' : 'trending-down'}
                      size={24}
                      color={weeklySummary.change_from_last_week >= 0 ? '#10B981' : BRAND.pink}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>
                        Geçen haftaya göre {Math.abs(weeklySummary.change_from_last_week)} dk {weeklySummary.change_from_last_week >= 0 ? 'daha fazla' : 'daha az'}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>dinleme yaptın</Text>
                    </View>
                  </View>
                )}

                {weeklySummary.top_artist && (
                  <View style={[styles.changeCard, { backgroundColor: colors.surfaceElevated }]}>
                    <View style={[styles.statIcon, { backgroundColor: `${BRAND.accent}18` }]}>
                      <Ionicons name="trophy" size={20} color={BRAND.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>#1 Sanatçın</Text>
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{weeklySummary.top_artist}</Text>
                    </View>
                  </View>
                )}

                {weeklySummary.top_artists?.length > 0 && (
                  <View style={[styles.listCard, { backgroundColor: colors.surfaceElevated }]}>
                    <Text style={[styles.chartTitle, { color: colors.text }]}>Bu Haftanın Sanatçıları</Text>
                    {weeklySummary.top_artists.map((a, i) => (
                      <View key={i} style={[styles.listRow, { borderBottomColor: colors.border }]}>
                        <View style={[styles.rankBadge, { backgroundColor: `${BRAND.primary}18` }]}>
                          <Text style={[styles.listRank, { color: BRAND.primary }]}>{i + 1}</Text>
                        </View>
                        <Text style={{ color: colors.text, flex: 1, fontSize: 14 }}>{a.name}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{a.count} oynatma</Text>
              </View>
            ))}
          </View>
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="today-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, marginTop: 12 }}>Haftalık veri yükleniyor...</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  viewRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  viewChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  periodRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  periodChip: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', gap: 8 },
  statIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800' },
  chartCard: { borderRadius: 16, padding: 16, marginBottom: 12 },
  chartTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  listCard: { borderRadius: 16, padding: 16, marginBottom: 12 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, gap: 10 },
  listRank: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  rankBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  genreRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, gap: 12 },
  genreBar: { height: 6, borderRadius: 3, marginTop: 6, overflow: 'hidden' },
  genreBarFill: { height: '100%', borderRadius: 3 },
  monthSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, marginBottom: 8 },
  monthLabel: { fontSize: 18, fontWeight: '700' },
  weeklyHero: { borderRadius: 24, padding: 32, alignItems: 'center', marginBottom: 16, shadowColor: BRAND.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  weeklyHeroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600', letterSpacing: 1, marginBottom: 8 },
  weeklyHeroValue: { color: '#FFF', fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  weeklyHeroUnit: { color: 'rgba(255,255,255,0.8)', fontSize: 15, marginBottom: 8 },
  weeklyHeroDivider: { width: 40, height: 2, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 1, marginVertical: 8 },
  changeCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16, marginBottom: 12 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
});
