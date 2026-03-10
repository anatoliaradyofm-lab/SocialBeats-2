import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  Dimensions, ActivityIndicator, Modal, ScrollView, Animated,
  RefreshControl, StatusBar, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { getLocale } from '../lib/localeStore';
import { useTheme } from '../contexts/ThemeContext';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const GENRE_ICONS = {
  pop: 'musical-notes', rock: 'flash', jazz: 'cafe', classical: 'leaf',
  hiphop: 'mic', rnb: 'heart', electronic: 'pulse', latin: 'flame',
  kpop: 'star', metal: 'skull', country: 'sunny', blues: 'moon',
  reggae: 'happy', folk: 'bonfire', indie: 'compass', punk: 'thunderstorm',
};

const GRADIENT_SETS = [
  ['#667eea', '#764ba2'],
  ['#f093fb', '#f5576c'],
  ['#4facfe', '#00f2fe'],
  ['#43e97b', '#38f9d7'],
  ['#fa709a', '#fee140'],
  ['#a18cd1', '#fbc2eb'],
  ['#ffecd2', '#fcb69f'],
  ['#ff9a9e', '#fecfef'],
  ['#a1c4fd', '#c2e9fb'],
  ['#d4fc79', '#96e6a1'],
  ['#84fab0', '#8fd3f4'],
  ['#cfd9df', '#e2ebf0'],
];

function getGradient(index) {
  return GRADIENT_SETS[index % GRADIENT_SETS.length];
}

