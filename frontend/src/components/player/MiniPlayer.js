import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { usePlayer } from '../../contexts/PlayerContext';
import { useTheme, BRAND } from '../../contexts/ThemeContext';

export default function MiniPlayer() {
  const { currentTrack, isPlaying, togglePlay, skipNext, skipPrev, addToQueue, positionMillis, durationMillis } = usePlayer();
  const { colors } = useTheme();
  const navigation = useNavigation();

  if (!currentTrack) return null;

  const progress = durationMillis > 0 ? positionMillis / durationMillis : 0;

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.surfaceElevated }]}
      onPress={() => navigation.navigate('FullPlayer')}
      activeOpacity={0.95}
    >
      <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.content}>
        <View style={[styles.thumb, { backgroundColor: colors.card }]}>
          {currentTrack.thumbnail ? (
            <Image source={{ uri: currentTrack.thumbnail }} style={styles.thumb} />
          ) : (
            <Ionicons name="musical-note" size={18} color={BRAND.primaryLight} />
          )}
        </View>
        <View style={styles.info}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{currentTrack.title}</Text>
          <Text style={[styles.artist, { color: colors.textMuted }]} numberOfLines={1}>{currentTrack.artist}</Text>
        </View>
        <View style={styles.controls}>
          <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); skipPrev(); }} style={{ padding: 6 }}>
            <Ionicons name="play-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); togglePlay(); }} style={styles.playBtn}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); skipNext(); }} style={{ padding: 6 }}>
            <Ionicons name="play-forward" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); navigation.navigate('PlaylistAddTrack', { track: currentTrack }); }} style={{ padding: 6 }}>
            <Ionicons name="add-circle-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', bottom: 52, left: 0, right: 0, borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden' },
  progressBg: { height: 2.5, width: '100%' },
  progressFill: { height: '100%', backgroundColor: BRAND.primary, borderRadius: 1 },
  content: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 10 },
  thumb: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  info: { flex: 1 },
  title: { fontSize: 13, fontWeight: '600' },
  artist: { fontSize: 11, marginTop: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  playBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: BRAND.primary, justifyContent: 'center', alignItems: 'center' },
});
