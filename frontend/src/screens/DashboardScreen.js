import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Image, Dimensions, LinearGradient,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { usePlayer } from '../contexts/PlayerContext';
import api from '../services/api';

const { width: SW } = Dimensions.get('window');
const STORY_SIZE = 72;

function StoryCircle({ story, colors, onPress }) {
  return (
    <TouchableOpacity style={styles.storyItem} onPress={onPress}>
      <View style={styles.storyGradientRing}>
        <View style={[styles.storyInner, { backgroundColor: colors.background }]}>
          {story.avatar_url ? (
            <Image source={{ uri: story.avatar_url }} style={styles.storyAvatar} />
          ) : (
            <View style={[styles.storyAvatar, { backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="person" size={22} color={colors.textMuted} />
            </View>
          )}
        </View>
      </View>
      <Text style={[styles.storyName, { color: colors.textSecondary }]} numberOfLines={1}>
        {story.username || 'user'}
      </Text>
    </TouchableOpacity>
  );
}

function GlassCard({ track, colors, onPlay, wide, t }) {
  return (
    <TouchableOpacity
      style={[styles.glassCard, { backgroundColor: colors.surfaceElevated, width: wide ? SW - 32 : (SW - 44) / 2 }]}
      onPress={onPlay}
      activeOpacity={0.85}
    >
      <View style={[styles.glassThumb, { height: wide ? 170 : 130 }]}>
        {track.thumbnail || track.cover_url ? (
          <Image source={{ uri: track.thumbnail || track.cover_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="musical-notes" size={wide ? 36 : 26} color={BRAND.primaryLight} />
          </View>
        )}
        <View style={styles.glassOverlay} />
        <TouchableOpacity style={styles.glassPlayBtn} onPress={onPlay}>
          <Ionicons name="play" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
      <View style={styles.glassInfo}>
        <Text style={[styles.glassTitle, { color: colors.text }]} numberOfLines={1}>{track.title || t('music.songs')}</Text>
        <Text style={[styles.glassArtist, { color: colors.textMuted }]} numberOfLines={1}>{track.artist || ''}</Text>
      </View>
    </TouchableOpacity>
  );
}

function VisualizerBar({ colors }) {
  const bars = Array.from({ length: 48 }, (_, i) => {
    const center = 24;
    const dist = Math.abs(i - center);
    return Math.max(8, (1 - dist / center) * 100 * (0.5 + Math.random() * 0.5));
  });
  return (
    <View style={styles.visualizer}>
      {bars.map((h, i) => {
        const ratio = i / bars.length;
        const isPurple = ratio < 0.5;
        return (
          <View key={i} style={[styles.visBar, {
            height: h * 0.28 + 2,
            backgroundColor: isPurple ? BRAND.primary : BRAND.accent,
            opacity: 0.5 + (h / 100) * 0.5,
          }]} />
        );
      })}
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const { t } = useTranslation();
  const { user, token } = useAuth();
  const { colors } = useTheme();
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const [refreshing, setRefreshing] = useState(false);
  const [stories, setStories] = useState([]);
  const [trending, setTrending] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [forYou, setForYou] = useState([]);
  const [topCharts, setTopCharts] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const [st, tr, nr, fy, ch] = await Promise.all([
        api.get('/stories/feed', token).catch(() => ({ stories: [] })),
        api.get('/songs/trending?limit=10', token).catch(() => ({ songs: [] })),
        api.get('/songs/new-releases?limit=10', token).catch(() => ({ songs: [] })),
        api.get('/songs/for-you?limit=10', token).catch(() => ({ songs: [] })),
        api.get('/songs/charts?limit=10', token).catch(() => ({ songs: [] })),
      ]);
      setStories(st.stories || st || []);
      setTrending(tr.songs || tr || []);
      setNewReleases(nr.songs || nr || []);
      setForYou(fy.songs || fy || []);
      setTopCharts(ch.songs || ch || []);
    } catch {}
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>
          <Text style={{ color: BRAND.primary, fontWeight: '800', letterSpacing: -0.5 }}>Social</Text>
          <Text style={{ color: BRAND.accent, fontWeight: '300' }}>Beats</Text>
        </Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => navigation.navigate('ARExperience')} style={styles.hBtn}>
            <View style={[styles.arIconBg]}>
              <Ionicons name="cube" size={16} color="#FFF" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.hBtn}>
            <View style={[styles.hIconBg, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="person" size={18} color={colors.text} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Conversations')} style={styles.hBtn}>
            <View style={[styles.hIconBg, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="chatbubble" size={16} color={colors.text} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.hBtn}>
            <View style={[styles.hIconBg, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="notifications" size={16} color={colors.text} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />} showsVerticalScrollIndicator={false}>
        {/* Search */}
        <TouchableOpacity style={[styles.searchBar, { backgroundColor: colors.surfaceElevated }]} onPress={() => navigation.navigate('Search')} activeOpacity={0.8}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: 14, flex: 1 }}>{t('home.searchPlaceholder')}</Text>
          <View style={[styles.searchMic, { backgroundColor: BRAND.primary }]}>
            <Ionicons name="mic" size={14} color="#FFF" />
          </View>
        </TouchableOpacity>

        {/* Stories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesList}>
          <TouchableOpacity style={styles.storyItem} onPress={() => navigation.navigate('StoryCreate')}>
            <View style={[styles.addStoryCircle, { backgroundColor: colors.surfaceElevated }]}>
              <View style={styles.addStoryPlus}>
                <Ionicons name="add" size={18} color="#FFF" />
              </View>
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={[styles.storyAvatar, { position: 'absolute', top: 4, left: 4 }]} />
              ) : (
                <Ionicons name="person" size={22} color={colors.textMuted} />
              )}
            </View>
            <Text style={[styles.storyName, { color: colors.textSecondary }]}>{t('home.story')}</Text>
          </TouchableOpacity>
          {stories.map((s, i) => (
            <StoryCircle key={s.id || i} story={s} colors={colors} onPress={() => navigation.navigate('StoryViewer', { stories: [s], initialIndex: 0 })} />
          ))}
        </ScrollView>

        {/* Now Playing */}
        {currentTrack && (
          <View style={[styles.npBanner, { backgroundColor: colors.surfaceElevated }]}>
            <View style={styles.npRow}>
              <View style={[styles.npThumb, { backgroundColor: colors.card }]}>
                {currentTrack.thumbnail ? <Image source={{ uri: currentTrack.thumbnail }} style={styles.npThumb} /> : <Ionicons name="musical-note" size={16} color={BRAND.primary} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.npTitle, { color: colors.text }]} numberOfLines={1}>{currentTrack.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>{currentTrack.artist}</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('ARExperience')} style={styles.npArBtn}>
                <Ionicons name="cube" size={14} color="#FFF" />
                <Text style={styles.npArText}>{t('home.arExperience')}</Text>
              </TouchableOpacity>
              <View style={[styles.npLiveDot, { backgroundColor: isPlaying ? BRAND.accent : colors.textMuted }]} />
            </View>
            <VisualizerBar colors={colors} />
          </View>
        )}

        {/* Trending */}
        {trending.length > 0 && (
          <View style={styles.section}>
            <View style={styles.secHeader}>
              <View>
                <Text style={[styles.secTitle, { color: colors.text }]}>{t('home.trending')}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('home.trendingDesc')}</Text>
              </View>
              <TouchableOpacity style={[styles.seeAllBtn, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={{ color: BRAND.primaryLight, fontSize: 12, fontWeight: '600' }}>{t('common.seeAll')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {trending.map((tr, i) => <GlassCard key={tr.id || i} track={tr} colors={colors} onPlay={() => playTrack(tr, trending)} t={t} />)}
            </ScrollView>
          </View>
        )}

        {/* For You */}
        {forYou.length > 0 && (
          <View style={styles.section}>
            <View style={styles.secHeader}>
              <View>
                <Text style={[styles.secTitle, { color: colors.text }]}>{t('home.forYou')}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('home.forYouDesc')}</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
              {forYou.map((tr, i) => <GlassCard key={tr.id || i} track={tr} colors={colors} onPlay={() => playTrack(tr, forYou)} wide t={t} />)}
            </ScrollView>
          </View>
        )}

        {/* New Releases */}
        {newReleases.length > 0 && (
          <View style={styles.section}>
            <View style={styles.secHeader}>
              <View>
                <Text style={[styles.secTitle, { color: colors.text }]}>{t('home.newReleases')}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('home.newReleasesDesc')}</Text>
              </View>
              <TouchableOpacity style={[styles.seeAllBtn, { backgroundColor: colors.surfaceElevated }]}>
                <Text style={{ color: BRAND.primaryLight, fontSize: 12, fontWeight: '600' }}>{t('common.seeAll')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {newReleases.map((tr, i) => <GlassCard key={tr.id || i} track={tr} colors={colors} onPlay={() => playTrack(tr, newReleases)} t={t} />)}
            </ScrollView>
          </View>
        )}

        {/* Top Charts */}
        {topCharts.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.secTitle, { color: colors.text, paddingHorizontal: 16, marginBottom: 12 }]}>{t('home.topCharts')}</Text>
            {topCharts.slice(0, 10).map((tr, i) => (
              <TouchableOpacity key={tr.id || i} style={[styles.chartRow, { borderBottomColor: colors.border }]} onPress={() => playTrack(tr, topCharts)}>
                <Text style={[styles.chartRank, { color: i < 3 ? BRAND.primary : colors.textMuted }]}>{i + 1}</Text>
                <View style={[styles.chartThumb, { backgroundColor: colors.card }]}>
                  {tr.thumbnail ? <Image source={{ uri: tr.thumbnail }} style={styles.chartThumb} /> : <Ionicons name="musical-note" size={16} color={BRAND.primaryLight} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.chartTitle, { color: colors.text }]} numberOfLines={1}>{tr.title}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>{tr.artist}</Text>
                </View>
                {i < 3 && <View style={[styles.chartBadge, { backgroundColor: i === 0 ? BRAND.primary : BRAND.accent }]}><Ionicons name="trending-up" size={12} color="#FFF" /></View>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty */}
        {trending.length === 0 && forYou.length === 0 && (
          <View style={styles.empty}>
            <View style={styles.emptyGlow}>
              <Ionicons name="headset" size={56} color={BRAND.primaryLight} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('home.welcome')}</Text>
            <Text style={{ color: colors.textMuted, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>{t('home.welcomeDesc')}</Text>
            <TouchableOpacity style={styles.emptyCta} onPress={() => navigation.navigate('Discover')}>
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>{t('home.startExploring')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 54, paddingBottom: 8 },
  logo: { fontSize: 24 },
  headerIcons: { flexDirection: 'row', gap: 4 },
  hBtn: { padding: 4 },
  hIconBg: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  arIconBg: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.primary, shadowColor: BRAND.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 4 },

  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 10, borderRadius: 14, paddingHorizontal: 14, height: 44, gap: 10 },
  searchMic: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

  storiesList: { paddingHorizontal: 16, paddingVertical: 16, gap: 14 },
  storyItem: { alignItems: 'center', width: STORY_SIZE },
  storyGradientRing: { width: STORY_SIZE, height: STORY_SIZE, borderRadius: STORY_SIZE / 2, borderWidth: 2.5, borderColor: BRAND.primary, justifyContent: 'center', alignItems: 'center' },
  storyInner: { width: STORY_SIZE - 8, height: STORY_SIZE - 8, borderRadius: (STORY_SIZE - 8) / 2, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  storyAvatar: { width: STORY_SIZE - 12, height: STORY_SIZE - 12, borderRadius: (STORY_SIZE - 12) / 2 },
  storyName: { fontSize: 10, marginTop: 4, textAlign: 'center' },
  addStoryCircle: { width: STORY_SIZE, height: STORY_SIZE, borderRadius: STORY_SIZE / 2, justifyContent: 'center', alignItems: 'center' },
  addStoryPlus: { position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: BRAND.primary, justifyContent: 'center', alignItems: 'center', zIndex: 1 },

  npBanner: { marginHorizontal: 16, borderRadius: 16, padding: 14 },
  npRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  npThumb: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  npTitle: { fontSize: 14, fontWeight: '600' },
  npArBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: BRAND.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  npArText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  npLiveDot: { width: 8, height: 8, borderRadius: 4 },
  visualizer: { flexDirection: 'row', alignItems: 'flex-end', height: 24, marginTop: 10, gap: 1.5 },
  visBar: { flex: 1, borderRadius: 1, minHeight: 2 },

  section: { marginTop: 28 },
  secHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, marginBottom: 14 },
  secTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  seeAllBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },

  glassCard: { borderRadius: 14, overflow: 'hidden' },
  glassThumb: { overflow: 'hidden' },
  glassOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' },
  glassPlayBtn: { position: 'absolute', bottom: 10, right: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: BRAND.primary, justifyContent: 'center', alignItems: 'center', shadowColor: BRAND.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  glassInfo: { padding: 12 },
  glassTitle: { fontSize: 13, fontWeight: '600' },
  glassArtist: { fontSize: 11, marginTop: 3 },

  chartRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, gap: 12 },
  chartRank: { fontSize: 17, fontWeight: '800', width: 28, textAlign: 'center' },
  chartThumb: { width: 48, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  chartTitle: { fontSize: 14, fontWeight: '500' },
  chartBadge: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyGlow: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(124,58,237,0.1)', justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 22, fontWeight: '700', marginTop: 20 },
  emptyCta: { marginTop: 24, paddingHorizontal: 36, paddingVertical: 14, borderRadius: 28, backgroundColor: BRAND.primary },
});
