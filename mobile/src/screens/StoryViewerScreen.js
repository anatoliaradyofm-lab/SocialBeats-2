/**
 * StoryViewerScreen — Instagram Story Clone
 *
 * ✅ Tam ekran gösterim
 * ✅ Çoklu hikaye ilerleme çubukları
 * ✅ Parmak basılı tutunca durdur (hold-to-pause)
 * ✅ Sol/sağ dokunarak önceki/sonraki
 * ✅ Aşağı kaydırarak kapat
 * ✅ Sesi kapat / Duraklat
 * ✅ Tepki gönder + yanıt
 * ✅ Görüntüleyenler (kendi hikaye)
 * ✅ Hikaye paylaş (başkalarının)
 * ✅ Hikaye sil (kendi)
 * ✅ Şikayet et / Sessize al (başkalarının)
 * ✅ Sticker katmanları: konum, etiket, müzik, bağlantı
 * ✅ Anket oy & sonuç
 * ✅ Geri sayım
 * ✅ Video oynatma
 * ✅ Reklam arası
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, Dimensions,
  PanResponder, TextInput, ActivityIndicator, Animated, Platform,
  I18nManager, Modal, FlatList, Alert, Share,
} from 'react-native';
import { Video } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';
import { getApiUrl } from '../services/api';
import InterstitialAdSlot from '../components/ads/InterstitialAdSlot';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const { width: SW, height: SH } = Dimensions.get('window');

const REACTIONS = [
  { type: 'heart', emoji: '❤️' },
  { type: 'fire',  emoji: '🔥' },
  { type: 'laugh', emoji: '😂' },
  { type: 'wow',   emoji: '😮' },
  { type: 'sad',   emoji: '😢' },
  { type: 'clap',  emoji: '👏' },
];

const STORY_DURATION_PHOTO = 7000;  // 7 saniye (Instagram: ~5-7s)
const STORY_DURATION_VIDEO = 15000; // fallback
const HOLD_PAUSE_DELAY     = 120;   // ms basılı tutunca duraklat

const resolveUri = (uri) => {
  if (!uri) return null;
  if (uri.startsWith('http')) return uri;
  const base = (getApiUrl() || '').replace(/\/api\/?$/, '');
  return uri.startsWith('/') ? `${base}${uri}` : `${base}/api/${uri}`;
};

const formatTime = (ms) => {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}sn önce`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}dk önce`;
  const h = Math.floor(m / 60);
  return `${h}sa önce`;
};

// ─── Geri Sayım Overlay ───────────────────────────────────────────────────────

function CountdownOverlay({ endTime, title }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const tick = () => {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) { setRemaining('Bitti'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);
  return (
    <View style={st.countdownBox}>
      {title ? <Text style={st.countdownTitle}>{title}</Text> : null}
      <Text style={st.countdownTime}>{remaining}</Text>
      <Text style={st.countdownLabel}>kaldı</Text>
    </View>
  );
}

// ─── Anket Overlay ────────────────────────────────────────────────────────────

function PollOverlay({ story, token, isOwn }) {
  const [voted, setVoted]   = useState(null);
  const [options, setOptions] = useState(story.poll_options || []);

  const vote = async (optId, optIdx) => {
    if (voted || !token || isOwn) return;
    setVoted(optId ?? optIdx);
    try {
      await api.post(`/stories/${story.id}/poll/vote`, { option_id: optId, option_index: optIdx }, token);
      const res = await api.get(`/stories/${story.id}/poll/results`, token);
      if (res?.options) setOptions(res.options);
    } catch {}
  };

  const total = options.reduce((s, o) => s + (o.votes || 0), 0);
  return (
    <View style={st.pollBox}>
      <Text style={st.pollQ}>{story.poll_question}</Text>
      {options.map((opt, i) => {
        const pct = total > 0 ? ((opt.votes || 0) / total) * 100 : 0;
        const isVoted = voted === (opt.id ?? i);
        return (
          <TouchableOpacity
            key={opt.id ?? i}
            style={[st.pollOpt, isVoted && st.pollOptVoted]}
            onPress={() => vote(opt.id, i)}
            disabled={!!voted || isOwn}
            activeOpacity={0.8}
          >
            {voted && <View style={[st.pollOptBar, { width: `${pct}%` }]} />}
            <Text style={st.pollOptText}>{opt.text}</Text>
            {voted ? <Text style={st.pollOptPct}>{pct.toFixed(0)}%</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Ana Ekran ────────────────────────────────────────────────────────────────

export default function StoryViewerScreen({ route, navigation }) {
  const { t }      = useTranslation();
  const { colors } = useTheme();
  const insets     = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { feed, startUserIndex = 0, startStoryIndex = 0 } = route.params || {};

  // ── Temel state ──
  const [userIdx,   setUserIdx]   = useState(startUserIndex);
  const [storyIdx,  setStoryIdx]  = useState(startStoryIndex);
  const [paused,    setPaused]    = useState(false);
  const [muted,     setMuted]     = useState(false);
  const [progress,  setProgress]  = useState(0);

  // ── UI state ──
  const [replyText,     setReplyText]     = useState('');
  const [sendingReply,  setSendingReply]  = useState(false);
  const [sentReaction,  setSentReaction]  = useState(null);
  const [showAd,        setShowAd]        = useState(false);
  const [showOptions,   setShowOptions]   = useState(false);
  const [showViewers,   setShowViewers]   = useState(false);
  const [viewers,       setViewers]       = useState([]);
  const [viewersLoading,setViewersLoading]= useState(false);
  const [replyFocused,  setReplyFocused]  = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  // ── Animasyonlar & ref'ler ──
  const slideAnim    = useRef(new Animated.Value(0)).current;
  const reactionAnim = useRef(new Animated.Value(0)).current;
  const progressRef  = useRef(null);
  const elapsedRef   = useRef(0);
  const seenCount    = useRef(0);
  const pendingNext  = useRef(null);
  const pressTimer   = useRef(null);   // hold-to-pause timer
  const holdPaused   = useRef(false);  // hold-to-pause durumu

  // ── Türetilmiş değerler ──
  const userGroup = feed?.[userIdx];
  const stories   = userGroup?.stories || [];
  const story     = stories[storyIdx];
  const isOwn     = story?.user_id === user?.id || userGroup?.user_id === user?.id;
  const mediaUrl  = story?.media_url || story?.media?.url;
  const bgColor   = story?.background_color || '#8B5CF6';
  const storyAge  = story?.created_at ? Date.now() - new Date(story.created_at).getTime() : null;

  // ── Görüntüleme kaydı ──
  useEffect(() => {
    if (!story || !token || isOwn) return;
    api.post(`/stories/${story.id}/view`, {}, token).catch(() => {});
  }, [story?.id]);

  // ── İlerleme çubuğu ──
  useEffect(() => {
    clearInterval(progressRef.current);
    elapsedRef.current = 0;
    setProgress(0);
    if (!story || paused || replyFocused) return;
    const duration = story.story_type === 'video'
      ? (story.duration ? story.duration * 1000 : STORY_DURATION_VIDEO)
      : STORY_DURATION_PHOTO;
    progressRef.current = setInterval(() => {
      elapsedRef.current += 100;
      setProgress(Math.min(1, elapsedRef.current / duration));
      if (elapsedRef.current >= duration) {
        clearInterval(progressRef.current);
        goNext();
      }
    }, 100);
    return () => clearInterval(progressRef.current);
  }, [story?.id, paused, replyFocused]);

  // ── Navigasyon ──
  const doGoNext = useCallback(() => {
    if (storyIdx < stories.length - 1) {
      setStoryIdx(i => i + 1);
    } else if (userIdx < (feed?.length ?? 0) - 1) {
      setUserIdx(i => i + 1);
      setStoryIdx(0);
    } else {
      Animated.timing(slideAnim, { toValue: SH, duration: 200, useNativeDriver: true }).start(() => navigation.goBack());
    }
  }, [storyIdx, stories.length, userIdx, feed?.length]);

  const goNext = useCallback(() => {
    seenCount.current += 1;
    if (seenCount.current % 8 === 0) {
      setShowAd(true);
      pendingNext.current = doGoNext;
    } else {
      doGoNext();
    }
  }, [doGoNext]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx(i => i - 1);
    } else if (userIdx > 0) {
      const prev = feed[userIdx - 1];
      setUserIdx(i => i - 1);
      setStoryIdx(Math.max(0, (prev?.stories?.length ?? 1) - 1));
    } else {
      navigation.goBack();
    }
  }, [storyIdx, userIdx, feed]);

  // ── PanResponder (aşağı kaydır kapat + hold-to-pause + sol/sağ tap) ──
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dy) > 8 || Math.abs(g.dx) > 8,

      onPanResponderGrant: () => {
        // Hold-to-pause: 120ms basılı tutunca duraklat
        pressTimer.current = setTimeout(() => {
          holdPaused.current = true;
          setPaused(true);
        }, HOLD_PAUSE_DELAY);
      },

      onPanResponderMove: (_, g) => {
        if (g.dy > 0) slideAnim.setValue(g.dy);
      },

      onPanResponderRelease: (evt, g) => {
        clearTimeout(pressTimer.current);

        // Hold-to-pause: parmak kaldırıldı → devam et
        if (holdPaused.current) {
          holdPaused.current = false;
          setPaused(false);
        }

        if (g.dy > 80) {
          // Aşağı kaydır → kapat
          Animated.timing(slideAnim, { toValue: SH, duration: 250, useNativeDriver: true })
            .start(() => navigation.goBack());
          return;
        }

        // Geri yay
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();

        // Dokunma (hareket yoksa)
        if (Math.abs(g.dy) < 15 && Math.abs(g.dx) < 15) {
          if (evt.nativeEvent.locationX < SW / 3) {
            goPrev();
          } else if (evt.nativeEvent.locationX > (SW * 2) / 3) {
            goNext();
          }
          // Ortaya dokunma: toggle pause (isteğe bağlı)
        }
      },
    })
  ).current;

  // ── Tepki gönder ──
  const sendReaction = useCallback(async (type) => {
    if (!story?.id || !token) return;
    setSentReaction(type);
    reactionAnim.setValue(0);
    Animated.sequence([
      Animated.spring(reactionAnim, { toValue: 1, useNativeDriver: true, friction: 3 }),
      Animated.timing(reactionAnim, { toValue: 0, delay: 600, duration: 400, useNativeDriver: true }),
    ]).start(() => setSentReaction(null));
    try { await api.post(`/stories/${story.id}/react`, { reaction: type }, token); } catch {}
  }, [story?.id, token]);

  // ── Yanıt gönder ──
  const sendReply = async () => {
    if (!replyText.trim() || !story?.id || !token) return;
    setSendingReply(true);
    try {
      await api.post(`/stories/${story.id}/reply`, { content: replyText.trim(), reply_type: 'TEXT' }, token);
      setReplyText('');
      setReplyFocused(false);
    } catch {}
    setSendingReply(false);
  };

  // ── Görüntüleyenler ──
  const openViewers = useCallback(async () => {
    setShowViewers(true);
    setViewersLoading(true);
    try {
      const res = await api.get(`/stories/${story.id}/viewers`, token);
      setViewers(Array.isArray(res) ? res : (res?.viewers || []));
    } catch { setViewers([]); }
    setViewersLoading(false);
  }, [story?.id, token]);

  // ── Paylaş (harici) ──
  const shareStory = async () => {
    setShowOptions(false);
    try {
      await Share.share({
        message: `${userGroup?.user_display_name || userGroup?.username} kişisinin hikayesine bak! — SocialBeats`,
        url: mediaUrl || undefined,
      });
    } catch {}
  };

  // ── Şikayet et ──
  const reportStory = async () => {
    setShowOptions(false);
    try {
      await api.post(`/stories/${story.id}/report`, { reason: 'inappropriate' }, token);
      Alert.alert(t('common.success'), 'Hikaye şikayet edildi.');
    } catch {
      Alert.alert(t('common.error'), 'Bir hata oluştu.');
    }
  };

  // ── Hikaye sil ──
  const deleteStory = () => {
    setShowOptions(false);
    Alert.alert(
      'Hikayeyi Sil',
      'Bu hikaye kalıcı olarak silinecek. Emin misin?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil', style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await api.delete(`/stories/${story.id}`, token);
              if (stories.length > 1) {
                doGoNext();
              } else {
                navigation.goBack();
              }
            } catch {
              Alert.alert(t('common.error'), 'Silinemedi.');
            }
            setDeleting(false);
          },
        },
      ]
    );
  };

  // ── Boş durum ──
  if (!feed?.length || !story) {
    return (
      <View style={[st.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }]}>
        <TouchableOpacity style={st.closeBtnAbs} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={{ color: '#fff', fontSize: 16 }}>Hikaye bulunamadı</Text>
      </View>
    );
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <Animated.View
      style={[st.container, { transform: [{ translateY: slideAnim }] }]}
    >
      {/* ── Arka plan ── */}
      {mediaUrl ? (
        story.story_type === 'video' ? (
          <Video
            source={{ uri: resolveUri(mediaUrl) }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            shouldPlay={!paused}
            isMuted={muted}
            isLooping={false}
            onPlaybackStatusUpdate={(s) => { if (s.didJustFinish) goNext(); }}
          />
        ) : (
          <Image source={{ uri: resolveUri(mediaUrl) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        )
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]}>
          {story.text ? (
            <View style={st.textStoryCenter}>
              <Text style={st.textStoryContent} selectable={false}>{story.text}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Filtre tinti */}
      {story.filter && story.filter !== 'normal' && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: getFilterTint(story.filter) }]} pointerEvents="none" />
      )}

      {/* Karartma gradyanı (üst & alt) */}
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'transparent', 'transparent', 'rgba(0,0,0,0.45)']}
        locations={[0, 0.25, 0.65, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ── Dokunma alanı (hold-to-pause + swipe) ── */}
      <View
        style={st.touchZone}
        {...panResponder.panHandlers}
      />

      {/* ── İlerleme çubukları ── */}
      <View style={[st.progressRow, { paddingTop: insets.top + 8 }]}>
        {stories.map((_, i) => (
          <View key={i} style={st.progressTrack}>
            <View style={[
              st.progressFill,
              {
                width: i < storyIdx ? '100%' : i === storyIdx ? `${progress * 100}%` : '0%',
                backgroundColor: i < storyIdx ? 'rgba(255,255,255,0.9)' : colors.primary,
              },
            ]} />
          </View>
        ))}
      </View>

      {/* ── Üst başlık ── */}
      <View style={st.header}>
        {/* Avatar + isim */}
        <TouchableOpacity
          style={st.headerUser}
          onPress={() => navigation.navigate('UserProfile', { username: userGroup?.username })}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: userGroup?.user_avatar || `https://i.pravatar.cc/80?u=${userGroup?.username}` }}
            style={st.headerAvatar}
          />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={st.headerName} selectable={false} numberOfLines={1}>
              {userGroup?.user_display_name || userGroup?.username}
            </Text>
            {storyAge !== null && (
              <Text style={st.headerTime} selectable={false}>{formatTime(storyAge)}</Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Sağ kontroller */}
        <View style={st.headerRight}>
          <TouchableOpacity style={st.headerBtn} onPress={() => setPaused(p => !p)}>
            <Ionicons name={paused ? 'play' : 'pause'} size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={st.headerBtn} onPress={() => setMuted(m => !m)}>
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={st.headerBtn} onPress={() => setShowOptions(true)}>
            <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Kapat */}
        <TouchableOpacity style={st.closeBtn} onPress={() => navigation.goBack()} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Sticker katmanları ── */}
      {story.location_name && (
        <View style={st.stickerTopLeft}>
          <Ionicons name="location" size={13} color="#fff" />
          <Text style={st.stickerText} selectable={false}>{story.location_name}</Text>
        </View>
      )}
      {story.mention_username && (
        <View style={st.stickerCenter}>
          <Text style={st.stickerText} selectable={false}>@{story.mention_username}</Text>
        </View>
      )}
      {story.link_url && (
        <View style={st.stickerLink}>
          <Ionicons name="link" size={13} color="#fff" />
          <Text style={st.stickerText} numberOfLines={1} selectable={false}>{story.link_url}</Text>
        </View>
      )}
      {story.music_track_id && (
        <View style={st.musicBar}>
          <Ionicons name="musical-notes" size={15} color="#fff" />
          <Text style={st.musicBarText} numberOfLines={1} selectable={false}>
            {story.music_title || story.music_track_id}
          </Text>
        </View>
      )}
      {story.countdown_end && (
        <CountdownOverlay endTime={story.countdown_end} title={story.countdown_title} />
      )}
      {story.poll_question && story.poll_options?.length > 0 && (
        <PollOverlay story={story} token={token} isOwn={isOwn} />
      )}

      {/* ── Yakın arkadaşlar rozeti ── */}
      {story.audience === 'close_friends' && (
        <View style={st.closeFriendsBadge}>
          <Ionicons name="star" size={12} color="#fff" />
          <Text style={st.closeFriendsBadgeText} selectable={false}>Yakın Arkadaşlar</Text>
        </View>
      )}

      {/* ── Reklam arası ── */}
      {showAd && (
        <InterstitialAdSlot placement="story" onClose={() => {
          setShowAd(false);
          const fn = pendingNext.current;
          pendingNext.current = null;
          fn?.();
        }} />
      )}

      {/* ── Alt alan ── */}
      <View style={[st.bottom, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
        {isOwn ? (
          /* ── Kendi hikayem: görüntüleyenler ── */
          <TouchableOpacity style={st.viewersBar} onPress={openViewers} activeOpacity={0.8}>
            <Ionicons name="eye-outline" size={20} color="#fff" />
            <Text style={st.viewersBarText} selectable={false}>Görüntüleyenler</Text>
            <Ionicons name="chevron-up" size={16} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        ) : (
          /* ── Başkasının hikayesi: tepki + yanıt ── */
          <>
            {/* Tepkiler */}
            {!replyFocused && (
              <View style={st.reactionRow}>
                {REACTIONS.map(r => (
                  <TouchableOpacity key={r.type} style={st.reactionBtn} onPress={() => sendReaction(r.type)}>
                    <Text style={st.reactionEmoji}>{r.emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Uçan tepki animasyonu */}
            {sentReaction && (
              <Animated.View pointerEvents="none" style={[st.reactionFly, {
                opacity: reactionAnim,
                transform: [
                  { scale: reactionAnim.interpolate({ inputRange: [0,1], outputRange: [0.4,1.6] }) },
                  { translateY: reactionAnim.interpolate({ inputRange: [0,1], outputRange: [0,-80] }) },
                ],
              }]}>
                <Text style={{ fontSize: 52 }}>
                  {REACTIONS.find(r => r.type === sentReaction)?.emoji}
                </Text>
              </Animated.View>
            )}

            {/* Yanıt satırı */}
            <View style={st.replyRow}>
              <TextInput
                style={st.replyInput}
                placeholder={`${userGroup?.user_display_name || userGroup?.username} kişisine yanıt ver...`}
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={replyText}
                onChangeText={setReplyText}
                onFocus={() => setReplyFocused(true)}
                onBlur={() => setReplyFocused(false)}
                onSubmitEditing={sendReply}
                returnKeyType="send"
                selectionColor="rgba(255,255,255,0.7)"
              />
              <TouchableOpacity
                style={[st.shareStoryBtn]}
                onPress={shareStory}
                hitSlop={{ top:8,bottom:8,left:8,right:8 }}
              >
                <Ionicons name="paper-plane-outline" size={22} color="#fff" />
              </TouchableOpacity>
              {replyText.trim() ? (
                <TouchableOpacity
                  style={st.sendBtn}
                  onPress={sendReply}
                  disabled={sendingReply}
                >
                  {sendingReply
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="send" size={20} color="#fff" />}
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        )}
      </View>

      {/* ── Seçenekler Modalı (kendi hikaye) ── */}
      <Modal transparent visible={showOptions && isOwn} animationType="slide" onRequestClose={() => setShowOptions(false)}>
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => setShowOptions(false)}>
          <View style={[st.optPanel, { paddingBottom: insets.bottom + 16 }]}>
            <View style={st.optHandle} />

            <TouchableOpacity style={st.optRow} onPress={() => {
              setShowOptions(false);
              openViewers();
            }}>
              <Ionicons name="eye-outline" size={22} color="#fff" />
              <Text style={st.optText}>Görüntüleyenler</Text>
            </TouchableOpacity>

            <TouchableOpacity style={st.optRow} onPress={() => {
              setShowOptions(false);
              shareStory();
            }}>
              <Ionicons name="share-outline" size={22} color="#fff" />
              <Text style={st.optText}>Paylaş</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[st.optRow, { borderBottomWidth: 0 }]} onPress={deleteStory} disabled={deleting}>
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
              <Text style={[st.optText, { color: '#EF4444' }]}>
                {deleting ? 'Siliniyor...' : 'Hikayeyi Sil'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Seçenekler Modalı (başkasının hikayesi) ── */}
      <Modal transparent visible={showOptions && !isOwn} animationType="slide" onRequestClose={() => setShowOptions(false)}>
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => setShowOptions(false)}>
          <View style={[st.optPanel, { paddingBottom: insets.bottom + 16 }]}>
            <View style={st.optHandle} />

            <TouchableOpacity style={st.optRow} onPress={shareStory}>
              <Ionicons name="share-outline" size={22} color="#fff" />
              <Text style={st.optText}>Hikayeyi Paylaş</Text>
            </TouchableOpacity>

            <TouchableOpacity style={st.optRow} onPress={() => { setShowOptions(false); setMuted(m => !m); }}>
              <Ionicons name={muted ? 'volume-high-outline' : 'volume-mute-outline'} size={22} color="#fff" />
              <Text style={st.optText}>{muted ? 'Sesi Aç' : 'Sesi Kapat'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[st.optRow, { borderBottomWidth: 0 }]} onPress={reportStory}>
              <Ionicons name="flag-outline" size={22} color="#EF4444" />
              <Text style={[st.optText, { color: '#EF4444' }]}>Şikayet Et</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Görüntüleyenler Paneli ── */}
      <Modal transparent visible={showViewers} animationType="slide" onRequestClose={() => setShowViewers(false)}>
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => setShowViewers(false)}>
          <View style={[st.viewersPanel, { paddingBottom: insets.bottom + 16 }]}>
            <View style={st.optHandle} />
            <Text style={st.viewersPanelTitle}>Görüntüleyenler</Text>
            {viewersLoading ? (
              <ActivityIndicator size="large" color="#8B5CF6" style={{ marginVertical: 32 }} />
            ) : viewers.length === 0 ? (
              <Text style={st.viewersEmpty}>Henüz kimse görmedi</Text>
            ) : (
              <FlatList
                data={viewers}
                keyExtractor={(item, i) => item.user_id || item.username || String(i)}
                renderItem={({ item }) => (
                  <View style={st.viewerRow}>
                    <Image
                      source={{ uri: item.avatar_url || `https://i.pravatar.cc/60?u=${item.username}` }}
                      style={st.viewerAvatar}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={st.viewerName} selectable={false}>{item.display_name || item.username}</Text>
                      <Text style={st.viewerSub} selectable={false}>@{item.username}</Text>
                    </View>
                    {item.reaction ? <Text style={{ fontSize: 22 }}>{item.reaction}</Text> : null}
                  </View>
                )}
                style={{ maxHeight: SH * 0.5 }}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </Animated.View>
  );
}

// ─── Filtre tint yardımcısı ───────────────────────────────────────────────────

function getFilterTint(filter) {
  const map = {
    warm:     'rgba(255,160,50,0.22)',
    cool:     'rgba(50,120,255,0.22)',
    vintage:  'rgba(180,130,70,0.32)',
    noir:     'rgba(0,0,0,0.50)',
    dramatic: 'rgba(80,0,0,0.28)',
    fade:     'rgba(255,255,255,0.22)',
  };
  return map[filter] || null;
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Dokunma alanı (tüm ekran, panResponder)
  touchZone: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },

  // İlerleme
  progressRow: {
    position:      'absolute',
    top:           0,
    left:          12,
    right:         12,
    flexDirection: 'row',
    gap:           3,
    zIndex:        20,
  },
  progressTrack: {
    flex:            1,
    height:          2.5,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius:    2,
    overflow:        'hidden',
  },
  progressFill: {
    height:          '100%',
    borderRadius:    2,
  },

  // Üst başlık
  header: {
    position:      'absolute',
    top:           46,
    left:          0,
    right:         0,
    flexDirection: 'row',
    alignItems:    'center',
    paddingHorizontal: 12,
    paddingTop:    10,
    zIndex:        20,
  },
  headerUser: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
  },
  headerAvatar: {
    width:        36,
    height:       36,
    borderRadius: 18,
    borderWidth:  1.5,
    borderColor:  'rgba(255,255,255,0.8)',
  },
  headerName: {
    color:       '#fff',
    fontSize:    14,
    fontWeight:  '700',
    letterSpacing: -0.2,
  },
  headerTime: {
    color:    'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    marginRight:   4,
  },
  headerBtn: {
    width:            34,
    height:           34,
    borderRadius:     17,
    backgroundColor:  'rgba(0,0,0,0.35)',
    alignItems:       'center',
    justifyContent:   'center',
  },
  closeBtn: {
    width:            34,
    height:           34,
    borderRadius:     17,
    backgroundColor:  'rgba(0,0,0,0.35)',
    alignItems:       'center',
    justifyContent:   'center',
  },
  closeBtnAbs: {
    position: 'absolute',
    top:      50,
    right:    16,
    zIndex:   30,
  },

  // Metin hikayesi
  textStoryCenter: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        32,
  },
  textStoryContent: {
    fontSize:    26,
    fontWeight:  '700',
    color:       '#fff',
    textAlign:   'center',
    lineHeight:  36,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },

  // Sticker'lar
  stickerTopLeft: {
    position:       'absolute',
    top:            130,
    left:           16,
    flexDirection:  'row',
    alignItems:     'center',
    gap:            5,
    backgroundColor:'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius:   20,
    zIndex:         5,
  },
  stickerCenter: {
    position:       'absolute',
    top:            175,
    alignSelf:      'center',
    backgroundColor:'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius:   20,
    zIndex:         5,
  },
  stickerLink: {
    position:       'absolute',
    bottom:         200,
    left:           16,
    right:          16,
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
    backgroundColor:'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius:   20,
    zIndex:         5,
  },
  stickerText: {
    color:      '#fff',
    fontSize:   13,
    fontWeight: '600',
  },
  musicBar: {
    position:       'absolute',
    bottom:         250,
    left:           16,
    right:          56,
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    backgroundColor:'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius:   20,
    zIndex:         5,
  },
  musicBarText: {
    flex:     1,
    color:    '#fff',
    fontSize: 13,
  },

  // Yakın arkadaşlar rozeti
  closeFriendsBadge: {
    position:       'absolute',
    top:            130,
    right:          16,
    flexDirection:  'row',
    alignItems:     'center',
    gap:            5,
    backgroundColor:'rgba(16,185,129,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius:   20,
    zIndex:         5,
  },
  closeFriendsBadgeText: {
    color:      '#fff',
    fontSize:   12,
    fontWeight: '600',
  },

  // Alt alan
  bottom: {
    position: 'absolute',
    bottom:   0,
    left:     0,
    right:    0,
    zIndex:   15,
  },
  viewersBar: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  viewersBarText: {
    color:      '#fff',
    fontSize:   15,
    fontWeight: '600',
    flex:       1,
    textAlign:  'center',
  },
  reactionRow: {
    flexDirection:  'row',
    justifyContent: 'center',
    gap:            8,
    paddingHorizontal: 20,
    marginBottom:   10,
  },
  reactionBtn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  reactionEmoji:  { fontSize: 22 },
  reactionFly: {
    position:  'absolute',
    alignSelf: 'center',
    bottom:    90,
    zIndex:    30,
  },
  replyRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 14,
    gap:            8,
  },
  replyInput: {
    flex:               1,
    backgroundColor:    'rgba(255,255,255,0.12)',
    borderRadius:       24,
    paddingHorizontal:  16,
    paddingVertical:    12,
    color:              '#fff',
    fontSize:           14,
    borderWidth:        1,
    borderColor:        'rgba(255,255,255,0.25)',
  },
  shareStoryBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  sendBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: '#8B5CF6',
    alignItems:      'center',
    justifyContent:  'center',
  },

  // Modallar
  modalOverlay: {
    flex:             1,
    backgroundColor:  'rgba(0,0,0,0.6)',
    justifyContent:   'flex-end',
  },
  optPanel: {
    backgroundColor:    '#1a1a2e',
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingTop:         12,
    paddingHorizontal:  20,
  },
  optHandle: {
    width:          40,
    height:         4,
    borderRadius:   2,
    backgroundColor:'#374151',
    alignSelf:      'center',
    marginBottom:   16,
  },
  optRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  optText: {
    color:      '#fff',
    fontSize:   16,
    fontWeight: '500',
  },

  // Görüntüleyenler paneli
  viewersPanel: {
    backgroundColor:    '#1a1a2e',
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    paddingTop:         12,
    paddingHorizontal:  20,
    maxHeight:          SH * 0.65,
  },
  viewersPanelTitle: {
    color:      '#fff',
    fontSize:   17,
    fontWeight: '700',
    marginBottom: 16,
    textAlign:  'center',
  },
  viewersEmpty: {
    color:      '#6B7280',
    textAlign:  'center',
    paddingVertical: 32,
    fontSize:   15,
  },
  viewerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  viewerAvatar: {
    width:        44,
    height:       44,
    borderRadius: 22,
    backgroundColor: '#374151',
  },
  viewerName: {
    color:      '#fff',
    fontSize:   15,
    fontWeight: '600',
  },
  viewerSub: {
    color:    '#9CA3AF',
    fontSize: 13,
  },

  // Geri sayım
  countdownBox: {
    position:       'absolute',
    bottom:         220,
    alignSelf:      'center',
    backgroundColor:'rgba(255,255,255,0.08)',
    borderWidth:    1,
    borderColor:    'rgba(255,255,255,0.15)',
    borderRadius:   24,
    paddingVertical: 20,
    paddingHorizontal: 28,
    alignItems:     'center',
    width:          SW - 48,
    zIndex:         5,
  },
  countdownTitle: {
    color:      'rgba(255,255,255,0.7)',
    fontSize:   13,
    fontWeight: '600',
    marginBottom: 6,
  },
  countdownTime: {
    color:      '#fff',
    fontSize:   42,
    fontWeight: '800',
    letterSpacing: -1,
  },
  countdownLabel: {
    color:    'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 4,
  },

  // Anket
  pollBox: {
    position:       'absolute',
    bottom:         220,
    left:           20,
    right:          20,
    backgroundColor:'rgba(255,255,255,0.08)',
    borderWidth:    1,
    borderColor:    'rgba(255,255,255,0.15)',
    borderRadius:   24,
    padding:        20,
    zIndex:         5,
  },
  pollQ: {
    color:      '#fff',
    fontSize:   17,
    fontWeight: '800',
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  pollOpt: {
    marginBottom:   8,
    height:         48,
    borderRadius:   14,
    overflow:       'hidden',
    backgroundColor:'rgba(255,255,255,0.12)',
    justifyContent: 'center',
  },
  pollOptVoted: {
    borderWidth: 1,
    borderColor: '#A78BFA',
  },
  pollOptBar: {
    position: 'absolute',
    left:     0,
    top:      0,
    bottom:   0,
    backgroundColor: 'rgba(124,58,237,0.45)',
  },
  pollOptText: {
    position:   'absolute',
    left:       16,
    right:      50,
    color:      '#fff',
    fontSize:   15,
    fontWeight: '600',
    lineHeight: 48,
  },
  pollOptPct: {
    position:   'absolute',
    right:      12,
    color:      'rgba(255,255,255,0.8)',
    fontSize:   13,
    fontWeight: '700',
    lineHeight: 48,
  },
});
