import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Image, StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../contexts/PlayerContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';

function formatDuration(ms) {
  if (!ms || ms <= 0) return '';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default function QueueScreen({ navigation }) {
  const {
    queue, currentIndex, playQueueItem, removeFromQueue,
    clearQueue, moveInQueue, currentTrack, addToQueue,
  } = usePlayer();
  const { colors } = useTheme();
  const [dragIdx, setDragIdx] = useState(null);

  const upNext = queue.slice(currentIndex + 1);
  const played = queue.slice(0, currentIndex);

  const handleMoveUp = (queueIndex) => {
    if (queueIndex > currentIndex + 1) {
      moveInQueue(queueIndex, queueIndex - 1);
    }
  };

  const handleMoveDown = (queueIndex) => {
    if (queueIndex < queue.length - 1) {
      moveInQueue(queueIndex, queueIndex + 1);
    }
  };

  const handleClear = () => {
    Alert.alert(
      'Sırayı Temizle',
      'Sıradaki tüm şarkılar kaldırılacak. Devam etmek istiyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Temizle', style: 'destructive', onPress: clearQueue },
      ]
    );
  };

  const totalDuration = queue.reduce((acc, t) => acc + (t.duration_ms || (t.duration || 0) * 1000 || 0), 0);

  const listData = [
    ...(currentTrack ? [{ type: 'now_playing_header' }] : []),
    ...(currentTrack ? [{ type: 'now_playing', track: currentTrack }] : []),
    ...(upNext.length > 0 ? [{ type: 'up_next_header', count: upNext.length }] : []),
    ...upNext.map((t, i) => ({ type: 'track', track: t, queueIndex: currentIndex + 1 + i })),
    ...(played.length > 0 ? [{ type: 'played_header', count: played.length }] : []),
    ...played.map((t, i) => ({ type: 'played_track', track: t, queueIndex: i })),
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Sıradakiler</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>
            {queue.length} parça{totalDuration > 0 ? ` · ${formatDuration(totalDuration)}` : ''}
          </Text>
        </View>
        <TouchableOpacity onPress={handleClear}>
          <Text style={{ color: BRAND.primaryLight, fontSize: 14, fontWeight: '500' }}>Temizle</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={listData}
        renderItem={({ item }) => {
          if (item.type === 'now_playing_header') {
            return <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ŞİMDİ ÇALIYOR</Text>;
          }
          if (item.type === 'up_next_header') {
            return <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>SIRADA ({item.count})</Text>;
          }
          if (item.type === 'played_header') {
            return <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ÖNCEKİLER ({item.count})</Text>;
          }
          if (item.type === 'now_playing') {
            return (
              <View style={[styles.trackRow, { backgroundColor: 'rgba(124,58,237,0.08)' }]}>
                <View style={styles.nowPlayingIndicator}>
                  <Ionicons name="musical-note" size={14} color={BRAND.primary} />
                </View>
                <View style={[styles.thumb, { backgroundColor: colors.surfaceElevated }]}>
                  {item.track.thumbnail ? <Image source={{ uri: item.track.thumbnail }} style={styles.thumb} /> : <Ionicons name="musical-note" size={16} color={BRAND.primaryLight} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.trackTitle, { color: BRAND.primary }]} numberOfLines={1}>{item.track.title}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.track.artist}</Text>
                </View>
                {item.track.duration > 0 && (
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>{formatDuration(item.track.duration * 1000)}</Text>
                )}
              </View>
            );
          }
          const isPlayed = item.type === 'played_track';
          return (
            <TouchableOpacity style={styles.trackRow} onPress={() => playQueueItem(item.queueIndex)} activeOpacity={0.7}>
              <View style={styles.reorderControls}>
                {!isPlayed && (
                  <>
                    <TouchableOpacity onPress={() => handleMoveUp(item.queueIndex)} style={styles.reorderBtn} hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }}>
                      <Ionicons name="chevron-up" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleMoveDown(item.queueIndex)} style={styles.reorderBtn} hitSlop={{ top: 4, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  </>
                )}
                {isPlayed && (
                  <Ionicons name="checkmark-circle" size={16} color={colors.textMuted} style={{ opacity: 0.4 }} />
                )}
              </View>
              <View style={[styles.thumb, { backgroundColor: colors.surfaceElevated, opacity: isPlayed ? 0.5 : 1 }]}>
                {item.track.thumbnail ? <Image source={{ uri: item.track.thumbnail }} style={styles.thumb} /> : <Ionicons name="musical-note" size={16} color={BRAND.primaryLight} />}
              </View>
              <View style={{ flex: 1, opacity: isPlayed ? 0.5 : 1 }}>
                <Text style={[styles.trackTitle, { color: colors.text }]} numberOfLines={1}>{item.track.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.track.artist}</Text>
              </View>
              {item.track.duration > 0 && (
                <Text style={{ color: colors.textMuted, fontSize: 11, opacity: isPlayed ? 0.5 : 1 }}>
                  {formatDuration(item.track.duration * 1000)}
                </Text>
              )}
              {!isPlayed && (
                <TouchableOpacity style={{ padding: 8 }} onPress={() => removeFromQueue(item.queueIndex)}>
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        }}
        keyExtractor={(item, i) => `${item.type}-${i}`}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="list-outline" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 16 }}>Kuyruk boş</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Keşfet sayfasından şarkı ekleyin</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, paddingHorizontal: 16, marginTop: 20, marginBottom: 8 },
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  nowPlayingIndicator: { width: 24, alignItems: 'center' },
  reorderControls: { width: 24, alignItems: 'center', justifyContent: 'center' },
  reorderBtn: { padding: 2 },
  thumb: { width: 46, height: 46, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  trackTitle: { fontSize: 14, fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: 100 },
});
