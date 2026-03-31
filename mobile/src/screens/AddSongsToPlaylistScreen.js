/**
 * AddSongsToPlaylistScreen - Search and add tracks to a playlist
 */
import React, { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TextInput, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, Platform, KeyboardAvoidingView, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { enqueuePendingTrack } from './PlaylistDetailScreen';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

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
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useFocusEffect(useCallback(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []));

  const search = useCallback(async (q) => {
    const trimmed = (q ?? query).trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const res = await api.get(`/music-hybrid/search?q=${encodeURIComponent(trimmed)}&limit=20`, token);
      const items = res?.results || res?.tracks || [];
      setResults(Array.isArray(items) ? items : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, token]);

  const onChangeText = (text) => {
    setQuery(text);
    clearTimeout(debounceRef.current);
    if (text.trim().length >= 2) {
      debounceRef.current = setTimeout(() => search(text), 280);
    } else if (!text.trim()) {
      setResults([]);
    }
  };

  const addTrack = async (track) => {
    const trackId = track.id || track.song_id;
    if (!trackId || !playlistId || addingIds.has(trackId)) return;
    setAddingIds((prev) => new Set([...prev, trackId]));
    try {
      await api.post(`/playlists/${playlistId}/tracks/${trackId}`, {}, token);
      enqueuePendingTrack(playlistId, track);
      navigation.goBack();
    } catch {
      setAddingIds((prev) => { const n = new Set(prev); n.delete(trackId); return n; });
    }
  };

  const renderItem = ({ item }) => {
    const trackId = item.id || item.song_id;
    const adding = addingIds.has(trackId);
    const thumb = item.thumbnail || item.cover_url;
    return (
      <TouchableOpacity style={styles.row} onPress={() => addTrack(item)} disabled={adding} activeOpacity={0.7}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Ionicons name="musical-notes" size={20} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.trackTitle} numberOfLines={1}>{item.title || item.name}</Text>
          <Text style={styles.artist} numberOfLines={1}>{item.artist || item.uploader || ''}</Text>
        </View>
        {adding
          ? <ActivityIndicator size="small" color={colors.primary} />
          : <Ionicons name="add-circle" size={28} color={colors.primary} />}
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {playlistName || t('playlist.playlist', 'Playlist')}
        </Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={17} color={query.length > 0 ? colors.primary : colors.textMuted} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            value={query}
            onChangeText={onChangeText}
            onSubmitEditing={() => search(query)}
            placeholder={t('search.searchSongs', 'Şarkı ara...')}
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {loading && <ActivityIndicator size="small" color={colors.primary} />}
          {query.length > 0 && !loading && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={17} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results */}
      <FlatList
        data={results}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id || item.song_id || Math.random())}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            {!query.trim() ? (
              <>
                <Ionicons name="musical-notes-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>{t('dashboard.searchPlaceholder', 'Eklemek istediğin şarkıyı ara')}</Text>
              </>
            ) : !loading ? (
              <>
                <Ionicons name="search-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>{t('common.noResults', 'Sonuç bulunamadı')}</Text>
              </>
            ) : null}
          </View>
        }
      />
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 12,
                  paddingHorizontal: 16, paddingVertical: 12,
                  borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:      { padding: 4 },
  headerTitle:  { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
  searchWrap:   { paddingHorizontal: 16, paddingVertical: 10 },
  searchBar:    { flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: colors.surfaceHigh, borderRadius: 12,
                  borderWidth: 1, borderColor: colors.border,
                  paddingHorizontal: 12, paddingVertical: 10 },
  searchInput:  { flex: 1, fontSize: 15, color: colors.text },
  list:         { paddingHorizontal: 16 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 12,
                  paddingVertical: 12,
                  borderBottomWidth: 1, borderBottomColor: colors.border },
  thumb:        { width: 48, height: 48, borderRadius: 8 },
  thumbFallback:{ backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  info:         { flex: 1, minWidth: 0 },
  trackTitle:   { fontSize: 15, fontWeight: '600', color: colors.text },
  artist:       { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  emptyWrap:    { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:    { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
});
