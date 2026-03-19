/**
 * SearchScreen — NOVA Design System v3.0
 * MeiliSearch entegrasyonlu gerçek zamanlı arama
 * Fixes: track onPress → play, follow button → API, multi-tab search, error states
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  FlatList, Image, ActivityIndicator, Dimensions, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { usePlayer } from '../contexts/PlayerContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const { width: W } = Dimensions.get('window');
const COL_W = (W - 48) / 2;

const CATEGORIES = [
  { id:'pop',      label:'Pop',           grad:['#9333EA','#F472B6'], emoji:'🎵' },
  { id:'hiphop',   label:'Hip-Hop',       grad:['#EA580C','#F97316'], emoji:'🔥' },
  { id:'edm',      label:'Electronic',    grad:['#0891B2','#22D3EE'], emoji:'⚡' },
  { id:'lofi',     label:'Lo-fi & Chill', grad:['#1E40AF','#7C3AED'], emoji:'🌙' },
  { id:'rnb',      label:'R&B & Soul',    grad:['#7C3AED','#EC4899'], emoji:'💜' },
  { id:'rock',     label:'Rock',          grad:['#7F1D1D','#EF4444'], emoji:'🎸' },
  { id:'jazz',     label:'Jazz',          grad:['#065F46','#34D399'], emoji:'🎷' },
  { id:'podcast',  label:'Podcasts',      grad:['#1E3A5F','#60A5FA'], emoji:'🎙️' },
  { id:'new',      label:'New Releases',  grad:['#4C1D95','#A855F7'], emoji:'✨' },
  { id:'charts',   label:'Charts',        grad:['#92400E','#FBBF24'], emoji:'📈' },
];

const TRENDING_SEARCHES = [
  'Taylor Swift', 'The Weeknd', 'Bad Bunny', 'Dua Lipa', 'Kendrick Lamar',
  'olivia rodrigo', 'SZA', 'Peso Pluma', 'Morgan Wallen', 'Miley Cyrus',
];

const TABS = ['Music', 'Users', 'Playlists', 'Posts'];

export default function SearchScreen({ navigation }) {
  const { colors }        = useTheme();
  const { t }             = useTranslation();
  const { token }         = useAuth();
  const { playTrack }     = usePlayer() || {};
  const insets            = useSafeAreaInsets();
  const inputRef          = useRef(null);
  const debounceRef       = useRef(null);

  const [query, setQuery]         = useState('');
  const [focused, setFocused]     = useState(false);
  const [tab, setTab]             = useState('Music');
  const [results, setResults]     = useState({ tracks: [], users: [], playlists: [], posts: [] });
  const [loading, setLoading]     = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  // follow state: { [userId]: boolean }
  const [following, setFollowing] = useState({});
  const [followLoading, setFollowLoading] = useState({});

  // Load search history
  useEffect(() => {
    api.get('/search/history', token).then(res => {
      const list = res?.history || res || [];
      if (Array.isArray(list)) setRecentSearches(list.slice(0, 6).map(h => h.query || h));
    }).catch(() => {});
  }, []);

  // Debounced multi-tab search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults({ tracks: [], users: [], playlists: [], posts: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const q = encodeURIComponent(query.trim());

        // Music tab: music-hybrid endpoint
        const musicPromise = tab === 'Music'
          ? api.get(`/music-hybrid/search?q=${q}&limit=20`)
          : Promise.resolve(null);

        // Unified social search for users/playlists/posts
        const socialPromise = (tab === 'Users' || tab === 'Playlists' || tab === 'Posts')
          ? api.get(`/search?q=${q}&limit=20`, token)
          : Promise.resolve(null);

        const [musicRes, socialRes] = await Promise.all([musicPromise, socialPromise]);

        const tracks    = musicRes ? (Array.isArray(musicRes) ? musicRes : (musicRes?.tracks || musicRes?.results || [])) : [];
        const users     = socialRes?.users     || [];
        const playlists = socialRes?.playlists || [];
        const posts     = socialRes?.posts     || [];

        // Initialise follow state from returned users
        const followMap = {};
        users.forEach(u => { followMap[u.id] = u.is_following ?? false; });
        setFollowing(prev => ({ ...prev, ...followMap }));

        setResults({ tracks, users, playlists, posts });

        // Save to history
        api.post('/search/history', { query: query.trim() }, token).catch(() => {});
      } catch {
        setResults({ tracks: [], users: [], playlists: [], posts: [] });
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query, tab]);

  const clear = () => { setQuery(''); setFocused(false); inputRef.current?.blur(); };

  const handleClearHistory = () => {
    api.delete('/search/history', token).catch(() => {});
    setRecentSearches([]);
  };

  // Toggle follow / unfollow
  const handleFollow = useCallback(async (userId) => {
    if (followLoading[userId]) return;
    const isFollowing = following[userId];
    setFollowLoading(prev => ({ ...prev, [userId]: true }));
    // Optimistic update
    setFollowing(prev => ({ ...prev, [userId]: !isFollowing }));
    try {
      if (isFollowing) {
        await api.delete(`/social/follow/${userId}`, token);
      } else {
        await api.post(`/social/follow/${userId}`, {}, token);
      }
    } catch {
      // Revert on error
      setFollowing(prev => ({ ...prev, [userId]: isFollowing }));
      Alert.alert(t('common.error'), t('common.tryAgain') || 'İşlem başarısız oldu.');
    } finally {
      setFollowLoading(prev => ({ ...prev, [userId]: false }));
    }
  }, [following, followLoading, token]);

  // Show track options
  const handleTrackMenu = useCallback((item) => {
    Alert.alert(
      item.title || item.name,
      item.artist || '',
      [
        { text: 'Çal', onPress: () => playTrack?.(item) },
        { text: 'Oynatma listesine ekle', onPress: () => navigation.navigate('AddSongsToPlaylist', { track: item }) },
        { text: 'İptal', style: 'cancel' },
      ]
    );
  }, [playTrack, navigation]);

  const currentResults = results[{ Music: 'tracks', Users: 'users', Playlists: 'playlists', Posts: 'posts' }[tab]] || [];

  const s = createStyles(colors, insets);

  // ── Result renderers ────────────────────────────────────────

  const renderTrack = (item, idx) => (
    <TouchableOpacity
      key={item.id || idx}
      style={s.resultRow}
      activeOpacity={0.8}
      onPress={() => playTrack?.(item)}
    >
      <Image
        source={{ uri: item.cover_url || item.thumbnail_url || item.cover || `https://picsum.photos/seed/${item.id}/80/80` }}
        style={s.resultCover}
      />
      <View style={s.resultInfo}>
        <Text style={[s.resultTitle, { color: colors.text }]} numberOfLines={1}>{item.title || item.name}</Text>
        <Text style={[s.resultSub, { color: colors.textMuted }]} numberOfLines={1}>
          {item.artist || item.artist_name}{item.duration_str ? ` · ${item.duration_str}` : ''}
        </Text>
      </View>
      <TouchableOpacity
        hitSlop={{ top:10, bottom:10, left:10, right:10 }}
        onPress={() => handleTrackMenu(item)}
      >
        <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderUser = (item, idx) => {
    const isFollowed = following[item.id] ?? (item.is_following ?? false);
    const isLoading  = followLoading[item.id] ?? false;
    return (
      <TouchableOpacity
        key={item.id || idx}
        style={s.resultRow}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('UserProfile', { username: item.username })}
      >
        <Image
          source={{ uri: item.avatar_url || `https://i.pravatar.cc/80?u=${item.id}` }}
          style={[s.resultCover, { borderRadius: 40 }]}
        />
        <View style={s.resultInfo}>
          <Text style={[s.resultTitle, { color: colors.text }]} numberOfLines={1}>
            {item.display_name || item.username}{item.is_verified ? '  ✓' : ''}
          </Text>
          <Text style={[s.resultSub, { color: colors.textMuted }]}>
            @{item.username} · {item.followers_count ?? 0} followers
          </Text>
        </View>
        <TouchableOpacity
          style={[
            s.followBtn,
            isFollowed
              ? { backgroundColor: colors.surface, borderColor: colors.border }
              : { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}
          onPress={() => handleFollow(item.id)}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator size="small" color={isFollowed ? colors.primary : '#fff'} style={{ width: 44 }} />
            : <Text style={[s.followBtnText, { color: isFollowed ? colors.textMuted : '#fff' }]}>
                {isFollowed ? 'Takipte' : 'Takip Et'}
              </Text>
          }
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderPlaylist = (item, idx) => (
    <TouchableOpacity
      key={item.id || idx}
      style={s.resultRow}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('PlaylistDetail', { playlistId: item.id, playlist: item })}
    >
      <Image
        source={{ uri: item.cover_url || item.thumbnail || `https://picsum.photos/seed/${item.id}/80/80` }}
        style={s.resultCover}
      />
      <View style={s.resultInfo}>
        <Text style={[s.resultTitle, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[s.resultSub, { color: colors.textMuted }]}>
          {item.tracks_count ?? 0} tracks · {item.owner?.username || ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );

  const renderPost = (item, idx) => (
    <TouchableOpacity
      key={item.id || idx}
      style={s.resultRow}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
    >
      <Image
        source={{ uri: item.user?.avatar_url || `https://i.pravatar.cc/80?u=${item.user_id}` }}
        style={[s.resultCover, { borderRadius: 40 }]}
      />
      <View style={s.resultInfo}>
        <Text style={[s.resultTitle, { color: colors.text }]} numberOfLines={1}>
          @{item.user?.username || 'user'}
        </Text>
        <Text style={[s.resultSub, { color: colors.textMuted }]} numberOfLines={2}>{item.content}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderResult = (item, idx) => {
    switch (tab) {
      case 'Users':     return renderUser(item, idx);
      case 'Playlists': return renderPlaylist(item, idx);
      case 'Posts':     return renderPost(item, idx);
      default:          return renderTrack(item, idx);
    }
  };

  // ─── UI ────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.screenTitle}>Search</Text>

        <View style={[s.searchBar, focused && s.searchFocused]}>
          <Ionicons name="search" size={18} color={focused ? colors.primary : colors.textMuted} />
          <TextInput
            ref={inputRef}
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Songs, artists, podcasts..."
            placeholderTextColor={colors.textGhost}
            returnKeyType="search"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          {loading && <ActivityIndicator size="small" color={colors.primary} />}
          {query.length > 0 && !loading && (
            <TouchableOpacity onPress={clear} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        {(focused || query.length > 0) && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll} contentContainerStyle={s.tabsContent}>
            {TABS.map(tb => (
              <TouchableOpacity key={tb} onPress={() => setTab(tb)} style={[s.tab, tab === tb && s.tabActive]}>
                <Text style={[s.tabText, { color: tab === tb ? colors.primary : colors.textMuted }]}>{tb}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {query.length === 0 ? (
          <>
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={[s.sectionTitle, { color: colors.text }]}>Recent</Text>
                  <TouchableOpacity onPress={handleClearHistory}>
                    <Text style={[s.clearText, { color: colors.primary }]}>Clear</Text>
                  </TouchableOpacity>
                </View>
                {recentSearches.map((r, i) => (
                  <TouchableOpacity key={i} style={s.recentRow} onPress={() => setQuery(typeof r === 'string' ? r : r.query)}>
                    <View style={[s.recentIcon, { backgroundColor: colors.surface }]}>
                      <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                    </View>
                    <Text style={[s.recentText, { color: colors.textSecondary }]}>{typeof r === 'string' ? r : r.query}</Text>
                    <Ionicons name="arrow-up-outline" size={16} color={colors.textGhost} style={{ transform:[{rotate:'45deg'}] }} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Trending */}
            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>Trending</Text>
              <View style={s.trendingChips}>
                {TRENDING_SEARCHES.map((t, i) => (
                  <TouchableOpacity key={i} onPress={() => setQuery(t)} style={[s.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[s.chipText, { color: colors.textSecondary }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Browse Categories */}
            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>Browse all</Text>
              <View style={s.categoryGrid}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity key={cat.id} onPress={() => setQuery(cat.label)} activeOpacity={0.85} style={s.categoryCard}>
                    <LinearGradient colors={cat.grad} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={s.categoryGrad}>
                      <Text style={s.categoryEmoji}>{cat.emoji}</Text>
                      <Text style={s.categoryLabel}>{cat.label}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        ) : (
          <View style={s.section}>
            {loading ? (
              <View style={s.emptyWrap}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[s.emptyText, { color: colors.textMuted }]}>Searching...</Text>
              </View>
            ) : currentResults.length === 0 ? (
              <View style={s.emptyWrap}>
                <Ionicons name="search-outline" size={48} color={colors.textMuted} />
                <Text style={[s.emptyText, { color: colors.textMuted }]}>No results for "{query}"</Text>
                <Text style={[s.emptyHint, { color: colors.textGhost }]}>Try a different keyword</Text>
              </View>
            ) : (
              <>
                <Text style={[s.sectionTitle, { color: colors.text }]}>
                  {currentResults.length} results for "{query}"
                </Text>
                {currentResults.map((item, idx) => renderResult(item, idx))}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors, insets) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + 16,
      paddingHorizontal: 20,
      paddingBottom: 12,
      backgroundColor: colors.headerBg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 14,
    },
    screenTitle: { fontSize: 32, fontWeight: '900', color: colors.text, letterSpacing: -1.2 },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.searchBg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
    },
    searchFocused: {
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width:0,height:0 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    },
    searchInput: { flex: 1, fontSize: 15, color: colors.text },

    tabsScroll: { marginTop: 4 },
    tabsContent: { gap: 8, paddingBottom: 4 },
    tab: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabActive: { backgroundColor: colors.primaryGlow, borderColor: colors.primary },
    tabText: { fontSize: 13, fontWeight: '700' },

    scroll: { paddingTop: 8, paddingBottom: 120 },
    section: { paddingHorizontal: 20, marginBottom: 24 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5, marginBottom: 14 },
    clearText: { fontSize: 14, fontWeight: '600' },

    recentRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    },
    recentIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    recentText: { flex: 1, fontSize: 15 },

    trendingChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    chipText: { fontSize: 13, fontWeight: '600' },

    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    categoryCard: { width: COL_W, height: 90, borderRadius: 18, overflow: 'hidden' },
    categoryGrad: { flex: 1, padding: 14, justifyContent: 'flex-end' },
    categoryEmoji: { fontSize: 24, marginBottom: 4 },
    categoryLabel: { fontSize: 15, fontWeight: '800', color: '#FFF' },

    resultRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight,
    },
    resultCover: { width: 52, height: 52, borderRadius: 10, backgroundColor: colors.surface },
    resultInfo: { flex: 1, gap: 3 },
    resultTitle: { fontSize: 15, fontWeight: '600' },
    resultSub: { fontSize: 13 },

    followBtn: {
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: 20, borderWidth: 1.5,
      minWidth: 80,
      alignItems: 'center',
    },
    followBtnText: { fontSize: 13, fontWeight: '700' },

    emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 12 },
    emptyText: { fontSize: 16, fontWeight: '600' },
    emptyHint: { fontSize: 14 },
  });
}
