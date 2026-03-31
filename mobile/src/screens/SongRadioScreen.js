import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import api from '../services/api';
import { usePlayer } from '../contexts/PlayerContext';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function SongRadioScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const { playTrack } = usePlayer();

  const { trackId, trackTitle, trackArtist, trackThumbnail } = route.params || {};

  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!trackId) return;
    fetchRadio();
  }, [trackId]);

  const fetchRadio = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/music/radio/${encodeURIComponent(trackId)}`);
      setTracks(data.tracks || []);
    } catch (err) {
      setError(err.message || 'Failed to load radio');
    } finally {
      setLoading(false);
    }
  };

  const buildQueue = () => tracks.map((tr) => ({
    id: tr.id,
    title: tr.title,
    artist: tr.artist,
    thumbnail: tr.thumbnail,
    source: tr.source,
    audio_url: tr.audio_url,
  }));

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    const queueTracks = buildQueue();
    playTrack(queueTracks[0], queueTracks);
  };

  const handlePlayTrack = (track, index) => {
    const queueTracks = buildQueue();
    playTrack(queueTracks[index], queueTracks);
  };

  const renderTrackItem = ({ item, index }) => (
    <TouchableOpacity style={styles.trackItem} onPress={() => handlePlayTrack(item, index)} activeOpacity={0.7}>
      {item.thumbnail ? (
        <Image source={{ uri: item.thumbnail }} style={styles.trackThumb} />
      ) : (
        <View style={[styles.trackThumb, styles.trackThumbPlaceholder]}>
          <Ionicons name="musical-note" size={20} color="#6B7280" />
        </View>
      )}
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.trackArtist} numberOfLines={1}>{item.artist}</Text>
      </View>
      <View style={styles.sourceTag}>
        <Text style={styles.sourceText}>SoundCloud</Text>
      </View>
      <Ionicons name="play-circle-outline" size={28} color="#8B5CF6" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
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
        <View style={styles.headerCenter}>
          <Ionicons name="radio-outline" size={20} color="#8B5CF6" />
          <Text style={styles.headerTitle}>{t('radio.title', 'Song Radio')}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.seedCard}>
        {trackThumbnail ? (
          <Image source={{ uri: trackThumbnail }} style={styles.seedThumb} />
        ) : (
          <View style={[styles.seedThumb, styles.seedThumbPlaceholder]}>
            <Ionicons name="musical-notes" size={32} color="#6B7280" />
          </View>
        )}
        <View style={styles.seedInfo}>
          <Text style={styles.seedLabel}>{t('radio.basedOn', 'Based on')}</Text>
          <Text style={styles.seedTitle} numberOfLines={1}>{trackTitle || 'Unknown'}</Text>
          <Text style={styles.seedArtist} numberOfLines={1}>{trackArtist || ''}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>{t('radio.generating', 'Generating radio...')}</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchRadio}>
            <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : tracks.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="radio-outline" size={48} color="#6B7280" />
          <Text style={styles.emptyText}>{t('radio.noTracks', 'No similar tracks found')}</Text>
        </View>
      ) : (
        <>
          <TouchableOpacity style={styles.playAllBtn} onPress={handlePlayAll}>
            <Ionicons name="play" size={20} color="#fff" />
            <Text style={styles.playAllText}>{t('radio.playAll', 'Play All')} ({tracks.length})</Text>
          </TouchableOpacity>
          <FlatList
            data={tracks}
            keyExtractor={(item, idx) => `${item.id}_${idx}`}
            renderItem={renderTrackItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  seedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 16,
    gap: 12,
  },
  seedThumb: { width: 64, height: 64, borderRadius: 12 },
  seedThumbPlaceholder: {
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seedInfo: { flex: 1 },
  seedLabel: { fontSize: 11, color: colors.accent, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  seedTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  seedArtist: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  playAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  playAllText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
    gap: 12,
  },
  trackThumb: { width: 48, height: 48, borderRadius: 8 },
  trackThumbPlaceholder: {
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: { flex: 1 },
  trackTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  trackArtist: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  sourceTag: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sourceText: { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#9CA3AF', fontSize: 14, marginTop: 8 },
  errorText: { color: colors.error, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  retryText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  emptyText: { color: '#6B7280', fontSize: 14, textAlign: 'center' },
});
