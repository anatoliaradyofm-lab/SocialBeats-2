/**
 * SharePlaylistPickerScreen - Çalma listesi paylaşımı
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
import { useTheme } from '../contexts/ThemeContext';

export default function SharePlaylistPickerScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { conversationId } = route.params || {};
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadPlaylists = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/playlists', token);
      const items = Array.isArray(res) ? res : res?.playlists || [];
      setPlaylists(items);
    } catch {
      setPlaylists([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const sharePlaylist = async (pl) => {
    if (!token || !conversationId || sending) return;
    setSending(true);
    try {
      await api.post('/messages', {
        conversation_id: conversationId,
        content_type: 'PLAYLIST',
        content: pl.name || t('tabs.playlists'),
        playlist_id: pl.id,
      }, token);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('common.error'), e?.data?.detail || t('common.shareFailed'));
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.row} onPress={() => sharePlaylist(item)} disabled={sending}>
      <View style={[styles.thumb, styles.thumbPlaceholder]}>
        <Ionicons name="list" size={28} color="#6B7280" />
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.name || t('tabs.playlists')}</Text>
        <Text style={styles.meta}>{item.track_count || 0} parça</Text>
      </View>
      {sending ? <ActivityIndicator size="small" color="#8B5CF6" /> : <Ionicons name="send" size={20} color="#8B5CF6" />}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('player.sharePlaylist')}</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : (
        <FlatList
          data={playlists}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPlaylists(); }} tintColor="#8B5CF6" />}
          ListEmptyComponent={<Text style={styles.empty}>{t('feed.noPlaylistsFound')}</Text>}
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
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#1F2937', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: '#1F2937', justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  empty: { color: '#9CA3AF', textAlign: 'center', padding: 24 },
});
