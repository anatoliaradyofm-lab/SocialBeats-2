/**
 * StoryCreateScreen — Instagram-style tek ekran hikaye oluşturucu
 * Canvas her zaman tam ekran, araçlar overlay olarak üste biner
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  TextInput, ActivityIndicator, FlatList,
  Dimensions, ScrollView, KeyboardAvoidingView,
  Platform, Pressable, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { useAuth } from '../contexts/AuthContext';
import api, { getApiUrl } from '../services/api';
import { Alert } from '../components/ui/AppAlert';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Sabitler ──────────────────────────────────────────────────────────────────

const GRADIENTS = [
  ['#7C3AED', '#4C1D95'],
  ['#EC4899', '#9D174D'],
  ['#06B6D4', '#0E7490'],
  ['#10B981', '#065F46'],
  ['#F59E0B', '#92400E'],
  ['#EF4444', '#991B1B'],
  ['#1E1B4B', '#312E81'],
  ['#18181B', '#09090B'],
];

const FILTERS = [
  { id: 'none',    label: 'Normal',  tint: null },
  { id: 'warm',    label: 'Sıcak',   tint: 'rgba(255,140,30,0.25)' },
  { id: 'cool',    label: 'Soğuk',   tint: 'rgba(30,100,255,0.25)' },
  { id: 'vintage', label: 'Vintage', tint: 'rgba(160,110,50,0.30)' },
  { id: 'noir',    label: 'Noir',    tint: 'rgba(0,0,0,0.50)' },
  { id: 'fade',    label: 'Fade',    tint: 'rgba(255,255,255,0.20)' },
];

const TEXT_STYLES = [
  { id: 'normal', label: 'Normal', color: '#fff', bg: 'transparent' },
  { id: 'white',  label: 'Beyaz',  color: '#111', bg: '#fff' },
  { id: 'black',  label: 'Siyah',  color: '#fff', bg: '#000' },
];

const formatSeconds = (s) => {
  const m = Math.floor((s || 0) / 60);
  const sec = Math.floor((s || 0) % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

// ── Filtre küçük önizlemesi ────────────────────────────────────────────────────
function FilterPill({ f, selected, onPress, mediaUri, gradient }) {
  return (
    <TouchableOpacity onPress={onPress} style={s.fpWrap}>
      <View style={[s.fpThumb, selected && s.fpThumbOn]}>
        {mediaUri
          ? <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          : <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />
        }
        {f.tint && <View style={[StyleSheet.absoluteFill, { backgroundColor: f.tint }]} />}
      </View>
      <Text style={[s.fpLabel, selected && s.fpLabelOn]}>{f.label}</Text>
    </TouchableOpacity>
  );
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────
export default function StoryCreateScreen({ navigation }) {
  const insets  = useSafeAreaInsets();
  const { token, isGuest } = useAuth();

  // Medya
  const [mediaUri,    setMediaUri]    = useState(null);
  const [mediaIsVideo, setMediaIsVideo] = useState(false);

  // Arka plan & filtre
  const [gradient, setGradient] = useState(GRADIENTS[0]);
  const [filter,   setFilter]   = useState('none');

  // Metin
  const [text,        setText]        = useState('');
  const [tsId,        setTsId]        = useState('normal');
  const [textAlign,   setTextAlign]   = useState('center');
  const [editingText, setEditingText] = useState(false);

  // Müzik
  const [music,          setMusic]          = useState(null);
  const [musicSheet,     setMusicSheet]     = useState(false);
  const [musicQ,         setMusicQ]         = useState('');
  const [musicList,      setMusicList]      = useState([]);
  const [musicLoad,      setMusicLoad]      = useState(false);
  const [previewingId,   setPreviewingId]   = useState(null);   // hangi şarkı preview'da
  const [musicStartTime, setMusicStartTime] = useState(0);      // seçilen başlangıç (sn)
  const [musicDuration,  setMusicDuration]  = useState(null);   // şarkı süresi
  const previewSoundRef = useRef(null);

  // Metin konumlandırma
  const [textScale,   setTextScale]   = useState(1);
  const [textPos,     setTextPos]     = useState(null);
  const [isDragging,  setIsDragging]  = useState(false);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const textPosRef       = useRef(null);
  const textBubbleLayout = useRef({ width: 0, height: 0 });
  const canvasLayout     = useRef({ width: 390, height: 844 });
  const canvasDomRef     = useRef(null);   // canvas container DOM elementi (web)
  const setEditingTextRef = useRef(null);
  const editingTextRef   = useRef(false);  // editingText'in güncel değeri
  const isOverTrashRef   = useRef(false);
  const TRASH_ZONE_H     = 180;

  // Metin silinince konum sıfırla
  useEffect(() => {
    if (!text.trim()) { textPosRef.current = null; setTextPos(null); }
  }, [text]);

  // Web drag — canvas container'a tek bir window mousedown listener.
  // Metin elementinin DOM lifecycle'ından bağımsız, her zaman çalışır.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onWindowMouseDown = (e) => {
      if (!textPosRef.current || editingTextRef.current) return;
      // Canvas DOM rect'i al
      const rect = canvasDomRef.current?.getBoundingClientRect?.();
      if (!rect) return;
      const scale = window.__phoneScale || 1;
      // Tıklama noktasını canvas-relative RN koordinatlarına çevir
      const relX = (e.clientX - rect.left) / scale;
      const relY = (e.clientY - rect.top)  / scale;
      // Metnin hit alanı
      const tx = textPosRef.current.x, ty = textPosRef.current.y;
      const bw = textBubbleLayout.current.width  || 80;
      const bh = textBubbleLayout.current.height || 40;
      const pad = 12;
      if (relX < tx - pad || relX > tx + bw + pad ||
          relY < ty - pad || relY > ty + bh + pad) return;
      // Drag başlat
      e.preventDefault();
      let moved = false;
      const cx0 = e.clientX, cy0 = e.clientY;
      const px0 = textPosRef.current.x, py0 = textPosRef.current.y;
      setIsDragging(true);

      const onMove = (ev) => {
        const sc = window.__phoneScale || 1;
        const dx = (ev.clientX - cx0) / sc;
        const dy = (ev.clientY - cy0) / sc;
        if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) moved = true;
        if (!moved) return;
        const cw = canvasLayout.current.width  || 390;
        const ch = canvasLayout.current.height || 844;
        const bw2 = textBubbleLayout.current.width  || 80;
        const bh2 = textBubbleLayout.current.height || 40;
        const nx = Math.max(0, Math.min(cw - bw2, px0 + dx));
        const ny = Math.max(0, Math.min(ch - bh2, py0 + dy));
        textPosRef.current = { x: nx, y: ny };
        setTextPos({ x: nx, y: ny });
        const over = ny + bh2 > ch - TRASH_ZONE_H;
        if (over !== isOverTrashRef.current) { isOverTrashRef.current = over; setIsOverTrash(over); }
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        if (isOverTrashRef.current) {
          setText(''); textPosRef.current = null; setTextPos(null); setTextScale(1);
        } else if (!moved) {
          setEditingTextRef.current?.(true);
        }
        isOverTrashRef.current = false; setIsOverTrash(false); setIsDragging(false);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };

    window.addEventListener('mousedown', onWindowMouseDown);
    return () => window.removeEventListener('mousedown', onWindowMouseDown);
  }, []); // Bir kez bağla, sonsuza dek çalışır

  // Native: Responder
  const nativeDragRef = useRef(null);
  const textHandlers = Platform.OS !== 'web' ? {
    onStartShouldSetResponder:    () => true,
    onResponderTerminationRequest:() => false,
    onResponderGrant: (e) => {
      const { pageX, pageY } = e.nativeEvent;
      nativeDragRef.current = { x: pageX, y: pageY, px: textPosRef.current?.x ?? 0, py: textPosRef.current?.y ?? 0, moved: false };
      setIsDragging(true);
    },
    onResponderMove: (e) => {
      const d = nativeDragRef.current; if (!d) return;
      const dx = e.nativeEvent.pageX - d.x, dy = e.nativeEvent.pageY - d.y;
      if (!d.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) d.moved = true;
      if (!d.moved) return;
      const cw = canvasLayout.current.width || 390, ch = canvasLayout.current.height || 844;
      const bw = textBubbleLayout.current.width || 80, bh = textBubbleLayout.current.height || 40;
      const nx = Math.max(0, Math.min(cw - bw, d.px + dx));
      const ny = Math.max(0, Math.min(ch - bh, d.py + dy));
      textPosRef.current = { x: nx, y: ny }; setTextPos({ x: nx, y: ny });
      const over = ny + bh > ch - TRASH_ZONE_H;
      if (over !== isOverTrashRef.current) { isOverTrashRef.current = over; setIsOverTrash(over); }
    },
    onResponderRelease: () => {
      const d = nativeDragRef.current; nativeDragRef.current = null;
      if (isOverTrashRef.current) {
        setText(''); textPosRef.current = null; setTextPos(null); setTextScale(1);
      } else if (!d?.moved) { setEditingTextRef.current?.(true); }
      isOverTrashRef.current = false; setIsOverTrash(false); setIsDragging(false);
    },
  } : {};

  // Fotoğraf zoom / pan
  const [photoScale,  setPhotoScale]  = useState(1);
  const [photoOffset, setPhotoOffset] = useState({ x: 0, y: 0 });
  const photoScaleRef  = useRef(1);
  const photoOffsetRef = useRef({ x: 0, y: 0 });
  const photoGestureStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  // Scrubber state & refs
  const [scrubBarW, setScrubBarW] = useState(SW - 80);
  const scrubBarWRef  = useRef(SW - 80);
  const scrubBaseTime = useRef(0);
  const scrubGestureX = useRef(0);
  const scrubLastSeek = useRef(0);   // throttle için

  // Diğer
  const [uploading, setUploading] = useState(false);

  // Stable ref'leri her render'da güncelle
  setEditingTextRef.current = setEditingText;
  editingTextRef.current    = editingText;

  // Hesaplananlar
  const ts           = TEXT_STYLES.find(t => t.id === tsId) ?? TEXT_STYLES[0];
  const activeFilter = FILTERS.find(f => f.id === filter) ?? FILTERS[0];

  // Guest guard
  useEffect(() => {
    if (isGuest || !token) {
      Alert.alert('Giriş Gerekli', 'Hikaye paylaşmak için giriş yapın.', [
        { text: 'İptal', onPress: () => navigation.goBack() },
        { text: 'Giriş Yap', onPress: () => { navigation.goBack(); navigation.navigate('Auth'); } },
      ]);
    }
  }, []);

  // ── Galeri (expo-image-picker v17) ────────────────────────────────────────
  const pickMedia = async () => {
    // v17: Android'de izin zorunlu
    if (Platform.OS === 'android') {
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Galeri İzni Gerekli',
            'Ayarlar > Uygulama İzinleri kısmından Depolama iznini açın.',
          );
          return;
        }
      } catch (_) { /* API yoksa geç */ }
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'], // v17 zorunlu format
        allowsEditing: false,
        quality: 0.9,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (asset?.uri) {
        setMediaUri(asset.uri);
        setMediaIsVideo(asset.type === 'video' || /\.(mp4|mov|mkv|webm)$/i.test(asset.uri));
      }
    } catch (e) {
      Alert.alert('Galeri Hatası', e?.message || 'Galeri açılamadı.');
    }
  };

  // ── Galeri'yi ekran açılınca otomatik aç ──────────────────────────────────
  useEffect(() => {
    if (!isGuest && token) {
      const t = setTimeout(pickMedia, 150);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Müzik preview temizle (ekran kapanınca) ───────────────────────────────
  useEffect(() => {
    return () => {
      previewSoundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  // ── Müzik preview oynat / durdur ─────────────────────────────────────────
  const togglePreview = useCallback(async (item) => {
    const rawUrl = item.audio_url || item.preview_url || item.stream_url;

    if (previewingId === item.id) {
      // Zaten bu çalıyor → durdur
      try { await previewSoundRef.current?.pauseAsync(); } catch {}
      setPreviewingId(null);
      return;
    }

    // Önceki sesi temizle
    try { await previewSoundRef.current?.unloadAsync(); } catch {}
    previewSoundRef.current = null;
    setPreviewingId(null);

    if (!rawUrl) {
      // Önizleme URL yok — sadece seç
      setMusic(item);
      setMusicStartTime(0);
      return;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Web: HTML5 Audio (expo-av CORS sorunları yaşıyor)
      try {
        // Göreli URL → Vite proxy (window.location.origin), mutlak URL → olduğu gibi
        let streamUrl = rawUrl.startsWith('http') ? rawUrl : `${window.location.origin}${rawUrl}`;
        // SoundCloud transcoding URL → JSON { "url": "cdn_url" } döndürür, çöz
        if (streamUrl.includes('sc-api') || streamUrl.includes('api-v2.soundcloud.com') ||
            streamUrl.includes('/stream/progressive') || streamUrl.includes('/stream/hls')) {
          try {
            const res = await fetch(streamUrl);
            const json = await res.json();
            if (json?.url) streamUrl = json.url;
          } catch {}
        }
        const audio = new window.Audio(streamUrl);
        audio.currentTime = musicStartTime;
        audio.play().catch(() => {});
        previewSoundRef.current = {
          pauseAsync:    () => { audio.pause(); return Promise.resolve(); },
          unloadAsync:   () => { audio.pause(); audio.src = ''; return Promise.resolve(); },
          seekAsync:     (s) => { try { audio.currentTime = s; } catch {} return Promise.resolve(); },
          playFromAsync: async (s) => { try { audio.currentTime = s; await audio.play(); } catch {} },
        };
        setPreviewingId(item.id);
        audio.addEventListener('loadedmetadata', () => {
          if (audio.duration && isFinite(audio.duration)) setMusicDuration(Math.floor(audio.duration));
        });
        setTimeout(() => { audio.pause(); setPreviewingId(null); }, 30000);
      } catch {
        setMusic(item); setMusicStartTime(0);
      }
    } else {
      // Native: expo-av
      try {
        const apiBase = (getApiUrl() || '').replace(/\/api\/?$/, '');
        const nativeUrl = rawUrl.startsWith('http') ? rawUrl : `${apiBase}${rawUrl}`;
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound, status } = await Audio.Sound.createAsync(
          { uri: nativeUrl },
          { shouldPlay: true, positionMillis: musicStartTime * 1000 },
        );
        previewSoundRef.current = sound;
        setPreviewingId(item.id);
        if (status.durationMillis) {
          setMusicDuration(Math.floor(status.durationMillis / 1000));
        }
        setTimeout(() => {
          sound.pauseAsync().catch(() => {});
          setPreviewingId(null);
        }, 30000);
      } catch {
        setMusic(item); setMusicStartTime(0);
      }
    }
  }, [previewingId, musicStartTime]);

  // ── Müzik arama ───────────────────────────────────────────────────────────
  const searchMusic = useCallback(async (q) => {
    if (!q?.trim()) { setMusicList([]); return; }
    setMusicLoad(true);
    try {
      const res = await api.get(`/music/search/${encodeURIComponent(q.trim())}`, token);
      setMusicList(res?.results || res?.songs || (Array.isArray(res) ? res : []));
    } catch { setMusicList([]); }
    setMusicLoad(false);
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => searchMusic(musicQ), 400);
    return () => clearTimeout(t);
  }, [musicQ]);

  // ── Paylaş ────────────────────────────────────────────────────────────────
  const submit = async () => {
    if (!mediaUri && !text.trim()) {
      Alert.alert('Uyarı', 'Hikayeye bir fotoğraf veya metin ekle.');
      return;
    }
    // Preview çalıyorsa durdur
    try { await previewSoundRef.current?.pauseAsync(); } catch {}
    setPreviewingId(null);
    setUploading(true);
    try {
      let mediaUrl = null;
      if (mediaUri) {
        try {
          mediaUrl = await api.uploadFile(
            mediaUri, token, 'story',
            mediaIsVideo ? 'video/mp4' : 'image/jpeg',
          );
        } catch (uploadErr) {
          // Upload başarısız — kullanıcıya sor, devam et mi?
          await new Promise((resolve) => {
            Alert.alert(
              'Medya Yüklenemedi',
              uploadErr?.message || 'Fotoğraf/video sunucuya gönderilemedi.',
              [
                { text: 'İptal', style: 'cancel', onPress: () => { setUploading(false); resolve('cancel'); } },
                { text: 'Yine de Paylaş', onPress: () => resolve('continue') },
              ],
            );
          }).then(choice => { if (choice === 'cancel') throw new Error('__cancelled__'); });
        }
      }
      const cw = canvasLayout.current.width  || 390;
      const ch = canvasLayout.current.height || 844;
      await api.post('/stories', {
        story_type        : mediaIsVideo ? 'video' : mediaUri ? 'photo' : 'text',
        text              : text.trim() || null,
        media_url         : mediaUrl,
        media_type        : mediaIsVideo ? 'video' : 'photo',
        background_color  : gradient[0],
        filter_id         : filter,
        ...(music && {
          music_track_id  : music.id || music.video_id,
          music_start_time: musicStartTime,
          music_track     : music,
        }),
        // Metin konumu (0-1 normalize)
        ...(text.trim() && textPosRef.current && {
          text_pos_x    : textPosRef.current.x / cw,
          text_pos_y    : textPosRef.current.y / ch,
          text_scale    : textScale,
          text_align    : textAlign,
          text_style_id : tsId,
        }),
        photo_scale    : photoScaleRef.current !== 1 ? photoScaleRef.current : undefined,
        photo_offset_x : photoOffsetRef.current.x || undefined,
        photo_offset_y : photoOffsetRef.current.y || undefined,
      }, token);
      // Pozisyonu sıfırla
      textPosRef.current = null;
      setTextPos(null);
      setTextScale(1);
      photoScaleRef.current = 1;
      photoOffsetRef.current = { x: 0, y: 0 };
      setPhotoScale(1);
      setPhotoOffset({ x: 0, y: 0 });
      Alert.alert('Paylaşıldı', 'Hikayen eklendi!', [
        { text: 'Tamam', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      if (e?.message === '__cancelled__') return;
      // FastAPI 422: e.data.detail dizi olabilir
      const detail = Array.isArray(e?.data?.detail)
        ? e.data.detail.map(d => d.msg || d.message || JSON.stringify(d)).join('\n')
        : (e?.data?.detail || e?.message || 'Paylaşılamadı.');
      Alert.alert('Hata', detail);
    } finally {
      setUploading(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── CANVAS ARKA PLAN ── */}
      {mediaUri
        ? (
          <>
            <Image
              source={{ uri: mediaUri }}
              style={[StyleSheet.absoluteFill, {
                transform: [
                  { translateX: photoOffset.x },
                  { translateY: photoOffset.y },
                  { scale: photoScale },
                ],
              }]}
              resizeMode="cover"
            />
            {/* Fotoğraf sürükleme alanı (metin yokken aktif) */}
            {!editingText && !text.trim() && (
              <View
                style={[StyleSheet.absoluteFill, { zIndex: 0 }]}
                onStartShouldSetResponder={() => true}
                onResponderGrant={(e) => {
                  photoGestureStart.current = {
                    x: e.nativeEvent.pageX, y: e.nativeEvent.pageY,
                    ox: photoOffsetRef.current.x, oy: photoOffsetRef.current.y,
                  };
                }}
                onResponderMove={(e) => {
                  const dx = e.nativeEvent.pageX - photoGestureStart.current.x;
                  const dy = e.nativeEvent.pageY - photoGestureStart.current.y;
                  const maxOff = Math.max(0, (photoScaleRef.current - 1) * SW * 0.5 + 60);
                  const nx = Math.max(-maxOff, Math.min(maxOff, photoGestureStart.current.ox + dx));
                  const ny = Math.max(-maxOff, Math.min(maxOff, photoGestureStart.current.oy + dy));
                  photoOffsetRef.current = { x: nx, y: ny };
                  setPhotoOffset({ x: nx, y: ny });
                }}
              />
            )}
            {/* Zoom +/- butonları */}
            {!editingText && (
              <View style={s.photoZoomBtns}>
                <TouchableOpacity style={s.photoZoomBtn} onPress={() => {
                  const ns = Math.min(4, photoScaleRef.current + 0.25);
                  photoScaleRef.current = ns; setPhotoScale(ns);
                }}>
                  <Ionicons name="add" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={s.photoZoomBtn} onPress={() => {
                  const ns = Math.max(1, photoScaleRef.current - 0.25);
                  photoScaleRef.current = ns; setPhotoScale(ns);
                  if (ns <= 1) { photoOffsetRef.current = { x: 0, y: 0 }; setPhotoOffset({ x: 0, y: 0 }); }
                }}>
                  <Ionicons name="remove" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </>
        )
        : <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} />
      }

      {/* Filtre tinti */}
      {activeFilter.tint && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: activeFilter.tint }]}
        />
      )}

      {/* ── CANVAS ORTA ALAN ── */}
      <View
        ref={Platform.OS === 'web' ? canvasDomRef : undefined}
        style={s.canvasMiddle}
        pointerEvents="box-none"
        onLayout={(e) => { canvasLayout.current = e.nativeEvent.layout; }}
      >
        {/* Sürüklenebilir metin */}
        {text.trim() && !editingText ? (
          <View
            pointerEvents="auto"
            onLayout={(e) => {
              const lay = e.nativeEvent.layout;
              textBubbleLayout.current = { width: lay.width, height: lay.height };
              const cw = canvasLayout.current.width  || 390;
              const ch = canvasLayout.current.height || 844;
              if (!textPosRef.current) {
                const cx = Math.max(0, (cw - lay.width)  / 2);
                const cy = Math.max(0, (ch - lay.height) / 2);
                textPosRef.current = { x: cx, y: cy };
                setTextPos({ x: cx, y: cy });
              } else {
                const nx = Math.max(0, Math.min(cw - lay.width,  textPosRef.current.x));
                const ny = Math.max(0, Math.min(ch - lay.height, textPosRef.current.y));
                if (nx !== textPosRef.current.x || ny !== textPosRef.current.y) {
                  textPosRef.current = { x: nx, y: ny };
                  setTextPos({ x: nx, y: ny });
                }
              }
            }}
            style={[
              s.draggableText,
              { position: 'absolute', left: textPos?.x ?? 0, top: textPos?.y ?? 0 },
              !textPos && { opacity: 0 },
              Platform.OS === 'web' && { cursor: 'grab', userSelect: 'none' },
            ]}
            {...textHandlers}
          >
            <View style={[s.textBubble, {
              backgroundColor: ts.bg === 'transparent' ? 'transparent' : ts.bg,
              maxWidth: canvasLayout.current.width - 32,
            }]}>
              <Text
                style={[s.textOut, {
                  color: ts.color,
                  textAlign,
                  fontSize: Math.max(14, Math.min(72, Math.round(480 / Math.max(10, text.length) * textScale))),
                }]}
              >
                {text}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Metin yokken ipucu */}
        {!text.trim() && !editingText && (
          <TouchableOpacity onPress={() => setEditingText(true)} activeOpacity={0.6}>
            <Text style={s.canvasHintTxt}>Aa</Text>
            <Text style={s.canvasHintSub}>Metin eklemek için dokun</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Müzik chip */}
      {music && (
        <TouchableOpacity style={s.chip} onPress={() => setMusic(null)}>
          <Ionicons name="musical-notes" size={13} color="#fff" />
          <Text style={s.chipTxt} numberOfLines={1}>{music.title || music.name}</Text>
          <Ionicons name="close" size={14} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      )}


      {/* ── ÜST BAR ── */}
      {!editingText && (
        <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <View style={s.toolCol}>
            <TouchableOpacity style={s.iconBtn} onPress={() => setEditingText(true)}>
              <Text style={s.aaText}>Aa</Text>
            </TouchableOpacity>
            {text.trim() && !editingText && (
              <TouchableOpacity style={s.iconBtn} onPress={() => setTextScale(v => Math.min(3.0, v + 0.2))}>
                <Text style={s.aaText}>A+</Text>
              </TouchableOpacity>
            )}
            {text.trim() && !editingText && (
              <TouchableOpacity style={s.iconBtn} onPress={() => setTextScale(v => Math.max(0.4, v - 0.2))}>
                <Text style={[s.aaText, { fontSize: 12 }]}>A−</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.iconBtn, music && s.iconBtnOn]}
              onPress={() => setMusicSheet(true)}
            >
              <Ionicons
                name="musical-notes-outline"
                size={22}
                color={music ? '#C084FC' : '#fff'}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── ALT BAR ── */}
      {!editingText && (
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.75)']}
          style={[s.bottomBar, { paddingBottom: insets.bottom + 8 }]}
        >
          {/* Gradient renk seçici — medya yoksa */}
          {!mediaUri && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.gradRow}
              contentContainerStyle={s.gradRowContent}
            >
              {GRADIENTS.map((g, i) => (
                <TouchableOpacity key={i} onPress={() => setGradient(g)}>
                  <LinearGradient
                    colors={g}
                    style={[s.gradDot, gradient === g && s.gradDotOn]}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Filtre şeridi — medya varsa */}
          {mediaUri && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.filterRow}
              contentContainerStyle={s.filterRowContent}
            >
              {FILTERS.map(f => (
                <FilterPill
                  key={f.id}
                  f={f}
                  selected={filter === f.id}
                  onPress={() => setFilter(f.id)}
                  mediaUri={mediaUri}
                  gradient={gradient}
                />
              ))}
            </ScrollView>
          )}

          {/* Fotoğraf/Video + Paylaş */}
          <View style={s.actionRow}>
            <TouchableOpacity style={s.galleryBtn} onPress={pickMedia}>
              <Ionicons name="images-outline" size={22} color="#fff" />
              <Text style={s.galleryBtnTxt}>
                {mediaUri ? 'Değiştir' : 'Fotoğraf / Video'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.shareBtn, uploading && { opacity: 0.5 }]}
              onPress={submit}
              disabled={uploading}
            >
              {uploading
                ? <ActivityIndicator size="small" color="#fff" />
                : <>
                    <Text style={s.shareBtnTxt}>Hikayene Ekle</Text>
                    <Ionicons name="chevron-forward" size={16} color="#fff" />
                  </>
              }
            </TouchableOpacity>
          </View>

        </LinearGradient>
      )}

      {/* ── METİN DÜZENLEYICI OVERLAY ── */}
      {editingText && (
        <View style={[StyleSheet.absoluteFill, s.editorBg]}>
          {/* Dışarı tıklayınca kapat */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditingText(false)} />
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            pointerEvents="box-none"
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {/* Üst kontroller */}
            <View style={[s.editorTop, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity style={s.iconBtn} onPress={() => setEditingText(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={s.alignBtn}
                onPress={() => setTextAlign(a =>
                  a === 'center' ? 'left' : a === 'left' ? 'right' : 'center'
                )}
              >
                <Ionicons
                  name={
                    textAlign === 'center' ? 'menu-outline' :
                    textAlign === 'left'   ? 'reorder-four-outline' :
                                             'reorder-three-outline'
                  }
                  size={20}
                  color="#fff"
                />
              </TouchableOpacity>

              <View style={{ flex: 1 }} />

              <TouchableOpacity
                style={s.doneBtn}
                onPress={() => setEditingText(false)}
              >
                <Text style={s.doneTxt}>Bitti</Text>
              </TouchableOpacity>
            </View>

            {/* Input alanı — tüm metin görünür, gerekirse scroll */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={s.editorCanvas}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {(() => {
                const editorFontSize = Math.max(14, Math.min(72, Math.round(480 / Math.max(10, text.length || 10) * textScale)));
                return (
                  <View style={[
                    s.editorBubble,
                    { backgroundColor: ts.bg === 'transparent' ? 'transparent' : ts.bg },
                  ]}>
                    <TextInput
                      style={[s.editorInput, {
                        color: ts.color,
                        textAlign,
                        fontSize: editorFontSize,
                        lineHeight: Math.max(20, Math.round(editorFontSize * 1.3)),
                      }]}
                      placeholder="Bir şey yaz..."
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      value={text}
                      onChangeText={setText}
                      multiline
                      scrollEnabled={false}
                      autoFocus
                      maxLength={200}
                      textAlignVertical="top"
                    />
                  </View>
                );
              })()}
            </ScrollView>

            {/* Yazı stili seçici — klavye üstünde */}
            <View style={s.styleBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.styleBarContent}
              >
                {TEXT_STYLES.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      s.stylePill,
                      { backgroundColor: t.bg === 'transparent' ? 'rgba(255,255,255,0.12)' : t.bg },
                      t.id === tsId && s.stylePillOn,
                    ]}
                    onPress={() => setTsId(t.id)}
                  >
                    <Text style={[s.stylePillTxt, { color: t.color }]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* ── SÜRÜKLEME ÇÖP KUTUSU ── */}
      {isDragging && !editingText && (
        <View
          pointerEvents="none"
          style={[s.trashZone, isOverTrash && s.trashZoneActive]}
        >
          <Ionicons
            name={isOverTrash ? 'trash' : 'trash-outline'}
            size={26}
            color="#fff"
          />
          <Text style={s.trashZoneTxt}>Sil</Text>
        </View>
      )}

      {/* ── MÜZİK PANELİ — View + TouchableOpacity arka plan (scrubber touch'ı engellenmez) ── */}
      {musicSheet && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 30 }]}>
          <TouchableOpacity
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,6,15,0.82)' }]}
            activeOpacity={1}
            onPress={() => {
              previewSoundRef.current?.pauseAsync().catch(() => {});
              setPreviewingId(null);
              setMusicSheet(false);
            }}
          />
          <View style={[s.sheet, { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: insets.bottom + 16 }]} onStartShouldSetResponder={() => true}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Müzik Ekle</Text>

            <TextInput
              style={s.sheetInput}
              placeholder="Şarkı veya sanatçı ara..."
              placeholderTextColor="rgba(248,248,248,0.35)"
              value={musicQ}
              onChangeText={setMusicQ}
              autoFocus
              selectionColor="#C084FC"
            />

            {musicLoad
              ? <ActivityIndicator color="#C084FC" style={{ marginVertical: 24 }} />
              : <FlatList
                  data={musicList}
                  keyExtractor={(item, i) => item.id || item.video_id || String(i)}
                  style={{ maxHeight: Math.min(SH * 0.28, 200) }}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const isPlaying  = previewingId === item.id;
                    const isSelected = music?.id === item.id;
                    return (
                      <TouchableOpacity
                        style={[s.resultRow, isSelected && s.resultRowSelected]}
                        onPress={() => {
                          setMusic(item);
                          setMusicStartTime(0);
                          togglePreview(item);
                        }}
                      >
                        <View style={[s.resultIcon, isPlaying && s.resultIconPlaying]}>
                          <Ionicons
                            name={isPlaying ? 'pause' : 'musical-notes'}
                            size={18}
                            color="#C084FC"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.resultTitle} numberOfLines={1}>
                            {item.title || item.name}
                          </Text>
                          <Text style={s.resultSub} numberOfLines={1}>
                            {item.artist || item.uploader || ''}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color="#C084FC" />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <Text style={s.emptyTxt}>
                      {musicQ.trim() ? 'Sonuç bulunamadı' : 'Şarkı adı yaz...'}
                    </Text>
                  }
                />
            }

            {/* Bölüm seçici — Instagram tarzı görsel scrubber */}
            {music && (() => {
              const dur = musicDuration || 0;
              const segLeft  = dur > 0 ? (musicStartTime / dur) * scrubBarW : 0;
              const segWidth = dur > 0 ? Math.min(scrubBarW - segLeft, (30 / dur) * scrubBarW) : scrubBarW * 0.25;
              return (
                <View style={s.scrubContainer}>
                  {/* Zaman etiketleri */}
                  <View style={s.scrubTimeRow}>
                    <Text style={s.scrubTimeTxt}>{formatSeconds(musicStartTime)}</Text>
                    <View style={s.scrubPill}>
                      <Ionicons name="musical-notes" size={11} color="#C084FC" />
                      <Text style={s.scrubPillTxt}>30 saniyelik klip</Text>
                    </View>
                    <Text style={s.scrubTimeTxt}>
                      {dur > 0 ? formatSeconds(Math.min(dur, musicStartTime + 30)) : '0:30'}
                    </Text>
                  </View>

                  {/* Scrubber track */}
                  <View
                    style={s.scrubTrackOuter}
                    onLayout={(e) => {
                      const w = e.nativeEvent.layout.width;
                      setScrubBarW(w);
                      scrubBarWRef.current = w;
                    }}
                    onStartShouldSetResponder={() => true}
                    onResponderGrant={(e) => {
                      scrubBaseTime.current = musicStartTime;
                      scrubGestureX.current = e.nativeEvent.pageX;
                      scrubLastSeek.current = 0;
                      // Dokunulan noktaya hemen atla
                      const lx = Math.max(0, Math.min(scrubBarWRef.current, e.nativeEvent.locationX ?? 0));
                      const d = musicDuration || 120;
                      const newStart = Math.max(0, Math.min(d - 30, (lx / scrubBarWRef.current) * d));
                      setMusicStartTime(newStart);
                      scrubBaseTime.current = newStart;
                    }}
                    onResponderMove={(e) => {
                      const dx = e.nativeEvent.pageX - scrubGestureX.current;
                      const d  = musicDuration || 120;
                      const dt = (dx / scrubBarWRef.current) * d;
                      const newStart = Math.max(0, Math.min(d - 30, scrubBaseTime.current + dt));
                      setMusicStartTime(newStart);
                      // Sürükleme sırasında throttled seek (80ms)
                      const now = Date.now();
                      if (now - scrubLastSeek.current > 80) {
                        scrubLastSeek.current = now;
                        previewSoundRef.current?.seekAsync?.(newStart);
                        previewSoundRef.current?.setPositionAsync?.(newStart * 1000);
                      }
                    }}
                    onResponderRelease={() => {
                      // Bırakınca kesin konuma atla
                      previewSoundRef.current?.seekAsync?.(musicStartTime);
                      previewSoundRef.current?.setPositionAsync?.(musicStartTime * 1000);
                    }}
                  >
                    {/* Tam parça arka plan */}
                    <View style={s.scrubTrackBg} />
                    {/* Seçili 30 saniyelik segment */}
                    <View style={[s.scrubSegment, { left: segLeft, width: Math.max(4, segWidth) }]} />
                    {/* Başlangıç tutacağı */}
                    <View style={[s.scrubHandle, { left: Math.max(0, segLeft - 10) }]} />
                  </View>

                  <Text style={s.scrubHint}>Klip başlangıcını seçmek için kaydır</Text>
                </View>
              );
            })()}

            {music && (
              <TouchableOpacity
                style={s.removeBtn}
                onPress={() => {
                  setMusic(null);
                  setMusicStartTime(0);
                  previewSoundRef.current?.pauseAsync().catch(() => {});
                  setPreviewingId(null);
                }}
              >
                <Text style={s.removeTxt}>Müziği Kaldır</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={s.actionBtn}
              onPress={async () => {
                if (music) {
                  if (previewingId === music.id) {
                    // Çalıyor — seçilen konuma atla ve devam et
                    await previewSoundRef.current?.playFromAsync?.(musicStartTime);
                  } else {
                    // Çalmıyor — başlat
                    await togglePreview(music);
                  }
                }
                setMusicSheet(false);
                setMusicQ('');
                setMusicList([]);
              }}
            >
              <Text style={s.actionBtnTxt}>Bitti</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08060F' },

  // ── Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 14, zIndex: 10, elevation: 20,
  },
  toolCol: { alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnOn: {
    backgroundColor: 'rgba(192,132,252,0.22)',
    borderWidth: 1, borderColor: '#C084FC',
  },
  aaText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  // ── Canvas orta alan (butonları bloke etmez, tam ekran)
  canvasMiddle: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  // ── Sürüklenebilir metin container
  draggableText: {
    alignItems: 'center',
    justifyContent: 'center',
    // Web: outline/border gösterme
    ...( Platform.OS === 'web' && { outlineStyle: 'none', outlineWidth: 0 }),
  },
  canvasHintTxt: {
    color: 'rgba(255,255,255,0.70)', fontSize: 52, fontWeight: '300',
    letterSpacing: -1, textAlign: 'center',
  },
  canvasHintSub: {
    color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6, textAlign: 'center',
  },

  // ── Text bubble (canvasMiddle içinde)
  textBubble: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
    alignSelf: 'center',
  },
  textOut: { fontWeight: '800', flexShrink: 1, flexWrap: 'wrap' },

  // ── Fotoğraf zoom butonları
  photoZoomBtns: {
    position: 'absolute', right: 16, bottom: 200,
    flexDirection: 'column', gap: 8, zIndex: 5,
  },
  photoZoomBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },

  // ── Chips
  chip: {
    position: 'absolute', bottom: 210, left: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(192,132,252,0.30)',
    maxWidth: SW - 32, zIndex: 3, elevation: 5,
  },
  chipPoll: { bottom: 240 },
  chipTxt: { color: '#fff', fontSize: 13, fontWeight: '500', flexShrink: 1 },

  // ── Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingTop: 8, zIndex: 10, elevation: 20,
  },
  gradRow:        { flexGrow: 0, marginBottom: 14 },
  gradRowContent: { paddingHorizontal: 16, gap: 10, alignItems: 'center' },
  gradDot:        { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  gradDotOn:      { borderColor: '#fff' },

  filterRow:        { flexGrow: 0, marginBottom: 10 },
  filterRowContent: { paddingHorizontal: 12, gap: 8 },
  fpWrap:    { alignItems: 'center', gap: 4 },
  fpThumb:   { width: 50, height: 72, borderRadius: 9, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  fpThumbOn: { borderColor: '#fff' },
  fpLabel:   { color: 'rgba(255,255,255,0.40)', fontSize: 11 },
  fpLabelOn: { color: '#fff', fontWeight: '600' },

  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, gap: 10,
  },
  galleryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 13, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)',
  },
  galleryBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
  shareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 5,
    backgroundColor: '#9333EA', borderRadius: 24, paddingVertical: 13,
  },
  shareBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // ── Text editor overlay
  editorBg: { backgroundColor: 'rgba(8,6,15,0.88)', zIndex: 20 },
  editorTop: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 8, gap: 8,
  },
  alignBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  doneBtn: {
    paddingHorizontal: 20, paddingVertical: 8,
    backgroundColor: '#fff', borderRadius: 20,
  },
  doneTxt: { color: '#000', fontSize: 14, fontWeight: '700' },
  editorCanvas: {
    // minHeight:'100%' → kısa metinde ortalanır, uzun metinde üstten büyür; kayma olmaz
    minHeight: '100%', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, paddingVertical: 20,
  },
  editorBubble: {
    width: '100%', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 16,
  },
  editorInput: {
    fontWeight: '700',
    minHeight: 48, paddingVertical: 0,
    ...( Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  // ── Sürükleme çöp kutusu
  trashZone: {
    position: 'absolute', bottom: 175,
    left: '20%', right: '20%',
    paddingVertical: 14, borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.70)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center', gap: 4,
    zIndex: 12,
  },
  trashZoneActive: {
    backgroundColor: 'rgba(220,38,38,0.82)',
    borderColor: '#F87171',
  },
  trashZoneTxt: {
    color: '#fff', fontSize: 12, fontWeight: '600',
  },
  styleBar: {
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  styleBarContent: { paddingHorizontal: 14, paddingVertical: 12, gap: 8, alignItems: 'center' },
  stylePill: {
    paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 22, borderWidth: 2, borderColor: 'transparent',
  },
  stylePillOn:  { borderColor: '#fff' },
  stylePillTxt: { fontSize: 14, fontWeight: '700' },

  // ── Sheets (QENARA palette)
  sheetBg: {
    flex: 1, backgroundColor: 'rgba(8,6,15,0.82)', justifyContent: 'flex-end',
    // web: absoluteFill kullanır, bu flex 1 işe yarar
  },
  sheet: {
    backgroundColor: '#1C1432',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20,
    borderTopWidth: 1, borderColor: 'rgba(192,132,252,0.12)',
  },
  handle: {
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginBottom: 16,
  },
  sheetTitle: { color: '#F8F8F8', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  sheetInput: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#F8F8F8', marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  resultRowSelected: {
    backgroundColor: 'rgba(192,132,252,0.08)', borderRadius: 12, paddingHorizontal: 6,
  },
  resultIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(192,132,252,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  resultIconPlaying: {
    backgroundColor: 'rgba(192,132,252,0.28)',
    borderWidth: 1, borderColor: 'rgba(192,132,252,0.5)',
  },
  resultTitle: { color: '#F8F8F8', fontSize: 14, fontWeight: '600' },
  resultSub:   { color: 'rgba(248,248,248,0.45)', fontSize: 12, marginTop: 1 },
  emptyTxt:    { color: 'rgba(248,248,248,0.35)', textAlign: 'center', paddingVertical: 24, fontSize: 14 },

  // ── Scrubber — Instagram tarzı klip seçici
  scrubContainer: {
    marginTop: 14,
    backgroundColor: 'rgba(192,132,252,0.07)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.18)',
  },
  scrubTimeRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  scrubTimeTxt: { color: '#C084FC', fontSize: 13, fontWeight: '700', minWidth: 36 },
  scrubPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(192,132,252,0.15)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  scrubPillTxt: { color: 'rgba(248,248,248,0.70)', fontSize: 11, fontWeight: '500' },
  scrubTrackOuter: {
    width: '100%', height: 56,
    justifyContent: 'center',
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  scrubTrackBg: {
    position: 'absolute',
    top: 24, left: 0, right: 0, height: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 4,
  },
  scrubSegment: {
    position: 'absolute',
    top: 20, height: 16,
    backgroundColor: '#9333EA',
    borderRadius: 4,
    opacity: 0.85,
  },
  scrubHandle: {
    position: 'absolute',
    top: 18,
    width: 20, height: 20,
    borderRadius: 10,
    backgroundColor: '#C084FC',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#C084FC',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  scrubHint: {
    color: 'rgba(255,255,255,0.28)', fontSize: 11,
    textAlign: 'center', marginTop: 8,
  },

  removeBtn: {
    borderRadius: 14, paddingVertical: 12, alignItems: 'center',
    marginTop: 8, borderWidth: 1, borderColor: 'rgba(248,113,113,0.40)',
    backgroundColor: 'rgba(248,113,113,0.06)',
  },
  removeTxt:     { color: '#F87171', fontSize: 14, fontWeight: '600' },
  actionBtn:     { backgroundColor: '#9333EA', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  actionBtnTxt:  { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});
