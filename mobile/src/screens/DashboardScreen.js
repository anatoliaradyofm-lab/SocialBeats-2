/**
 * DashboardScreen - SocialBeats ana sayfa
 * iPhone 13/14/15 (390x844) uyumlu
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  RefreshControl, Pressable, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { usePlayer } from '../contexts/PlayerContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useInterstitialAdContext } from '../contexts/InterstitialAdContext';
import useAdFreeStatus from '../hooks/useAdFreeStatus';
import { shouldTriggerInterstitialHome } from '../hooks/useInterstitialAd';
import NativeAd from '../components/ads/NativeAd';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { getLocale } from '../lib/localeStore';
import { cacheData, getCachedData, useNetworkStatus } from '../services/offlineService';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';

const TRACK_COVER = 48;

const DISCOVER_CATEGORIES = [
  { id: 'pop', name: 'Pop', colors: ['#ff6b6b', '#ee5a24'] },
  { id: 'hiphop', name: 'Hip-Hop', colors: ['#f093fb', '#f5576c'] },
  { id: 'edm', name: 'EDM', colors: ['#4facfe', '#00f2fe'] },
  { id: 'latin', name: 'Latin', colors: ['#43e97b', '#38f9d7'] },
  { id: 'rock', name: 'Rock', colors: ['#fa709a', '#fee140'] },
  { id: 'kpop', name: 'K-Pop', colors: ['#a8edea', '#fed6e3'] },
  { id: 'rnb', name: 'R&B', colors: ['#d299c2', '#fef9d7'] },
  { id: 'lofi', name: 'Lo-fi', colors: ['#89f7fe', '#66a6ff'] },
];

// Placeholder veriler — API'den veri gelmezse bunlar gösterilir
const PLACEHOLDER_PLAYLISTS = Array.from({ length: 8 }, (_, i) => ({
  id: `ph-pl-${i}`,
  name: ['Chill Vibes', 'Workout Mix', 'Rainy Day', 'Party Time', 'Focus Mode', 'Road Trip', 'Morning Coffee', 'Night Owl'][i],
  cover: `https://picsum.photos/seed/pl${i}/120/120`,
  track_count: [24, 18, 32, 15, 20, 28, 12, 22][i],
}));

const PLACEHOLDER_RECENT = Array.from({ length: 8 }, (_, i) => ({
  id: `ph-rc-${i}`,
  title: ['Blinding Lights', 'Levitating', 'Peaches', 'Stay', 'Kiss Me More', 'Good 4 U', 'Montero', 'Butter'][i],
  artist: ['The Weeknd', 'Dua Lipa', 'Justin Bieber', 'Kid Laroi', 'Doja Cat', 'Olivia Rodrigo', 'Lil Nas X', 'BTS'][i],
  cover: `https://picsum.photos/seed/rc${i}/80/80`,
}));

const PLACEHOLDER_POPULAR = Array.from({ length: 10 }, (_, i) => ({
  id: `ph-pop-${i}`,
  title: ['Shape of You', 'Dance Monkey', 'Rockstar', 'One Dance', 'Closer', 'Sunflower', 'Someone You Loved', 'Señorita', 'Bad Guy', 'Watermelon Sugar'][i],
  artist: ['Ed Sheeran', 'Tones and I', 'Post Malone', 'Drake', 'Chainsmokers', 'Post Malone', 'Lewis Capaldi', 'Camila Cabello', 'Billie Eilish', 'Harry Styles'][i],
  cover: `https://picsum.photos/seed/pop${i}/48/48`,
  plays: ['1.2B', '980M', '850M', '720M', '650M', '600M', '550M', '500M', '480M', '450M'][i],
  duration: ['3:53', '3:29', '3:38', '2:54', '4:04', '2:38', '3:02', '3:10', '3:14', '2:54'][i],
}));

const PLACEHOLDER_RELEASES = Array.from({ length: 8 }, (_, i) => ({
  id: `ph-nr-${i}`,
  title: ['Midnight Rain', 'Flowers', 'Anti-Hero', 'Unholy', 'As It Was', 'Heat Waves', 'About Damn Time', 'Running Up That Hill'][i],
  artist: ['Taylor Swift', 'Miley Cyrus', 'Taylor Swift', 'Sam Smith', 'Harry Styles', 'Glass Animals', 'Lizzo', 'Kate Bush'][i],
  cover: `https://picsum.photos/seed/nr${i}/100/100`,
}));

const PLACEHOLDER_STORIES = [
  {
    user_id: 'ps-1', username: 'melodikbeat', user_display_name: 'Melodi K.',
    user_avatar: 'https://i.pravatar.cc/100?u=melodikbeat', has_unviewed: true,
    stories: [
      { id: 'pst-1a', media_url: 'https://picsum.photos/seed/story1a/400/700', media_type: 'photo', text: '🎵 Yeni parça yolda!', background_color: '#8B5CF6', duration: 5 },
      { id: 'pst-1b', media_url: 'https://picsum.photos/seed/story1b/400/700', media_type: 'photo', text: 'Stüdyodan selamlar ✨', background_color: '#EC4899', duration: 5 },
    ],
  },
  {
    user_id: 'ps-2', username: 'djvibe', user_display_name: 'DJ Vibe',
    user_avatar: 'https://i.pravatar.cc/100?u=djvibe', has_unviewed: true,
    stories: [
      { id: 'pst-2a', media_url: 'https://picsum.photos/seed/story2a/400/700', media_type: 'photo', text: 'Bu gece sahne var 🔥', background_color: '#EF4444', duration: 5 },
    ],
  },
  {
    user_id: 'ps-3', username: 'synthwave_', user_display_name: 'Synthwave',
    user_avatar: 'https://i.pravatar.cc/100?u=synthwave_', has_unviewed: true,
    stories: [
      { id: 'pst-3a', media_url: 'https://picsum.photos/seed/story3a/400/700', media_type: 'photo', text: 'Retro vibes 🌅', background_color: '#F59E0B', duration: 5 },
      { id: 'pst-3b', media_url: 'https://picsum.photos/seed/story3b/400/700', media_type: 'photo', text: 'New mix dropping soon', background_color: '#06B6D4', duration: 5 },
      { id: 'pst-3c', media_url: 'https://picsum.photos/seed/story3c/400/700', media_type: 'photo', text: '80s forever 🎹', background_color: '#8B5CF6', duration: 5 },
    ],
  },
  {
    user_id: 'ps-4', username: 'lofi_girl', user_display_name: 'Lofi Girl',
    user_avatar: 'https://i.pravatar.cc/100?u=lofi_girl', has_unviewed: false,
    stories: [
      { id: 'pst-4a', media_url: 'https://picsum.photos/seed/story4a/400/700', media_type: 'photo', text: 'chill beats to study 📚', background_color: '#10B981', duration: 5 },
    ],
  },
  {
    user_id: 'ps-5', username: 'beatmaker99', user_display_name: 'BeatMaker',
    user_avatar: 'https://i.pravatar.cc/100?u=beatmaker99', has_unviewed: true,
    stories: [
      { id: 'pst-5a', media_url: 'https://picsum.photos/seed/story5a/400/700', media_type: 'photo', text: 'FL Studio session 🎛️', background_color: '#7C3AED', duration: 5 },
    ],
  },
  {
    user_id: 'ps-6', username: 'popstar_tr', user_display_name: 'PopStar',
    user_avatar: 'https://i.pravatar.cc/100?u=popstar_tr', has_unviewed: true,
    stories: [
      { id: 'pst-6a', media_url: 'https://picsum.photos/seed/story6a/400/700', media_type: 'photo', text: 'Konser hazırlıkları 🎤', background_color: '#EC4899', duration: 5 },
      { id: 'pst-6b', media_url: 'https://picsum.photos/seed/story6b/400/700', media_type: 'photo', text: 'Sahne arkası 👀', background_color: '#F43F5E', duration: 5 },
    ],
  },
  {
    user_id: 'ps-7', username: 'indie_waves', user_display_name: 'Indie Waves',
    user_avatar: 'https://i.pravatar.cc/100?u=indie_waves', has_unviewed: false,
    stories: [
      { id: 'pst-7a', media_url: 'https://picsum.photos/seed/story7a/400/700', media_type: 'photo', text: 'New album artwork reveal', background_color: '#059669', duration: 5 },
    ],
  },
  {
    user_id: 'ps-8', username: 'rapzone', user_display_name: 'Rap Zone',
    user_avatar: 'https://i.pravatar.cc/100?u=rapzone', has_unviewed: true,
    stories: [
      { id: 'pst-8a', media_url: 'https://picsum.photos/seed/story8a/400/700', media_type: 'photo', text: 'Freestyle Friday 🎤🔥', background_color: '#DC2626', duration: 5 },
    ],
  },
];

function toTrack(item) {
  return {
    id: item.id || item.song_id || item.videoId,
    title: item.title || item.name,
    artist: item.artist || item.channel || '',
    thumbnail: item.cover || item.cover_url || item.thumbnail,
    cover_url: item.cover || item.cover_url || item.thumbnail,
    audio_url: item.audio_url,
    embed_url: item.embed_url || `https://www.youtube.com/embed/${item.id || item.videoId}`,
    youtube_url: item.youtube_url,
  };
}

const ROW_HEIGHT = 60;

export default function DashboardScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user, token } = useAuth();
  const { playTrack } = usePlayer();
  const { unreadCount } = useNotifications();
  const { trigger: triggerInterstitial } = useInterstitialAdContext();
  const { isAdFree } = useAdFreeStatus();
  const lastTriggeredRef = useRef(0);
  const [refreshing, setRefreshing] = useState(false);

  const [playlists, setPlaylists] = useState([]);
  const [recentTracks, setRecentTracks] = useState([]);
  const [popularTracks, setPopularTracks] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popularLiked, setPopularLiked] = useState({});

  const fetchDashboardData = useCallback(async () => {
    try {
      const { countryCode } = getLocale();
      const [homeData, trendingData, storiesData] = await Promise.allSettled([
        api.get(`/discover/home?country=${countryCode || 'US'}`, token),
        api.get(`/songs/trending`, token),
        api.get('/stories/feed', token)
      ]);

      if (homeData.status === 'fulfilled' && homeData.value) {
        const data = homeData.value;
        setPlaylists(data.playlists || data.for_you || []);
        setRecentTracks(data.recent || data.recently_played || []);
        setNewReleases(data.new_releases || data.new || []);
        cacheData('dashboard:home', data).catch(() => { });
      }

      if (trendingData.status === 'fulfilled' && trendingData.value) {
        const tracks = trendingData.value.tracks || trendingData.value.items || trendingData.value || [];
        const trackList = Array.isArray(tracks) ? tracks : [];
        setPopularTracks(trackList);
        setPopularLiked(trackList.reduce((acc, t, i) => ({ ...acc, [t.id || i]: false }), {}));
        cacheData('dashboard:trending', trackList).catch(() => { });
      }

      if (storiesData.status === 'fulfilled' && storiesData.value) {
        const feed = Array.isArray(storiesData.value) ? storiesData.value : [];
        setStories(feed);
        cacheData('dashboard:stories', feed).catch(() => { });
      }
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
      const cachedHome = await getCachedData('dashboard:home');
      if (cachedHome) {
        setPlaylists(cachedHome.playlists || cachedHome.for_you || []);
        setRecentTracks(cachedHome.recent || cachedHome.recently_played || []);
        setNewReleases(cachedHome.new_releases || cachedHome.new || []);
      }
      const cachedTrending = await getCachedData('dashboard:trending');
      if (cachedTrending) {
        const trackList = Array.isArray(cachedTrending) ? cachedTrending : [];
        setPopularTracks(trackList);
        setPopularLiked(trackList.reduce((acc, t, i) => ({ ...acc, [t.id || i]: false }), {}));
      }
      const cachedStories = await getCachedData('dashboard:stories');
      if (cachedStories) {
        setStories(Array.isArray(cachedStories) ? cachedStories : []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  }, [fetchDashboardData]);

  const avatar = user?.avatar_url || `https://i.pravatar.cc/100?u=${user?.username || 'user'}`;

  const togglePopularLike = (id) => {
    setPopularLiked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const contentBottom = 70 + 60 + insets.bottom + 24;

  const popularWithAds = popularTracks.reduce((acc, t, i) => {
    acc.push({ type: 'track', ...t, origIndex: i });
    if ((i + 1) % 5 === 0) acc.push({ type: 'ad', id: `ad-pop-${i}`, adIndex: Math.floor((i + 1) / 5) - 1 });
    return acc;
  }, []);

  const handleScroll = useCallback(
    (e) => {
      if (isAdFree) return;
      const y = e.nativeEvent?.contentOffset?.y ?? 0;
      const songScrollCount = Math.floor(y / ROW_HEIGHT);
      if (shouldTriggerInterstitialHome(songScrollCount) && songScrollCount > lastTriggeredRef.current) {
        lastTriggeredRef.current = songScrollCount;
        triggerInterstitial();
      }
    },
    [isAdFree, triggerInterstitial]
  );

  const handlePlayPopularTrack = (track, index) => {
    const allTracks = popularTracks.map(toTrack);
    playTrack(toTrack(track), allTracks);
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={{ color: '#B3B3B3', marginTop: 12 }}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ÜST BÖLÜM */}
      <View style={styles.topBar}>
        <Text style={styles.logo}>SocialBeats</Text>
        <View style={styles.topActions}>
          <TouchableOpacity
            style={styles.iconWrap}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={24} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconWrap}
            onPress={() => navigation.getParent()?.navigate('Conversations')}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            <Image source={{ uri: avatar }} style={styles.profilePhoto} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={styles.searchBar}
        onPress={() => navigation.navigate('Search')}
        activeOpacity={0.8}
      >
        <Ionicons name="search" size={20} color="#7F7F7F" />
        <Text style={styles.searchPlaceholder}>{t('dashboard.searchPlaceholder')}</Text>
      </TouchableOpacity>

      {/* INSTAGRAM STİLİ HİKAYELER */}
      <View style={styles.storiesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesScroll}
        >
          {/* Senin Hikayen (+ butonu) */}
          <TouchableOpacity
            style={styles.storyItem}
            activeOpacity={0.8}
            onPress={() => navigation.getParent()?.navigate('StoryCreate')}
          >
            <View style={styles.storyAvatarWrap}>
              <Image source={{ uri: avatar }} style={styles.storyAvatar} />
              <View style={styles.storyAddBadge}>
                <Ionicons name="add" size={14} color="#fff" />
              </View>
            </View>
            <Text style={styles.storyUsername} numberOfLines={1}>{t('dashboard.yourStory') || 'Hikayen'}</Text>
          </TouchableOpacity>

          {/* Diğer Kullanıcıların Hikayeleri */}
          {(stories.length > 0 ? stories : PLACEHOLDER_STORIES).map((item, index) => {
            const hasUnviewed = item.has_unviewed;
            const storyAvatar = item.user_avatar || `https://i.pravatar.cc/100?u=${item.username}`;
            const storyFeed = stories.length > 0 ? stories : PLACEHOLDER_STORIES;
            return (
              <TouchableOpacity
                key={item.user_id || index}
                style={styles.storyItem}
                activeOpacity={0.8}
                onPress={() => navigation.getParent()?.navigate('StoryViewer', { feed: storyFeed, startUserIndex: index })}
              >
                {hasUnviewed ? (
                  <LinearGradient
                    colors={['#8B5CF6', '#F43F5E', '#F59E0B']}
                    style={styles.storyRingGradient}
                  >
                    <View style={styles.storyRingInner}>
                      <Image source={{ uri: storyAvatar }} style={styles.storyAvatar} />
                    </View>
                  </LinearGradient>
                ) : (
                  <View style={styles.storyRingViewed}>
                    <Image source={{ uri: storyAvatar }} style={styles.storyAvatar} />
                  </View>
                )}
                <Text style={styles.storyUsername} numberOfLines={1}>{item.username}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottom }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={400}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366F1"
          />
        }
      >
        {/* SANA ÖZEL ÇALMA LİSTELERİ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dashboard.personalPlaylists')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hScroll}
          >
            {(playlists.length > 0 ? playlists : PLACEHOLDER_PLAYLISTS).map((pl, idx) => (
              <TouchableOpacity
                key={pl.id || idx}
                style={styles.playlistCard}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('PlaylistDetail', { playlistId: pl.id, name: pl.name || pl.title })}
              >
                <Image source={{ uri: pl.cover || pl.cover_url || pl.thumbnail || pl.image }} style={styles.coverSquare} />
                <Text style={styles.cardTitle} numberOfLines={2}>{pl.name || pl.title}</Text>
                <Text style={styles.cardMeta}>{pl.count || pl.track_count || ''} {t('dashboard.tracks')}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* SON DİNLEDİKLERİN */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dashboard.recentlyPlayed')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hScroll}
          >
            {(recentTracks.length > 0 ? recentTracks : PLACEHOLDER_RECENT).map((item, idx) => (
              <TouchableOpacity
                key={item.id || idx}
                style={styles.recentCard}
                activeOpacity={0.8}
                onPress={() => playTrack(toTrack(item))}
              >
                <Image source={{ uri: item.cover || item.cover_url || item.thumbnail }} style={styles.artistCircle} />
                <Text style={styles.recentTitle} numberOfLines={1}>{item.title || item.name}</Text>
                <Text style={styles.recentArtist} numberOfLines={1}>{item.artist || item.channel}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* KİŞİ KEŞFET */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { paddingHorizontal: 0, marginBottom: 0 }]}>{t('discover.suggestedUsers') || 'Discover People'}</Text>
            <TouchableOpacity
              onPress={() => navigation.getParent()?.navigate('DiscoverPeople')}
              activeOpacity={0.7}
            >
              <Text style={styles.seeAll}>{t('common.seeAll') || 'See All'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.discoverPeopleBanner}
            onPress={() => navigation.getParent()?.navigate('DiscoverPeople')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.discoverGradient}
            >
              <View style={styles.discoverContent}>
                <View style={styles.discoverTextCol}>
                  <Text style={styles.discoverTitle}>{t('discover.findPeople') || 'Find new people'}</Text>
                  <Text style={styles.discoverSubtitle}>
                    {t('discover.swipeToDiscover') || 'Swipe through profiles from around the world'}
                  </Text>
                </View>
                <View style={styles.discoverAvatars}>
                  <View style={[styles.discoverAvatarRing, { zIndex: 3 }]}>
                    <Ionicons name="person" size={20} color="#E9D5FF" />
                  </View>
                  <View style={[styles.discoverAvatarRing, { marginLeft: -12, zIndex: 2 }]}>
                    <Ionicons name="person" size={20} color="#C4B5FD" />
                  </View>
                  <View style={[styles.discoverAvatarRing, { marginLeft: -12, zIndex: 1 }]}>
                    <Ionicons name="person" size={20} color="#A78BFA" />
                  </View>
                </View>
              </View>
              <View style={styles.discoverArrow}>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* POPÜLER PARÇALAR */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dashboard.popularTracks')}</Text>
          {(() => {
            const tracks = popularTracks.length > 0 ? popularWithAds : PLACEHOLDER_POPULAR.map((t, i) => ({ type: 'track', ...t, origIndex: i }));
            return tracks.map((item, i) => {
              if (item.type === 'ad') {
                return <NativeAd key={item.id} placement="feed" adIndex={item.adIndex} />;
              }
              const track = item;
              const trackId = track.id || track.song_id || i;
              return (
                <Pressable
                  key={trackId}
                  style={({ pressed }) => [
                    styles.trackRow,
                    pressed && styles.trackRowPressed,
                  ]}
                  onPress={() => handlePlayPopularTrack(track, track.origIndex)}
                  onLongPress={() => Alert.alert(track.title || track.name, t('dashboard.options'), [
                    { text: t('dashboard.addToPlaylist'), onPress: () => { } },
                    { text: t('dashboard.share'), onPress: () => { } },
                    { text: t('common.cancel'), style: 'cancel' },
                  ])}
                >
                  <Text style={styles.trackNum}>{track.origIndex + 1}</Text>
                  <Image source={{ uri: track.cover || track.cover_url || track.thumbnail }} style={styles.trackCover} />
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle} numberOfLines={1}>{track.title || track.name}</Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>{track.artist || track.channel}</Text>
                  </View>
                  <Text style={styles.trackPlays}>{track.plays || track.play_count || ''}</Text>
                  <Text style={styles.trackDuration}>{track.duration || ''}</Text>
                  <TouchableOpacity
                    style={styles.likeBtn}
                    onPress={() => togglePopularLike(trackId)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons
                      name={popularLiked[trackId] ? 'heart' : 'heart-outline'}
                      size={22}
                      color={popularLiked[trackId] ? '#E11D48' : '#B3B3B3'}
                    />
                  </TouchableOpacity>
                </Pressable>
              );
            });
          })()}
          {/* Sonsuz kaydırma placeholder */}
          <View style={styles.loadMoreRow}>
            <ActivityIndicator size="small" color="#6366F1" />
            <Text style={styles.loadMoreText}>{t('common.loading') || 'Yükleniyor...'}</Text>
          </View>
        </View>

        {/* KEŞFET */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dashboard.discover')}</Text>
          <View style={styles.grid}>
            {DISCOVER_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={styles.gridCard}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('Search', { category: cat.id })}
              >
                <LinearGradient
                  colors={cat.colors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gridCardGradient}
                >
                  <Text style={styles.gridTitle}>{cat.name}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* YENİ ÇIKANLAR */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dashboard.newReleases')}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hScroll}
          >
            {(newReleases.length > 0 ? newReleases : PLACEHOLDER_RELEASES).map((item, idx) => (
              <TouchableOpacity
                key={item.id || idx}
                style={styles.albumCard}
                activeOpacity={0.8}
                onPress={() => playTrack(toTrack(item))}
              >
                <Image source={{ uri: item.cover || item.cover_url || item.thumbnail || item.image }} style={styles.albumCover} />
                <Text style={styles.albumTitle} numberOfLines={1}>{item.title || item.name}</Text>
                <Text style={styles.albumArtist} numberOfLines={1}>{item.artist || item.channel}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Empty state */}
        {playlists.length === 0 && recentTracks.length === 0 && popularTracks.length === 0 && newReleases.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="musical-notes-outline" size={48} color="#4B5563" />
            <Text style={styles.emptyText}>{t('dashboard.noContent')}</Text>
            <Text style={styles.emptySubtext}>{t('dashboard.noContentSub')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logo: { fontSize: 18, fontWeight: '700', color: colors.text },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconWrap: { padding: 4, position: 'relative' },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF3366',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  profilePhoto: { width: 32, height: 32, borderRadius: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.inputBg,
    borderRadius: 8,
  },
  searchPlaceholder: { fontSize: 14, color: '#7F7F7F' },
  storiesContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  storiesScroll: {
    paddingHorizontal: 16,
    gap: 16,
  },
  storyItem: {
    alignItems: 'center',
    width: 72,
  },
  storyAvatarWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    marginBottom: 6,
    position: 'relative',
  },
  storyAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 34,
  },
  storyAddBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#8B5CF6',
    borderWidth: 2,
    borderColor: '#0E0E0E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyRingGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 3,
    marginBottom: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyRingInner: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#0E0E0E',
    overflow: 'hidden',
  },
  storyRingViewed: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyUsername: {
    fontSize: 11,
    color: '#E5E7EB',
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  hScroll: { paddingHorizontal: 16 },
  playlistCard: { width: 120, marginRight: 12 },
  coverSquare: { width: 120, height: 120, borderRadius: 8 },
  cardTitle: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 8 },
  cardMeta: { fontSize: 12, color: '#B3B3B3', marginTop: 4 },
  recentCard: { width: 80, alignItems: 'center', marginRight: 12 },
  artistCircle: { width: 80, height: 80, borderRadius: 40 },
  recentTitle: { fontSize: 12, fontWeight: '500', color: colors.text, marginTop: 6 },
  recentArtist: { fontSize: 11, color: '#B3B3B3', marginTop: 2 },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  trackRowPressed: { backgroundColor: 'rgba(99,102,241,0.15)', opacity: 0.9 },
  trackNum: { fontSize: 14, color: '#7F7F7F', width: 24 },
  trackCover: { width: TRACK_COVER, height: TRACK_COVER, borderRadius: 4 },
  trackInfo: { flex: 1, minWidth: 0 },
  trackTitle: { fontSize: 14, fontWeight: '500', color: colors.text },
  trackArtist: { fontSize: 12, color: '#B3B3B3', marginTop: 2 },
  trackPlays: { fontSize: 12, color: '#7F7F7F' },
  trackDuration: { fontSize: 12, color: '#7F7F7F' },
  likeBtn: { padding: 8 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  gridCard: {
    width: '47%',
    aspectRatio: 1.5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gridCardGradient: {
    flex: 1,
    borderRadius: 12,
    justifyContent: 'flex-end',
    padding: 16,
  },
  gridTitle: { fontSize: 16, fontWeight: '700', color: colors.text, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  loadMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadMoreText: { fontSize: 13, color: '#7F7F7F' },
  albumCard: { width: 100, alignItems: 'center', marginRight: 12 },
  albumCover: { width: 100, height: 100, borderRadius: 8 },
  albumTitle: { fontSize: 12, fontWeight: '600', color: colors.text, marginTop: 8 },
  albumArtist: { fontSize: 11, color: '#B3B3B3', marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 12,
  },
  seeAll: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  discoverPeopleBanner: {
    marginHorizontal: 16, borderRadius: 16, overflow: 'hidden',
  },
  discoverGradient: {
    padding: 18, borderRadius: 16,
  },
  discoverContent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  discoverTextCol: { flex: 1, marginRight: 12 },
  discoverTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 4 },
  discoverSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 18 },
  discoverAvatars: { flexDirection: 'row', alignItems: 'center' },
  discoverAvatarRing: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  discoverArrow: {
    alignSelf: 'flex-end', marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16,
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 4,
  },
});
