import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, Image, ScrollView,
  Dimensions, Alert, Modal, FlatList, PanResponder, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';
import LocationPicker from '../components/LocationPicker';

const { width: SW, height: SH } = Dimensions.get('window');
const MAX_VIDEO_DURATION = 30;

const COLORS = ['#FFFFFF', '#000000', BRAND.primary, BRAND.accent, '#F59E0B', '#10B981', '#EF4444', '#6366F1', '#EC4899'];
const FONT_SIZES = [18, 24, 32, 42];
const STICKER_PACKS = {
  emoji: ['😍', '🔥', '❤️', '😂', '🥺', '👏', '🎉', '💯', '✨', '🎶', '🌟', '💖', '😎', '🤔', '💪', '🙏'],
  custom: ['📍', '🎵', '📊', '❓', '⏳', '🎂', '🎁', '🏆', '📸', '🌈', '☀️', '🌙'],
};

const FILTERS = [
  { id: 'none', name: 'Normal', style: {} },
  { id: 'grayscale', name: 'Gri', style: { opacity: 0.8 }, overlay: 'rgba(128,128,128,0.4)' },
  { id: 'sepia', name: 'Sepya', style: {}, overlay: 'rgba(112,66,20,0.3)' },
  { id: 'warm', name: 'Sıcak', style: {}, overlay: 'rgba(255,165,0,0.15)' },
  { id: 'cool', name: 'Soğuk', style: {}, overlay: 'rgba(0,100,255,0.15)' },
  { id: 'vintage', name: 'Vintage', style: { opacity: 0.85 }, overlay: 'rgba(160,120,60,0.25)' },
  { id: 'fade', name: 'Soluk', style: { opacity: 0.7 }, overlay: 'rgba(255,255,255,0.2)' },
  { id: 'vivid', name: 'Canlı', style: {}, overlay: 'rgba(255,0,100,0.1)' },
  { id: 'noir', name: 'Noir', style: { opacity: 0.75 }, overlay: 'rgba(0,0,0,0.35)' },
  { id: 'bloom', name: 'Bloom', style: {}, overlay: 'rgba(255,200,255,0.15)' },
  { id: 'sunset', name: 'Gün batımı', style: {}, overlay: 'rgba(255,100,50,0.2)' },
  { id: 'ocean', name: 'Okyanus', style: {}, overlay: 'rgba(0,150,200,0.2)' },
];

