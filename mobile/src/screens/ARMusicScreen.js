/**
 * ARMusicScreen - Immersive music visualizer (simulates AR-like experience)
 * Uses React Native animations for particles, equalizer bars, gradient background
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { usePlayer } from '../contexts/PlayerContext';

import * as Battery from 'expo-battery';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Dynamic performance configs
let EQ_BARS = 8;
let PARTICLES_COUNT = 20;

function EqualizerBar({ index, isPlaying, isLowPowerMode }) {
  const anim = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const min = 0.15;
    const max = 1;
    const duration = 200 + Math.random() * 300;

    const loop = () => {
      Animated.sequence([
        Animated.timing(anim, {
          toValue: isPlaying ? min + Math.random() * (max - min) : min,
          duration,
          useNativeDriver: false,
        }),
        Animated.timing(anim, {
          toValue: isPlaying ? min + Math.random() * (max - min) : min,
          duration,
          useNativeDriver: false,
        }),
      ]).start(({ finished }) => {
        if (finished) loop();
      });
    };
    if (isLowPowerMode) {
      anim.setValue(isPlaying ? 0.6 : 0.2); // Static height
    } else {
      loop();
    }
  }, [isPlaying, isLowPowerMode]);

  const height = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 80],
  });

  return <Animated.View style={[styles.eqBar, { height }]} />;
}

function FloatingParticle({ index, delay }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const duration = 3000 + Math.random() * 4000;
    const toX = (Math.random() - 0.5) * SCREEN_WIDTH * 0.6;
    const toY = (Math.random() - 0.5) * SCREEN_HEIGHT * 0.6;

    const anim = Animated.parallel([
      Animated.loop(
        Animated.sequence([
          Animated.timing(translateX, {
            toValue: toX,
            duration: duration / 2,
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: -toX * 0.5,
            duration: duration / 2,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(translateY, {
            toValue: toY,
            duration: duration * 0.7,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: -toY * 0.5,
            duration: duration * 0.7,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.7,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.3,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.3,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 0.8,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ),
    ]);

    const timer = setTimeout(() => anim.start(), delay);
    return () => {
      clearTimeout(timer);
      anim.stop();
    };
  }, []);

  const size = 8 + (index % 4) * 4;

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          transform: [{ translateX }, { translateY }, { scale }],
          opacity,
          left: SCREEN_WIDTH / 2 + (index % 5) * 40 - 80,
          top: SCREEN_HEIGHT / 2 + (index % 3) * 60 - 60,
        },
      ]}
    />
  );
}

function GradientBackground() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.2,
          duration: 4000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#050208' }]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: '#4C1D95',
            opacity,
          },
        ]}
      />
    </View>
  );
}

export default function ARMusicScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { currentTrack, isPlaying, togglePlay, playNext, playPrevious } = usePlayer();

  const [showInstructions, setShowInstructions] = useState(true);
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const rotationAcc = useRef(0);

  const [isLowPowerMode, setIsLowPowerMode] = useState(false);

  useEffect(() => {
    // Check if the device is in Low Power Mode
    let isMounted = true;
    (async () => {
      try {
        const powerMode = await Battery.isLowPowerModeEnabledAsync();
        if (isMounted && powerMode) setIsLowPowerMode(true);
      } catch (e) {
        // Battery module not linked or web
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const total = Math.max(-360, Math.min(360, rotationAcc.current + gestureState.dx * 0.5));
        rotationAnim.setValue(total);
      },
      onPanResponderRelease: (_, gestureState) => {
        rotationAcc.current = Math.max(-360, Math.min(360, rotationAcc.current + gestureState.dx * 0.5));
      },
    })
  ).current;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <GradientBackground />

      {/* Floating particles (Disabled in Low Power Mode for performance) */}
      {!isLowPowerMode && Array.from({ length: PARTICLES_COUNT }).map((_, i) => (
        <FloatingParticle key={i} index={i} delay={i * 200} />
      ))}

      {/* Visualizer area with gesture */}
      <View style={styles.visualizerArea} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.eqContainer,
            {
              transform: [
                {
                  rotate: rotationAnim.interpolate({
                    inputRange: [-360, 360],
                    outputRange: ['-360deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.eqBarsRow}>
            {Array.from({ length: EQ_BARS }).map((_, i) => (
              <EqualizerBar key={i} index={i} isPlaying={isPlaying} isLowPowerMode={isLowPowerMode} />
            ))}
          </View>
        </Animated.View>
      </View>

      {/* AR Mode label */}
      <View style={[styles.arLabel, { top: insets.top + 12 }]}>
        <View style={styles.arLabelDot} />
        <Text style={styles.arLabelText}>{t('arMusic.arMode', { defaultValue: 'AR Mode' })}</Text>
      </View>

      {/* Top controls */}
      <View style={[styles.topControls, { top: insets.top + 48 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => { }}
        >
          <Ionicons name="camera-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Track info overlay */}
      <View style={[styles.trackOverlay, { bottom: insets.bottom + 140 }]}>
        <Text style={styles.trackTitle} numberOfLines={1}>
          {currentTrack?.title || t('arMusic.noTrack', { defaultValue: 'No track' })}
        </Text>
        <Text style={styles.trackArtist} numberOfLines={1}>
          {currentTrack?.artist || ''}
        </Text>
      </View>

      {/* Playback controls */}
      <View style={[styles.controls, { bottom: insets.bottom + 80 }]}>
        <TouchableOpacity onPress={playPrevious} style={styles.controlBtn}>
          <Ionicons name="play-skip-back" size={32} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={togglePlay} style={styles.playBtn}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={40} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={playNext} style={styles.controlBtn}>
          <Ionicons name="play-skip-forward" size={32} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Exit AR button */}
      <TouchableOpacity
        style={[styles.exitBtn, { bottom: insets.bottom + 24 }]}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="exit-outline" size={20} color="#fff" />
        <Text style={styles.exitBtnText}>{t('arMusic.exitAR', { defaultValue: 'Exit AR' })}</Text>
      </TouchableOpacity>

      {/* Instructions overlay (first-time) */}
      {showInstructions && (
        <TouchableOpacity
          style={styles.instructionsOverlay}
          activeOpacity={1}
          onPress={() => setShowInstructions(false)}
        >
          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>{t('arMusic.instructionsTitle', { defaultValue: 'AR Music Experience' })}</Text>
            <Text style={styles.instructionsText}>
              {t('arMusic.instructionsText', {
                defaultValue: 'Swipe left or right to rotate the visualizer. Use the playback controls below. Tap the camera icon to toggle AR view (placeholder).',
              })}
            </Text>
            <Text style={styles.instructionsTap}>{t('arMusic.tapToDismiss', { defaultValue: 'Tap anywhere to dismiss' })}</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050208',
  },
  particle: {
    position: 'absolute',
    backgroundColor: '#8B5CF6',
  },
  visualizerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eqContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  eqBarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 80,
  },
  eqBar: {
    width: 8,
    borderRadius: 4,
    backgroundColor: '#8B5CF6',
  },
  arLabel: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  arLabelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  arLabelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  topControls: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackOverlay: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  trackTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  trackArtist: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  controlBtn: {
    padding: 12,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitBtn: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 24,
  },
  exitBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  instructionsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  instructionsCard: {
    backgroundColor: '#1F2937',
    borderRadius: 20,
    padding: 24,
    maxWidth: 320,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  instructionsText: {
    fontSize: 15,
    color: '#E5E7EB',
    lineHeight: 22,
    marginBottom: 16,
    textAlign: 'center',
  },
  instructionsTap: {
    fontSize: 13,
    color: '#8B5CF6',
    textAlign: 'center',
  },
});
