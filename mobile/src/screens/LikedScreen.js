/**
 * LikedScreen - Beğenilenler (Beğenilen parçalar listesi)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  RefreshControl, ActivityIndicator} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../contexts/PlayerContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

function toTrack(item) {
  const cover = item.cover || item.thumbnail || item.cover_url;
  return {
    id: item.id || item.song_id,
    title: item.title || item.name,
    artist: item.artist || '',
    thumbnail: cover,
    cover_url: cover,
    embed_url: item.embed_url || `https://www.youtube.com/embed/${item.id || item.song_id}`,
  };
}

function normalizeItem(item) {
  const cover = item.cover || item.thumbnail || item.cover_url;
  return {
    id: item.id || item.song_id,
    title: item.title || item.name,
    artist: item.artist || '',
    duration: item.duration,
    cover,
  };
}

export default function LikedScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { playTrack } = usePlayer();
  const { token } = useAuth();
  const [likedItems, setLikedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLiked = useCallback(async () => {
    try {
      const res = await api.get('/users/me/liked-tracks', token);
      setLikedItems(Array.isArray(res) ? res : res?.tracks || []);
    } catch {
      setLikedItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadLiked();
    } else {
      setLoading(false);
    }
  }, [loadLiked, token]);

  const onRefresh = () => {
    setRefreshing(true);
    loadLiked();
  };

  const removeLike = (id) => {
    setLikedItems((prev) => prev.filter((t) => (t.id || t.song_id) !== id));
  };

  const tracks = likedItems.map(normalizeItem);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.8}
      onPress={() => playTrack(toTrack(item))}
    >
      <Image source={{ uri: item.cover }} style={styles.cover} />
      <View style={styles.info}>
        <Text style={styles.trackTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text>
      </View>
      <Text style={styles.duration}>{item.duration || ''}</Text>
      <TouchableOpacity
        style={styles.likeBtn}
        onPress={() => removeLike(item.id)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="heart" size={24} color="#E11D48" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{t('liked.title')}</Text>
          </View>
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t('liked.title')}</Text>
          <Text style={styles.subtitle}>{t('liked.trackCount', { count: tracks.length })}</Text>
        </View>
      </View>
      <FlatList
        data={tracks}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 140 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={64} color="#555" />
            <Text style={styles.emptyText}>{t('liked.empty')}</Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a', gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn: { padding: 4 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: '#B3B3B3', marginTop: 2 },
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    gap: 12,
  },
  cover: { width: 48, height: 48, borderRadius: 8 },
  info: { flex: 1, minWidth: 0 },
  trackTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  artist: { fontSize: 12, color: '#B3B3B3', marginTop: 2 },
  duration: { fontSize: 14, color: '#7F7F7F' },
  likeBtn: { padding: 8 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#7F7F7F', marginTop: 16 },
});
