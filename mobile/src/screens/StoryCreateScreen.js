/**
 * StoryCreateScreen - Hikaye oluşturma
 * Fotoğraf/video, galeri, yazı, anket, sticker (ücretsiz açık kaynak)
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, TextInput, Alert, ActivityIndicator,
  Modal, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import StoryCamera from '../components/story/StoryCamera';
import { useTheme } from '../contexts/ThemeContext';

const FILTERS = ['normal', 'vintage', 'sepia', 'noir', 'warm', 'cool', 'dramatic', 'fade', 'chrome', 'prozac', 'transfer', 'tone'];
const BG_COLORS = ['#8B5CF6', '#EC4899', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];

export default function StoryCreateScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [mediaUri, setMediaUri] = useState(null);
  const [text, setText] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('normal');
  const [backgroundColor, setBackgroundColor] = useState('#8B5CF6');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [storyType, setStoryType] = useState('photo');
  const [uploading, setUploading] = useState(false);
  const [closeFriendsOnly, setCloseFriendsOnly] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [musicSearch, setMusicSearch] = useState('');
  const [musicResults, setMusicResults] = useState([]);
  const [musicLoading, setMusicLoading] = useState(false);
  const [locationSticker, setLocationSticker] = useState(null);
  const [mentionSticker, setMentionSticker] = useState(null);
  const [showMentionSearch, setShowMentionSearch] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [linkSticker, setLinkSticker] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [countdownTitle, setCountdownTitle] = useState('');
  const [countdownEnd, setCountdownEnd] = useState('');
  const [showCountdown, setShowCountdown] = useState(false);

  const searchMusic = useCallback(async (q) => {
    if (!q?.trim()) { setMusicResults([]); return; }
    setMusicLoading(true);
    try {
      const res = await api.get(`/music/search/${encodeURIComponent(q.trim())}`, token);
      const items = res?.results || res?.songs || (Array.isArray(res) ? res : []);
      setMusicResults(items);
    } catch {
      setMusicResults([]);
    } finally {
      setMusicLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => searchMusic(musicSearch), 400);
    return () => clearTimeout(t);
  }, [musicSearch, searchMusic]);

  const searchMentions = useCallback(async (q) => {
    if (!q?.trim() || !token) { setMentionResults([]); return; }
    setMentionLoading(true);
    try {
      const params = new URLSearchParams({ q: q.trim(), limit: 15 });
      const res = await api.get(`/search?${params}`, token);
      setMentionResults(res?.users || []);
    } catch {
      setMentionResults([]);
    } finally {
      setMentionLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => searchMentions(mentionQuery), 400);
    return () => clearTimeout(t);
  }, [mentionQuery, searchMentions]);

  const pickMedia = async (fromCamera = false) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted' && !fromCamera) {
      Alert.alert(t('common.permissionRequired'), t('common.galleryPermission'));
      return;
    }
    if (fromCamera) {
      const camStatus = await ImagePicker.requestCameraPermissionsAsync();
      if (camStatus !== 'granted') {
        Alert.alert(t('common.permissionRequired'), t('common.cameraPermission'));
        return;
      }
    }
    try {
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, allowsEditing: true, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, allowsEditing: true, quality: 0.8 });
      if (!result.canceled) {
        setMediaUri(result.assets[0].uri);
        setStoryType(result.assets[0].type?.startsWith('video') ? 'video' : 'photo');
      }
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('stories.selectMediaFailed'));
    }
  };

  const addPollOption = () => setPollOptions((p) => [...p, '']);
  const setPollOpt = (i, v) => setPollOptions((p) => { const n = [...p]; n[i] = v; return n; });

  const handleSubmit = async () => {
    if (storyType === 'poll') {
      if (!pollQuestion.trim()) {
        Alert.alert(t('common.warning'), t('stories.enterPollQuestion'));
        return;
      }
      const opts = pollOptions.filter(Boolean);
      if (opts.length < 2) {
        Alert.alert(t('common.warning'), t('stories.minPollOptions'));
        return;
      }
    } else if (!mediaUri && !text.trim()) {
      Alert.alert(t('common.warning'), t('stories.addMediaOrText'));
      return;
    }

    setUploading(true);
    try {
      let mediaUrl = null;
      if (mediaUri) {
        const isVideo = mediaUri?.includes('.mp4') || mediaUri?.includes('.mov');
        mediaUrl = await api.uploadFile(mediaUri, token, 'story', isVideo ? 'video/mp4' : 'image/jpeg');
      }

      const payload = {
        story_type: storyType,
        text: text.trim() || null,
        media_url: mediaUrl,
        media_type: storyType === 'video' ? 'video' : 'photo',
        background_color: backgroundColor,
        filter: selectedFilter,
        duration: storyType === 'video' ? 60 : 30,
        audience: closeFriendsOnly ? 'close_friends' : 'all',
        ...(storyType === 'poll' && {
          poll_question: pollQuestion.trim(),
          poll_options: pollOptions.filter(Boolean),
        }),
        ...(selectedMusic && {
          music_track_id: selectedMusic.id || selectedMusic.video_id || selectedMusic.song_id || selectedMusic.youtube_id,
          music_start_time: 0,
        }),
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>{t('stories.cancel')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('stories.createStory')}</Text>
        <TouchableOpacity
          style={[styles.postBtn, uploading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={uploading}
        >
          {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.postBtnText}>{t('stories.share')}</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.mediaSection}>
          <TouchableOpacity style={styles.mediaBtn} onPress={() => pickMedia(false)}>
            <Ionicons name="images-outline" size={28} color="#8B5CF6" />
            <Text style={styles.mediaBtnText}>{t('stories.gallery')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaBtn} onPress={() => setShowCamera(true)}>
            <Ionicons name="camera-outline" size={28} color="#8B5CF6" />
            <Text style={styles.mediaBtnText}>{t('stories.camera')}</Text>
          </TouchableOpacity>
        </View>

        {(mediaUri || locationSticker || mentionSticker || linkSticker) && (
          <View style={styles.preview}>
            {mediaUri ? (
              <Image source={{ uri: mediaUri }} style={styles.previewImg} resizeMode="cover" />
            ) : (
              <View style={[styles.previewPlaceholder, { backgroundColor }]} />
            )}
            {selectedMusic && (
              <View style={styles.musicOverlay}>
                <Ionicons name="musical-notes" size={20} color="#fff" />
                <Text style={styles.musicOverlayText} numberOfLines={1}>
                  {selectedMusic.title || selectedMusic.name || ''} — {selectedMusic.artist || selectedMusic.uploader || selectedMusic.channel || ''}
                </Text>
              </View>
            )}
            {locationSticker && (
              <View style={[styles.stickerOverlay, styles.stickerOverlayTopLeft]}>
                <Ionicons name="location" size={16} color="#fff" />
                <Text style={styles.stickerOverlayText}>{locationSticker}</Text>
              </View>
            )}
            {mentionSticker && (
              <View style={[styles.stickerOverlay, styles.stickerOverlayTopRight]}>
                <Text style={styles.stickerOverlayText}>@{mentionSticker}</Text>
              </View>
            )}
            {linkSticker && (
              <View style={[styles.stickerOverlay, styles.stickerOverlayBottomRight]}>
                <Ionicons name="link" size={16} color="#fff" />
                <Text style={styles.stickerOverlayText} numberOfLines={1}>{linkSticker}</Text>
              </View>
            )}
          </View>
        )}

        <Text style={styles.label}>{t('stories.addText')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('stories.textPlaceholder')}
          placeholderTextColor="#6B7280"
          value={text}
          onChangeText={setText}
          multiline
        />

        <Text style={styles.label}>{t('stories.backgroundColor')}</Text>
        <View style={styles.colorRow}>
          {BG_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.colorBtn, { backgroundColor: c }, backgroundColor === c && styles.colorBtnSelected]}
              onPress={() => setBackgroundColor(c)}
            />
          ))}
        </View>

        <Text style={styles.label}>{t('stories.filter')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, selectedFilter === f && styles.filterChipSelected]}
              onPress={() => setSelectedFilter(f)}
            >
              <Text style={styles.filterText}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity style={styles.typeBtn} onPress={() => setShowMusicPicker(true)}>
          <Ionicons name="musical-notes-outline" size={24} color={selectedMusic ? '#8B5CF6' : '#fff'} />
          <Text style={styles.typeBtnText}>{t('stories.music')}{selectedMusic ? ` — ${(selectedMusic.title || selectedMusic.name || '').slice(0, 22)}` : ''}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.typeBtn} onPress={() => setCloseFriendsOnly(!closeFriendsOnly)}>
          <Ionicons name={closeFriendsOnly ? 'people' : 'people-outline'} size={24} color="#8B5CF6" />
          <Text style={styles.typeBtnText}>
            {closeFriendsOnly ? t('stories.closeFriendsOnlyOn') : t('stories.closeFriendsOnly')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.typeBtn} onPress={() => setStoryType(storyType === 'poll' ? 'photo' : 'poll')}>
          <Ionicons name="bar-chart-outline" size={24} color="#8B5CF6" />
          <Text style={styles.typeBtnText}>{storyType === 'poll' ? t('stories.removePoll') : t('stories.addPoll')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.typeBtn} onPress={() => setShowCountdown(!showCountdown)}>
          <Ionicons name="time-outline" size={24} color={showCountdown ? '#8B5CF6' : '#fff'} />
          <Text style={styles.typeBtnText}>{showCountdown ? t('stories.countdownOn') || 'Geri sayım' : t('stories.countdown') || 'Geri sayım ekle'}</Text>
        </TouchableOpacity>
        {showCountdown && (
          <>
            <TextInput style={styles.input} placeholder="Başlık" placeholderTextColor="#6B7280" value={countdownTitle} onChangeText={setCountdownTitle} />
            <TextInput style={styles.input} placeholder="Bitiş (YYYY-MM-DDTHH:mm)" placeholderTextColor="#6B7280" value={countdownEnd} onChangeText={setCountdownEnd} />
          </>
        )}

        <Text style={styles.label}>{t('stories.stickers')}</Text>
        <View style={styles.stickerToolbar}>
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={async () => {
              try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert(t('common.permissionRequired'), t('common.locationPermission'));
                  return;
                }
                const loc = await Location.getCurrentPositionAsync({});
                const [rev] = await Location.reverseGeocodeAsync(loc.coords);
                setLocationSticker(rev ? `${rev.city || ''}, ${rev.country || ''}`.trim() || 'Location' : 'Location');
              } catch {
                setLocationSticker('Location');
              }
            }}
          >
            <Ionicons name="location-outline" size={24} color={locationSticker ? '#8B5CF6' : '#fff'} />
            <Text style={styles.toolLabel}>{t('createPost.location')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={() => setShowMentionSearch(true)}>
            <Ionicons name="at-outline" size={24} color={mentionSticker ? '#8B5CF6' : '#fff'} />
            <Text style={styles.toolLabel}>{t('stories.mention')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={() => setShowLinkInput(true)}>
            <Ionicons name="link-outline" size={24} color={linkSticker ? '#8B5CF6' : '#fff'} />
            <Text style={styles.toolLabel}>{t('stories.link')}</Text>
          </TouchableOpacity>
        </View>
        {(locationSticker || mentionSticker || linkSticker) && (
          <View style={styles.stickerClearRow}>
            {locationSticker && (
              <TouchableOpacity onPress={() => setLocationSticker(null)} style={styles.stickerClear}>
                <Text style={styles.stickerClearText}>📍 {locationSticker}</Text>
                <Ionicons name="close-circle" size={18} color="#EF4444" />
              </TouchableOpacity>
            )}
            {mentionSticker && (
              <TouchableOpacity onPress={() => setMentionSticker(null)} style={styles.stickerClear}>
                <Text style={styles.stickerClearText}>@{mentionSticker}</Text>
                <Ionicons name="close-circle" size={18} color="#EF4444" />
              </TouchableOpacity>
            )}
            {linkSticker && (
              <TouchableOpacity onPress={() => { setLinkSticker(''); setShowLinkInput(false); }} style={styles.stickerClear}>
                <Text style={styles.stickerClearText} numberOfLines={1}>🔗 {linkSticker}</Text>
                <Ionicons name="close-circle" size={18} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {storyType === 'poll' && (
          <>
            <TextInput
              style={styles.input}
              placeholder={t('stories.pollQuestion')}
              placeholderTextColor="#6B7280"
              value={pollQuestion}
              onChangeText={setPollQuestion}
            />
            {pollOptions.map((opt, i) => (
              <TextInput
                key={i}
                style={styles.input}
                placeholder={t('stories.optionPlaceholder', { number: i + 1 })}
                placeholderTextColor="#6B7280"
                value={opt}
                onChangeText={(v) => setPollOpt(i, v)}
              />
            ))}
            <TouchableOpacity onPress={addPollOption} style={styles.addOptBtn}>
              <Text style={styles.addOptText}>{t('stories.addOption')}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {showMusicPicker && (
        <Modal transparent visible animationType="slide">
          <View style={styles.musicPickerOverlay}>
            <View style={[styles.musicPickerPanel, { paddingBottom: insets.bottom + 24 }]}>
              <Text style={styles.musicPickerTitle}>{t('stories.addMusic')}</Text>
              <TextInput
                style={styles.musicSearchInput}
                placeholder={t('search.searchPlaceholder')}
                placeholderTextColor="#6B7280"
                value={musicSearch}
                onChangeText={setMusicSearch}
                autoFocus
              />
              {musicLoading ? (
                <ActivityIndicator size="small" color="#8B5CF6" style={{ marginVertical: 16 }} />
              ) : (
                <FlatList
                  data={musicResults}
                  keyExtractor={(item, i) => item.video_id || item.id || String(i)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.musicResultRow}
                      onPress={() => {
                        setSelectedMusic(item);
                        setShowMusicPicker(false);
                        setMusicSearch('');
                        setMusicResults([]);
                      }}
                    >
                      <Ionicons name="musical-notes" size={24} color="#8B5CF6" />
                      <View style={styles.musicResultInfo}>
                        <Text style={styles.musicResultTitle} numberOfLines={1}>{item.title || item.name || ''}</Text>
                        <Text style={styles.musicResultArtist} numberOfLines={1}>{item.artist || item.uploader || item.channel || ''}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  style={styles.musicResultsList}
                  ListEmptyComponent={musicSearch.trim() ? <Text style={styles.musicEmpty}>{t('common.noResults')}</Text> : null}
                />
              )}
              <TouchableOpacity style={styles.musicPickerClose} onPress={() => { setShowMusicPicker(false); setMusicSearch(''); setMusicResults([]); }}>
                <Text style={styles.musicPickerCloseText}>{t('common.done')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {showMentionSearch && (
        <Modal transparent visible animationType="slide">
          <View style={styles.musicPickerOverlay}>
            <View style={[styles.musicPickerPanel, { paddingBottom: insets.bottom + 24 }]}>
              <Text style={styles.musicPickerTitle}>{t('stories.mention')}</Text>
              <TextInput
                style={styles.musicSearchInput}
                placeholder={t('search.searchPlaceholder')}
                placeholderTextColor="#6B7280"
                value={mentionQuery}
                onChangeText={setMentionQuery}
                autoFocus
              />
              {mentionLoading ? (
                <ActivityIndicator size="small" color="#8B5CF6" style={{ marginVertical: 16 }} />
              ) : (
                <FlatList
                  data={mentionResults}
                  keyExtractor={(item) => item.id || item.username || String(Math.random())}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.musicResultRow}
                      onPress={() => {
                        setMentionSticker(item.username || item.display_name || '');
                        setShowMentionSearch(false);
                        setMentionQuery('');
                        setMentionResults([]);
                      }}
                    >
                      <View style={styles.musicResultInfo}>
                        <Text style={styles.musicResultTitle}>@{item.username || item.display_name || ''}</Text>
                        <Text style={styles.musicResultArtist} numberOfLines={1}>{item.display_name || item.username || ''}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  style={styles.musicResultsList}
                  ListEmptyComponent={mentionQuery.trim() ? <Text style={styles.musicEmpty}>{t('common.noResults')}</Text> : null}
                />
              )}
              <TouchableOpacity style={styles.musicPickerClose} onPress={() => { setShowMentionSearch(false); setMentionQuery(''); setMentionResults([]); }}>
                <Text style={styles.musicPickerCloseText}>{t('common.done')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {showCamera && (
        <Modal visible animationType="slide" onRequestClose={() => setShowCamera(false)}>
          <StoryCamera
            visible={showCamera}
            onCapture={(uri) => {
              setMediaUri(uri);
              setStoryType(uri?.includes('.mp4') || uri?.includes('.mov') ? 'video' : 'photo');
              setShowCamera(false);
            }}
            onClose={() => setShowCamera(false)}
          />
        </Modal>
      )}

      {showLinkInput && (
        <Modal transparent visible animationType="slide">
          <View style={styles.musicPickerOverlay}>
            <View style={[styles.musicPickerPanel, { paddingBottom: insets.bottom + 24 }]}>
              <Text style={styles.musicPickerTitle}>{t('stories.link')}</Text>
              <TextInput
                style={styles.musicSearchInput}
                placeholder="https://"
                placeholderTextColor="#6B7280"
                value={linkSticker}
                onChangeText={setLinkSticker}
                autoFocus
                autoCapitalize="none"
                keyboardType="url"
              />
              <TouchableOpacity
                style={styles.musicPickerClose}
                onPress={() => {
                  if (linkSticker.trim()) setShowLinkInput(false);
                  else setShowLinkInput(false);
                }}
              >
                <Text style={styles.musicPickerCloseText}>{t('common.done')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  cancelText: { color: colors.accent, fontSize: 16 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  postBtn: { backgroundColor: '#8B5CF6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  postBtnText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  btnDisabled: { opacity: 0.7 },
  scroll: { flex: 1 },
  content: { padding: 20 },
  mediaSection: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  mediaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, backgroundColor: '#1F2937', borderRadius: 12 },
  mediaBtnText: { color: '#9CA3AF', fontSize: 14 },
  preview: { width: '100%', height: 240, borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
  previewImg: { width: '100%', height: '100%' },
  label: { fontSize: 14, color: '#9CA3AF', marginBottom: 8 },
  input: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    marginBottom: 16,
  },
  colorRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  colorBtn: { width: 40, height: 40, borderRadius: 20 },
  colorBtnSelected: { borderWidth: 3, borderColor: '#fff' },
  filterRow: { marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1F2937',
    borderRadius: 20,
    marginRight: 8,
  },
  filterChipSelected: { backgroundColor: '#8B5CF6' },
  filterText: { color: colors.text, fontSize: 14 },
  typeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, backgroundColor: '#1F2937', borderRadius: 12, marginBottom: 16 },
  typeBtnText: { color: colors.accent, fontSize: 14 },
  addOptBtn: { padding: 12 },
  addOptText: { color: colors.accent, fontSize: 14 },
  musicOverlay: { position: 'absolute', bottom: 16, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  musicOverlayText: { color: colors.text, fontSize: 13, flex: 1 },
  musicPickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  musicPickerPanel: { backgroundColor: '#1F2937', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  musicPickerTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },
  musicSearchInput: { backgroundColor: '#374151', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text, marginBottom: 16 },
  musicResultsList: { maxHeight: 240, marginBottom: 16 },
  musicResultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, gap: 12, borderBottomWidth: 1, borderBottomColor: '#374151' },
  musicResultInfo: { flex: 1, minWidth: 0 },
  musicResultTitle: { fontSize: 15, color: colors.text, fontWeight: '500' },
  musicResultArtist: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  musicEmpty: { color: '#9CA3AF', textAlign: 'center', paddingVertical: 24 },
  musicPickerClose: { backgroundColor: '#8B5CF6', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  musicPickerCloseText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  stickerToolbar: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 12, backgroundColor: '#1F2937', borderRadius: 12 },
  toolLabel: { color: '#9CA3AF', fontSize: 13 },
  stickerClearRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  stickerClear: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1E1B4B', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  stickerClearText: { color: colors.text, fontSize: 13 },
  stickerOverlay: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  stickerOverlayTopLeft: { top: 12, left: 12 },
  stickerOverlayTopRight: { top: 12, right: 12 },
  stickerOverlayBottomRight: { bottom: 16, right: 16 },
  stickerOverlayText: { color: colors.text, fontSize: 13 },
  previewPlaceholder: { width: '100%', height: '100%' },
});
