import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  Image, ScrollView, FlatList, Alert, Modal, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import LocationPicker from '../components/LocationPicker';

const { width: SW } = Dimensions.get('window');
const MAX_CHARS = 2200;
const MAX_IMAGES = 10;
const MAX_VIDEO_DURATION = 60;

export default function CreatePostScreen({ navigation, route }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [musicTrack, setMusicTrack] = useState(route?.params?.musicTrack || null);
  const [showMentions, setShowMentions] = useState(false);
  const [showHashtags, setShowHashtags] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [hashtagQuery, setHashtagQuery] = useState('');
  const [mentionResults, setMentionResults] = useState([]);
  const [hashtagResults, setHashtagResults] = useState([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationInput, setLocationInput] = useState('');
  const [showMusicSearch, setShowMusicSearch] = useState(false);
  const [musicSearchQuery, setMusicSearchQuery] = useState('');
  const [musicResults, setMusicResults] = useState([]);
  const [musicSearching, setMusicSearching] = useState(false);
  const inputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const handleContentChange = useCallback((text) => {
    if (text.length > MAX_CHARS) return;
    setContent(text);

    const cursorPos = text.length;
    const beforeCursor = text.substring(0, cursorPos);

    const mentionMatch = beforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowMentions(true);
      setShowHashtags(false);
      if (mentionMatch[1].length >= 1) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(async () => {
          try {
            const res = await api.get(`/social/search/mentions?q=${encodeURIComponent(mentionMatch[1])}&limit=8`, token);
            setMentionResults(res.users || res.hits || []);
          } catch { setMentionResults([]); }
        }, 300);
      }
      return;
    }

    const hashMatch = beforeCursor.match(/#(\w*)$/);
    if (hashMatch) {
      setHashtagQuery(hashMatch[1]);
      setShowHashtags(true);
      setShowMentions(false);
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await api.get(`/social/hashtags/suggestions?q=${hashMatch[1]}&limit=10`, token);
          setHashtagResults(res.hashtags || []);
        } catch { setHashtagResults([]); }
      }, 300);
      return;
    }

    setShowMentions(false);
    setShowHashtags(false);
  }, [token]);

  const insertMention = (username) => {
    const before = content.replace(/@\w*$/, '');
    setContent(`${before}@${username} `);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const insertHashtag = (tag) => {
    const before = content.replace(/#\w*$/, '');
    setContent(`${before}#${tag} `);
    setShowHashtags(false);
    inputRef.current?.focus();
  };

  const pickMedia = async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert(t('common.error'), t('common.error')); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - media.length,
        quality: 0.8,
        videoMaxDuration: MAX_VIDEO_DURATION,
      });
      if (!result.canceled && result.assets) {
        const validAssets = [];
        for (const asset of result.assets) {
          if (asset.type === 'video' && asset.duration && asset.duration > MAX_VIDEO_DURATION * 1000) {
            Alert.alert(t('common.error'), `Max ${MAX_VIDEO_DURATION}s`);
            continue;
          }
          validAssets.push(asset);
        }
        setMedia(prev => [...prev, ...validAssets.slice(0, MAX_IMAGES - prev.length)]);
      }
    } catch {}
  };

  const takePhoto = () => {
    let VisionCamera = null;
    try { VisionCamera = require('react-native-vision-camera'); } catch {}
    if (VisionCamera) {
      navigation.navigate('CameraCapture', {
        onCapture: (assets) => {
          const mapped = assets.map((a) => ({
            uri: a.uri,
            type: a.type || 'image',
            duration: a.duration,
          }));
          setMedia((prev) => [...prev, ...mapped]);
        },
        maxVideoDuration: MAX_VIDEO_DURATION,
      });
    } else {
      (async () => {
        try {
          const ImagePicker = require('expo-image-picker');
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert(t('common.error'), t('common.error')); return; }
          const result = await ImagePicker.launchCameraAsync({
            quality: 0.8,
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            videoMaxDuration: MAX_VIDEO_DURATION,
          });
          if (!result.canceled && result.assets) setMedia((prev) => [...prev, ...result.assets]);
        } catch {}
      })();
    }
  };

  const removeMedia = (index) => setMedia(prev => prev.filter((_, i) => i !== index));

  const editImage = (index) => {
    const item = media[index];
    if (item.type === 'video') return;
    navigation.navigate('ImageEditor', {
      imageUri: item.uri,
      onSave: (editedUri) => {
        setMedia(prev => prev.map((m, i) => i === index ? { ...m, uri: editedUri } : m));
      },
    });
  };

  const searchMusic = async () => {
    if (!musicSearchQuery.trim()) return;
    setMusicSearching(true);
    try {
      const res = await api.get(`/music/search?q=${encodeURIComponent(musicSearchQuery)}&limit=10`, token);
      setMusicResults(res.results || res.tracks || []);
    } catch { setMusicResults([]); }
    setMusicSearching(false);
  };

  const handleCreate = async () => {
    if (!content.trim() && media.length === 0) return;
    setLoading(true);
    try {
      let mediaUrls = [];
      if (media.length > 0) {
        const uris = media.map(m => m.uri);
        mediaUrls = await api.uploadPostMedia(uris, token);
      }

      const body = { content: content.trim() };
      if (mediaUrls.length > 0) body.media_urls = mediaUrls;
      if (location) {
        body.location = typeof location === 'string' ? location : location.name;
        body.location_name = typeof location === 'string' ? location : location.name;
        if (location.latitude) body.latitude = location.latitude;
        if (location.longitude) body.longitude = location.longitude;
      }
      if (musicTrack) body.music_track_id = musicTrack.id;
      const hasVideo = media.some(m => m.type === 'video');
      if (hasVideo) body.post_type = 'video';
      else if (media.length > 0) body.post_type = 'media';

      await api.post('/social/posts', body, token);
      navigation.goBack();
    } catch { Alert.alert(t('common.error'), t('common.error')); }
    setLoading(false);
  };

  const charsLeft = MAX_CHARS - content.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.textSecondary, fontSize: 15 }}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('feed.newPost')}</Text>
        <TouchableOpacity onPress={handleCreate} disabled={loading || (!content.trim() && media.length === 0)}>
          {loading ? <ActivityIndicator size="small" color={BRAND.primary} /> : (
            <View style={[styles.shareBtn, { opacity: (content.trim() || media.length > 0) ? 1 : 0.4 }]}>
              <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 14 }}>{t('common.share')}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.text }]}
          placeholder={t('feed.whatsOnMind')}
          placeholderTextColor={colors.textMuted}
          value={content}
          onChangeText={handleContentChange}
          multiline
          autoFocus
          textAlignVertical="top"
        />

        {charsLeft < 200 && (
          <Text style={[styles.charCount, { color: charsLeft < 50 ? '#EF4444' : colors.textMuted }]}>{charsLeft}</Text>
        )}

        {/* Mention Autocomplete */}
        {showMentions && mentionResults.length > 0 && (
          <View style={[styles.autocomplete, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            {mentionResults.map((u) => (
              <TouchableOpacity key={u.id} style={styles.autocompleteRow} onPress={() => insertMention(u.username)}>
                <View style={[styles.miniAvatar, { backgroundColor: colors.card }]}>
                  {u.avatar_url ? <Image source={{ uri: u.avatar_url }} style={styles.miniAvatar} /> : <Ionicons name="person" size={12} color={BRAND.primary} />}
                </View>
                <View>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>@{u.username}</Text>
                  {u.display_name && <Text style={{ color: colors.textMuted, fontSize: 11 }}>{u.display_name}</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Hashtag Suggestions */}
        {showHashtags && hashtagResults.length > 0 && (
          <View style={[styles.autocomplete, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            {hashtagResults.map((h) => (
              <TouchableOpacity key={h.tag} style={styles.autocompleteRow} onPress={() => insertHashtag(h.tag)}>
                <View style={[styles.hashIcon, { backgroundColor: `${BRAND.primary}18` }]}>
                  <Text style={{ color: BRAND.primary, fontWeight: '700' }}>#</Text>
                </View>
                <View>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>#{h.tag}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>{h.count} {t('common.posts')}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Media Preview */}
        {media.length > 0 && (
          <FlatList
            horizontal
            data={media}
            renderItem={({ item, index }) => (
              <View style={styles.mediaWrap}>
                <Image source={{ uri: item.uri }} style={styles.mediaPreview} />
                {item.type === 'video' && (
                  <View style={styles.videoOverlay}>
                    <Ionicons name="videocam" size={20} color="#FFF" />
                    {item.duration && <Text style={styles.videoDuration}>{Math.round(item.duration / 1000)}s</Text>}
                  </View>
                )}
                <TouchableOpacity style={styles.mediaRemove} onPress={() => removeMedia(index)}>
                  <Ionicons name="close-circle" size={22} color="#FFF" />
                </TouchableOpacity>
                {item.type !== 'video' && (
                  <TouchableOpacity style={styles.mediaEdit} onPress={() => editImage(index)}>
                    <Ionicons name="create-outline" size={16} color="#FFF" />
                  </TouchableOpacity>
                )}
                {media.length > 1 && <View style={styles.mediaIndex}><Text style={{ color: '#FFF', fontSize: 10 }}>{index + 1}/{media.length}</Text></View>}
              </View>
            )}
            keyExtractor={(_, i) => `media-${i}`}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            showsHorizontalScrollIndicator={false}
          />
        )}

        {/* Location Tag */}
        {location && (
          <View style={[styles.tag, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="location" size={14} color={BRAND.pink} />
            <Text style={{ color: colors.text, fontSize: 12, flex: 1 }}>{typeof location === 'string' ? location : location.name}</Text>
            <TouchableOpacity onPress={() => setLocation(null)}><Ionicons name="close" size={16} color={colors.textMuted} /></TouchableOpacity>
          </View>
        )}

        {/* Music Tag */}
        {musicTrack && (
          <View style={[styles.tag, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="musical-note" size={14} color={BRAND.accent} />
            <Text style={{ color: colors.text, fontSize: 12, flex: 1 }} numberOfLines={1}>{musicTrack.title} - {musicTrack.artist}</Text>
            <TouchableOpacity onPress={() => setMusicTrack(null)}><Ionicons name="close" size={16} color={colors.textMuted} /></TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Toolbar */}
      <View style={[styles.toolbar, { borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.toolBtn} onPress={pickMedia}>
          <Ionicons name="image-outline" size={22} color={BRAND.primary} />
          <Text style={[styles.toolLabel, { color: colors.textMuted }]}>{t('feed.photo')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={takePhoto}>
          <Ionicons name="camera-outline" size={22} color={BRAND.accent} />
          <Text style={[styles.toolLabel, { color: colors.textMuted }]}>{t('ar.photo')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={() => setShowMusicSearch(true)}>
          <Ionicons name="musical-note-outline" size={22} color={BRAND.pink} />
          <Text style={[styles.toolLabel, { color: colors.textMuted }]}>{t('music.songs')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={() => setShowLocationModal(true)}>
          <Ionicons name="location-outline" size={22} color="#F59E0B" />
          <Text style={[styles.toolLabel, { color: colors.textMuted }]}>{t('profile.location')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={() => { const pos = content.length; setContent(content + '@'); inputRef.current?.focus(); }}>
          <Ionicons name="at-outline" size={22} color="#10B981" />
          <Text style={[styles.toolLabel, { color: colors.textMuted }]}>@</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={() => { setContent(content + '#'); inputRef.current?.focus(); }}>
          <Ionicons name="pricetag-outline" size={22} color={colors.textSecondary} />
          <Text style={[styles.toolLabel, { color: colors.textMuted }]}>#</Text>
        </TouchableOpacity>
      </View>

      {/* Location Picker */}
      <LocationPicker
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onSelect={(loc) => { setLocation(loc); setLocationInput(''); }}
      />

      {/* Music Search Modal */}
      <Modal visible={showMusicSearch} transparent animationType="slide" onRequestClose={() => setShowMusicSearch(false)}>
        <View style={[styles.musicModal, { backgroundColor: colors.background }]}>
          <View style={[styles.musicHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowMusicSearch(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('music.addToPlaylist')}</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={[styles.musicSearchBar, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={{ flex: 1, color: colors.text, fontSize: 14 }}
              placeholder={t('home.searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={musicSearchQuery}
              onChangeText={setMusicSearchQuery}
              onSubmitEditing={searchMusic}
              returnKeyType="search"
            />
            {musicSearching && <ActivityIndicator size="small" color={BRAND.primary} />}
          </View>
          <FlatList
            data={musicResults}
            renderItem={({ item }) => (
              <TouchableOpacity style={[styles.musicRow, { borderBottomColor: colors.border }]} onPress={() => { setMusicTrack(item); setShowMusicSearch(false); }}>
                <View style={[styles.musicThumb, { backgroundColor: colors.surfaceElevated }]}>
                  {item.thumbnail ? <Image source={{ uri: item.thumbnail }} style={styles.musicThumb} /> : <Ionicons name="musical-note" size={16} color={BRAND.accent} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>{item.title}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.artist}</Text>
                </View>
                <Ionicons name="add-circle" size={22} color={BRAND.primary} />
              </TouchableOpacity>
            )}
            keyExtractor={(item, i) => item.id || `${i}`}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Ionicons name="musical-notes" size={36} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, marginTop: 8 }}>{t('common.search')}</Text>
              </View>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  shareBtn: { backgroundColor: BRAND.primary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  input: { fontSize: 16, padding: 16, lineHeight: 22, minHeight: 120 },
  charCount: { paddingHorizontal: 16, fontSize: 12, marginBottom: 8 },
  autocomplete: { marginHorizontal: 16, borderRadius: 12, borderWidth: 1, overflow: 'hidden', maxHeight: 200 },
  autocompleteRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  miniAvatar: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  hashIcon: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  mediaWrap: { position: 'relative' },
  mediaPreview: { width: 160, height: 160, borderRadius: 12 },
  mediaRemove: { position: 'absolute', top: 4, right: 4 },
  mediaEdit: { position: 'absolute', top: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 4 },
  mediaIndex: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  videoOverlay: { position: 'absolute', bottom: 4, left: 4, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  videoDuration: { color: '#FFF', fontSize: 11, fontWeight: '500' },
  tag: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 10, padding: 10, borderRadius: 10, gap: 6 },
  toolbar: { flexDirection: 'row', borderTopWidth: 0.5, paddingHorizontal: 8, paddingVertical: 10 },
  toolBtn: { flex: 1, alignItems: 'center', gap: 2 },
  toolLabel: { fontSize: 9 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  musicModal: { flex: 1, paddingTop: 50 },
  musicHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5 },
  musicSearchBar: { flexDirection: 'row', alignItems: 'center', margin: 16, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, gap: 8 },
  musicRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, gap: 12 },
  musicThumb: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
});
