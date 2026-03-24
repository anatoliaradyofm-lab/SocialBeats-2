/**
 * MusicDiscoverScreen - SoundCloud tarzı sonsuz kaydırmalı müzik keşif akışı
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, RefreshControl, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { usePlayer } from '../contexts/PlayerContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const GENRES = [
  { id: null, label: 'Tümü' },
  { id: 'pop', label: 'Pop' },
  { id: 'rock', label: 'Rock' },
  { id: 'jazz', label: 'Caz' },
  { id: 'hip hop', label: 'Hip-Hop' },
  { id: 'electronic', label: 'Elektronik' },
  { id: 'turkish pop', label: 'Türkçe Pop' },
  { id: 'classical', label: 'Klasik' },
];

function formatDuration(sec) {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function formatCount(n) {
  if (!n || n < 1000) return String(n || 0);
  if (n < 1000000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1000000).toFixed(1)}M`;
}

export default function MusicDiscoverScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { token } = useAuth();
  const { playTrack } = usePlayer();
  const [tracks, setTracks] = useState([]);
  const [genre, setGenre] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadTracks = useCallback(async (reset = false) => {
    if (!token) return;
    const p = reset ? 1 : page;
    if (!reset && loadingMore) return;
    if (!reset) setLoadingMore(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 20 });
      if (genre) params.append('genre', genre);
      const res = await api.get(`/music/discover?${params}`, token);
      const list = res?.results || [];
      if (reset) {
        setTracks(list);
        setPage(2);
      } else {
        setTracks(prev => [...prev, ...list]);
        setPage(prev => prev + 1);
      }
      setHasMore(res?.has_more ?? false);
    } catch {
      if (reset) setTracks([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [token, page, genre]);

  useEffect(() => {
    loadTracks(true);
  }, [genre]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    loadTracks(true);
  };

  const onEndReached = () => {
    if (!loadingMore && hasMore && tracks.length >= 15) {
      loadTracks(false);
    }
  };

  const toTrack = (item) => ({
    id:         item.id,
    title:      item.title || item.name,
    artist:     item.artist || item.artist_name || '',
    thumbnail:  item.thumbnail || item.cover_url,
    cover_url:  item.cover_url || item.thumbnail,
    audio_url:  item.audio_url || item.stream_url || null,
    source:     item.source || '',
    duration:   item.duration || item.duration_seconds || 0,
    view_count: item.view_count || item.viewCount || 0,
  });

  const renderTrack = ({ item, index }) => {
    const track = toTrack(item);
    return (
      <TouchableOpacity
        style={[styles.trackRow, { width: width - 32 }]}
        activeOpacity={0.7}
        onPress={() => playTrack(track)}
      >
        <View style={styles.trackNum}>
          <Text style={styles.trackNumText}>{index + 1}</Text>
        </View>
        <Image
          source={{ uri: track.thumbnail || `https://i.pravatar.cc/100?u=${track.id}` }}
          style={styles.trackThumb}
        />
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
          <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
          <View style={styles.trackMeta}>
            {track.view_count > 0 && (
              <Text style={styles.trackMetaText}>{formatCount(track.view_count)} dinlenme</Text>
            )}
            {track.duration > 0 && (
              <Text style={styles.trackMetaText}> • {formatDuration(track.duration)}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.playBtn}
          onPress={() => playTrack(track)}
        >
          <Ionicons name="play" size={24} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading && tracks.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Keşfet</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Keşfet</Text>
        <Text style={styles.subtitle}>Müziği keşfet</Text>
      </View>
      <FlatList
        data={GENRES}
        horizontal
        keyExtractor={(g) => g.id || 'all'}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.genreList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.genreChip, genre === item.id && styles.genreChipActive]}
            onPress={() => setGenre(item.id)}
          >
            <Text style={[styles.genreLabel, genre === item.id && styles.genreLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />
      <FlatList
        data={tracks}
        renderItem={renderTrack}
        keyExtractor={(item) => item.id || item.youtube_id || String(Math.random())}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#6366F1" />
            </View>
          ) : null
        }
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 120 }]}
        ListEmptyComponent={<Text style={styles.empty}>Henüz parça yok</Text>}
      />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: '#888', marginTop: 4 },
  genreList: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  genreChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.inputBg, marginRight: 8 },
  genreChipActive: { backgroundColor: '#6366F1' },
  genreLabel: { fontSize: 14, color: '#888', fontWeight: '500' },
  genreLabelActive: { color: colors.text },
  list: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  trackNum: { width: 28, alignItems: 'center', marginRight: 12 },
  trackNumText: { fontSize: 14, color: '#666', fontWeight: '600' },
  trackThumb: { width: 56, height: 56, borderRadius: 6, marginRight: 14 },
  trackInfo: { flex: 1 },
  trackTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  trackArtist: { fontSize: 14, color: '#888', marginTop: 2 },
  trackMeta: { flexDirection: 'row', marginTop: 4 },
  trackMetaText: { fontSize: 12, color: '#555' },
  playBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#6366F1', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
  empty: { color: '#888', textAlign: 'center', paddingVertical: 40 },
});
