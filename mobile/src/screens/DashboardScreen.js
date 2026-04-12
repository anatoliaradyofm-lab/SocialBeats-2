/**
 * DashboardScreen — NOVA Design System v3.0
 * 2025 Bento-grid home screen · Music social hub
 * QENARA Design System · 2025 premium music experience
 * Hero cards · Story rings · Horizontal scrollers · Now trending
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import { getRecentTracks } from '../services/historyService';
import { getLocale } from '../lib/localeStore';
import NativeAdSlot from '../components/ads/NativeAdSlot';
import { Alert } from '../components/ui/AppAlert';

const { width: W } = Dimensions.get('window');
const PHONE_INNER_W = 374; // web preview phone frame inner width (390 - 8*2 border)
const HERO_W = typeof window !== 'undefined'
  ? Math.round(PHONE_INNER_W * 0.72)   // web: fixed phone width
  : Math.round(W * 0.72);               // native: real screen width

// ── Genres (static — görsel amaçlı) ──────────────────────────────────────────
const GENRES = [
  { id: 'g0', label: 'Pop',        emoji: '✨', grad: ['#4C1D95', '#C084FC'] },
  { id: 'g1', label: 'Hip-Hop',    emoji: '🔥', grad: ['#7C2D12', '#FB923C'] },
  { id: 'g2', label: 'R&B',        emoji: '🎵', grad: ['#500724', '#DB2777'] },
  { id: 'g3', label: 'Electronic', emoji: '⚡', grad: ['#1E3A5F', '#60A5FA'] },
];


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
  row: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, marginBottom:10, marginTop:20 },
  title: { fontSize:17, fontWeight:'700', lineHeight:22, letterSpacing:-0.3 },
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
  const { user, token, isGuest } = useAuth();
  const requireAuth = (screenOrCb) => {
    if (isGuest || !token) {
      Alert.alert('Giriş Gerekli', 'Bu özelliği kullanmak için giriş yapmanız gerekiyor.', [
        { text: 'İptal', style: 'cancel' },
        { text: 'Giriş Yap', onPress: () => navigation.navigate('Auth') },
      ]);
      return;
    }
    if (typeof screenOrCb === 'function') screenOrCb();
    else navigation.navigate(screenOrCb);
  };
  const { playTrack }   = usePlayer() || {};
  const { t }           = useTranslation();
  const featuredRef     = useDragScroll();
  const forYouRef       = useDragScroll();
  const recentRef       = useDragScroll();
  const insets          = useSafeAreaInsets();

  const [refreshing, setRefreshing]       = useState(false);
  const [unreadMsgCount, setUnreadMsgCount]   = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  // ── Home Data (SoundCloud — 24h cache) ────────────────────────
  const [homeData,    setHomeData]    = useState({ featured: [], trending: [], for_you: [] });
  const [homeLoading, setHomeLoading] = useState(true);

  const loadHomeData = useCallback(async (forceRefresh = false) => {
    try {
      const country = user?.country || user?.location_country || getLocale().countryCode || '';
      let url = country
        ? `/music-hybrid/home?country=${encodeURIComponent(country)}`
        : '/music-hybrid/home';
      if (forceRefresh) url += (url.includes('?') ? '&' : '?') + 'force_refresh=true';
      const res = await api.get(url);
      if (res && (res.featured?.length || res.trending?.length)) {
        setHomeData(res);
      }
    } catch (e) {
      // sessizce geç — veriler zaten boş array
    } finally {
      setHomeLoading(false);
    }
  }, [user?.country, user?.location_country]);

  useEffect(() => { loadHomeData(); }, [loadHomeData]);

  // ── Dinleme Geçmişi (Kaldığın Yerden) ─────────────────────────
  const [recentHistory, setRecentHistory] = useState([]);

  const loadRecentHistory = useCallback(async () => {
    try {
      const tracks = await getRecentTracks(5);
      setRecentHistory(tracks);
    } catch { /* sessizce geç */ }
  }, []);

  useEffect(() => { loadRecentHistory(); }, [loadRecentHistory]);
  // Ekrana dönünce geçmişi yenile
  useFocusEffect(useCallback(() => { loadRecentHistory(); }, [loadRecentHistory]));

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
        const allFeed = Array.isArray(feedRes.value) ? feedRes.value : [];
        // Own stories shown via the separate "Hikayem" button — exclude from feed row
        setStoriesFeed(allFeed.filter(g => g.user_id !== user?.id));
      }
      if (myRes.status === 'fulfilled') {
        const mine = Array.isArray(myRes.value) ? myRes.value : [];
        const sorted = mine.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        setMyStory(sorted.length > 0 ? sorted : null);
      }
    } catch { /* silently fail */ }
  }, [token]);

  useEffect(() => { loadStories(); }, [loadStories]);
  useFocusEffect(useCallback(() => { loadStories(); }, [loadStories]));

  const fetchUnreadCounts = useCallback(() => {
    if (!token) return;
    api.get('/messages/unread-count', token)
      .then(res => setUnreadMsgCount(res?.count ?? 0))
      .catch(() => {});
    api.get('/notifications/unread-count', token)
      .then(res => setUnreadNotifCount(res?.count ?? 0))
      .catch(() => {});
  }, [token]);

  useEffect(() => { fetchUnreadCounts(); }, [fetchUnreadCounts]);

  useFocusEffect(useCallback(() => { fetchUnreadCounts(); }, [fetchUnreadCounts]));

  // Web preview: okundu event'lerinde sayaçları güncelle
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => fetchUnreadCounts();
    window.addEventListener('sb:msg-read', handler);
    window.addEventListener('sb:notif-read', handler);
    return () => {
      window.removeEventListener('sb:msg-read', handler);
      window.removeEventListener('sb:notif-read', handler);
    };
  }, [fetchUnreadCounts]);

  // ── Inline Search ──────────────────────────────────────────
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [dropdownTop,   setDropdownTop]   = useState(160);
  const searchDebounce = useRef(null);
  const searchInputRef = useRef(null);
  const searchWrapRef  = useRef(null);

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
    await Promise.allSettled([loadStories(), loadHomeData(true), loadRecentHistory()]);
    setTimeout(() => setRefreshing(false), 800);
  }, [loadStories, loadHomeData, loadRecentHistory]);

  const s = createStyles(colors, insets);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('dashboard.greetingMorning') + ' ☀️';
    if (h < 17) return t('dashboard.greetingAfternoon') + ' 🌤️';
    return t('dashboard.greetingEvening') + ' 🌙';
  };

  const searchDropdownContent = (searchFocused && searchQuery.trim().length > 0) && (
    <View style={[s.searchDropdown, { backgroundColor: '#130A24', borderColor: 'rgba(192,132,252,0.15)' }]}>
      {searchLoading ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ padding: 20 }} />
      ) : searchResults.length === 0 ? (
        <Text style={[s.searchEmpty, { color: colors.textMuted }]}>"{searchQuery}" için sonuç bulunamadı</Text>
      ) : (
        searchResults.map((item, idx) => (
          <TouchableOpacity
            key={item.id || item._id || idx}
            style={[s.searchResultRow, { borderBottomColor: 'rgba(192,132,252,0.10)', borderBottomWidth: idx < searchResults.length - 1 ? 1 : 0 }]}
            onPress={() => { playTrack?.(item); setSearchQuery(''); setSearchResults([]); setSearchFocused(false); }}
          >
            {item.cover_url || item.cover ? (
              <Image source={{ uri: item.cover_url || item.cover }} style={s.searchResultCover} />
            ) : (
              <View style={[s.searchResultCover, { backgroundColor: colors.primaryGlow, alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="musical-note" size={16} color={colors.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[s.searchResultTitle, { color: colors.text }]} numberOfLines={1}>{item.title || item.name}</Text>
              <Text style={[s.searchResultArtist, { color: colors.textMuted }]} numberOfLines={1}>{item.artist || item.artist_name || ''}</Text>
            </View>
            <Ionicons name="play-circle-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  return (
    <View style={s.root}>
      {Platform.OS === 'web' && searchDropdownContent && (
        <View style={{ position: 'fixed', top: dropdownTop, left: 0, right: 0, bottom: 68, zIndex: 9999 }}>
          {searchDropdownContent}
        </View>
      )}
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEnabled={!searchFocused}
        keyboardShouldPersistTaps="always"
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
              <Text style={[s.userName, { fontSize: Math.max(16, 28 - Math.max(0, ((user?.username || user?.name || '').length - 8) * 1.2)) }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {(() => { const n = user?.username || user?.name || t('dashboard.listener'); return n.charAt(0).toUpperCase() + n.slice(1); })()}
              </Text>
            </View>
            <View style={s.headerRight}>
              <TouchableOpacity style={s.headerIconBtn} onPress={() => requireAuth('Conversations')}>
                <Ionicons name="chatbubble-outline" size={20} color="#F8F8F8" />
                {unreadMsgCount > 0 && (
                  <View style={[s.msgBadge, { backgroundColor: colors.accent || '#FB923C' }]}>
                    <Text style={s.msgBadgeText}>{unreadMsgCount > 99 ? '99+' : unreadMsgCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.headerIconBtn} onPress={() => requireAuth('Notifications')}>
                <Ionicons name="notifications-outline" size={20} color="#F8F8F8" />
                {unreadNotifCount > 0 && (
                  <View style={[s.msgBadge, { backgroundColor: '#FF3B30' }]}>
                    <Text style={s.msgBadgeText}>{unreadNotifCount > 99 ? '99+' : unreadNotifCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={s.avatarWrap}>
                {isGuest ? (
                  <View style={[s.avatar, { backgroundColor: 'rgba(192,132,252,0.15)', alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="person-outline" size={16} color="#C084FC" />
                  </View>
                ) : (
                  <Image
                    source={{ uri: user?.avatar_url || user?.avatar || `https://i.pravatar.cc/80?u=${user?.id}` }}
                    style={s.avatar}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Stories ─────────────────────────────────────────────── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.storiesScroll} contentContainerStyle={s.storiesContent}>
          {/* Your story — misafirde gösterme */}
          {!isGuest && <TouchableOpacity
            style={s.storyWrap}
            activeOpacity={0.85}
            onPress={() => requireAuth(() => {
              if (myStory) {
                navigation.navigate('StoryViewer', {
                  feed: [{
                    username: user?.username || 'me',
                    user_display_name: user?.display_name || user?.username || 'Me',
                    user_avatar: user?.avatar_url || user?.avatar || `https://i.pravatar.cc/80?u=${user?.id}`,
                    user_id: user?.id,
                    stories: myStory,
                  }],
                  startUserIndex: 0,
                  startStoryIndex: 0,
                });
              } else {
                navigation.navigate('StoryCreate');
              }
            })}
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
                    source={{ uri: user?.avatar_url || user?.avatar || `https://i.pravatar.cc/80?u=${user?.id}` }}
                    style={s.storyAvatar}
                  />
                  {/* Yeni hikaye ekle — iç badge tıklanınca StoryCreate açılır */}
                  <TouchableOpacity
                    style={[s.storyAddBadge, { backgroundColor: colors.primary }]}
                    onPress={() => navigation.navigate('StoryCreate')}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="add" size={11} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            ) : (
              <View style={s.storyRingInactive}>
                <View style={s.storyAvatarWrap}>
                  <Image
                    source={{ uri: user?.avatar_url || user?.avatar || `https://i.pravatar.cc/80?u=${user?.id}` }}
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
          </TouchableOpacity>}

          {/* Other users' stories */}
          {storiesFeed.map((group, idx) => {
            const avatar = group.user_avatar || `https://i.pravatar.cc/100?u=${group.username}`;
            const hasUnseen = group.has_unviewed !== false;
            return (
              <TouchableOpacity
                key={group.user_id || group.username || idx}
                style={s.storyWrap}
                activeOpacity={0.85}
                onPress={() => requireAuth(() => navigation.navigate('StoryViewer', {
                  feed: storiesFeed,
                  startUserIndex: idx,
                  startStoryIndex: 0,
                }))}
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
        <View ref={searchWrapRef} style={s.searchWrap}>
          {Platform.OS !== 'web' && searchDropdownContent && (
            <View style={{ position: 'absolute', top: 52, left: 0, right: 0, zIndex: 999 }}>
              {searchDropdownContent}
            </View>
          )}
          <View style={[s.searchBar, { backgroundColor: searchFocused ? colors.inputBg : colors.searchBg, borderColor: searchFocused ? colors.primary : colors.border, borderWidth: searchFocused ? 2 : 1 }]}>
            <Ionicons name="search-outline" size={16} color={searchFocused ? colors.primary : colors.textMuted} />
            <TextInput
              ref={searchInputRef}
              style={[s.searchInput, { color: colors.text }]}
              placeholder={t('dashboard.searchPlaceholder')}
              placeholderTextColor={colors.textGhost}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => {
                setSearchFocused(true);
                searchWrapRef.current?.measure?.((x, y, w, h, px, py) => {
                  setDropdownTop(py + h - 20);
                });
              }}
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
          {homeLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <View key={i} style={[s.heroCard, { backgroundColor: colors.surface, opacity: 0.35 }]} />
              ))
            : homeData.featured.map((f) => (
                <TouchableOpacity key={f.id} activeOpacity={0.95} style={s.heroCard} onPress={() => playTrack?.(f)}>
                  {f.cover_url ? (
                    <Image source={{ uri: f.cover_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : (
                    <LinearGradient colors={['#1A0A2E','#9333EA','#08060F']} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={StyleSheet.absoluteFill} />
                  )}
                  <LinearGradient
                    colors={['transparent','rgba(8,6,15,0.55)','rgba(8,6,15,0.92)']}
                    start={{ x:0, y:0 }} end={{ x:0, y:1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={s.heroOverlay}>
                    <View style={s.heroLabel}>
                      <View style={s.heroBadge}>
                        <Text style={s.heroBadgeText}>{f.label}</Text>
                      </View>
                    </View>
                    <Text style={s.heroTitle} numberOfLines={2}>{f.title}</Text>
                    <Text style={s.heroArtist} numberOfLines={1}>{f.artist}</Text>
                  </View>
                </TouchableOpacity>
              ))
          }
        </ScrollView>


        {/* ── Sana Özel — for_you + trending birleşik ──────────────── */}
        <SectionHeader title={t('dashboard.madeForYou')} colors={colors} />
        <ScrollView ref={forYouRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScrollContent} style={s.hScroll}>
          {homeLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <View key={i} style={[s.playlistCard, { opacity: 0.3 }]}>
                  <View style={[s.playlistCover, { backgroundColor: colors.surface }]} />
                  <View style={{ height: 12, backgroundColor: colors.surface, borderRadius: 6, marginTop: 8, width: 80 }} />
                </View>
              ))
            : [...homeData.for_you, ...homeData.trending].map(p => (
                <TouchableOpacity key={p.id} style={s.playlistCard} onPress={() => playTrack?.(p)} activeOpacity={0.88}>
                  {p.cover_url ? (
                    <Image source={{ uri: p.cover_url }} style={s.playlistCover} />
                  ) : (
                    <View style={[s.playlistCover, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="musical-note" size={28} color={colors.primary} />
                    </View>
                  )}
                  <Text style={[s.playlistName, { color: colors.text }]} numberOfLines={2}>{p.title}</Text>
                  <Text style={[s.playlistCount, { color: colors.textMuted }]}>{p.artist}</Text>
                </TouchableOpacity>
              ))
          }
        </ScrollView>

        {/* ── Discover People ───────────────────────────────────────── */}
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('DiscoverPeople')} style={s.discoverCard}>
          <LinearGradient
            colors={['rgba(147,51,234,0.18)', 'rgba(192,132,252,0.06)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={s.discoverIconBubble}>
            <Ionicons name="people" size={22} color="#C084FC" />
          </View>
          <View style={s.discoverTexts}>
            <Text style={s.discoverTitle}>Kişileri Keşfet</Text>
            <Text style={s.discoverSub}>Müzik zevkini paylaşan kişileri bul</Text>
          </View>
          <View style={s.discoverPill}>
            <LinearGradient colors={['#9333EA', '#C084FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.discoverPillGrad}>
              <Text style={s.discoverPillTxt}>Keşfet</Text>
            </LinearGradient>
          </View>
        </TouchableOpacity>

        {/* ── Native Reklam ────────────────────────────────────────── */}
        <NativeAdSlot colors={colors} />

        {/* ── Kaldığın Yerden — son 5 dinlenen (geçmişten) ─────────── */}
        {recentHistory.length > 0 && (
          <>
            <SectionHeader title={t('dashboard.jumpBackIn')} colors={colors} />
            <ScrollView ref={recentRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScrollContent} style={s.hScroll}>
              {recentHistory.map(r => (
                <TouchableOpacity
                  key={r.trackId}
                  style={s.recentCard}
                  onPress={() => playTrack?.({ id: r.trackId, title: r.title, artist: r.artist, cover_url: r.thumbnail, thumbnail: r.thumbnail, audio_url: r.audio_url, source: r.source })}
                  activeOpacity={0.85}
                >
                  {r.thumbnail ? (
                    <Image source={{ uri: r.thumbnail }} style={s.recentCover} />
                  ) : (
                    <View style={[s.recentCover, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="musical-note" size={24} color={colors.primary} />
                    </View>
                  )}
                  <View style={s.recentOverlay}>
                    <Ionicons name="play-circle" size={28} color="rgba(255,255,255,0.9)" />
                  </View>
                  <Text style={[s.recentTitle, { color: colors.text }]} numberOfLines={1}>{r.title}</Text>
                  <Text style={[s.recentArtist, { color: colors.textMuted }]} numberOfLines={1}>{r.artist}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* ── Trending Now ──────────────────────────────────────────── */}
        <SectionHeader title={t('dashboard.trendingNow')} colors={colors} />
        <View style={s.trendList}>
          {homeLoading
            ? Array.from({ length: 10 }).map((_, i) => (
                <View key={i} style={[s.trendRow, { borderBottomColor: colors.border, borderBottomWidth: i < 9 ? 1 : 0, opacity: 0.3 }]}>
                  <View style={{ width: 26, height: 16, backgroundColor: colors.surface, borderRadius: 4 }} />
                  <View style={[s.trendCover, { backgroundColor: colors.surface }]} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={{ height: 13, backgroundColor: colors.surface, borderRadius: 4, width: '70%' }} />
                    <View style={{ height: 11, backgroundColor: colors.surface, borderRadius: 4, width: '45%' }} />
                  </View>
                </View>
              ))
            : [...homeData.featured, ...homeData.trending].slice(0, 10).map((tr, i) => (
                <TouchableOpacity
                  key={tr.id}
                  style={[s.trendRow, { borderBottomColor: colors.border, borderBottomWidth: i < 9 ? 1 : 0 }]}
                  onPress={() => playTrack?.(tr)}
                  activeOpacity={0.85}
                >
                  <Text style={[s.trendRank, { color: i < 3 ? colors.primary : colors.textMuted }]}>
                    {String(i + 1).padStart(2,'0')}
                  </Text>
                  {tr.cover_url ? (
                    <Image source={{ uri: tr.cover_url }} style={s.trendCover} />
                  ) : (
                    <View style={[s.trendCover, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="musical-note" size={16} color={colors.primary} />
                    </View>
                  )}
                  <View style={s.trendInfo}>
                    <Text style={[s.trendTitle, { color: colors.text }]} numberOfLines={1}>{tr.title}</Text>
                    <Text style={[s.trendArtist, { color: colors.textMuted }]} numberOfLines={1}>{tr.artist}</Text>
                  </View>
                  <View style={s.trendRight}>
                    <Text style={[s.trendPlays, { color: colors.textMuted }]}>{tr.plays_approx}</Text>
                    <TouchableOpacity hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
                      <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))
          }
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

function createStyles(colors, insets) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: 16 },
    heroBg: {},

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
    headerLeft: { gap: 1, flex: 1, minWidth: 0, paddingRight: 16, overflow: 'hidden' },
    greeting: { fontSize: 10, color: colors.textMuted, fontWeight: '500', letterSpacing: 2.0, textTransform: 'uppercase' },
    userName: { fontSize: 28, fontWeight: '700', color: colors.text, lineHeight: 34, letterSpacing: -0.5, flexShrink: 1 },
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
      backgroundColor: 'rgba(248,248,248,0.1)',
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
    msgBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      borderWidth: 1.5,
      borderColor: colors.background,
    },
    msgBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
    avatarWrap: {
      borderRadius: 20,
      borderWidth: 2,
      borderColor: colors.primary,
      padding: 1.5,
    },
    avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface },

    // Search Bar
    searchWrap: { marginHorizontal: 20, marginTop: 4, marginBottom: 6, zIndex: 100, backgroundColor: colors.background },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 8,
    },
    searchInput: { flex: 1, fontSize: 16, fontWeight: '400', paddingVertical: 0, letterSpacing: 0, outlineWidth: 0, outlineStyle: 'none' },
    searchMic: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchDropdown: {
      flex: 1,
      overflow: 'hidden',
    },
    searchEmpty: { fontSize: 14, textAlign: 'center', paddingVertical: 24, paddingHorizontal: 20, fontWeight: '400' },
    searchResultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
      gap: 14,
    },
    searchResultCover: { width: 48, height: 48, borderRadius: 10 },
    searchResultTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
    searchResultArtist: { fontSize: 13, marginTop: 2, fontWeight: '400' },
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

    // Discover Card
    discoverCard: {
      marginHorizontal: 20,
      marginBottom: 20,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: 'rgba(192,132,252,0.28)',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      overflow: 'hidden',
    },
    discoverIconBubble: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: 'rgba(192,132,252,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(192,132,252,0.25)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    discoverTexts: { flex: 1, gap: 3 },
    discoverTitle: { fontSize: 15, fontWeight: '700', color: '#F8F8F8', letterSpacing: -0.2 },
    discoverSub: { fontSize: 12, fontWeight: '400', color: 'rgba(248,248,248,0.5)', lineHeight: 17 },
    discoverPill: { borderRadius: 14, overflow: 'hidden' },
    discoverPillGrad: { paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
    discoverPillTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
  });
}
