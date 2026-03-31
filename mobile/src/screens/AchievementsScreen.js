import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

const BADGE_ICONS = {
  first_post: 'create-outline',
  social_butterfly: 'people-outline',
  music_lover: 'musical-notes-outline',
  trendsetter: 'trending-up-outline',
  messenger: 'chatbubbles-outline',
  explorer: 'compass-outline',
  creator: 'list-outline',
  streamer: 'radio-outline',
};

const BADGE_COLORS = {
  first_post: '#10B981',
  social_butterfly: '#F59E0B',
  music_lover: '#8B5CF6',
  trendsetter: '#EF4444',
  messenger: '#3B82F6',
  explorer: '#14B8A6',
  creator: '#EC4899',
  streamer: '#F97316',
};

export default function AchievementsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useTranslation();
  const [achievements, setAchievements] = useState([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [level, setLevel] = useState(1);

  const defaultAchievements = [
    { id: 'first_post', key: 'firstPost', descKey: 'firstPostDesc', unlocked: false, progress: 0, total: 1, points: 10 },
    { id: 'social_butterfly', key: 'socialButterfly', descKey: 'socialButterflyDesc', unlocked: false, progress: 0, total: 50, points: 50 },
    { id: 'music_lover', key: 'musicLover', descKey: 'musicLoverDesc', unlocked: false, progress: 0, total: 100, points: 100 },
    { id: 'trendsetter', key: 'trendsetter', descKey: 'trendsetterDesc', unlocked: false, progress: 0, total: 1000, points: 200 },
    { id: 'messenger', key: 'messenger', descKey: 'messengerDesc', unlocked: false, progress: 0, total: 500, points: 75 },
    { id: 'explorer', key: 'explorer', descKey: 'explorerDesc', unlocked: false, progress: 0, total: 50, points: 50 },
    { id: 'creator', key: 'creator', descKey: 'creatorDesc', unlocked: false, progress: 0, total: 10, points: 30 },
    { id: 'streamer', key: 'streamer', descKey: 'streamerDesc', unlocked: false, progress: 0, total: 1, points: 25 },
  ];

  useEffect(() => {
    const loadAchievements = async () => {
      try {
        const [levelRes, badgesRes] = await Promise.allSettled([
          api.get('/gamification/profile/level', token),
          api.get('/gamification/profile/badges', token),
        ]);
        const levelData = levelRes.status === 'fulfilled' ? levelRes.value : {};
        const badgesData = badgesRes.status === 'fulfilled' ? badgesRes.value : {};
        if (levelData) {
          setLevel(levelData.level || 1);
          setTotalPoints(levelData.total_xp || 0);
        }
        if (badgesData?.badges && Array.isArray(badgesData.badges)) {
          const merged = defaultAchievements.map(a => {
            const found = badgesData.badges.find(b => b.badge_type === a.id || b.id === a.id);
            return found ? { ...a, unlocked: true, progress: a.total } : a;
          });
          setAchievements(merged);
        } else {
          setAchievements(defaultAchievements);
        }
      } catch {
        setAchievements(defaultAchievements);
      }
    };
    if (token) loadAchievements();
    else setAchievements(defaultAchievements);
  }, [token]);

  const renderAchievement = ({ item }) => {
    const color = BADGE_COLORS[item.id] || '#8B5CF6';
    const icon = BADGE_ICONS[item.id] || 'trophy-outline';
    const progressPct = item.total > 0 ? Math.min(1, item.progress / item.total) : 0;

    return (
      <View style={[styles.card, item.unlocked && styles.cardUnlocked]}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
        <View style={[styles.iconCircle, { backgroundColor: item.unlocked ? color + '30' : '#374151' }]}>
          <Ionicons name={icon} size={28} color={item.unlocked ? color : '#6B7280'} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, !item.unlocked && styles.cardTitleLocked]}>
            {t(`achievements.${item.key}`)}
          </Text>
          <Text style={styles.cardDesc}>{t(`achievements.${item.descKey}`)}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPct * 100}%`, backgroundColor: color }]} />
          </View>
          <Text style={styles.progressText}>
            {item.unlocked ? t('achievements.unlocked') : t('achievements.progress', { current: item.progress, total: item.total })}
          </Text>
        </View>
        <Text style={styles.points}>{item.points} pts</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('achievements.title')}</Text>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Ionicons name="trophy" size={24} color="#F59E0B" />
          <Text style={styles.statValue}>{t('achievements.level', { level })}</Text>
        </View>
        <View style={styles.statBox}>
          <Ionicons name="star" size={24} color="#8B5CF6" />
          <Text style={styles.statValue}>{t('achievements.points', { points: totalPoints })}</Text>
        </View>
        <View style={styles.statBox}>
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          <Text style={styles.statValue}>{achievements.filter(a => a.unlocked).length}/{achievements.length}</Text>
        </View>
      </View>
      <FlatList
        data={achievements}
        renderItem={renderAchievement}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="trophy-outline" size={64} color="#555" />
            <Text style={styles.emptyText}>{t('achievements.noAchievements')}</Text>
            <Text style={styles.emptySub}>{t('achievements.startExploring')}</Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937', gap: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 20, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  statBox: { alignItems: 'center', gap: 6 },
  statValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  list: { padding: 16 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2937', borderRadius: 16, padding: 16, marginBottom: 12, gap: 14, opacity: 0.7 },
  cardUnlocked: { opacity: 1, borderWidth: 1, borderColor: '#374151' },
  iconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },
  cardTitleLocked: { color: '#9CA3AF' },
  cardDesc: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  progressBar: { height: 4, backgroundColor: '#374151', borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { fontSize: 11, color: '#6B7280' },
  points: { fontSize: 13, color: '#F59E0B', fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#9CA3AF', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#6B7280', marginTop: 8 },
});
