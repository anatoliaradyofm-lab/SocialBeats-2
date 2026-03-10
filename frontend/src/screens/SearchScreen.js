import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Image, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { usePlayer } from '../contexts/PlayerContext';
import api from '../services/api';

const TABS = [
  { id: 'all', label: 'Tümü' },
  { id: 'music', label: 'Müzik' },
  { id: 'users', label: 'Kişiler' },
  { id: 'posts', label: 'Gönderiler' },
  { id: 'playlists', label: 'Listeler' },
];

const PLATFORM_FILTERS = [
  { id: 'all', label: 'Tümü' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'spotify', label: 'Spotify' },
  { id: 'deezer', label: 'Deezer' },
];

const DURATION_FILTERS = [
  { id: 'any', label: 'Herhangi' },
  { id: 'short', label: '< 4 dk' },
  { id: 'medium', label: '4-20 dk' },
  { id: 'long', label: '> 20 dk' },
];

export default function SearchScreen({ navigation }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { playTrack } = usePlayer();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [platform, setPlatform] = useState('all');
  const [duration, setDuration] = useState('any');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [trendingSearches, setTrendingSearches] = useState([]);
  const [personalizedRecs, setPersonalizedRecs] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [instantResults, setInstantResults] = useState(null);
  const searchInputRef = useRef(null);
  const instantTimer = useRef(null);

  useEffect(() => {
    loadHistory();
    loadTrending();
    loadRecommendations();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await api.get('/search/history?limit=20', token);
      if (res?.history?.length > 0) {
        setSearchHistory(res.history.map(h => h.query || h));
      } else {
        const local = await AsyncStorage.getItem('@search_history');
        if (local) setSearchHistory(JSON.parse(local));
      }
    } catch {
      const local = await AsyncStorage.getItem('@search_history');
      if (local) setSearchHistory(JSON.parse(local));
    }
  };

  const loadTrending = async () => {
    try {
      const res = await api.get('/search/trending?limit=10', token);
      if (res?.trending) setTrendingSearches(res.trending);
    } catch {}
  };

  const loadRecommendations = async () => {
    try {
      const res = await api.get('/discover/for-you?limit=6', token);
      setPersonalizedRecs(res?.tracks || res?.recommendations || []);
    } catch {}
  };

  const saveToHistory = useCallback(async (q) => {
    const updated = [q, ...searchHistory.filter(h => h !== q)].slice(0, 20);
    setSearchHistory(updated);
    AsyncStorage.setItem('@search_history', JSON.stringify(updated)).catch(() => {});
    try { await api.post('/search/history', { query: q }, token); } catch {}
  }, [searchHistory, token]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setInstantResults(null); return; }

    if (instantTimer.current) clearTimeout(instantTimer.current);
    instantTimer.current = setTimeout(async () => {
      try {
        const res = await api.get(`/search/instant?q=${encodeURIComponent(query.trim())}&limit=8`, token);
        setInstantResults(res?.results || null);
      } catch { setInstantResults(null); }
    }, 150);

    const timer = setTimeout(async () => {
      setSearching(true);
      setInstantResults(null);
      saveToHistory(query.trim());
      try {
        let res;
        if (activeTab === 'music' || activeTab === 'all') {
          if (platform === 'deezer') {
            res = await api.get(`/music/search-deezer?q=${encodeURIComponent(query)}&limit=30`, token);
          } else {
            const params = `q=${encodeURIComponent(query)}&platform=${platform}${duration !== 'any' ? `&duration=${duration}` : ''}`;
            res = await api.get(`/music/search-unified?${params}`, token);
          }
        }
        if (activeTab === 'users') {
          res = await api.get(`/users/search?q=${encodeURIComponent(query)}`, token);
        }
        if (activeTab === 'posts') {
          res = await api.get(`/social/posts/explore?q=${encodeURIComponent(query)}`, token);
        }
        if (activeTab === 'playlists') {
          res = await api.get(`/playlists?search=${encodeURIComponent(query)}`, token);
        }
        setResults(res?.results || res?.songs || res?.tracks || res?.users || res?.posts || res?.playlists || []);
      } catch { setResults([]); }
      setSearching(false);
    }, 500);
    return () => { clearTimeout(timer); clearTimeout(instantTimer.current); };
  }, [query, activeTab, platform, duration, token]);

  const clearHistory = async () => {
    setSearchHistory([]);
    AsyncStorage.removeItem('@search_history').catch(() => {});
    try { await api.delete('/search/history', token); } catch {}
  };

  const removeHistoryItem = async (q) => {
    setSearchHistory(prev => prev.filter(h => h !== q));
    const local = searchHistory.filter(h => h !== q);
    AsyncStorage.setItem('@search_history', JSON.stringify(local)).catch(() => {});
  };

  const startVoiceSearch = () => {
    if (Platform.OS === 'web') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        Alert.alert('Uyarı', 'Tarayıcınız sesli aramayı desteklemiyor');
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'tr-TR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      setIsListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } else {
      Alert.alert(
        'Sesli Arama',
        'Sesli arama için mikrofon izni gerekli. Bir şarkı adı veya sanatçı söyleyin.',
        [{ text: 'Tamam' }]
      );
      setIsListening(true);
      setTimeout(() => setIsListening(false), 3000);
    }
  };

  const renderItem = ({ item }) => {
    const isUser = item.type === 'user' || item.username;
    const isPlaylist = item.type === 'playlist' || item.song_count !== undefined;
    const sources = item.sources || [];
    return (
      <TouchableOpacity
        style={[styles.resultRow, { borderBottomColor: colors.border }]}
        onPress={() => {
          if (isUser) navigation.navigate('UserProfile', { userId: item.id || item._id });
          else if (isPlaylist) navigation.navigate('PlaylistDetail', { playlistId: item.id || item._id });
          else playTrack(item, results.filter(r => !r.username && r.song_count === undefined));
        }}
      >
        <View style={[styles.resultThumb, { backgroundColor: colors.surfaceElevated }]}>
          {(item.thumbnail || item.avatar_url || item.cover_url) ? (
            <Image source={{ uri: item.thumbnail || item.avatar_url || item.cover_url }} style={styles.resultThumb} />
          ) : (
            <Ionicons name={isUser ? 'person' : isPlaylist ? 'list' : 'musical-note'} size={18} color={BRAND.primaryLight} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>{item.title || item.display_name || item.username || item.name}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {isUser ? `@${item.username}` : isPlaylist ? `${item.song_count || 0} şarkı` : item.artist || ''}
          </Text>
        </View>
        {sources.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {sources.map(s => (
              <View key={s} style={[styles.platformBadge, { backgroundColor: colors.card }]}>
                <Text style={{ color: colors.textMuted, fontSize: 8 }}>{s === 'youtube' ? 'YT' : s === 'spotify' ? 'SP' : 'DZ'}</Text>
              </View>
            ))}
          </View>
        )}
        {!sources.length && item.platform && (
          <View style={[styles.platformBadge, { backgroundColor: colors.card }]}>
            <Text style={{ color: colors.textMuted, fontSize: 9 }}>{item.platform}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Şarkı, sanatçı, kullanıcı ara..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={startVoiceSearch} style={{ padding: 4 }}>
          <Ionicons name={isListening ? 'mic' : 'mic-outline'} size={22} color={isListening ? BRAND.primary : colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={{ padding: 4 }}>
          <Ionicons name="options" size={20} color={showFilters ? BRAND.primary : colors.textMuted} />
        </TouchableOpacity>
      </View>

      {isListening && (
        <View style={[styles.listeningBanner, { backgroundColor: BRAND.primary + '15' }]}>
          <ActivityIndicator size="small" color={BRAND.primary} />
          <Text style={{ color: BRAND.primary, fontWeight: '600', marginLeft: 8 }}>Dinleniyor...</Text>
        </View>
      )}

      {/* Instant Search Suggestions (Meilisearch) */}
      {instantResults && !searching && query.trim().length > 0 && (
        <View style={[styles.instantDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {Object.entries(instantResults).map(([category, data]) => {
            const hits = data?.hits || [];
            if (!hits.length) return null;
            const labels = { users: 'Kişiler', posts: 'Gönderiler', tracks: 'Müzik', playlists: 'Listeler', hashtags: 'Hashtagler' };
            return (
              <View key={category}>
                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '700', paddingHorizontal: 12, paddingTop: 8, textTransform: 'uppercase' }}>{labels[category] || category}</Text>
                {hits.slice(0, 3).map((hit, i) => (
                  <TouchableOpacity
                    key={`${category}-${i}`}
                    style={[styles.instantItem, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      setInstantResults(null);
                      if (category === 'users') navigation.navigate('UserProfile', { userId: hit.id });
                      else if (category === 'posts') navigation.navigate('PostDetail', { postId: hit.id });
                      else if (category === 'tracks') playTrack(hit, []);
                      else if (category === 'playlists') navigation.navigate('PlaylistDetail', { playlistId: hit.id });
                      else if (category === 'hashtags') setQuery(`#${hit.tag}`);
                    }}
                  >
                    <Ionicons
                      name={category === 'users' ? 'person' : category === 'posts' ? 'document-text' : category === 'tracks' ? 'musical-note' : category === 'playlists' ? 'list' : 'pricetag'}
                      size={14} color={BRAND.primaryLight}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={{ color: colors.text, fontSize: 13, flex: 1 }} numberOfLines={1}>
                      {hit.title || hit.display_name || hit.username || hit.name || hit.content?.substring(0, 60) || hit.tag}
                    </Text>
                    {hit.artist && <Text style={{ color: colors.textMuted, fontSize: 11 }}>{hit.artist}</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
        </View>
      )}

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} style={[styles.tab, { backgroundColor: activeTab === t.id ? BRAND.primary : colors.surfaceElevated }]} onPress={() => setActiveTab(t.id)}>
            <Text style={{ color: activeTab === t.id ? '#FFF' : colors.textSecondary, fontSize: 13, fontWeight: '500' }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Filters */}
      {showFilters && (activeTab === 'music' || activeTab === 'all') && (
        <View style={[styles.filterSection, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 6 }}>Platform</Text>
          <View style={styles.filterRow}>
            {PLATFORM_FILTERS.map(f => (
              <TouchableOpacity key={f.id} style={[styles.filterChip, { backgroundColor: platform === f.id ? BRAND.primary : colors.card }]} onPress={() => setPlatform(f.id)}>
                <Text style={{ color: platform === f.id ? '#FFF' : colors.textSecondary, fontSize: 11 }}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8, marginBottom: 6 }}>Süre</Text>
          <View style={styles.filterRow}>
            {DURATION_FILTERS.map(f => (
              <TouchableOpacity key={f.id} style={[styles.filterChip, { backgroundColor: duration === f.id ? BRAND.primary : colors.card }]} onPress={() => setDuration(f.id)}>
                <Text style={{ color: duration === f.id ? '#FFF' : colors.textSecondary, fontSize: 11 }}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Results or Home */}
      {query.trim() ? (
        searching ? (
          <ActivityIndicator size="large" color={BRAND.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList data={results} renderItem={renderItem} keyExtractor={(item, i) => item.id || item._id || `${i}`} contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={<View style={styles.empty}><Text style={{ color: colors.textMuted }}>Sonuç bulunamadı</Text></View>}
          />
        )
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {/* Trending Searches */}
          {trendingSearches.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Popüler Aramalar</Text>
              <View style={styles.trendingGrid}>
                {trendingSearches.map((t, i) => (
                  <TouchableOpacity key={i} style={[styles.trendingChip, { backgroundColor: colors.surfaceElevated }]} onPress={() => setQuery(t.query)}>
                    <Ionicons name="trending-up" size={14} color={i < 3 ? BRAND.primary : colors.textMuted} />
                    <Text style={{ color: colors.text, fontSize: 13, flex: 1, marginLeft: 6 }} numberOfLines={1}>{t.query}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 10 }}>{t.count}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Search History */}
          {searchHistory.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Son Aramalar</Text>
                <TouchableOpacity onPress={clearHistory}><Text style={{ color: BRAND.primaryLight, fontSize: 13 }}>Temizle</Text></TouchableOpacity>
              </View>
              {searchHistory.slice(0, 10).map((h, i) => (
                <TouchableOpacity key={i} style={styles.historyRow} onPress={() => setQuery(h)}>
                  <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                  <Text style={{ color: colors.textSecondary, flex: 1, marginLeft: 10 }}>{h}</Text>
                  <TouchableOpacity onPress={() => removeHistoryItem(h)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Personalized Recommendations */}
          {personalizedRecs.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Sana Özel</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {personalizedRecs.map((t, i) => (
                  <TouchableOpacity key={i} style={[styles.recCard, { backgroundColor: colors.surfaceElevated }]} onPress={() => playTrack(t, personalizedRecs)}>
                    <View style={[styles.recThumb, { backgroundColor: colors.card }]}>
                      {t.thumbnail || t.cover_url ? (
                        <Image source={{ uri: t.thumbnail || t.cover_url }} style={styles.recThumb} />
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
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 54, paddingHorizontal: 12, paddingBottom: 8, gap: 6 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, height: 40, gap: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  tabRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 18 },
  filterSection: { marginHorizontal: 12, padding: 12, borderRadius: 12, marginBottom: 4 },
  filterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, gap: 12 },
  resultThumb: { width: 48, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  platformBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  empty: { alignItems: 'center', paddingTop: 80 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  trendingGrid: { gap: 6 },
  trendingChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  listeningBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, marginHorizontal: 12, borderRadius: 10 },
  recCard: { width: 130, borderRadius: 12, padding: 8, alignItems: 'center' },
  recThumb: { width: 114, height: 114, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  instantDropdown: { marginHorizontal: 12, borderRadius: 12, borderWidth: 0.5, maxHeight: 300, overflow: 'hidden' },
  instantItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5 },
});
