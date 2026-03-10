import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet, Dimensions,
  TextInput, Animated, FlatList, Modal, Alert,
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

const { width: SW, height: SH } = Dimensions.get('window');
const STORY_DURATION = 5000;
const REACTIONS = ['❤️', '🔥', '😂', '😮', '👏', '🥺'];

export default function StoryViewerScreen({ route, navigation }) {
  const { stories: initialStories, startIndex = 0, userId } = route.params || {};
  const { user, token } = useAuth();
  const { colors } = useTheme();
  const [stories, setStories] = useState(initialStories || []);
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [reply, setReply] = useState('');
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const videoRef = useRef(null);

  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [highlights, setHighlights] = useState([]);

  const [qaAnswer, setQaAnswer] = useState('');
  const [showQAInput, setShowQAInput] = useState(false);

  const currentStory = stories[currentIndex];
  const isOwn = currentStory?.user_id === user?.id;
  const isVideo = currentStory?.media_type === 'video' || currentStory?.story_type === 'video';

  useEffect(() => {
    if (!initialStories && userId) {
      api.get(`/stories/user/${userId}`, token).then(r => setStories(r.stories || r || [])).catch(() => {});
    }
  }, [userId, token]);

  const startTimer = useCallback(() => {
    progressAnim.setValue(0);
    const dur = isVideo ? (currentStory?.duration || 30) * 1000 : STORY_DURATION;
    Animated.timing(progressAnim, { toValue: 1, duration: dur, useNativeDriver: false }).start(({ finished }) => {
      if (finished && !isPaused) goNext();
    });
  }, [currentIndex, isPaused, isVideo, currentStory?.duration]);

  useEffect(() => {
    if (stories.length > 0) {
      startTimer();
      if (currentStory && !isOwn) {
        api.post(`/stories/${currentStory.id || currentStory._id}/view`, {}, token).catch(() => {});
      }
    }
    return () => { progressAnim.stopAnimation(); };
  }, [currentIndex, stories.length, startTimer]);

  const goNext = () => {
    if (currentIndex < stories.length - 1) setCurrentIndex(i => i + 1);
    else navigation.goBack();
  };
  const goPrev = () => { if (currentIndex > 0) setCurrentIndex(i => i - 1); };

  const handlePauseToggle = () => {
    if (isPaused) {
      startTimer();
      if (isVideo && videoRef.current) videoRef.current.playAsync().catch(() => {});
    } else {
      progressAnim.stopAnimation();
      if (isVideo && videoRef.current) videoRef.current.pauseAsync().catch(() => {});
    }
    setIsPaused(!isPaused);
  };

  const sendReply = async () => {
    if (!reply.trim() || !currentStory) return;
    try {
      await api.post(`/stories/${currentStory.id || currentStory._id}/reply`, { content: reply.trim() }, token);
      Alert.alert('', 'Yanıt gönderildi');
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Gönderilemedi';
      Alert.alert('Hata', msg);
    }
    setReply('');
  };

  const sendReaction = async (emoji) => {
    if (!currentStory) return;
    try { await api.post('/stories/reaction', { story_id: currentStory.id || currentStory._id, emoji }, token); } catch {}
  };

  const votePoll = async (optionIndex) => {
    if (!currentStory) return;
    try {
      await api.post(`/stories/${currentStory.id || currentStory._id}/poll/vote`, { option_index: optionIndex }, token);
      Alert.alert('', 'Oyunuz kaydedildi');
    } catch (e) {
      Alert.alert('', e?.response?.data?.detail || 'Zaten oy kullandınız');
    }
  };

  const sendQAAnswer = async () => {
    if (!qaAnswer.trim() || !currentStory) return;
    try {
      await api.post(`/stories/${currentStory.id || currentStory._id}/qa/answer`, { answer: qaAnswer.trim() }, token);
      Alert.alert('', 'Cevabınız gönderildi');
    } catch {}
    setQaAnswer('');
    setShowQAInput(false);
  };

  const fetchViewers = async () => {
    if (!currentStory) return;
    try {
      const res = await api.get(`/stories/${currentStory.id || currentStory._id}/viewers`, token);
      setViewers(res.viewers || res || []);
    } catch {}
    setShowViewers(true);
  };

  const addToHighlight = async () => {
    try {
      const res = await api.get('/highlights', token);
      setHighlights(res.highlights || res || []);
    } catch { setHighlights([]); }
    setShowHighlightPicker(true);
  };

  const confirmAddToHighlight = async (highlightId) => {
    if (!currentStory) return;
    try {
      await api.post(`/highlights/${highlightId}/stories`, { story_id: currentStory.id || currentStory._id }, token);
      Alert.alert('', 'Vurguya eklendi');
    } catch {}
    setShowHighlightPicker(false);
  };

  const notifyScreenshot = async () => {
    if (!currentStory || isOwn) return;
    try { await api.post(`/stories/${currentStory.id || currentStory._id}/screenshot`, {}, token); } catch {}
  };

  if (!currentStory) return null;

  const filter = currentStory.filter_id ? { overlay: 'rgba(0,0,0,0.1)' } : null;

  return (
    <View style={styles.container}>
      {/* Background */}
      <View style={styles.storyBg}>
        {isVideo && currentStory.media_url ? (
          <Video ref={videoRef} source={{ uri: currentStory.media_url }} style={styles.storyImg}
            resizeMode="cover" shouldPlay isLooping={false} isMuted={!!currentStory.music_track}
            onPlaybackStatusUpdate={(s) => { if (s.didJustFinish) goNext(); }} />
        ) : currentStory.media_url ? (
          <Image source={{ uri: currentStory.media_url }} style={styles.storyImg} resizeMode="cover" />
        ) : (
          <View style={[styles.storyImg, { backgroundColor: currentStory.background_color || BRAND.primaryDark, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
            <Text style={{ color: '#FFF', fontSize: 20, textAlign: 'center', lineHeight: 28 }}>{currentStory.caption || currentStory.content || currentStory.text || ''}</Text>
          </View>
        )}
        {filter?.overlay && <View style={[StyleSheet.absoluteFill, { backgroundColor: filter.overlay }]} pointerEvents="none" />}
      </View>

      {/* Text overlays */}
      {(currentStory.text_overlays || []).map((ov, i) => (
        <Text key={i} style={{ position: 'absolute', left: ov.x, top: ov.y, color: ov.color || '#FFF', fontSize: ov.fontSize || 24, fontWeight: '700',
          textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 }}>{ov.text}</Text>
      ))}

      {/* Stickers */}
      {(currentStory.stickers || []).map((s, i) => (
        <Text key={i} style={{ position: 'absolute', left: s.x, top: s.y, fontSize: 36 }}>{s.emoji}</Text>
      ))}

      {/* Touch zones */}
      <View style={styles.touchZones}>
        <TouchableOpacity style={styles.touchLeft} onPress={goPrev} onLongPress={handlePauseToggle} />
        <TouchableOpacity style={styles.touchRight} onPress={goNext} onLongPress={handlePauseToggle} />
      </View>

      {/* Progress bars */}
      <View style={styles.progressRow}>
        {stories.map((_, i) => (
          <View key={i} style={[styles.progressBg, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
            {i < currentIndex ? <View style={[styles.progressFill, { width: '100%' }]} /> :
              i === currentIndex ? <Animated.View style={[styles.progressFill, { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} /> :
              null}
          </View>
        ))}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.userAvatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          {currentStory.user?.avatar_url || currentStory.user_avatar ? (
            <Image source={{ uri: currentStory.user?.avatar_url || currentStory.user_avatar }} style={styles.userAvatar} />
          ) : <Ionicons name="person" size={14} color="#FFF" />}
        </View>
        <Text style={styles.username}>{currentStory.user?.username || currentStory.username || ''}</Text>
        <Text style={styles.timeAgo}>{currentStory.created_ago || ''}</Text>
        <View style={{ flex: 1 }} />

        {currentStory.close_friends_only && (
          <View style={styles.cfBadge}><Ionicons name="star" size={10} color="#10B981" /></View>
        )}

        {currentStory.music_track && (
          <View style={styles.musicBadge}>
            <Ionicons name="musical-note" size={12} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 10 }} numberOfLines={1}>{currentStory.music_track.title}</Text>
          </View>
        )}

        {isOwn && (
          <TouchableOpacity onPress={addToHighlight} style={{ padding: 4, marginLeft: 4 }}>
            <Ionicons name="bookmark-outline" size={22} color="#FFF" />
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginLeft: 4 }}>
          <Ionicons name="close" size={26} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Location */}
      {currentStory.location ? (
        <View style={styles.locationBadge}>
          <Ionicons name="location" size={12} color="#FFF" />
          <Text style={{ color: '#FFF', fontSize: 11 }}>{currentStory.location}</Text>
        </View>
      ) : null}

      {/* Poll */}
      {(currentStory.poll_options || currentStory.poll) && (
        <View style={styles.pollOverlay}>
          <Text style={styles.pollQ}>{currentStory.poll_question || currentStory.poll?.question}</Text>
          {(currentStory.poll_options || currentStory.poll?.options || []).map((opt, i) => (
            <TouchableOpacity key={i} style={styles.pollOpt} onPress={() => votePoll(i)}>
              <Text style={{ color: '#FFF', fontWeight: '500' }}>{typeof opt === 'string' ? opt : opt.text}</Text>
              {opt.percentage !== undefined && <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{opt.percentage}%</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Q&A sticker */}
      {currentStory.qa_question && !isOwn ? (
        <TouchableOpacity style={styles.qaOverlay} onPress={() => setShowQAInput(true)}>
          <Ionicons name="help-circle" size={18} color="#FFF" />
          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>{currentStory.qa_question}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Cevaplamak için dokun</Text>
        </TouchableOpacity>
      ) : currentStory.qa_question && isOwn ? (
        <View style={styles.qaOverlay}>
          <Ionicons name="help-circle" size={18} color="#FFF" />
          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>{currentStory.qa_question}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{(currentStory.qa_answers || []).length} cevap</Text>
        </View>
      ) : null}

      {/* Countdown sticker */}
      {currentStory.countdown_title ? (
        <View style={styles.countdownOverlay}>
          <Ionicons name="time" size={20} color="#FFF" />
          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>{currentStory.countdown_title}</Text>
          {currentStory.countdown_end && (
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{currentStory.countdown_end}</Text>
          )}
        </View>
      ) : null}

      {/* Caption */}
      {currentStory.caption && !currentStory.poll_options && !currentStory.poll && (
        <View style={styles.captionOverlay}>
          <Text style={{ color: '#FFF', fontSize: 14, lineHeight: 20 }}>{currentStory.caption}</Text>
        </View>
      )}

      {/* Bottom - Reply or Viewers */}
      <View style={styles.bottom}>
        {isOwn ? (
          <TouchableOpacity style={styles.viewersBtn} onPress={fetchViewers}>
            <Ionicons name="eye" size={18} color="#FFF" />
            <Text style={{ color: '#FFF', fontSize: 13 }}>{currentStory.viewers_count || currentStory.view_count || 0} görüntüleme</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.replyRow}>
            <View style={styles.replyInput}>
              <TextInput style={{ flex: 1, color: '#FFF', fontSize: 14 }} placeholder="Yanıt gönder..." placeholderTextColor="rgba(255,255,255,0.5)"
                value={reply} onChangeText={setReply} />
              {reply.trim() && (
                <TouchableOpacity onPress={sendReply}><Ionicons name="send" size={18} color={BRAND.primary} /></TouchableOpacity>
              )}
            </View>
            <View style={styles.reactionBar}>
              {REACTIONS.map(e => (
                <TouchableOpacity key={e} onPress={() => sendReaction(e)}>
                  <Text style={{ fontSize: 20 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Viewers Modal */}
      <Modal visible={showViewers} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Görüntüleyenler ({viewers.length})</Text>
              <TouchableOpacity onPress={() => setShowViewers(false)}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
            </View>
            <FlatList
              data={viewers}
              renderItem={({ item }) => (
                <View style={[styles.viewerRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.viewerAvatar, { backgroundColor: colors.card }]}>
                    {item.avatar_url || item.user_avatar ? (
                      <Image source={{ uri: item.avatar_url || item.user_avatar }} style={styles.viewerAvatar} />
                    ) : <Ionicons name="person" size={14} color={BRAND.primaryLight} />}
                  </View>
                  <Text style={{ color: colors.text, flex: 1 }}>{item.username}</Text>
                  {item.reaction && <Text style={{ fontSize: 16 }}>{item.reaction}</Text>}
                </View>
              )}
              keyExtractor={(item, i) => item.id || `${i}`}
              style={{ maxHeight: 300 }}
            />
          </View>
        </View>
      </Modal>

      {/* Q&A Answer Modal */}
      <Modal visible={showQAInput} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>{currentStory?.qa_question}</Text>
            <TextInput style={[styles.qaInput, { backgroundColor: colors.inputBg, color: colors.text }]}
              placeholder="Cevabınızı yazın..." placeholderTextColor={colors.textMuted}
              value={qaAnswer} onChangeText={setQaAnswer} multiline autoFocus />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 12, alignItems: 'center' }} onPress={() => setShowQAInput(false)}>
                <Text style={{ color: colors.textMuted }}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: BRAND.primary, borderRadius: 12 }} onPress={sendQAAnswer}>
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Gönder</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Highlight Picker Modal */}
      <Modal visible={showHighlightPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>Vurguya Ekle</Text>
              <TouchableOpacity onPress={() => setShowHighlightPicker(false)}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
            </View>
            <FlatList
              data={highlights}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.viewerRow, { borderBottomColor: colors.border }]} onPress={() => confirmAddToHighlight(item.id)}>
                  <View style={[styles.viewerAvatar, { backgroundColor: colors.surfaceElevated }]}>
                    {item.cover_url ? <Image source={{ uri: item.cover_url }} style={styles.viewerAvatar} /> : <Ionicons name="bookmark" size={16} color={BRAND.primary} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '500' }}>{item.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>{item.story_count || 0} hikaye</Text>
                  </View>
                  <Ionicons name="add-circle" size={22} color={BRAND.primary} />
                </TouchableOpacity>
              )}
              keyExtractor={(item, i) => item.id || `${i}`}
              style={{ maxHeight: 300 }}
              ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: 'center', padding: 20 }}>Henüz vurgu yok</Text>}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  storyBg: { ...StyleSheet.absoluteFillObject },
  storyImg: { width: '100%', height: '100%' },
  touchZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  touchLeft: { flex: 1 },
  touchRight: { flex: 2 },
  progressRow: { flexDirection: 'row', position: 'absolute', top: 50, left: 12, right: 12, gap: 3 },
  progressBg: { flex: 1, height: 2.5, borderRadius: 1 },
  progressFill: { height: '100%', backgroundColor: '#FFF', borderRadius: 1 },
  header: { position: 'absolute', top: 62, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  userAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  username: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  timeAgo: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  cfBadge: { backgroundColor: 'rgba(0,0,0,0.4)', padding: 4, borderRadius: 10 },
  musicBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4, maxWidth: 120 },
  locationBadge: { position: 'absolute', top: 96, left: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  pollOverlay: { position: 'absolute', bottom: 120, left: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, padding: 16 },
  pollQ: { color: '#FFF', fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  pollOpt: { backgroundColor: 'rgba(255,255,255,0.15)', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 6, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  qaOverlay: { position: 'absolute', bottom: 120, left: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, padding: 16, alignItems: 'center', gap: 6 },
  countdownOverlay: { position: 'absolute', top: 120, right: 16, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 },
  captionOverlay: { position: 'absolute', bottom: 100, left: 16, right: 16 },
  bottom: { position: 'absolute', bottom: 20, left: 16, right: 16 },
  viewersBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  replyRow: { gap: 8 },
  replyInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 24, paddingHorizontal: 16, height: 44 },
  reactionBar: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  viewerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, gap: 10 },
  viewerAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  qaInput: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 60, textAlignVertical: 'top' },
});
