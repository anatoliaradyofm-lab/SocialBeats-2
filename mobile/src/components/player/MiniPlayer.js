/**
 * MiniPlayer - Tab bar'ın üstünde 70px oynatma çubuğu
 * Cover 48x48, parça bilgisi, oynat/pauz, sonraki, kuyruk
 * Thin progress bar at top showing current position
 */
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../../contexts/PlayerContext';

const TAB_BAR_HEIGHT = 60;

export default function MiniPlayer({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
    playNext,
    playPrevious,
    closePlayer,
    canPlayNext,
    canPlayPrevious,
    positionMillis,
    durationMillis,
  } = usePlayer();

  if (!currentTrack) return null;

  const bottomOffset = TAB_BAR_HEIGHT + insets.bottom;
  const progress = durationMillis > 0 ? positionMillis / durationMillis : 0;

  return (
    <TouchableOpacity
      style={[styles.container, { bottom: bottomOffset }]}
      onPress={() => playTrack(currentTrack)}
      activeOpacity={0.95}
    >
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={styles.content}>
        <Image source={{ uri: currentTrack.thumbnail }} style={styles.thumb} />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{currentTrack.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{currentTrack.artist}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={(e) => { e.stopPropagation(); playPrevious(); }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            disabled={!canPlayPrevious}
            accessibilityLabel="Previous track"
            accessibilityRole="button"
          >
            <Ionicons
              name="play-skip-back"
              size={20}
              color={canPlayPrevious ? '#fff' : '#555'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={(e) => { e.stopPropagation(); togglePlay(); }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            accessibilityRole="button"
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={28}
              color="#fff"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={(e) => { e.stopPropagation(); playNext(); }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            disabled={!canPlayNext}
            accessibilityLabel="Next track"
            accessibilityRole="button"
          >
            <Ionicons
              name="play-skip-forward"
              size={20}
              color={canPlayNext ? '#fff' : '#555'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={(e) => { e.stopPropagation(); closePlayer(); }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Close player"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: '#181818',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  progressBarBg: {
    height: 2,
    backgroundColor: '#333',
    width: '100%',
  },
  progressBarFill: {
    height: 2,
    backgroundColor: '#6366F1',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 4,
    marginRight: 12,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  artist: {
    fontSize: 12,
    color: '#B3B3B3',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    padding: 8,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
