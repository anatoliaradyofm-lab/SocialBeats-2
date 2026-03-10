/**
 * SharePostPickerScreen - Gönderi paylaşımı için gönderi seçimi
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { getApiUrl } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const mediaUri = (uri) => {
  if (!uri) return null;
  if (uri.startsWith('http')) return uri;
  const base = (getApiUrl() || '').replace(/\/api\/?$/, '');
  return uri.startsWith('/') ? `${base}${uri}` : `${base}/api/${uri}`;
};

export default function SharePostPickerScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { conversationId } = route.params || {};
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadPosts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/social/feed?page=1&limit=30', token);
      const items = Array.isArray(res) ? res : res?.posts || [];
      setPosts(items);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const onRefresh = () => { setRefreshing(true); loadPosts(); };

  const sharePost = async (post) => {
    if (!token || !conversationId || sending) return;
    setSending(true);
    try {
      await api.post('/messages', {
        conversation_id: conversationId,
        content_type: 'POST',
        content: (post.caption || post.content || '').slice(0, 200) || null,
        post_id: post.id,
      }, token);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('common.error'), e?.data?.detail || t('common.shareFailed'));
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }) => {
    const username = item.username || item.user?.username || '?';
    const avatar = item.user_avatar || item.user?.avatar_url || `https://i.pravatar.cc/50?u=${username}`;
    const media = item.media_urls?.[0] || item.media_url;
    return (
      <TouchableOpacity style={styles.row} onPress={() => sharePost(item)} disabled={sending}>
        {media ? (
          <Image source={{ uri: mediaUri(media) }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="image-outline" size={32} color="#6B7280" />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.caption} numberOfLines={2}>{item.caption || item.content || t('feed.post')}</Text>
          <Text style={styles.meta}>@{username}</Text>
        </View>
        {sending ? <ActivityIndicator size="small" color="#8B5CF6" /> : <Ionicons name="send" size={20} color="#8B5CF6" />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('feed.sharePost')}</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
          ListEmptyComponent={<Text style={styles.empty}>{t('feed.postNotFound')}</Text>}
        />
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  backBtn: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: '#1F2937', justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, minWidth: 0 },
  caption: { fontSize: 14, color: colors.text },
  meta: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  empty: { color: '#9CA3AF', textAlign: 'center', padding: 24 },
});
