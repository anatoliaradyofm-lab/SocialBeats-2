import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { usePlayer } from '../contexts/PlayerContext';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

const parseLRC = (lrcText) => {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const parsed = [];
  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (match) {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const ms = parseInt(match[3].padEnd(3, '0'));
      const time = minutes * 60000 + seconds * 1000 + ms;
      const text = match[4].trim();
      if (text) parsed.push({ time, text });
    }
  }
  return parsed.sort((a, b) => a.time - b.time);
};

function getActiveLine(syncedLines, positionMs) {
  if (!syncedLines.length) return -1;
  let active = -1;
  for (let i = 0; i < syncedLines.length; i++) {
    if (positionMs >= syncedLines[i].time) {
      active = i;
    } else {
      break;
    }
  }
  return active;
}

export default function LyricsScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { currentTrack, positionMillis, seekTo } = usePlayer();
  const [syncedLines, setSyncedLines] = useState([]);
  const [plainLyrics, setPlainLyrics] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const scrollRef = useRef(null);
  const userScrollingRef = useRef(false);
  const userScrollTimerRef = useRef(null);

  const title = route?.params?.title || currentTrack?.title || '';
  const artist = route?.params?.artist || currentTrack?.artist || '';

  const activeLine = useMemo(
    () => getActiveLine(syncedLines, positionMillis),
    [syncedLines, positionMillis]
  );

  const fetchLyrics = useCallback(async () => {
    if (!title) {
      setError(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);

    try {
      const params = new URLSearchParams({
        track_name: title.replace(/\s*\(.*?\)\s*/g, '').replace(/\s*\[.*?\]\s*/g, ''),
        artist_name: artist || '',
      });
      const response = await fetch(`https://lrclib.net/api/get?${params}`, {
        headers: { 'User-Agent': 'SocialBeats/1.0' },
      });

      if (!response.ok) {
        setError(true);
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (data.syncedLyrics) {
        const parsed = parseLRC(data.syncedLyrics);
        setSyncedLines(parsed);
        setPlainLyrics('');
      } else if (data.plainLyrics) {
        setPlainLyrics(data.plainLyrics);
        setSyncedLines([]);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [title, artist]);

  useEffect(() => {
    fetchLyrics();
  }, [fetchLyrics]);

  useEffect(() => {
    return () => {
      if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (activeLine >= 0 && scrollRef.current && !userScrollingRef.current) {
      const yOffset = Math.max(0, activeLine * 48 - 200);
      scrollRef.current.scrollTo({ y: yOffset, animated: true });
    }
  }, [activeLine]);

  const handleLineTap = useCallback((index) => {
    if (syncedLines[index]) {
      seekTo(syncedLines[index].time);
    }
  }, [syncedLines, seekTo]);

  const handleScrollBegin = useCallback(() => {
    userScrollingRef.current = true;
    if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
  }, []);

  const handleScrollEnd = useCallback(() => {
    if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
    userScrollTimerRef.current = setTimeout(() => {
      userScrollingRef.current = false;
    }, 4000);
  }, []);

  const renderSyncedLyrics = () => (
    <ScrollView
      ref={scrollRef}
      style={styles.lyricsScroll}
      contentContainerStyle={[styles.lyricsContent, { paddingBottom: insets.bottom + 80 }]}
      showsVerticalScrollIndicator={false}
      onScrollBeginDrag={handleScrollBegin}
      onScrollEndDrag={handleScrollEnd}
      onMomentumScrollEnd={handleScrollEnd}
    >
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {syncedLines.map((line, index) => (
        <TouchableOpacity
          key={index}
          onPress={() => handleLineTap(index)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.lyricLine,
              activeLine === index && styles.lyricLineActive,
              activeLine > index && styles.lyricLinePast,
            ]}
          >
            {line.text}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderPlainLyrics = () => (
    <ScrollView
      style={styles.lyricsScroll}
      contentContainerStyle={[styles.lyricsContent, { paddingBottom: insets.bottom + 80 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.plainLyrics}>{plainLyrics}</Text>
    </ScrollView>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title || t('lyrics.title')}</Text>
          {artist ? <Text style={styles.headerArtist} numberOfLines={1}>{artist}</Text> : null}
        </View>
        <TouchableOpacity onPress={fetchLyrics} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={22} color="#8B5CF6" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>{t('lyrics.searching')}</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="musical-notes-outline" size={64} color="#374151" />
          <Text style={styles.errorText}>{t('lyrics.notFound')}</Text>
          <Text style={styles.errorSubtext}>{t('lyrics.notAvailable', { title })}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchLyrics}>
            <Text style={styles.retryText}>{t('lyrics.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : syncedLines.length > 0 ? (
        renderSyncedLyrics()
      ) : plainLyrics ? (
        renderPlainLyrics()
      ) : (
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('lyrics.notFound')}</Text>
        </View>
      )}

      <View style={styles.sourceNote}>
        <Text style={styles.sourceText}>{t('lyrics.source')}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  headerArtist: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
  refreshBtn: { padding: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { color: '#9CA3AF', marginTop: 16, fontSize: 16 },
  errorText: { color: colors.text, fontSize: 18, fontWeight: '600', marginTop: 16, textAlign: 'center' },
  errorSubtext: { color: '#9CA3AF', fontSize: 14, marginTop: 8, textAlign: 'center' },
  retryBtn: {
    marginTop: 24,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  lyricsScroll: { flex: 1 },
  lyricsContent: { padding: 24 },
  lyricLine: {
    fontSize: 20,
    color: '#6B7280',
    lineHeight: 48,
    fontWeight: '500',
  },
  lyricLineActive: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  lyricLinePast: {
    color: '#9CA3AF',
  },
  plainLyrics: {
    fontSize: 18,
    color: '#E5E7EB',
    lineHeight: 32,
  },
  sourceNote: {
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  sourceText: { fontSize: 12, color: '#4B5563' },
});