export default function StoryCreateScreen({ navigation }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const [mediaUri, setMediaUri] = useState(null);
  const [mediaType, setMediaType] = useState('image');
  const [textOverlays, setTextOverlays] = useState([]);
  const [editingText, setEditingText] = useState(null);
  const [editTextValue, setEditTextValue] = useState('');
  const [editTextSize, setEditTextSize] = useState(24);
  const [activeColor, setActiveColor] = useState('#FFFFFF');
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationInput, setLocationInput] = useState('');

  const [poll, setPoll] = useState(null);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [showPollEditor, setShowPollEditor] = useState(false);

  const [qaQuestion, setQaQuestion] = useState('');
  const [showQAEditor, setShowQAEditor] = useState(false);
  const [qaEnabled, setQaEnabled] = useState(false);

  const [countdownTitle, setCountdownTitle] = useState('');
  const [countdownEnd, setCountdownEnd] = useState('');
  const [showCountdownEditor, setShowCountdownEditor] = useState(false);
  const [countdownEnabled, setCountdownEnabled] = useState(false);

  const [musicTrack, setMusicTrack] = useState(null);
  const [showMusicSearch, setShowMusicSearch] = useState(false);
  const [musicQuery, setMusicQuery] = useState('');
  const [musicResults, setMusicResults] = useState([]);
  const [musicSearching, setMusicSearching] = useState(false);

  const [stickers, setStickers] = useState([]);
  const [showStickerPicker, setShowStickerPicker] = useState(false);

  const [activeFilter, setActiveFilter] = useState('none');
  const [showFilters, setShowFilters] = useState(false);

  const [drawMode, setDrawMode] = useState(false);
  const [drawPaths, setDrawPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);
  const [brushSize, setBrushSize] = useState(3);
  const [brushColor, setBrushColor] = useState('#FFFFFF');

  const [closeFriendsOnly, setCloseFriendsOnly] = useState(false);
  const [replyRestriction, setReplyRestriction] = useState('everyone');
  const [showSettings, setShowSettings] = useState(false);

  const [activeTab, setActiveTab] = useState('tools');
  const [loading, setLoading] = useState(false);

  const pickMedia = async (source) => {
    if (source === 'camera') {
      let VisionCamera = null;
      try { VisionCamera = require('react-native-vision-camera'); } catch {}
      if (VisionCamera) {
        navigation.navigate('CameraCapture', {
          onCapture: (assets) => {
            const a = assets[0];
            if (a && (a.type === 'video' ? (a.duration || 0) <= MAX_VIDEO_DURATION * 1000 : true)) {
              setMediaUri(a.uri);
              setMediaType(a.type || 'image');
            } else if (a?.type === 'video') {
              Alert.alert('Hata', `Video en fazla ${MAX_VIDEO_DURATION} saniye olabilir`);
            }
          },
          maxVideoDuration: MAX_VIDEO_DURATION,
        });
        return;
      }
    }
    try {
      const ImagePicker = require('expo-image-picker');
      let result;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        result = await ImagePicker.launchCameraAsync({
          quality: 0.8,
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          videoMaxDuration: MAX_VIDEO_DURATION,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          quality: 0.8,
          videoMaxDuration: MAX_VIDEO_DURATION,
        });
      }
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        if ((asset.type === 'video' || asset.uri?.includes('.mp4')) && asset.duration && asset.duration > MAX_VIDEO_DURATION * 1000) {
          Alert.alert('Hata', `Video en fazla ${MAX_VIDEO_DURATION} saniye olabilir`);
          return;
        }
        setMediaUri(asset.uri);
        setMediaType(asset.type || 'image');
      }
    } catch {}
  };

  const addTextOverlay = () => {
    setEditTextValue('Metin ekle');
    setEditTextSize(24);
    setEditingText({ isNew: true });
  };

  const saveTextOverlay = () => {
    if (!editTextValue.trim()) { setEditingText(null); return; }
    if (editingText?.isNew) {
      setTextOverlays(prev => [...prev, {
        id: Date.now().toString(),
        text: editTextValue,
        color: activeColor,
        x: SW / 2 - 60,
        y: SH / 3,
        fontSize: editTextSize,
      }]);
    } else if (editingText?.index !== undefined) {
      setTextOverlays(prev => {
        const next = [...prev];
        next[editingText.index] = { ...next[editingText.index], text: editTextValue, color: activeColor, fontSize: editTextSize };
        return next;
      });
    }
    setEditingText(null);
  };

  const removeTextOverlay = (index) => {
    setTextOverlays(prev => prev.filter((_, i) => i !== index));
  };

  const addSticker = (emoji) => {
    setStickers(prev => [...prev, { id: Date.now().toString(), emoji, x: SW / 2 - 20, y: SH / 3 }]);
    setShowStickerPicker(false);
  };

  const removeSticker = (index) => {
    setStickers(prev => prev.filter((_, i) => i !== index));
  };

  const searchMusic = useCallback(async () => {
    if (!musicQuery.trim()) return;
    setMusicSearching(true);
    try {
      const res = await api.get(`/music/search?q=${encodeURIComponent(musicQuery)}&limit=15`, token);
      setMusicResults(res.results || res.tracks || []);
    } catch { setMusicResults([]); }
    setMusicSearching(false);
  }, [musicQuery, token]);

  const createPoll = () => {
    const validOpts = pollOptions.filter(o => o.trim());
    if (!pollQuestion.trim() || validOpts.length < 2) {
      Alert.alert('Hata', 'En az 2 seçenek girin');
      return;
    }
    setPoll({ question: pollQuestion.trim(), options: validOpts });
    setShowPollEditor(false);
  };

  const saveLocation = () => {
    setLocation(locationInput.trim());
    setShowLocationModal(false);
  };

  const publish = async () => {
    setLoading(true);
    try {
      const storyType = mediaType === 'video' ? 'video' : mediaUri ? 'photo' : poll ? 'poll' : 'text';
      const body = {
        story_type: storyType,
        caption,
        location: location || undefined,
        text_overlays: textOverlays.map(t => ({ text: t.text, color: t.color, x: t.x, y: t.y, fontSize: t.fontSize })),
        stickers: stickers.map(s => ({ emoji: s.emoji, x: s.x, y: s.y })),
        filter_id: activeFilter !== 'none' ? activeFilter : undefined,
        close_friends_only: closeFriendsOnly,
        reply_restriction: replyRestriction,
      };
      if (poll) { body.poll_question = poll.question; body.poll_options = poll.options; body.story_type = 'poll'; }
      if (qaEnabled && qaQuestion.trim()) body.qa_question = qaQuestion.trim();
      if (countdownEnabled && countdownTitle.trim()) { body.countdown_title = countdownTitle.trim(); body.countdown_end = countdownEnd || undefined; }
      if (musicTrack) body.music_track_id = musicTrack.id;

      const res = await api.post('/stories', body, token);
      const storyId = res.story?.id || res.id;
      if (mediaUri && storyId) {
        try { await api.uploadFile(`/stories/${storyId}/media`, mediaUri, token); } catch {}
      }
      navigation.goBack();
    } catch { Alert.alert('Hata', 'Hikaye paylaşılamadı'); }
    setLoading(false);
  };

  const drawPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => drawMode,
      onMoveShouldSetPanResponder: () => drawMode,
      onPanResponderGrant: (e) => {
        if (!drawMode) return;
        const { locationX, locationY } = e.nativeEvent;
        setCurrentPath([{ x: locationX, y: locationY }]);
      },
      onPanResponderMove: (e) => {
        if (!drawMode) return;
        const { locationX, locationY } = e.nativeEvent;
        setCurrentPath(prev => [...prev, { x: locationX, y: locationY }]);
      },
      onPanResponderRelease: () => {
        if (!drawMode) return;
        setDrawPaths(prev => [...prev, { points: currentPath, color: brushColor, size: brushSize }]);
        setCurrentPath([]);
      },
    })
  ).current;

  const filterStyle = FILTERS.find(f => f.id === activeFilter);

  return (
    <View style={styles.container}>
      {/* Preview Area */}
      <View style={styles.preview} {...drawPanResponder.panHandlers}>
        {mediaUri ? (
          mediaType === 'video' ? (
            <Video source={{ uri: mediaUri }} style={styles.previewImg} resizeMode="cover" shouldPlay isLooping isMuted />
          ) : (
            <Image source={{ uri: mediaUri }} style={[styles.previewImg, filterStyle?.style]} resizeMode="cover" />
          )
        ) : (
          <View style={[styles.previewImg, { backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="image" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 12 }}>Fotoğraf veya video seç</Text>
          </View>
        )}

        {filterStyle?.overlay && <View style={[StyleSheet.absoluteFill, { backgroundColor: filterStyle.overlay }]} pointerEvents="none" />}

        {/* Draw paths */}
        {drawPaths.map((path, pi) => (
          <View key={pi} style={StyleSheet.absoluteFill} pointerEvents="none">
            {path.points.map((pt, pti) => (
              <View key={pti} style={{ position: 'absolute', left: pt.x - path.size / 2, top: pt.y - path.size / 2, width: path.size, height: path.size, borderRadius: path.size / 2, backgroundColor: path.color }} />
            ))}
          </View>
        ))}
        {currentPath.length > 0 && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {currentPath.map((pt, pti) => (
              <View key={pti} style={{ position: 'absolute', left: pt.x - brushSize / 2, top: pt.y - brushSize / 2, width: brushSize, height: brushSize, borderRadius: brushSize / 2, backgroundColor: brushColor }} />
            ))}
          </View>
        )}

        {/* Text overlays */}
        {textOverlays.map((ov, i) => (
          <TouchableOpacity key={ov.id} style={[styles.overlay, { left: ov.x, top: ov.y }]}
            onPress={() => { setEditTextValue(ov.text); setEditTextSize(ov.fontSize); setActiveColor(ov.color); setEditingText({ index: i }); }}
            onLongPress={() => removeTextOverlay(i)}>
            <Text style={{ color: ov.color, fontSize: ov.fontSize, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 }}>{ov.text}</Text>
          </TouchableOpacity>
        ))}

        {/* Stickers */}
        {stickers.map((s, i) => (
          <TouchableOpacity key={s.id} style={{ position: 'absolute', left: s.x, top: s.y }} onLongPress={() => removeSticker(i)}>
            <Text style={{ fontSize: 36 }}>{s.emoji}</Text>
          </TouchableOpacity>
        ))}

        {/* Poll preview */}
        {poll && (
          <View style={styles.pollPreview}>
            <Text style={styles.pollQuestion}>{poll.question}</Text>
            {poll.options.map((o, i) => (
              <View key={i} style={styles.pollOption}><Text style={{ color: '#FFF' }}>{o}</Text></View>
            ))}
          </View>
        )}

        {/* Q&A preview */}
        {qaEnabled && qaQuestion.trim() ? (
          <View style={[styles.pollPreview, { bottom: poll ? 320 : 160 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="help-circle" size={18} color="#FFF" />
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Soru-Cevap</Text>
            </View>
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>{qaQuestion}</Text>
          </View>
        ) : null}

        {/* Countdown preview */}
        {countdownEnabled && countdownTitle.trim() ? (
          <View style={[styles.countdownPreview]}>
            <Ionicons name="time" size={20} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>{countdownTitle}</Text>
            {countdownEnd ? <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{countdownEnd}</Text> : null}
          </View>
        ) : null}

        {/* Music tag */}
        {musicTrack && (
          <TouchableOpacity style={styles.musicTag} onPress={() => setMusicTrack(null)}>
            <Ionicons name="musical-note" size={14} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 12 }} numberOfLines={1}>{musicTrack.title} - {musicTrack.artist}</Text>
            <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        )}

        {/* Location tag */}
        {location ? (
          <TouchableOpacity style={styles.locationTag} onPress={() => setLocation('')}>
            <Ionicons name="location" size={14} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 12 }}>{location}</Text>
            <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        ) : null}

        {/* Close friends badge */}
        {closeFriendsOnly && (
          <View style={styles.cfBadge}>
            <Ionicons name="star" size={12} color="#10B981" />
            <Text style={{ color: '#10B981', fontSize: 10, fontWeight: '600' }}>Yakın Arkadaşlar</Text>
          </View>
        )}
      </View>

      {/* Top Controls */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <TouchableOpacity onPress={addTextOverlay} style={styles.topIcon}>
            <Ionicons name="text" size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowStickerPicker(true)} style={styles.topIcon}>
            <Ionicons name="happy" size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDrawMode(!drawMode)} style={[styles.topIcon, drawMode && { backgroundColor: BRAND.primary }]}>
            <Ionicons name="brush" size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowFilters(true)} style={styles.topIcon}>
            <Ionicons name="color-filter" size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.topIcon}>
            <Ionicons name="settings-outline" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Draw mode toolbar */}
      {drawMode && (
        <View style={styles.drawToolbar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
            {COLORS.map(c => (
              <TouchableOpacity key={c} onPress={() => setBrushColor(c)}
                style={[styles.colorDot, { backgroundColor: c, borderWidth: brushColor === c ? 3 : 1, borderColor: brushColor === c ? '#FFF' : 'rgba(255,255,255,0.3)' }]} />
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 6 }}>
            {[2, 4, 8, 14].map(s => (
              <TouchableOpacity key={s} onPress={() => setBrushSize(s)}
                style={[styles.brushBtn, brushSize === s && { borderColor: '#FFF' }]}>
                <View style={{ width: s, height: s, borderRadius: s / 2, backgroundColor: '#FFF' }} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => { setDrawPaths([]); setCurrentPath([]); }} style={styles.brushBtn}>
              <Ionicons name="trash" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bottom Tools */}
      {!drawMode && (
        <View style={styles.bottomTools}>
          {/* Tabs */}
          <View style={styles.tabRow}>
            {[
              { key: 'tools', icon: 'apps', label: 'Araçlar' },
              { key: 'stickers', icon: 'happy', label: 'Etiketler' },
            ].map(tab => (
              <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)}
                style={[styles.tab, activeTab === tab.key && { borderBottomColor: BRAND.primary }]}>
                <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? '#FFF' : 'rgba(255,255,255,0.5)'} />
                <Text style={{ color: activeTab === tab.key ? '#FFF' : 'rgba(255,255,255,0.5)', fontSize: 11 }}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'tools' && (
            <>
          <View style={styles.sourceRow}>
            <TouchableOpacity style={styles.sourceBtn} onPress={() => pickMedia('gallery')}>
              <Ionicons name="images" size={22} color="#FFF" />
              <Text style={styles.sourceLbl}>Galeri</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sourceBtn} onPress={() => pickMedia('camera')}>
              <Ionicons name="camera" size={22} color="#FFF" />
              <Text style={styles.sourceLbl}>Kamera</Text>
            </TouchableOpacity>
                <TouchableOpacity style={styles.sourceBtn} onPress={() => setShowMusicSearch(true)}>
                  <Ionicons name="musical-note" size={22} color={musicTrack ? BRAND.primary : '#FFF'} />
              <Text style={styles.sourceLbl}>Müzik</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sourceBtn} onPress={() => setShowLocationModal(true)}>
                  <Ionicons name="location" size={22} color={location ? BRAND.primary : '#FFF'} />
                  <Text style={styles.sourceLbl}>Konum</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sourceBtn} onPress={() => setShowPollEditor(true)}>
                  <Ionicons name="bar-chart" size={22} color={poll ? BRAND.primary : '#FFF'} />
                  <Text style={styles.sourceLbl}>Anket</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {activeTab === 'stickers' && (
            <View style={styles.sourceRow}>
              <TouchableOpacity style={styles.sourceBtn} onPress={() => setShowQAEditor(true)}>
                <Ionicons name="help-circle" size={22} color={qaEnabled ? BRAND.primary : '#FFF'} />
                <Text style={styles.sourceLbl}>Soru-Cevap</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sourceBtn} onPress={() => setShowCountdownEditor(true)}>
                <Ionicons name="time" size={22} color={countdownEnabled ? BRAND.primary : '#FFF'} />
                <Text style={styles.sourceLbl}>Geri Sayım</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sourceBtn} onPress={() => setShowStickerPicker(true)}>
                <Ionicons name="happy" size={22} color="#FFF" />
                <Text style={styles.sourceLbl}>Çıkartma</Text>
            </TouchableOpacity>
          </View>
          )}

          {/* Caption & Publish */}
          <View style={styles.captionRow}>
            <TextInput style={styles.captionInput} placeholder="Hikayene bir şeyler yaz..." placeholderTextColor="rgba(255,255,255,0.5)"
              value={caption} onChangeText={setCaption} />
            <TouchableOpacity style={[styles.publishBtn, { opacity: loading ? 0.5 : 1 }]} onPress={publish} disabled={loading}>
              <Ionicons name="send" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ====== MODALS ====== */}

      {/* Text Editor Modal */}
      {editingText && (
        <Modal visible transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Metin Düzenle</Text>
              <TextInput style={[styles.pollInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                placeholder="Metin" placeholderTextColor={colors.textMuted} value={editTextValue} onChangeText={setEditTextValue} autoFocus multiline />
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>Renk:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
                {COLORS.map(c => (
                  <TouchableOpacity key={c} onPress={() => setActiveColor(c)}
                    style={[styles.colorDot, { backgroundColor: c, borderWidth: activeColor === c ? 3 : 1, borderColor: activeColor === c ? BRAND.primary : colors.border }]} />
                ))}
              </ScrollView>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>Boyut:</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {FONT_SIZES.map(s => (
                  <TouchableOpacity key={s} onPress={() => setEditTextSize(s)}
                    style={[styles.sizeBtn, { borderColor: editTextSize === s ? BRAND.primary : colors.border }]}>
                    <Text style={{ color: editTextSize === s ? BRAND.primary : colors.text, fontSize: 12 }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={saveTextOverlay}>
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Kaydet</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ alignItems: 'center', marginTop: 12 }} onPress={() => setEditingText(null)}>
                <Text style={{ color: colors.textMuted }}>İptal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Poll Editor Modal */}
      {showPollEditor && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Anket Oluştur</Text>
              <TextInput style={[styles.pollInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                placeholder="Soru" placeholderTextColor={colors.textMuted} value={pollQuestion} onChangeText={setPollQuestion} />
            {pollOptions.map((o, i) => (
                <TextInput key={i} style={[styles.pollInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                  placeholder={`Seçenek ${i + 1}`} placeholderTextColor={colors.textMuted} value={o}
                onChangeText={(t) => { const next = [...pollOptions]; next[i] = t; setPollOptions(next); }} />
            ))}
            {pollOptions.length < 4 && (
              <TouchableOpacity onPress={() => setPollOptions(prev => [...prev, ''])} style={{ paddingVertical: 8 }}>
                <Text style={{ color: BRAND.primary }}>+ Seçenek Ekle</Text>
              </TouchableOpacity>
            )}
              <TouchableOpacity style={styles.saveBtn} onPress={createPoll}>
              <Text style={{ color: '#FFF', fontWeight: '700' }}>Anketi Ekle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', marginTop: 12 }} onPress={() => setShowPollEditor(false)}>
              <Text style={{ color: colors.textMuted }}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
        </Modal>
      )}

      {/* Q&A Editor Modal */}
      {showQAEditor && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Soru-Cevap Etiketi</Text>
              <TextInput style={[styles.pollInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                placeholder="Takipçileriniz ne sorsun?" placeholderTextColor={colors.textMuted} value={qaQuestion} onChangeText={setQaQuestion} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 }}>
                <Text style={{ color: colors.text }}>Etiketi Etkinleştir</Text>
                <Switch value={qaEnabled} onValueChange={setQaEnabled} trackColor={{ true: BRAND.primary }} />
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={() => setShowQAEditor(false)}>
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Tamam</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Countdown Editor Modal */}
      {showCountdownEditor && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Geri Sayım</Text>
              <TextInput style={[styles.pollInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                placeholder="Etkinlik adı" placeholderTextColor={colors.textMuted} value={countdownTitle} onChangeText={setCountdownTitle} />
              <TextInput style={[styles.pollInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                placeholder="Bitiş (ör: 2026-03-15T18:00)" placeholderTextColor={colors.textMuted} value={countdownEnd} onChangeText={setCountdownEnd} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 }}>
                <Text style={{ color: colors.text }}>Geri Sayımı Etkinleştir</Text>
                <Switch value={countdownEnabled} onValueChange={setCountdownEnabled} trackColor={{ true: BRAND.primary }} />
              </View>
              <TouchableOpacity style={styles.saveBtn} onPress={() => setShowCountdownEditor(false)}>
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Tamam</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Music Search Modal */}
      {showMusicSearch && (
        <Modal visible transparent animationType="slide">
          <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12, gap: 12 }}>
              <TouchableOpacity onPress={() => setShowMusicSearch(false)}><Ionicons name="arrow-back" size={22} color={colors.text} /></TouchableOpacity>
              <TextInput style={[styles.pollInput, { flex: 1, backgroundColor: colors.inputBg, color: colors.text, marginBottom: 0 }]}
                placeholder="Şarkı ara..." placeholderTextColor={colors.textMuted} value={musicQuery} onChangeText={setMusicQuery}
                onSubmitEditing={searchMusic} returnKeyType="search" autoFocus />
            </View>
            <FlatList data={musicResults}
              keyExtractor={(item, i) => item.id || `${i}`}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.musicRow, { borderBottomColor: colors.border }]}
                  onPress={() => { setMusicTrack(item); setShowMusicSearch(false); }}>
                  {item.cover_url || item.thumbnail ? (
                    <Image source={{ uri: item.cover_url || item.thumbnail }} style={styles.musicThumb} />
                  ) : (
                    <View style={[styles.musicThumb, { backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="musical-note" size={18} color={BRAND.primary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>{item.title}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>{item.artist}</Text>
                  </View>
                  <Ionicons name="add-circle" size={22} color={BRAND.primary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', padding: 40 }}>
                  <Text style={{ color: colors.textMuted }}>{musicSearching ? 'Aranıyor...' : 'Şarkı arayın'}</Text>
                </View>
              }
            />
          </View>
        </Modal>
      )}

      {/* Sticker Picker Modal */}
      {showStickerPicker && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface, maxHeight: SH * 0.5 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Çıkartmalar</Text>
                <TouchableOpacity onPress={() => setShowStickerPicker(false)}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>Emojiler</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                {STICKER_PACKS.emoji.map((e, i) => (
                  <TouchableOpacity key={i} onPress={() => addSticker(e)} style={styles.stickerItem}>
                    <Text style={{ fontSize: 28 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>Özel</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {STICKER_PACKS.custom.map((e, i) => (
                  <TouchableOpacity key={i} onPress={() => addSticker(e)} style={styles.stickerItem}>
                    <Text style={{ fontSize: 28 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Filter Picker Modal */}
      {showFilters && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Filtreler</Text>
                <TouchableOpacity onPress={() => setShowFilters(false)}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {FILTERS.map(f => (
                  <TouchableOpacity key={f.id} onPress={() => { setActiveFilter(f.id); setShowFilters(false); }}
                    style={[styles.filterItem, { borderColor: activeFilter === f.id ? BRAND.primary : colors.border }]}>
                    <View style={[styles.filterPreview, { backgroundColor: f.overlay || colors.surfaceElevated }]} />
                    <Text style={{ color: activeFilter === f.id ? BRAND.primary : colors.text, fontSize: 11, marginTop: 4 }}>{f.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Location Picker */}
      <LocationPicker
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onSelect={(loc) => { setLocation(loc.name || ''); setLocationInput(''); }}
      />

      {/* Settings Modal */}
      {showSettings && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>Hikaye Ayarları</Text>
                <TouchableOpacity onPress={() => setShowSettings(false)}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
              </View>

              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Yakın Arkadaşlara Özel</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>Sadece yakın arkadaşlarınız görebilir</Text>
                </View>
                <Switch value={closeFriendsOnly} onValueChange={setCloseFriendsOnly} trackColor={{ true: BRAND.primary }} />
              </View>

              <Text style={{ color: colors.text, fontWeight: '600', marginTop: 16, marginBottom: 8 }}>Yanıt Kısıtlaması</Text>
              {[
                { key: 'everyone', label: 'Herkes' },
                { key: 'followers', label: 'Sadece Takipçiler' },
                { key: 'close_friends', label: 'Yakın Arkadaşlar' },
                { key: 'nobody', label: 'Kimse' },
              ].map(opt => (
                <TouchableOpacity key={opt.key} onPress={() => setReplyRestriction(opt.key)}
                  style={[styles.radioRow, { borderColor: replyRestriction === opt.key ? BRAND.primary : colors.border }]}>
                  <View style={[styles.radio, replyRestriction === opt.key && { backgroundColor: BRAND.primary }]} />
                  <Text style={{ color: colors.text }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  preview: { flex: 1, position: 'relative' },
  previewImg: { width: '100%', height: '100%' },
  overlay: { position: 'absolute' },
  pollPreview: { position: 'absolute', bottom: 160, left: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, padding: 16 },
  pollQuestion: { color: '#FFF', fontSize: 16, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  pollOption: { backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginBottom: 6 },
  countdownPreview: { position: 'absolute', top: 120, right: 16, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 10, alignItems: 'center', gap: 4 },
  musicTag: { position: 'absolute', bottom: 140, left: 20, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, maxWidth: SW * 0.7 },
  locationTag: { position: 'absolute', bottom: 108, left: 20, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  cfBadge: { position: 'absolute', top: 100, left: 16, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  topBar: { position: 'absolute', top: 50, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topIcon: { padding: 6, borderRadius: 20 },
  drawToolbar: { position: 'absolute', bottom: 30, left: 0, right: 0, paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.7)' },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  brushBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  bottomTools: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 30, backgroundColor: 'rgba(0,0,0,0.6)' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.2)' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  sourceRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, paddingVertical: 10, flexWrap: 'wrap' },
  sourceBtn: { alignItems: 'center', gap: 2, minWidth: 50 },
  sourceLbl: { color: '#FFF', fontSize: 10, textAlign: 'center' },
  captionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  captionInput: { flex: 1, color: '#FFF', fontSize: 14, paddingVertical: 10 },
  publishBtn: { backgroundColor: BRAND.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, alignItems: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  pollInput: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 8 },
  saveBtn: { backgroundColor: BRAND.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  sizeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  musicRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12, borderBottomWidth: 0.5 },
  musicThumb: { width: 44, height: 44, borderRadius: 8, overflow: 'hidden' },
  stickerItem: { padding: 6 },
  filterItem: { alignItems: 'center', borderWidth: 2, borderRadius: 12, padding: 4 },
  filterPreview: { width: 54, height: 54, borderRadius: 8 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.1)' },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: 10, marginBottom: 6 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
});
