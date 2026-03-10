/**
 * AddSongsToPlaylistScreen - Search and add tracks to a playlist
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

export default function AddSongsToPlaylistScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { playlistId, playlistName } = route.params || {};
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addingIds, setAddingIds] = useState(new Set());

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q || !token) return;
    setLoading(true);
    try {
      const encoded = encodeURIComponent(q);
      const res = await api.get(`/music/search/${encoded}?limit=20`, token);
      const items = res?.results || res?.tracks || [];
      setResults(Array.isArray(items) ? items : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, token]);

  const addTrack = async (track) => {
    const trackId = track.id || track.song_id;
    if (!trackId || !playlistId || !token || addingIds.has(trackId)) return;
    setAddingIds((prev) => new Set([...prev, trackId]));
    try {
      await api.post(`/playlists/${playlistId}/tracks/${trackId}`, {}, token);
      navigation.goBack();
    } catch (err) {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(trackId);
        return next;
      });
    }
  };

  const renderItem = ({ item }) => {
    const trackId = item.id || item.song_id;
    const adding = addingIds.has(trackId);
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => addTrack(item)}
        disabled={adding}
      >
        <Image source={{ uri: item.thumbnail || item.cover_url }} style={styles.thumb} />
        <View style={styles.info}>
          <Text style={styles.trackTitle} numberOfLines={1}>{item.title || item.name}</Text>
          <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text>
        </View>
        {adding ? (
          <ActivityIndicator size="small" color="#8B5CF6" />
        ) : (
          <Ionicons name="add-circle" size={28} color="#8B5CF6" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('playlistDetail.addSongs', 'Add Songs')} – {playlistName || t('playlist.playlist', 'Playlist')}
        </Text>
      </View>
      <KeyboardAvoidingView
        style={styles.searchRow}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <TextInput
          style={styles.input}
          placeholder={t('search.searchPlaceholder', 'Search songs...')}
          placeholderTextColor="#6B7280"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={search}>
          <Ionicons name="search" size={24} color="#fff" />
        </TouchableOpacity>
      </KeyboardAvoidingView>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => item.id || item.song_id || String(Math.random())}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
          ListEmptyComponent={
            query.trim() ? (
              <Text style={styles.empty}>{t('common.noResults', 'No results found')}</Text>
            ) : (
              <Text style={styles.empty}>{t('dashboard.searchPlaceholder', 'Search for songs to add')}</Text>
            )
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  backBtn: { marginRight: 12 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', color: colors.text },
  trackTitle: { fontSize: 16, color: colors.text },
  searchRow: { flexDirection: 'row', padding: 16, gap: 8 },
  input: { flex: 1, height: 44, backgroundColor: '#1F2937', borderRadius: 8, paddingHorizontal: 16, color: colors.text, fontSize: 16 },
  searchBtn: { padding: 10, justifyContent: 'center' },
  list: { paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center' },
  empty: { color: '#9CA3AF', textAlign: 'center', paddingVertical: 40 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  thumb: { width: 48, height: 48, borderRadius: 6, marginRight: 12 },
  info: { flex: 1 },
  artist: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
});
