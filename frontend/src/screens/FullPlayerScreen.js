import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet, Dimensions,
  Animated, Modal, ScrollView, Share,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../contexts/PlayerContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const { width: SW, height: SH } = Dimensions.get('window');

function formatTime(ms) {
  if (!ms || ms < 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function WaveformAnimation({ isPlaying, colors }) {
  const bars = useRef(Array.from({ length: 32 }, () => new Animated.Value(4))).current;

  useEffect(() => {
    const anims = bars.map((bar, i) =>
      Animated.loop(Animated.sequence([
        Animated.timing(bar, { toValue: 8 + Math.random() * 24, duration: 300 + Math.random() * 400, useNativeDriver: false }),
        Animated.timing(bar, { toValue: 4 + Math.random() * 8, duration: 300 + Math.random() * 400, useNativeDriver: false }),
      ]))
    );
    if (isPlaying) anims.forEach(a => a.start());
    else { anims.forEach(a => a.stop()); bars.forEach(b => b.setValue(4)); }
    return () => anims.forEach(a => a.stop());
  }, [isPlaying]);

  return (
    <View style={styles.waveform}>
      {bars.map((bar, i) => (
        <Animated.View key={i} style={[styles.waveBar, {
          height: bar,
          backgroundColor: i < bars.length / 2 ? BRAND.primary : BRAND.accent,
          opacity: 0.6 + (i / bars.length) * 0.4,
        }]} />
      ))}
    </View>
  );
}

function SleepTimerModal({ visible, onClose, onSelect, currentMinutes }) {
  const { colors } = useTheme();
  const options = [0, 15, 30, 45, 60, 90, 120];
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Uyku Zamanlayıcı</Text>
          {options.map(m => (
            <TouchableOpacity key={m} style={[styles.modalRow, { borderBottomColor: colors.border }]} onPress={() => { onSelect(m); onClose(); }}>
              <Text style={{ color: currentMinutes === m ? BRAND.primary : colors.text, fontSize: 15 }}>
                {m === 0 ? 'Kapalı' : `${m} dakika`}
              </Text>
              {currentMinutes === m && <Ionicons name="checkmark" size={20} color={BRAND.primary} />}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.modalClose} onPress={onClose}>
            <Text style={{ color: colors.textMuted, fontSize: 15 }}>İptal</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function QualityModal({ visible, onClose, onSelect, current }) {
  const { colors } = useTheme();
  const opts = [
    { id: 'low', label: 'Düşük', desc: '64 kbps' },
    { id: 'normal', label: 'Normal', desc: '128 kbps' },
    { id: 'high', label: 'Yüksek', desc: '256 kbps' },
    { id: 'auto', label: 'Otomatik', desc: 'Bağlantıya göre' },
  ];
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Ses Kalitesi</Text>
          {opts.map(o => (
            <TouchableOpacity key={o.id} style={[styles.modalRow, { borderBottomColor: colors.border }]} onPress={() => { onSelect(o.id); onClose(); }}>
              <View>
                <Text style={{ color: current === o.id ? BRAND.primary : colors.text, fontSize: 15 }}>{o.label}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{o.desc}</Text>
              </View>
              {current === o.id && <Ionicons name="checkmark" size={20} color={BRAND.primary} />}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.modalClose} onPress={onClose}>
            <Text style={{ color: colors.textMuted, fontSize: 15 }}>İptal</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function FullPlayerScreen({ navigation }) {
  const {
    currentTrack, isPlaying, togglePlay, skipNext, skipPrev, seekTo,
    positionMillis, durationMillis, repeatMode, cycleRepeatMode,
    shuffleMode, toggleShuffle, volume, setVolume,
    audioQuality, setAudioQuality, crossfadeEnabled, toggleCrossfade,
    sleepTimerMinutes, setSleepTimer, addToQueue, queue,
  } = usePlayer();
  const { token } = useAuth();
  const { colors } = useTheme();
  const [liked, setLiked] = useState(false);
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  const handleLike = async () => {
    if (!currentTrack) return;
    setLiked(!liked);
    try { await api.post('/library/tracks/like', { track_id: currentTrack.id }, token); } catch {}
  };

  const handleShare = async () => {
    if (!currentTrack) return;
    try { await Share.share({ message: `${currentTrack.title} - ${currentTrack.artist}\n${currentTrack.youtubeUrl || ''}` }); } catch {}
  };

  const repeatIcon = repeatMode === 'one' ? 'repeat' : 'repeat';
  const repeatColor = repeatMode === 'off' ? colors.textMuted : BRAND.primary;

  if (!currentTrack) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="chevron-down" size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={{ color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Şimdi Çalıyor</Text>
        </View>
        <TouchableOpacity onPress={() => setShowMore(true)} style={styles.headerBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Album Art */}
        <View style={styles.artWrap}>
          <View style={[styles.artShadow, { shadowColor: BRAND.primary }]}>
            {currentTrack.thumbnail ? (
              <Image source={{ uri: currentTrack.thumbnail }} style={styles.art} />
            ) : (
              <View style={[styles.art, { backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="musical-notes" size={80} color={BRAND.primaryLight} />
              </View>
            )}
          </View>
        </View>

        {/* Waveform */}
        <WaveformAnimation isPlaying={isPlaying} colors={colors} />

        {/* Track Info */}
        <View style={styles.trackInfo}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.trackTitle, { color: colors.text }]} numberOfLines={1}>{currentTrack.title}</Text>
            <Text style={[styles.trackArtist, { color: colors.textMuted }]} numberOfLines={1}>{currentTrack.artist}</Text>
          </View>
          <TouchableOpacity onPress={handleLike}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={24} color={liked ? BRAND.pink : colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Seek Bar */}
        <View style={styles.seekSection}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={durationMillis || 1}
            value={isSeeking ? seekValue : positionMillis}
            onSlidingStart={(v) => { setIsSeeking(true); setSeekValue(v); }}
            onValueChange={(v) => setSeekValue(v)}
            onSlidingComplete={(v) => { setIsSeeking(false); seekTo(v); }}
            minimumTrackTintColor={BRAND.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={BRAND.primary}
          />
          <View style={styles.timeRow}>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>{formatTime(isSeeking ? seekValue : positionMillis)}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>{formatTime(durationMillis)}</Text>
          </View>
        </View>

        {/* Main Controls */}
        <View style={styles.controls}>
          <TouchableOpacity onPress={toggleShuffle}>
            <Ionicons name="shuffle" size={22} color={shuffleMode ? BRAND.accent : colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={skipPrev} style={styles.skipBtn}>
            <Ionicons name="play-skip-back" size={28} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={togglePlay} style={styles.playBtn}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={skipNext} style={styles.skipBtn}>
            <Ionicons name="play-skip-forward" size={28} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={cycleRepeatMode}>
            <Ionicons name={repeatIcon} size={22} color={repeatColor} />
            {repeatMode === 'one' && <View style={styles.repeatOneBadge}><Text style={styles.repeatOneText}>1</Text></View>}
          </TouchableOpacity>
        </View>

        {/* Volume */}
        <View style={styles.volumeRow}>
          <Ionicons name="volume-low" size={18} color={colors.textMuted} />
          <Slider
            style={styles.volumeSlider}
            minimumValue={0}
            maximumValue={1}
            value={volume}
            onValueChange={setVolume}
            minimumTrackTintColor={BRAND.primaryLight}
            maximumTrackTintColor={colors.border}
            thumbTintColor={BRAND.primary}
          />
          <Ionicons name="volume-high" size={18} color={colors.textMuted} />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Lyrics')}>
            <Ionicons name="text" size={20} color={colors.textSecondary} />
            <Text style={[styles.actionLabel, { color: colors.textMuted }]}>Sözler</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Queue')}>
            <Ionicons name="list" size={20} color={colors.textSecondary} />
            <Text style={[styles.actionLabel, { color: colors.textMuted }]}>Sıra ({queue.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowSleepTimer(true)}>
            <Ionicons name="moon" size={20} color={sleepTimerMinutes > 0 ? BRAND.accent : colors.textSecondary} />
            <Text style={[styles.actionLabel, { color: sleepTimerMinutes > 0 ? BRAND.accent : colors.textMuted }]}>
              {sleepTimerMinutes > 0 ? `${sleepTimerMinutes}dk` : 'Uyku'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowQuality(true)}>
            <Ionicons name="settings" size={20} color={colors.textSecondary} />
            <Text style={[styles.actionLabel, { color: colors.textMuted }]}>Kalite</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
            <Ionicons name="share-social" size={20} color={colors.textSecondary} />
            <Text style={[styles.actionLabel, { color: colors.textMuted }]}>Paylaş</Text>
          </TouchableOpacity>
        </View>

        {/* Extra Info */}
        <View style={styles.extraRow}>
          <TouchableOpacity style={[styles.extraChip, { backgroundColor: colors.surfaceElevated }]} onPress={toggleCrossfade}>
            <Ionicons name="git-merge" size={14} color={crossfadeEnabled ? BRAND.accent : colors.textMuted} />
            <Text style={{ color: crossfadeEnabled ? BRAND.accent : colors.textMuted, fontSize: 11 }}>Crossfade</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.extraChip, { backgroundColor: colors.surfaceElevated }]} onPress={() => navigation.navigate('Equalizer')}>
            <Ionicons name="options" size={14} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Ekolayzır</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <SleepTimerModal visible={showSleepTimer} onClose={() => setShowSleepTimer(false)} onSelect={setSleepTimer} currentMinutes={sleepTimerMinutes} />
      <QualityModal visible={showQuality} onClose={() => setShowQuality(false)} onSelect={setAudioQuality} current={audioQuality} />

      {/* More Options */}
      <Modal visible={showMore} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Seçenekler</Text>
            {[
              { icon: 'add-circle-outline', label: 'Kuyruğa Ekle', action: () => { if (currentTrack) addToQueue(currentTrack); setShowMore(false); } },
              { icon: 'musical-notes-outline', label: 'Çalma Listesine Ekle', action: () => { setShowMore(false); navigation.navigate('PlaylistAddTrack', { track: currentTrack }); } },
              { icon: 'person-outline', label: 'Sanatçıya Git', action: () => setShowMore(false) },
              { icon: 'share-social-outline', label: 'Paylaş', action: () => { handleShare(); setShowMore(false); } },
            ].map((item, i) => (
              <TouchableOpacity key={i} style={[styles.modalRow, { borderBottomColor: colors.border }]} onPress={item.action}>
                <Ionicons name={item.icon} size={20} color={colors.text} style={{ marginRight: 12 }} />
                <Text style={{ color: colors.text, fontSize: 15 }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowMore(false)}>
              <Text style={{ color: colors.textMuted, fontSize: 15 }}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 8 },
  headerBtn: { padding: 4 },
  headerCenter: { alignItems: 'center' },
  scrollContent: { alignItems: 'center', paddingBottom: 40 },

  artWrap: { marginTop: 16, marginBottom: 16 },
  artShadow: { shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 12 },
  art: { width: SW - 80, height: SW - 80, borderRadius: 20, overflow: 'hidden' },

  waveform: { flexDirection: 'row', alignItems: 'flex-end', height: 32, width: SW - 80, gap: 2, marginBottom: 20 },
  waveBar: { flex: 1, borderRadius: 1.5, minHeight: 2 },

  trackInfo: { flexDirection: 'row', alignItems: 'center', width: SW - 64, marginBottom: 16 },
  trackTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  trackArtist: { fontSize: 14, marginTop: 3 },

  seekSection: { width: SW - 64, marginBottom: 8 },
  slider: { width: '100%', height: 28 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },

  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, marginBottom: 24 },
  skipBtn: { padding: 4 },
  playBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: BRAND.primary, justifyContent: 'center', alignItems: 'center', shadowColor: BRAND.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  repeatOneBadge: { position: 'absolute', top: -4, right: -6, backgroundColor: BRAND.primary, width: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
  repeatOneText: { color: '#FFF', fontSize: 8, fontWeight: '800' },

  volumeRow: { flexDirection: 'row', alignItems: 'center', width: SW - 64, gap: 8, marginBottom: 24 },
  volumeSlider: { flex: 1, height: 24 },

  actionRow: { flexDirection: 'row', justifyContent: 'space-around', width: SW - 32, marginBottom: 20 },
  actionBtn: { alignItems: 'center', gap: 4 },
  actionLabel: { fontSize: 10 },

  extraRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  extraChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, gap: 6 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 0.5 },
  modalClose: { alignItems: 'center', paddingTop: 16 },
});
