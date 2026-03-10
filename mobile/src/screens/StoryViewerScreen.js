/**
 * StoryViewerScreen - Hikaye izleme
 * İlerleme çubuğu, dokunmatik geçiş, yanıt, tepki, Expo AV video oynatma
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, PanResponder, TextInput, ActivityIndicator, Animated, Platform, I18nManager,
} from 'react-native';
import { Video } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { getApiUrl } from '../services/api';
import InterstitialAdSlot from '../components/ads/InterstitialAdSlot';

function CountdownOverlay({ endTime, title }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const tick = () => {
      const end = new Date(endTime).getTime();
      const now = Date.now();
      if (end <= now) setRemaining('0:00');
      else {
        const d = Math.floor((end - now) / 1000);
        const m = Math.floor(d / 60);
        const s = d % 60;
        setRemaining(`${m}:${s.toString().padStart(2, '0')}`);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);
  return (
    <View style={styles.countdownOverlay}>
      <Text style={styles.countdownTitle}>{title || 'Countdown'}</Text>
      <Text style={styles.countdownTime}>{remaining}</Text>
    </View>
  );
}

function PollOverlay({ story, token, isOwn, onVote }) {
  const [voted, setVoted] = useState(null);
  const [options, setOptions] = useState(story.poll_options || []);
  const vote = async (optionId, optionIndex) => {
    if (voted || !token || isOwn) return;
    try {
      await api.post(`/stories/${story.id}/poll/vote`, { option_id: optionId, option_index: optionIndex }, token);
      setVoted(optionId ?? optionIndex);
      const res = await api.get(`/stories/${story.id}/poll/results`, token);
      if (res?.options) setOptions(res.options);
    } catch { }
  };
  const opts = options.map((o, i) => ({ ...o, index: i }));
  const totalVotes = opts.reduce((s, o) => s + (o.votes || 0), 0);
  return (
    <View style={styles.pollOverlay}>
      <Text style={styles.pollQuestion}>{story.poll_question}</Text>
      {opts.map((opt) => {
        const pct = totalVotes > 0 ? ((opt.votes || 0) / totalVotes) * 100 : 0;
        return (
          <TouchableOpacity
            key={opt.id ?? opt.index}
            style={styles.pollOption}
            onPress={() => vote(opt.id, opt.index)}
            disabled={!!voted || isOwn}
          >
            <View style={[styles.pollOptionBar, { width: `${pct}%` }]} />
            <Text style={styles.pollOptionText}>{opt.text} {voted && `(${pct.toFixed(0)}%)`}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const REACTIONS = [
  { type: 'heart', emoji: '❤️' },
  { type: 'fire', emoji: '🔥' },
  { type: 'laugh', emoji: '😂' },
  { type: 'wow', emoji: '😮' },
  { type: 'sad', emoji: '😢' },
  { type: 'clap', emoji: '👏' },
];

const { width: SW, height: SH } = Dimensions.get('window');
const STORY_DURATION = 5000;

const mediaUri = (uri) => {
  if (!uri) return null;
  if (uri.startsWith('http')) return uri;
  const base = (getApiUrl() || '').replace(/\/api\/?$/, '');
  return uri.startsWith('/') ? `${base}${uri}` : `${base}/api/${uri}`;
};

export default function StoryViewerScreen({ route, navigation }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { feed, startUserIndex = 0, startStoryIndex = 0 } = route.params || {};
  const [userIndex, setUserIndex] = useState(startUserIndex);
  const [storyIndex, setStoryIndex] = useState(startStoryIndex);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [showAdInterstitial, setShowAdInterstitial] = useState(false);
  const [sentReaction, setSentReaction] = useState(null);
  const reactionAnim = useRef(new Animated.Value(0)).current;
  const pendingGoNextRef = useRef(null);
  const storiesSeenRef = useRef(0);
  const progressRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const elapsedRef = useRef(0);

  const userGroup = feed?.[userIndex];
  const stories = userGroup?.stories || [];
  const story = stories[storyIndex];
  const isOwn = story?.user_id === user?.id;

  useEffect(() => {
    if (!story || !token || isOwn) return;
    api.post(`/stories/${story.id}/view`, {}, token).catch(() => { });
  }, [story?.id, token, isOwn]);

  useEffect(() => {
    if (!story || paused) return;
    const duration = (story.duration || 5) * 1000;
    const remaining = duration - elapsedRef.current;
    progressRef.current = setInterval(() => {
      elapsedRef.current += 100;
      setProgress((p) => Math.min(1, p + 100 / duration));
      if (elapsedRef.current >= duration) {
        clearInterval(progressRef.current);
        goNext();
      }
    }, 100);
    return () => clearInterval(progressRef.current);
  }, [story?.id, paused]);

  const doGoNext = () => {
    elapsedRef.current = 0;
    if (storyIndex < stories.length - 1) {
      setStoryIndex((i) => i + 1);
      setProgress(0);
    } else if (userIndex < feed.length - 1) {
      setUserIndex((i) => i + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      navigation.goBack();
    }
  };

  const goNext = () => {
    storiesSeenRef.current += 1;
    const n = storiesSeenRef.current;
    if (n > 0 && n % 8 === 0) {
      setShowAdInterstitial(true);
      pendingGoNextRef.current = doGoNext;
    } else {
      doGoNext();
    }
  };

  const onAdClose = () => {
    setShowAdInterstitial(false);
    const fn = pendingGoNextRef.current;
    pendingGoNextRef.current = null;
    if (fn) fn();
  };

  const goPrev = () => {
    elapsedRef.current = 0;
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1);
      setProgress(0);
    } else if (userIndex > 0) {
      setUserIndex((i) => i - 1);
      const prevStories = feed[userIndex - 1]?.stories || [];
      setStoryIndex(prevStories.length - 1);
      setProgress(0);
    } else {
      navigation.goBack();
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => false,
      onPanResponderRelease: (evt, g) => {
        if (Math.abs(g.dx) < 30) {
          if (evt.nativeEvent.locationX < SW / 2) goPrev();
          else goNext();
        }
      },
    })
  ).current;

  const sendReply = async () => {
    if (!replyText.trim() || !story?.id || !token) return;
    setSendingReply(true);
    try {
      await api.post(`/stories/${story.id}/reply`, { story_id: story.id, content: replyText.trim(), reply_type: 'TEXT' }, token);
      setReplyText('');
    } catch { }
    setSendingReply(false);
  };

  const sendReaction = useCallback(async (type) => {
    if (!story?.id || !token) return;
    setSentReaction(type);
    reactionAnim.setValue(0);
    Animated.sequence([
      Animated.spring(reactionAnim, { toValue: 1, useNativeDriver: true, friction: 3 }),
      Animated.timing(reactionAnim, { toValue: 0, duration: 600, delay: 400, useNativeDriver: true }),
    ]).start(() => setSentReaction(null));
    try {
      await api.post(`/stories/${story.id}/react`, { reaction: type }, token);
    } catch { }
  }, [story?.id, token, reactionAnim]);

  if (!feed?.length || !story) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.center}>
          <Text style={styles.empty}>{t('stories.noStories')}</Text>
        </View>
      </View>
    );
  }

  const mediaUrl = story.media_url || story.media?.url;
  const bgColor = story.background_color || '#8B5CF6';

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: bgColor }]} {...panResponder.panHandlers}>
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="close" size={28} color="#fff" />
      </TouchableOpacity>

      <View style={styles.progressRow}>
        {stories.map((_, i) => (
          <View key={i} style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${i < storyIndex ? 100 : i === storyIndex ? progress * 100 : 0}%` }]} />
          </View>
        ))}
      </View>

      <View style={styles.storyHeader}>
        <Image source={{ uri: userGroup?.user_avatar || `https://i.pravatar.cc/80?u=${userGroup?.username}` }} style={styles.headerAvatar} />
        <Text style={styles.headerName}>{userGroup?.user_display_name || userGroup?.username}</Text>
        <TouchableOpacity onPress={() => setPaused((p) => !p)} style={styles.pauseHint}>
          <Text style={styles.pauseText}>{paused ? t('stories.resume') : t('stories.pause')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.storyContent}>
        {mediaUrl ? (
          story.media_type === 'video' ? (
            <Video
              source={{ uri: mediaUri(mediaUrl) }}
              style={styles.storyMedia}
              resizeMode="contain"
              shouldPlay={!paused}
              isLooping={false}
              onPlaybackStatusUpdate={(status) => {
                if (status.didJustFinish && !status.isPlaying) goNext();
              }}
            />
          ) : (
            <Image source={{ uri: mediaUri(mediaUrl) }} style={styles.storyMedia} resizeMode="contain" />
          )
        ) : (
          <View style={[styles.storyTextBg, { backgroundColor: story.background_color || '#8B5CF6' }]}>
            <Text style={styles.storyText}>{story.text || story.mood || '✨'}</Text>
          </View>
        )}
        {story.countdown_end && <CountdownOverlay endTime={story.countdown_end} title={story.countdown_title} />}
        {story.poll_question && story.poll_options && (
          <PollOverlay story={story} token={token} isOwn={isOwn} onVote={() => { }} />
        )}
      </View>

      {showAdInterstitial && (
        <InterstitialAdSlot placement="story" onClose={onAdClose} />
      )}
      {!isOwn && (
        <View style={{ paddingBottom: insets.bottom + 16 }}>
          <View style={styles.reactionBar}>
            {REACTIONS.map((r) => (
              <TouchableOpacity key={r.type} style={styles.reactionBtn} onPress={() => sendReaction(r.type)}>
                <Text style={styles.reactionEmoji}>{r.emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {sentReaction && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.reactionFeedback,
                {
                  opacity: reactionAnim,
                  transform: [
                    { scale: reactionAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.4] }) },
                    { translateY: reactionAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -60] }) },
                  ],
                },
              ]}
            >
              <Text style={styles.reactionFeedbackText}>
                {REACTIONS.find((r) => r.type === sentReaction)?.emoji}
              </Text>
            </Animated.View>
          )}
          <View style={styles.replyRow}>
            <TextInput
              style={styles.replyInput}
              placeholder={t('stories.replyPlaceholder')}
              placeholderTextColor="#9CA3AF"
              value={replyText}
              onChangeText={setReplyText}
              onSubmitEditing={sendReply}
            />
            <TouchableOpacity style={styles.sendReplyBtn} onPress={sendReply} disabled={sendingReply || !replyText.trim()}>
              {sendingReply ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  closeBtn: { position: 'absolute', top: 50, [I18nManager.isRTL ? 'left' : 'right']: 20, zIndex: 10 },
  progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 12 },
  progressTrack: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  storyHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  headerName: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600' },
  pauseHint: { padding: 8 },
  pauseText: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  storyContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  storyMedia: { width: SW, height: SH * 0.6 },
  storyTextBg: { padding: 32, borderRadius: 16 },
  storyText: { fontSize: 24, color: '#fff', fontWeight: '600' },
  reactionBar: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  reactionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  reactionEmoji: { fontSize: 22 },
  reactionFeedback: { position: 'absolute', alignSelf: 'center', bottom: 80 },
  reactionFeedbackText: { fontSize: 48 },
  replyRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  replyInput: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontSize: 15 },
  sendReplyBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#fff', fontSize: 16 },
  countdownOverlay: { position: 'absolute', bottom: 80, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 16, borderRadius: 12 },
  countdownTitle: { color: '#fff', fontSize: 14 },
  countdownTime: { color: '#fff', fontSize: 28, fontWeight: '700' },
  pollOverlay: { position: 'absolute', bottom: 80, left: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.6)', padding: 16, borderRadius: 12 },
  pollQuestion: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  pollOption: { marginTop: 8, height: 40, borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.2)' },
  pollOptionBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#8B5CF6' },
  pollOptionText: { position: 'absolute', left: 12, right: 12, top: 0, bottom: 0, color: '#fff', fontSize: 14, lineHeight: 40 },
});
