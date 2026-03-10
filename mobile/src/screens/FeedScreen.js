/**
 * FeedScreen - SoundCloud tarzı müzik akışı
 * Dikey kaydırmalı parça kartları, dalga formu, sosyal etkileşim
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  Dimensions, ActivityIndicator, RefreshControl, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../contexts/PlayerContext';
import { useAuth } from '../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { getLocale } from '../lib/localeStore';
import { cacheData, getCachedData } from '../services/offlineService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ARTWORK_SIZE = SCREEN_WIDTH - 32;

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

// Sahte dalga formu oluştur
const generateWaveform = (count = 60) =>
  Array.from({ length: count }, () => 0.15 + Math.random() * 0.85);

// Placeholder veriler
const PLACEHOLDER_TRACKS = [
  { id: 'sc-1', title: 'Blinding Lights', artist: 'The Weeknd', cover: 'https://picsum.photos/seed/sc1/400/400', duration: '3:20', plays: '3.4B', likes: '18.2M', comments: 4521, reposted_by: null, genre: 'Pop', time_ago: '2 saat önce' },
  { id: 'sc-2', title: 'Levitating', artist: 'Dua Lipa', cover: 'https://picsum.photos/seed/sc2/400/400', duration: '3:23', plays: '1.8B', likes: '12.4M', comments: 3200, reposted_by: 'DJ Khalid', genre: 'Dance Pop', time_ago: '4 saat önce' },
  { id: 'sc-3', title: 'Save Your Tears', artist: 'The Weeknd', cover: 'https://picsum.photos/seed/sc3/400/400', duration: '3:35', plays: '2.1B', likes: '15.1M', comments: 2890, reposted_by: null, genre: 'Synth-pop', time_ago: '5 saat önce' },
  { id: 'sc-4', title: 'Peaches', artist: 'Justin Bieber', cover: 'https://picsum.photos/seed/sc4/400/400', duration: '3:18', plays: '1.5B', likes: '9.8M', comments: 1800, reposted_by: 'Music Daily', genre: 'R&B', time_ago: '6 saat önce' },
  { id: 'sc-5', title: 'Montero (Call Me By Your Name)', artist: 'Lil Nas X', cover: 'https://picsum.photos/seed/sc5/400/400', duration: '2:17', plays: '1.2B', likes: '8.5M', comments: 5600, reposted_by: null, genre: 'Hip-Hop', time_ago: '8 saat önce' },
  { id: 'sc-6', title: 'Stay', artist: 'Kid Laroi & Justin Bieber', cover: 'https://picsum.photos/seed/sc6/400/400', duration: '2:21', plays: '2.8B', likes: '20.1M', comments: 7200, reposted_by: 'Pop Hits', genre: 'Pop', time_ago: '10 saat önce' },
  { id: 'sc-7', title: 'Kiss Me More', artist: 'Doja Cat ft. SZA', cover: 'https://picsum.photos/seed/sc7/400/400', duration: '3:28', plays: '1.6B', likes: '11.2M', comments: 3400, reposted_by: null, genre: 'Pop Rap', time_ago: '12 saat önce' },
  { id: 'sc-8', title: 'Good 4 U', artist: 'Olivia Rodrigo', cover: 'https://picsum.photos/seed/sc8/400/400', duration: '2:58', plays: '1.9B', likes: '14.3M', comments: 4100, reposted_by: 'Alt Nation', genre: 'Pop Punk', time_ago: '1 gün önce' },
  { id: 'sc-9', title: 'Heat Waves', artist: 'Glass Animals', cover: 'https://picsum.photos/seed/sc9/400/400', duration: '3:58', plays: '2.3B', likes: '16.7M', comments: 5800, reposted_by: null, genre: 'Indie', time_ago: '1 gün önce' },
  { id: 'sc-10', title: 'As It Was', artist: 'Harry Styles', cover: 'https://picsum.photos/seed/sc10/400/400', duration: '2:47', plays: '2.6B', likes: '19.4M', comments: 6300, reposted_by: 'Pop Radar', genre: 'Pop', time_ago: '2 gün önce' },
  { id: 'sc-11', title: 'Anti-Hero', artist: 'Taylor Swift', cover: 'https://picsum.photos/seed/sc11/400/400', duration: '3:20', plays: '1.4B', likes: '10.2M', comments: 3900, reposted_by: null, genre: 'Pop', time_ago: '2 gün önce' },
  { id: 'sc-12', title: 'Unholy', artist: 'Sam Smith & Kim Petras', cover: 'https://picsum.photos/seed/sc12/400/400', duration: '2:36', plays: '1.1B', likes: '7.8M', comments: 2100, reposted_by: 'Dance Hits', genre: 'Dance', time_ago: '3 gün önce' },
  { id: 'sc-13', title: 'Flowers', artist: 'Miley Cyrus', cover: 'https://picsum.photos/seed/sc13/400/400', duration: '3:20', plays: '2.5B', likes: '21.5M', comments: 8900, reposted_by: null, genre: 'Pop', time_ago: '3 gün önce' },
  { id: 'sc-14', title: 'Cruel Summer', artist: 'Taylor Swift', cover: 'https://picsum.photos/seed/sc14/400/400', duration: '2:58', plays: '1.7B', likes: '13.6M', comments: 4700, reposted_by: 'Top Charts', genre: 'Pop', time_ago: '4 gün önce' },
  { id: 'sc-15', title: 'Paint The Town Red', artist: 'Doja Cat', cover: 'https://picsum.photos/seed/sc15/400/400', duration: '3:51', plays: '980M', likes: '6.2M', comments: 1900, reposted_by: null, genre: 'Hip-Hop', time_ago: '5 gün önce' },
];

// Dalga formu bileşeni
const WaveformBar = React.memo(({ waveform, progress, color = '#FF5500', bgColor = 'rgba(255,255,255,0.15)' }) => {
  return (
    <View style={waveStyles.container}>
      {waveform.map((h, i) => {
        const filled = progress > (i / waveform.length);
        return (
          <View
            key={i}
            style={[
              waveStyles.bar,
              {
                height: h * 32,
                backgroundColor: filled ? color : bgColor,
              },
            ]}
          />
        );
      })}
    </View>
  );
});

const waveStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 36,
    gap: 1.5,
    flex: 1,
  },
  bar: {
    flex: 1,
    borderRadius: 1,
    minHeight: 3,
  },
});

// Skeleton loading kartı
const SkeletonCard = React.memo(() => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.artistRow}>
          <Animated.View style={[styles.artistAvatar, { opacity: pulseAnim, backgroundColor: '#333' }]} />
          <View style={styles.artistInfo}>
            <Animated.View style={{ opacity: pulseAnim, backgroundColor: '#333', height: 14, width: 100, borderRadius: 4 }} />
            <Animated.View style={{ opacity: pulseAnim, backgroundColor: '#2a2a2a', height: 11, width: 60, borderRadius: 4, marginTop: 4 }} />
          </View>
        </View>
      </View>
      <Animated.View style={[styles.artworkContainer, { opacity: pulseAnim, backgroundColor: '#222' }]} />
      <View style={styles.waveformRow}>
        <Animated.View style={{ opacity: pulseAnim, backgroundColor: '#222', height: 36, borderRadius: 4, flex: 1 }} />
      </View>
      <View style={styles.socialRow}>
        {[1, 2, 3, 4, 5].map(i => (
          <Animated.View key={i} style={{ opacity: pulseAnim, backgroundColor: '#222', height: 20, width: 40, borderRadius: 10 }} />
        ))}
      </View>
    </View>
  );
});

// Parça kartı
const TrackCard = React.memo(({ item, index, onPlay, onLike, isLiked, isCurrentTrack, isPlaying, navigation }) => {
  const { t } = useTranslation();
  const cover = item.cover || item.cover_url || item.thumbnail;
  const waveform = useRef(generateWaveform()).current;
  const playingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isCurrentTrack && isPlaying) {
      const anim = Animated.loop(
        Animated.timing(playingAnim, { toValue: 1, duration: 30000, useNativeDriver: false })
      );
      anim.start();
      return () => anim.stop();
    }
  }, [isCurrentTrack, isPlaying]);

  const progress = isCurrentTrack
    ? (isPlaying ? playingAnim.__getValue() : playingAnim.__getValue())
    : 0;

  const formatCount = (val) => {
    if (!val) return '0';
    if (typeof val === 'string') return val;
    if (val >= 1e9) return (val / 1e9).toFixed(1) + 'B';
    if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M';
    if (val >= 1e3) return (val / 1e3).toFixed(1) + 'K';
    return String(val);
  };

  return (
    <View style={styles.card}>
      {/* Repost bilgisi */}
      {item.reposted_by && (
        <View style={styles.repostRow}>
          <Ionicons name="repeat-outline" size={14} color="#999" />
          <Text style={styles.repostText}>{item.reposted_by} reposted</Text>
        </View>
      )}

      {/* Üst: Sanatçı bilgisi + zaman */}
      <View style={styles.cardHeader}>
        <TouchableOpacity
          style={styles.artistRow}
          onPress={() => navigation.navigate('UserProfile', { username: item.artist })}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: `https://i.pravatar.cc/40?u=${item.artist || index}` }}
            style={styles.artistAvatar}
          />
          <View style={styles.artistInfo}>
            <Text style={styles.artistName} numberOfLines={1}>{item.artist || item.channel}</Text>
            <Text style={styles.timeAgo}>{item.time_ago || ''}</Text>
          </View>
        </TouchableOpacity>
        {item.genre && (
          <View style={styles.genreBadge}>
            <Text style={styles.genreText}>#{item.genre}</Text>
          </View>
        )}
      </View>

      {/* Büyük artwork */}
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => onPlay(item)}
        style={styles.artworkContainer}
      >
        <Image source={{ uri: cover }} style={styles.artwork} />

        {/* Play overlay */}
        <View style={styles.playOverlay}>
          <View style={[styles.playBtn, isCurrentTrack && isPlaying && styles.playBtnPlaying]}>
            <Ionicons
              name={isCurrentTrack && isPlaying ? 'pause' : 'play'}
              size={28}
              color="#fff"
              style={!(isCurrentTrack && isPlaying) ? { marginLeft: 3 } : {}}
            />
          </View>
        </View>

        {/* Süre badge */}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{item.duration || ''}</Text>
        </View>

        {/* Şarkı başlığı overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.titleOverlay}
        >
          <Text style={styles.trackTitle} numberOfLines={2}>{item.title || item.name}</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Dalga formu */}
      <View style={styles.waveformRow}>
        <WaveformBar
          waveform={waveform}
          progress={progress}
          color="#FF5500"
        />
      </View>

      {/* Alt: 5 kontrol butonu - Önceki / Oynat-Duraklat / Tekrarla / Beğeni(daire) / Menü */}
      <View style={styles.socialRow}>
        <TouchableOpacity style={styles.socialBtn} activeOpacity={0.7}
          onPress={() => onPlay(item)}
        >
          <Ionicons name="play-skip-back" size={18} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.socialBtn}
          onPress={() => onPlay(item)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isCurrentTrack && isPlaying ? 'pause-circle' : 'play-circle'}
            size={28}
            color={isCurrentTrack && isPlaying ? '#FF5500' : '#999'}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.socialBtn} activeOpacity={0.7}>
          <Ionicons name="repeat" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.socialBtn}
          onPress={() => onLike(item.id || index)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isLiked ? 'ellipse' : 'ellipse-outline'}
            size={20}
            color={isLiked ? '#FF5500' : '#999'}
          />
          <Text style={[styles.socialText, isLiked && styles.socialTextActive]}>
            {formatCount(item.likes || item.likes_count)}
          </Text>
        </TouchableOpacity>

        <View style={styles.socialSpacer} />

        {/* Dinlenme sayısı */}
        <View style={styles.playsContainer}>
          <Ionicons name="play" size={12} color="#666" />
          <Text style={styles.playsText}>{formatCount(item.plays || item.play_count)}</Text>
        </View>

        <TouchableOpacity style={styles.socialBtn} activeOpacity={0.7}>
          <Ionicons name="ellipsis-vertical" size={20} color="#999" />
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default function FeedScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { token } = useAuth();

  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liked, setLiked] = useState({});
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchTracks = useCallback(async (pageNum = 1, append = false) => {
    try {
      const { countryCode } = getLocale();
      const result = await api.get(`/songs/trending?country=${countryCode || 'US'}&page=${pageNum}&limit=10`);
      const list = result?.tracks || result?.items || result || [];
      if (Array.isArray(list) && list.length > 0) {
        if (append) {
          setTracks(prev => [...prev, ...list]);
        } else {
          setTracks(list);
        }
        setHasMore(list.length >= 10);
        cacheData('feed:tracks', append ? [...tracks, ...list] : list).catch(() => { });
      } else if (!append) {
        setTracks(PLACEHOLDER_TRACKS);
        setHasMore(false);
      } else {
        setHasMore(false);
      }
    } catch {
      if (!append) {
        const cached = await getCachedData('feed:tracks');
        if (cached && Array.isArray(cached) && cached.length > 0) {
          setTracks(cached);
        } else {
          setTracks(PLACEHOLDER_TRACKS);
        }
      }
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [tracks]);

  useEffect(() => { fetchTracks(); }, [fetchTracks]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    await fetchTracks(1, false);
    setRefreshing(false);
  }, [fetchTracks]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    fetchTracks(nextPage, true);
  }, [page, loadingMore, hasMore, fetchTracks]);

  const handlePlay = useCallback((track) => {
    const normalized = toTrack(track);
    const isCurrentTrack = currentTrack?.id === normalized.id;
    if (isCurrentTrack) {
      togglePlay();
    } else {
      playTrack(normalized, tracks.map(toTrack));
    }
  }, [currentTrack, togglePlay, playTrack, tracks]);

  const toggleLike = useCallback((id) => {
    setLiked(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const renderItem = useCallback(({ item, index }) => {
    const normalizedTrack = toTrack(item);
    const isCurrent = currentTrack?.id === normalizedTrack.id;

    return (
      <TrackCard
        item={item}
        index={index}
        onPlay={handlePlay}
        onLike={toggleLike}
        isLiked={!!liked[item.id || index]}
        isCurrentTrack={isCurrent}
        isPlaying={isPlaying}
        navigation={navigation}
      />
    );
  }, [currentTrack, isPlaying, liked, handlePlay, toggleLike, navigation]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Stream</Text>
        </View>
        <FlatList
          data={[1, 2, 3]}
          renderItem={() => <SkeletonCard />}
          keyExtractor={(item) => `skeleton-${item}`}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* SoundCloud-style header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Stream</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('Search')}
            activeOpacity={0.7}
          >
            <Ionicons name="search-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab seçici */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, styles.tabActive]}>
          <Text style={[styles.tabText, styles.tabTextActive]}>{t('feed.discoverMusic') || 'Keşfet'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text style={styles.tabText}>{t('dashboard.popularTracks') || 'Popüler'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tab}>
          <Text style={styles.tabText}>{t('dashboard.newReleases') || 'Yeni'}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={tracks}
        renderItem={renderItem}
        keyExtractor={(item, index) => item.id || `feed-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF5500"
            colors={['#FF5500']}
          />
        }
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews={true}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#FF5500" />
          </View>
        ) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tablar
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
  },
  tabActive: {
    backgroundColor: '#FF5500',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
  },
  tabTextActive: {
    color: '#fff',
  },

  // Liste
  list: {
    paddingTop: 8,
  },
  loadingArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#999',
    marginTop: 12,
    fontSize: 14,
  },

  // Kart
  card: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Repost
  repostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 2,
  },
  repostText: {
    fontSize: 12,
    color: '#999',
  },

  // Kart header
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  artistAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#333',
  },
  artistInfo: {
    flex: 1,
  },
  artistName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  timeAgo: {
    fontSize: 11,
    color: '#666',
    marginTop: 1,
  },
  genreBadge: {
    backgroundColor: 'rgba(255,85,0,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  genreText: {
    fontSize: 11,
    color: '#FF5500',
    fontWeight: '600',
  },

  // Artwork
  artworkContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  artwork: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  playBtnPlaying: {
    backgroundColor: 'rgba(255,85,0,0.7)',
    borderColor: '#FF5500',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 50,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  durationText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  titleOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingTop: 30,
    paddingBottom: 10,
  },
  trackTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Dalga formu
  waveformRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  // Sosyal aksiyonlar
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 16,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  socialText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  socialTextActive: {
    color: '#FF5500',
  },
  socialSpacer: {
    flex: 1,
  },
  playsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  playsText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
});
