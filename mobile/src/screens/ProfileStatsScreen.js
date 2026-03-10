import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';

const { width } = Dimensions.get('window');

const GLASS_COLORS = ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.03)'];
const ACCENT_COLOR = '#8B5CF6';

export default function ProfileStatsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { token } = useAuth();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [listening, setListening] = useState(null);
  const [audience, setAudience] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [ovData, listData, audData] = await Promise.all([
        api.get('/profile/analytics/overview', token),
        api.get('/profile/analytics/listening', token),
        api.get('/profile/analytics/audience', token)
      ]);
      setOverview(ovData);
      setListening(listData);
      setAudience(audData);
    } catch (err) {
      console.error('Error fetching analytics', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: '#000' }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Analytics</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENT_COLOR} />
          <Text style={styles.loadingText}>Analysing data...</Text>
        </View>
      </View>
    );
  }

  const chartConfig = {
    backgroundGradientFrom: '#0A0A0A',
    backgroundGradientTo: '#0A0A0A',
    backgroundGradientFromOpacity: 0,
    backgroundGradientToOpacity: 0,
    color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.6,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    propsForDots: {
      r: '5',
      strokeWidth: '2',
      stroke: ACCENT_COLOR
    }
  };

  const StatCard = ({ label, value, icon, color }) => (
    <LinearGradient
      colors={GLASS_COLORS}
      style={styles.statCard}
    >
      <View style={[styles.iconCircle, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </LinearGradient>
  );

  return (
    <View style={[styles.container, { backgroundColor: '#000', paddingTop: insets.top }]}>
      <LinearGradient colors={['#1F1F1F', '#000000']} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile Stats</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchAnalytics}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* TOP METRICS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.periodBadge}>
            <Text style={styles.periodText}>LAST 30 DAYS</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <StatCard label="Followers" value={overview?.total_followers || 0} icon="people" color="#8B5CF6" />
          <StatCard label="Likes" value={overview?.total_likes_received || 0} icon="heart" color="#EC4899" />
          <StatCard label="Posts" value={overview?.total_posts || 0} icon="layers" color="#3B82F6" />
          <StatCard label="Reached" value={overview?.reach || '2.4k'} icon="eye" color="#10B981" />
        </View>

        <View style={styles.spacer} />

        {/* PERFORMANCE CARD */}
        <Text style={styles.sectionTitle}>Performance</Text>
        <LinearGradient colors={['rgba(139, 92, 246, 0.1)', 'transparent']} style={styles.performanceCard}>
          <View style={styles.performanceHeader}>
            <View>
              <Text style={styles.performanceLabel}>Total Listening Time</Text>
              <Text style={styles.performanceValue}>
                {(listening?.total_listening_minutes / 60).toFixed(1)} <Text style={styles.unitText}>HOURS</Text>
              </Text>
            </View>
            <Ionicons name="pulse" size={40} color={ACCENT_COLOR} />
          </View>

          <View style={styles.divider} />

          <View style={styles.performanceDetails}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Top Artist</Text>
              <Text style={styles.detailValue} numberOfLines={1}>{listening?.top_artist || '-'}</Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Top Genre</Text>
              <Text style={styles.detailValue}>{listening?.top_genre || '-'}</Text>
            </View>
          </View>
        </LinearGradient>

        <Text style={styles.chartTitle}>Activity (Minutes per Day)</Text>
        <View style={styles.chartContainer}>
          {listening?.activity_days && (
            <BarChart
              data={{
                labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
                datasets: [{ data: listening.activity_days }]
              }}
              width={width - 56}
              height={200}
              chartConfig={chartConfig}
              style={styles.chart}
              withInnerLines={false}
              fromZero
              showValuesOnTopOfBars
            />
          )}
        </View>

        <View style={styles.spacer} />

        {/* AUDIENCE INSIGHTS */}
        <Text style={styles.sectionTitle}>Audience</Text>
        <View style={styles.audienceStats}>
          <LinearGradient colors={['rgba(16, 185, 129, 0.15)', 'transparent']} style={styles.growthBadge}>
            <Ionicons name="trending-up" size={16} color="#10B981" />
            <Text style={styles.growthText}>+{audience?.follower_loss_gain?.gained || 0} Gained</Text>
          </LinearGradient>
          <LinearGradient colors={['rgba(239, 68, 68, 0.15)', 'transparent']} style={styles.growthBadge}>
            <Ionicons name="trending-down" size={16} color="#EF4444" />
            <Text style={styles.growthText}>-{audience?.follower_loss_gain?.lost || 0} Lost</Text>
          </LinearGradient>
        </View>

        <Text style={styles.chartTitle}>Follower Growth</Text>
        <View style={styles.chartContainer}>
          {audience?.follower_growth && (
            <LineChart
              data={{
                labels: ['-6D', '-5', '-4', '-3', '-2', '-1', 'Today'],
                datasets: [{ data: audience.follower_growth }]
              }}
              width={width - 56}
              height={200}
              chartConfig={{ ...chartConfig, color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})` }}
              style={styles.chart}
              bezier
            />
          )}
        </View>

        {/* DEMOGRAPHICS */}
        <Text style={styles.chartTitle}>Age Demographics</Text>
        <View style={styles.modernList}>
          {audience?.demographics_age?.map((d, idx) => (
            <View key={d.range} style={styles.modernRow}>
              <View style={styles.modernRowTop}>
                <Text style={styles.modernRowLabel}>{d.range}</Text>
                <Text style={styles.modernRowValue}>{d.percentage}%</Text>
              </View>
              <View style={styles.progressBase}>
                <LinearGradient
                  colors={['#8B5CF6', '#3B82F6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${d.percentage}%` }]}
                />
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.chartTitle}>Top Locations</Text>
        <View style={[styles.modernList, { marginBottom: 60 }]}>
          {audience?.top_locations?.map((loc, i) => (
            <View key={i} style={[styles.modernRow, { paddingVertical: 14 }]}>
              <View style={styles.modernRowTop}>
                <View style={styles.locationWrap}>
                  <Ionicons name="navigate-outline" size={14} color={ACCENT_COLOR} />
                  <Text style={[styles.modernRowLabel, { marginLeft: 8 }]}>{loc.city}, {loc.country}</Text>
                </View>
                <Text style={[styles.modernRowValue, { color: '#9CA3AF' }]}>{loc.percentage}%</Text>
              </View>
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 64 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  refreshBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#6B7280', marginTop: 16, fontSize: 14, fontWeight: '600' },
  scrollContent: { padding: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  periodBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(139, 92, 246, 0.2)' },
  periodText: { fontSize: 10, color: ACCENT_COLOR, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: { width: (width - 50) / 2, padding: 20, borderRadius: 24, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  iconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '600', marginTop: 2 },
  performanceCard: { padding: 24, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 24 },
  performanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  performanceLabel: { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
  performanceValue: { fontSize: 32, fontWeight: '900', color: '#fff', marginTop: 4 },
  unitText: { fontSize: 14, color: ACCENT_COLOR, fontWeight: '800' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 20 },
  performanceDetails: { flexDirection: 'row' },
  detailItem: { flex: 1 },
  detailLabel: { fontSize: 11, color: '#6B7280', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  detailValue: { fontSize: 15, fontWeight: '700', color: '#fff' },
  verticalDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 20 },
  chartTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 16 },
  chartContainer: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 28, padding: 12, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  chart: { borderRadius: 20 },
  audienceStats: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  growthBadge: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  growthText: { color: '#fff', fontSize: 14, fontWeight: '700', marginLeft: 8 },
  modernList: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 28, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  modernRow: { marginBottom: 20 },
  modernRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modernRowLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
  modernRowValue: { fontSize: 15, fontWeight: '800', color: ACCENT_COLOR },
  progressBase: { height: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  locationWrap: { flexDirection: 'row', alignItems: 'center' },
  spacer: { height: 12 }
});
