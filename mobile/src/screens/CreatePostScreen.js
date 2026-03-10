import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAuth } from '../contexts/AuthContext';
import { useCreatePostMutation } from '../hooks/useFeedQuery';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

export default function CreatePostScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const createMutation = useCreatePostMutation(token);

  const [content, setContent] = useState('');
  const [mediaUris, setMediaUris] = useState([]);
  const [location, setLocation] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [visibility, setVisibility] = useState('public');
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [showMusicSearch, setShowMusicSearch] = useState(false);
  const [musicQuery, setMusicQuery] = useState('');
  const [musicResults, setMusicResults] = useState([]);

  const searchMusic = useCallback(async (q) => {
    if (!q?.trim()) { setMusicResults([]); return; }
    try {
      const res = await api.get(`/music/search/${encodeURIComponent(q.trim())}`, token);
      const items = res?.results || res?.songs || (Array.isArray(res) ? res : []);
      setMusicResults(items);
    } catch {
      setMusicResults([]);
    }
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => searchMusic(musicQuery), 400);
    return () => clearTimeout(t);
  }, [musicQuery, searchMusic]);

  const pickImage = async (fromCamera = false) => {
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
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, allowsMultipleSelection: false, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, allowsMultipleSelection: true, quality: 0.8 });
      if (!result.canceled) {
        const newUris = result.assets.map((a) => a.uri);
        setMediaUris((prev) => [...prev, ...newUris].slice(0, 10));
      }
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('common.selectMediaFailed'));
    }
  };

  const removeMedia = (index) => setMediaUris((prev) => prev.filter((_, i) => i !== index));

  const addLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.permissionRequired'), t('common.locationPermission'));
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      const [rev] = await Location.reverseGeocodeAsync(loc.coords);
      setLocationName(rev ? `${rev.city || ''} ${rev.street || ''}`.trim() || t('createPost.locationAdded') : t('createPost.locationAdded'));
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('common.locationError'));
    }
  };

  const uploadMedias = async () => {
    const urls = [];
    for (const uri of mediaUris) {
      const mime = uri?.includes('.mp4') || uri?.includes('.mov') ? 'video/mp4' : 'image/jpeg';
      const res = await api.uploadFile(uri, token, 'post', mime);
      urls.push(res);
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!content.trim() && mediaUris.length === 0 && !selectedTrack && !(showPoll && pollQuestion && pollOptions.filter((o) => o.trim()).length >= 2)) {
      Alert.alert(t('common.warning'), t('createPost.addTextOrMedia'));
      return;
    }
    setUploading(true);
    try {
      let mediaUrls = [];
      if (mediaUris.length > 0) {
        mediaUrls = await uploadMedias();
      }
      const postData = {
        content: content.trim() || ' ',
        post_type: mediaUrls.length > 0 ? 'photo' : showPoll ? 'poll' : 'text',
        media_urls: mediaUrls,
        visibility,
        allow_comments: true,
        ...(location && { location: JSON.stringify(location) }),
        ...(locationName && { location_name: locationName }),
        ...(showPoll && pollQuestion && {
          poll: {
            question: pollQuestion,
            options: pollOptions.filter((o) => o.trim()),
          },
        }),
        ...(selectedTrack && { track_id: selectedTrack.id, track_title: selectedTrack.title, track_artist: selectedTrack.artist }),
      };
      await createMutation.mutateAsync(postData);
      Alert.alert(t('common.success'), t('createPost.success'), [{ text: t('common.ok'), onPress: () => navigation.goBack() }]);
    } catch (err) {
      Alert.alert(t('common.error'), err.message || err.data?.detail || t('createPost.failed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('createPost.cancel')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('createPost.title')}</Text>
        <TouchableOpacity
          style={[styles.postBtn, (createMutation.isPending || uploading) && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={createMutation.isPending || uploading}
        >
          {createMutation.isPending || uploading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.postBtnText}>{t('createPost.share')}</Text>}
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <TextInput
          style={styles.input}
          placeholder={t('createPost.placeholder')}
          placeholderTextColor="#6B7280"
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={4}
        />
        <View style={styles.mediaRow}>
          <TouchableOpacity style={styles.mediaBtn} onPress={() => pickImage(false)}>
            <Ionicons name="images-outline" size={24} color="#8B5CF6" />
            <Text style={styles.mediaBtnText}>{t('createPost.gallery')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaBtn} onPress={() => pickImage(true)}>
            <Ionicons name="camera-outline" size={24} color="#8B5CF6" />
            <Text style={styles.mediaBtnText}>{t('createPost.camera')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaBtn} onPress={addLocation}>
            <Ionicons name="location-outline" size={24} color={location ? '#8B5CF6' : '#6B7280'} />
            <Text style={styles.mediaBtnText}>{location ? `${t('createPost.location')} ✓` : t('createPost.location')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaBtn} onPress={() => setShowPoll(!showPoll)}>
            <Ionicons name="bar-chart-outline" size={24} color={showPoll ? '#8B5CF6' : '#6B7280'} />
            <Text style={styles.mediaBtnText}>{t('createPost.poll')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaBtn} onPress={() => setShowMusicSearch(true)}>
            <Ionicons name="musical-notes-outline" size={24} color={selectedTrack ? '#8B5CF6' : '#6B7280'} />
            <Text style={styles.mediaBtnText}>{t('createPost.music')}</Text>
          </TouchableOpacity>
        </View>
        {selectedTrack && (
          <View style={styles.selectedTrack}>
            <Ionicons name="musical-notes" size={20} color="#8B5CF6" />
            <Text style={styles.trackName} numberOfLines={1}>{selectedTrack.title} - {selectedTrack.artist}</Text>
            <TouchableOpacity onPress={() => setSelectedTrack(null)}>
              <Ionicons name="close-circle" size={22} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
        {showPoll && (
          <View style={styles.pollContainer}>
            <TextInput
              style={styles.pollQuestionInput}
              placeholder={t('createPost.pollQuestion')}
              placeholderTextColor="#6B7280"
              value={pollQuestion}
              onChangeText={setPollQuestion}
            />
            {pollOptions.map((opt, i) => (
              <View key={i} style={styles.pollOptionRow}>
                <TextInput
                  style={styles.pollOptionInput}
                  placeholder={t('createPost.pollOption', { number: i + 1 })}
                  placeholderTextColor="#6B7280"
                  value={opt}
                  onChangeText={(text) => {
                    const newOpts = [...pollOptions];
                    newOpts[i] = text;
                    setPollOptions(newOpts);
                  }}
                />
                {pollOptions.length > 2 && (
                  <TouchableOpacity onPress={() => setPollOptions((prev) => prev.filter((_, idx) => idx !== i))}>
                    <Ionicons name="close-circle" size={22} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {pollOptions.length < 6 && (
              <TouchableOpacity style={styles.addOptionBtn} onPress={() => setPollOptions((prev) => [...prev, ''])}>
                <Ionicons name="add-circle-outline" size={20} color="#8B5CF6" />
                <Text style={styles.addOptionText}>{t('createPost.addOption')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        <View style={styles.visibilityRow}>
          <Text style={styles.visibilityLabel}>{t('createPost.visibility')}</Text>
          <View style={styles.visibilityOptions}>
            {[
              { key: 'public', icon: 'globe-outline', label: t('createPost.public') },
              { key: 'friends', icon: 'people-outline', label: t('createPost.friends') },
              { key: 'private', icon: 'lock-closed-outline', label: t('createPost.private') },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.visibilityBtn, visibility === opt.key && styles.visibilityBtnActive]}
                onPress={() => setVisibility(opt.key)}
              >
                <Ionicons name={opt.icon} size={18} color={visibility === opt.key ? '#8B5CF6' : '#9CA3AF'} />
                <Text style={[styles.visibilityText, visibility === opt.key && styles.visibilityTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        {locationName ? <Text style={styles.locationLabel}>📍 {locationName}</Text> : null}
        {mediaUris.length > 0 && (
          <View style={styles.mediaPreview}>
            {mediaUris.map((uri, i) => (
              <View key={i} style={styles.mediaThumb}>
                <Image source={{ uri }} style={styles.thumbImg} />
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeMedia(i)}>
                  <Ionicons name="close-circle" size={28} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {showMusicSearch && (
        <Modal transparent visible animationType="slide">
          <View style={styles.musicModal}>
            <TouchableOpacity style={styles.musicModalBackdrop} onPress={() => setShowMusicSearch(false)} />
            <View style={[styles.musicPanel, { paddingBottom: insets.bottom + 24 }]}>
              <Text style={styles.musicModalTitle}>{t('createPost.music')}</Text>
              <TextInput
                style={styles.musicSearchInput}
                placeholder={t('search.searchPlaceholder')}
                placeholderTextColor="#6B7280"
                value={musicQuery}
                onChangeText={setMusicQuery}
                autoFocus
              />
              <FlatList
                data={musicResults}
                keyExtractor={(item, i) => item.id || item.video_id || item.youtube_id || String(i)}
                renderItem={({ item }) => {
                  const track = {
                    id: item.id || item.video_id || item.youtube_id,
                    title: item.title || item.name || '',
                    artist: item.artist || item.uploader || item.channel || '',
                  };
                  return (
                    <TouchableOpacity
                      style={styles.musicResult}
                      onPress={() => {
                        setSelectedTrack(track);
                        setShowMusicSearch(false);
                        setMusicQuery('');
                        setMusicResults([]);
                      }}
                    >
                      <Ionicons name="musical-notes" size={24} color="#8B5CF6" />
                      <View style={styles.musicResultInfo}>
                        <Text style={styles.musicResultTitle} numberOfLines={1}>{track.title || t('common.unnamed')}</Text>
                        <Text style={styles.musicResultArtist} numberOfLines={1}>{track.artist}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                style={{ maxHeight: 300 }}
                ListEmptyComponent={musicQuery.trim() ? <Text style={styles.musicEmpty}>{t('common.noResults')}</Text> : null}
              />
              <TouchableOpacity style={styles.musicPickerClose} onPress={() => { setShowMusicSearch(false); setMusicQuery(''); setMusicResults([]); }}>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  backBtn: {},
  backText: { color: colors.accent, fontSize: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  postBtn: { backgroundColor: '#8B5CF6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  postBtnText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  btnDisabled: { opacity: 0.7 },
  scroll: { flex: 1 },
  content: { padding: 20 },
  input: { backgroundColor: '#1F2937', borderRadius: 12, padding: 16, fontSize: 16, color: colors.text, minHeight: 120, textAlignVertical: 'top', marginBottom: 16 },
  mediaRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  mediaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#1F2937', borderRadius: 12 },
  mediaBtnText: { color: '#9CA3AF', fontSize: 14 },
  locationLabel: { color: '#9CA3AF', fontSize: 14, marginBottom: 12 },
  mediaPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mediaThumb: { width: 100, height: 100, borderRadius: 8, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  removeBtn: { position: 'absolute', top: 4, right: 4 },
  pollContainer: { backgroundColor: '#1F2937', borderRadius: 12, padding: 16, marginBottom: 16 },
  pollQuestionInput: { backgroundColor: '#374151', borderRadius: 10, padding: 12, fontSize: 15, color: colors.text, marginBottom: 12 },
  pollOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  pollOptionInput: { flex: 1, backgroundColor: '#374151', borderRadius: 10, padding: 12, fontSize: 14, color: colors.text },
  addOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  addOptionText: { color: colors.accent, fontSize: 14 },
  visibilityRow: { marginBottom: 16 },
  visibilityLabel: { color: '#9CA3AF', fontSize: 14, marginBottom: 8 },
  visibilityOptions: { flexDirection: 'row', gap: 8 },
  visibilityBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#1F2937', borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  visibilityBtnActive: { borderColor: '#8B5CF6', backgroundColor: '#1E1B4B' },
  visibilityText: { color: '#9CA3AF', fontSize: 13 },
  visibilityTextActive: { color: colors.accent },
  selectedTrack: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1E1B4B', padding: 12, borderRadius: 10, marginBottom: 12 },
  trackName: { flex: 1, color: colors.text, fontSize: 14 },
  musicModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  musicModalBackdrop: { flex: 1 },
  musicPanel: { backgroundColor: '#1F2937', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  musicModalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },
  musicSearchInput: { backgroundColor: '#374151', borderRadius: 12, padding: 14, fontSize: 15, color: colors.text, marginBottom: 16 },
  musicResult: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#374151' },
  musicResultInfo: { flex: 1 },
  musicResultTitle: { color: colors.text, fontSize: 15 },
  musicResultArtist: { color: '#9CA3AF', fontSize: 13 },
  musicEmpty: { color: '#9CA3AF', textAlign: 'center', paddingVertical: 24 },
  musicPickerClose: { backgroundColor: '#8B5CF6', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  musicPickerCloseText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
