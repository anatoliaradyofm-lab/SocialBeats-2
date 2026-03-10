import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
  RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';
import { LineChart, BarChart, HorizontalBarChart, DonutChart } from '../components/ui/Charts';

const { width: SW } = Dimensions.get('window');
const CHART_W = SW - 48;

const TABS = [
  { id: 'overview', label: 'Genel Bakış', icon: 'stats-chart' },
  { id: 'listening', label: 'Dinleme', icon: 'headset' },
  { id: 'followers', label: 'Takipçiler', icon: 'people' },
];

function NumCard({ icon, label, value, color, colors, small }) {
  return (
    <View style={[styles.numCard, { backgroundColor: colors.surfaceElevated }, small && { padding: 10 }]}>
      <View style={[styles.numIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={small ? 16 : 20} color={color} />
      </View>
      <Text style={[styles.numValue, { color: colors.text }, small && { fontSize: 16 }]}>{value}</Text>
      <Text style={[styles.numLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function SectionTitle({ title, icon, colors, right }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={icon} size={18} color={BRAND.primary} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      </View>
      {right || null}
    </View>
  );
}

export default function ProfileStatsScreen({ navigation }) {
  const { user, token } = useAuth();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [overview, setOverview] = useState(null);
  const [followerGrowth, setFollowerGrowth] = useState(null);
  const [growthPeriod, setGrowthPeriod] = useState('week');
  const [topFollowers, setTopFollowers] = useState([]);
  const [demographics, setDemographics] = useState(null);
  const [yearlyTop, setYearlyTop] = useState(null);
  const [listeningStats, setListeningStats] = useState(null);
  const [lsPeriod, setLsPeriod] = useState('month');

  const fetchOverview = useCallback(async () => {
    try {
      const res = await api.get('/analytics/overview', token);
      setOverview(res);
    } catch { setOverview({}); }
  }, [token]);

  const fetchFollowerGrowth = useCallback(async () => {
    try {
      const res = await api.get(`/analytics/follower-growth?period=${growthPeriod}`, token);
      setFollowerGrowth(res);
    } catch { setFollowerGrowth(null); }
  }, [token, growthPeriod]);

  const fetchTopFollowers = useCallback(async () => {
    try {
      const res = await api.get('/analytics/top-followers?limit=5', token);
      setTopFollowers(res.followers || []);
    } catch { setTopFollowers([]); }
  }, [token]);

  const fetchDemographics = useCallback(async () => {
    try {
      const res = await api.get('/analytics/follower-demographics', token);
      setDemographics(res);
    } catch { setDemographics(null); }
  }, [token]);

  const fetchYearlyTop = useCallback(async () => {
    try {
      const res = await api.get('/analytics/yearly-top', token);
      setYearlyTop(res);
    } catch { setYearlyTop(null); }
  }, [token]);

  const fetchListeningStats = useCallback(async () => {
    try {
      const res = await api.get(`/library/listening-stats?period=${lsPeriod}`, token);
      setListeningStats(res.stats || res);
    } catch { setListeningStats({}); }
  }, [token, lsPeriod]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchOverview(), fetchListeningStats(), fetchYearlyTop()]);
      setLoading(false);
    };
    init();
  }, [fetchOverview, fetchListeningStats, fetchYearlyTop]);

  useEffect(() => { fetchFollowerGrowth(); }, [fetchFollowerGrowth]);

  useEffect(() => {
    if (activeTab === 'followers') {
      fetchTopFollowers();
      fetchDemographics();
    }
  }, [activeTab, fetchTopFollowers, fetchDemographics]);

  useEffect(() => { fetchListeningStats(); }, [fetchListeningStats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchOverview(), fetchFollowerGrowth(), fetchListeningStats(), fetchYearlyTop(),
      activeTab === 'followers' ? fetchTopFollowers() : Promise.resolve(),
      activeTab === 'followers' ? fetchDemographics() : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

  const fmtNum = (n) => {
    if (!n) return '0';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  const totalMin = overview?.total_listening_minutes || 0;
  const hrs = Math.floor(totalMin / 60);
  const mn = totalMin % 60;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>İstatistikler & Analitik</Text>
        <TouchableOpacity onPress={() => navigation.navigate('YearlyWrap')}>
          <Ionicons name="trophy" size={22} color="#F59E0B" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabChip, { backgroundColor: activeTab === t.id ? BRAND.primary : colors.surfaceElevated }]}
            onPress={() => setActiveTab(t.id)}
          >
            <Ionicons name={t.icon} size={14} color={activeTab === t.id ? '#FFF' : colors.textMuted} />
            <Text style={{ color: activeTab === t.id ? '#FFF' : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}
        >
          {/* ========== OVERVIEW TAB ========== */}
          {activeTab === 'overview' && (
            <>
            {/* Summary Grid */}
            <View style={styles.gridRow}>
              <NumCard icon="documents" label="Gönderi" value={fmtNum(overview?.posts_count)} color={BRAND.primary} colors={colors} />
              <NumCard icon="people" label="Takipçi" value={fmtNum(overview?.followers_count)} color={BRAND.accent} colors={colors} />
            </View>
            <View style={styles.gridRow}>
              <NumCard icon="person-add" label="Takip" value={fmtNum(overview?.following_count)} color="#F59E0B" colors={colors} />
              <NumCard icon="heart" label="Beğeni" value={fmtNum(overview?.total_likes_received)} color={BRAND.pink} colors={colors} />
            </View>
            <View style={styles.gridRow}>
              <NumCard icon="time" label="Dinleme" value={`${hrs}s ${mn}dk`} color="#10B981" colors={colors} />
              <NumCard icon="person" label="Favori Sanatçı" value={overview?.top_artist || '-'} color={BRAND.primary} colors={colors} small />
            </View>

            {/* Top Genre */}
            {overview?.top_genre && (
              <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.numIcon, { backgroundColor: `${BRAND.accent}15` }]}>
                    <Ionicons name="musical-notes" size={22} color={BRAND.accent} />
                  </View>
                  <View>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>En Çok Dinlenen Tür</Text>
                    <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{overview.top_genre}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Weekly Activity Chart */}
            {overview?.weekly_activity?.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
                <SectionTitle title="Aktiflik Günleri" icon="calendar" colors={colors} />
                <BarChart
                    data={overview.weekly_activity}
                    width={CHART_W}
                  height={140}
                    barColor={BRAND.primary}
                    labelColor={colors.textMuted}
                    gridColor={colors.border}
                  />
              </View>
            )}

            {/* Yearly Top Track & Artist */}
            {yearlyTop && (
              <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
                <SectionTitle title={`${yearlyTop.year} Yılı`} icon="trophy" colors={colors} />
                {yearlyTop.top_track && (
                  <View style={styles.yearlyRow}>
                    <Ionicons name="musical-note" size={20} color={BRAND.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>En Çok Dinlenen Parça</Text>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{yearlyTop.top_track.title}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{yearlyTop.top_track.artist} • {yearlyTop.top_track.plays} oynatma</Text>
                    </View>
                  </View>
                )}
                {yearlyTop.top_artist && (
                  <View style={styles.yearlyRow}>
                    <Ionicons name="person" size={20} color={BRAND.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>En Çok Dinlenen Sanatçı</Text>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{yearlyTop.top_artist.name}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{yearlyTop.top_artist.plays} oynatma</Text>
                    </View>
                  </View>
                )}
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>
                  Toplam: {Math.floor((yearlyTop.total_listening_minutes || 0) / 60)} saat dinleme • {yearlyTop.total_tracks || 0} parça
                </Text>
              </View>
            )}

            {/* Yearly Monthly Chart */}
            {yearlyTop?.monthly_chart?.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
                <SectionTitle title="Yıllık Aylık Dağılım" icon="bar-chart" colors={colors} />
                <BarChart
                  data={yearlyTop.monthly_chart}
                  width={CHART_W}
                  height={150}
                  barColor={BRAND.accent}
                  labelColor={colors.textMuted}
                  gridColor={colors.border}
                />
              </View>
            )}

            {/* Go to Listening Stats */}
            <TouchableOpacity
              style={[styles.linkCard, { backgroundColor: colors.surfaceElevated }]}
              onPress={() => navigation.navigate('ListeningStats')}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons name="headset" size={22} color={BRAND.primary} />
                <View>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Detaylı Dinleme İstatistikleri</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>Haftalık, aylık ve yıllık raporlar</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            </>
          )}

        {/* ========== LISTENING TAB ========== */}
        {activeTab === 'listening' && (
            <>
              {/* Period Selector */}
              <View style={styles.periodRow}>
              {[
                { id: 'week', label: 'Hafta' },
                { id: 'month', label: 'Ay' },
                { id: 'year', label: 'Yıl' },
              ].map(p => (
                  <TouchableOpacity
                  key={p.id}
                  style={[styles.periodChip, { backgroundColor: lsPeriod === p.id ? BRAND.primary : colors.surfaceElevated }]}
                  onPress={() => setLsPeriod(p.id)}
                >
                  <Text style={{ color: lsPeriod === p.id ? '#FFF' : colors.textSecondary, fontSize: 13, fontWeight: '500' }}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

            {/* Listening Summary */}
            <View style={styles.gridRow}>
              <NumCard icon="time" label="Dinleme Süresi" value={`${Math.floor((listeningStats?.total_listening_minutes || 0) / 60)}s ${(listeningStats?.total_listening_minutes || 0) % 60}dk`} color={BRAND.primary} colors={colors} />
              <NumCard icon="musical-notes" label="Dinlenen Parça" value={fmtNum(listeningStats?.total_tracks)} color={BRAND.accent} colors={colors} />
                    </View>
            <View style={styles.gridRow}>
              <NumCard icon="people" label="Sanatçı" value={fmtNum(listeningStats?.unique_artists)} color={BRAND.pink} colors={colors} />
              <NumCard icon="albums" label="Tür" value={fmtNum(listeningStats?.unique_genres)} color="#F59E0B" colors={colors} />
                </View>

            {/* Daily Chart */}
            {listeningStats?.daily_data?.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
                <SectionTitle title="Günlük Dinleme" icon="bar-chart" colors={colors} />
                  <LineChart
                  data={listeningStats.daily_data}
                    width={CHART_W}
                    height={160}
                    lineColor={BRAND.primary}
                    fillColor={`${BRAND.primary}18`}
                    dotColor={BRAND.primary}
                    labelColor={colors.textMuted}
                    gridColor={colors.border}
                  showFill
                  showDots
                />
              </View>
            )}

            {/* Top Artists */}
            {listeningStats?.top_artists?.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
                <SectionTitle title="En Çok Dinlenen Sanatçılar" icon="person" colors={colors} />
                {listeningStats.top_artists.slice(0, 5).map((a, i) => (
                  <View key={i} style={[styles.listRow, { borderBottomColor: colors.border }]}>
                    <View style={[styles.rankBadge, { backgroundColor: i < 3 ? `${BRAND.primary}18` : 'transparent' }]}>
                      <Text style={{ color: i < 3 ? BRAND.primary : colors.textMuted, fontSize: 14, fontWeight: '800' }}>{i + 1}</Text>
                    </View>
                    <Text style={{ color: colors.text, flex: 1, fontSize: 14 }}>{a.name || a.artist}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>{a.count || a.plays} oynatma</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Genre Distribution */}
            {listeningStats?.top_genres?.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
                <SectionTitle title="Tür Dağılımı" icon="musical-notes" colors={colors} />
                <DonutChart
                  data={listeningStats.top_genres.slice(0, 6).map(g => ({
                    label: g.name || g.genre,
                    value: g.percentage || g.count || 0,
                  }))}
                  size={140}
                  centerLabel="Tür"
                  centerValue={String(listeningStats?.unique_genres || listeningStats?.top_genres?.length || 0)}
                  labelColor={colors.textMuted}
                />
              </View>
            )}
          </>
        )}

        {/* ========== FOLLOWERS TAB ========== */}
        {activeTab === 'followers' && (
          <>
            {/* Follower Growth Chart */}
            <View style={styles.periodRow}>
              {[
                { id: 'week', label: 'Hafta' },
                { id: 'month', label: 'Ay' },
                { id: 'year', label: 'Yıl' },
              ].map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.periodChip, { backgroundColor: growthPeriod === p.id ? BRAND.primary : colors.surfaceElevated }]}
                  onPress={() => setGrowthPeriod(p.id)}
                >
                  <Text style={{ color: growthPeriod === p.id ? '#FFF' : colors.textSecondary, fontSize: 13, fontWeight: '500' }}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {followerGrowth && (
              <>
                {/* Net Change Summary */}
                <View style={styles.gridRow}>
                  <NumCard icon="trending-up" label="Kazanılan" value={`+${followerGrowth.total_gained || 0}`} color="#10B981" colors={colors} />
                  <NumCard icon="trending-down" label="Kaybedilen" value={`-${followerGrowth.total_lost || 0}`} color={BRAND.pink} colors={colors} />
                </View>
                <View style={[styles.card, { backgroundColor: colors.surfaceElevated, alignItems: 'center', paddingVertical: 20 }]}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>Net Değişim</Text>
                  <Text style={{
                    color: (followerGrowth.net_change || 0) >= 0 ? '#10B981' : BRAND.pink,
                    fontSize: 32, fontWeight: '900',
                  }}>
                    {(followerGrowth.net_change || 0) >= 0 ? '+' : ''}{followerGrowth.net_change || 0}
                  </Text>
                </View>

                {/* Growth Line Chart */}
                {followerGrowth.chart?.length > 1 && (
                  <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
                    <SectionTitle title="Takipçi Büyüme Grafiği" icon="trending-up" colors={colors} />
                    <LineChart
                      data={followerGrowth.chart.map(c => ({
                        label: c.label,
                        value: c.cumulative,
                      }))}
                      width={CHART_W}
                      height={170}
                      lineColor="#10B981"
                      fillColor="rgba(16,185,129,0.1)"
                      dotColor="#10B981"
                      labelColor={colors.textMuted}
                      gridColor={colors.border}
                      showFill
                      showDots={followerGrowth.chart.length <= 31}
                    />
                  </View>
                )}

                {/* Gained vs Lost Bar Chart */}
                {followerGrowth.chart?.length > 1 && (
                  <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
                    <SectionTitle title="Kazanım / Kayıp" icon="swap-vertical" colors={colors} />
                    <BarChart
                      data={followerGrowth.chart.map(c => ({
                        label: c.label,
                        value: c.gained,
                      }))}
                    width={CHART_W}
                    height={120}
                    barColor="#10B981"
                    labelColor={colors.textMuted}
                    gridColor={colors.border}
                  />
                    <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 6 }}>Kazanılan takipçiler</Text>
                  </View>
                )}
              </>
            )}

              {/* Top Followers */}
            {topFollowers.length > 0 && (
              <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
                <SectionTitle title="En Aktif Takipçiler" icon="star" colors={colors} />
                {topFollowers.map((f, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.followerRow, { borderBottomColor: colors.border }]}
                    onPress={() => navigation.navigate('UserProfile', { userId: f.id })}
                  >
                    <View style={[styles.rankBadge, { backgroundColor: i < 3 ? `${BRAND.primary}18` : 'transparent' }]}>
                      <Text style={{ color: i < 3 ? BRAND.primary : colors.textMuted, fontSize: 14, fontWeight: '800' }}>{i + 1}</Text>
                    </View>
                    {f.avatar_url ? (
                      <Image source={{ uri: f.avatar_url }} style={styles.followerAvatar} />
                    ) : (
                      <View style={[styles.followerAvatar, { backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="person" size={16} color={colors.textMuted} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{f.display_name || f.username}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>@{f.username}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: BRAND.primary, fontSize: 14, fontWeight: '700' }}>{f.interaction_score}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 10 }}>etkileşim</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
                )}

              {/* Demographics */}
              {demographics && (
                <>
                {/* Age Groups */}
                {demographics.age_groups?.length > 0 && (
                  <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
                    <SectionTitle title="Yaş Dağılımı" icon="people-circle" colors={colors} />
                      <DonutChart
                      data={demographics.age_groups.map(g => ({
                        label: `${g.group} (%${g.percentage})`,
                        value: g.count,
                      }))}
                      size={130}
                      centerLabel="Takipçi"
                        centerValue={String(demographics.total_followers || 0)}
                        labelColor={colors.textMuted}
                      />
                  </View>
                )}

                {/* Location - Countries */}
                {demographics.top_countries?.length > 0 && (
                  <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
                    <SectionTitle title="Ülke Dağılımı" icon="globe" colors={colors} />
                      <HorizontalBarChart
                      data={demographics.top_countries.map(c => ({
                        label: c.country,
                        value: c.count,
                        percentage: c.percentage,
                      }))}
                        width={CHART_W}
                        barColor={BRAND.primary}
                        labelColor={colors.textMuted}
                        bgColor={colors.border}
                      barHeight={16}
                      showPercentage
                    />
                  </View>
                )}

                {/* Location - Cities */}
                {demographics.top_cities?.length > 0 && (
                  <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
                    <SectionTitle title="Şehir Dağılımı" icon="location" colors={colors} />
                      <HorizontalBarChart
                      data={demographics.top_cities.map(c => ({
                        label: c.city,
                        value: c.count,
                        percentage: c.percentage,
                      }))}
                        width={CHART_W}
                        barColor={BRAND.accent}
                        labelColor={colors.textMuted}
                        bgColor={colors.border}
                      barHeight={16}
                      showPercentage
                    />
                  </View>
              )}
            </>
          )}

            {/* No demographic data */}
            {demographics && !demographics.age_groups?.length && !demographics.top_countries?.length && (
              <View style={styles.emptyBlock}>
                <Ionicons name="analytics-outline" size={40} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, marginTop: 8 }}>Yeterli takipçi verisi yok</Text>
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
  tabRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tabChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  periodRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 14 },
  periodChip: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  gridRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  numCard: { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 4 },
  numIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  numValue: { fontSize: 20, fontWeight: '800' },
  numLabel: { fontSize: 11 },
  card: { borderRadius: 16, padding: 16, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  yearlyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(150,150,150,0.2)' },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, gap: 10 },
  rankBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  followerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, gap: 10 },
  followerAvatar: { width: 36, height: 36, borderRadius: 18 },
  linkCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, padding: 16, marginBottom: 12 },
  emptyBlock: { alignItems: 'center', paddingVertical: 40 },
});
