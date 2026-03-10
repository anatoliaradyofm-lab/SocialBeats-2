import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, FlatList,
  StyleSheet, Dimensions, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { usePlayer } from '../contexts/PlayerContext';
import api from '../services/api';

const { width: SW } = Dimensions.get('window');

const GENRES = [
  { id: 'all', label: 'Tümü', icon: 'apps' },
  { id: 'pop', label: 'Pop', icon: 'musical-notes' },
  { id: 'hiphop', label: 'Hip Hop', icon: 'headset' },
  { id: 'electronic', label: 'Elektronik', icon: 'radio' },
  { id: 'rock', label: 'Rock', icon: 'flash' },
  { id: 'rnb', label: 'R&B', icon: 'heart' },
  { id: 'jazz', label: 'Jazz', icon: 'cafe' },
  { id: 'classical', label: 'Klasik', icon: 'leaf' },
  { id: 'podcast', label: 'Podcast', icon: 'mic' },
];

const MOODS = [
  { id: 'happy', label: 'Mutlu', icon: 'sunny', color: '#F59E0B' },
  { id: 'sad', label: 'Hüzünlü', icon: 'rainy', color: '#6366F1' },
  { id: 'energetic', label: 'Enerjik', icon: 'flash', color: '#EF4444' },
  { id: 'chill', label: 'Rahat', icon: 'leaf', color: '#10B981' },
  { id: 'romantic', label: 'Romantik', icon: 'heart', color: BRAND.pink },
  { id: 'focus', label: 'Odaklan', icon: 'eye', color: BRAND.accent },
];

const ACTIVITIES = [
  { id: 'workout', label: 'Spor', icon: 'fitness' },
  { id: 'sleep', label: 'Uyku', icon: 'moon' },
  { id: 'study', label: 'Çalışma', icon: 'book' },
  { id: 'party', label: 'Parti', icon: 'beer' },
  { id: 'driving', label: 'Sürüş', icon: 'car' },
  { id: 'cooking', label: 'Yemek', icon: 'restaurant' },
];

