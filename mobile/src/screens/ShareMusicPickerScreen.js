/**
 * ShareMusicPickerScreen - Müzik paylaşımı için şarkı seçimi
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, TextInput, Alert} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function ShareMusicPickerScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { conversationId } = route.params || {};
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);

  useFocusEffect(useCallback(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []));

  const searchMusic = useCallback(async (q) => {
    if (!q?.trim()) {
      setSongs([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/music/search/${encodeURIComponent(q.trim())}`, token);
      const items = res?.results || res?.songs || (Array.isArray(res) ? res : []);
      setSongs(items);
      setSearched(true);
    } catch {
      setSongs([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadDiscover = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/music/discover/for-you', token);
      const sections = res?.sections || [];
      const items = sections.flatMap((s) => s.tracks || []).slice(0, 20);
      setSongs(items);
      setSearched(false);
    } catch {
      setSongs([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadDiscover();
  }, [loadDiscover]);

  const shareMusic = async (song) => {
    const songId = song.id || song.song_id;
    if (!token || !conversationId || !songId || sending) return;
    setSending(true);
    try {
      await api.post('/messages', {
        conversation_id: conversationId,
        content_type: 'MUSIC',
        content: `${song.title || ''} - ${song.artist || song.uploader || ''}`.trim() || null,
        music_id: songId,
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
    const title = item.title || item.name || t('common.unknown');
    const artist = item.artist || item.uploader || item.channel || '';
    const thumb = item.thumbnail || item.thumbnails?.[0]?.url;
    return (
      <TouchableOpacity style={styles.row} onPress={() => shareMusic(item)} disabled={sending}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="musical-notes" size={28} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.songTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{artist}</Text>
        </View>
        {sending ? <ActivityIndicator size="small" color="#8B5CF6" /> : <Ionicons name="send" size={20} color="#8B5CF6" />}
      </TouchableOpacity>
    );
  };

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
        <Text style={styles.headerTitle}>{t('player.shareMusic')}</Text>
      </View>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder={t('search.searchSongs')}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => searchMusic(query)}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={() => searchMusic(query)} style={styles.searchBtn}>
          <Text style={styles.searchBtnText}>{t('search.search')}</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : (
        <FlatList
          data={songs}
          renderItem={renderItem}
          keyExtractor={(item, i) => item.video_id || item.id || String(i)}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {searched ? t('search.noResults') : t('search.typeToSearch')}
            </Text>
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  searchRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchInput: { flex: 1, backgroundColor: colors.inputBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: colors.text },
  searchBtn: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#8B5CF6', borderRadius: 10 },
  searchBtnText: { color: colors.text, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: colors.inputBg, justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, minWidth: 0 },
  songTitle: { fontSize: 15, color: colors.text, fontWeight: '500' },
  artist: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', padding: 24 },
});
