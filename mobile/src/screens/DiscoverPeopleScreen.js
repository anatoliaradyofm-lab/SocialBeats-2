import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  Dimensions, ActivityIndicator, Modal, ScrollView, Animated,
  RefreshControl, StatusBar, Platform, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { getLocale } from '../lib/localeStore';
import { useTheme } from '../contexts/ThemeContext';
import { COUNTRIES } from '../lib/countries';
import { Alert } from '../components/ui/AppAlert';

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

// Ülke adı veya kodu → COUNTRIES listesinden eşleşme bul
function resolveCountry(raw) {
  if (!raw) return null;
  const q = raw.trim().toLowerCase();
  return COUNTRIES.find(
    c => c.code.toLowerCase() === q || c.name.toLowerCase() === q
  ) || null;
}

function CountryFlag({ country }) {
  const resolved = resolveCountry(country);
  if (!resolved) return null;
  return <Text style={{ fontSize: 20 }}>{resolved.flag}</Text>;
}

export default function DiscoverPeopleScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token, user: authUser, isGuest } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [followedIds, setFollowedIds] = useState(new Set());

  const myCountry = authUser?.country || authUser?.region || '';

  const [filterVisible, setFilterVisible] = useState(false);
  const [countries, setCountries] = useState([]);
  const [genders, setGenders] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedGender, setSelectedGender] = useState('');
  const [tempCountry, setTempCountry] = useState('');
  const [tempCity, setTempCity] = useState('');
  const [tempGender, setTempGender] = useState('');

  // User search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFollowing, setSearchFollowing] = useState({});
  const searchDebounceRef = useRef(null);
  const searchInputRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(108);

  const flatListRef = useRef(null);
  const followAnimations = useRef({});
  const touchStartY = useRef(0);
  const wheelCooldown = useRef(false);
  const usersLengthRef = useRef(0);
  usersLengthRef.current = users.length;
  const [containerHeight, setContainerHeight] = useState(
    Platform.OS === 'web' ? 700 : SCREEN_HEIGHT - insets.top - insets.bottom
  );

  const ITEM_HEIGHT = Platform.OS === 'web'
    ? containerHeight
    : SCREEN_HEIGHT - insets.top - insets.bottom - headerHeight;

  const loadingMoreRef = useRef(false);
  const offsetRef      = useRef(0);
  const filtersRef     = useRef({ country: selectedCountry, city: selectedCity, gender: selectedGender });

  // Filtreleri ref'e senkronize et
  filtersRef.current = { country: selectedCountry, city: selectedCity, gender: selectedGender };

  const fetchUsers = useCallback(async (reset = false) => {
    if (!reset && loadingMoreRef.current) return;

    const { country, city, gender } = filtersRef.current;
    const currentOffset = reset ? 0 : offsetRef.current;

    if (reset) { setLoading(true); setUsers([]); setActiveIndex(0); offsetRef.current = 0; }
    else { setLoadingMore(true); loadingMoreRef.current = true; }

    try {
      let url = `/users/discover?limit=15&offset=${currentOffset}`;
      if (country) url += `&country=${encodeURIComponent(country)}`;
      if (city)    url += `&city=${encodeURIComponent(city)}`;
      if (gender)  url += `&gender=${encodeURIComponent(gender)}`;

      const res  = await api.get(url, token);
      const list = res?.users || (Array.isArray(res) ? res : []);

      if (reset) {
        setUsers(list);
        const followed = new Set();
        // Misafir modunda takip durumu her zaman boş — API yanıtı yoksayılır
        if (!isGuest) list.forEach(u => { if (u.is_following) followed.add(u.id); });
        setFollowedIds(followed);
      } else {
        setUsers(prev => [...prev, ...list]);
        if (!isGuest) {
          setFollowedIds(prev => {
            const next = new Set(prev);
            list.forEach(u => { if (u.is_following) next.add(u.id); });
            return next;
          });
        }
      }
      offsetRef.current += list.length;
      setOffset(offsetRef.current);
      setHasMore(res?.has_more !== false && list.length >= 15);
    } catch (err) {
      if (reset) setUsers([]);
      setApiError(err?.message || 'API hatası');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      loadingMoreRef.current = false;
    }
  }, [token]);

  // User search
  const runUserSearch = useCallback(async (q) => {
    const trimmed = q.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    try {
      const enc = encodeURIComponent(trimmed);
      const res = await api.get(`/search?q=${enc}&type=users&limit=20`, token);
      const list = res?.users || [];
      const followMap = {};
      // Misafir modunda takip durumu her zaman false
      list.forEach(u => { followMap[u.id] = !isGuest && (u.is_following ?? false); });
      setSearchFollowing(prev => ({ ...prev, ...followMap }));
      setSearchResults(list);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    if (searchQuery.trim().length >= 2) setSearchLoading(true);
    searchDebounceRef.current = setTimeout(() => runUserSearch(searchQuery), 280);
    return () => clearTimeout(searchDebounceRef.current);
  }, [searchQuery]);

  const handleSearchFollow = async (userId) => {
    if (isGuest || !token) {
      Alert.alert('Giriş Gerekli', 'Takip etmek için giriş yapmanız gerekiyor.', [
        { text: 'İptal', style: 'cancel' },
        { text: 'Giriş Yap', onPress: () => navigation.navigate('Auth') },
      ]);
      return;
    }
    const isFollowing = searchFollowing[userId];
    setSearchFollowing(prev => ({ ...prev, [userId]: !isFollowing }));
    try {
      if (isFollowing) {
        await api.delete(`/social/follow/${userId}`, token);
      } else {
        await api.post(`/social/follow/${userId}`, {}, token);
      }
    } catch {
      setSearchFollowing(prev => ({ ...prev, [userId]: isFollowing }));
    }
  };

  // İlk yükleme ve filtre değişimlerinde yeniden yükle
  useEffect(() => {
    fetchUsers(true);
  }, [token, selectedCountry, selectedCity, selectedGender]);

  // Ülkeler ve cinsiyetler
  useEffect(() => {
    if (!token) return;
    api.get('/users/discover/countries', token)
      .then(res => { setCountries(res?.countries || []); setGenders(res?.genders || []); })
      .catch(() => {});
  }, [token]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers(true);
  };

  const onEndReached = () => {
    if (!loadingMoreRef.current && hasMore && users.length >= 5) {
      fetchUsers(false);
    }
  };

  const handleFollow = async (userId) => {
    if (isGuest || !token) {
      Alert.alert('Giriş Gerekli', 'Takip etmek için giriş yapmanız gerekiyor.', [
        { text: 'İptal', style: 'cancel' },
        { text: 'Giriş Yap', onPress: () => navigation.navigate('Auth') },
      ]);
      return;
    }
    const wasFollowing = followedIds.has(userId);
    // Optimistic update
    setFollowedIds(prev => {
      const next = new Set(prev);
      if (wasFollowing) next.delete(userId); else next.add(userId);
      return next;
    });
    setUsers(prev => prev.map(u =>
      u.id === userId
        ? { ...u, follower_count: Math.max(0, (u.follower_count || 0) + (wasFollowing ? -1 : 1)) }
        : u
    ));
    try {
      if (wasFollowing) {
        await api.delete(`/social/follow/${userId}`, token);
      } else {
        await api.post(`/social/follow/${userId}`, {}, token);
        if (!followAnimations.current[userId]) {
          followAnimations.current[userId] = new Animated.Value(0);
        }
        Animated.sequence([
          Animated.timing(followAnimations.current[userId], { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.delay(1500),
          Animated.timing(followAnimations.current[userId], { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
      }
    } catch {
      // Revert optimistic update
      setFollowedIds(prev => {
        const next = new Set(prev);
        if (wasFollowing) next.add(userId); else next.delete(userId);
        return next;
      });
      setUsers(prev => prev.map(u =>
        u.id === userId
          ? { ...u, follower_count: Math.max(0, (u.follower_count || 0) + (wasFollowing ? 1 : -1)) }
          : u
      ));
    }
  };

  const handleMessage = (user) => {
    if (isGuest || !token) {
      Alert.alert('Giriş Gerekli', 'Mesaj göndermek için giriş yapmanız gerekiyor.', [
        { text: 'İptal', style: 'cancel' },
        { text: 'Giriş Yap', onPress: () => navigation.navigate('Auth') },
      ]);
      return;
    }
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
    setActiveIndex(0);
    setSelectedCountry(tempCountry);
    setSelectedCity(tempCity);
    setSelectedGender(tempGender);
    setFilterVisible(false);
  };

  const clearFilter = () => {
    setActiveIndex(0);
    setTempCountry('');
    setTempCity('');
    setTempGender('');
    setSelectedCountry('');
    setSelectedCity('');
    setSelectedGender('');
    setFilterVisible(false);
  };

  const renderUser = ({ item, index }) => {
    const user = item;
    const isFollowed = followedIds.has(user.id);
    const gradient = getGradient(index);
    const avatar = user.avatar_url || `https://i.pravatar.cc/200?u=${user.username || user.id}`;
    const cover = user.cover_url;
    const genres = user.music_genres || [];
    const rawCountry   = user.country || '';
    const resolved     = resolveCountry(rawCountry);
    const country      = resolved ? resolved.name : rawCountry;
    const city         = user.city || '';
    const location     = [city, country].filter(Boolean).join(', ');
    const nowPlaying = user.now_playing;

    // Web: full-screen card with scroll/swipe navigation
    if (Platform.OS === 'web') {
      const handleWheel = (e) => {
        if (wheelCooldown.current) return;
        wheelCooldown.current = true;
        setTimeout(() => { wheelCooldown.current = false; }, 700);
        if (e.deltaY > 0) setActiveIndex(i => Math.min(usersLengthRef.current - 1, i + 1));
        else               setActiveIndex(i => Math.max(0, i - 1));
      };
      const handleTouchStart = (e) => {
        touchStartY.current = e.nativeEvent?.pageY ?? e.touches?.[0]?.clientY ?? 0;
      };
      const handleTouchEnd = (e) => {
        const endY = e.nativeEvent?.pageY ?? e.changedTouches?.[0]?.clientY ?? 0;
        const dy = touchStartY.current - endY;
        if (dy > 60)       setActiveIndex(i => Math.min(usersLengthRef.current - 1, i + 1));
        else if (dy < -60) setActiveIndex(i => Math.max(0, i - 1));
      };
      return (
        <View style={styles.webCard} onWheel={handleWheel} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
          {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} blurRadius={20} /> : null}
          <LinearGradient colors={[`${gradient[0]}AA`, `${gradient[1]}DD`, '#0A0A0BFF']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />

          {/* Centered content */}
          <View style={styles.webCardInner}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('UserProfile', { username: user.username })}>
              <View style={styles.avatarContainer}>
                <Image source={{ uri: avatar }} style={styles.avatar} />
                {user.is_verified && <View style={styles.verifiedBadge}><Ionicons name="checkmark-circle" size={28} color="#8B5CF6" /></View>}
              </View>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('UserProfile', { username: user.username })}>
              <Text style={styles.displayName}>{user.display_name || user.username}</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('UserProfile', { username: user.username })}>
              <Text style={styles.username}>@{user.username}</Text>
            </TouchableOpacity>
            {location ? (
              <View style={styles.locationRow}>
                <CountryFlag country={country} />
                <Ionicons name="location" size={16} color="#D1D5DB" />
                <Text style={styles.locationText}>{location}</Text>
              </View>
            ) : null}
            {user.bio ? <Text style={styles.bio} numberOfLines={2}>{user.bio}</Text> : null}
            {genres.length > 0 && (
              <View style={styles.genresContainer}>
                <Ionicons name="headset" size={16} color="#D1D5DB" style={{ marginRight: 6 }} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {genres.slice(0, 5).map((genre, gi) => (
                    <View key={gi} style={styles.genreChip}>
                      <Ionicons name={GENRE_ICONS[genre.toLowerCase()] || 'musical-notes'} size={12} color="#E9D5FF" />
                      <Text style={styles.genreText}>{genre}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
            <View style={styles.statsRow}>
              <View style={styles.statItem}><Text style={styles.statNumber}>{formatCount(user.follower_count)}</Text><Text style={styles.statLabel}>Takipçi</Text></View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}><Text style={styles.statNumber}>{formatCount(user.following_count)}</Text><Text style={styles.statLabel}>Takip</Text></View>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={[styles.followButton, isFollowed && styles.followedButton]} onPress={() => handleFollow(user.id)} activeOpacity={0.8}>
                <Ionicons name={isFollowed ? 'checkmark' : 'person-add'} size={20} color="#fff" />
                <Text style={styles.followButtonText}>{isFollowed ? 'Takip Ediliyor' : 'Takip Et'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.messageButton} onPress={() => handleMessage(user)} activeOpacity={0.8}>
                <Ionicons name="chatbubble-outline" size={20} color="#fff" />
                <Text style={styles.messageButtonText}>Mesaj</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
      );
    }

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
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('UserProfile', { username: user.username })}>
            <Text style={styles.displayName}>{user.display_name || user.username}</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigation.navigate('UserProfile', { username: user.username })}>
            <Text style={styles.username}>@{user.username}</Text>
          </TouchableOpacity>

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
              onPress={() => handleFollow(user.id)}
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

  const hasActiveFilter = selectedCountry || selectedCity || selectedGender;

  if (loading && users.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t('discover.suggestedUsers') || 'Discover People'}</Text>
            <View style={{ width: 40 }} />
          </View>
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

      {/* Header — tek satır: geri + arama + filtre */}
      <View style={styles.header} onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.searchBarWrap}>
          <Ionicons name="search" size={17} color={searchQuery.length > 0 ? '#C084FC' : '#6B7280'} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchBarInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Kullanıcı ara..."
            placeholderTextColor="#6B7280"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchLoading && <ActivityIndicator size="small" color="#C084FC" />}
          {searchQuery.length > 0 && !searchLoading && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
              <Ionicons name="close-circle" size={17} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={() => { setTempCountry(selectedCountry); setTempCity(selectedCity); setTempGender(selectedGender); setFilterVisible(true); }}
          style={[styles.filterBtn, hasActiveFilter && styles.filterBtnActive]}
        >
          <Ionicons name="options" size={22} color={hasActiveFilter ? '#fff' : '#D1D5DB'} />
          {hasActiveFilter && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      {/* Active filter badge — hidden during search */}
      {hasActiveFilter && !searchQuery && (
        <View style={styles.filterBadgeRow}>
          <View style={styles.filterBadge}>
            <Ionicons name="options" size={14} color="#8B5CF6" />
            <Text style={styles.filterBadgeText}>
              {[
                selectedGender ? ({ male: 'Erkek', female: 'Kadın', other: 'Diğer' }[selectedGender] || selectedGender) : '',
                selectedCity,
                selectedCountry,
              ].filter(Boolean).join(', ')}
            </Text>
            <TouchableOpacity onPress={clearFilter} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Search results — shown when searchQuery >= 2 */}
      {searchQuery.trim().length >= 2 && (
        <View style={styles.searchResultsWrap}>
          {searchLoading && searchResults.length === 0 ? (
            <View style={styles.searchCenter}>
              <ActivityIndicator size="large" color="#C084FC" />
            </View>
          ) : searchResults.length === 0 ? (
            <View style={styles.searchCenter}>
              <Ionicons name="people-outline" size={44} color="#4B5563" />
              <Text style={styles.searchEmpty}>"{searchQuery}" için kullanıcı bulunamadı</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ paddingVertical: 8 }}
              renderItem={({ item }) => {
                const isFollowed = !isGuest && (searchFollowing[item.id] ?? (item.is_following ?? false));
                return (
                  <TouchableOpacity
                    style={styles.searchUserRow}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('UserProfile', { username: item.username })}
                  >
                    <Image
                      source={{ uri: item.avatar_url || `https://i.pravatar.cc/80?u=${item.id}` }}
                      style={styles.searchUserAvatar}
                    />
                    <View style={styles.searchUserInfo}>
                      <Text style={styles.searchUserName} numberOfLines={1}>
                        {item.display_name || item.username}
                      </Text>
                      <Text style={styles.searchUserSub} numberOfLines={1}>
                        @{item.username}{item.followers_count ? ` · ${item.followers_count} takipçi` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.searchFollowBtn, isFollowed && styles.searchFollowBtnActive]}
                      onPress={() => handleSearchFollow(item.id)}
                    >
                      <Text style={[styles.searchFollowBtnText, isFollowed && { color: '#9CA3AF' }]}>
                        {isFollowed ? 'Takipte' : 'Takip Et'}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {/* Web: single-user full-screen view — hidden during search */}
      {Platform.OS === 'web' && !searchQuery && (
        <View style={{ flex: 1 }}>
          {users.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="people-outline" size={64} color="#8B5CF6" />
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 16 }}>
                {apiError ? 'Bağlantı hatası' : hasActiveFilter ? 'Bu bölgede kullanıcı bulunamadı' : 'Henüz kullanıcı yok'}
              </Text>
              <Text style={{ color: '#9CA3AF', fontSize: 14, marginTop: 8 }}>
                {apiError || (hasActiveFilter ? 'Farklı bir filtre deneyin' : 'Daha sonra tekrar kontrol edin')}
              </Text>
            </View>
          ) : (
            renderUser({ item: users[Math.min(activeIndex, users.length - 1)], index: Math.min(activeIndex, users.length - 1) })
          )}
        </View>
      )}

      {/* Native: FlatList pagingEnabled — hidden during search */}
      {Platform.OS !== 'web' && !searchQuery && (
      <FlatList
        ref={flatListRef}
        style={{ flex: 1 }}
        data={users}
        renderItem={renderUser}
        keyExtractor={(item) => String(item.id)}
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
        removeClippedSubviews
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? <View style={[styles.footerLoader, { height: ITEM_HEIGHT * 0.3 }]}><ActivityIndicator size="small" color="#8B5CF6" /></View> : null}
        ListEmptyComponent={
          <View style={[styles.emptyContainer, { height: ITEM_HEIGHT }]}>
            <Ionicons name="people-outline" size={64} color="#8B5CF6" />
            <Text style={[styles.emptyTitle, { color: '#fff' }]}>
              {apiError ? 'Bağlantı hatası' : hasActiveFilter ? 'Bu bölgede kullanıcı bulunamadı' : 'Henüz kullanıcı yok'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: '#9CA3AF' }]}>
              {apiError || (hasActiveFilter ? 'Farklı bir filtre deneyin' : 'Daha sonra tekrar kontrol edin')}
            </Text>
            {hasActiveFilter && (
              <TouchableOpacity style={styles.clearFilterBtn} onPress={clearFilter}>
                <Text style={styles.clearFilterBtnText}>{t('common.clearFilter') || 'Clear Filter'}</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
      )}

      {/* Country/City Filter Modal — Web */}
      {Platform.OS === 'web' && filterVisible && (
        <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,6,15,0.88)', zIndex: 9999, justifyContent: 'flex-end' }}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            <LinearGradient colors={['rgba(26,10,46,0.35)', 'rgba(16,8,28,0.10)', 'rgba(10,5,18,0.02)', 'transparent']} locations={[0, 0.38, 0.68, 1]} style={styles.modalTopGrad} pointerEvents="none" />
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('discover.filterByLocation') || 'Filter by Location'}</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Gender Filter */}
            <Text style={styles.filterLabel}>Cinsiyet</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {[
                { value: '', label: 'Tümü', icon: 'people-outline' },
                { value: 'male', label: 'Erkek', icon: 'person-outline' },
                { value: 'female', label: 'Kadın', icon: 'person-outline' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.value || 'all'}
                  onPress={() => setTempGender(item.value)}
                  style={[styles.genderChip, tempGender === item.value && styles.genderChipActive]}
                >
                  <Ionicons name={item.icon} size={15} color={tempGender === item.value ? '#fff' : '#9CA3AF'} />
                  <Text style={[styles.genderChipText, tempGender === item.value && styles.genderChipTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Country Selection */}
            <Text style={styles.filterLabel}>Ülke</Text>
            <ScrollView style={styles.countryList} showsVerticalScrollIndicator>
              <TouchableOpacity style={[styles.countryItem, !tempCountry && styles.countryItemActive]} onPress={() => setTempCountry('')}>
                <Ionicons name="globe-outline" size={20} color={!tempCountry ? '#8B5CF6' : '#9CA3AF'} />
                <Text style={[styles.countryItemText, !tempCountry && styles.countryItemTextActive]}>Tüm Ülkeler</Text>
                {!tempCountry && <Ionicons name="checkmark" size={20} color="#8B5CF6" />}
              </TouchableOpacity>
              {COUNTRIES.map((c) => (
                <TouchableOpacity key={c.code} style={[styles.countryItem, tempCountry === c.name && styles.countryItemActive]} onPress={() => setTempCountry(c.name)}>
                  <View style={styles.countryIcon}><Text style={{ fontSize: 20 }}>{c.flag}</Text></View>
                  <Text style={[styles.countryItemText, tempCountry === c.name && styles.countryItemTextActive]}>{c.name}</Text>
                  {tempCountry === c.name && <Ionicons name="checkmark" size={20} color="#8B5CF6" />}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Apply Button */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.clearBtn} onPress={() => { setTempCountry(''); setTempCity(''); setTempGender(''); }}>
                <Text style={styles.clearBtnText}>Temizle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={applyFilter}>
                <Text style={styles.applyBtnText}>Uygula</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Country/City Filter Modal — Native */}
      {Platform.OS !== 'web' && (
        <Modal visible={filterVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
              <LinearGradient colors={['rgba(26,10,46,0.35)', 'rgba(16,8,28,0.10)', 'rgba(10,5,18,0.02)', 'transparent']} locations={[0, 0.38, 0.68, 1]} style={styles.modalTopGrad} pointerEvents="none" />
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Filtrele</Text>
                <TouchableOpacity onPress={() => setFilterVisible(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <Text style={styles.filterLabel}>Cinsiyet</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                {[
                  { value: '', label: 'Tümü', icon: 'people-outline' },
                  { value: 'male', label: 'Erkek', icon: 'person-outline' },
                  { value: 'female', label: 'Kadın', icon: 'person-outline' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.value || 'all'}
                    onPress={() => setTempGender(item.value)}
                    style={[styles.genderChip, tempGender === item.value && styles.genderChipActive]}
                  >
                    <Ionicons name={item.icon} size={15} color={tempGender === item.value ? '#fff' : '#9CA3AF'} />
                    <Text style={[styles.genderChipText, tempGender === item.value && styles.genderChipTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.filterLabel}>{t('discover.country') || 'Ülke'}</Text>
              <ScrollView style={styles.countryList} showsVerticalScrollIndicator>
                <TouchableOpacity style={[styles.countryItem, !tempCountry && styles.countryItemActive]} onPress={() => setTempCountry('')}>
                  <Ionicons name="globe-outline" size={20} color={!tempCountry ? '#8B5CF6' : '#9CA3AF'} />
                  <Text style={[styles.countryItemText, !tempCountry && styles.countryItemTextActive]}>Tüm Ülkeler</Text>
                  {!tempCountry && <Ionicons name="checkmark" size={20} color="#8B5CF6" />}
                </TouchableOpacity>
                {COUNTRIES.map((c) => (
                  <TouchableOpacity key={c.code} style={[styles.countryItem, tempCountry === c.name && styles.countryItemActive]} onPress={() => setTempCountry(c.name)}>
                    <Text style={{ fontSize: 20 }}>{c.flag}</Text>
                    <Text style={[styles.countryItemText, tempCountry === c.name && styles.countryItemTextActive]}>{c.name}</Text>
                    {tempCountry === c.name && <Ionicons name="checkmark" size={20} color="#8B5CF6" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.clearBtn} onPress={() => { setTempCountry(''); setTempCity(''); setTempGender(''); }}>
                  <Text style={styles.clearBtnText}>{t('common.clear') || 'Temizle'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.applyBtn} onPress={applyFilter}>
                  <Text style={styles.applyBtnText}>{t('common.apply') || 'Uygula'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}


const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
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
    position: 'absolute', top: 104, left: 0, right: 0, zIndex: 10,
    paddingHorizontal: 16, paddingTop: 4,
  },
  filterBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1F2937', borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start',
  },
  filterBadgeText: { color: '#D1D5DB', fontSize: 13, fontWeight: '500' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  webDots: {
    position: 'absolute', bottom: 20, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
    zIndex: 20,
  },
  webDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  webDotActive: {
    width: 20, height: 6, borderRadius: 3,
    backgroundColor: '#8B5CF6',
  },
  webCard: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#0A0A0B',
  },
  webCardInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 70,
    paddingBottom: 80,
  },
  userCard: {
    width: '100%',
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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(8,6,15,0.88)', justifyContent: 'flex-end' },
  modalTopGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 110, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  modalContent: {
    backgroundColor: '#08060F', borderTopLeftRadius: 32, borderTopRightRadius: 32,
    borderTopWidth: 1, borderColor: 'rgba(192,132,252,0.18)',
    paddingHorizontal: 20, paddingTop: 12, maxHeight: SCREEN_HEIGHT * 0.9,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(192,132,252,0.30)', alignSelf: 'center', marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  filterLabel: { fontSize: 14, fontWeight: '600', color: '#9CA3AF', marginBottom: 10, textTransform: 'uppercase' },
  countryList: { maxHeight: SCREEN_HEIGHT * 0.45, marginBottom: 16 },
  countryIcon: { width: 28, alignItems: 'center' },
  countryItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4,
  },
  countryItemActive: { backgroundColor: 'rgba(139,92,246,0.15)' },
  countryItemText: { color: '#D1D5DB', fontSize: 15, flex: 1 },
  countryItemTextActive: { color: '#A78BFA', fontWeight: '600' },
  citySection: { marginBottom: 16 },
  genderChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 8,
    backgroundColor: '#1F2937', borderWidth: 1, borderColor: '#374151',
  },
  genderChipActive: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  genderChipText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
  genderChipTextActive: { color: '#fff' },
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

  // Search bar — inside header row
  searchBarWrap: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    paddingHorizontal: 12, paddingVertical: 9,
  },
  searchBarInput: {
    flex: 1, fontSize: 15, color: colors.text,
  },
  searchResultsWrap: {
    flex: 1,
  },
  searchCenter: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60,
  },
  searchEmpty: {
    color: '#6B7280', fontSize: 15, textAlign: 'center', marginTop: 8,
  },
  searchUserRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  searchUserAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  searchUserInfo: { flex: 1 },
  searchUserName: { fontSize: 15, fontWeight: '600', color: colors.text },
  searchUserSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  searchFollowBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#C084FC',
  },
  searchFollowBtnActive: { backgroundColor: 'rgba(255,255,255,0.08)' },
  searchFollowBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
