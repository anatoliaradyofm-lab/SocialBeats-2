import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

const { width: SW } = Dimensions.get('window');

function BarChart({ data, colors, barColor }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <View style={styles.chart}>
      {data.map((d, i) => (
        <View key={i} style={styles.barCol}>
          <View style={[styles.bar, { height: Math.max((d.value / max) * 80, 2), backgroundColor: barColor || BRAND.accent }]} />
          <Text style={{ color: colors.textMuted, fontSize: 9, marginTop: 4 }}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function YearlyWrapScreen({ navigation }) {
  const { user, token } = useAuth();
  const { colors } = useTheme();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/library/listening-stats?period=year', token)
      .then(r => setStats(r.stats || r))
      .catch(() => setStats({}));
  }, [token]);

  const handleShare = async () => {
    const minutes = stats?.total_listening_minutes || 0;
    const hours = Math.floor(minutes / 60);
    try {
      await Share.share({
        message: `${new Date().getFullYear()} yilinda ${hours} saat muzik dinledim! En cok dinledigim sanatci: ${stats?.top_artist || '?'}. #SocialBeatsWrapped`,
      });
    } catch {}
  };

  const hours = Math.floor((stats?.total_listening_minutes || 0) / 60);
  const topArtists = stats?.top_artists || [];
  const topGenres = stats?.top_genres || [];
  const dailyData = stats?.daily_data || [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Yillik Ozet</Text>
        <TouchableOpacity onPress={handleShare}>
          <Ionicons name="share-social" size={22} color={BRAND.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroYear}>{new Date().getFullYear()}</Text>
          <Text style={styles.heroLabel}>SENIN YILIN</Text>
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{hours}</Text>
            <Text style={styles.heroUnit}>saat muzik</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {[
            { icon: 'musical-notes', label: 'Dinlenen Parca', value: stats?.total_tracks || 0, color: BRAND.primary },
            { icon: 'people', label: 'Sanatci', value: stats?.unique_artists || 0, color: BRAND.accent },
            { icon: 'albums', label: 'Tur', value: stats?.unique_genres || 0, color: BRAND.pink },
            { icon: 'heart', label: 'Begeni', value: stats?.total_likes || 0, color: '#F59E0B' },
          ].map((s, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: colors.surfaceElevated }]}>
              <View style={[styles.statIcon, { backgroundColor: `${s.color}18` }]}>
                <Ionicons name={s.icon} size={22} color={s.color} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{s.value}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Top Artist */}
        {stats?.top_artist && (
          <View style={[styles.topCard, { backgroundColor: colors.surfaceElevated }]}>
            <View style={[styles.topBadge, { backgroundColor: `${BRAND.primary}18` }]}>
              <Ionicons name="trophy" size={20} color={BRAND.primary} />
              <Text style={{ color: BRAND.primary, fontSize: 12, fontWeight: '600' }}>#1 Sanatcin</Text>
            </View>
            <Text style={[styles.topName, { color: colors.text }]}>{stats.top_artist}</Text>
          </View>
        )}

        {/* Top Genre */}
        {stats?.top_genre && (
          <View style={[styles.topCard, { backgroundColor: colors.surfaceElevated }]}>
            <View style={[styles.topBadge, { backgroundColor: `${BRAND.accent}18` }]}>
              <Ionicons name="musical-note" size={20} color={BRAND.accent} />
              <Text style={{ color: BRAND.accent, fontSize: 12, fontWeight: '600' }}>#1 Turun</Text>
            </View>
            <Text style={[styles.topName, { color: colors.text }]}>{stats.top_genre}</Text>
          </View>
        )}

        {/* Daily Distribution */}
        {dailyData.length > 0 && (
          <View style={[styles.chartCard, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.chartTitle, { color: colors.text }]}>Gunlere Gore Dagılım</Text>
            <BarChart data={dailyData} colors={colors} barColor={BRAND.primary} />
          </View>
        )}

        {/* Top 5 Artists */}
        {topArtists.length > 0 && (
          <View style={[styles.listCard, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.listTitle, { color: colors.text }]}>En Cok Dinledigin 5 Sanatci</Text>
            {topArtists.slice(0, 5).map((a, i) => (
              <View key={i} style={styles.listRow}>
                <View style={[styles.rankBadge, { backgroundColor: i < 3 ? `${BRAND.primary}18` : 'transparent' }]}>
                  <Text style={[styles.listRank, { color: i < 3 ? BRAND.primary : colors.textMuted }]}>{i + 1}</Text>
                </View>
                <Text style={{ color: colors.text, flex: 1 }}>{a.name || a.artist}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{a.count || a.plays} kez</Text>
              </View>
            ))}
          </View>
        )}

        {/* Top Genres */}
        {topGenres.length > 0 && (
          <View style={[styles.listCard, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.listTitle, { color: colors.text }]}>Favori Turlerin</Text>
            {topGenres.slice(0, 5).map((g, i) => (
              <View key={i} style={styles.listRow}>
                <View style={[styles.rankBadge, { backgroundColor: i < 3 ? `${BRAND.accent}18` : 'transparent' }]}>
                  <Text style={[styles.listRank, { color: i < 3 ? BRAND.accent : colors.textMuted }]}>{i + 1}</Text>
                </View>
                <Text style={{ color: colors.text, flex: 1 }}>{g.name || g.genre}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{g.percentage || 0}%</Text>
              </View>
            ))}
          </View>
        )}

        {/* Share Button */}
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Ionicons name="share-social" size={20} color="#FFF" />
          <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Paylas</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  heroCard: { borderRadius: 24, padding: 32, alignItems: 'center', marginBottom: 16, backgroundColor: BRAND.primary, shadowColor: BRAND.primary, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 12 },
  heroYear: { color: 'rgba(255,255,255,0.4)', fontSize: 60, fontWeight: '900', letterSpacing: -2 },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, letterSpacing: 2, fontWeight: '600', marginTop: -8 },
  heroStat: { alignItems: 'center', marginTop: 16 },
  heroValue: { color: '#FFF', fontSize: 48, fontWeight: '900', letterSpacing: -1 },
  heroUnit: { color: 'rgba(255,255,255,0.8)', fontSize: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard: { width: (SW - 42) / 2, borderRadius: 16, padding: 16, alignItems: 'center', gap: 6 },
  statIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800' },
  topCard: { borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 12 },
  topBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  topName: { fontSize: 24, fontWeight: '800', marginTop: 8 },
  chartCard: { borderRadius: 16, padding: 16, marginBottom: 14 },
  chartTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 6 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '70%', borderRadius: 4, minHeight: 2 },
  listCard: { borderRadius: 16, padding: 16, marginBottom: 14 },
  listTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  rankBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  listRank: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND.primary, paddingVertical: 16, borderRadius: 16, marginTop: 8 },
});
