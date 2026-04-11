/**
 * LikedScreen - Beğenilenler (Beğenilen parçalar listesi)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NativeAdSlot from '../components/ads/NativeAdSlot';
import { usePlayer } from '../contexts/PlayerContext';
import { useTheme } from '../contexts/ThemeContext';
import { getLikedTracks, toggleLike, subscribe as likedSubscribe } from '../lib/likedStore';
import { useAuth } from '../contexts/AuthContext';

function toTrack(item) {
  const cover = item.cover || item.thumbnail || item.cover_url;
  return {
    id:        item.id || item.song_id,
    title:     item.title || item.name,
    artist:    item.artist || '',
    thumbnail: cover,
    cover_url: cover,
    audio_url: item.audio_url || item.stream_url || null,
    source:    item.source || null,
  };
}


export default function LikedScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { playTrack } = usePlayer();
  const { isGuest } = useAuth();

  const [likedItems, setLikedItems] = useState(() => isGuest ? [] : getLikedTracks());
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setLikedItems(getLikedTracks());
    setRefreshing(false);
  };

  // Re-render when liked store changes (e.g. user likes/unlikes from player)
  useEffect(() => {
    if (isGuest) return;
    return likedSubscribe(() => setLikedItems(getLikedTracks()));
  }, [isGuest]);

  const removeLike = (id) => {
    const track = likedItems.find(t => String(t.id) === String(id));
    if (track) toggleLike(track);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.8}
      onPress={() => playTrack(toTrack(item))}
    >
      <Image source={{ uri: item.cover || item.thumbnail || item.cover_url }} style={styles.cover} />
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

  if (isGuest) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }]}>
        <LinearGradient colors={['#1A0A2E', '#100620', '#08060F', '#08060F']} locations={[0, 0.18, 0.32, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { position: 'absolute', top: insets.top + 8, left: 16 }]}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(225,29,72,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(225,29,72,0.3)' }}>
          <Ionicons name="heart-outline" size={32} color="#E11D48" />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#F8F8F8', marginBottom: 8 }}>Beğenilen Şarkılar</Text>
        <Text style={{ fontSize: 14, color: 'rgba(248,248,248,0.45)', textAlign: 'center', lineHeight: 20, marginBottom: 28 }}>Beğendiğin şarkıları kaydetmek için giriş yap.</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Auth')} style={{ borderRadius: 14, overflow: 'hidden' }}>
          <LinearGradient colors={['#A78BFA', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingHorizontal: 32, paddingVertical: 14 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>Giriş Yap</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t('liked.title')}</Text>
          <Text style={styles.subtitle}>{t('liked.trackCount', { count: likedItems.length })}</Text>
        </View>
      </View>
      <FlatList
        data={likedItems}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id || item.song_id)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 140 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
        }
        ListFooterComponent={<NativeAdSlot colors={colors} />}
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
