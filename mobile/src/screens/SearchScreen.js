/**
 * SearchScreen — NOVA Design System v3.0
 * MeiliSearch entegrasyonlu gerçek zamanlı arama
 * Fixes: track onPress → play, follow button → API, multi-tab search, error states
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Image, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { usePlayer } from '../contexts/PlayerContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { Alert } from '../components/ui/AppAlert';

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

export default function SearchScreen({ navigation }) {
  const { colors }        = useTheme();
  const { t }             = useTranslation();
  const { token }         = useAuth();
  const { playTrack }     = usePlayer() || {};
  const insets            = useSafeAreaInsets();
  const inputRef          = useRef(null);
  const debounceRef       = useRef(null);
  const lastQueryRef      = useRef('');

  const [query, setQuery]         = useState('');
  const [focused, setFocused]     = useState(false);
  const [tracks, setTracks]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);

  // Ekrana girilince klavyeyi otomatik aç
  useFocusEffect(useCallback(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []));

  // Load search history
  useEffect(() => {
    api.get('/search/history', token).then(res => {
      const list = res?.history || res || [];
      if (Array.isArray(list)) setRecentSearches(list.slice(0, 6).map(h => h.query || h));
    }).catch(() => {});
  }, []);

  const runSearch = useCallback(async (q) => {
    const trimmed = q.trim();
    if (!trimmed || trimmed.length < 2) {
      setTracks([]);
      setLoading(false);
      return;
    }
    lastQueryRef.current = trimmed;
    setLoading(true);
    try {
      const enc = encodeURIComponent(trimmed);
      const musicRes = await api.get(`/music-hybrid/search?q=${enc}&limit=20`);

      // Ignore stale responses if query changed while awaiting
      if (lastQueryRef.current !== trimmed) return;

      const list = Array.isArray(musicRes) ? musicRes : (musicRes?.tracks || musicRes?.results || []);
      setTracks(list);
    } catch {
      setTracks([]);
    } finally {
      if (lastQueryRef.current === q.trim()) setLoading(false);
    }
  }, []);

  // Debounced search as user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setTracks([]);
      setLoading(false);
      return;
    }
    if (query.trim().length >= 2) setLoading(true); // instant loading indicator
    debounceRef.current = setTimeout(() => runSearch(query), 280);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Save query to history on submit (Enter / explicit search)
  const handleSubmit = useCallback(() => {
    if (!query.trim() || query.trim().length < 2) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runSearch(query);
    api.post('/search/history', { query: query.trim() }, token).catch(() => {});
    if (!recentSearches.includes(query.trim())) {
      setRecentSearches(prev => [query.trim(), ...prev].slice(0, 6));
    }
  }, [query, runSearch, token, recentSearches]);

  const clear = () => { setQuery(''); setFocused(false); inputRef.current?.blur(); };

  const handleClearHistory = () => {
    api.delete('/search/history', token).catch(() => {});
    setRecentSearches([]);
  };


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

  // ─── UI ────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
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
            placeholder="Şarkı, sanatçı ara..."
            placeholderTextColor={colors.textGhost}
            returnKeyType="search"
            onSubmitEditing={handleSubmit}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {loading && <ActivityIndicator size="small" color={colors.primary} />}
          {query.length > 0 && !loading && (
            <TouchableOpacity onPress={clear} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Instant suggestions (while API loads) ── */}
        {query.length >= 1 && query.length < 2 && (
          <View style={s.section}>
            <Text style={[s.hintText, { color: colors.textMuted }]}>En az 2 karakter gir</Text>
          </View>
        )}
        {query.length >= 2 && loading && tracks.length === 0 && (() => {
          const q = query.toLowerCase();
          const suggestions = [
            ...recentSearches.filter(r => r.toLowerCase().includes(q)),
            ...TRENDING_SEARCHES.filter(t => t.toLowerCase().includes(q) && !recentSearches.includes(t)),
          ].slice(0, 5);
          if (!suggestions.length) return null;
          return (
            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: colors.text, marginBottom: 8 }]}>Öneriler</Text>
              {suggestions.map((sug, i) => (
                <TouchableOpacity key={i} style={s.recentRow} onPress={() => { setQuery(sug); handleSubmit(); }}>
                  <View style={[s.recentIcon, { backgroundColor: colors.surface }]}>
                    <Ionicons name="search-outline" size={16} color={colors.primary} />
                  </View>
                  <Text style={[s.recentText, { color: colors.textSecondary }]}>{sug}</Text>
                  <Ionicons name="arrow-up-outline" size={16} color={colors.textGhost} style={{ transform:[{rotate:'45deg'}] }} />
                </TouchableOpacity>
              ))}
            </View>
          );
        })()}

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
            ) : tracks.length === 0 ? (
              <View style={s.emptyWrap}>
                <Ionicons name="search-outline" size={48} color={colors.textMuted} />
                <Text style={[s.emptyText, { color: colors.textMuted }]}>No results for "{query}"</Text>
                <Text style={[s.emptyHint, { color: colors.textGhost }]}>Try a different keyword</Text>
              </View>
            ) : (
              <>
                <Text style={[s.sectionTitle, { color: colors.text }]}>
                  {tracks.length} results for "{query}"
                </Text>
                {tracks.map((item, idx) => renderTrack(item, idx))}
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

    emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 12 },
    emptyText: { fontSize: 16, fontWeight: '600' },
    emptyHint: { fontSize: 14 },
    hintText:  { fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  });
}
