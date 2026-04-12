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
  I18nManager, Modal, FlatList, Share, Keyboard, Linking,
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
import { Alert } from '../components/ui/AppAlert';

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

const STORY_DURATION_PHOTO = 30000; // 30 saniye
const STORY_DURATION_VIDEO = 30000; // 30 saniye fallback
const HOLD_PAUSE_DELAY     = 120;   // ms basılı tutunca duraklat

const resolveUri = (uri) => {
  if (!uri) return null;
  // Pass-through: remote URLs, blob (web picker), data URIs, native file paths
  if (uri.startsWith('http') || uri.startsWith('blob:') || uri.startsWith('data:') || uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://')) return uri;
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

function PollOverlay({ story, token, isOwn, canvasSize }) {
  const [voted,   setVoted]   = useState(null);
  const normalizeOpt = (o, i) => {
    if (typeof o === 'string') return { id: o || String(i), text: o, votes: 0 };
    if (typeof o === 'number') return { id: String(i), text: String(o), votes: 0 };
    return { id: o.id ?? String(i), text: o.text ?? o.label ?? o.name ?? '', votes: o.votes || 0 };
  };
  const [options, setOptions] = useState(
    (story.poll_options || []).map(normalizeOpt)
  );

  // Sahip her zaman sonuçları görür, diğerleri oy verdikten sonra
  const showResults = !!voted || isOwn;

  const vote = (optId, optIdx) => {
    if (voted) return;
    const key = optId ?? optIdx;
    setVoted(key);
    setOptions(prev => prev.map((o, i) =>
      (o.id ?? i) === key ? { ...o, votes: (o.votes || 0) + 1 } : o
    ));
    if (isOwn || !token) return;
    api.post(`/stories/${story.id}/poll/vote`, { option_id: optId, option_index: optIdx }, token).catch(() => {});
  };

  const cw    = canvasSize?.width  || SW;
  const ch    = canvasSize?.height || SH;
  const total = options.reduce((s, o) => s + (o.votes || 0), 0);

  const posStyle = (story.poll_pos_x != null && story.poll_pos_y != null)
    ? { left: story.poll_pos_x * cw, top: story.poll_pos_y * ch, maxWidth: cw - 24 }
    : { bottom: 220, left: 16, right: 16 };

  return (
    <View style={[st.pollBox, posStyle]}>
      {/* Başlık */}
      <View style={st.pollHeader}>
        <Ionicons name="bar-chart" size={13} color="#7C3AED" />
        <Text style={st.pollLabel}>ANKET</Text>
      </View>

      {/* Soru */}
      <Text style={st.pollQ}>{story.poll_question}</Text>

      {/* Seçenekler */}
      {options.map((opt, i) => {
        const key     = opt.id ?? i;
        const votes   = opt.votes || 0;
        const pct     = total > 0 ? Math.round((votes / total) * 100) : 0;
        const isVoted = voted === key;

        return (
          <View key={key} style={[
            st.pollOpt,
            showResults && (isVoted ? st.pollOptSelected : st.pollOptDim),
          ]}>
            {/* Dolgu barı — width hesaplaması flex ile */}
            {showResults && total > 0 && (
              <View style={st.pollOptBarTrack}>
                <View style={[st.pollOptBar, { flex: pct, backgroundColor: isVoted ? 'rgba(139,92,246,0.45)' : 'rgba(139,92,246,0.15)' }]} />
                <View style={{ flex: 100 - pct }} />
              </View>
            )}

            {/* İçerik satırı */}
            <TouchableOpacity
              style={st.pollOptRow}
              onPress={() => vote(opt.id, i)}
              disabled={!!voted}
              activeOpacity={0.75}
            >
              {isVoted && (
                <Ionicons name="checkmark-circle" size={15} color="#A78BFA" style={{ marginRight: 6 }} />
              )}
              <Text
                style={[st.pollOptText, showResults && total > 0 && !isVoted && { color: 'rgba(255,255,255,0.5)' }]}
                numberOfLines={1}
              >
                {opt.text}
              </Text>
              {showResults && (
                <Text style={[st.pollOptPct, isVoted && { color: '#fff', fontWeight: '800' }]}>
                  {pct}%
                </Text>
              )}
            </TouchableOpacity>
          </View>
        );
      })}

      {/* Toplam oy sayısı */}
      {showResults && (
        <Text style={st.pollOwnerHint}>{total} oy</Text>
      )}
    </View>
  );
}

// ─── Soru Overlay ────────────────────────────────────────────────────────────

function QuestionOverlay({ story, token, isOwn, onFocus, onBlur, canvasSize }) {
  const [answer,     setAnswer]     = useState('');
  const [submitted,  setSubmitted]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState('');

  const submit = async () => {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    setSubmitErr('');
    try {
      await api.post(`/stories/${story.id}/question`, { answer: answer.trim() }, token);
      setSubmitted(true);
      setAnswer('');
    } catch (e) {
      const msg = e?.data?.detail || e?.message || 'Gönderilemedi, tekrar dene';
      setSubmitErr(msg);
      console.error('[QuestionOverlay] submit error:', e?.status, msg);
    } finally {
      setSubmitting(false);
    }
  };

  const cw = canvasSize?.width  || SW;
  const ch = canvasSize?.height || SH;
  const posStyle = (story.question_pos_x != null && story.question_pos_y != null)
    ? { left: story.question_pos_x * cw, top: story.question_pos_y * ch, right: undefined, bottom: undefined, maxWidth: cw - 32 }
    : { bottom: 180, left: 20, right: 20 };

  return (
    <LinearGradient
      colors={['#9333EA', '#C026D3', '#EC4899']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[st.questionBox, posStyle]}
    >
      {/* Üst etiket */}
      <View style={st.questionHeader}>
        <Text style={st.questionHeaderEmoji}>❓</Text>
        <Text style={st.questionHeaderLabel}>SORU</Text>
      </View>

      {/* Soru metni */}
      <Text style={st.questionQ} selectable={false}>{story.question_text}</Text>

      {/* Cevap alanı */}
      {isOwn ? (
        <View style={st.questionOwnerHint}>
          <Ionicons name="chatbubble-outline" size={13} color="rgba(255,255,255,0.75)" />
          <Text style={st.questionOwnerTx}>Cevaplar mesajlarda görünür</Text>
        </View>
      ) : submitted ? (
        <View style={st.questionDone}>
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={st.questionDoneTx}>Cevabın gönderildi!</Text>
        </View>
      ) : (
        <>
          <View style={st.questionInputRow}>
            <TextInput
              style={st.questionInput}
              placeholder="Cevabını yaz..."
              placeholderTextColor="rgba(120,60,160,0.55)"
              value={answer}
              onChangeText={(t) => { setAnswer(t); if (submitErr) setSubmitErr(''); }}
              returnKeyType="send"
              onSubmitEditing={submit}
              onFocus={onFocus}
              onBlur={onBlur}
              editable={!submitting}
              maxLength={200}
            />
            <TouchableOpacity
              style={[st.questionSendBtn, !answer.trim() && { opacity: 0.45 }]}
              onPress={submit}
              disabled={!answer.trim() || submitting}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {submitting
                ? <ActivityIndicator size="small" color="#9333EA" />
                : <Ionicons name="arrow-forward" size={18} color="#9333EA" />}
            </TouchableOpacity>
          </View>
          {!!submitErr && (
            <Text style={st.questionErrTx}>{submitErr}</Text>
          )}
        </>
      )}
    </LinearGradient>
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
  const [viewerCount,   setViewerCount]   = useState(0);
  const [mediaLoadError, setMediaLoadError] = useState(false);
  const [liked,         setLiked]         = useState(false);
  const [showDMShare,   setShowDMShare]   = useState(false);
  const [dmQuery,       setDMQuery]       = useState('');
  const [dmUsers,       setDMUsers]       = useState([]);
  const [dmLoading,     setDMLoading]     = useState(false);
  const [sentDMUsers,   setSentDMUsers]   = useState(new Set());
  const dmInputRef = useRef(null);

  // ── Animasyonlar & ref'ler ──
  const slideAnim    = useRef(new Animated.Value(0)).current;
  const reactionAnim = useRef(new Animated.Value(0)).current;
  const likeAnim     = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;  // smooth progress
  const progressAni  = useRef(null);   // Animated.timing ref
  const seenCount    = useRef(0);
  const pendingNext  = useRef(null);
  const pressTimer   = useRef(null);   // hold-to-pause timer
  const holdPaused   = useRef(false);  // hold-to-pause durumu
  const holdFired    = useRef(false);  // long-press tetiklendi mi (tap'i suppress et)
  const progressValRef = useRef(0);   // pause/resume için anlık progress değeri
  const replyInputRef  = useRef(null);  // yanıt input ref
  const isOwnRef       = useRef(false); // panResponder için
  const openViewersRef = useRef(null);  // panResponder için
  const storyAudioRef  = useRef(null);  // hikaye müzik ses nesnesi
  const [viewerCanvas, setViewerCanvas] = useState({ width: 390, height: 844 }); // metin konumu için

  // ── progressAnim değerini izle (pause/resume kaldığı yerden devam etsin) ──
  useEffect(() => {
    const id = progressAnim.addListener(({ value }) => { progressValRef.current = value; });
    return () => progressAnim.removeListener(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Görüntüleyenler panelini aç (useEffect deps'ten önce tanımlanmalı) ──
  const openViewers = useCallback(() => {
    setViewersLoading(true);
    setShowViewers(true);
    setPaused(true);
  }, []);

  // ── Türetilmiş değerler ──
  const userGroup = feed?.[userIdx];
  const stories   = userGroup?.stories || [];
  const story     = stories[storyIdx];
  const isOwn     = story?.user_id === user?.id || userGroup?.user_id === user?.id;
  const mediaUrl  = story?.media_url || story?.media?.url;
  const bgColor   = story?.background_color || '#8B5CF6';
  const storyAge  = story?.created_at ? Date.now() - new Date(story.created_at).getTime() : null;

  // ── Ref'leri her render'da güncelle (panResponder closures için) ──
  useEffect(() => { isOwnRef.current = isOwn; });
  useEffect(() => { openViewersRef.current = openViewers; }, [openViewers]);

  // ── Medya yükleme hatası sıfırla + beğeni durumunu yükle (hikaye değişince) ──
  useEffect(() => {
    setMediaLoadError(false);
    setLiked(false);
    if (!story?.id || !token || isOwn) return;
    api.get(`/stories/${story.id}/reactions`, token)
      .then(res => { if (res?.user_liked) setLiked(true); })
      .catch(() => {});
  }, [story?.id]);

  // ── Sonraki hikayenin görselini önceden yükle (hızlı geçiş) ──
  useEffect(() => {
    const next = stories[storyIdx + 1] || feed?.[userIdx + 1]?.stories?.[0];
    if (!next?.media_url) return;
    const uri = resolveUri(next.media_url);
    if (!uri || uri.startsWith('blob:') || uri.startsWith('data:')) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const img = new window.Image(); img.src = uri;
    } else {
      Image.prefetch(uri).catch(() => {});
    }
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hikaye müziği — hikaye değişince çal ──
  useEffect(() => {
    // Önceki sesi durdur
    if (storyAudioRef.current) {
      storyAudioRef.current.pause();
      storyAudioRef.current.src = '';
      storyAudioRef.current = null;
    }
    const track = story?.music_track;
    const rawUrl = track?.audio_url || track?.stream_url || track?.preview_url;
    if (!rawUrl) return;
    const startSec = story?.music_start_time || 0;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      let cancelled = false;
      // Göreli URL → Vite proxy (window.location.origin), mutlak URL → olduğu gibi
      const baseUrl = rawUrl.startsWith('http') ? rawUrl : `${window.location.origin}${rawUrl}`;

      const playAudio = async () => {
        let finalUrl = baseUrl;
        // SoundCloud transcoding URL'leri JSON döndürür: { "url": "cdn_url" }
        // Gerçek CDN URL'sini almak için önce fetch et
        if (baseUrl.includes('sc-api') || baseUrl.includes('api-v2.soundcloud.com') ||
            baseUrl.includes('/stream/progressive') || baseUrl.includes('/stream/hls')) {
          try {
            const res = await fetch(baseUrl);
            const json = await res.json();
            if (json?.url) finalUrl = json.url;
          } catch {}
        }
        if (cancelled) return;
        const audio = new window.Audio(finalUrl);
        storyAudioRef.current = audio;
        audio.currentTime = startSec;
        audio.play().catch(() => {});
      };
      playAudio();

      return () => {
        cancelled = true;
        if (storyAudioRef.current) {
          storyAudioRef.current.pause();
          storyAudioRef.current.src = '';
          storyAudioRef.current = null;
        }
      };
    }
    // Native (expo-av) → mevcut Video bileşeni ile yönetilir
  }, [story?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Duraklat / devam — müziği de etkile ──
  useEffect(() => {
    const audio = storyAudioRef.current;
    if (!audio) return;
    if (paused) { audio.pause(); }
    else { audio.play().catch(() => {}); }
  }, [paused]);

  // ── Görüntüleme kaydı ──
  useEffect(() => {
    if (!story || !token || isOwn) return;
    api.post(`/stories/${story.id}/view`, {}, token).catch(() => {});
  }, [story?.id]);

  // ── Görüntüleyenler: hikaye değişince sayıyı çek ──
  useEffect(() => {
    if (!story?.id || !token || !isOwn) return;
    api.get(`/stories/${story.id}/viewers`, token)
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.viewers || []);
        setViewerCount(list.length);
      }).catch(() => {});
  }, [story?.id, isOwn]);

  // ── Görüntüleyenler paneli: açıkken 15sn'de bir güncelle ──
  useEffect(() => {
    if (!showViewers || !isOwn || !story?.id || !token) return;
    const poll = async () => {
      try {
        const res = await api.get(`/stories/${story.id}/viewers`, token);
        const list = Array.isArray(res) ? res : (res?.viewers || []);
        setViewers(list);
        setViewerCount(list.length);
      } catch {}
      setViewersLoading(false);
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, [showViewers]);

  // ── Story değişince progress'i sıfırla ──
  useEffect(() => {
    progressValRef.current = 0;
    progressAnim.setValue(0);
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── İlerleme çubuğu (smooth, pause/resume kaldığı yerden devam eder) ──
  useEffect(() => {
    progressAni.current?.stop();
    if (!story || paused || replyFocused) return; // sıfırlama yok, sadece dur

    const totalDur = story.story_type === 'video'
      ? (story.duration ? story.duration * 1000 : STORY_DURATION_VIDEO)
      : STORY_DURATION_PHOTO;
    const frac      = progressValRef.current;        // kaldığı yer (0-1)
    const remaining = Math.max(50, totalDur * (1 - frac));

    progressAnim.setValue(frac);
    progressAni.current = Animated.timing(progressAnim, {
      toValue:         1,
      duration:        remaining,
      easing:          t => t,   // linear — eğrisiz düz ilerleme
      useNativeDriver: false,
    });
    progressAni.current.start(({ finished }) => {
      if (finished) { progressValRef.current = 0; goNext(); }
    });
    return () => progressAni.current?.stop();
  }, [story?.id, paused, replyFocused]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigasyon ──
  const doGoNext = useCallback(() => {
    if (storyIdx < stories.length - 1) {
      setStoryIdx(i => i + 1);
    } else if (userIdx < (feed?.length ?? 0) - 1) {
      setUserIdx(i => i + 1);
      setStoryIdx(0);
    } else {
      // Son hikaye — hızlı slide-down ile kapat
      Animated.timing(slideAnim, { toValue: SH, duration: 180, useNativeDriver: true })
        .start(() => navigation.goBack());
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

  // ── Her render'da güncellenen ref'ler — PanResponder stale closure'dan kaçın ──
  const goNextRef = useRef(null);
  const goPrevRef = useRef(null);
  goNextRef.current = goNext;
  goPrevRef.current = goPrev;

  // ── PanResponder (aşağı kaydır kapat + hold-to-pause + sol/sağ tap) ──
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,  // tapZone'lar öncelikli alsın
      onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dy) > 10,

      onPanResponderGrant: () => {
        // Swipe başladı — varsa hold timer'ı iptal et
        clearTimeout(pressTimer.current);
        if (holdPaused.current) { holdPaused.current = false; setPaused(false); }
      },

      onPanResponderMove: (_, g) => {
        if (g.dy > 0) slideAnim.setValue(g.dy);
        else if (g.dy < 0) slideAnim.setValue(g.dy * 0.35); // yukarı kayma direnci
      },

      onPanResponderRelease: (evt, g) => {
        clearTimeout(pressTimer.current);

        // Hold-to-pause: parmak kaldırıldı → devam et
        if (holdPaused.current) {
          holdPaused.current = false;
          setPaused(false);
        }

        // Yukarı kaydır → kendi hikayesinde görüntüleyenler
        if (g.dy < -60 && Math.abs(g.dx) < 60 && isOwnRef.current) {
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
          openViewersRef.current?.();
          return;
        }

        if (g.dy > 80) {
          // Aşağı kaydır → kapat
          Animated.timing(slideAnim, { toValue: SH, duration: 250, useNativeDriver: true })
            .start(() => navigation.goBack());
          return;
        }

        // Geri yay
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();

        // Tap navigasyon ayrı TouchableOpacity zone'larında işleniyor
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

  // ── Beğen / Beğeniyi geri al ──
  const likeStory = useCallback(async () => {
    if (!story?.id || !token) return;
    const newLiked = !liked;
    setLiked(newLiked);
    Animated.sequence([
      Animated.spring(likeAnim, { toValue: 1.4, useNativeDriver: true, friction: 3, tension: 140 }),
      Animated.spring(likeAnim, { toValue: 1,   useNativeDriver: true, friction: 4 }),
    ]).start();
    try {
      if (newLiked) {
        await api.post(`/stories/${story.id}/react`, { reaction: '❤️' }, token);
      } else {
        await api.delete(`/stories/${story.id}/reaction`, token);
      }
    } catch {
      setLiked(liked); // hata olursa geri al
    }
  }, [story?.id, token, liked]);

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

  // ── DM paylaş ──
  const openDMShare = () => {
    setShowOptions(false);
    setPaused(true);
    setDMQuery('');
    setSentDMUsers(new Set());
    setShowDMShare(true);
    setDMLoading(true);
    api.get('/social/following', token)
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.results || res?.users || []);
        setDMUsers(list.slice(0, 30));
      })
      .catch(() => {})
      .finally(() => setDMLoading(false));
  };

  const searchDMUsers = useCallback(async (q) => {
    if (!q.trim()) {
      setDMLoading(true);
      try {
        const res = await api.get('/social/following', token);
        const list = Array.isArray(res) ? res : (res?.results || res?.users || []);
        setDMUsers(list.slice(0, 30));
      } catch {}
      setDMLoading(false);
      return;
    }
    setDMLoading(true);
    try {
      const res = await api.get(`/users/search?q=${encodeURIComponent(q.trim())}`, token);
      const list = Array.isArray(res) ? res : (res?.results || res?.users || []);
      setDMUsers(list.slice(0, 20));
    } catch {}
    setDMLoading(false);
  }, [token]);

  const sendViaDM = async (targetUser) => {
    if (sentDMUsers.has(targetUser.id || targetUser.username)) return;
    const storyLink = `${userGroup?.user_display_name || userGroup?.username} kişisinin hikayesini gör 👀`;
    try {
      // 1) Konuşmayı bul veya oluştur
      const conv = await api.post('/messages/conversations', {
        participant_ids: [targetUser.id],
        is_group: false,
      }, token);
      // 2) Mesajı gönder
      await api.post('/messages', {
        conversation_id: conv.id,
        content: storyLink,
        content_type: 'TEXT',
      }, token);
      setSentDMUsers(prev => new Set([...prev, targetUser.id || targetUser.username]));
    } catch {}
  };

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
              navigation.goBack();
            } catch {
              setDeleting(false);
              Alert.alert(t('common.error'), 'Silinemedi.');
            }
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
      onLayout={(e) => { const l = e.nativeEvent.layout; setViewerCanvas({ width: l.width, height: l.height }); }}
      {...panResponder.panHandlers}
    >
      {/* ── Arka plan ── */}
      {mediaUrl && !mediaLoadError && !(Platform.OS === 'web' && typeof mediaUrl === 'string' && mediaUrl.startsWith('blob:')) ? (
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
          <Image
            source={{ uri: resolveUri(mediaUrl) }}
            style={[StyleSheet.absoluteFill, (story.photo_scale || story.photo_offset_x || story.photo_offset_y) && {
              transform: [
                { translateX: story.photo_offset_x || 0 },
                { translateY: story.photo_offset_y || 0 },
                { scale: story.photo_scale || 1 },
              ],
            }]}
            resizeMode="cover"
            onError={() => setMediaLoadError(true)}
          />
        )
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: bgColor }]}>
          {story.text ? (() => {
            const hasPosData = story.text_pos_x != null && story.text_pos_y != null;
            const cw = viewerCanvas.width  || 390;
            const ch = viewerCanvas.height || 844;
            const tbg   = story.text_bg || 'transparent';
            const color = tbg === '#fff' ? '#111' : '#fff';
            const scale = story.text_scale || 1;
            const align = story.text_align || 'center';
            const l0 = story.text.length;
            const base0 = l0 <= 30 ? 36 : l0 <= 60 ? 28 : l0 <= 120 ? 22 : l0 <= 250 ? 18 : 14;
            const fs = Math.max(14, Math.min(72, Math.round(base0 * scale)));
            const lh = Math.max(18, Math.round(fs * 1.2));
            if (hasPosData) {
              return (
                <View style={{ position: 'absolute', left: story.text_pos_x * cw, top: story.text_pos_y * ch }}>
                  <View style={[st.textOverlayBubble, { backgroundColor: tbg === 'transparent' ? 'transparent' : tbg }]}>
                    <Text style={[st.textOverlayContent, { fontSize: fs, lineHeight: lh, textAlign: align, color }]} selectable={false}>{story.text}</Text>
                  </View>
                </View>
              );
            }
            return (
              <View style={st.textStoryCenter}>
                <Text style={[st.textStoryContent, { textAlign: align, color }]} selectable={false}>{story.text}</Text>
              </View>
            );
          })() : null}
        </View>
      )}

      {/* Filtre tinti */}
      {(story.filter_id || story.filter) && (story.filter_id || story.filter) !== 'none' && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: getFilterTint(story.filter_id || story.filter) }]} pointerEvents="none" />
      )}

      {/* Karartma gradyanı (üst & alt) */}
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'transparent', 'transparent', 'rgba(0,0,0,0.45)']}
        locations={[0, 0.25, 0.65, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* ── Swipe alanı — panHandlers root view'de, bu katman kaldırıldı ── */}

      {/* ── Orta tap zone — hold-to-pause (%30) ── */}
      <TouchableOpacity
        style={st.tapZoneMid}
        delayPressIn={0}
        onPressIn={() => {
          holdFired.current = false;
          pressTimer.current = setTimeout(() => {
            holdFired.current  = true;
            holdPaused.current = true;
            setPaused(true);
          }, HOLD_PAUSE_DELAY);
        }}
        onPressOut={() => {
          clearTimeout(pressTimer.current);
          if (holdPaused.current) { holdPaused.current = false; setPaused(false); }
        }}
        activeOpacity={1}
      />

      {/* ── Sol tap zone — önceki hikaye (%35) ── */}
      <TouchableOpacity
        style={st.tapZoneLeft}
        delayPressIn={0}
        onPressIn={() => {
          holdFired.current = false;
          pressTimer.current = setTimeout(() => {
            holdFired.current  = true;
            holdPaused.current = true;
            setPaused(true);
          }, HOLD_PAUSE_DELAY);
        }}
        onPressOut={() => {
          clearTimeout(pressTimer.current);
          if (holdPaused.current) { holdPaused.current = false; setPaused(false); }
        }}
        onPress={() => { if (!holdFired.current) goPrevRef.current?.(); }}
        activeOpacity={1}
      />

      {/* ── Sağ tap zone — sonraki hikaye (%35) ── */}
      <TouchableOpacity
        style={st.tapZoneRight}
        delayPressIn={0}
        onPressIn={() => {
          holdFired.current = false;
          pressTimer.current = setTimeout(() => {
            holdFired.current  = true;
            holdPaused.current = true;
            setPaused(true);
          }, HOLD_PAUSE_DELAY);
        }}
        onPressOut={() => {
          clearTimeout(pressTimer.current);
          if (holdPaused.current) { holdPaused.current = false; setPaused(false); }
        }}
        onPress={() => { if (!holdFired.current) goNextRef.current?.(); }}
        activeOpacity={1}
      />

      {/* ── İlerleme çubukları (smooth) ── */}
      <View style={[st.progressRow, { paddingTop: insets.top + 8 }]}>
        {stories.map((_, i) => (
          <View key={i} style={st.progressTrack}>
            {i < storyIdx ? (
              // Geçmiş hikayeler: tam dolu
              <View style={[st.progressFill, { width: '100%', backgroundColor: 'rgba(255,255,255,0.9)' }]} />
            ) : i === storyIdx ? (
              // Aktif hikaye: smooth animated
              <Animated.View style={[st.progressFill, {
                width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                backgroundColor: '#fff',
              }]} />
            ) : null}
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
          {/* Seçenekler */}
          <TouchableOpacity style={st.headerBtn} onPress={() => { setPaused(true); setShowOptions(true); }}>
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
      {story.mention_username && (() => {
        const mScale = story.mention_scale || 1;
        const mFs = Math.round(20 * mScale);
        return (
          <TouchableOpacity
            style={[
              st.stickerMention,
              story.mention_pos_x != null && story.mention_pos_y != null
                ? { left: story.mention_pos_x * viewerCanvas.width, top: story.mention_pos_y * viewerCanvas.height }
                : { alignSelf: 'center', top: viewerCanvas.height * 0.18 },
            ]}
            onPress={() => navigation.navigate('UserProfile', { username: story.mention_username })}
            activeOpacity={0.85}
          >
            <View style={st.mentionStickerPill}>
              <Text style={[st.mentionStickerText, { fontSize: mFs }]}>
                <Text style={[st.mentionStickerAtSign, { fontSize: mFs }]}>@</Text>{story.mention_username}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })()}
      {story.link_url && (
        <TouchableOpacity
          style={[
            st.stickerLinkNew,
            story.link_pos_x != null && story.link_pos_y != null
              ? { left: story.link_pos_x * viewerCanvas.width, top: story.link_pos_y * viewerCanvas.height }
              : { alignSelf: 'center', bottom: 160 },
          ]}
          onPress={() => {
            const url = story.link_url.startsWith('http') ? story.link_url : `https://${story.link_url}`;
            Linking.openURL(url).catch(() => {});
          }}
          activeOpacity={0.88}
        >
          <View style={st.linkStickerIconBox}>
            <Ionicons name="link" size={15} color="#7C3AED" />
          </View>
          <Text style={st.linkStickerTxt} numberOfLines={1} selectable={false}>
            {story.link_url.replace(/^https?:\/\/(www\.)?/, '')}
          </Text>
        </TouchableOpacity>
      )}
      {story.music_track_id && (
        <View style={st.musicBar}>
          <Ionicons name="musical-notes" size={15} color="#fff" />
          <Text style={st.musicBarText} numberOfLines={1} selectable={false}>
            {story.music_track?.title || story.music_title || story.music_track_id}
            {story.music_track?.artist ? ` · ${story.music_track.artist}` : ''}
          </Text>
        </View>
      )}
      {story.countdown_end && (
        <CountdownOverlay endTime={story.countdown_end} title={story.countdown_title} />
      )}
      {story.poll_question && story.poll_options?.length > 0 && (
        <PollOverlay story={story} token={token} isOwn={isOwn} canvasSize={viewerCanvas} />
      )}
      {story.question_text && (
        <QuestionOverlay
          story={story}
          token={token}
          isOwn={isOwn}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          canvasSize={viewerCanvas}
        />
      )}

      {/* ── Metin overlay (media + text birlikte) ── */}
      {mediaUrl && story.text ? (() => {
        const hasPosData = story.text_pos_x != null && story.text_pos_y != null;
        const cw = viewerCanvas.width  || 390;
        const ch = viewerCanvas.height || 844;
        const bg    = story.text_bg || 'transparent';
        const color = bg === '#fff' ? '#111' : '#fff';
        const scale = story.text_scale || 1;
        const align = story.text_align || 'center';
        const l1 = story.text.length;
        const base1 = l1 <= 30 ? 36 : l1 <= 60 ? 28 : l1 <= 120 ? 22 : l1 <= 250 ? 18 : 14;
        const baseFontSize = Math.max(14, Math.min(72, Math.round(base1 * scale)));
        const baseLH = Math.max(18, Math.round(baseFontSize * 1.2));
        const posStyle = hasPosData
          ? { position: 'absolute', left: story.text_pos_x * cw, top: story.text_pos_y * ch, alignItems: 'flex-start' }
          : st.textOverlay;
        return (
          <View style={posStyle} pointerEvents="none">
            <View style={[st.textOverlayBubble, { backgroundColor: bg === 'transparent' ? 'transparent' : bg }]}>
              <Text style={[st.textOverlayContent, { fontSize: baseFontSize, lineHeight: baseLH, textAlign: align, color }]} selectable={false}>
                {story.text}
              </Text>
            </View>
          </View>
        );
      })() : null}

      {/* ── Yakın arkadaşlar rozeti ── */}
      {(story.close_friends_only || story.audience === 'close_friends') && (
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
        {isOwn ? null : (
          /* ── Başkasının hikayesi: tepki + yanıt ── */
          <>
            {/* Tepkiler */}
            {!replyFocused && (
              <View style={st.reactionRow}>
                {REACTIONS.map(r => (
                  <TouchableOpacity key={r.type} style={st.reactionBtn} onPress={() => sendReaction(r.emoji)}>
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
                  {sentReaction}
                </Text>
              </Animated.View>
            )}

            {/* Yanıt satırı */}
            <View style={st.replyArea}>
              <TouchableOpacity
                style={st.replyRow}
                activeOpacity={1}
                onPress={() => {
                  replyInputRef.current?.focus();
                  setReplyFocused(true);
                }}
              >
                <TextInput
                  ref={replyInputRef}
                  style={st.replyInput}
                  placeholder={`${userGroup?.user_display_name || userGroup?.username} kişisine yanıt ver...`}
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={replyText}
                  onChangeText={setReplyText}
                  onFocus={() => { setReplyFocused(true); setPaused(true); }}
                  onBlur={() => { setReplyFocused(false); setPaused(false); }}
                  onSubmitEditing={sendReply}
                  returnKeyType="send"
                  selectionColor="rgba(255,255,255,0.7)"
                />
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
              </TouchableOpacity>

              {/* Beğen butonu */}
              <TouchableOpacity style={st.likeBtn} onPress={likeStory} activeOpacity={0.75}>
                <Animated.View style={{ transform: [{ scale: likeAnim }] }}>
                  <Ionicons
                    name={liked ? 'heart' : 'heart-outline'}
                    size={28}
                    color={liked ? '#F87171' : 'rgba(255,255,255,0.85)'}
                  />
                </Animated.View>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* ── Seçenekler Paneli — bottom sheet ── */}
      {showOptions && (
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, { zIndex: 50, backgroundColor: 'rgba(8,6,15,0.88)', justifyContent: 'flex-end' }]}
          activeOpacity={1}
          onPress={() => { setShowOptions(false); if (!replyFocused) setPaused(false); }}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ alignSelf: 'stretch' }}>
            <View style={[st.viewersPanel, { paddingBottom: insets.bottom + 16 }]}>
              <LinearGradient colors={['rgba(26,10,46,0.35)', 'rgba(16,8,28,0.10)', 'rgba(10,5,18,0.02)', 'transparent']} locations={[0, 0.38, 0.68, 1]} style={st.topGrad} pointerEvents="none" />
              <View style={st.optHandleBar} />
              {isOwn ? (
                <TouchableOpacity style={st.optRow} onPress={deleteStory} disabled={deleting}>
                  <Ionicons name="trash-outline" size={22} color="#EF4444" />
                  <Text style={[st.optText, { color: '#EF4444' }]}>
                    {deleting ? 'Siliniyor...' : 'Hikayeyi Sil'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={st.optRow} onPress={openDMShare}>
                    <Ionicons name="paper-plane-outline" size={22} color="#fff" />
                    <Text style={st.optText}>DM'de Paylaş</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.optRow} onPress={shareStory}>
                    <Ionicons name="share-outline" size={22} color="#fff" />
                    <Text style={st.optText}>Dışarıda Paylaş</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.optRow} onPress={reportStory}>
                    <Ionicons name="flag-outline" size={22} color="#EF4444" />
                    <Text style={[st.optText, { color: '#EF4444' }]}>Şikayet Et</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* ── Görüntüleyenler Paneli — Instagram tarzı bottom sheet ── */}
      {showViewers && isOwn && (
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, { zIndex: 50, backgroundColor: 'rgba(8,6,15,0.88)', justifyContent: 'flex-end' }]}
          activeOpacity={1}
          onPress={() => { setShowViewers(false); setPaused(false); }}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ alignSelf: 'stretch' }}>
            <View style={[st.viewersPanel, { paddingBottom: insets.bottom + 8 }]}>
              <LinearGradient colors={['rgba(26,10,46,0.35)', 'rgba(16,8,28,0.10)', 'rgba(10,5,18,0.02)', 'transparent']} locations={[0, 0.38, 0.68, 1]} style={st.topGrad} pointerEvents="none" />
              {/* Handle */}
              <View style={st.optHandleBar} />

              {/* Başlık satırı */}
              <View style={st.viewersHeader}>
                <View style={st.viewersHeaderLeft}>
                  <Ionicons name="eye" size={18} color="#C084FC" />
                  <Text style={st.viewersPanelTitle} selectable={false}>Görüntüleyenler</Text>
                </View>
                <View style={st.viewersCountBadge}>
                  <Text style={st.viewersCountText}>{viewerCount}</Text>
                </View>
              </View>

              {/* İçerik */}
              {viewersLoading ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#C084FC" />
                  <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 12, fontSize: 13 }}>Yükleniyor...</Text>
                </View>
              ) : viewers.length === 0 ? (
                <View style={{ paddingVertical: 40, alignItems: 'center', gap: 10 }}>
                  <Ionicons name="eye-off-outline" size={36} color="rgba(255,255,255,0.2)" />
                  <Text style={st.viewersEmpty}>Henüz kimse görmedi</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Hikayeni paylaştıktan sonra burada görünür</Text>
                </View>
              ) : (
                <FlatList
                  data={viewers}
                  keyExtractor={(item, i) => String(item.user_id || item.username || i)}
                  renderItem={({ item }) => (
                    <View style={st.viewerRow}>
                      {/* Avatar */}
                      <View style={st.viewerAvatarWrap}>
                        <Image
                          source={{ uri: item.avatar_url || `https://i.pravatar.cc/60?u=${item.username}` }}
                          style={st.viewerAvatar}
                        />
                        {item.reaction ? (
                          <View style={st.viewerReactionBubble}>
                            <Text style={{ fontSize: 13 }}>{item.reaction}</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* İsim */}
                      <View style={{ flex: 1 }}>
                        <Text style={st.viewerName} selectable={false} numberOfLines={1}>
                          {item.display_name || item.username}
                        </Text>
                        <Text style={st.viewerSub} selectable={false}>@{item.username}</Text>
                      </View>

                      {/* Zaman */}
                      {item.viewed_at ? (
                        <Text style={st.viewerTime}>{formatTime(Date.now() - new Date(item.viewed_at).getTime())}</Text>
                      ) : null}
                    </View>
                  )}
                  style={{ maxHeight: SH * 0.52 }}
                  showsVerticalScrollIndicator={false}
                  ItemSeparatorComponent={() => <View style={st.viewerDivider} />}
                />
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
      {/* ── DM Paylaş Paneli ── */}
      {showDMShare && (
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, { zIndex: 50, backgroundColor: 'rgba(8,6,15,0.88)', justifyContent: 'flex-end' }]}
          activeOpacity={1}
          onPress={() => { setShowDMShare(false); setPaused(false); Keyboard.dismiss(); }}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ alignSelf: 'stretch' }}>
            <View style={[st.viewersPanel, { paddingBottom: insets.bottom + 12 }]}>
              <LinearGradient colors={['rgba(26,10,46,0.35)', 'rgba(16,8,28,0.10)', 'rgba(10,5,18,0.02)', 'transparent']} locations={[0, 0.38, 0.68, 1]} style={st.topGrad} pointerEvents="none" />
              <View style={st.optHandleBar} />

              {/* Başlık */}
              <View style={[st.viewersHeader, { marginBottom: 12 }]}>
                <View style={st.viewersHeaderLeft}>
                  <Ionicons name="paper-plane" size={17} color="#C084FC" />
                  <Text style={st.viewersPanelTitle}>DM'de Paylaş</Text>
                </View>
                <TouchableOpacity onPress={() => { setShowDMShare(false); setPaused(false); }}>
                  <Ionicons name="close" size={22} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>

              {/* Arama */}
              <View style={st.dmSearchRow}>
                <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" />
                <TextInput
                  ref={dmInputRef}
                  style={st.dmSearchInput}
                  placeholder="Kullanıcı ara..."
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={dmQuery}
                  onChangeText={q => { setDMQuery(q); searchDMUsers(q); }}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {dmQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setDMQuery(''); searchDMUsers(''); }}>
                    <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Kullanıcı listesi */}
              {dmLoading ? (
                <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#C084FC" />
                </View>
              ) : dmUsers.length === 0 ? (
                <View style={{ paddingVertical: 30, alignItems: 'center', gap: 8 }}>
                  <Ionicons name="person-outline" size={32} color="rgba(255,255,255,0.2)" />
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                    {dmQuery ? 'Kullanıcı bulunamadı' : 'Takip ettiğin kullanıcı yok'}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={dmUsers}
                  keyExtractor={(item, i) => String(item.id || item.username || i)}
                  style={{ maxHeight: SH * 0.38 }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const isSent = sentDMUsers.has(item.id || item.username);
                    return (
                      <View style={st.dmUserRow}>
                        <Image
                          source={{ uri: item.avatar_url || `https://i.pravatar.cc/60?u=${item.username}` }}
                          style={st.dmUserAvatar}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={st.dmUserName} numberOfLines={1}>{item.display_name || item.name || item.username}</Text>
                          <Text style={st.dmUserSub} numberOfLines={1}>@{item.username}</Text>
                        </View>
                        <TouchableOpacity
                          style={[st.dmSendBtn, isSent && st.dmSentBtn]}
                          onPress={() => sendViaDM(item)}
                          disabled={isSent}
                        >
                          {isSent
                            ? <Ionicons name="checkmark" size={16} color="#C084FC" />
                            : <Text style={st.dmSendTx}>Gönder</Text>}
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                />
              )}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      )}

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

  // Dokunma alanı (tüm ekran, panResponder — swipe + hold)
  touchZone: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },

  // Sol/sağ tap zone'ları (zIndex 2 > touchZone, progress/header'dan düşük)
  tapZoneLeft: {
    position: 'absolute',
    left:     0,
    top:      60,
    bottom:   120,
    width:    '35%',
    zIndex:   2,
  },
  tapZoneRight: {
    position: 'absolute',
    right:    0,
    top:      60,
    bottom:   120,
    width:    '35%',
    zIndex:   2,
  },
  tapZoneMid: {
    position: 'absolute',
    left:     '35%',
    right:    '35%',
    top:      60,
    bottom:   120,
    zIndex:   2,
  },

  // İlerleme
  progressRow: {
    position:      'absolute',
    top:           0,
    left:          10,
    right:         10,
    flexDirection: 'row',
    gap:           3,
    zIndex:        20,
  },
  progressTrack: {
    flex:            1,
    height:          3,
    backgroundColor: 'rgba(255,255,255,0.30)',
    borderRadius:    2,
    overflow:        'hidden',
  },
  progressFill: {
    height:          '100%',
    borderRadius:    2,
  },

  // Üst başlık — avatar 8px daha aşağı
  header: {
    position:      'absolute',
    top:           46,
    left:          0,
    right:         0,
    flexDirection: 'row',
    alignItems:    'center',
    paddingHorizontal: 12,
    paddingTop:    18,   // progress bardan sonra biraz boşluk
    zIndex:        20,
  },
  headerUser: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
  },
  headerAvatar: {
    width:        38,
    height:       38,
    borderRadius: 19,
    borderWidth:  2,
    borderColor:  'rgba(255,255,255,0.85)',
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
  // ── Yeni link sticker (Instagram tarzı beyaz hap) ──
  stickerLinkNew: {
    position:        'absolute',
    flexDirection:   'row',
    alignItems:      'center',
    gap:             7,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 12,
    paddingVertical:  7,
    borderRadius:    22,
    zIndex:          5,
    maxWidth:        SW * 0.65,
    shadowColor:     '#000',
    shadowOpacity:   0.18,
    shadowRadius:    8,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       4,
  },
  linkStickerIconBox: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: 'rgba(124,58,237,0.12)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  linkStickerTxt: {
    color:       '#111',
    fontSize:    13,
    fontWeight:  '700',
    flexShrink:  1,
  },
  // ── Mention sticker (dark glassmorphism pill) ──
  stickerMention: {
    position: 'absolute',
    zIndex:   5,
  },
  mentionStickerPill: {
    backgroundColor:   'rgba(12,5,28,0.88)',
    borderRadius:      30,
    paddingHorizontal: 18,
    paddingVertical:   10,
    borderWidth:       1,
    borderColor:       'rgba(139,92,246,0.45)',
    shadowColor:       '#7C3AED',
    shadowOpacity:     0.28,
    shadowRadius:      12,
    shadowOffset:      { width: 0, height: 3 },
    elevation:         6,
  },
  mentionStickerText: {
    color:      '#fff',
    fontWeight: '700',
    flexShrink: 1,
  },
  mentionStickerAtSign: {
    color:      '#C084FC',
    fontWeight: '900',
  },
  stickerText: {
    color:      '#fff',
    fontSize:   13,
    fontWeight: '600',
  },
  musicBar: {
    position:       'absolute',
    bottom:         100,
    left:           14,
    right:          14,
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    backgroundColor:'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius:   22,
    zIndex:         5,
  },
  musicBarText: {
    flex:     1,
    color:    '#fff',
    fontSize: 13,
  },

  // Yakın arkadaşlar rozeti
  // Metin overlay (photo + text)
  textOverlay: {
    position:      'absolute',
    bottom:        160,
    left:          20,
    right:         20,
    alignItems:    'center',
    zIndex:        4,
  },
  textOverlayBubble: {
    // backgroundColor dinamik olarak JSX'te setlenir (creator ile tutarlı)
    borderRadius:    14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth:        320,  // '90%' position:absolute ile circular ref — sabit değer
  },
  textOverlayContent: {
    color:      '#fff',
    fontWeight: '700',
    textAlign:  'center',
    // 'normal' stil için okunabilirlik: metin gölgesi
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

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
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'center',
    gap:              8,
    paddingHorizontal: 24,
    paddingVertical:  14,
    borderTopWidth:   0.5,
    borderTopColor:   'rgba(255,255,255,0.15)',
    backgroundColor:  'rgba(0,0,0,0.25)',
  },
  viewersBarText: {
    color:      'rgba(255,255,255,0.9)',
    fontSize:   14,
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
  replyArea: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: 14,
    gap:            10,
  },
  replyRow: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
  },
  likeBtn: {
    width:          48,
    height:         48,
    borderRadius:   24,
    alignItems:     'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth:    1,
    borderColor:    'rgba(255,255,255,0.15)',
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

  // Modallar — centered dialog
  modalOverlay: {
    flex:             1,
    backgroundColor:  'rgba(8,6,15,0.88)',
    justifyContent:   'center',
    alignItems:       'center',
    zIndex:           50,
  },
  optPanel: {
    backgroundColor:  '#08060F',
    borderRadius:     20,
    paddingTop:       8,
    paddingBottom:    8,
    paddingHorizontal: 8,
    width:            SW * 0.82,
    borderWidth:      1,
    borderColor:      'rgba(192,132,252,0.15)',
  },
  optHandle: {
    width: 0, height: 0,
  },
  optHandleBar: {
    width:           36,
    height:          4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius:    2,
    alignSelf:       'center',
    marginBottom:    16,
  },
  optRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 0,
  },
  optText: {
    color:      '#fff',
    fontSize:   16,
    fontWeight: '600',
  },

  topGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 110, borderTopLeftRadius: 32, borderTopRightRadius: 32 },

  // Görüntüleyenler paneli — Instagram tarzı bottom sheet
  viewersPanel: {
    backgroundColor:      '#08060F',
    borderTopLeftRadius:  32,
    borderTopRightRadius: 32,
    paddingTop:           10,
    paddingHorizontal:    20,
    maxHeight:            SH * 0.68,
    width:                '100%',
    borderTopWidth:       1,
    borderTopColor:       'rgba(192,132,252,0.18)',
  },
  viewersHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   18,
    marginTop:      4,
  },
  viewersHeaderLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  viewersPanelTitle: {
    color:      '#fff',
    fontSize:   17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  viewersCountBadge: {
    backgroundColor: 'rgba(192,132,252,0.18)',
    borderRadius:    12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  viewersCountText: {
    color:      '#C084FC',
    fontSize:   13,
    fontWeight: '700',
  },
  viewersEmpty: {
    color:      'rgba(255,255,255,0.4)',
    textAlign:  'center',
    fontSize:   14,
  },
  viewerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
    paddingVertical: 11,
  },
  viewerDivider: {
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  viewerAvatarWrap: {
    position: 'relative',
  },
  viewerAvatar: {
    width:        46,
    height:       46,
    borderRadius: 23,
    backgroundColor: '#2D1F4E',
    borderWidth:  2,
    borderColor:  'rgba(192,132,252,0.35)',
  },
  viewerReactionBubble: {
    position:        'absolute',
    bottom:          -4,
    right:           -4,
    backgroundColor: '#1C1432',
    borderRadius:    10,
    width:           22,
    height:          22,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     1.5,
    borderColor:     '#0F0A1E',
  },
  viewerName: {
    color:         '#F8F8F8',
    fontSize:      14,
    fontWeight:    '600',
    letterSpacing: -0.2,
  },
  viewerSub: {
    color:    'rgba(248,248,248,0.45)',
    fontSize: 12,
    marginTop: 1,
  },
  viewerTime: {
    color:    'rgba(248,248,248,0.35)',
    fontSize: 11,
    flexShrink: 0,
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
    position:          'absolute',
    backgroundColor:   'rgba(12,5,28,0.88)',
    borderRadius:      22,
    paddingHorizontal: 16,
    paddingTop:        14,
    paddingBottom:     16,
    zIndex:            5,
    minWidth:          280,
    borderWidth:       1,
    borderColor:       'rgba(139,92,246,0.35)',
    shadowColor:       '#7C3AED',
    shadowOpacity:     0.25,
    shadowRadius:      16,
    shadowOffset:      { width: 0, height: 4 },
    elevation:         8,
  },
  pollHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
    marginBottom:   10,
  },
  pollLabel: {
    color:         '#C084FC',
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 1.4,
  },
  pollQ: {
    color:         '#F0EEFF',
    fontSize:      16,
    fontWeight:    '800',
    marginBottom:  12,
    letterSpacing: -0.2,
    lineHeight:    22,
  },
  pollOpt: {
    borderRadius:    12,
    overflow:        'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth:     1,
    borderColor:     'rgba(255,255,255,0.14)',
    marginBottom:    7,
  },
  pollOptSelected: {
    backgroundColor: 'rgba(139,92,246,0.22)',
    borderColor:     '#8B5CF6',
  },
  pollOptDim: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor:     'rgba(255,255,255,0.07)',
  },
  pollOptBarTrack: {
    position:      'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    flexDirection: 'row',
  },
  pollOptBar: {
    // flex dinamik verilir
  },
  pollOptRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 14,
    paddingVertical:   11,
  },
  pollOptText: {
    flex:       1,
    color:      '#fff',
    fontSize:   14,
    fontWeight: '600',
  },
  pollOptPct: {
    color:      '#fff',
    fontSize:   13,
    fontWeight: '700',
    marginLeft: 8,
    minWidth:   36,
    textAlign:  'right',
  },
  pollOwnerHint: {
    color:      '#fff',
    fontSize:   11,
    fontWeight: '600',
    textAlign:  'center',
    marginTop:  4,
  },

  // ── Soru çıkartması (Instagram stili) ──
  questionBox: {
    position:     'absolute',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop:   12,
    paddingBottom: 14,
    zIndex:       6,
  },
  questionHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            5,
    marginBottom:   10,
  },
  questionHeaderEmoji: {
    fontSize: 14,
  },
  questionHeaderLabel: {
    color:         'rgba(255,255,255,0.82)',
    fontSize:      11,
    fontWeight:    '800',
    letterSpacing: 1.4,
  },
  questionQ: {
    color:        '#fff',
    fontSize:     17,
    fontWeight:   '800',
    textAlign:    'center',
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  questionInputRow: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius:    30,
    paddingLeft:     16,
    paddingRight:    4,
    paddingVertical: 4,
    minHeight:       48,
    gap:             6,
  },
  questionInput: {
    flex:       1,
    color:      '#1a0030',
    fontSize:   14,
    fontWeight: '500',
    paddingVertical: 8,
    minHeight:  36,
  },
  questionSendBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: '#fff',
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#9333EA',
    shadowOpacity:   0.3,
    shadowRadius:    4,
    shadowOffset:    { width: 0, height: 2 },
    elevation:       3,
  },
  questionErrTx: {
    color:      'rgba(255,220,220,0.95)',
    fontSize:   12,
    fontWeight: '600',
    textAlign:  'center',
    marginTop:  6,
  },
  questionDone: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
    paddingVertical: 4,
  },
  questionDoneTx: {
    color:      '#fff',
    fontSize:   14,
    fontWeight: '700',
  },
  questionOwnerHint: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            5,
    paddingVertical: 4,
  },
  questionOwnerTx: {
    color:    'rgba(255,255,255,0.75)',
    fontSize: 13,
  },

  // ── DM paylaş ──
  dmShareBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems:      'center',
    justifyContent:  'center',
    marginRight:     4,
  },
  dmSearchRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    backgroundColor:   'rgba(255,255,255,0.07)',
    borderRadius:      16,
    paddingHorizontal: 12,
    paddingVertical:   9,
    marginBottom:      12,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.08)',
  },
  dmSearchInput: {
    flex:     1,
    color:    '#fff',
    fontSize: 14,
    padding:  0,
  },
  dmUserRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
    paddingVertical: 10,
  },
  dmUserAvatar: {
    width:        44,
    height:       44,
    borderRadius: 22,
    backgroundColor: '#2D1F4E',
  },
  dmUserName: {
    color:      '#F8F8F8',
    fontSize:   14,
    fontWeight: '600',
  },
  dmUserSub: {
    color:    'rgba(255,255,255,0.45)',
    fontSize: 12,
    marginTop: 1,
  },
  dmSendBtn: {
    paddingHorizontal: 16,
    paddingVertical:   7,
    borderRadius:      20,
    backgroundColor:   '#8B5CF6',
    alignItems:        'center',
    justifyContent:    'center',
  },
  dmSentBtn: {
    backgroundColor: 'rgba(192,132,252,0.12)',
    borderWidth:     1,
    borderColor:     'rgba(192,132,252,0.3)',
  },
  dmSendTx: {
    color:      '#fff',
    fontSize:   13,
    fontWeight: '700',
  },
});
