import React, { useState, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, PanResponder, Dimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { navigate } from '../../navigation/navigationRef';
import { usePlayer } from '../../contexts/PlayerContext';
import YouTubePlayerMobile from './YouTubePlayerMobile';

const SLEEP_OPTIONS = [5, 15, 30, 45, 60];
const SLIDER_WIDTH = Dimensions.get('window').width - 48;

function formatTime(ms) {
  if (!ms || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function SeekSlider({ position, duration, onSeek }) {
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPos, setSeekPos] = useState(0);
  const trackRef = useRef(null);
  const trackLayout = useRef({ x: 0, width: SLIDER_WIDTH });

  const progress = duration > 0 ? (isSeeking ? seekPos : position) / duration : 0;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        setIsSeeking(true);
        const x = e.nativeEvent.locationX;
        const ratio = Math.max(0, Math.min(1, x / trackLayout.current.width));
        setSeekPos(ratio * duration);
      },
      onPanResponderMove: (e, gestureState) => {
        const startX = e.nativeEvent.locationX;
        const ratio = Math.max(0, Math.min(1, startX / trackLayout.current.width));
        setSeekPos(ratio * duration);
      },
      onPanResponderRelease: () => {
        setIsSeeking(false);
        onSeek(seekPos);
      },
    })
  ).current;

  return (
    <View style={sliderStyles.container}>
      <View
        ref={trackRef}
        style={sliderStyles.track}
        onLayout={(e) => {
          trackLayout.current = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width };
        }}
        {...panResponder.panHandlers}
      >
        <View style={sliderStyles.trackBg} />
        <View style={[sliderStyles.trackFill, { width: `${Math.min(progress, 1) * 100}%` }]} />
        <View style={[sliderStyles.thumb, { left: `${Math.min(progress, 1) * 100}%` }]} />
      </View>
      <View style={sliderStyles.timeRow}>
        <Text style={sliderStyles.timeText}>{formatTime(isSeeking ? seekPos : position)}</Text>
        <Text style={sliderStyles.timeText}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  container: { marginTop: 16, marginBottom: 8 },
  track: { height: 40, justifyContent: 'center', position: 'relative' },
  trackBg: { height: 4, backgroundColor: '#374151', borderRadius: 2 },
  trackFill: { height: 4, backgroundColor: '#6366F1', borderRadius: 2, position: 'absolute', top: 18 },
  thumb: {
    position: 'absolute',
    top: 12,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#6366F1',
    marginLeft: -8,
  },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 0 },
  timeText: { fontSize: 12, color: '#9CA3AF' },
});

