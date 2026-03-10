/**
 * SearchScreen - Gelişmiş arama ve Keşfet
 * - Tabs: Müzik, Gönderi, Çalma listesi, Kullanıcılar
 * - Tarih filtreleri (saat/gün/hafta/ay)
 * - Arama geçmişi (son 20)
 * - Popüler aramalar (trending)
 * - Boş sorguda: Keşfet bölümleri
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { usePlayer } from '../contexts/PlayerContext';
import api from '../services/api';
import NativeAd from '../components/ads/NativeAd';
import { useTranslation } from 'react-i18next';
import { getFullLocale } from '../lib/localeUtils';
import { useLocaleStore } from '../lib/localeStore';
import { useTheme } from '../contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;
const avatar = (u) => u?.avatar_url || `https://i.pravatar.cc/100?u=${u?.username || u?.id}`;

const TAB_KEYS = [
  { key: 'music', labelKey: 'search.music', icon: 'musical-notes' },
  { key: 'posts', labelKey: 'search.posts', icon: 'document-text' },
  { key: 'playlists', labelKey: 'search.playlists', icon: 'list' },
  { key: 'users', labelKey: 'search.users', icon: 'people' },
  { key: 'hashtags', labelKey: 'search.hashtags', icon: 'pricetag' },
];

const DATE_FILTER_KEYS = [
  { key: 'all', labelKey: 'search.all' },
  { key: 'hour', labelKey: 'search.oneHour' },
  { key: 'day', labelKey: 'search.oneDay' },
  { key: 'week', labelKey: 'search.oneWeek' },
  { key: 'month', labelKey: 'search.oneMonth' },
];

export default function SearchScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { token } = useAuth();
  const { countryCode } = useLocaleStore();
  const { playTrack } = usePlayer();
  const [query, setQuery] = useState('');
  const [searchTab, setSearchTab] = useState('music');
  const [dateFilter, setDateFilter] = useState('all');
  const [results, setResults] = useState({ music: [], posts: [], playlists: [], users: [], hashtags: [] });
  const [trendingHashtags, setTrendingHashtags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [trendingSearches, setTrendingSearches] = useState([]);
  const [discoverData, setDiscoverData] = useState(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [voiceSearching, setVoiceSearching] = useState(false);

  // Arama geçmişi (son 20)
  const loadSearchHistory = useCallback(async () => {
    if (!token) return;
    try {
      const r = await api.get('/search/history?limit=20', token);
      setSearchHistory(r?.history || []);
    } catch {
      setSearchHistory([]);
    }
  }, [token]);

  // Popüler aramalar
  const loadTrendingSearches = useCallback(async () => {
    try {
      const r = await api.get('/search/trending?limit=10', token);
      setTrendingSearches(r?.trending || []);
    } catch {
      setTrendingSearches([]);
    }
  }, [token]);

  // Keşfet verileri (boş sorguda)
  const country = countryCode || 'US';
  const loadDiscover = useCallback(async () => {
    if (!token) return;
    setDiscoverLoading(true);
    try {
      const [forYou, trending, popular, categories, moods, friendsAct, newReleases, seasonal] = await Promise.all([
        api.get(`/discover/for-you?limit=10&country=${country}`, token).catch(() => ({})),
        api.get(`/discover/trending?country=${country}`, token).catch(() => []),
        api.get(`/discover/popular?content_type=tracks&period=week&limit=10&country=${country}`, token).catch(() => ({})),
        api.get('/discover/categories', token).catch(() => ({ categories: [] })),
        api.get('/discover/moods', token).catch(() => []),
        api.get('/social/activity/friends', token).catch(() => []),
        api.get(`/discover/new-releases?limit=10&country=${country}`, token).catch(() => ({ tracks: [] })),
        api.get(`/discover/seasonal?country=${country}`, token).catch(() => ({ tracks: [] })),
      ]);
      setDiscoverData({
        forYou: forYou?.recommendations || [],
        trendingTracks: Array.isArray(trending) ? trending : (trending?.tracks || []),
        popularTracks: popular?.tracks || [],
        categories: categories?.categories || [],
        moods: moods || [],
        friendsActivity: Array.isArray(friendsAct) ? friendsAct : [],
        newReleases: newReleases?.tracks || [],
        seasonal: seasonal?.tracks || [],
        popularInYourCountry: popular?.tracks || [],
      });
    } catch (e) {
      setDiscoverData(null);
    } finally {
      setDiscoverLoading(false);
    }
  }, [token, country]);

  const loadTrendingHashtags = useCallback(async () => {
    try {
      const r = await api.get('/hashtags/trending?limit=10', token);
      setTrendingHashtags(r?.hashtags || r?.trending || []);
    } catch {
      setTrendingHashtags([]);
    }
  }, [token]);

  useEffect(() => {
    loadSearchHistory();
    loadTrendingSearches();
    loadTrendingHashtags();
  }, [loadSearchHistory, loadTrendingSearches, loadTrendingHashtags]);

  useEffect(() => {
    if (!query.trim()) {
      loadDiscover();
    }
  }, [query, loadDiscover]);

  const search = useCallback(async (overrideQuery) => {
    const q = (overrideQuery ?? query).trim();
    if (!q || !token) return;
    setLoading(true);
    try {
      const encoded = encodeURIComponent(q);
      const params = new URLSearchParams({ q, limit: 20, offset: 0 });
      if (dateFilter && dateFilter !== 'all') params.set('date', dateFilter);

      const [searchRes, musicRes, hashtagRes] = await Promise.all([
        api.get(`/search?${params}`, token).catch(() => ({ posts: [], playlists: [], users: [] })),
        api.get(`/music/search-unified?q=${encoded}&limit=20`, token).catch(() => ({ results: [] })),
        api.get(`/hashtags/search?q=${encoded}&limit=20`, token).catch(() => ({ hashtags: [] })),
      ]);

      setResults({
        music: musicRes?.results || [],
        posts: searchRes?.posts || [],
        playlists: searchRes?.playlists || [],
        users: searchRes?.users || [],
        hashtags: hashtagRes?.hashtags || hashtagRes?.results || [],
      });

      await api.post('/search/history', { query: q }, token).catch(() => {});
      loadSearchHistory();
    } catch (err) {
      setResults({ music: [], posts: [], playlists: [], users: [] });
    } finally {
      setLoading(false);
    }
  }, [query, token, dateFilter, loadSearchHistory]);

  const searchWithQuery = (term) => {
    setQuery(term);
    setTimeout(() => search(term), 150);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadSearchHistory(), loadTrendingSearches(), query.trim() ? search() : loadDiscover()]);
    setRefreshing(false);
  }, [query, search, loadDiscover, loadSearchHistory, loadTrendingSearches]);

  const onHistoryItemPress = (item) => {
    const q = item?.query || item;
    setQuery(q);
    setTimeout(() => search(q), 150);
  };

  const onTrendingPress = (t) => {
    const q = t?.query || t;
    setQuery(q);
    setTimeout(() => search(q), 150);
  };

  const clearHistory = async () => {
    if (!token) return;
    try {
      await api.delete('/search/history', token);
      setSearchHistory([]);
    } catch {}
  };

  // Sesli arama - @react-native-voice/voice (opsiyonel)
  const startVoiceSearch = async () => {
    setVoiceSearching(true);
    try {
      const Voice = require('@react-native-voice/voice').default;
      if (!Voice?.start) throw new Error('Voice not available');
      Voice.onSpeechResults = (e) => {
        const text = e?.value?.[0] || '';
        if (text) setQuery(text);
        setVoiceSearching(false);
      };
      Voice.onSpeechError = () => setVoiceSearching(false);
      await Voice.start(getFullLocale());
    } catch {
      setVoiceSearching(false);
    }
  };

  const stopVoiceSearch = async () => {
    try {
      const Voice = require('@react-native-voice/voice').default;
      await Voice?.stop?.();
    } catch {}
    setVoiceSearching(false);
  };

  const currentResults = results[searchTab] || [];

  const renderMusicItem = ({ item }) => (
    <TouchableOpacity style={styles.resultRow} activeOpacity={0.7} onPress={() => playTrack(item)}>
      <Image source={{ uri: item.thumbnail || item.cover_url || `https://i.pravatar.cc/100?u=${item.id}` }} style={styles.thumb} />
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle} numberOfLines={1}>{item.title || item.name}</Text>
        <Text style={styles.resultArtist} numberOfLines={1}>{item.artist || item.username || ''}</Text>
      </View>
      <Ionicons name="play-circle" size={28} color="#8B5CF6" />
    </TouchableOpacity>
  );

  const renderPostItem = ({ item }) => (
    <TouchableOpacity
      style={styles.postRow}
      onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
    >
      <View style={styles.postContent}>
        <Text style={styles.postText} numberOfLines={2}>{item.content || ''}</Text>
        {item.media_url && (
          <Image source={{ uri: item.media_url }} style={styles.postThumb} />
        )}
      </View>
      <View style={styles.postMeta}>
        <Image source={{ uri: avatar(item?.user) }} style={styles.smallAvatar} />
        <Text style={styles.postUser}>@{item?.user?.username || '?'}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderPlaylistItem = ({ item }) => (
    <TouchableOpacity
      style={styles.resultRow}
      onPress={() => navigation.navigate('PlaylistDetail', { playlistId: item.id })}
    >
      <Image source={{ uri: item.cover_url || item.cover || `https://i.pravatar.cc/100?u=${item.id}` }} style={styles.thumb} />
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.resultArtist} numberOfLines={1}>
          {item?.owner?.display_name || item?.owner?.username || ''} • {item.track_count || 0} {t('search.songs')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
    </TouchableOpacity>
  );

  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      style={styles.resultRow}
      onPress={() => navigation.navigate('UserProfile', { username: item.username })}
    >
      <Image source={{ uri: avatar(item) }} style={styles.thumb} />
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle} numberOfLines={1}>{item.display_name || item.username}</Text>
        <Text style={styles.resultArtist} numberOfLines={1}>@{item.username}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
    </TouchableOpacity>
  );

  const renderHashtagItem = ({ item }) => (
    <TouchableOpacity
      style={styles.resultRow}
      onPress={() => {
        const tag = item.name || item.tag || item.hashtag || '';
        navigation.navigate('Search', { initialQuery: `#${tag.replace(/^#/, '')}`, tab: 'posts' });
      }}
    >
      <View style={styles.hashtagIcon}>
        <Ionicons name="pricetag" size={24} color="#8B5CF6" />
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle}>#{item.name || item.tag || item.hashtag || ''}</Text>
        <Text style={styles.resultArtist}>
          {item.post_count || item.count || 0} {t('search.posts').toLowerCase()}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
    </TouchableOpacity>
  );

  const renderResultItem = ({ item }) => {
    if (searchTab === 'music') return renderMusicItem({ item });
    if (searchTab === 'posts') return renderPostItem({ item });
    if (searchTab === 'playlists') return renderPlaylistItem({ item });
    if (searchTab === 'hashtags') return renderHashtagItem({ item });
    return renderUserItem({ item });
  };

  // Boş sorgu: Keşfet bölümleri
  const renderDiscover = () => (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.discoverContent, { paddingBottom: insets.bottom + 100 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
      showsVerticalScrollIndicator={false}
    >
      {discoverLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : discoverData ? (
        <>
          {/* Arama geçmişi */}
          {searchHistory.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('search.searchHistory')}</Text>
                <TouchableOpacity onPress={clearHistory}><Text style={styles.clearBtn}>{t('search.clear')}</Text></TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {searchHistory.slice(0, 20).map((h) => (
                  <TouchableOpacity key={h.id || h.query} style={styles.chip} onPress={() => onHistoryItemPress(h)}>
                    <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                    <Text style={styles.chipText}>{h.query}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Popüler aramalar */}
          {trendingSearches.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('search.popularSearches')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {trendingSearches.map((t, i) => (
                  <TouchableOpacity key={t.query || i} style={styles.chip} onPress={() => onTrendingPress(t)}>
                    <Ionicons name="trending-up" size={14} color="#8B5CF6" />
                    <Text style={styles.chipText}>{t.query}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Trend hashtag'ler */}
          {trendingHashtags.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('search.trendingHashtags')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {trendingHashtags.map((h, i) => (
                  <TouchableOpacity
                    key={h.id || h.name || i}
                    style={[styles.chip, { backgroundColor: '#1E1B4B' }]}
                    onPress={() => {
                      const tag = h.name || h.tag || h.hashtag || '';
                      setQuery(`#${tag.replace(/^#/, '')}`);
                      setSearchTab('hashtags');
                      setTimeout(() => search(`#${tag.replace(/^#/, '')}`), 150);
                    }}
                  >
                    <Ionicons name="pricetag" size={14} color="#8B5CF6" />
                    <Text style={styles.chipText}>#{h.name || h.tag || h.hashtag || ''}</Text>
                    {(h.post_count || h.count) ? (
                      <Text style={[styles.chipText, { color: '#9CA3AF', fontSize: 12 }]}>
                        {h.post_count || h.count}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Native reklam - Keşfet */}
          <View style={styles.section}>
            <NativeAd placement="discover" adIndex={0} />
          </View>

          {/* Kişiselleştirilmiş öneriler */}
          {discoverData.forYou?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('search.recommendedForYou')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {discoverData.forYou.slice(0, 8).map((p) => (
                  <TouchableOpacity key={p.id} style={styles.card} onPress={() => navigation.navigate('PostDetail', { postId: p.id })}>
                    {p.media_url ? <Image source={{ uri: p.media_url }} style={styles.cardImg} /> : <View style={[styles.cardImg, styles.cardPlaceholder]} />}
                    <Text style={styles.cardTitle} numberOfLines={2}>{p.content || t('search.post')}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Trend müzikler */}
          {(discoverData.trendingTracks?.length > 0 || discoverData.popularTracks?.length > 0) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('search.trendingMusic')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {(discoverData.trendingTracks || discoverData.popularTracks).slice(0, 10).map((t, idx) => (
                  <TouchableOpacity key={t.id || idx} style={styles.musicCard} onPress={() => playTrack(t)}>
                    <Image source={{ uri: t.cover_url || t.thumbnail }} style={styles.musicCardImg} />
                    <Text style={styles.musicCardTitle} numberOfLines={1}>{t.title || t.name}</Text>
                    <Text style={styles.musicCardArtist} numberOfLines={1}>{t.artist || ''}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Popular in Your Country */}
          {discoverData.popularInYourCountry?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('search.popularInYourCountry')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {discoverData.popularInYourCountry.slice(0, 10).map((t, idx) => (
                  <TouchableOpacity key={t.id || idx} style={styles.musicCard} onPress={() => playTrack(t)}>
                    <Image source={{ uri: t.cover_url || t.thumbnail }} style={styles.musicCardImg} />
                    <Text style={styles.musicCardTitle} numberOfLines={1}>{t.title || t.name}</Text>
                    <Text style={styles.musicCardArtist} numberOfLines={1}>{t.artist || ''}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Kategori keşif (6 kategori) */}
          {discoverData.categories?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('search.categories')}</Text>
              <View style={styles.categoryGrid}>
                {discoverData.categories.slice(0, 6).map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.categoryCard}
                    onPress={() => searchWithQuery(c.name)}
                  >
                    <View style={[styles.categoryIcon, { backgroundColor: '#1F2937' }]}>
                      <Ionicons name="musical-notes" size={24} color="#8B5CF6" />
                    </View>
                    <Text style={styles.categoryName}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Yeni çıkan müzikler */}
          {discoverData.newReleases?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('search.newMusic')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {discoverData.newReleases.slice(0, 10).map((t, idx) => (
                  <TouchableOpacity key={t.id || idx} style={styles.musicCard} onPress={() => playTrack(t)}>
                    <Image source={{ uri: t.cover_url || t.thumbnail }} style={styles.musicCardImg} />
                    <Text style={styles.musicCardTitle} numberOfLines={1}>{t.title || t.name}</Text>
                    <Text style={styles.musicCardArtist} numberOfLines={1}>{t.artist || ''}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Mevsimsel öneriler */}
          {discoverData.seasonal?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('search.seasonalRecommendations')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {discoverData.seasonal.slice(0, 8).map((t, idx) => (
                  <TouchableOpacity key={t.id || idx} style={styles.musicCard} onPress={() => playTrack(t)}>
                    <Image source={{ uri: t.cover_url || t.thumbnail }} style={styles.musicCardImg} />
                    <Text style={styles.musicCardTitle} numberOfLines={1}>{t.title || t.name}</Text>
                    <Text style={styles.musicCardArtist} numberOfLines={1}>{t.artist || ''}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Ruh haline göre müzik */}
          {discoverData.moods?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('search.byMood')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {discoverData.moods.map((m, i) => (
                  <TouchableOpacity key={m || i} style={[styles.chip, styles.moodChip]} onPress={() => searchWithQuery(m)}>
                    <Text style={styles.chipText}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Arkadaş aktivitesi */}
          {discoverData.friendsActivity?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('search.friendsListening')}</Text>
              {discoverData.friendsActivity.slice(0, 5).map((a) => (
                <TouchableOpacity
                  key={a.user_id}
                  style={styles.friendRow}
                  onPress={() => a.track && playTrack(a.track)}
                >
                  <Image source={{ uri: a.user_avatar || avatar({}) }} style={styles.smallAvatar} />
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{a.username} {t('search.listening')}</Text>
                    <Text style={styles.friendTrack} numberOfLines={1}>{a.track?.title || a.track?.name || ''}</Text>
                  </View>
                  {a.track && <Ionicons name="play" size={24} color="#8B5CF6" />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.suggestionsBtn} onPress={() => navigation.navigate('UserSuggestions')}>
            <Text style={styles.suggestionsBtnText}>{t('search.followSuggestions')}</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.center}>
          <Text style={styles.empty}>{t('search.discoverFailed')}</Text>
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('search.discover')}</Text>
        <View style={styles.searchRow}>
          <View style={styles.inputWrap}>
            <Ionicons name="search" size={20} color="#6B7280" />
            <TextInput
              style={styles.input}
              placeholder={t('search.searchPlaceholder')}
              placeholderTextColor="#6B7280"
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                if (text.startsWith('#') && searchTab !== 'hashtags') {
                  setSearchTab('hashtags');
                }
              }}
              onSubmitEditing={search}
              returnKeyType="search"
            />
            <TouchableOpacity
              onPress={voiceSearching ? stopVoiceSearch : startVoiceSearch}
              style={styles.voiceBtn}
            >
              {voiceSearching ? (
                <ActivityIndicator size="small" color="#8B5CF6" />
              ) : (
                <Ionicons name="mic" size={22} color="#8B5CF6" />
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.searchBtn} onPress={search}>
            <Text style={styles.searchBtnText}>{t('search.searchButton')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : !query.trim() ? (
        renderDiscover()
      ) : (
        <>
          {/* Tarih filtresi (gönderi için) */}
          {searchTab === 'posts' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateFilterRow} contentContainerStyle={styles.dateFilterContent}>
              {DATE_FILTER_KEYS.map((d) => (
                <TouchableOpacity
                  key={d.key}
                  style={[styles.dateChip, dateFilter === d.key && styles.dateChipActive]}
                  onPress={() => setDateFilter(d.key)}
                >
                  <Text style={[styles.dateChipText, dateFilter === d.key && styles.dateChipTextActive]}>{t(d.labelKey)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={styles.tabRow}>
            {TAB_KEYS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.searchTab, searchTab === tab.key && styles.searchTabActive]}
                onPress={() => setSearchTab(tab.key)}
              >
                <Ionicons name={tab.icon} size={16} color={searchTab === tab.key ? '#fff' : '#9CA3AF'} />
                <Text style={[styles.searchTabText, searchTab === tab.key && styles.searchTabTextActive]}>{t(tab.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={currentResults}
            renderItem={renderResultItem}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            keyExtractor={(item) => item.id || item.youtube_id || String(Math.random())}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
            ListEmptyComponent={<Text style={styles.empty}>{t(`search.${searchTab === 'music' ? 'music' : searchTab === 'posts' ? 'posts' : searchTab === 'playlists' ? 'playlists' : searchTab === 'hashtags' ? 'hashtags' : 'users'}`)} {t('search.notFound')}</Text>}
          />
        </>
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 12 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2937', borderRadius: 12, paddingHorizontal: 12 },
  input: { flex: 1, padding: 12, fontSize: 16, color: colors.text },
  voiceBtn: { padding: 8 },
  searchBtn: { backgroundColor: '#8B5CF6', borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center' },
  searchBtnText: { color: colors.text, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  scroll: { flex: 1 },
  empty: { color: '#9CA3AF', textAlign: 'center', paddingVertical: 40 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  searchTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  searchTabActive: { backgroundColor: '#8B5CF6' },
  searchTabText: { fontSize: 14, color: '#9CA3AF' },
  searchTabTextActive: { color: colors.text, fontWeight: '600' },
  dateFilterRow: { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  dateFilterContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  dateChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1F2937', marginRight: 8 },
  dateChipActive: { backgroundColor: '#8B5CF6' },
  dateChipText: { fontSize: 13, color: '#9CA3AF' },
  dateChipTextActive: { color: colors.text, fontWeight: '600' },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  thumb: { width: 56, height: 56, borderRadius: 8, marginRight: 12 },
  resultInfo: { flex: 1 },
  resultTitle: { fontSize: 16, fontWeight: '500', color: colors.text },
  resultArtist: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
  postRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  postContent: { marginBottom: 8 },
  postText: { fontSize: 15, color: colors.text, marginBottom: 8 },
  postThumb: { width: '100%', height: 120, borderRadius: 8 },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallAvatar: { width: 28, height: 28, borderRadius: 14 },
  postUser: { fontSize: 13, color: '#9CA3AF' },
  discoverContent: { padding: 16 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 12 },
  clearBtn: { fontSize: 14, color: colors.accent },
  chipRow: { flexDirection: 'row', marginBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1F2937', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  chipText: { fontSize: 14, color: colors.text },
  moodChip: { backgroundColor: '#1E1B4B' },
  card: { width: CARD_WIDTH, marginRight: 12 },
  cardImg: { width: CARD_WIDTH, height: CARD_WIDTH, borderRadius: 12 },
  cardPlaceholder: { backgroundColor: '#1F2937' },
  cardTitle: { fontSize: 13, color: colors.text, marginTop: 6, numberOfLines: 2 },
  musicCard: { width: 120, marginRight: 12 },
  musicCardImg: { width: 120, height: 120, borderRadius: 12 },
  musicCardTitle: { fontSize: 13, color: colors.text, marginTop: 4 },
  musicCardArtist: { fontSize: 12, color: '#9CA3AF' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  categoryCard: { width: (SCREEN_WIDTH - 48) / 3 - 8, alignItems: 'center' },
  categoryIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  categoryName: { fontSize: 12, color: colors.text, marginTop: 6 },
  friendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  friendInfo: { flex: 1, marginLeft: 12 },
  friendName: { fontSize: 14, color: colors.text },
  friendTrack: { fontSize: 13, color: '#9CA3AF' },
  suggestionsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#1F2937', borderRadius: 12, marginTop: 8 },
  suggestionsBtnText: { fontSize: 16, color: colors.text, fontWeight: '500' },
  hashtagIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1E1B4B', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
});
