import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet,
  RefreshControl, Dimensions, Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

const { width: SW } = Dimensions.get('window');

function isVideoUrl(url) {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url);
}

function MediaPreview({ urls, mediaUrl, onPress }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const allUrls = urls?.length > 0 ? urls : (mediaUrl ? [mediaUrl] : []);
  if (allUrls.length === 0) return null;

  return (
    <View>
      <FlatList
        horizontal
        pagingEnabled
        data={allUrls}
        onMomentumScrollEnd={(e) => setActiveIdx(Math.round(e.nativeEvent.contentOffset.x / SW))}
        renderItem={({ item }) =>
          isVideoUrl(item) ? (
            <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
              <Video source={{ uri: item }} style={styles.postMedia} resizeMode="cover" shouldPlay={false} useNativeControls={false} isMuted />
              <View style={styles.videoIcon}>
                <Ionicons name="play-circle" size={36} color="rgba(255,255,255,0.9)" />
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
              <Image source={{ uri: item }} style={styles.postMedia} resizeMode="cover" />
            </TouchableOpacity>
          )
        }
        keyExtractor={(_, i) => `m-${i}`}
        showsHorizontalScrollIndicator={false}
      />
      {allUrls.length > 1 && (
        <View style={styles.dotsRow}>
          {allUrls.map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === activeIdx ? BRAND.primary : 'rgba(255,255,255,0.5)' }]} />
          ))}
        </View>
      )}
    </View>
  );
}

function PostCard({ post, colors, onPress, onLike, onShare, onSave, t }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
      <TouchableOpacity style={styles.userRow} onPress={() => {}}>
        <View style={[styles.avatar, { backgroundColor: colors.card }]}>
          {(post.user?.avatar_url || post.user_avatar) ? <Image source={{ uri: post.user?.avatar_url || post.user_avatar }} style={styles.avatar} /> : <Ionicons name="person" size={14} color={BRAND.primaryLight} />}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{post.user?.display_name || post.user_display_name || post.username || ''}</Text>
            {(post.is_verified || post.user?.is_verified) && <Ionicons name="checkmark-circle" size={12} color={BRAND.primary} />}
            {post.is_pinned && <Ionicons name="pin" size={10} color={BRAND.accent} />}
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>{post.created_ago || ''} {(post.location || post.location_name) ? `· ${post.location_name || post.location}` : ''}</Text>
        </View>
        <TouchableOpacity onPress={onPress}><Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} /></TouchableOpacity>
      </TouchableOpacity>

      <MediaPreview urls={post.media_urls} mediaUrl={post.media_url} onPress={onPress} />

      {post.content && (
        <TouchableOpacity onPress={onPress}>
          <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, paddingHorizontal: 14, paddingVertical: (post.media_url || post.media_urls?.length) ? 10 : 14 }} numberOfLines={4}>{post.content}</Text>
        </TouchableOpacity>
      )}

      {post.hashtags?.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, paddingBottom: 6, gap: 6 }}>
          {post.hashtags.slice(0, 5).map((h, i) => (
            <Text key={i} style={{ color: BRAND.primary, fontSize: 12 }}>#{h}</Text>
          ))}
        </View>
      )}

      {post.music_track_id && (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 6, gap: 4 }}>
          <Ionicons name="musical-note" size={12} color={BRAND.accent} />
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t('feed.hasMusic')}</Text>
        </View>
      )}

      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.actionBtn} onPress={onLike}>
          <Ionicons name={post.is_liked || post.user_reaction ? 'heart' : 'heart-outline'} size={22} color={(post.is_liked || post.user_reaction) ? BRAND.pink : colors.textSecondary} />
          {(post.likes || Object.values(post.reactions || {}).reduce((a, b) => a + b, 0)) > 0 && (
            <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 4 }}>{post.likes || Object.values(post.reactions || {}).reduce((a, b) => a + b, 0)}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
          {(post.comments || post.comments_count) > 0 && <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 4 }}>{post.comments || post.comments_count}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onShare}>
          <Ionicons name="paper-plane-outline" size={20} color={colors.textSecondary} />
          {(post.shares || post.shares_count) > 0 && <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 4 }}>{post.shares || post.shares_count}</Text>}
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        {(post.view_count || post.views_count) > 0 && <Text style={{ color: colors.textMuted, fontSize: 11 }}>{post.view_count || post.views_count} {t('feed.views')}</Text>}
        <TouchableOpacity style={{ marginLeft: 12 }} onPress={onSave}>
          <Ionicons name={post.is_saved ? 'bookmark' : 'bookmark-outline'} size={20} color={post.is_saved ? BRAND.accent : colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function FeedScreen({ navigation }) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { colors } = useTheme();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['feed', token],
    queryFn: async ({ pageParam }) => {
      const res = await api.get(`/social/feed?page=${pageParam}&limit=20`, token);
      return Array.isArray(res) ? res : (res.posts || []);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length >= 20 ? allPages.length + 1 : undefined,
  });

  const posts = data?.pages?.flatMap((p) => p) ?? [];

  const onRefresh = useCallback(() => refetch(), [refetch]);
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleLike = async (postId) => {
    try {
      await api.post(`/social/posts/${postId}/react`, { emoji: '❤️' }, token);
      refetch();
    } catch {}
  };

  const handleShare = async (postId) => {
    Alert.alert(
      t('common.share'),
      t('feed.sharePrompt'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('feed.repost'), onPress: async () => {
          try {
            await api.post(`/social/posts/${postId}/repost`, {}, token);
            refetch();
          } catch {}
        }},
        { text: t('common.share'), onPress: async () => {
          try { await api.post(`/social/posts/${postId}/share`, {}, token); } catch {}
        }},
      ]
    );
  };

  const handleSave = async (postId) => {
    try {
      await api.post(`/social/posts/${postId}/save`, {}, token);
      refetch();
    } catch {}
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={posts}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            colors={colors}
            onPress={() => navigation.navigate('PostDetail', { postId: item.id || item._id })}
            onLike={() => handleLike(item.id || item._id)}
            onShare={() => handleShare(item.id || item._id)}
            onSave={() => handleSave(item.id || item._id)}
            t={t}
          />
        )}
        keyExtractor={(item, i) => item.id || item._id || `${i}`}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={BRAND.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListFooterComponent={isFetchingNextPage ? <View style={{ padding: 16, alignItems: 'center' }}><Text style={{ color: colors.textMuted }}>{t('common.loading')}</Text></View> : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="newspaper-outline" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 16 }}>{t('feed.noPostsYet')}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { marginHorizontal: 0, marginBottom: 8 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  postMedia: { width: SW, height: SW },
  videoIcon: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingVertical: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 0.5 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  empty: { alignItems: 'center', paddingTop: 100 },
});
