/**
 * FullPlayer — NOVA Design System v3.0
 * Immersive full-screen music player · 2025 premium experience
 * Inspired by: Apple Music 2025 · Spotify full player · Tidal · Mobbin players
 * Blurred album art backdrop · Waveform seek · Gesture dismiss · Lyrics preview
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Animated,
  PanResponder, Dimensions, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePlayer } from '../../contexts/PlayerContext';
import { useTheme } from '../../contexts/ThemeContext';
import { isLiked, toggleLike, subscribe as likedSubscribe } from '../../lib/likedStore';
import AddToPlaylistModal from '../AddToPlaylistModal';

const { width: W, height: H } = Dimensions.get('window');
const ARTWORK_SIZE = W - 64;

// ── Seek Slider ────────────────────────────────────────────────────────────────
function SeekSlider({ progress = 0, duration = 0, onSeek, colors }) {
  const trackRef    = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [localProg, setLocalProg] = useState(progress);
  const thumbAnim   = useRef(new Animated.Value(1)).current;

  const fmt = (sec) => {
    const s = Math.floor(sec || 0);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2,'0')}`;
  };

  const handleTouch = (evt) => {
    trackRef.current?.measure((x, y, width) => {
      const ratio = Math.max(0, Math.min(1, evt.nativeEvent.locationX / width));
      setLocalProg(ratio);
      onSeek?.(ratio * duration);
    });
  };

  return (
    <View style={sl.wrap}>
      {/* Track */}
      <TouchableOpacity
        ref={trackRef}
        style={sl.track}
        onPress={handleTouch}
        activeOpacity={1}
      >
        <View style={[sl.trackBg, { backgroundColor: colors.border }]}>
          <LinearGradient
            colors={colors.gradPrimary}
            start={{ x:0,y:0 }}
            end={{ x:1,y:0 }}
            style={[sl.fill, { width: `${(dragging ? localProg : progress) * 100}%` }]}
          />
          {/* Thumb */}
          <View style={[sl.thumb, {
            left: `${(dragging ? localProg : progress) * 100}%`,
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
          }]} />
        </View>
      </TouchableOpacity>
      {/* Time labels */}
      <View style={sl.labels}>
        <Text style={[sl.time, { color: colors.textMuted }]}>{fmt(progress * duration)}</Text>
        <Text style={[sl.time, { color: colors.textMuted }]}>{fmt(duration)}</Text>
      </View>
    </View>
  );
}

const sl = StyleSheet.create({
  wrap: { gap: 8 },
  track: { height: 20, justifyContent: 'center' },
  trackBg: { height: 4, borderRadius: 2, overflow: 'visible', position: 'relative' },
  fill: { height: '100%', borderRadius: 2 },
  thumb: {
    position: 'absolute',
    top: -6,
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    shadowOffset: { width:0,height:0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 6,
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontSize: 12, fontWeight: '500' },
});

// ── Extra Controls ─────────────────────────────────────────────────────────────
function ExtraButton({ icon, label, onPress, active, colors }) {
  return (
    <TouchableOpacity style={eb.wrap} onPress={onPress} activeOpacity={0.75}>
      <View style={[eb.iconBox, { backgroundColor: active ? colors.primaryGlow : colors.surface, borderColor: active ? colors.primary : colors.border }]}>
        <Ionicons name={icon} size={20} color={active ? colors.primary : colors.textSecondary} />
      </View>
      {label && <Text style={[eb.label, { color: colors.textMuted }]}>{label}</Text>}
    </TouchableOpacity>
  );
}
const eb = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6 },
  iconBox: { width:44, height:44, borderRadius:14, alignItems:'center', justifyContent:'center', borderWidth:1 },
  label: { fontSize:11, fontWeight:'500' },
});