function FeedCard({ track, colors, onPlay }) {
  return (
    <View style={[styles.feedCard, { backgroundColor: colors.surfaceElevated }]}>
      <View style={styles.feedUser}>
        <View style={[styles.feedAvatar, { backgroundColor: colors.card }]}>
          {track.user_avatar ? <Image source={{ uri: track.user_avatar }} style={styles.feedAvatar} /> : <Ionicons name="person" size={14} color={colors.textMuted} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.feedUsername, { color: colors.text }]}>{track.artist || 'Sanatçı'}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>{track.created_ago || ''}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.feedCover} onPress={onPlay} activeOpacity={0.9}>
        {track.thumbnail || track.cover_url ? (
          <Image source={{ uri: track.thumbnail || track.cover_url }} style={styles.feedCoverImg} resizeMode="cover" />
        ) : (
          <View style={[styles.feedCoverImg, { backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="musical-notes" size={36} color={BRAND.primaryLight} />
          </View>
        )}
        <View style={styles.feedPlayOverlay}>
          <View style={styles.feedPlayBtn}><Ionicons name="play" size={24} color="#FFF" /></View>
        </View>
      </TouchableOpacity>
      <View style={styles.feedInfo}>
        <Text style={[styles.feedTitle, { color: colors.text }]} numberOfLines={1}>{track.title || 'Şarkı'}</Text>
        {track.tags?.length > 0 && (
          <View style={styles.feedTags}>
            {track.tags.slice(0, 3).map((tag, i) => (
              <View key={i} style={[styles.feedTag, { backgroundColor: colors.card }]}>
                <Text style={{ color: BRAND.primaryLight, fontSize: 10 }}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={styles.feedActions}>
        <TouchableOpacity style={styles.feedAction}>
          <Ionicons name="heart-outline" size={20} color={colors.textSecondary} />
          <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 4 }}>{track.likes || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.feedAction}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.feedAction}>
          <Ionicons name="share-social-outline" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity><Ionicons name="bookmark-outline" size={18} color={colors.textSecondary} /></TouchableOpacity>
      </View>
    </View>
  );
}

export default function DiscoverScreen({ navigation }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { playTrack } = usePlayer();
  const [activeGenre, setActiveGenre] = useState('all');
  const [tracks, setTracks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState('feed');
  const [newReleases, setNewReleases] = useState([]);
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [trendingTracks, setTrendingTracks] = useState([]);
  const [forYou, setForYou] = useState([]);

  const fetchFeed = useCallback(async () => {
    try {
      const endpoint = activeGenre === 'all' ? '/discover/home' : `/music/search-unified?q=${encodeURIComponent(activeGenre)}&platform=all`;
      const res = await api.get(endpoint, token);
      setTracks(res.songs || res.tracks || res.results || res.trending || []);
    } catch { setTracks([]); }
  }, [token, activeGenre]);

  const fetchNewReleases = useCallback(async () => {
    try {
      const res = await api.get('/discover/new-releases?limit=20', token);
      setNewReleases(res.releases || []);
    } catch { setNewReleases([]); }
  }, [token]);

  const fetchTrending = useCallback(async () => {
    try {
      const res = await api.get('/discover/trending-content?limit=20', token);
      setTrendingPosts(res.trending_posts || []);
      setTrendingTracks(res.trending_tracks || []);
    } catch {
      setTrendingPosts([]);
      setTrendingTracks([]);
    }
  }, [token]);

  const fetchForYou = useCallback(async () => {
    try {
      const res = await api.get('/discover/for-you?limit=10', token);
      setForYou(res.tracks || res.recommendations || []);
    } catch { setForYou([]); }
  }, [token]);

  useEffect(() => {
    fetchFeed();
    fetchForYou();
  }, [fetchFeed, fetchForYou]);

  useEffect(() => {
    if (view === 'new') fetchNewReleases();
    if (view === 'trending7') fetchTrending();
  }, [view, fetchNewReleases, fetchTrending]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFeed();
    if (view === 'new') await fetchNewReleases();
    if (view === 'trending7') await fetchTrending();
    setRefreshing(false);
  };

  const VIEW_TABS = [
    { id: 'feed', label: 'Akış', icon: 'musical-notes' },
    { id: 'moods', label: 'Ruh Hali', icon: 'happy' },
    { id: 'activities', label: 'Aktivite', icon: 'fitness' },
    { id: 'trending', label: 'Trend', icon: 'trending-up' },
    { id: 'new', label: 'Yeni', icon: 'sparkles' },
    { id: 'trending7', label: '7 Gün', icon: 'flame' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Keşfet</Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <TouchableOpacity onPress={() => navigation.navigate('SuggestedUsers')}>
            <Ionicons name="people" size={22} color={BRAND.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Search')}>
            <Ionicons name="search" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* View toggles */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.viewRow}>
        {VIEW_TABS.map(v => (
          <TouchableOpacity key={v.id} style={[styles.viewChip, { backgroundColor: view === v.id ? BRAND.primary : colors.surfaceElevated }]} onPress={() => setView(v.id)}>
            <Ionicons name={v.icon} size={14} color={view === v.id ? '#FFF' : colors.textMuted} />
            <Text style={{ color: view === v.id ? '#FFF' : colors.textSecondary, fontSize: 13, fontWeight: '500' }}>{v.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* FEED VIEW */}
      {view === 'feed' && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {GENRES.map(g => (
              <TouchableOpacity key={g.id} style={[styles.chip, { backgroundColor: activeGenre === g.id ? BRAND.primary : colors.surfaceElevated }]} onPress={() => setActiveGenre(g.id)}>
                <Ionicons name={g.icon} size={14} color={activeGenre === g.id ? '#FFF' : colors.textMuted} />
                <Text style={{ color: activeGenre === g.id ? '#FFF' : colors.textSecondary, fontSize: 13 }}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* For You horizontal */}
          {forYou.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', paddingHorizontal: 16, marginBottom: 10 }}>Sana Özel</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
                {forYou.slice(0, 8).map((t, i) => (
                  <TouchableOpacity key={i} style={[styles.forYouCard, { backgroundColor: colors.surfaceElevated }]} onPress={() => playTrack(t, forYou)}>
                    <View style={[styles.forYouThumb, { backgroundColor: colors.card }]}>
                      {(t.thumbnail || t.cover_url) ? (
                        <Image source={{ uri: t.thumbnail || t.cover_url }} style={styles.forYouThumb} />
                      ) : (
                        <Ionicons name="musical-note" size={20} color={BRAND.primaryLight} />
                      )}
                    </View>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: '500', marginTop: 6 }} numberOfLines={1}>{t.title}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>{t.artist}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <FlatList data={tracks} renderItem={({ item }) => <FeedCard track={item} colors={colors} onPlay={() => playTrack(item, tracks)} />}
            keyExtractor={(item, i) => item.id || `${i}`}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}
            contentContainerStyle={{ paddingBottom: 120 }}
            ListEmptyComponent={<View style={styles.empty}><Ionicons name="compass-outline" size={52} color={colors.textMuted} /><Text style={{ color: colors.textMuted, marginTop: 16 }}>Henüz içerik yok</Text></View>}
          />
        </>
      )}

      {/* MOODS VIEW */}
      {view === 'moods' && (
        <ScrollView contentContainerStyle={styles.gridPad} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Ruh haline göre müzik bul</Text>
          <View style={styles.grid}>
            {MOODS.map(m => (
              <TouchableOpacity key={m.id} style={[styles.moodCard, { backgroundColor: colors.surfaceElevated }]} onPress={() => { setActiveGenre(m.id); setView('feed'); }}>
                <View style={[styles.moodIcon, { backgroundColor: `${m.color}18` }]}>
                  <Ionicons name={m.icon} size={28} color={m.color} />
                </View>
                <Text style={{ color: colors.text, fontWeight: '500', marginTop: 8 }}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ACTIVITIES VIEW */}
      {view === 'activities' && (
        <ScrollView contentContainerStyle={styles.gridPad} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Aktivitene göre müzik</Text>
          <View style={styles.grid}>
            {ACTIVITIES.map(a => (
              <TouchableOpacity key={a.id} style={[styles.moodCard, { backgroundColor: colors.surfaceElevated }]} onPress={() => { setActiveGenre(a.id); setView('feed'); }}>
                <Ionicons name={a.icon} size={32} color={BRAND.primary} />
                <Text style={{ color: colors.text, fontWeight: '500', marginTop: 8 }}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* TRENDING VIEW (from discover/home) */}
      {view === 'trending' && (
        <ScrollView contentContainerStyle={styles.gridPad} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Trend Müzikler</Text>
          {tracks.length > 0 ? tracks.map((t, i) => (
            <TouchableOpacity key={t.id || i} style={[styles.trendRow, { borderBottomColor: colors.border }]} onPress={() => playTrack(t, tracks)}>
              <Text style={[styles.trendRank, { color: i < 3 ? BRAND.primary : colors.textMuted }]}>{i + 1}</Text>
              <View style={[styles.trendThumb, { backgroundColor: colors.surfaceElevated }]}>
                {t.thumbnail ? <Image source={{ uri: t.thumbnail }} style={styles.trendThumb} /> : <Ionicons name="musical-note" size={16} color={BRAND.primaryLight} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>{t.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t.artist}</Text>
              </View>
              {i < 3 && <Ionicons name="trending-up" size={16} color="#10B981" />}
            </TouchableOpacity>
          )) : (
            <View style={styles.empty}><Text style={{ color: colors.textMuted }}>Veri yükleniyor...</Text></View>
          )}
        </ScrollView>
      )}

      {/* NEW RELEASES VIEW (last 24h) */}
      {view === 'new' && (
        <ScrollView contentContainerStyle={styles.gridPad} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 }}>
            <Ionicons name="sparkles" size={22} color={BRAND.primary} />
            <Text style={[styles.sectionLabel, { color: colors.text, marginBottom: 0 }]}>Yeni Çıkanlar</Text>
            <View style={[styles.badge24h, { backgroundColor: BRAND.primary + '20' }]}>
              <Text style={{ color: BRAND.primary, fontSize: 10, fontWeight: '700' }}>Son 24 Saat</Text>
            </View>
          </View>
          {newReleases.length > 0 ? newReleases.map((t, i) => (
            <TouchableOpacity key={t.id || i} style={[styles.trendRow, { borderBottomColor: colors.border }]} onPress={() => playTrack(t, newReleases)}>
              <View style={[styles.newBadge, { backgroundColor: i < 5 ? BRAND.primary : colors.textMuted }]}>
                <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '700' }}>YENİ</Text>
              </View>
              <View style={[styles.trendThumb, { backgroundColor: colors.surfaceElevated }]}>
                {t.thumbnail ? <Image source={{ uri: t.thumbnail }} style={styles.trendThumb} /> : <Ionicons name="musical-note" size={16} color={BRAND.primaryLight} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>{t.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t.artist}</Text>
              </View>
              {t.platform && (
                <View style={[styles.platformTag, { backgroundColor: colors.card }]}>
                  <Text style={{ color: colors.textMuted, fontSize: 9 }}>{t.platform}</Text>
                </View>
              )}
            </TouchableOpacity>
          )) : (
            <View style={styles.empty}>
              <Ionicons name="sparkles-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginTop: 12 }}>Henüz yeni çıkan yok</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* TRENDING CONTENT VIEW (last 7 days) */}
      {view === 'trending7' && (
        <ScrollView contentContainerStyle={styles.gridPad} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 }}>
            <Ionicons name="flame" size={22} color="#EF4444" />
            <Text style={[styles.sectionLabel, { color: colors.text, marginBottom: 0 }]}>Trend İçerikler</Text>
            <View style={[styles.badge24h, { backgroundColor: '#EF444420' }]}>
              <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '700' }}>Son 7 Gün</Text>
            </View>
          </View>

          {/* Trending Tracks */}
          {trendingTracks.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 12 }}>En Çok Dinlenenler</Text>
              {trendingTracks.map((t, i) => (
                <TouchableOpacity key={t.id || i} style={[styles.trendRow, { borderBottomColor: colors.border }]} onPress={() => playTrack(t, trendingTracks)}>
                  <Text style={[styles.trendRank, { color: i < 3 ? '#EF4444' : colors.textMuted }]}>{i + 1}</Text>
                  <View style={[styles.trendThumb, { backgroundColor: colors.surfaceElevated }]}>
                    {t.thumbnail ? <Image source={{ uri: t.thumbnail }} style={styles.trendThumb} /> : <Ionicons name="musical-note" size={16} color={BRAND.primaryLight} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>{t.title}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t.artist}</Text>
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t.play_count || 0} dinleme</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Trending Posts */}
          {trendingPosts.length > 0 && (
            <View>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: 12 }}>Popüler Gönderiler</Text>
              {trendingPosts.map((p, i) => (
                <TouchableOpacity key={p.id || i} style={[styles.trendPostRow, { backgroundColor: colors.surfaceElevated }]} onPress={() => navigation.navigate('PostDetail', { postId: p.id })}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <View style={[styles.miniAvatar, { backgroundColor: colors.card }]}>
                        {p.user?.avatar_url ? <Image source={{ uri: p.user.avatar_url }} style={styles.miniAvatar} /> : <Ionicons name="person" size={10} color={colors.textMuted} />}
                      </View>
                      <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>{p.user?.display_name || p.user?.username || 'Kullanıcı'}</Text>
                    </View>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={2}>{p.content || p.caption || ''}</Text>
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name="heart" size={12} color="#EF4444" />
                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{p.likes_count || 0}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name="chatbubble" size={12} color={colors.textMuted} />
                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{p.comments_count || 0}</Text>
                      </View>
                    </View>
                  </View>
                  {(p.media_urls?.length > 0) && (
                    <Image source={{ uri: p.media_urls[0] }} style={styles.trendPostImg} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {trendingTracks.length === 0 && trendingPosts.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="flame-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginTop: 12 }}>Henüz trend içerik yok</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  viewRow: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  viewChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6 },
  chipRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6 },
  feedCard: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  feedUser: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  feedAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  feedUsername: { fontSize: 13, fontWeight: '600' },
  feedCover: { width: '100%', aspectRatio: 16 / 9 },
  feedCoverImg: { width: '100%', height: '100%' },
  feedPlayOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  feedPlayBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(124,58,237,0.85)', justifyContent: 'center', alignItems: 'center' },
  feedInfo: { paddingHorizontal: 12, paddingTop: 10 },
  feedTitle: { fontSize: 15, fontWeight: '600' },
  feedTags: { flexDirection: 'row', gap: 6, marginTop: 6 },
  feedTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  feedActions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 16 },
  feedAction: { flexDirection: 'row', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 80 },
  gridPad: { padding: 16, paddingBottom: 120 },
  sectionLabel: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  moodCard: { width: (SW - 44) / 2, borderRadius: 16, padding: 20, alignItems: 'center' },
  moodIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  trendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, gap: 12 },
  trendRank: { fontSize: 17, fontWeight: '800', width: 28, textAlign: 'center' },
  trendThumb: { width: 48, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  forYouCard: { width: 130, borderRadius: 12, padding: 8, alignItems: 'center' },
  forYouThumb: { width: 114, height: 114, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  badge24h: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  newBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 4 },
  platformTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  trendPostRow: { flexDirection: 'row', padding: 12, borderRadius: 12, marginBottom: 10, gap: 10 },
  trendPostImg: { width: 60, height: 60, borderRadius: 8 },
  miniAvatar: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
});
