/**
 * StoryCreateScreen — Instagram tarzı tam ekran hikaye oluşturucu
 *
 * Aşama 1 — CAPTURE: Kamera / galeri / metin modu
 * Aşama 2 — EDIT:    Tam ekran medya + overlay araçlar, filtreler, paylaş
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  TextInput, Alert, ActivityIndicator, Modal, FlatList,
  Dimensions, ScrollView, Pressable, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import StoryCamera from '../components/story/StoryCamera';

const { width: SW, height: SH } = Dimensions.get('window');

// Arka plan gradyanları (Text modunda)
const BG_GRADIENTS = [
  ['#7C3AED', '#4C1D95'],
  ['#EC4899', '#9D174D'],
  ['#06B6D4', '#0E7490'],
  ['#10B981', '#065F46'],
  ['#F59E0B', '#92400E'],
  ['#EF4444', '#991B1B'],
  ['#1E1B4B', '#312E81'],
  ['#111827', '#374151'],
];

// Filtre tanımlamaları
const FILTERS = [
  { id: 'normal',   label: 'Normal',   tint: null },
  { id: 'warm',     label: 'Sıcak',    tint: 'rgba(255,160,50,0.25)' },
  { id: 'cool',     label: 'Soğuk',    tint: 'rgba(50,120,255,0.25)' },
  { id: 'vintage',  label: 'Vintage',  tint: 'rgba(180,130,70,0.35)' },
  { id: 'noir',     label: 'Noir',     tint: 'rgba(0,0,0,0.55)' },
  { id: 'dramatic', label: 'Dramatik', tint: 'rgba(80,0,0,0.3)' },
  { id: 'fade',     label: 'Fade',     tint: 'rgba(255,255,255,0.25)' },
];

// Sticker kategorileri
const STICKER_ACTIONS = [
  { id: 'poll',      icon: 'bar-chart',       label: 'Anket'     },
  { id: 'music',     icon: 'musical-notes',   label: 'Müzik'     },
  { id: 'location',  icon: 'location',        label: 'Konum'     },
  { id: 'mention',   icon: 'at',              label: 'Kişi etiket' },
  { id: 'link',      icon: 'link',            label: 'Bağlantı'  },
  { id: 'countdown', icon: 'time',            label: 'Geri sayım'},
];

// ── Yardımcı: Filtre Thumbnail ────────────────────────────────────────────────
function FilterThumb({ filter, selected, mediaUri, bgGradient, onPress }) {
  return (
    <TouchableOpacity style={[st.filterThumb, selected && st.filterThumbSelected]} onPress={onPress}>
      <View style={st.filterThumbInner}>
        {mediaUri ? (
          <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient colors={bgGradient} style={StyleSheet.absoluteFill} />
        )}
        {filter.tint && <View style={[StyleSheet.absoluteFill, { backgroundColor: filter.tint }]} />}
      </View>
      <Text style={[st.filterLabel, selected && st.filterLabelSelected]}>{filter.label}</Text>
    </TouchableOpacity>
  );
}

// ── Ana ekran ────────────────────────────────────────────────────────────────
export default function StoryCreateScreen({ navigation }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  /* ── Durum ── */
  const [phase, setPhase] = useState('capture');     // 'capture' | 'edit'
  const [captureMode, setCaptureMode] = useState('camera'); // 'camera' | 'text'
  const [showCamera, setShowCamera] = useState(false);
  const [mediaUri, setMediaUri] = useState(null);
  const [mediaIsVideo, setMediaIsVideo] = useState(false);
  const [bgGradient, setBgGradient] = useState(BG_GRADIENTS[0]);
  const [selectedFilter, setSelectedFilter] = useState('normal');
  const [uploading, setUploading] = useState(false);
  const [closeFriendsOnly, setCloseFriendsOnly] = useState(false);

  /* Overlay araçlar */
  const [overlayText, setOverlayText] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textAlign, setTextAlign] = useState('center');

  /* Sticker sheet */
  const [showStickerSheet, setShowStickerSheet] = useState(false);

  /* Sticker değerleri */
  const [locationSticker, setLocationSticker] = useState(null);
  const [mentionSticker, setMentionSticker] = useState(null);
  const [linkSticker, setLinkSticker] = useState('');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [showPoll, setShowPoll] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [countdownTitle, setCountdownTitle] = useState('');
  const [countdownEnd, setCountdownEnd] = useState('');
  const [showCountdown, setShowCountdown] = useState(false);

  /* Modallar */
  const [activeModal, setActiveModal] = useState(null); // 'music'|'mention'|'link'|'poll'|'countdown'
  const [musicSearch, setMusicSearch] = useState('');
  const [musicResults, setMusicResults] = useState([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionLoading, setMentionLoading] = useState(false);

  /* ── Müzik arama ── */
  const searchMusic = useCallback(async (q) => {
    if (!q?.trim()) { setMusicResults([]); return; }
    setMusicLoading(true);
    try {
      const res = await api.get(`/music/search/${encodeURIComponent(q.trim())}`, token);
      setMusicResults(res?.results || res?.songs || (Array.isArray(res) ? res : []));
    } catch { setMusicResults([]); }
    setMusicLoading(false);
  }, [token]);

  useEffect(() => {
    const id = setTimeout(() => searchMusic(musicSearch), 400);
    return () => clearTimeout(id);
  }, [musicSearch]);

  /* ── Kullanıcı arama ── */
  const searchMentions = useCallback(async (q) => {
    if (!q?.trim()) { setMentionResults([]); return; }
    setMentionLoading(true);
    try {
      const res = await api.get(`/search?q=${encodeURIComponent(q.trim())}&limit=15`, token);
      setMentionResults(res?.users || []);
    } catch { setMentionResults([]); }
    setMentionLoading(false);
  }, [token]);

  useEffect(() => {
    const id = setTimeout(() => searchMentions(mentionQuery), 400);
    return () => clearTimeout(id);
  }, [mentionQuery]);

  /* ── Galeri ── */
  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.permissionRequired'), t('common.galleryPermission'));
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.9,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setMediaUri(asset.uri);
        setMediaIsVideo(asset.type?.startsWith('video') || false);
        setPhase('edit');
      }
    } catch (err) {
      Alert.alert(t('common.error'), err.message);
    }
  };

  /* ── Konum ── */
  const addLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationSticker('Konum'); return; }
      const loc = await Location.getCurrentPositionAsync({});
      const [rev] = await Location.reverseGeocodeAsync(loc.coords);
      setLocationSticker(rev ? `${rev.city || ''}, ${rev.country || ''}`.trim() || 'Konum' : 'Konum');
    } catch { setLocationSticker('Konum'); }
  };

  /* ── Sticker aksiyonu ── */
  const handleStickerAction = (id) => {
    setShowStickerSheet(false);
    if (id === 'music')     { setActiveModal('music'); return; }
    if (id === 'mention')   { setActiveModal('mention'); return; }
    if (id === 'link')      { setActiveModal('link'); return; }
    if (id === 'poll')      { setActiveModal('poll'); setShowPoll(true); return; }
    if (id === 'countdown') { setActiveModal('countdown'); return; }
    if (id === 'location')  { addLocation(); }
  };

  /* ── Paylaş ── */
  const handleSubmit = async () => {
    if (phase !== 'edit' && captureMode !== 'text') return;
    if (captureMode === 'text' && !overlayText.trim()) {
      Alert.alert(t('common.warning'), 'Bir şeyler yaz.');
      return;
    }
    if (showPoll) {
      if (!pollQuestion.trim()) { Alert.alert(t('common.warning'), t('stories.enterPollQuestion')); return; }
      if (pollOptions.filter(Boolean).length < 2) { Alert.alert(t('common.warning'), t('stories.minPollOptions')); return; }
    }

    setUploading(true);
    try {
      let mediaUrl = null;
      if (mediaUri) {
        mediaUrl = await api.uploadFile(mediaUri, token, 'story', mediaIsVideo ? 'video/mp4' : 'image/jpeg');
      }
      const payload = {
        story_type: showPoll ? 'poll' : mediaIsVideo ? 'video' : (mediaUri ? 'photo' : 'text'),
        text: overlayText.trim() || null,
        media_url: mediaUrl,
        media_type: mediaIsVideo ? 'video' : 'photo',
        background_color: bgGradient[0],
        filter: selectedFilter,
        duration: mediaIsVideo ? 60 : 30,
        audience: closeFriendsOnly ? 'close_friends' : 'all',
        ...(showPoll && { poll_question: pollQuestion.trim(), poll_options: pollOptions.filter(Boolean) }),
        ...(selectedMusic && { music_track_id: selectedMusic.id || selectedMusic.video_id, music_start_time: 0 }),
        ...(locationSticker && { location_name: locationSticker }),
        ...(mentionSticker && { mention_username: mentionSticker }),
        ...(linkSticker && { link_url: linkSticker }),
        ...(showCountdown && countdownEnd && { countdown_title: countdownTitle || 'Countdown', countdown_end: countdownEnd }),
      };
      await api.post('/stories', payload, token);
      Alert.alert(t('common.success'), t('stories.shared'), [{ text: t('common.ok'), onPress: () => navigation.goBack() }]);
    } catch (err) {
      Alert.alert(t('common.error'), err?.data?.detail || err.message || t('stories.shareFailed'));
    } finally {
      setUploading(false);
    }
  };

  const currentFilter = FILTERS.find(f => f.id === selectedFilter) || FILTERS[0];

  /* ════════════════════════════════════════════════════════════
     AŞAMA 1 — CAPTURE
  ════════════════════════════════════════════════════════════ */
  if (phase === 'capture') {
    return (
      <View style={st.captureRoot}>
        {/* Arka plan */}
        {captureMode === 'text' ? (
          <LinearGradient colors={bgGradient} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />
        )}

        {/* Üst bar */}
        <View style={[st.captureTopBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={st.captureIconBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {/* Mod seçici */}
          <View style={st.modeRow}>
            {['camera', 'text'].map(m => (
              <TouchableOpacity key={m} style={[st.modeTab, captureMode === m && st.modeTabActive]} onPress={() => setCaptureMode(m)}>
                <Text style={[st.modeTabText, captureMode === m && st.modeTabTextActive]}>
                  {m === 'camera' ? 'Kamera' : 'Metin'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ width: 44 }} />
        </View>

        {/* Metin modu — arka plan rengi seçici */}
        {captureMode === 'text' && (
          <>
            <TouchableOpacity style={st.textModeCenter} onPress={() => setShowTextInput(true)} activeOpacity={0.85}>
              {overlayText ? (
                <View style={[st.textOverlayBubble, { alignSelf: 'center' }]}>
                  <Text style={[st.textOverlayValue, { textAlign: textAlign }]}>{overlayText}</Text>
                </View>
              ) : (
                <View style={st.textTapHint}>
                  <Text style={st.textTapHintText}>Yazmak için dokun</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={st.bgColorStrip}>
              {BG_GRADIENTS.map((g, i) => (
                <TouchableOpacity key={i} onPress={() => setBgGradient(g)}>
                  <LinearGradient colors={g} style={[st.bgColorDot, bgGradient === g && st.bgColorDotSelected]} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Kamera modu içerik alanı */}
        {captureMode === 'camera' && (
          <View style={st.cameraPlaceholder}>
            <Ionicons name="camera" size={56} color="rgba(255,255,255,0.15)" />
          </View>
        )}

        {/* Alt kontroller */}
        <View style={[st.captureBottomBar, { paddingBottom: insets.bottom + 16 }]}>
          {/* Galeri */}
          <TouchableOpacity style={st.galleryBtn} onPress={openGallery}>
            <Ionicons name="images-outline" size={26} color="#fff" />
            <Text style={st.galleryBtnText}>Galeri</Text>
          </TouchableOpacity>

          {/* Kamera / İleri butonu */}
          {captureMode === 'camera' ? (
            <TouchableOpacity style={st.captureBtn} onPress={() => setShowCamera(true)}>
              <View style={st.captureBtnInner} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[st.textNextBtn, !overlayText.trim() && { opacity: 0.4 }]}
              onPress={() => overlayText.trim() && setPhase('edit')}
              disabled={!overlayText.trim()}
            >
              <Ionicons name="arrow-forward" size={26} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Flip kamera (kamera modunda) */}
          {captureMode === 'camera' ? (
            <TouchableOpacity style={st.flipBtn}>
              <Ionicons name="camera-reverse-outline" size={26} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={st.flipBtn} onPress={() => {
              const i = BG_GRADIENTS.indexOf(bgGradient);
              setBgGradient(BG_GRADIENTS[(i + 1) % BG_GRADIENTS.length]);
            }}>
              <Ionicons name="color-palette-outline" size={26} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* StoryCamera modal */}
        {showCamera && (
          <Modal visible animationType="slide" onRequestClose={() => setShowCamera(false)}>
            <StoryCamera
              visible={showCamera}
              onCapture={(uri) => {
                setMediaUri(uri);
                setMediaIsVideo(uri?.includes('.mp4') || uri?.includes('.mov'));
                setShowCamera(false);
                setPhase('edit');
              }}
              onClose={() => setShowCamera(false)}
            />
          </Modal>
        )}

        {/* Metin giriş modalı */}
        {showTextInput && (
          <Modal transparent visible animationType="fade" onRequestClose={() => setShowTextInput(false)}>
            <View style={st.textModal}>
              <LinearGradient colors={bgGradient} style={StyleSheet.absoluteFill} />
              <View style={[st.textModalTop, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity onPress={() => setShowTextInput(false)}>
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
                {/* Hizalama */}
                <TouchableOpacity onPress={() => setTextAlign(a => a === 'center' ? 'left' : a === 'left' ? 'right' : 'center')} style={st.textAlignBtn}>
                  <Ionicons name={textAlign === 'center' ? 'text' : textAlign === 'left' ? 'reorder-four-outline' : 'reorder-three-outline'} size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={st.textDoneBtn} onPress={() => setShowTextInput(false)}>
                  <Text style={st.textDoneBtnText}>Bitti</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[st.fullTextInput, { textAlign }]}
                placeholder="Bir şey yaz..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={overlayText}
                onChangeText={setOverlayText}
                multiline
                autoFocus
                maxLength={200}
              />
            </View>
          </Modal>
        )}
      </View>
    );
  }

  /* ════════════════════════════════════════════════════════════
     AŞAMA 2 — EDIT
  ════════════════════════════════════════════════════════════ */
  return (
    <View style={st.editRoot}>
      {/* Tam ekran medya / arka plan */}
      {mediaUri ? (
        <Image source={{ uri: mediaUri }} style={st.editBg} resizeMode="cover" />
      ) : (
        <LinearGradient colors={bgGradient} style={st.editBg} />
      )}

      {/* Filtre tinti */}
      {currentFilter.tint && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: currentFilter.tint }]} />
      )}

      {/* Overlay metin */}
      {overlayText ? (
        <TouchableOpacity style={st.overlayTextWrap} onPress={() => setShowTextInput(true)} activeOpacity={0.8}>
          <View style={st.textOverlayBubble}>
            <Text style={[st.textOverlayValue, { textAlign }]}>{overlayText}</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Sticker overlay'leri */}
      {locationSticker && (
        <TouchableOpacity style={st.stickerChipTopLeft} onPress={() => setLocationSticker(null)}>
          <Ionicons name="location" size={13} color="#fff" />
          <Text style={st.stickerChipText}>{locationSticker}</Text>
        </TouchableOpacity>
      )}
      {mentionSticker && (
        <TouchableOpacity style={st.stickerChipTopCenter} onPress={() => setMentionSticker(null)}>
          <Text style={st.stickerChipText}>@{mentionSticker}</Text>
        </TouchableOpacity>
      )}
      {selectedMusic && (
        <TouchableOpacity style={st.musicChip} onPress={() => setSelectedMusic(null)}>
          <Ionicons name="musical-notes" size={13} color="#fff" />
          <Text style={st.musicChipText} numberOfLines={1}>
            {selectedMusic.title || selectedMusic.name}
          </Text>
        </TouchableOpacity>
      )}
      {linkSticker ? (
        <TouchableOpacity style={st.stickerChipBottom} onPress={() => setLinkSticker('')}>
          <Ionicons name="link" size={13} color="#fff" />
          <Text style={st.stickerChipText} numberOfLines={1}>{linkSticker}</Text>
        </TouchableOpacity>
      ) : null}
      {showPoll && pollQuestion ? (
        <View style={st.pollPreview}>
          <Text style={st.pollPreviewQ}>{pollQuestion}</Text>
          {pollOptions.filter(Boolean).map((o, i) => (
            <View key={i} style={st.pollPreviewOpt}><Text style={st.pollPreviewOptText}>{o}</Text></View>
          ))}
        </View>
      ) : null}

      {/* ── ÜST BAR ── */}
      <View style={[st.editTopBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={st.editIconBtn} onPress={() => { setMediaUri(null); setPhase('capture'); }}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        {/* Sağ araçlar */}
        <View style={st.rightTools}>
          <TouchableOpacity style={st.editToolBtn} onPress={() => setShowTextInput(true)}>
            <Text style={st.textToolIcon}>Aa</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.editToolBtn} onPress={() => setShowStickerSheet(true)}>
            <Ionicons name="happy-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={st.editToolBtn} onPress={() => setActiveModal('music')}>
            <Ionicons name="musical-notes-outline" size={24} color={selectedMusic ? '#A78BFA' : '#fff'} />
          </TouchableOpacity>
          <TouchableOpacity style={st.editToolBtn} onPress={() => setActiveModal('link')}>
            <Ionicons name="link-outline" size={24} color={linkSticker ? '#A78BFA' : '#fff'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── ALT: Filtreler + Paylaş ── */}
      <View style={[st.editBottom, { paddingBottom: insets.bottom + 8 }]}>
        {/* Filtre şeridi */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.filterStrip} contentContainerStyle={st.filterStripContent}>
          {FILTERS.map(f => (
            <FilterThumb
              key={f.id}
              filter={f}
              selected={selectedFilter === f.id}
              mediaUri={mediaUri}
              bgGradient={bgGradient}
              onPress={() => setSelectedFilter(f.id)}
            />
          ))}
        </ScrollView>

        {/* Paylaş satırı */}
        <View style={st.shareRow}>
          {/* Yakın arkadaşlar */}
          <TouchableOpacity
            style={[st.closeFriendsBtn, closeFriendsOnly && st.closeFriendsBtnActive]}
            onPress={() => setCloseFriendsOnly(v => !v)}
          >
            <Ionicons name={closeFriendsOnly ? 'star' : 'star-outline'} size={18} color={closeFriendsOnly ? '#10B981' : '#fff'} />
            <Text style={[st.closeFriendsTxt, closeFriendsOnly && { color: '#10B981' }]}>
              {closeFriendsOnly ? 'Yakın Arkadaşlar' : 'Herkese'}
            </Text>
          </TouchableOpacity>

          {/* Hikayene Ekle */}
          <TouchableOpacity
            style={[st.shareBtn, uploading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={st.shareBtnText}>Hikayene Ekle</Text>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Metin girişi (edit fazında da) ── */}
      {showTextInput && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setShowTextInput(false)}>
          <View style={st.textModal}>
            {mediaUri
              ? <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              : <LinearGradient colors={bgGradient} style={StyleSheet.absoluteFill} />
            }
            {currentFilter.tint && <View style={[StyleSheet.absoluteFill, { backgroundColor: currentFilter.tint }]} />}
            <View style={[st.textModalTop, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity onPress={() => setShowTextInput(false)}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTextAlign(a => a === 'center' ? 'left' : a === 'left' ? 'right' : 'center')} style={st.textAlignBtn}>
                <Ionicons name="reorder-four-outline" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={st.textDoneBtn} onPress={() => setShowTextInput(false)}>
                <Text style={st.textDoneBtnText}>Bitti</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[st.fullTextInput, { textAlign }]}
              placeholder="Bir şey yaz..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={overlayText}
              onChangeText={setOverlayText}
              multiline
              autoFocus
              maxLength={200}
            />
          </View>
        </Modal>
      )}

      {/* ── Sticker Sheet ── */}
      <Modal transparent visible={showStickerSheet} animationType="slide" onRequestClose={() => setShowStickerSheet(false)}>
        <Pressable style={st.sheetOverlay} onPress={() => setShowStickerSheet(false)}>
          <View style={[st.stickerSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={st.sheetHandle} />
            <Text style={st.sheetTitle}>Sticker Ekle</Text>
            <View style={st.stickerGrid}>
              {STICKER_ACTIONS.map(s => (
                <TouchableOpacity key={s.id} style={st.stickerGridItem} onPress={() => handleStickerAction(s.id)}>
                  <View style={st.stickerGridIcon}>
                    <Ionicons name={s.icon} size={26} color="#A78BFA" />
                  </View>
                  <Text style={st.stickerGridLabel}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── Müzik modal ── */}
      <Modal transparent visible={activeModal === 'music'} animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <Pressable style={st.sheetOverlay} onPress={() => setActiveModal(null)}>
          <View style={[st.bottomSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={st.sheetHandle} />
            <Text style={st.sheetTitle}>Müzik Ekle</Text>
            <TextInput style={st.searchInput} placeholder="Şarkı ara..." placeholderTextColor="#6B7280" value={musicSearch} onChangeText={setMusicSearch} autoFocus />
            {musicLoading ? <ActivityIndicator size="small" color="#A78BFA" style={{ marginVertical: 20 }} /> : (
              <FlatList
                data={musicResults}
                keyExtractor={(item, i) => item.id || item.video_id || String(i)}
                style={{ maxHeight: 260 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={st.resultRow} onPress={() => { setSelectedMusic(item); setActiveModal(null); setMusicSearch(''); setMusicResults([]); }}>
                    <Ionicons name="musical-notes" size={22} color="#A78BFA" />
                    <View style={{ flex: 1 }}>
                      <Text style={st.resultTitle} numberOfLines={1}>{item.title || item.name}</Text>
                      <Text style={st.resultSub} numberOfLines={1}>{item.artist || item.uploader || ''}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={musicSearch.trim() ? <Text style={st.emptyTxt}>Sonuç bulunamadı</Text> : null}
              />
            )}
            <TouchableOpacity style={st.doneBtn} onPress={() => { setActiveModal(null); setMusicSearch(''); setMusicResults([]); }}>
              <Text style={st.doneBtnTxt}>Bitti</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Mention modal ── */}
      <Modal transparent visible={activeModal === 'mention'} animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <Pressable style={st.sheetOverlay} onPress={() => setActiveModal(null)}>
          <View style={[st.bottomSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={st.sheetHandle} />
            <Text style={st.sheetTitle}>Kişi Etiketle</Text>
            <TextInput style={st.searchInput} placeholder="Kullanıcı adı ara..." placeholderTextColor="#6B7280" value={mentionQuery} onChangeText={setMentionQuery} autoFocus />
            {mentionLoading ? <ActivityIndicator size="small" color="#A78BFA" style={{ marginVertical: 20 }} /> : (
              <FlatList
                data={mentionResults}
                keyExtractor={(item, i) => item.id || item.username || String(i)}
                style={{ maxHeight: 260 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={st.resultRow} onPress={() => { setMentionSticker(item.username); setActiveModal(null); setMentionQuery(''); setMentionResults([]); }}>
                    <View style={st.mentionAvatar}><Ionicons name="person" size={18} color="#A78BFA" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={st.resultTitle}>@{item.username || item.display_name}</Text>
                      <Text style={st.resultSub}>{item.display_name || ''}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={mentionQuery.trim() ? <Text style={st.emptyTxt}>Kullanıcı bulunamadı</Text> : null}
              />
            )}
            <TouchableOpacity style={st.doneBtn} onPress={() => { setActiveModal(null); setMentionQuery(''); setMentionResults([]); }}>
              <Text style={st.doneBtnTxt}>Bitti</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Bağlantı modal ── */}
      <Modal transparent visible={activeModal === 'link'} animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <Pressable style={st.sheetOverlay} onPress={() => setActiveModal(null)}>
          <View style={[st.bottomSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={st.sheetHandle} />
            <Text style={st.sheetTitle}>Bağlantı Ekle</Text>
            <TextInput style={st.searchInput} placeholder="https://" placeholderTextColor="#6B7280" value={linkSticker} onChangeText={setLinkSticker} autoFocus autoCapitalize="none" keyboardType="url" />
            <TouchableOpacity style={st.doneBtn} onPress={() => setActiveModal(null)}>
              <Text style={st.doneBtnTxt}>Ekle</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Anket modal ── */}
      <Modal transparent visible={activeModal === 'poll'} animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <Pressable style={st.sheetOverlay} onPress={() => setActiveModal(null)}>
          <View style={[st.bottomSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={st.sheetHandle} />
            <Text style={st.sheetTitle}>Anket</Text>
            <TextInput style={st.searchInput} placeholder="Sorunuzu yazın..." placeholderTextColor="#6B7280" value={pollQuestion} onChangeText={setPollQuestion} autoFocus />
            {pollOptions.map((opt, i) => (
              <TextInput key={i} style={[st.searchInput, { marginTop: 8 }]} placeholder={`Seçenek ${i + 1}`} placeholderTextColor="#6B7280" value={opt}
                onChangeText={v => { const n = [...pollOptions]; n[i] = v; setPollOptions(n); }} />
            ))}
            {pollOptions.length < 4 && (
              <TouchableOpacity onPress={() => setPollOptions(p => [...p, ''])} style={st.addOptBtn}>
                <Ionicons name="add-circle-outline" size={18} color="#A78BFA" />
                <Text style={st.addOptTxt}>Seçenek ekle</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={st.doneBtn} onPress={() => setActiveModal(null)}>
              <Text style={st.doneBtnTxt}>Tamam</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Geri sayım modal ── */}
      <Modal transparent visible={activeModal === 'countdown'} animationType="slide" onRequestClose={() => setActiveModal(null)}>
        <Pressable style={st.sheetOverlay} onPress={() => setActiveModal(null)}>
          <View style={[st.bottomSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={st.sheetHandle} />
            <Text style={st.sheetTitle}>Geri Sayım</Text>
            <TextInput style={st.searchInput} placeholder="Başlık (opsiyonel)" placeholderTextColor="#6B7280" value={countdownTitle} onChangeText={setCountdownTitle} autoFocus />
            <TextInput style={[st.searchInput, { marginTop: 8 }]} placeholder="Bitiş: YYYY-MM-DDTHH:mm" placeholderTextColor="#6B7280" value={countdownEnd} onChangeText={setCountdownEnd} />
            <TouchableOpacity style={st.doneBtn} onPress={() => { setShowCountdown(!!countdownEnd); setActiveModal(null); }}>
              <Text style={st.doneBtnTxt}>Ekle</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ── Stiller ─────────────────────────────────────────────────────────────── */
const st = StyleSheet.create({
  // CAPTURE
  captureRoot:         { flex: 1, backgroundColor: '#000' },
  captureTopBar:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, zIndex: 10 },
  captureIconBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modeRow:             { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  modeTab:             { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  modeTabActive:       { backgroundColor: 'rgba(255,255,255,0.18)' },
  modeTabText:         { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
  modeTabTextActive:   { color: '#fff' },
  cameraPlaceholder:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textModeCenter:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  textTapHint:         { borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32, borderStyle: 'dashed' },
  textTapHintText:     { color: 'rgba(255,255,255,0.5)', fontSize: 16 },
  bgColorStrip:        { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  bgColorDot:          { width: 30, height: 30, borderRadius: 15 },
  bgColorDotSelected:  { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: '#fff' },
  captureBottomBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 32, paddingTop: 16 },
  galleryBtn:          { alignItems: 'center', gap: 4, width: 60 },
  galleryBtnText:      { color: '#fff', fontSize: 11, fontWeight: '500' },
  captureBtn:          { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  captureBtnInner:     { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
  textNextBtn:         { width: 80, height: 80, borderRadius: 40, backgroundColor: '#A78BFA', alignItems: 'center', justifyContent: 'center' },
  flipBtn:             { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

  // EDIT
  editRoot:            { flex: 1, backgroundColor: '#000' },
  editBg:              { ...StyleSheet.absoluteFillObject },
  editTopBar:          { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12, paddingBottom: 12, zIndex: 10 },
  editIconBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  rightTools:          { gap: 10, alignItems: 'center' },
  editToolBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  textToolIcon:        { color: '#fff', fontSize: 16, fontWeight: '800' },
  editBottom:          { position: 'absolute', bottom: 0, left: 0, right: 0 },
  filterStrip:         { paddingBottom: 12 },
  filterStripContent:  { paddingHorizontal: 12, gap: 10 },
  filterThumb:         { alignItems: 'center', gap: 5 },
  filterThumbSelected: {},
  filterThumbInner:    { width: 56, height: 80, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  filterLabel:         { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  filterLabelSelected: { color: '#fff', fontWeight: '700' },
  shareRow:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  closeFriendsBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(0,0,0,0.4)' },
  closeFriendsBtnActive:{ borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.1)' },
  closeFriendsTxt:     { color: '#fff', fontSize: 13, fontWeight: '600' },
  shareBtn:            { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#A78BFA', borderRadius: 24, paddingVertical: 14 },
  shareBtnText:        { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Overlay sticker'lar
  overlayTextWrap:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  textOverlayBubble:   { backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, maxWidth: SW - 40 },
  textOverlayValue:    { color: '#fff', fontSize: 22, fontWeight: '700' },
  stickerChipTopLeft:  { position: 'absolute', top: 120, left: 16, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  stickerChipTopCenter:{ position: 'absolute', top: 160, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  stickerChipBottom:   { position: 'absolute', bottom: 220, left: 16, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  stickerChipText:     { color: '#fff', fontSize: 13, fontWeight: '600' },
  musicChip:           { position: 'absolute', bottom: 260, left: 16, right: 80, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  musicChipText:       { flex: 1, color: '#fff', fontSize: 13 },
  pollPreview:         { position: 'absolute', bottom: 220, left: 16, right: 16, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  pollPreviewQ:        { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  pollPreviewOpt:      { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, marginBottom: 6 },
  pollPreviewOptText:  { color: '#fff', fontSize: 14 },

  // Metin modalı
  textModal:           { flex: 1 },
  textModalTop:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, zIndex: 10 },
  textAlignBtn:        { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  textDoneBtn:         { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 },
  textDoneBtnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
  fullTextInput:       { flex: 1, color: '#fff', fontSize: 26, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4, paddingHorizontal: 24, paddingVertical: 20 },

  // Sheet / modal ortak
  sheetOverlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  stickerSheet:        { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  bottomSheet:         { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  sheetHandle:         { width: 40, height: 4, borderRadius: 2, backgroundColor: '#374151', alignSelf: 'center', marginBottom: 16 },
  sheetTitle:          { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 16 },
  stickerGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stickerGridItem:     { width: (SW - 40 - 48) / 3, alignItems: 'center', gap: 8 },
  stickerGridIcon:     { width: 60, height: 60, borderRadius: 18, backgroundColor: 'rgba(167,139,250,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' },
  stickerGridLabel:    { color: '#9CA3AF', fontSize: 12, textAlign: 'center' },
  searchInput:         { backgroundColor: '#374151', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: '#fff', marginBottom: 4 },
  resultRow:           { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#374151' },
  resultTitle:         { color: '#fff', fontSize: 15, fontWeight: '500' },
  resultSub:           { color: '#9CA3AF', fontSize: 13 },
  mentionAvatar:       { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(167,139,250,0.15)', alignItems: 'center', justifyContent: 'center' },
  emptyTxt:            { color: '#6B7280', textAlign: 'center', paddingVertical: 24, fontSize: 14 },
  doneBtn:             { backgroundColor: '#A78BFA', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  doneBtnTxt:          { color: '#fff', fontSize: 16, fontWeight: '700' },
  addOptBtn:           { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  addOptTxt:           { color: '#A78BFA', fontSize: 14 },
});
