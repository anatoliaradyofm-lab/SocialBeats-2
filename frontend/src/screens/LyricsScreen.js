import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../contexts/PlayerContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

export default function LyricsScreen({ navigation }) {
  const { currentTrack, positionMillis, isPlaying } = usePlayer();
  const { token } = useAuth();
  const { colors } = useTheme();
  const [lyrics, setLyrics] = useState(null);
  const [syncedSegments, setSyncedSegments] = useState([]);
  const [hasSynced, setHasSynced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSynced, setShowSynced] = useState(true);
  const flatListRef = useRef(null);
  const lastScrollIdx = useRef(-1);

  const fetchLyrics = useCallback(async () => {
    if (!currentTrack) return;
    setLoading(true);
    try {
      const params = `title=${encodeURIComponent(currentTrack.title)}&artist=${encodeURIComponent(currentTrack.artist || '')}`;
      const res = await api.get(`/music/lyrics?${params}`, token);
      setLyrics(res.lyrics || null);
      setSyncedSegments(res.synced_segments || []);
      setHasSynced(res.has_synced || false);
    } catch {
      setLyrics(null);
      setSyncedSegments([]);
      setHasSynced(false);
    }
    setLoading(false);
  }, [currentTrack?.id, token]);

  useEffect(() => { fetchLyrics(); }, [fetchLyrics]);

  const activeIndex = hasSynced && showSynced && syncedSegments.length > 0
    ? syncedSegments.reduce((acc, seg, i) => (positionMillis >= seg.time_ms ? i : acc), 0)
    : -1;

  useEffect(() => {
    if (activeIndex >= 0 && activeIndex !== lastScrollIdx.current && flatListRef.current) {
      lastScrollIdx.current = activeIndex;
      flatListRef.current.scrollToIndex({ index: Math.max(0, activeIndex - 2), animated: true, viewPosition: 0.3 });
    }
  }, [activeIndex]);

  if (!currentTrack) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Şarkı Sözleri</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.empty}>
          <Ionicons name="text-outline" size={48} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, marginTop: 16 }}>Çalan şarkı yok</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Şarkı Sözleri</Text>
        {hasSynced && (
          <TouchableOpacity onPress={() => setShowSynced(!showSynced)}>
            <Ionicons
              name={showSynced ? 'time' : 'text'}
              size={20}
              color={showSynced ? BRAND.accent : colors.textMuted}
            />
          </TouchableOpacity>
        )}
        {!hasSynced && <View style={{ width: 22 }} />}
      </View>

      <View style={styles.trackHeader}>
        <Text style={[styles.trackTitle, { color: colors.text }]}>{currentTrack.title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>{currentTrack.artist}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={BRAND.primary} style={{ marginTop: 40 }} />
      ) : hasSynced && showSynced && syncedSegments.length > 0 ? (
        <FlatList
          ref={flatListRef}
          data={syncedSegments}
          renderItem={({ item, index }) => {
            const isActive = index === activeIndex;
            return (
              <View style={[styles.syncedLine, isActive && styles.syncedLineActive]}>
                <Text style={[
                  styles.syncedText,
                  { color: isActive ? BRAND.primary : colors.textSecondary },
                  isActive && styles.syncedTextActive,
                ]}>
                  {item.text}
                </Text>
              </View>
            );
          }}
          keyExtractor={(_, i) => `seg-${i}`}
          contentContainerStyle={styles.lyricsContent}
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={() => {}}
        />
      ) : lyrics ? (
        <ScrollView contentContainerStyle={styles.lyricsContent} showsVerticalScrollIndicator={false}>
          <Text style={[styles.lyricsText, { color: colors.textSecondary }]}>{lyrics}</Text>
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <Ionicons name="text-outline" size={48} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, marginTop: 16, fontSize: 15 }}>Şarkı sözleri bulunamadı</Text>
          <Text style={{ color: colors.textMuted, marginTop: 4, fontSize: 12 }}>"{currentTrack.title}" için henüz sözler mevcut değil</Text>
        </View>
      )}

      {hasSynced && showSynced && (
        <View style={[styles.syncBadge, { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons name="time" size={12} color={BRAND.accent} />
          <Text style={{ color: BRAND.accent, fontSize: 11, fontWeight: '500' }}>Senkronize</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  trackHeader: { paddingHorizontal: 16, marginBottom: 16 },
  trackTitle: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  lyricsContent: { padding: 16, paddingBottom: 100 },
  lyricsText: { fontSize: 18, lineHeight: 32 },
  syncedLine: { paddingVertical: 8, paddingHorizontal: 4 },
  syncedLineActive: { transform: [{ scale: 1.02 }] },
  syncedText: { fontSize: 20, lineHeight: 30 },
  syncedTextActive: { fontWeight: '700', fontSize: 22 },
  syncBadge: { position: 'absolute', bottom: 30, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, gap: 4 },
  empty: { alignItems: 'center', paddingTop: 80 },
});