// ── Main FullPlayer ────────────────────────────────────────────────────────────
export default function FullPlayer({ visible, onClose, navigation }) {
  const { colors } = useTheme();
  const insets     = useSafeAreaInsets();
  const player     = usePlayer() || {};
  const {
    currentTrack,
    isPlaying,
    positionMillis = 0,
    durationMillis = 0,
    togglePlay,
    playNext,
    playPrevious,
    seekTo,
    isShuffle,
    toggleShuffle,
    repeatMode,
    toggleRepeat,
  } = player;

  // Derived values
  const progress = durationMillis > 0 ? positionMillis / durationMillis : 0;
  const duration = durationMillis / 1000; // seconds for display
  const isRepeat = repeatMode !== 'off';

  const trackId = currentTrack?.id;
  const [liked, setLiked]           = useState(() => isLiked(trackId));
  const [addToPlaylist, setAddToPlaylist] = useState(false);

  // Sync liked state when track changes or external toggle happens
  useEffect(() => { setLiked(isLiked(trackId)); }, [trackId]);
  useEffect(() => likedSubscribe(() => setLiked(isLiked(trackId))), [trackId]);

  const handleLike = () => {
    if (!currentTrack) return;
    toggleLike(currentTrack);
    setLiked(isLiked(currentTrack.id));
  };

  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10 && g.dy > 0,
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) translateY.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80 || g.vy > 0.8) {
        Animated.timing(translateY, { toValue: H, duration: 250, useNativeDriver: true }).start(onClose);
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      }
    },
  })).current;

  React.useEffect(() => {
    if (visible) {
      translateY.setValue(0);
    }
  }, [visible]);

  if (!currentTrack) return null;

  const artwork = currentTrack?.thumbnail || `https://picsum.photos/seed/${currentTrack?.id}/600/600`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.root, { transform: [{ translateY }], backgroundColor: colors.background }]} {...panResponder.panHandlers}>

        {/* Blurred backdrop — always album art */}
        <Image source={{ uri: artwork }} style={styles.backdrop} blurRadius={40} />
        {/* Theme-aware overlay on top of blurred art */}
        <LinearGradient
          colors={[...colors.playerBgGrad, colors.playerBgGrad[1]]}
          style={StyleSheet.absoluteFill}
        />
        {/* Ambient glow — adapts per theme */}
        <View style={[styles.ambientGlow, { backgroundColor: colors.playerAmbient }]} />

        <View style={[styles.inner, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>

          {/* ── Top bar ── */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onClose} style={styles.chevronBtn} hitSlop={{ top:12,bottom:12,left:16,right:16 }}>
              <Ionicons name="chevron-down" size={28} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.topCenter}>
              <Text style={[styles.topLabel, { color: colors.textMuted }]}>NOW PLAYING</Text>
            </View>
            <TouchableOpacity style={styles.chevronBtn} hitSlop={{ top:12,bottom:12,left:16,right:16 }}>
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* ── Album Art ── */}
          <View style={[styles.artWrap, { shadowColor: colors.primary }]}>
            <Image source={{ uri: artwork }} style={[styles.artwork, { backgroundColor: colors.surface }]} />
            <View style={[styles.artShadow, { shadowColor: colors.primary }]} />
          </View>

          {/* ── Track Info ── */}
          <View style={styles.trackInfo}>
            <View style={styles.trackLeft}>
              <Text style={[styles.trackTitle, { color: colors.text }]} numberOfLines={1}>
                {currentTrack?.title || 'Unknown Track'}
              </Text>
              <Text style={[styles.trackArtist, { color: colors.textSecondary }]} numberOfLines={1}>
                {currentTrack?.artist || 'Unknown Artist'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <TouchableOpacity onPress={handleLike} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
                <Ionicons
                  name={liked ? 'heart' : 'heart-outline'}
                  size={26}
                  color={liked ? '#FF2D55' : colors.textMuted}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAddToPlaylist(true)} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
                <Ionicons name="add-circle-outline" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Seek Slider ── */}
          <SeekSlider
            progress={progress}
            duration={duration}
            onSeek={(secs) => seekTo?.(secs * 1000)}
            colors={colors}
          />

          {/* ── Main Controls ── */}
          <View style={styles.mainControls}>
            <TouchableOpacity onPress={() => toggleShuffle?.()} hitSlop={{ top:12,bottom:12,left:12,right:12 }}>
              <Ionicons name="shuffle" size={22} color={isShuffle ? colors.primary : colors.textMuted} />
            </TouchableOpacity>


            <TouchableOpacity onPress={() => playPrevious?.()} hitSlop={{ top:12,bottom:12,left:12,right:12 }}>
              <Ionicons name="play-skip-back" size={30} color={colors.text} />
            </TouchableOpacity>

            {/* Play / Pause */}
            <TouchableOpacity
              onPress={() => togglePlay?.()}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={colors.gradPrimary}
                start={{ x:0,y:0 }}
                end={{ x:1,y:1 }}
                style={styles.playBtn}
              >
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color="#FFF" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => playNext?.()} hitSlop={{ top:12,bottom:12,left:12,right:12 }}>
              <Ionicons name="play-skip-forward" size={30} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => toggleRepeat?.()} hitSlop={{ top:12,bottom:12,left:12,right:12 }}>
              <Ionicons name={repeatMode === 'one' ? 'repeat-outline' : 'repeat'} size={22} color={isRepeat ? colors.primary : colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* ── Extra Controls ── */}
          <View style={styles.extraControls}>
            <ExtraButton icon="list-outline"   label="Queue"   onPress={() => navigation?.navigate?.('Queue')} colors={colors} />
            <ExtraButton icon="mic-outline"    label="Lyrics"  onPress={() => navigation?.navigate?.('Lyrics')} colors={colors} />
            <ExtraButton icon="share-outline"  label="Share"   onPress={() => {}} colors={colors} />
            <ExtraButton icon="radio-outline"  label="Radio"   onPress={() => navigation?.navigate?.('SongRadio')} colors={colors} />
            <ExtraButton icon="download-outline" label="Save"  onPress={() => {}} colors={colors} />
          </View>

        </View>
      </Animated.View>

      <AddToPlaylistModal
        visible={addToPlaylist}
        track={currentTrack}
        onClose={() => setAddToPlaylist(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.5,
  },
  ambientGlow: {
    position: 'absolute',
    top: H * 0.1,
    left: W * 0.1,
    width: W * 0.8,
    height: W * 0.8,
    borderRadius: W * 0.4,
    opacity: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    gap: 24,
    justifyContent: 'space-between',
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chevronBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCenter: { flex: 1, alignItems: 'center' },
  topLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },

  artWrap: {
    alignItems: 'center',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 20,
  },
  artwork: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: 28,
  },
  artShadow: {
    position: 'absolute',
    bottom: -20,
    width: ARTWORK_SIZE * 0.8,
    height: 30,
    borderRadius: ARTWORK_SIZE * 0.4,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },

  trackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  trackLeft: { flex: 1, gap: 4 },
  trackTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  trackArtist: {
    fontSize: 16,
    fontWeight: '500',
  },

  mainControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors?.primary || '#A855F7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },

  extraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
});