function formatCount(n) {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function CountryFlag({ country }) {
  const flags = {
    turkey: '🇹🇷', türkiye: '🇹🇷', tr: '🇹🇷',
    'united states': '🇺🇸', usa: '🇺🇸', us: '🇺🇸',
    germany: '🇩🇪', de: '🇩🇪', deutschland: '🇩🇪',
    france: '🇫🇷', fr: '🇫🇷',
    japan: '🇯🇵', jp: '🇯🇵',
    'south korea': '🇰🇷', korea: '🇰🇷', kr: '🇰🇷',
    brazil: '🇧🇷', br: '🇧🇷', brasil: '🇧🇷',
    india: '🇮🇳', in: '🇮🇳',
    indonesia: '🇮🇩', id: '🇮🇩',
    russia: '🇷🇺', ru: '🇷🇺',
    mexico: '🇲🇽', mx: '🇲🇽',
    'united kingdom': '🇬🇧', uk: '🇬🇧', gb: '🇬🇧',
    spain: '🇪🇸', es: '🇪🇸', españa: '🇪🇸',
    italy: '🇮🇹', it: '🇮🇹', italia: '🇮🇹',
    argentina: '🇦🇷', ar: '🇦🇷',
    colombia: '🇨🇴', co: '🇨🇴',
    chile: '🇨🇱', cl: '🇨🇱',
    peru: '🇵🇪', pe: '🇵🇪',
    egypt: '🇪🇬', eg: '🇪🇬',
    'saudi arabia': '🇸🇦', sa: '🇸🇦',
    uae: '🇦🇪', ae: '🇦🇪',
    'south africa': '🇿🇦', za: '🇿🇦',
    nigeria: '🇳🇬', ng: '🇳🇬',
    pakistan: '🇵🇰', pk: '🇵🇰',
    vietnam: '🇻🇳', vn: '🇻🇳',
    philippines: '🇵🇭', ph: '🇵🇭',
    thailand: '🇹🇭', th: '🇹🇭',
    malaysia: '🇲🇾', my: '🇲🇾',
    singapore: '🇸🇬', sg: '🇸🇬',
    poland: '🇵🇱', pl: '🇵🇱',
  };
  const key = (country || '').toLowerCase().trim();
  const flag = flags[key];
  if (!flag) return null;
  return <Text style={{ fontSize: 20 }}>{flag}</Text>;
}

export default function DiscoverPeopleScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [followedIds, setFollowedIds] = useState(new Set());

  const [filterVisible, setFilterVisible] = useState(false);
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [tempCountry, setTempCountry] = useState('');
  const [tempCity, setTempCity] = useState('');

  const flatListRef = useRef(null);
  const followAnimations = useRef({});

  const ITEM_HEIGHT = SCREEN_HEIGHT - insets.top - insets.bottom;

  const loadUsers = useCallback(async (reset = false) => {
    if (!token) return;
    if (!reset && loadingMore) return;

    const newOffset = reset ? 0 : offset;
    if (!reset) setLoadingMore(true);
    else setLoading(true);

    try {
      let url = `/users/discover?limit=15&offset=${newOffset}`;
      if (selectedCountry) url += `&country=${encodeURIComponent(selectedCountry)}`;
      if (selectedCity) url += `&city=${encodeURIComponent(selectedCity)}`;

      const res = await api.get(url, token);
      const list = res?.users || (Array.isArray(res) ? res : []);

      if (reset) {
        setUsers(list);
        setOffset(list.length);
      } else {
        setUsers(prev => [...prev, ...list]);
        setOffset(prev => prev + list.length);
      }
      setHasMore(res?.has_more !== false && list.length >= 15);
    } catch {
      if (reset) setUsers([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [token, offset, selectedCountry, selectedCity, loadingMore]);

  const loadCountries = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/users/discover/countries', token);
      setCountries(res?.countries || []);
    } catch {}
  }, [token]);

  useEffect(() => {
    loadUsers(true);
    loadCountries();
  }, [token]);

  useEffect(() => {
    setOffset(0);
    loadUsers(true);
  }, [selectedCountry, selectedCity]);

  const onRefresh = () => {
    setRefreshing(true);
    setOffset(0);
    loadUsers(true);
  };

  const onEndReached = () => {
    if (!loadingMore && hasMore && users.length >= 5) {
      loadUsers(false);
    }
  };

  const handleFollow = async (userId) => {
    try {
      await api.post(`/social/friend-request/${userId}`, {}, token);
      setFollowedIds(prev => new Set([...prev, userId]));

      if (!followAnimations.current[userId]) {
        followAnimations.current[userId] = new Animated.Value(0);
      }
      Animated.sequence([
        Animated.timing(followAnimations.current[userId], { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(1500),
        Animated.timing(followAnimations.current[userId], { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    } catch {}
  };

  const handleMessage = (user) => {
    navigation.navigate('Chat', {
      conversationId: null,
      recipientId: user.id,
      recipientUsername: user.username,
      recipientName: user.display_name || user.username,
      recipientAvatar: user.avatar_url,
    });
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;

  const applyFilter = () => {
    setSelectedCountry(tempCountry);
    setSelectedCity(tempCity);
    setFilterVisible(false);
  };

  const clearFilter = () => {
    setTempCountry('');
    setTempCity('');
    setSelectedCountry('');
    setSelectedCity('');
    setFilterVisible(false);
  };

  const renderUser = ({ item, index }) => {
    const user = item;
    const isFollowed = followedIds.has(user.id);
    const gradient = getGradient(index);
    const avatar = user.avatar_url || `https://i.pravatar.cc/200?u=${user.username || user.id}`;
    const cover = user.cover_url;
    const genres = user.music_genres || [];
    const country = user.country || '';
    const city = user.city || '';
    const location = [city, country].filter(Boolean).join(', ');
    const nowPlaying = user.now_playing;

    return (
      <View style={[styles.userCard, { height: ITEM_HEIGHT }]}>
        {cover ? (
          <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} blurRadius={20} />
        ) : null}
        <LinearGradient
          colors={[`${gradient[0]}99`, `${gradient[1]}CC`, '#0A0A0BFF']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />

        <View style={styles.cardContent}>
          {/* Avatar */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('UserProfile', { username: user.username })}
          >
            <View style={styles.avatarContainer}>
              <Image source={{ uri: avatar }} style={styles.avatar} />
              {user.is_verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={28} color="#8B5CF6" />
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* Name + Username */}
          <Text style={styles.displayName}>{user.display_name || user.username}</Text>
          <Text style={styles.username}>@{user.username}</Text>

          {/* Location */}
          {location ? (
            <View style={styles.locationRow}>
              <CountryFlag country={country} />
              <Ionicons name="location" size={16} color="#D1D5DB" />
              <Text style={styles.locationText}>{location}</Text>
            </View>
          ) : null}

          {/* Now Playing */}
          {nowPlaying ? (
            <View style={styles.nowPlayingBadge}>
              <Ionicons name="musical-note" size={14} color="#8B5CF6" />
              <Text style={styles.nowPlayingText} numberOfLines={1}>
                {nowPlaying.title} - {nowPlaying.artist}
              </Text>
            </View>
          ) : null}

          {/* Bio */}
          {user.bio ? (
            <Text style={styles.bio} numberOfLines={3}>{user.bio}</Text>
          ) : null}

          {/* Music Genres */}
          {genres.length > 0 && (
            <View style={styles.genresContainer}>
              <Ionicons name="headset" size={16} color="#D1D5DB" style={{ marginRight: 6 }} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {genres.slice(0, 6).map((genre, gi) => (
                  <View key={gi} style={styles.genreChip}>
                    <Ionicons
                      name={GENRE_ICONS[genre.toLowerCase()] || 'musical-notes'}
                      size={12}
                      color="#E9D5FF"
                    />
                    <Text style={styles.genreText}>{genre}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{formatCount(user.follower_count)}</Text>
              <Text style={styles.statLabel}>{t('profile.followers') || 'Followers'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{formatCount(user.following_count)}</Text>
              <Text style={styles.statLabel}>{t('profile.following') || 'Following'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{formatCount(user.post_count)}</Text>
              <Text style={styles.statLabel}>{t('profile.posts') || 'Posts'}</Text>
            </View>
          </View>

          {/* Mutual Friends */}
          {user.mutual_friends > 0 && (
            <View style={styles.mutualRow}>
              <Ionicons name="people" size={16} color="#A78BFA" />
              <Text style={styles.mutualText}>
                {user.mutual_friends} {t('discover.mutualFriends') || 'mutual friends'}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.followButton, isFollowed && styles.followedButton]}
              onPress={() => !isFollowed && handleFollow(user.id)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isFollowed ? 'checkmark' : 'person-add'}
                size={20}
                color="#fff"
              />
              <Text style={styles.followButtonText}>
                {isFollowed ? (t('profile.following') || 'Following') : (t('suggestions.follow') || 'Follow')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.messageButton}
              onPress={() => handleMessage(user)}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-outline" size={20} color="#fff" />
              <Text style={styles.messageButtonText}>{t('profile.message') || 'Message'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Page indicator */}
        <View style={[styles.pageIndicator, { bottom: insets.bottom + 16 }]}>
          <Text style={styles.pageText}>{index + 1} / {users.length}</Text>
        </View>
      </View>
    );
  };

  const hasActiveFilter = selectedCountry || selectedCity;

  if (loading && users.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('discover.suggestedUsers') || 'Discover People'}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('discover.suggestedUsers') || 'Discover People'}</Text>
        <TouchableOpacity
          onPress={() => { setTempCountry(selectedCountry); setTempCity(selectedCity); setFilterVisible(true); }}
          style={[styles.filterBtn, hasActiveFilter && styles.filterBtnActive]}
        >
          <Ionicons name="options" size={22} color={hasActiveFilter ? '#fff' : '#D1D5DB'} />
          {hasActiveFilter && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      {/* Active filter badge */}
      {hasActiveFilter && (
        <View style={styles.filterBadgeRow}>
          <View style={styles.filterBadge}>
            <Ionicons name="location" size={14} color="#8B5CF6" />
            <Text style={styles.filterBadgeText}>
              {[selectedCity, selectedCountry].filter(Boolean).join(', ')}
            </Text>
            <TouchableOpacity onPress={clearFilter} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Users FlatList - Reels style */}
      <FlatList
        ref={flatListRef}
        data={users}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={true}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={[styles.footerLoader, { height: ITEM_HEIGHT * 0.3 }]}>
              <ActivityIndicator size="small" color="#8B5CF6" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={[styles.emptyContainer, { height: ITEM_HEIGHT }]}>
            <Ionicons name="people-outline" size={64} color="#4B5563" />
            <Text style={styles.emptyTitle}>
              {hasActiveFilter
                ? (t('discover.noUsersInRegion') || 'No users found in this region')
                : (t('discover.noUsersFound') || 'No users to discover')}
            </Text>
            <Text style={styles.emptySubtitle}>
              {hasActiveFilter
                ? (t('discover.tryDifferentFilter') || 'Try a different country or city')
                : (t('discover.checkBackLater') || 'Check back later for new people')}
            </Text>
            {hasActiveFilter && (
              <TouchableOpacity style={styles.clearFilterBtn} onPress={clearFilter}>
                <Text style={styles.clearFilterBtnText}>{t('common.clearFilter') || 'Clear Filter'}</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Country/City Filter Modal */}
      <Modal visible={filterVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('discover.filterByLocation') || 'Filter by Location'}</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Country Selection */}
            <Text style={styles.filterLabel}>{t('discover.country') || 'Country'}</Text>
            <ScrollView
              horizontal={false}
              style={styles.countryList}
              showsVerticalScrollIndicator={true}
            >
              <TouchableOpacity
                style={[styles.countryItem, !tempCountry && styles.countryItemActive]}
                onPress={() => setTempCountry('')}
              >
                <Ionicons name="globe-outline" size={20} color={!tempCountry ? '#8B5CF6' : '#9CA3AF'} />
                <Text style={[styles.countryItemText, !tempCountry && styles.countryItemTextActive]}>
                  {t('discover.allCountries') || 'All Countries'}
                </Text>
                {!tempCountry && <Ionicons name="checkmark" size={20} color="#8B5CF6" />}
              </TouchableOpacity>
              {countries.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.countryItem, tempCountry === c && styles.countryItemActive]}
                  onPress={() => setTempCountry(c)}
                >
                  <CountryFlag country={c} />
                  <Text style={[styles.countryItemText, tempCountry === c && styles.countryItemTextActive]}>
                    {c}
                  </Text>
                  {tempCountry === c && <Ionicons name="checkmark" size={20} color="#8B5CF6" />}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* City Input (simple - just show if country selected) */}
            {tempCountry ? (
              <View style={styles.citySection}>
                <Text style={styles.filterLabel}>{t('discover.city') || 'City'}</Text>
                <TouchableOpacity
                  style={[styles.countryItem, !tempCity && styles.countryItemActive]}
                  onPress={() => setTempCity('')}
                >
                  <Ionicons name="business-outline" size={20} color={!tempCity ? '#8B5CF6' : '#9CA3AF'} />
                  <Text style={[styles.countryItemText, !tempCity && styles.countryItemTextActive]}>
                    {t('discover.allCities') || 'All Cities'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Apply Button */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.clearBtn} onPress={() => { setTempCountry(''); setTempCity(''); }}>
                <Text style={styles.clearBtnText}>{t('common.clear') || 'Clear'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={applyFilter}>
                <Text style={styles.applyBtnText}>{t('common.apply') || 'Apply'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(10,10,11,0.85)',
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
  },
  headerBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  filterBtn: { padding: 8, borderRadius: 20, backgroundColor: '#1F2937' },
  filterBtnActive: { backgroundColor: '#8B5CF6' },
  filterDot: {
    position: 'absolute', top: 6, right: 6, width: 8, height: 8,
    borderRadius: 4, backgroundColor: '#EF4444',
  },
  filterBadgeRow: {
    position: 'absolute', top: 52, left: 0, right: 0, zIndex: 10,
    paddingHorizontal: 16, paddingTop: 4,
  },
  filterBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1F2937', borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start',
  },
  filterBadgeText: { color: '#D1D5DB', fontSize: 13, fontWeight: '500' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  userCard: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
    width: '100%',
  },
  avatarContainer: {
    width: 130, height: 130, borderRadius: 65,
    borderWidth: 3, borderColor: 'rgba(139,92,246,0.6)',
    marginBottom: 16, position: 'relative',
    ...Platform.select({
      ios: { shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  avatar: { width: '100%', height: '100%', borderRadius: 65 },
  verifiedBadge: {
    position: 'absolute', bottom: 2, right: 2,
    backgroundColor: colors.background, borderRadius: 14,
  },
  displayName: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 4 },
  username: { fontSize: 16, color: '#D1D5DB', marginBottom: 12 },

  locationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 10, backgroundColor: 'rgba(31,41,55,0.7)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  locationText: { color: '#E5E7EB', fontSize: 14, fontWeight: '500' },

  nowPlayingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(139,92,246,0.2)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, marginBottom: 10,
    maxWidth: '90%',
  },
  nowPlayingText: { color: '#D8B4FE', fontSize: 13, fontWeight: '500', flexShrink: 1 },

  bio: {
    color: '#D1D5DB', fontSize: 14, textAlign: 'center',
    lineHeight: 20, marginBottom: 14, paddingHorizontal: 8,
  },

  genresContainer: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 16, maxWidth: '100%',
  },
  genreChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(139,92,246,0.15)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.25)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginRight: 6,
  },
  genreText: { color: '#E9D5FF', fontSize: 12, fontWeight: '600' },

  statsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(31,41,55,0.6)', borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 24, marginBottom: 14,
    width: '100%',
  },
  statItem: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 20, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: '#374151' },

  mutualRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 16,
  },
  mutualText: { color: '#A78BFA', fontSize: 13, fontWeight: '600' },

  actionButtons: {
    flexDirection: 'row', gap: 12, marginTop: 4, width: '100%',
  },
  followButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#8B5CF6', paddingVertical: 14, borderRadius: 28,
    ...Platform.select({
      ios: { shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  followedButton: { backgroundColor: '#374151' },
  followButtonText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  messageButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)', paddingVertical: 14, borderRadius: 28,
  },
  messageButtonText: { color: colors.text, fontSize: 16, fontWeight: '600' },

  pageIndicator: {
    position: 'absolute', alignSelf: 'center',
  },
  pageText: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },

  footerLoader: { justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { color: '#9CA3AF', fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  emptySubtitle: { color: '#6B7280', fontSize: 14, marginTop: 8, textAlign: 'center' },
  clearFilterBtn: {
    marginTop: 20, paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: '#8B5CF6', borderRadius: 24,
  },
  clearFilterBtnText: { color: colors.text, fontSize: 15, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, maxHeight: SCREEN_HEIGHT * 0.7,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#374151', alignSelf: 'center', marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  filterLabel: { fontSize: 14, fontWeight: '600', color: '#9CA3AF', marginBottom: 10, textTransform: 'uppercase' },
  countryList: { maxHeight: 300, marginBottom: 16 },
  countryItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4,
  },
  countryItemActive: { backgroundColor: 'rgba(139,92,246,0.15)' },
  countryItemText: { color: '#D1D5DB', fontSize: 15, flex: 1 },
  countryItemTextActive: { color: '#A78BFA', fontWeight: '600' },
  citySection: { marginBottom: 16 },
  modalActions: {
    flexDirection: 'row', gap: 12, marginTop: 8,
  },
  clearBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 14,
    borderRadius: 24, borderWidth: 1, borderColor: '#374151',
  },
  clearBtnText: { color: '#9CA3AF', fontSize: 16, fontWeight: '600' },
  applyBtn: {
    flex: 2, alignItems: 'center', paddingVertical: 14,
    borderRadius: 24, backgroundColor: '#8B5CF6',
  },
  applyBtnText: { color: colors.text, fontSize: 16, fontWeight: '700' },
});
