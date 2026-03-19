/**
 * DashboardScreen — NOVA Design System v3.0
 * 2025 Bento-grid home screen · Music social hub
 * Inspired by: Spotify Wrapped aesthetic · Apple Music 2025 · Mobbin top apps
 * Hero cards · Story rings · Horizontal scrollers · Now trending
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  RefreshControl, Pressable, ActivityIndicator, Dimensions,
  FlatList, Animated, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { usePlayer } from '../contexts/PlayerContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const { width: W } = Dimensions.get('window');
const PHONE_INNER_W = 374; // web preview phone frame inner width (390 - 8*2 border)
const HERO_W = typeof window !== 'undefined'
  ? Math.round(PHONE_INNER_W * 0.72)   // web: fixed phone width
  : Math.round(W * 0.72);               // native: real screen width

// ── Placeholder Data ──────────────────────────────────────────────────────────
const FEATURED = [
  { id:'f0', title:'Midnight Pulse',   artist:'Aurora X',       label:'NEW RELEASE', grad:['#1A0A2E','#9333EA','#08060F'] },
  { id:'f1', title:'Neon Dreams',      artist:'The Midnight',   label:'TRENDING',    grad:['#7C2D12','#EA580C','#08060F'] },
  { id:'f2', title:'Rose Gold',        artist:'Lana Wave',      label:'HOT NOW',     grad:['#500724','#9D174D','#08060F'] },
  { id:'f3', title:'Electric Soul',    artist:'Daft Vision',    label:'NEW RELEASE', grad:['#1E3A5F','#2563EB','#08060F'] },
  { id:'f4', title:'Crimson Tide',     artist:'Nova Beat',      label:'FEATURED',    grad:['#7F1D1D','#DC2626','#08060F'] },
  { id:'f5', title:'Golden Hour',      artist:'Sun Collective', label:'TRENDING',    grad:['#78350F','#D97706','#08060F'] },
  { id:'f6', title:'Deep Space',       artist:'Cosmo Funk',     label:'HOT NOW',     grad:['#0F172A','#4338CA','#08060F'] },
  { id:'f7', title:'Velvet Underground',artist:'Echo Drift',   label:'NEW RELEASE', grad:['#500724','#BE185D','#08060F'] },
  { id:'f8', title:'Arctic Flow',      artist:'Frost Wave',     label:'FEATURED',    grad:['#0C4A6E','#0891B2','#08060F'] },
  { id:'f9', title:'Jungle Rhythm',    artist:'Tropik',         label:'TRENDING',    grad:['#14532D','#16A34A','#08060F'] },
];

const PLAYLISTS = Array.from({ length: 8 }, (_, i) => ({
  id: `pl-${i}`,
  name: ['Chill Vibes','Workout Mix','Rainy Day','Party Time','Focus Mode','Road Trip','Morning Coffee','Night Owl'][i],
  cover: `https://picsum.photos/seed/pl${i * 7}/200/200`,
  count: [24,18,32,15,20,28,12,22][i],
}));

const RECENT = Array.from({ length: 8 }, (_, i) => ({
  id: `rc-${i}`,
  title:  ['Blinding Lights','Levitating','Peaches','Stay','Kiss Me More','Good 4 U','Montero','Butter'][i],
  artist: ['The Weeknd','Dua Lipa','Justin Bieber','Kid Laroi','Doja Cat','Olivia Rodrigo','Lil Nas X','BTS'][i],
  cover:  `https://picsum.photos/seed/rc${i * 3}/120/120`,
}));

const GENRES = [
  { id: 'g0', label: 'Pop',        emoji: '✨', grad: ['#4C1D95', '#C084FC'] },
  { id: 'g1', label: 'Hip-Hop',    emoji: '🔥', grad: ['#7C2D12', '#FB923C'] },
  { id: 'g2', label: 'R&B',        emoji: '🎵', grad: ['#500724', '#DB2777'] },
  { id: 'g3', label: 'Electronic', emoji: '⚡', grad: ['#1E3A5F', '#60A5FA'] },
];

const TRENDING = Array.from({ length: 6 }, (_, i) => ({
  id: `tr-${i}`,
  rank: i + 1,
  title:  ['Shape of You','Dance Monkey','Rockstar','One Dance','Closer','Sunflower'][i],
  artist: ['Ed Sheeran','Tones and I','Post Malone','Drake','Chainsmokers','Post Malone'][i],
  cover:  `https://picsum.photos/seed/tr${i * 5}/80/80`,
  plays:  ['1.2B','980M','850M','720M','650M','600M'][i],
}));


// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ title, onSeeAll, colors }) {
  return (
    <View style={sh.row}>
      <Text style={[sh.title, { color: colors.text }]}>{title}</Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={[sh.link, { color: colors.primary }]}>See all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
const sh = StyleSheet.create({
  row: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, marginBottom:8, marginTop:6 },
  title: { fontSize:15, fontWeight:'600', lineHeight:20, letterSpacing:-0.1 },
  link: { fontSize:12, fontWeight:'400', letterSpacing:0.1 },
});

// ── Drag-to-scroll (web only) ──────────────────────────────────────────────────
function useDragScroll() {
  const ref = useRef(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const getNode = () => ref.current?.getScrollableNode?.() ?? ref.current;
    let el = null;
    const timer = setTimeout(() => {
      el = getNode();
      if (!el) return;
      let down = false, startX = 0, scrollLeft = 0;
      const onDown  = e => { down = true; startX = e.pageX; scrollLeft = el.scrollLeft; el.style.cursor = 'grabbing'; e.preventDefault(); };
      const onUp    = ()  => { down = false; el.style.cursor = 'grab'; };
      const onMove  = e => { if (!down) return; e.preventDefault(); el.scrollLeft = scrollLeft - (e.pageX - startX) * 1.5; };
      el.style.cursor = 'grab';
      el.style.userSelect = 'none';
      el.addEventListener('mousedown',  onDown);
      el.addEventListener('mouseup',    onUp);
      el.addEventListener('mouseleave', onUp);
      el.addEventListener('mousemove',  onMove, { passive: false });
    }, 300);
    return () => {
      clearTimeout(timer);
      if (el) el.style.cursor = '';
    };
  }, []);
  return ref;
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function DashboardScreen({ navigation }) {
  const { colors }      = useTheme();
  const { user, token } = useAuth();
  const { playTrack }   = usePlayer() || {};
  const { t }           = useTranslation();
  const featuredRef     = useDragScroll();
  const insets          = useSafeAreaInsets();

  const [refreshing, setRefreshing]     = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;

  // ── Stories ────────────────────────────────────────────────
  const [storiesFeed, setStoriesFeed]   = useState([]);
  const [myStory, setMyStory]           = useState(null);

  const loadStories = useCallback(async () => {
    if (!token) return;
    try {
      const [feedRes, myRes] = await Promise.allSettled([
        api.get('/stories/feed', token),
        api.get('/stories/my', token),
      ]);
      if (feedRes.status === 'fulfilled') {
        setStoriesFeed(Array.isArray(feedRes.value) ? feedRes.value : []);
      }
      if (myRes.status === 'fulfilled') {
        const mine = Array.isArray(myRes.value) ? myRes.value : [];
        setMyStory(mine.length > 0 ? mine : null);
      }
    } catch { /* silently fail */ }
  }, [token]);

  useEffect(() => { loadStories(); }, [loadStories]);

  // ── Inline Search ──────────────────────────────────────────
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchDebounce = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!searchQuery.trim()) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    searchDebounce.current = setTimeout(async () => {
      try {
        const res = await api.get(`/music-hybrid/search?q=${encodeURIComponent(searchQuery.trim())}&limit=8`);
        const items = Array.isArray(res) ? res : (res?.tracks || res?.results || []);
        setSearchResults(items);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(searchDebounce.current);
  }, [searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStories();
    setTimeout(() => setRefreshing(false), 800);
  }, [loadStories]);

  const s = createStyles(colors, insets);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('dashboard.greetingMorning') + ' ☀️';
    if (h < 17) return t('dashboard.greetingAfternoon') + ' 🌤️';
    return t('dashboard.greetingEvening') + ' 🌙';
  };

  return (
    <View style={s.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={s.content}
      >

        {/* ── Hero gradient background (header + stories) ─────────── */}
        <LinearGradient
          colors={['#1A0A2E', '#100620', '#08060F']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={s.heroBg}
        >

        {/* ── Header ────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerTop}>
            <View style={s.headerLeft}>
              <Text style={s.greeting}>{greeting()}</Text>
              <Text style={s.userName} numberOfLines={1} ellipsizeMode="tail">
                {(() => { const n = user?.username || user?.name || t('dashboard.listener'); return n.charAt(0).toUpperCase() + n.slice(1); })()}
              </Text>
            </View>
            <View style={s.headerRight}>
              <TouchableOpacity style={s.headerIconBtn} onPress={() => navigation.navigate('Conversations')}>
                <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={s.headerIconBtn} onPress={() => navigation.navigate('Notifications')}>
                <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
                <View style={[s.badge, { backgroundColor: '#FF3B30' }]} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={s.avatarWrap}>
                <Image
                  source={{ uri: user?.avatar || `https://i.pravatar.cc/80?u=${user?.id}` }}
                  style={s.avatar}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Stories ─────────────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.storiesScroll} contentContainerStyle={s.storiesContent}>
          {/* Your story */}
          <TouchableOpacity
            style={s.storyWrap}
            activeOpacity={0.85}
            onPress={() => {
              if (myStory) {
                navigation.navigate('StoryViewer', {
                  feed: [{
                    username: user?.username || 'me',
                    user_display_name: user?.display_name || user?.username || 'Me',
                    user_avatar: user?.avatar || `https://i.pravatar.cc/80?u=${user?.id}`,
                    user_id: user?.id,
                    stories: myStory,
                  }],
                  startUserIndex: 0,
                  startStoryIndex: 0,
                });
              } else {
                navigation.navigate('StoryCreate');
              }
            }}
          >
            {/* Ring: renkli = hikaye var, gri = yok */}
            {myStory ? (
              <LinearGradient
                colors={['#FBBF24', '#F43F5E', '#9333EA']}
                start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
                style={s.storyRingActive}
              >
                <View style={s.storyAvatarWrap}>
                  <Image
                    source={{ uri: user?.avatar || `https://i.pravatar.cc/80?u=${user?.id}` }}
                    style={s.storyAvatar}
                  />
                </View>
              </LinearGradient>
            ) : (
              <View style={s.storyRingInactive}>
                <View style={s.storyAvatarWrap}>
                  <Image
                    source={{ uri: user?.avatar || `https://i.pravatar.cc/80?u=${user?.id}` }}
                    style={s.storyAvatar}
                  />
                  <View style={[s.storyAddBadge, { backgroundColor: colors.primary }]}>
                    <Ionicons name="add" size={11} color="#FFF" />
                  </View>
                </View>
              </View>
            )}
            <Text style={[s.storyUser, { color: colors.textSecondary }]} numberOfLines={1} selectable={false}>
              Hikayem
            </Text>
          </TouchableOpacity>

          {/* Other users' stories */}
          {storiesFeed.map((group, idx) => {
            const avatar = group.user_avatar || `https://i.pravatar.cc/100?u=${group.username}`;
            const hasUnseen = group.has_unviewed !== false;
            return (
              <TouchableOpacity
                key={group.user_id || group.username || idx}
                style={s.storyWrap}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('StoryViewer', {
                  feed: storiesFeed,
                  startUserIndex: idx,
                  startStoryIndex: 0,
                })}
              >
                {hasUnseen ? (
                  <LinearGradient
                    colors={['#FBBF24', '#F43F5E', '#9333EA']}
                    start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
                    style={s.storyRingActive}
                  >
                    <View style={s.storyAvatarWrap}>
                      <Image source={{ uri: avatar }} style={s.storyAvatar} />
                    </View>
                  </LinearGradient>
                ) : (
                  <View style={s.storyRingInactive}>
                    <View style={s.storyAvatarWrap}>
                      <Image source={{ uri: avatar }} style={s.storyAvatar} />
                    </View>
                  </View>
                )}
                <Text style={[s.storyUser, { color: colors.textSecondary }]} numberOfLines={1} selectable={false}>
                  {group.username}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        </LinearGradient>

        {/* ── Search Bar ───────────────────────────────────────────── */}
        <View style={s.searchWrap}>
          <View style={[s.searchBar, { backgroundColor: colors.searchBg, borderColor: searchFocused ? colors.primary : colors.border }]}>
            <Ionicons name="search-outline" size={16} color={searchFocused ? colors.primary : colors.textMuted} />
            <TextInput
              ref={searchInputRef}
              style={[s.searchInput, { color: colors.text }]}
              placeholder={t('dashboard.searchPlaceholder')}
              placeholderTextColor={colors.textGhost}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => { if (!searchQuery) setSearchFocused(false); }}
              returnKeyType="search"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); setSearchFocused(false); searchInputRef.current?.blur(); }}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : (
              <View style={[s.searchMic, { backgroundColor: colors.primaryGlow }]}>
                <Ionicons name="mic-outline" size={14} color={colors.primary} />
              </View>
            )}
          </View>
          {(searchFocused && searchQuery.trim().length > 0) && (
            <View style={[s.searchDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {searchLoading ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ padding: 16 }} />
              ) : searchResults.length === 0 ? (
                <Text style={[s.searchEmpty, { color: colors.textMuted }]}>"{searchQuery}" için sonuç bulunamadı</Text>
              ) : (
                searchResults.map((item, idx) => (
                  <TouchableOpacity
                    key={item.id || item._id || idx}
                    style={[s.searchResultRow, { borderBottomColor: colors.border, borderBottomWidth: idx < searchResults.length - 1 ? 1 : 0 }]}
                    onPress={() => { playTrack?.(item); setSearchQuery(''); setSearchResults([]); setSearchFocused(false); }}
                  >
                    {item.cover_url || item.cover ? (
                      <Image source={{ uri: item.cover_url || item.cover }} style={s.searchResultCover} />
                    ) : (
                      <View style={[s.searchResultCover, { backgroundColor: colors.primaryGlow, alignItems:'center', justifyContent:'center' }]}>
                        <Ionicons name="musical-note" size={16} color={colors.primary} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[s.searchResultTitle, { color: colors.text }]} numberOfLines={1}>{item.title || item.name}</Text>
                      <Text style={[s.searchResultArtist, { color: colors.textMuted }]} numberOfLines={1}>{item.artist || item.artist_name || ''}</Text>
                    </View>
                    <Ionicons name="play-circle-outline" size={20} color={colors.primary} />
                  </TouchableOpacity>
                ))
              )}
              <TouchableOpacity
                style={[s.searchSeeAll, { borderTopColor: colors.border }]}
                onPress={() => { navigation.navigate('Search', { query: searchQuery }); setSearchFocused(false); }}
              >
                <Text style={[s.searchSeeAllText, { color: colors.primary }]}>{t('common.seeAll')}</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Featured Hero ────────────────────────────────────────── */}
        <SectionHeader title={t('dashboard.featured')} colors={colors} />
        <ScrollView
          ref={featuredRef}
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}

          contentContainerStyle={{ paddingLeft: 20, paddingRight: 20, gap: 12 }}
          decelerationRate="fast"
          snapToInterval={HERO_W + 12}
          snapToAlignment="start"
          style={{ marginBottom: 6 }}
        >
          {FEATURED.map((f, i) => (
            <TouchableOpacity key={f.id} activeOpacity={0.95} style={s.heroCard}>
              <LinearGradient colors={f.grad} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={StyleSheet.absoluteFill} />
              <View style={s.heroOverlay}>
                <View style={s.heroLabel}>
                  <View style={s.heroBadge}>
                    <Text style={s.heroBadgeText}>{f.label}</Text>
                  </View>
                </View>
                <Text style={s.heroTitle}>{f.title}</Text>
                <Text style={s.heroArtist}>{f.artist}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>


        {/* ── Discover Genres ──────────────────────────────────────── */}
        <SectionHeader title="Discover Genres" onSeeAll={() => navigation.navigate('Search')} colors={colors} />
        <View style={s.genreRow}>
          {GENRES.slice(0,2).map(g => (
            <TouchableOpacity key={g.id} activeOpacity={0.85} style={{ flex: 1 }}>
              <LinearGradient colors={g.grad} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={s.genreCard}>
                <Text style={s.genreEmoji}>{g.emoji}</Text>
                <Text style={s.genreLabel}>{g.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
        {false && <View style={[s.genreRow, { marginTop: -12 }]}>
          {GENRES.slice(2,4).map(g => (
            <TouchableOpacity key={g.id} activeOpacity={0.85} style={{ flex: 1 }}>
              <LinearGradient colors={g.grad} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={s.genreCard}>
                <Text style={s.genreEmoji}>{g.emoji}</Text>
                <Text style={s.genreLabel}>{g.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>}

        {/* ── Jump Back In ─────────────────────────────────────────── */}
        <SectionHeader title={t('dashboard.jumpBackIn')} onSeeAll={() => navigation.navigate('Library')} colors={colors} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScrollContent} style={s.hScroll}>
          {RECENT.map(r => (
            <TouchableOpacity key={r.id} style={s.recentCard} onPress={() => playTrack?.(r)} activeOpacity={0.85}>
              <Image source={{ uri: r.cover }} style={s.recentCover} />
              <View style={s.recentOverlay}>
                <Ionicons name="play-circle" size={28} color="rgba(255,255,255,0.9)" />
              </View>
              <Text style={[s.recentTitle, { color: colors.text }]} numberOfLines={1}>{r.title}</Text>
              <Text style={[s.recentArtist, { color: colors.textMuted }]} numberOfLines={1}>{r.artist}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Made For You ──────────────────────────────────────────── */}
        <SectionHeader title={t('dashboard.madeForYou')} onSeeAll={() => navigation.navigate('Library')} colors={colors} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScrollContent} style={s.hScroll}>
          {PLAYLISTS.map(p => (
            <TouchableOpacity key={p.id} style={s.playlistCard} onPress={() => navigation.navigate('PlaylistDetail', { playlistId: p.id, playlist: p })} activeOpacity={0.88}>
              <Image source={{ uri: p.cover }} style={s.playlistCover} />
              <Text style={[s.playlistName, { color: colors.text }]} numberOfLines={2}>{p.name}</Text>
              <Text style={[s.playlistCount, { color: colors.textMuted }]}>{p.count} {t('dashboard.tracks')}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Trending Now ──────────────────────────────────────────── */}
        <SectionHeader title={t('dashboard.trendingNow')} onSeeAll={() => navigation.navigate('Search')} colors={colors} />
        <View style={s.trendList}>
          {TRENDING.map((tr, i) => (
            <TouchableOpacity key={tr.id} style={[s.trendRow, { borderBottomColor: colors.border, borderBottomWidth: i < TRENDING.length - 1 ? 1 : 0 }]} onPress={() => playTrack?.(tr)} activeOpacity={0.85}>
              <Text style={[s.trendRank, { color: i < 3 ? colors.primary : colors.textMuted }]}>
                {String(tr.rank).padStart(2,'0')}
              </Text>
              <Image source={{ uri: tr.cover }} style={s.trendCover} />
              <View style={s.trendInfo}>
                <Text style={[s.trendTitle, { color: colors.text }]} numberOfLines={1}>{tr.title}</Text>
                <Text style={[s.trendArtist, { color: colors.textMuted }]} numberOfLines={1}>{tr.artist}</Text>
              </View>
              <View style={s.trendRight}>
                <Text style={[s.trendPlays, { color: colors.textMuted }]}>{tr.plays}</Text>
                <TouchableOpacity hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
                  <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Discover People ───────────────────────────────────────── */}
        <TouchableOpacity activeOpacity={0.88} onPress={() => navigation.navigate('DiscoverPeople')}>
          <LinearGradient colors={['rgba(168,85,247,0.2)','rgba(34,211,238,0.15)']} start={{ x:0,y:0 }} end={{ x:1,y:0 }} style={s.discoverBanner}>
            <View style={s.discoverLeft}>
              <Text style={[s.discoverTitle, { color: colors.text }]}>Discover People</Text>
              <Text style={[s.discoverSub, { color: colors.textSecondary }]}>Find friends who share your taste</Text>
            </View>
            <View style={[s.discoverIcon, { backgroundColor: colors.primaryGlow }]}>
              <Ionicons name="people" size={24} color={colors.primary} />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

function createStyles(colors, insets) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: 16 },
    heroBg: { overflow: 'hidden' },

    // Header
    header: {
      paddingTop: insets.top + 6,
      paddingBottom: 6,
      overflow: 'hidden',
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
    },
    headerLeft: { gap: 1, flex: 1, paddingRight: 16 },
    greeting: { fontSize: 10, color: colors.textMuted, fontWeight: '500', letterSpacing: 2.0, textTransform: 'uppercase' },
    userName: { fontSize: 28, fontWeight: '700', color: colors.text, lineHeight: 34, letterSpacing: -0.5 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
    headerBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerIconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(255,255,255,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
    },
    badge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 8,
      height: 8,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: colors.background,
    },
    avatarWrap: {
      borderRadius: 20,
      borderWidth: 2,
      borderColor: colors.primary,
      padding: 1.5,
    },
    avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface },

    // Search Bar
    searchWrap: { marginHorizontal: 20, marginTop: 4, marginBottom: 6, zIndex: 100 },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 8,
    },
    searchInput: { flex: 1, fontSize: 14, fontWeight: '400', paddingVertical: 0, letterSpacing: 0 },
    searchMic: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchDropdown: {
      marginHorizontal: 20,
      marginTop: 4,
      borderRadius: 16,
      borderWidth: 1,
      overflow: 'hidden',
      zIndex: 100,
    },
    searchEmpty: { fontSize: 13, textAlign: 'center', paddingVertical: 18, paddingHorizontal: 16, fontWeight: '400' },
    searchResultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 12,
    },
    searchResultCover: { width: 40, height: 40, borderRadius: 8 },
    searchResultTitle: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
    searchResultArtist: { fontSize: 12, marginTop: 1, fontWeight: '400' },
    searchSeeAll: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderTopWidth: 1,
    },
    searchSeeAllText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.1 },

    // Stories
    storiesScroll: { paddingTop: 6, marginBottom: 0 },
    storiesContent: { paddingHorizontal: 20, gap: 16 },
    storyWrap: { alignItems: 'center', gap: 6 },
    // Renkli gradient ring (hikaye var / görülmemiş)
    storyRingActive: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 2.5,
    },
    // Gri ring (hikaye yok / görülmüş)
    storyRingInactive: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 2.5,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.20)',
    },
    // Avatar için iç beyaz boşluk (ring ile fotoğraf arası)
    storyAvatarWrap: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 2,
      position: 'relative',
    },
    storyAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface },
    storyUser: { fontSize: 11, fontWeight: '400', maxWidth: 68, textAlign: 'center' },
    storyAddBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.background,
    },

    // Hero
    heroCard: {
      width: HERO_W,
      height: 160,
      borderRadius: 18,
      overflow: 'hidden',
    },
    heroCover: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
    heroOverlay: {
      flex: 1,
      padding: 20,
      justifyContent: 'flex-end',
    },
    heroLabel: { flexDirection: 'row', marginBottom: 10 },
    heroBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(147,51,234,0.55)', alignSelf: 'flex-start' },
    heroBadgeText: { fontSize: 9, fontWeight: '600', color: '#FFF', letterSpacing: 1.8, textTransform: 'uppercase' },
    heroTitle: { fontSize: 24, fontWeight: '700', color: '#FFF', letterSpacing: -0.6, lineHeight: 29, marginBottom: 4 },
    heroArtist: { fontSize: 13, fontWeight: '300', color: 'rgba(255,255,255,0.65)', marginBottom: 4, letterSpacing: 0.2 },
    heroActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    heroPlay: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
    },
    heroPlayText: { fontSize: 12, fontWeight: '600', color: '#FFF', letterSpacing: 0.3 },
    heroMore: { padding: 4 },
    dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 24 },
    dot: { height: 6, borderRadius: 3, backgroundColor: colors.border },

    // Horizontal scroll
    hScroll: { marginBottom: 8 },
    hScrollContent: { paddingHorizontal: 20, gap: 14 },

    // Recent
    recentCard: { width: 100, gap: 6 },
    recentCover: { width: 100, height: 100, borderRadius: 16, backgroundColor: colors.surface },
    recentOverlay: {
      ...StyleSheet.absoluteFillObject,
      top: 0, left: 0, right: 0,
      height: 100,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    recentTitle: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
    recentArtist: { fontSize: 11, fontWeight: '400', marginTop: 1 },

    // Playlists
    playlistCard: { width: 128, gap: 7 },
    playlistCover: { width: 128, height: 128, borderRadius: 18, backgroundColor: colors.surface },
    playlistName: { fontSize: 14, fontWeight: '600', lineHeight: 18, letterSpacing: -0.2 },
    playlistCount: { fontSize: 11, fontWeight: '400' },

    // Genres
    genreRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 8 },
    genreCard: { flex: 1, height: 80, borderRadius: 20, padding: 12, justifyContent: 'flex-end', overflow: 'hidden' },
    genreEmoji: { fontSize: 22, marginBottom: 6 },
    genreLabel: { fontSize: 15, fontWeight: '700', color: '#FFF', letterSpacing: -0.3 },

    // Trending
    trendList: {
      marginHorizontal: 20,
      marginBottom: 24,
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      overflow: 'hidden',
    },
    trendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      gap: 12,
    },
    trendRank: { fontSize: 13, fontWeight: '700', width: 26, textAlign: 'center', letterSpacing: -0.3 },
    trendCover: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.surface },
    trendInfo: { flex: 1, gap: 3 },
    trendTitle: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
    trendArtist: { fontSize: 12, fontWeight: '400' },
    trendRight: { alignItems: 'flex-end', gap: 4 },
    trendPlays: { fontSize: 11, fontWeight: '400' },

    // Discover Banner
    discoverBanner: {
      marginHorizontal: 20,
      marginBottom: 20,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 18,
    },
    discoverLeft: { gap: 4, flex: 1 },
    discoverTitle: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
    discoverSub: { fontSize: 13, fontWeight: '300', lineHeight: 18 },
    discoverIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
