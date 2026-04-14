/**
 * MiniPlayer — NOVA Design System v3.0
 * Floating island player · 2025 premium aesthetic
 * Glassmorphism island player · Mobbin player patterns
 * Glassmorphism · Gradient play button · Glow progress
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Animated,
  Pressable, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePlayer } from '../../contexts/PlayerContext';
import { useTheme } from '../../contexts/ThemeContext';
import { isLiked, toggleLike, subscribe as likedSubscribe } from '../../lib/likedStore';
import AddToPlaylistModal from '../AddToPlaylistModal';

const { width: W } = Dimensions.get('window');

export default function MiniPlayer({ tabBarHeight = 64, onPress }) {
  const { colors } = useTheme();
  const player = usePlayer() || {};
  const {
    currentTrack,
    isPlaying,
    positionMillis = 0,
    durationMillis = 0,
    togglePlay,
    playNext,
    playPrevious,
    closePlayer,
  } = player;

  // Computed progress ratio 0–1
  const progress = durationMillis > 0 ? positionMillis / durationMillis : 0;

  const trackId = currentTrack?.id;
  const [liked, setLiked]           = useState(() => isLiked(trackId));
  const [addToPlaylist, setAddToPlaylist] = useState(false);

  useEffect(() => { setLiked(isLiked(trackId)); }, [trackId]);
  useEffect(() => likedSubscribe(() => setLiked(isLiked(trackId))), [trackId]);

  const handleLike = (e) => {
    e.stopPropagation?.();
    if (!currentTrack) return;
    toggleLike(currentTrack);
    setLiked(isLiked(currentTrack.id));
  };

  const slideAnim = useRef(new Animated.Value(100)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: currentTrack ? 0 : 100,
      useNativeDriver: true,
      damping: 18,
      stiffness: 200,
    }).start();
  }, [!!currentTrack]);

  useEffect(() => {
    if (isPlaying) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => { loop.stop(); pulseAnim.setValue(1); };
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isPlaying]);

  if (!currentTrack) return null;

  const s = createStyles(colors, tabBarHeight);

  return (
    <Animated.View style={[s.container, { transform: [{ translateY: slideAnim }] }]}>
      {/* Background — adapts per theme */}
      <LinearGradient
        colors={colors.miniPlayerBgGrad}
        style={StyleSheet.absoluteFill}
      />
      {/* Ambient glow */}
      <View style={[s.glow, { backgroundColor: colors.primaryDeep, opacity: 0.3 }]} />

      {/* Progress bar (top) */}
      <View style={s.progressTrack}>
        <Animated.View style={[s.progressFill, { width: `${(progress || 0) * 100}%` }]}>
          <LinearGradient colors={colors.gradPrimary} start={{ x:0,y:0 }} end={{ x:1,y:0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>

      <Pressable style={s.inner} onPress={onPress}>
        {/* Album art */}
        <Animated.View style={[s.artWrap, isPlaying && { transform: [{ scale: pulseAnim }] }]}>
          <Image
            source={{ uri: currentTrack?.thumbnail || `https://picsum.photos/seed/${currentTrack?.id}/80/80` }}
            style={s.art}
          />
        </Animated.View>

        {/* Track info */}
        <View style={s.info}>
          <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>
            {currentTrack?.title || 'Unknown Track'}
          </Text>
          <Text style={[s.artist, { color: colors.textMuted }]} numberOfLines={1}>
            {currentTrack?.artist || 'Unknown Artist'}
          </Text>
        </View>

        {/* Controls */}
        <View style={s.controls}>
          {/* Like */}
          <TouchableOpacity
            onPress={handleLike}
            style={s.ctrlBtn}
            hitSlop={{ top:10,bottom:10,left:10,right:10 }}
          >
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? '#FF2D55' : colors.textMuted} />
          </TouchableOpacity>

          {/* Add to playlist */}
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); setAddToPlaylist(true); }}
            style={s.ctrlBtn}
            hitSlop={{ top:10,bottom:10,left:10,right:10 }}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => playPrevious?.()}
            style={s.ctrlBtn}
            hitSlop={{ top:10,bottom:10,left:10,right:10 }}
          >
            <Ionicons name="play-skip-back" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Play / Pause */}
          <TouchableOpacity
            onPress={() => togglePlay?.()}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={colors.gradPrimary}
              start={{ x:0,y:0 }}
              end={{ x:1,y:1 }}
              style={s.playBtn}
            >
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => playNext?.()}
            style={s.ctrlBtn}
            hitSlop={{ top:10,bottom:10,left:10,right:10 }}
          >
            <Ionicons name="play-skip-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => closePlayer?.()}
            style={s.ctrlBtn}
            hitSlop={{ top:10,bottom:10,left:10,right:10 }}
          >
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </Pressable>
    </Animated.View>

    <AddToPlaylistModal
      visible={addToPlaylist}
      track={currentTrack}
      onClose={() => setAddToPlaylist(false)}
    />
  );
}

function createStyles(colors, tabBarHeight) {
  return StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: tabBarHeight,
      left: 8,
      right: 8,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.glassBorder,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 12,
    },
    glow: {
      position: 'absolute',
      top: -30,
      left: '20%',
      width: '60%',
      height: 60,
      borderRadius: 30,
    },
    progressTrack: {
      height: 2,
      backgroundColor: colors.borderLight,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      overflow: 'hidden',
    },
    inner: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 12,
    },
    artWrap: {
      borderRadius: 10,
      overflow: 'hidden',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    },
    art: {
      width: 42,
      height: 42,
      borderRadius: 10,
      backgroundColor: colors.surface,
    },
    info: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    artist: {
      fontSize: 12,
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    ctrlBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 10,
      elevation: 6,
    },
  });
}