export default function FullPlayer() {
  const {
    currentTrack,
    isFullVisible,
    closePlayer,
    togglePlay,
    isPlaying,
    volume,
    setVolume,
    sleepTimerMinutes,
    startSleepTimer,
    cancelSleepTimer,
    playNext,
    playPrevious,
    canPlayNext,
    canPlayPrevious,
    positionMillis,
    durationMillis,
    seekTo,
    queue,
    currentIndex,
    shuffleQueue,
    repeatMode,
    toggleRepeat,
    playbackSpeed,
    cycleSpeed,
  } = usePlayer();
  const { t } = useTranslation();
  const [showSleepModal, setShowSleepModal] = useState(false);

  if (!currentTrack || !isFullVisible) return null;

  const embedUrl = currentTrack.embedUrl || `https://www.youtube.com/embed/${currentTrack.id}`;

  return (
    <Modal visible={isFullVisible} animationType="slide">
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeBtn} onPress={closePlayer} accessibilityLabel="Close player" accessibilityRole="button">
          <Text style={styles.closeText}>✕ {t('player.close')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{currentTrack.title}</Text>
        <Text style={styles.artist}>{currentTrack.artist}</Text>

        {/* Albüm kapağı */}
        {(currentTrack.thumbnail || currentTrack.cover_url) && (
          <Image
            source={{ uri: currentTrack.thumbnail || currentTrack.cover_url }}
            style={styles.albumArt}
            resizeMode="cover"
          />
        )}

        {queue.length > 1 && (
          <Text style={styles.queueInfo}>
            {t('player.trackOf', { current: currentIndex + 1, total: queue.length })}
          </Text>
        )}

        {/* Progress bar + seeking */}
        <SeekSlider position={positionMillis} duration={durationMillis} onSeek={seekTo} />

        {/* Playback controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            onPress={shuffleQueue}
            style={styles.controlBtn}
            disabled={queue.length <= 1}
            accessibilityLabel="Shuffle"
            accessibilityRole="button"
          >
            <Ionicons name="shuffle" size={24} color={queue.length > 1 ? '#9CA3AF' : '#374151'} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={playPrevious}
            style={styles.controlBtn}
            disabled={!canPlayPrevious}
            accessibilityLabel="Previous track"
            accessibilityRole="button"
          >
            <Ionicons name="play-skip-back" size={28} color={canPlayPrevious ? '#fff' : '#374151'} />
          </TouchableOpacity>

          <TouchableOpacity onPress={togglePlay} style={styles.playBtn} accessibilityLabel={isPlaying ? 'Pause' : 'Play'} accessibilityRole="button">
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={36} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={playNext}
            style={styles.controlBtn}
            disabled={!canPlayNext}
            accessibilityLabel="Next track"
            accessibilityRole="button"
          >
            <Ionicons name="play-skip-forward" size={28} color={canPlayNext ? '#fff' : '#374151'} />
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleRepeat} style={styles.repeatBtn} accessibilityLabel="Repeat" accessibilityRole="button">
            <Ionicons
              name={repeatMode === 'off' ? 'repeat-outline' : 'repeat'}
              size={24}
              color={repeatMode === 'off' ? '#9CA3AF' : '#8B5CF6'}
            />
            {repeatMode === 'one' && (
              <Text style={styles.repeatOneText}>1</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.extraControls}>
          <TouchableOpacity style={styles.speedBtn} onPress={cycleSpeed}>
            <Text style={[styles.speedText, playbackSpeed !== 1.0 && styles.speedActive]}>
              {playbackSpeed}x
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.eqBtn}
            onPress={() => { closePlayer(); setTimeout(() => navigate('Equalizer'), 300); }}
          >
            <Ionicons name="options" size={20} color="#9CA3AF" />
            <Text style={styles.eqText}>EQ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.eqBtn}
            onPress={() => {
              closePlayer();
              setTimeout(() => navigate('SongRadio', {
                trackId: currentTrack.id,
                trackTitle: currentTrack.title,
                trackArtist: currentTrack.artist,
                trackThumbnail: currentTrack.thumbnail,
              }), 300);
            }}
          >
            <Ionicons name="radio-outline" size={20} color="#9CA3AF" />
            <Text style={styles.eqText}>{t('player.radio', 'Radio')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.eqBtn}
            onPress={() => {
              closePlayer();
              setTimeout(() => navigate('Lyrics', {
                trackId: currentTrack.id,
                trackTitle: currentTrack.title,
                trackArtist: currentTrack.artist,
              }), 300);
            }}
          >
            <Ionicons name="document-text-outline" size={20} color="#9CA3AF" />
            <Text style={styles.eqText}>{t('player.lyrics', 'Sözler')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.volumeRow}>
          <TouchableOpacity onPress={() => setVolume(Math.max(0, (volume || 0) - 0.1))}>
            <Ionicons name="volume-mute" size={24} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.volBtn} onPress={() => setVolume(Math.max(0, (volume || 0) - 0.1))}>
            <Text style={styles.volBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.volumePct}>{Math.round((volume || 0) * 100)}%</Text>
          <TouchableOpacity style={styles.volBtn} onPress={() => setVolume(Math.min(1, (volume || 0) + 0.1))}>
            <Text style={styles.volBtnText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setVolume((volume || 0) >= 1 ? 0 : 1)}>
            <Ionicons name={(volume || 0) > 0 ? 'volume-high' : 'volume-mute'} size={24} color="#888" />
          </TouchableOpacity>
        </View>

        <View style={styles.sleepRow}>
          <Text style={styles.sleepLabel}>{t('player.sleepTimer')}</Text>
          {sleepTimerMinutes ? (
            <TouchableOpacity onPress={cancelSleepTimer}>
              <Text style={styles.sleepCancel}>{t('player.cancelTimer', { minutes: sleepTimerMinutes })}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.sleepBtns}>
              {SLEEP_OPTIONS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={styles.sleepBtn}
                  onPress={() => { startSleepTimer(m); setShowSleepModal(false); }}
                >
                  <Text style={styles.sleepBtnText}>{m}d</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <YouTubePlayerMobile />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0B', padding: 24, paddingTop: 48 },
  closeBtn: { alignSelf: 'flex-end', marginBottom: 16 },
  closeText: { color: '#8B5CF6', fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#fff' },
  artist: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
  albumArt: { width: '100%', height: 280, borderRadius: 16, marginTop: 16, marginBottom: 8, backgroundColor: '#1a1a1a' },
  queueInfo: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  controlBtn: { padding: 8 },
  repeatBtn: { padding: 8, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  repeatOneText: { position: 'absolute', bottom: 4, right: 2, fontSize: 9, fontWeight: '800', color: '#8B5CF6' },
  playBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24, marginBottom: 16 },
  speedBtn: { backgroundColor: '#1A1A2E', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  speedText: { color: '#9CA3AF', fontSize: 14, fontWeight: '700' },
  speedActive: { color: '#8B5CF6' },
  eqBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A2E', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, gap: 4 },
  eqText: { color: '#9CA3AF', fontSize: 14, fontWeight: '700' },
  volumeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  volBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center' },
  volBtnText: { color: '#fff', fontSize: 20, fontWeight: '600' },
  volumePct: { color: '#888', fontSize: 14, minWidth: 44, textAlign: 'center' },
  sleepRow: { marginBottom: 16 },
  sleepLabel: { color: '#888', fontSize: 12, marginBottom: 8 },
  sleepCancel: { color: '#8B5CF6', fontSize: 14 },
  sleepBtns: { flexDirection: 'row', gap: 8 },
  sleepBtn: { backgroundColor: '#374151', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  sleepBtnText: { color: '#fff', fontSize: 14 },
  webview: { flex: 1, marginTop: 8, backgroundColor: '#000', minHeight: 220 },
  linkBtn: { backgroundColor: '#8B5CF6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  linkText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
