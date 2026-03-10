/**
 * ReelsScreen - Instagram Reels tarzı dikey tam ekran video/foto akışı
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  Dimensions, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
let Video;
try {
  Video = require('expo-av').Video;
} catch {
  Video = null;
}
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import NativeAd from '../components/ads/NativeAd';
import { useTheme } from '../contexts/ThemeContext';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

function isVideoUrl(url) {
  if (!url) return false;
  const u = url.toLowerCase();
  return u.includes('.mp4') || u.includes('.webm') || u.includes('video') || u.includes('youtube') || u.includes('vimeo');
}

export default function ReelsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [reels, setReels] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const flatListRef = useRef(null);

  const reelsWithAds = React.useMemo(() => {
    const out = [];
    reels.forEach((r, i) => {
      if (i > 0 && i % 5 === 0) out.push({ type: 'ad', id: `ad-${i}`, adIndex: Math.floor(i / 5) - 1 });
      out.push({ type: 'reel', ...r });
    });
    return out;
  }, [reels]);

  const loadReels = useCallback(async (reset = false) => {
    if (!token) return;
    const p = reset ? 1 : page;
    if (!reset && loadingMore) return;
    if (!reset) setLoadingMore(true);
    else setLoading(true);
    try {
      const res = await api.get(`/social/reels?page=${p}&limit=15`, token);
      const list = Array.isArray(res) ? res : [];
      if (reset) {
        setReels(list);
        setPage(1);
      } else {
        setReels(prev => (p === 1 ? list : [...prev, ...list]));
      }
      setHasMore(list.length >= 15);
      if (!reset) setPage(prev => prev + 1);
    } catch {
      if (reset) setReels([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [token, page]);

  useEffect(() => {
    loadReels(true);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    loadReels(true);
  };

  const onEndReached = () => {
    if (!loadingMore && hasMore && reels.length >= 10) {
      loadReels(false);
    }
  };

  const handleLike = async (postId) => {
    if (!token) return;
    try {
      await api.post(`/social/posts/${postId}/react?reaction_type=heart`, {}, token);
      setReels(prev => prev.map(p =>
        p.id === postId
          ? { ...p, user_reaction: p.user_reaction === 'heart' ? null : 'heart', reactions: { ...(p.reactions || {}), heart: (p.reactions?.heart || 0) + (p.user_reaction === 'heart' ? -1 : 1) } }
          : p
      ));
    } catch {}
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 80 }).current;

  const renderReel = ({ item, index }) => {
    if (item.type === 'ad') {
      return (
        <View style={[styles.reelItem, styles.adReelItem, { height: SCREEN_HEIGHT - insets.top - insets.bottom }]}>
          <View style={styles.adContainer}>
            <NativeAd placement="discover" adIndex={item.adIndex} />
          </View>
        </View>
      );
    }
    const mediaUrl = item.media_urls?.[0] || item.media_url || null;
    const isVideo = isVideoUrl(mediaUrl);
    const isActive = activeIndex === index;
    const username = item.username || item.user?.username || item.user_id || 'unknown';
    const avatar = item.user_avatar || item.user?.avatar_url || `https://i.pravatar.cc/80?u=${username}`;
    const displayName = item.user_display_name || item.user?.display_name || username;
    const caption = item.caption || item.content || item.text || '';
    const reactions = item.reactions || {};
    const likeCount = (reactions.heart || 0) + (reactions.fire || 0) + (reactions.applause || 0) || item.likes_count || 0;

    return (
      <View style={[styles.reelItem, { height: SCREEN_HEIGHT - insets.top - insets.bottom }]}>
        {mediaUrl ? (
          isVideo && Video ? (
            <Video
              source={{ uri: mediaUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              isLooping
              shouldPlay={isActive}
              isMuted={false}
            />
          ) : (
            <Image source={{ uri: mediaUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholderMedia]} />
        )}

        <View style={[styles.overlay, { paddingTop: insets.top }]}>
          <View style={styles.rightActions}>
            <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { username })}>
              <View style={styles.avatarBorder}>
                <Image source={{ uri: avatar }} style={styles.avatar} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(item.id)}>
              <Ionicons name={item.user_reaction === 'heart' ? 'heart' : 'heart-outline'} size={32} color={item.user_reaction === 'heart' ? '#ff2d55' : '#fff'} />
              <Text style={styles.actionLabel}>{likeCount}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="chatbubble-outline" size={28} color="#fff" />
              <Text style={styles.actionLabel}>{item.comments_count || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="paper-plane-outline" size={26} color="#fff" />
              <Text style={styles.actionLabel}>{t('reels.share')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={[styles.bottomInfo, { paddingBottom: insets.bottom + 70 }]}>
            <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { username })}>
              <Text style={styles.username}>@{username}</Text>
            </TouchableOpacity>
            {caption ? <Text style={styles.caption} numberOfLines={2}>{caption}</Text> : null}
          </View>
        </View>
      </View>
    );
  };

  if (loading && reels.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('reels.title')}</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Reels</Text>
      </View>
      <FlatList
        ref={flatListRef}
        data={reelsWithAds}
        renderItem={renderReel}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews={true}
        getItemLayout={(_, index) => {
          const itemHeight = SCREEN_HEIGHT - insets.top - insets.bottom;
          return { length: itemHeight, offset: itemHeight * index, index };
        }}
        keyExtractor={(item) => item.type === 'ad' ? item.id : (item.id || item._id || String(Math.random()))}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SCREEN_HEIGHT - insets.top - insets.bottom}
        snapToAlignment="start"
              onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={[styles.footerLoader, { height: SCREEN_HEIGHT * 0.3 }]}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={[styles.empty, { height: SCREEN_HEIGHT - insets.top - 100 }]}>
            <Ionicons name="videocam-outline" size={64} color="#555" />
            <Text style={styles.emptyText}>{t('reels.noReels')}</Text>
            <Text style={styles.emptySub}>{t('reels.noReelsSub')}</Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.5)' },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  reelItem: { width: SCREEN_WIDTH },
  adReelItem: { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  adContainer: { width: '100%', paddingHorizontal: 16 },
  placeholderMedia: { backgroundColor: '#111' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  rightActions: { position: 'absolute', right: 12, bottom: 140, alignItems: 'center' },
  avatarBorder: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#fff', padding: 2, marginBottom: 20 },
  avatar: { width: '100%', height: '100%', borderRadius: 22 },
  actionBtn: { alignItems: 'center', marginBottom: 16 },
  actionLabel: { fontSize: 12, color: colors.text, marginTop: 4 },
  bottomInfo: { paddingHorizontal: 16 },
  username: { fontSize: 16, fontWeight: '700', color: colors.text },
  caption: { fontSize: 14, color: colors.text, marginTop: 6, opacity: 0.95 },
  footerLoader: { justifyContent: 'center', alignItems: 'center' },
  empty: { justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 18, color: '#888', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#555', marginTop: 8 },
});
