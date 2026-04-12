/**
 * StoryCreateScreen — Instagram-style tek ekran hikaye oluşturucu
 * Canvas her zaman tam ekran, araçlar overlay olarak üste biner
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  TextInput, ActivityIndicator, FlatList,
  Dimensions, ScrollView, KeyboardAvoidingView,
  Platform, Pressable, StatusBar, Linking,
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
  { id: 'bold',        fontWeight: '800', fontStyle: 'normal' },
  { id: 'italic',      fontWeight: '400', fontStyle: 'italic' },
  { id: 'bold-italic', fontWeight: '800', fontStyle: 'italic' },
  { id: 'light',       fontWeight: '200', fontStyle: 'normal' },
  { id: 'medium',      fontWeight: '500', fontStyle: 'normal' },
  { id: 'neon',        fontWeight: '800', fontStyle: 'normal', glow: true },
];

// Arka plan döngüsü: şeffaf → beyaz → siyah → şeffaf
const TEXT_BGS = ['transparent', '#fff', '#000'];

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

// ── Çöp kutusu sabitleri (DraggableSticker içinde kullanılır) ─────────────────
const DS_TRASH = {
  position: 'absolute', bottom: 175,
  left: '18%', right: '18%',
  paddingVertical: 14, borderRadius: 30,
  backgroundColor: 'rgba(0,0,0,0.72)',
  alignItems: 'center', justifyContent: 'center', gap: 4,
  zIndex: 14, elevation: 20,
};
const DS_TRASH_ACTIVE = { backgroundColor: 'rgba(220,38,38,0.85)' };
const DS_TRASH_TXT    = { color: '#fff', fontSize: 12, fontWeight: '600' };

// ── Sürüklenebilir çıkartma wrapper ──────────────────────────────────────────
// Web'de RN View ref'leri DOM element değil — text drag gibi window-level
// mousedown + sınır kontrolü kullanıyoruz (canvasDomRef koordinat dönüşümü için).
const SNAP_THRESHOLD = 18;

function DraggableSticker({ posRef, setPos, canvasLayout, canvasDomRef, onDelete, onTap, scaleRef, setScale, onSnap, children }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const isOverTrashRef = useRef(false);
  const stickerSize    = useRef({ width: 160, height: 70 });
  const nativeDrag     = useRef(null);
  const nativePinch    = useRef(null);
  const TRASH_H        = 180;

  const h = useRef(null);
  h.current = { posRef, setPos, canvasLayout, canvasDomRef,
                stickerSize, isOverTrashRef, onDelete, onTap,
                setIsDragging, setIsOverTrash, scaleRef, setScale, onSnap };

  const applySnap = (nx, ny, cw, ch, bw, bh) => {
    const cx = (cw - bw) / 2, cy = (ch - bh) / 2;
    const sx = Math.abs(nx - cx) < SNAP_THRESHOLD;
    const sy = Math.abs(ny - cy) < SNAP_THRESHOLD;
    h.current.onSnap?.({ x: sx, y: sy });
    return { x: sx ? cx : nx, y: sy ? cy : ny };
  };

  // Web: text drag ile aynı yaklaşım — window'a bağlan, sınır kontrolü yap
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onWindowMouseDown = (e) => {
      const { posRef: pr, canvasDomRef: cdr, stickerSize: ss } = h.current;
      if (!pr.current) return;

      // Canvas'ın ekran konumunu al (text drag ile aynı)
      const rect = cdr?.current?.getBoundingClientRect?.();
      if (!rect) return;
      const scale = window.__phoneScale || 1;

      // Tıklama → canvas koordinatları
      const mx = (e.clientX - rect.left) / scale;
      const my = (e.clientY - rect.top)  / scale;

      // Sticker sınır kontrolü (8px margin)
      const sx = pr.current.x, sy = pr.current.y;
      const sw = ss.current.width, sh = ss.current.height;
      if (mx < sx - 8 || mx > sx + sw + 8 || my < sy - 8 || my > sy + sh + 8) return;

      e.preventDefault();
      const { setPos: sp, canvasLayout: cl, isOverTrashRef: iotr,
              setIsDragging: sid, setIsOverTrash: siot } = h.current;

      const cx0 = e.clientX, cy0 = e.clientY;
      const px0 = pr.current.x, py0 = pr.current.y;
      let moved = false;
      sid(true);

      const onMove = (ev) => {
        const { posRef: pr2, setPos: sp2, canvasLayout: cl2, stickerSize: ss2,
                isOverTrashRef: iotr2, setIsOverTrash: siot2 } = h.current;
        const dx = (ev.clientX - cx0) / scale, dy = (ev.clientY - cy0) / scale;
        if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) moved = true;
        if (!moved) return;
        const cw = cl2.current.width || 390, ch = cl2.current.height || 844;
        const bw = ss2.current.width,  bh = ss2.current.height;
        let nx = Math.max(0, Math.min(cw - bw, px0 + dx));
        let ny = Math.max(0, Math.min(ch - bh, py0 + dy));
        const snapped = applySnap(nx, ny, cw, ch, bw, bh);
        nx = snapped.x; ny = snapped.y;
        pr2.current = { x: nx, y: ny };
        sp2({ x: nx, y: ny });
        const over = ny + bh > ch - TRASH_H;
        if (over !== iotr2.current) { iotr2.current = over; siot2(over); }
      };

      const onUp = () => {
        const { isOverTrashRef: iotr3, onDelete: od3, onTap: ot3,
                setIsDragging: sid3, setIsOverTrash: siot3 } = h.current;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup',   onUp);
        h.current.onSnap?.({ x: false, y: false });
        if (iotr3.current) { od3?.(); }
        else if (!moved)   { ot3?.(); }
        iotr3.current = false; siot3(false); sid3(false);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup',   onUp);
    };

    // Web'de fare tekerleği ile ölçek — yalnızca scaleRef olan sticker'larda aktif
    const onWindowWheel = (e) => {
      const { posRef: pr, canvasDomRef: cdr, stickerSize: ss, scaleRef: sr, setScale: ssc } = h.current;
      if (!pr.current || !sr || !ssc) return;
      const rect = cdr?.current?.getBoundingClientRect?.();
      if (!rect) return;
      const scale = window.__phoneScale || 1;
      const mx = (e.clientX - rect.left) / scale;
      const my = (e.clientY - rect.top)  / scale;
      const sx = pr.current.x, sy = pr.current.y;
      const sw = ss.current.width, sh = ss.current.height;
      if (mx < sx - 8 || mx > sx + sw + 8 || my < sy - 8 || my > sy + sh + 8) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.max(0.4, Math.min(3.0, (sr.current ?? 1) + delta));
      sr.current = newScale;
      ssc(newScale);
    };

    window.addEventListener('mousedown', onWindowMouseDown);
    window.addEventListener('wheel', onWindowWheel, { passive: false });
    return () => {
      window.removeEventListener('mousedown', onWindowMouseDown);
      window.removeEventListener('wheel', onWindowWheel);
    };
  }, []); // Sadece mount'ta — h.current her render'da taze

  // Native: responder (sürükleme + iki parmak ölçekleme)
  const nativeH = Platform.OS !== 'web' ? {
    onStartShouldSetResponder:    () => true,
    onResponderTerminationRequest:() => false,
    onResponderGrant: (e) => {
      nativeDrag.current = {
        x: e.nativeEvent.pageX, y: e.nativeEvent.pageY,
        px: posRef.current?.x ?? 0, py: posRef.current?.y ?? 0, moved: false,
      };
      nativePinch.current = null;
      setIsDragging(true);
    },
    onResponderMove: (e) => {
      const touches = e.nativeEvent.touches;
      // İki parmak → pinch ölçekleme
      if (touches && touches.length >= 2 && scaleRef && setScale) {
        const dx = touches[0].pageX - touches[1].pageX;
        const dy = touches[0].pageY - touches[1].pageY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (!nativePinch.current) {
          nativePinch.current = { dist, scale: scaleRef.current ?? 1 };
        } else {
          const newScale = Math.max(0.4, Math.min(3.0,
            nativePinch.current.scale * dist / nativePinch.current.dist,
          ));
          scaleRef.current = newScale;
          setScale(newScale);
        }
        return;
      }
      // Tek parmak → sürükleme
      nativePinch.current = null;
      const d = nativeDrag.current; if (!d) return;
      const dx = e.nativeEvent.pageX - d.x, dy = e.nativeEvent.pageY - d.y;
      if (!d.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) d.moved = true;
      if (!d.moved) return;
      const cw = canvasLayout.current.width  || 390;
      const ch = canvasLayout.current.height || 844;
      const bw = stickerSize.current.width, bh = stickerSize.current.height;
      let nx = Math.max(0, Math.min(cw - bw, d.px + dx));
      let ny = Math.max(0, Math.min(ch - bh, d.py + dy));
      const snapped = applySnap(nx, ny, cw, ch, bw, bh);
      nx = snapped.x; ny = snapped.y;
      posRef.current = { x: nx, y: ny }; setPos({ x: nx, y: ny });
      const over = ny + bh > ch - TRASH_H;
      if (over !== isOverTrashRef.current) { isOverTrashRef.current = over; setIsOverTrash(over); }
    },
    onResponderRelease: () => {
      nativePinch.current = null;
      const d = nativeDrag.current; nativeDrag.current = null;
      onSnap?.({ x: false, y: false });
      if (isOverTrashRef.current) { onDelete?.(); }
      else if (!d?.moved)         { onTap?.(); }
      isOverTrashRef.current = false; setIsOverTrash(false); setIsDragging(false);
    },
  } : {};

  const p = posRef.current;
  return (
    <>
      <View
        style={[
          { position: 'absolute', left: p?.x ?? 0, top: p?.y ?? 0, zIndex: 4, elevation: 6 },
          !p && { opacity: 0 },
          Platform.OS === 'web' && { cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none' },
        ]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          stickerSize.current = { width, height };
          if (!posRef.current) {
            const cw = canvasLayout.current.width  || 390;
            const ch = canvasLayout.current.height || 844;
            posRef.current = { x: Math.max(16, (cw - width) / 2), y: Math.max(80, (ch - height) / 2) };
            setPos({ ...posRef.current });
          }
        }}
        {...nativeH}
      >
        {children}
      </View>
      {isDragging && (
        <View pointerEvents="none" style={[DS_TRASH, isOverTrash && DS_TRASH_ACTIVE]}>
          <Ionicons name={isOverTrash ? 'trash' : 'trash-outline'} size={26} color="#fff" />
          <Text style={DS_TRASH_TXT}>Sil</Text>
        </View>
      )}
    </>
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
  const [tsId,        setTsId]        = useState('bold');
  const [textBg,      setTextBg]      = useState('transparent');
  const [textAlign,   setTextAlign]   = useState('center');
  const [editingText, setEditingText] = useState(false);

  // Sticker tray
  const [showStickerTray,   setShowStickerTray]   = useState(false);

  // Link çıkartması
  const [linkUrl,        setLinkUrl]        = useState('');
  const [showLinkInput,  setShowLinkInput]  = useState(false);
  const [linkDraft,      setLinkDraft]      = useState('');

  // Soru çıkartması
  const [questionText,      setQuestionText]      = useState('');
  const [showQuestionInput, setShowQuestionInput] = useState(false);
  const [questionDraft,     setQuestionDraft]     = useState('');

  // @ Bahset çıkartması
  const [mentionUsername,   setMentionUsername]   = useState('');
  const [showMentionInput,  setShowMentionInput]  = useState(false);
  const [mentionDraft,      setMentionDraft]      = useState('');
  const [mentionResults,    setMentionResults]    = useState([]);
  const [mentionLoading,    setMentionLoading]    = useState(false);

  // Anket çıkartması
  const [pollQuestion,   setPollQuestion]   = useState('');
  const [pollOptions,    setPollOptions]    = useState(['', '']);
  const [showPollInput,  setShowPollInput]  = useState(false);

  // Çıkartma konumları (canvas üzerinde sürüklenebilir)
  const [linkPos,     setLinkPos]     = useState(null);
  const [questionPos, setQuestionPos] = useState(null);
  const [mentionPos,  setMentionPos]  = useState(null);
  const [pollPos,     setPollPos]     = useState(null);
  const linkPosRef     = useRef(null);
  const questionPosRef = useRef(null);
  const mentionPosRef  = useRef(null);
  const pollPosRef     = useRef(null);

  // Mention ölçeği
  const [mentionScale, setMentionScale] = useState(1);
  const mentionScaleRef = useRef(1);
  // ref ve state'i senkronize tut
  const setMentionScaleSync = (v) => { mentionScaleRef.current = v; setMentionScale(v); };

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
  const textScaleRef     = useRef(1);
  const nativePinchRef   = useRef(null);
  const setTextScaleSync = (v) => { textScaleRef.current = v; setTextScale(v); };

  // Orta nokta snap kılavuz çizgileri
  const [snapGuide, setSnapGuide] = useState({ x: false, y: false });
  const snapGuideRef = useRef({ x: false, y: false });
  const setSnap = (g) => { snapGuideRef.current = g; setSnapGuide(g); };
  const canvasLayout     = useRef({ width: 390, height: 844 });
  const canvasDomRef     = useRef(null);   // canvas container DOM elementi (web)
  const setEditingTextRef = useRef(null);
  const editingTextRef   = useRef(false);  // editingText'in güncel değeri
  const isOverTrashRef      = useRef(false);
  const mentionSearchTimer  = useRef(null);
  const TRASH_ZONE_H        = 180;

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
        let nx = Math.max(0, Math.min(cw - bw2, px0 + dx));
        let ny = Math.max(0, Math.min(ch - bh2, py0 + dy));
        const cx = (cw - bw2) / 2, cy = (ch - bh2) / 2;
        const sx = Math.abs(nx - cx) < SNAP_THRESHOLD;
        const sy = Math.abs(ny - cy) < SNAP_THRESHOLD;
        if (sx) nx = cx; if (sy) ny = cy;
        setSnap({ x: sx, y: sy });
        textPosRef.current = { x: nx, y: ny };
        setTextPos({ x: nx, y: ny });
        const over = ny + bh2 > ch - TRASH_ZONE_H;
        if (over !== isOverTrashRef.current) { isOverTrashRef.current = over; setIsOverTrash(over); }
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        setSnap({ x: false, y: false });
        if (isOverTrashRef.current) {
          setText(''); textPosRef.current = null; setTextPos(null); setTextScaleSync(1);
        } else if (!moved) {
          setEditingTextRef.current?.(true);
        }
        isOverTrashRef.current = false; setIsOverTrash(false); setIsDragging(false);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };

    // Web'de fare tekerleği ile metin ölçekleme
    const onWindowWheel = (e) => {
      if (!textPosRef.current || editingTextRef.current) return;
      const rect = canvasDomRef.current?.getBoundingClientRect?.();
      if (!rect) return;
      const sc = window.__phoneScale || 1;
      const mx = (e.clientX - rect.left) / sc;
      const my = (e.clientY - rect.top)  / sc;
      const tx = textPosRef.current.x, ty = textPosRef.current.y;
      const bw = textBubbleLayout.current.width  || 80;
      const bh = textBubbleLayout.current.height || 40;
      if (mx < tx - 8 || mx > tx + bw + 8 || my < ty - 8 || my > ty + bh + 8) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const ns = Math.max(0.4, Math.min(3.0, textScaleRef.current + delta));
      setTextScaleSync(ns);
    };

    window.addEventListener('mousedown', onWindowMouseDown);
    window.addEventListener('wheel', onWindowWheel, { passive: false });
    return () => {
      window.removeEventListener('mousedown', onWindowMouseDown);
      window.removeEventListener('wheel', onWindowWheel);
    };
  }, []); // Bir kez bağla, sonsuza dek çalışır

  // Native: Responder (sürükleme + iki parmak ölçekleme)
  const nativeDragRef = useRef(null);
  const textHandlers = Platform.OS !== 'web' ? {
    onStartShouldSetResponder:    () => true,
    onResponderTerminationRequest:() => false,
    onResponderGrant: (e) => {
      const { pageX, pageY } = e.nativeEvent;
      nativeDragRef.current = { x: pageX, y: pageY, px: textPosRef.current?.x ?? 0, py: textPosRef.current?.y ?? 0, moved: false };
      nativePinchRef.current = null;
      setIsDragging(true);
    },
    onResponderMove: (e) => {
      const touches = e.nativeEvent.touches;
      // İki parmak → pinch ölçekleme
      if (touches && touches.length >= 2) {
        const dx = touches[0].pageX - touches[1].pageX;
        const dy = touches[0].pageY - touches[1].pageY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (!nativePinchRef.current) {
          nativePinchRef.current = { dist, startScale: textScaleRef.current };
        } else {
          const ns = Math.max(0.4, Math.min(3.0,
            nativePinchRef.current.startScale * dist / nativePinchRef.current.dist,
          ));
          setTextScaleSync(ns);
        }
        return;
      }
      nativePinchRef.current = null;
      // Tek parmak → sürükleme
      const d = nativeDragRef.current; if (!d) return;
      const dx = e.nativeEvent.pageX - d.x, dy = e.nativeEvent.pageY - d.y;
      if (!d.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) d.moved = true;
      if (!d.moved) return;
      const cw = canvasLayout.current.width || 390, ch = canvasLayout.current.height || 844;
      const bw = textBubbleLayout.current.width || 80, bh = textBubbleLayout.current.height || 40;
      let nx = Math.max(0, Math.min(cw - bw, d.px + dx));
      let ny = Math.max(0, Math.min(ch - bh, d.py + dy));
      const cx = (cw - bw) / 2, cy = (ch - bh) / 2;
      const sx = Math.abs(nx - cx) < SNAP_THRESHOLD;
      const sy = Math.abs(ny - cy) < SNAP_THRESHOLD;
      if (sx) nx = cx; if (sy) ny = cy;
      setSnap({ x: sx, y: sy });
      textPosRef.current = { x: nx, y: ny }; setTextPos({ x: nx, y: ny });
      const over = ny + bh > ch - TRASH_ZONE_H;
      if (over !== isOverTrashRef.current) { isOverTrashRef.current = over; setIsOverTrash(over); }
    },
    onResponderRelease: () => {
      nativePinchRef.current = null;
      setSnap({ x: false, y: false });
      const d = nativeDragRef.current; nativeDragRef.current = null;
      if (isOverTrashRef.current) {
        setText(''); textPosRef.current = null; setTextPos(null); setTextScaleSync(1);
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
  // Yazı rengi: beyaz arka planda koyu, diğerlerinde beyaz (neon: mor)
  const textColor    = textBg === '#fff' ? '#111' : (ts.glow ? '#C084FC' : '#fff');
  const cycleBg      = () => setTextBg(b => {
    const i = TEXT_BGS.indexOf(b);
    return TEXT_BGS[(i + 1) % TEXT_BGS.length];
  });

  // Guest guard
  useEffect(() => {
    if (isGuest || !token) {
      Alert.alert('Giriş Gerekli', 'Hikaye paylaşmak için giriş yapın.', [
        { text: 'İptal', onPress: () => navigation.goBack() },
        { text: 'Giriş Yap', onPress: () => { navigation.goBack(); navigation.navigate('Auth'); } },
      ]);
    }
  }, []);

  // Çıkartma silinince konumunu sıfırla
  useEffect(() => { if (!linkUrl)        { linkPosRef.current = null;     setLinkPos(null);     } }, [linkUrl]);
  useEffect(() => { if (!questionText)   { questionPosRef.current = null; setQuestionPos(null); } }, [questionText]);
  useEffect(() => { if (!mentionUsername){ mentionPosRef.current = null;  setMentionPos(null); mentionScaleRef.current = 1; setMentionScale(1); } }, [mentionUsername]);
  useEffect(() => { if (!pollQuestion)   { pollPosRef.current = null;     setPollPos(null);     } }, [pollQuestion]);

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
          text_bg       : textBg !== 'transparent' ? textBg : undefined,
        }),
        photo_scale    : photoScaleRef.current !== 1 ? photoScaleRef.current : undefined,
        photo_offset_x : photoOffsetRef.current.x || undefined,
        photo_offset_y : photoOffsetRef.current.y || undefined,
        link_url         : linkUrl.trim() || undefined,
        link_pos_x       : (linkUrl.trim() && linkPosRef.current)    ? linkPosRef.current.x / cw     : undefined,
        link_pos_y       : (linkUrl.trim() && linkPosRef.current)    ? linkPosRef.current.y / ch     : undefined,
        question_text    : questionText.trim() || undefined,
        question_pos_x   : (questionText.trim() && questionPosRef.current) ? questionPosRef.current.x / cw : undefined,
        question_pos_y   : (questionText.trim() && questionPosRef.current) ? questionPosRef.current.y / ch : undefined,
        mention_username : mentionUsername.trim() || undefined,
        mention_scale    : mentionUsername.trim() ? mentionScale : undefined,
        mention_pos_x    : (mentionUsername.trim() && mentionPosRef.current) ? mentionPosRef.current.x / cw : undefined,
        mention_pos_y    : (mentionUsername.trim() && mentionPosRef.current) ? mentionPosRef.current.y / ch : undefined,
        poll_question    : pollQuestion.trim() || undefined,
        poll_pos_x       : (pollQuestion.trim() && pollPosRef.current) ? pollPosRef.current.x / cw   : undefined,
        poll_pos_y       : (pollQuestion.trim() && pollPosRef.current) ? pollPosRef.current.y / ch   : undefined,
        poll_options     : (pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2)
                             ? pollOptions.filter(o => o.trim())
                             : undefined,
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

      {/* ── SNAP KILAVUZ ÇİZGİLERİ ── */}
      {snapGuide.y && (
        <View pointerEvents="none" style={s.snapLineH} />
      )}
      {snapGuide.x && (
        <View pointerEvents="none" style={s.snapLineV} />
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
              backgroundColor: textBg === 'transparent' ? 'transparent' : textBg,
              maxWidth: canvasLayout.current.width - 32,
            }]}>
              <Text
                style={[s.textOut, {
                  color: textColor,
                  fontWeight: ts.fontWeight || '800',
                  fontStyle:  ts.fontStyle  || 'normal',
                  textAlign,
                  fontSize: (() => {
                    const l = text.length;
                    const base = l <= 30 ? 36 : l <= 60 ? 28 : l <= 120 ? 22 : l <= 250 ? 18 : 14;
                    return Math.max(14, Math.min(72, Math.round(base * textScale)));
                  })(),
                  lineHeight: (() => {
                    const l = text.length;
                    const base = l <= 30 ? 36 : l <= 60 ? 28 : l <= 120 ? 22 : l <= 250 ? 18 : 14;
                    const fs = Math.max(14, Math.min(72, Math.round(base * textScale)));
                    return Math.max(18, Math.round(fs * 1.2));
                  })(),
                  ...(ts.glow && { textShadowColor: '#C084FC', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 }),
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

      {/* ── MÜZİK STİCKER ── */}
      {music && (
        <TouchableOpacity
          style={s.musicSticker}
          onPress={() => setMusicSheet(true)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['rgba(124,58,237,0.90)', 'rgba(192,132,252,0.90)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={s.musicStickerGrad}
          >
            <Ionicons name="musical-notes" size={15} color="#fff" />
            <Text style={s.musicStickerTxt} numberOfLines={1}>{music.title || music.name}</Text>
            <TouchableOpacity onPress={() => setMusic(null)} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
              <Ionicons name="close" size={15} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* ── LİNK STİCKER ── sürüklenebilir */}
      {linkUrl ? (
        <DraggableSticker
          posRef={linkPosRef}
          setPos={setLinkPos}
          canvasLayout={canvasLayout}
          canvasDomRef={canvasDomRef}
          onSnap={setSnap}
          onDelete={() => setLinkUrl('')}
          onTap={() => {
            const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
            Linking.openURL(url).catch(() => {});
          }}
        >
          <View style={s.linkSticker}>
            <View style={s.linkStickerIconBox}>
              <Ionicons name="link" size={16} color="#7C3AED" />
            </View>
            <Text style={s.linkStickerTxt} numberOfLines={1}>
              {linkUrl.replace(/^https?:\/\/(www\.)?/, '')}
            </Text>
          </View>
        </DraggableSticker>
      ) : null}

      {/* ── SORU STİCKER ── sürüklenebilir */}
      {questionText ? (
        <DraggableSticker
          posRef={questionPosRef}
          setPos={setQuestionPos}
          canvasLayout={canvasLayout}
          canvasDomRef={canvasDomRef}
          onSnap={setSnap}
          onDelete={() => setQuestionText('')}
          onTap={() => { setQuestionDraft(questionText); setShowQuestionInput(true); }}
        >
          <LinearGradient
            colors={['#9333EA', '#C026D3', '#EC4899']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.questionSticker}
          >
            <View style={s.questionStickerHeader}>
              <Text style={s.questionStickerEmoji}>❓</Text>
              <Text style={s.questionStickerLabel}>SORU</Text>
            </View>
            <Text style={s.questionStickerTxt}>{questionText}</Text>
            <View style={s.questionStickerInputBox}>
              <Text style={s.questionStickerHint}>Cevabını yaz...</Text>
              <Ionicons name="arrow-forward" size={14} color="#9333EA" />
            </View>
          </LinearGradient>
        </DraggableSticker>
      ) : null}

      {/* ── @ BAHSET STİCKER ── sürüklenebilir + iki parmakla ölçeklenebilir */}
      {mentionUsername ? (
        <DraggableSticker
          posRef={mentionPosRef}
          setPos={setMentionPos}
          canvasLayout={canvasLayout}
          canvasDomRef={canvasDomRef}
          onSnap={setSnap}
          onDelete={() => setMentionUsername('')}
          onTap={() => { setMentionDraft(mentionUsername); setShowMentionInput(true); }}
          scaleRef={mentionScaleRef}
          setScale={setMentionScaleSync}
        >
          <View style={s.mentionStickerPill}>
            <Text style={[s.mentionStickerText, { fontSize: Math.round(20 * mentionScale) }]}>
              <Text style={s.mentionStickerAtSign}>@</Text>{mentionUsername}
            </Text>
          </View>
        </DraggableSticker>
      ) : null}

      {/* ── ANKET STİCKER ── sürüklenebilir */}
      {pollQuestion ? (
        <DraggableSticker
          posRef={pollPosRef}
          setPos={setPollPos}
          canvasLayout={canvasLayout}
          canvasDomRef={canvasDomRef}
          onSnap={setSnap}
          onDelete={() => { setPollQuestion(''); setPollOptions(['', '']); }}
          onTap={() => setShowPollInput(true)}
        >
          <View style={s.pollSticker}>
            <View style={s.pollStickerHeader}>
              <Ionicons name="bar-chart" size={13} color="#7C3AED" />
              <Text style={s.pollStickerLabel}>ANKET</Text>
            </View>
            <Text style={s.pollStickerQ} numberOfLines={2}>{pollQuestion}</Text>
            <View style={s.pollStickerOpts}>
              {pollOptions.filter(o => o.trim()).slice(0, 4).map((opt, i) => (
                <View key={i} style={s.pollStickerOpt}>
                  <Text style={s.pollStickerOptTxt} numberOfLines={1}>{opt}</Text>
                </View>
              ))}
            </View>
          </View>
        </DraggableSticker>
      ) : null}


      {/* ── ÜST BAR ── */}
      {!editingText && (
        <View style={[s.topBar, { paddingTop: insets.top + 22 }]}>
          <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <View style={s.toolCol}>
            <TouchableOpacity style={s.iconBtn} onPress={() => setEditingText(true)}>
              <Text style={s.aaText}>Aa</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.toolPill, music && s.toolPillOn]}
              onPress={() => setMusicSheet(true)}
            >
              <Ionicons name={music ? 'musical-notes' : 'musical-notes-outline'} size={17} color={music ? '#C084FC' : '#fff'} />
              <Text style={[s.toolPillTxt, music && { color: '#C084FC' }]}>Müzik</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.toolPill, (linkUrl || questionText || mentionUsername || pollQuestion) && s.toolPillOn]}
              onPress={() => setShowStickerTray(true)}
            >
              <Ionicons
                name={(linkUrl || questionText || mentionUsername || pollQuestion) ? 'happy' : 'happy-outline'}
                size={17}
                color={(linkUrl || questionText || mentionUsername || pollQuestion) ? '#C084FC' : '#fff'}
              />
              <Text style={[s.toolPillTxt, (linkUrl || questionText || mentionUsername || pollQuestion) && { color: '#C084FC' }]}>Sticker</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── ALT BAR ── */}
      {!editingText && (
        <LinearGradient
          colors={['transparent', 'transparent']}
          style={[s.bottomBar, { paddingBottom: insets.bottom + 6 }]}
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
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#9333EA', '#C084FC', '#FB923C']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.shareBtnGrad}
              >
                {uploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <>
                      <Text style={s.shareBtnTxt}>Hikayene Ekle</Text>
                      <Ionicons name="arrow-forward" size={16} color="#fff" />
                    </>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>

        </LinearGradient>
      )}

      {/* ── METİN DÜZENLEYICI OVERLAY ── */}
      {editingText && (
        <View style={[StyleSheet.absoluteFill, s.editorBg]}>
          {/* Dışarı tıklayınca kapat */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditingText(false)} />

          {/* Yazı stili seçici — KAV dışında, absolut, Pressable'ın üstünde */}
          <View style={[s.styleBar, { position: 'absolute', top: insets.top + 60, left: 0, right: 0, zIndex: 30 }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={s.styleBarContent}
            >
              {TEXT_STYLES.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[s.stylePill, t.id === tsId && s.stylePillOn]}
                  onPress={() => setTsId(t.id)}
                >
                  <Text style={[s.stylePillTxt, {
                    color:      '#fff',
                    fontWeight: t.fontWeight || '800',
                    fontStyle:  t.fontStyle  || 'normal',
                    ...(t.glow && { textShadowColor: '#C084FC', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }),
                  }]}>
                    Aa
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

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

              {/* Arka plan toggle: şeffaf → beyaz → siyah */}
              <TouchableOpacity style={s.bgToggleBtn} onPress={cycleBg}>
                <View style={[s.bgToggleInner, {
                  backgroundColor: textBg === 'transparent' ? 'transparent' : textBg,
                  borderColor: textBg === '#fff' ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.5)',
                }]}>
                  <Text style={[s.bgToggleTxt, { color: textBg === '#fff' ? '#111' : '#fff' }]}>A</Text>
                </View>
              </TouchableOpacity>

              <View style={{ flex: 1 }} />

              <TouchableOpacity
                style={s.doneBtn}
                onPress={() => setEditingText(false)}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#9333EA', '#C084FC']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={s.doneBtnGrad}
                >
                  <Text style={s.doneTxt}>Bitti</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Input alanı — sabit layout, kayma olmaz */}
            <View style={s.editorCanvas}>
              {(() => {
                const len = text.length || 1;
                const editorFontSize = len <= 30  ? 36
                                     : len <= 60  ? 28
                                     : len <= 120 ? 22
                                     : len <= 250 ? 18
                                     :              14;
                const scaled = Math.max(14, Math.min(72, Math.round(editorFontSize * textScale)));
                return (
                  <View style={[
                    s.editorBubble,
                    { backgroundColor: textBg === 'transparent' ? 'transparent' : textBg },
                  ]}>
                    <TextInput
                      style={[s.editorInput, {
                        color:            textColor,
                        fontWeight:       ts.fontWeight || '800',
                        fontStyle:        ts.fontStyle  || 'normal',
                        textAlign,
                        textAlignVertical: 'center',
                        fontSize: scaled,
                        lineHeight: Math.max(18, Math.round(scaled * 1.2)),
                        ...(ts.glow && { textShadowColor: '#C084FC', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 }),
                      }]}
                      placeholder="Bir şey yaz..."
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      value={text}
                      onChangeText={setText}
                      multiline
                      scrollEnabled={true}
                      autoFocus
                      maxLength={500}
                      textAlignVertical="top"
                    />
                  </View>
                );
              })()}
            </View>
            {/* Karakter sayacı */}
            <Text style={s.charCounter}>{text.length}/500</Text>
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

      {/* ── LİNK GİRİŞ PANELİ ── */}
      {showLinkInput && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 30, backgroundColor: 'rgba(8,6,15,0.88)', justifyContent: 'flex-end' }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowLinkInput(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={s.stickerPanel}>
              <LinearGradient colors={['rgba(26,10,46,0.35)', 'transparent']} style={s.stickerPanelGrad} pointerEvents="none" />
              <View style={s.stickerHandle} />
              {/* Link sticker preview */}
              <View style={s.stickerPreviewRow}>
                <View style={s.linkSticker}>
                  <View style={s.linkStickerIconBox}>
                    <Ionicons name="link" size={16} color="#7C3AED" />
                  </View>
                  <Text style={s.linkStickerTxt} numberOfLines={1}>
                    {linkDraft ? linkDraft.replace(/^https?:\/\/(www\.)?/, '') : 'bağlantı.com'}
                  </Text>
                </View>
              </View>
              <Text style={s.stickerPanelTitle}>Link Çıkartması</Text>
              <Text style={s.stickerPanelSub}>Hikayene tıklanabilir bir link ekle</Text>
              <View style={s.stickerInputRow}>
                <Ionicons name="link-outline" size={18} color="rgba(192,132,252,0.7)" />
                <TextInput
                  style={s.stickerInput}
                  placeholder="https://ornek.com"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={linkDraft}
                  onChangeText={setLinkDraft}
                  autoCapitalize="none"
                  keyboardType="url"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => { setLinkUrl(linkDraft.trim()); setShowLinkInput(false); }}
                />
                {linkDraft.length > 0 && (
                  <TouchableOpacity onPress={() => setLinkDraft('')}>
                    <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={s.stickerBtnRow}>
                <TouchableOpacity style={s.stickerCancelBtn} onPress={() => setShowLinkInput(false)}>
                  <Text style={s.stickerCancelTx}>Vazgeç</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.stickerConfirmBtn, !linkDraft.trim() && { opacity: 0.4 }]}
                  disabled={!linkDraft.trim()}
                  onPress={() => { setLinkUrl(linkDraft.trim()); setShowLinkInput(false); }}
                >
                  <Text style={s.stickerConfirmTx}>Ekle</Text>
                </TouchableOpacity>
              </View>
              {linkUrl ? (
                <TouchableOpacity style={s.stickerRemoveBtn} onPress={() => { setLinkUrl(''); setShowLinkInput(false); }}>
                  <Text style={s.stickerRemoveTx}>Linki Kaldır</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* ── SORU GİRİŞ PANELİ ── */}
      {showQuestionInput && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 30, backgroundColor: 'rgba(8,6,15,0.88)', justifyContent: 'flex-end' }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowQuestionInput(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={s.stickerPanel}>
              <LinearGradient colors={['rgba(26,10,46,0.35)', 'transparent']} style={s.stickerPanelGrad} pointerEvents="none" />
              <View style={s.stickerHandle} />
              {/* Question sticker preview */}
              <View style={s.stickerPreviewRow}>
                <LinearGradient
                  colors={['#9333EA', '#C026D3', '#EC4899']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.questionStickerPreview}
                >
                  <View style={s.questionStickerHeader}>
                    <Text style={s.questionStickerEmoji}>❓</Text>
                    <Text style={s.questionStickerLabel}>SORU</Text>
                  </View>
                  <Text style={s.questionStickerPreviewTxt} numberOfLines={2}>
                    {questionDraft || 'Sorunuzu yazın...'}
                  </Text>
                  <View style={s.questionStickerInputBox}>
                    <Text style={s.questionStickerHint}>Cevabını yaz...</Text>
                    <Ionicons name="arrow-forward" size={14} color="#9333EA" />
                  </View>
                </LinearGradient>
              </View>
              <Text style={s.stickerPanelTitle}>Soru Çıkartması</Text>
              <Text style={s.stickerPanelSub}>Takipçilerin cevap verebileceği bir soru sor</Text>
              <View style={s.stickerInputRow}>
                <Ionicons name="help-circle-outline" size={18} color="rgba(192,132,252,0.7)" />
                <TextInput
                  style={s.stickerInput}
                  placeholder="Sorunuzu yazın..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={questionDraft}
                  onChangeText={setQuestionDraft}
                  autoFocus
                  returnKeyType="done"
                  maxLength={150}
                  onSubmitEditing={() => { setQuestionText(questionDraft.trim()); setShowQuestionInput(false); }}
                />
                {questionDraft.length > 0 && (
                  <TouchableOpacity onPress={() => setQuestionDraft('')}>
                    <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={s.stickerBtnRow}>
                <TouchableOpacity style={s.stickerCancelBtn} onPress={() => setShowQuestionInput(false)}>
                  <Text style={s.stickerCancelTx}>Vazgeç</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.stickerConfirmBtn, !questionDraft.trim() && { opacity: 0.4 }]}
                  disabled={!questionDraft.trim()}
                  onPress={() => { setQuestionText(questionDraft.trim()); setShowQuestionInput(false); }}
                >
                  <Text style={s.stickerConfirmTx}>Ekle</Text>
                </TouchableOpacity>
              </View>
              {questionText ? (
                <TouchableOpacity style={s.stickerRemoveBtn} onPress={() => { setQuestionText(''); setShowQuestionInput(false); }}>
                  <Text style={s.stickerRemoveTx}>Soruyu Kaldır</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* ── STICKER TRAY PANELİ ── */}
      {showStickerTray && !showLinkInput && !showQuestionInput && !showMentionInput && !showPollInput && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 30, backgroundColor: 'rgba(8,6,15,0.88)', justifyContent: 'flex-end' }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowStickerTray(false)} />
          <View style={s.stickerPanel}>
            <LinearGradient colors={['rgba(26,10,46,0.35)', 'transparent']} style={s.stickerPanelGrad} pointerEvents="none" />
            <View style={s.stickerHandle} />
            <Text style={s.stickerPanelTitle}>Çıkartma Ekle</Text>
            <Text style={s.stickerPanelSub}>Hikayen için bir çıkartma seç</Text>
            <View style={s.stickerTrayGrid}>
              {/* Link */}
              <TouchableOpacity
                style={s.stickerTrayCell}
                onPress={() => { setLinkDraft(linkUrl); setShowStickerTray(false); setShowLinkInput(true); }}
              >
                <LinearGradient colors={['#7C3AED', '#4C1D95']} style={s.stickerTrayCellBg}>
                  <Ionicons name="link" size={28} color="#fff" />
                </LinearGradient>
                <Text style={s.stickerTrayCellTxt}>Link</Text>
                {linkUrl ? <View style={s.stickerTrayCellDot} /> : null}
              </TouchableOpacity>
              {/* Soru */}
              <TouchableOpacity
                style={s.stickerTrayCell}
                onPress={() => { setQuestionDraft(questionText); setShowStickerTray(false); setShowQuestionInput(true); }}
              >
                <LinearGradient colors={['#9333EA', '#EC4899']} style={s.stickerTrayCellBg}>
                  <Ionicons name="help-circle" size={28} color="#fff" />
                </LinearGradient>
                <Text style={s.stickerTrayCellTxt}>Soru</Text>
                {questionText ? <View style={s.stickerTrayCellDot} /> : null}
              </TouchableOpacity>
              {/* @ Bahset */}
              <TouchableOpacity
                style={s.stickerTrayCell}
                onPress={() => { setMentionDraft(mentionUsername); setShowStickerTray(false); setShowMentionInput(true); }}
              >
                <LinearGradient colors={['#2563EB', '#0EA5E9']} style={s.stickerTrayCellBg}>
                  <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>@</Text>
                </LinearGradient>
                <Text style={s.stickerTrayCellTxt}>Bahset</Text>
                {mentionUsername ? <View style={s.stickerTrayCellDot} /> : null}
              </TouchableOpacity>
              {/* Anket */}
              <TouchableOpacity
                style={s.stickerTrayCell}
                onPress={() => { setShowStickerTray(false); setShowPollInput(true); }}
              >
                <LinearGradient colors={['#059669', '#10B981']} style={s.stickerTrayCellBg}>
                  <Ionicons name="bar-chart" size={28} color="#fff" />
                </LinearGradient>
                <Text style={s.stickerTrayCellTxt}>Anket</Text>
                {pollQuestion ? <View style={s.stickerTrayCellDot} /> : null}
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[s.stickerCancelBtn, { marginTop: 8 }]} onPress={() => setShowStickerTray(false)}>
              <Text style={s.stickerCancelTx}>Kapat</Text>
            </TouchableOpacity>
            <View style={{ height: 16 }} />
          </View>
        </View>
      )}

      {/* ── BAHSEDİLEN KULLANICI PANELİ ── */}
      {showMentionInput && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 30, backgroundColor: 'rgba(8,6,15,0.88)', justifyContent: 'flex-end' }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowMentionInput(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={s.stickerPanel}>
              <LinearGradient colors={['rgba(26,10,46,0.35)', 'transparent']} style={s.stickerPanelGrad} pointerEvents="none" />
              <View style={s.stickerHandle} />
              {/* Mention sticker preview */}
              <View style={s.stickerPreviewRow}>
                <View style={s.mentionStickerPill}>
                  <Text style={s.mentionStickerText}>
                    <Text style={s.mentionStickerAtSign}>@</Text>{mentionDraft || 'kullanici_adi'}
                  </Text>
                </View>
              </View>
              <Text style={s.stickerPanelTitle}>Kullanıcı Bahset</Text>
              <Text style={s.stickerPanelSub}>Bir kullanıcıyı hikayende etiketle</Text>
              <View style={s.stickerInputRow}>
                <Text style={{ color: 'rgba(192,132,252,0.7)', fontSize: 18, fontWeight: '800' }}>@</Text>
                <TextInput
                  style={s.stickerInput}
                  placeholder="kullanici_adi"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={mentionDraft}
                  onChangeText={(v) => {
                    setMentionDraft(v);
                    clearTimeout(mentionSearchTimer.current);
                    if (v.trim().length > 0) {
                      setMentionLoading(true);
                      mentionSearchTimer.current = setTimeout(async () => {
                        try {
                          const res = await api.get(`/users/search?q=${encodeURIComponent(v.trim())}`, token);
                          setMentionResults(res?.users || res?.results || (Array.isArray(res) ? res : []));
                        } catch { setMentionResults([]); }
                        setMentionLoading(false);
                      }, 300);
                    } else {
                      setMentionResults([]);
                      setMentionLoading(false);
                    }
                  }}
                  autoCapitalize="none"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => { if (mentionDraft.trim()) { setMentionUsername(mentionDraft.trim()); setShowMentionInput(false); } }}
                />
                {mentionDraft.length > 0 && (
                  <TouchableOpacity onPress={() => { setMentionDraft(''); setMentionResults([]); }}>
                    <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>
                )}
              </View>
              {mentionLoading && <ActivityIndicator color="#C084FC" style={{ marginBottom: 10 }} />}
              {mentionResults.length > 0 && (
                <FlatList
                  data={mentionResults}
                  keyExtractor={(item) => String(item.id || item.username)}
                  style={{ maxHeight: 160, marginBottom: 12 }}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={s.mentionRow}
                      onPress={() => {
                        const uname = item.username || item.handle || item.name || '';
                        setMentionUsername(uname);
                        setMentionDraft(uname);
                        setShowMentionInput(false);
                      }}
                    >
                      {item.avatar_url
                        ? <Image source={{ uri: item.avatar_url }} style={s.mentionAvatar} />
                        : <View style={[s.mentionAvatar, s.mentionAvatarFallback]}>
                            <Text style={{ color: '#C084FC', fontWeight: '700', fontSize: 15 }}>
                              {(item.username || item.name || '?')[0].toUpperCase()}
                            </Text>
                          </View>
                      }
                      <View style={{ flex: 1 }}>
                        <Text style={s.mentionName}>{item.display_name || item.full_name || item.name || item.username}</Text>
                        <Text style={s.mentionSub}>@{item.username || item.handle}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}
              <View style={s.stickerBtnRow}>
                <TouchableOpacity style={s.stickerCancelBtn} onPress={() => setShowMentionInput(false)}>
                  <Text style={s.stickerCancelTx}>Geri</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.stickerConfirmBtn, !mentionDraft.trim() && { opacity: 0.4 }]}
                  disabled={!mentionDraft.trim()}
                  onPress={() => { setMentionUsername(mentionDraft.trim()); setShowMentionInput(false); }}
                >
                  <Text style={s.stickerConfirmTx}>Ekle</Text>
                </TouchableOpacity>
              </View>
              {mentionUsername ? (
                <TouchableOpacity style={s.stickerRemoveBtn} onPress={() => { setMentionUsername(''); setMentionDraft(''); setShowMentionInput(false); }}>
                  <Text style={s.stickerRemoveTx}>Bahseti Kaldır</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* ── ANKET PANELİ ── */}
      {showPollInput && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 30, backgroundColor: 'rgba(8,6,15,0.88)', justifyContent: 'flex-end' }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowPollInput(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={s.stickerPanel}>
              <LinearGradient colors={['rgba(26,10,46,0.35)', 'transparent']} style={s.stickerPanelGrad} pointerEvents="none" />
              <View style={s.stickerHandle} />
              {/* Poll sticker preview */}
              <View style={s.stickerPreviewRow}>
                <View style={s.pollSticker}>
                  <View style={s.pollStickerHeader}>
                    <Ionicons name="bar-chart" size={13} color="#7C3AED" />
                    <Text style={s.pollStickerLabel}>ANKET</Text>
                  </View>
                  <Text style={s.pollStickerQ} numberOfLines={1}>
                    {pollQuestion || 'Anket sorusu?'}
                  </Text>
                  {pollOptions.filter(o => o.trim()).length >= 2 ? (
                    <View style={s.pollStickerOpts}>
                      {pollOptions.filter(o => o.trim()).slice(0, 4).map((opt, i) => (
                        <View key={i} style={s.pollStickerOpt}>
                          <Text style={s.pollStickerOptTxt} numberOfLines={1}>{opt}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={{ color: 'rgba(124,58,237,0.4)', fontSize: 11, marginTop: 4 }}>Seçenekler aşağıda görünecek</Text>
                  )}
                </View>
              </View>
              <Text style={s.stickerPanelTitle}>Anket Oluştur</Text>
              <Text style={s.stickerPanelSub}>Soru sor, takipçiler oy kullansın</Text>
              <View style={[s.stickerInputRow, { marginBottom: 12 }]}>
                <Ionicons name="help-circle-outline" size={18} color="rgba(192,132,252,0.7)" />
                <TextInput
                  style={s.stickerInput}
                  placeholder="Anket sorusu..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={pollQuestion}
                  onChangeText={setPollQuestion}
                  autoFocus
                  maxLength={120}
                />
              </View>
              {pollOptions.map((opt, idx) => (
                <View key={idx} style={[s.stickerInputRow, { marginBottom: 10 }]}>
                  <Text style={{ color: 'rgba(192,132,252,0.7)', fontSize: 13, fontWeight: '700', minWidth: 20 }}>{idx + 1}.</Text>
                  <TextInput
                    style={s.stickerInput}
                    placeholder={`Seçenek ${idx + 1}`}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={opt}
                    onChangeText={(v) => { const next = [...pollOptions]; next[idx] = v; setPollOptions(next); }}
                    maxLength={60}
                  />
                  {pollOptions.length > 2 && (
                    <TouchableOpacity onPress={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}>
                      <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.3)" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {pollOptions.length < 4 && (
                <TouchableOpacity style={s.pollAddOptionBtn} onPress={() => setPollOptions([...pollOptions, ''])}>
                  <Ionicons name="add-circle-outline" size={18} color="#C084FC" />
                  <Text style={s.pollAddOptionTxt}>Seçenek Ekle</Text>
                </TouchableOpacity>
              )}
              <View style={[s.stickerBtnRow, { marginTop: 14 }]}>
                <TouchableOpacity style={s.stickerCancelBtn} onPress={() => setShowPollInput(false)}>
                  <Text style={s.stickerCancelTx}>Geri</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.stickerConfirmBtn, (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) && { opacity: 0.4 }]}
                  disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
                  onPress={() => { setShowPollInput(false); }}
                >
                  <Text style={s.stickerConfirmTx}>Ekle</Text>
                </TouchableOpacity>
              </View>
              {pollQuestion ? (
                <TouchableOpacity style={s.stickerRemoveBtn} onPress={() => { setPollQuestion(''); setPollOptions(['', '']); setShowPollInput(false); }}>
                  <Text style={s.stickerRemoveTx}>Anketi Kaldır</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </KeyboardAvoidingView>
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
          <View style={[s.sheet, { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingBottom: insets.bottom + 16 }]} onStartShouldSetResponder={() => true}>
            {/* Üst geçiş gradyanı */}
            <LinearGradient
              colors={['rgba(26,10,46,0.35)', 'rgba(16,8,28,0.10)', 'rgba(10,5,18,0.02)', 'transparent']}
              locations={[0, 0.38, 0.68, 1]}
              style={s.sheetTopGrad}
              pointerEvents="none"
            />
            <View style={s.handle} />
            <View style={s.sheetTitleRow}>
              <Ionicons name="musical-notes" size={18} color="#C084FC" />
              <Text style={s.sheetTitle}>Müzik Ekle</Text>
            </View>

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
              activeOpacity={0.85}
              onPress={async () => {
                if (music) {
                  if (previewingId === music.id) {
                    await previewSoundRef.current?.playFromAsync?.(musicStartTime);
                  } else {
                    await togglePreview(music);
                  }
                }
                setMusicSheet(false);
                setMusicQ('');
                setMusicList([]);
              }}
            >
              <LinearGradient
                colors={['#9333EA', '#C084FC', '#FB923C']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.actionBtnGrad}
              >
                <Text style={s.actionBtnTxt}>Bitti</Text>
              </LinearGradient>
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
    backgroundColor: 'rgba(8,6,15,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnOn: {
    backgroundColor: 'rgba(192,132,252,0.18)',
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
  textOut: { flexShrink: 1, flexWrap: 'wrap' },

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

  // ── Müzik sticker (bottom-left pill)
  musicSticker: {
    position: 'absolute', bottom: 185, left: 14,
    zIndex: 3, elevation: 5,
    borderRadius: 24, overflow: 'hidden',
    maxWidth: 240,
  },
  musicStickerGrad: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  musicStickerTxt: { color: '#fff', fontSize: 13, fontWeight: '600', flexShrink: 1 },

  // ── Link sticker (dark glassmorphism pill)
  linkSticker: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(12,5,28,0.88)',
    borderRadius: 28, paddingVertical: 10, paddingHorizontal: 14,
    maxWidth: 300,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.45)',
    shadowColor: '#7C3AED', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  linkStickerIconBox: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(139,92,246,0.22)',
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  linkStickerTxt: { color: '#fff', fontSize: 13, fontWeight: '600', flexShrink: 1 },

  // ── Question sticker (Instagram: mor→pembe gradient)
  questionSticker: {
    borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
    minWidth: 220, maxWidth: 320,
    shadowColor: '#9333EA', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  questionStickerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10,
  },
  questionStickerEmoji: { fontSize: 14 },
  questionStickerLabel: {
    color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '800',
    letterSpacing: 1.4,
  },
  questionStickerTxt: {
    color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center',
    marginBottom: 12, letterSpacing: -0.2,
  },
  questionStickerInputBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 30, paddingLeft: 14, paddingRight: 6, paddingVertical: 6,
  },
  questionStickerHint: {
    flex: 1, color: 'rgba(100,50,140,0.6)', fontSize: 13,
    fontWeight: '500',
  },

  // ── @Mention sticker (dark glassmorphism pill)
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

  // ── Poll sticker (white card)
  pollSticker: {
    backgroundColor: 'rgba(12,5,28,0.88)',
    borderRadius: 22, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16,
    minWidth: 280, maxWidth: 340,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.35)',
    shadowColor: '#7C3AED', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  pollStickerHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
  },
  pollStickerLabel: {
    color: '#C084FC', fontSize: 11, fontWeight: '800', letterSpacing: 1.4,
  },
  pollStickerQ: {
    color: '#F0EEFF', fontSize: 16, fontWeight: '800',
    marginBottom: 12, lineHeight: 22, letterSpacing: -0.2,
  },
  pollStickerOpts: { flexDirection: 'column', gap: 7 },
  pollStickerOpt: {
    height: 38, borderRadius: 12, justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  pollStickerOptTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // ── Sticker giriş paneli (Link / Soru)
  stickerPanel: {
    backgroundColor: '#08060F',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    borderTopWidth: 1, borderColor: 'rgba(192,132,252,0.18)',
    paddingHorizontal: 24, paddingBottom: 32,
  },
  stickerPanelGrad: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 110,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
  },
  stickerHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(192,132,252,0.30)',
    alignSelf: 'center', marginTop: 12, marginBottom: 20,
  },
  stickerPanelTitle: {
    color: '#F8F8F8', fontSize: 17, fontWeight: '800',
    marginBottom: 4,
  },
  stickerPanelSub: {
    color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 20,
  },
  stickerInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(192,132,252,0.20)',
    marginBottom: 20,
  },
  stickerInput: {
    flex: 1, color: '#fff', fontSize: 15, padding: 0,
  },
  stickerBtnRow: {
    flexDirection: 'row', gap: 12,
  },
  stickerCancelBtn: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  stickerCancelTx: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '600' },
  stickerConfirmBtn: {
    flex: 2, paddingVertical: 14, alignItems: 'center',
    borderRadius: 16, backgroundColor: '#8B5CF6',
  },
  stickerConfirmTx: { color: '#fff', fontSize: 15, fontWeight: '700' },
  stickerRemoveBtn: {
    marginTop: 14, paddingVertical: 12, alignItems: 'center',
    borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
  },
  stickerRemoveTx: { color: '#EF4444', fontSize: 14, fontWeight: '600' },

  // ── Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingTop: 120, zIndex: 10, elevation: 20,
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
    paddingHorizontal: 18, paddingVertical: 13, borderRadius: 26,
    backgroundColor: 'rgba(12,5,28,0.82)',
    borderWidth: 1.5, borderColor: 'rgba(139,92,246,0.55)',
    shadowColor: '#7C3AED', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  galleryBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  shareBtn: {
    flex: 1, borderRadius: 26, overflow: 'hidden',
  },
  shareBtnGrad: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6,
    paddingVertical: 14,
  },
  shareBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },

  // ── Text editor overlay
  editorBg: { backgroundColor: 'rgba(8,6,15,0.88)', zIndex: 20 },
  editorTop: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingBottom: 8, gap: 8,
  },
  alignBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(8,6,15,0.55)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  doneBtn: {
    borderRadius: 20, overflow: 'hidden',
  },
  doneBtnGrad: {
    paddingHorizontal: 20, paddingVertical: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  doneTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  editorCanvas: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorBubble: {
    width: '100%',
    height: SH * 0.44,
    borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 14,
  },
  editorInput: {
    flex: 1,
    fontWeight: '700',
    paddingVertical: 0,
    ...( Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  charCounter: {
    textAlign: 'right',
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  // ── Sürükleme çöp kutusu
  // ── Snap kılavuz çizgileri
  snapLineH: {
    position: 'absolute', left: 0, right: 0,
    top: '50%', height: 1,
    backgroundColor: 'rgba(255,255,255,0.75)',
    shadowColor: '#C084FC', shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
    zIndex: 8,
  },
  snapLineV: {
    position: 'absolute', top: 0, bottom: 0,
    left: '50%', width: 1,
    backgroundColor: 'rgba(255,255,255,0.75)',
    shadowColor: '#C084FC', shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
    zIndex: 8,
  },

  trashZone: {
    position: 'absolute', bottom: 175,
    left: '20%', right: '20%',
    paddingVertical: 14, borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.70)',
    alignItems: 'center', justifyContent: 'center', gap: 4,
    zIndex: 12,
  },
  trashZoneActive: {
    backgroundColor: 'rgba(220,38,38,0.82)',
  },
  trashZoneTxt: {
    color: '#fff', fontSize: 12, fontWeight: '600',
  },
  styleBar: {
    width: '100%',
    backgroundColor: 'rgba(8,6,15,0.80)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(192,132,252,0.15)',
  },
  styleBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    columnGap: 8,
  },
  stylePill: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)',
    flexShrink: 0,
  },
  stylePillOn:  { borderColor: '#C084FC', borderWidth: 2 },
  stylePillTxt: { fontSize: 17, fontWeight: '800', color: '#fff' },

  // ── Arka plan toggle butonu
  bgToggleBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  bgToggleInner: {
    width: 34, height: 34, borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  bgToggleTxt: { fontSize: 16, fontWeight: '800' },

  // ── Araç çubuğu pill butonları (Müzik, Sticker)
  toolPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(12,5,28,0.72)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  toolPillOn: {
    backgroundColor: 'rgba(139,92,246,0.22)',
    borderColor: '#C084FC',
  },
  toolPillTxt: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700' },

  // ── Sheets (QENARA palette)
  sheetBg: {
    flex: 1, backgroundColor: 'rgba(8,6,15,0.88)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#08060F',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 20, paddingTop: 0, paddingBottom: 0,
    borderTopWidth: 1, borderColor: 'rgba(192,132,252,0.18)',
    overflow: 'hidden',
  },
  sheetTopGrad: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 110,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(192,132,252,0.30)', alignSelf: 'center',
    marginTop: 12, marginBottom: 14,
  },
  sheetTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14,
  },
  sheetTitle: { color: '#F8F8F8', fontSize: 16, fontWeight: '700' },
  sheetInput: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: '#F8F8F8', marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(192,132,252,0.20)',
  },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  resultRowSelected: {
    backgroundColor: 'rgba(192,132,252,0.10)', borderRadius: 14, paddingHorizontal: 8,
  },
  resultIcon: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: 'rgba(192,132,252,0.10)',
    borderWidth: 1, borderColor: 'rgba(192,132,252,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  resultIconPlaying: {
    backgroundColor: 'rgba(192,132,252,0.25)',
    borderColor: '#C084FC',
  },
  resultTitle: { color: '#F8F8F8', fontSize: 14, fontWeight: '600' },
  resultSub:   { color: 'rgba(248,248,248,0.40)', fontSize: 12, marginTop: 2 },
  emptyTxt:    { color: 'rgba(248,248,248,0.30)', textAlign: 'center', paddingVertical: 28, fontSize: 14 },

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
    marginTop: 10, borderWidth: 1, borderColor: 'rgba(248,113,113,0.30)',
    backgroundColor: 'rgba(248,113,113,0.05)',
  },
  removeTxt:    { color: '#F87171', fontSize: 14, fontWeight: '600' },
  actionBtn:    { borderRadius: 18, overflow: 'hidden', marginTop: 10, marginBottom: 4 },
  actionBtnGrad:{ paddingVertical: 15, alignItems: 'center' },
  actionBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },

  // ── Sticker tray grid
  stickerTrayGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  stickerTrayCell: {
    flex: 1,
    alignItems: 'center', gap: 8,
    paddingVertical: 10,
  },
  stickerTrayCellBg: {
    width: 58, height: 58, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  stickerTrayCellTxt: {
    color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: '600',
  },
  stickerTrayCellDot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: '#C084FC',
    position: 'absolute', top: 6, right: '20%',
    borderWidth: 1.5, borderColor: '#08060F',
  },

  // ── Sticker panel preview row
  stickerPreviewRow: {
    alignItems: 'center', marginBottom: 20,
  },
  // ── Question sticker preview (in panel)
  questionStickerPreview: {
    borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
    minWidth: 220, maxWidth: 300, alignSelf: 'center',
  },
  questionStickerPreviewTxt: {
    color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center',
    marginBottom: 10, letterSpacing: -0.2,
  },

  // ── Mention panel user rows
  mentionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  mentionAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(192,132,252,0.15)',
  },
  mentionAvatarFallback: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(192,132,252,0.25)',
  },
  mentionName: { color: '#F8F8F8', fontSize: 14, fontWeight: '600' },
  mentionSub:  { color: 'rgba(248,248,248,0.40)', fontSize: 12, marginTop: 1 },

  // ── Poll panel
  pollAddOptionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 11, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.25)',
    backgroundColor: 'rgba(192,132,252,0.07)',
    marginBottom: 4,
  },
  pollAddOptionTxt: { color: '#C084FC', fontSize: 14, fontWeight: '600' },
});
