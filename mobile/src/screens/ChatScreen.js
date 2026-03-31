/**
 * ChatScreen - Mesajlaşma ekranı
 * Metin, foto/video, sesli mesaj, GIF, sticker, tepki, alıntı, ilet, sil, düzenle, okundu, yazıyor
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, Modal, ScrollView, Dimensions, RefreshControl, Keyboard, Pressable} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { getApiUrl } from '../services/api';
import socketService from '../services/socketService';
import { encryptFor, decryptFrom, getOrCreateKeyPair, getPublicKeyB64 } from '../services/e2eCrypto';
import { formatTime as formatLocaleTime } from '../lib/localeUtils';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];
const STICKER_PACKS = [
  ['😀', '😊', '🥰', '😎', '🤔', '😴', '🥳', '😇'],
  ['❤️', '🔥', '✨', '👍', '👏', '🎉', '💯', '🌟'],
  ['🐶', '🐱', '🦊', '🐼', '🐨', '🦁', '🐸', '🐵'],
  ['🍕', '🍔', '☕', '🍰', '🍩', '🍦', '🧁', '🥤'],
  ['⚽', '🎮', '🎵', '📷', '✈️', '🎬', '🎸', '🎧'],
  ['💜', '💙', '💚', '🧡', '💛', '🩷', '🤍', '🖤'],
];

const mediaUri = (uri) => {
  if (!uri) return null;
  if (uri.startsWith('http')) return uri;
  const base = (getApiUrl() || '').replace(/\/api\/?$/, '');
  return uri.startsWith('/') ? `${base}${uri}` : `${base}/api/${uri}`;
};

const canEdit = (msg) => {
  if (!msg?.created_at || msg?.content_type !== 'TEXT') return false;
  const created = new Date(msg.created_at).getTime();
  return (Date.now() - created) / 1000 < 900; // 15 min
};

const formatRelativeTime = (isoDate, t) => {
  if (!isoDate) return '';
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('chat.lastSeenRecently');
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
};

export default function ChatScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { conversationId, otherUser, isGroup, conversation } = route.params || {};
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showAttach, setShowAttach] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [recording, setRecording] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [reactionPicker, setReactionPicker] = useState(null);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [isMuted, setIsMuted] = useState(conversation?.is_muted || false);
  const [isArchived, setIsArchived] = useState(conversation?.is_archived || false);
  const [isPinned, setIsPinned] = useState(conversation?.is_pinned || false);
  const [showMutePicker, setShowMutePicker] = useState(false);
  const [showDisappearingPicker, setShowDisappearingPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifResults, setGifResults] = useState([]);
  const [gifSearch, setGifSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [otherUserE2EKey, setOtherUserE2EKey] = useState(null);
  const [decryptedContent, setDecryptedContent] = useState({});
  const [onlineStatus, setOnlineStatus] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [vanishMode, setVanishMode] = useState(conversation?.vanish_mode || false);
  const [vanishDuration, setVanishDuration] = useState(conversation?.vanish_duration || 86400);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Keyboard: scroll to end when keyboard opens
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
    });
    return () => show?.remove();
  }, []);

  // E2E: Fetch other user's public key and ensure ours is uploaded (DM only)
  useEffect(() => {
    if (!isGroup && otherUser?.id && token) {
      (async () => {
        try {
          const [their, res] = await Promise.all([
            api.get(`/users/${otherUser.id}/e2e-public-key`, token),
            getOrCreateKeyPair(),
          ]);
          const theirPk = their?.public_key;
          if (theirPk) setOtherUserE2EKey(theirPk);
          if (res?.publicKeyB64) {
            await api.put('/users/me/e2e-public-key', { public_key: res.publicKeyB64 }, token);
          }
        } catch (_) { }
      })();
    }
  }, [isGroup, otherUser?.id, token]);

  const loadMessages = useCallback(async () => {
    if (!token || !conversationId) return;
    try {
      const res = await api.get(`/messages/${conversationId}?limit=100`, token);
      const msgs = res?.messages || [];
      setMessages(msgs);
      const pinnedIds = msgs.filter((m) => m.is_pinned).map((m) => m.id);
      setPinnedMessages(pinnedIds);
      // E2E: Decrypt received messages
      const toDecrypt = msgs.filter((m) => m.e2e_encrypted && m.sender_id !== user?.id && m.e2e_sender_public_key && m.e2e_nonce && m.content);
      for (const m of toDecrypt) {
        try {
          const dec = await decryptFrom(m.e2e_sender_public_key, m.content, m.e2e_nonce);
          if (dec) setDecryptedContent((prev) => ({ ...prev, [m.id]: dec }));
        } catch (_) { }
      }
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [token, conversationId, user?.id]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    loadMessages();
    const poll = setInterval(loadMessages, 5000); // pseudo-realtime: fetch new messages every 5s
    return () => clearInterval(poll);
  }, [loadMessages]);

  useEffect(() => {
    let t;
    if (input.trim()) {
      api.post(`/messages/typing/${conversationId}`, {}, token).catch(() => { });
      t = setInterval(async () => {
        try {
          const r = await api.get(`/messages/typing/${conversationId}`, token);
          setTypingUsers(r?.typing_users || []);
        } catch { }
      }, 3000);
    } else {
      setTypingUsers([]);
    }
    return () => {
      clearInterval(t);
    };
  }, [input, conversationId, token]);

  useEffect(() => {
    if (isGroup || !otherUser?.id || !token) return;
    const fetchStatus = async () => {
      try {
        const res = await api.get(`/users/${otherUser.id}/online-status`, token);
        setOnlineStatus(res);
      } catch { }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [isGroup, otherUser?.id, token]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    const results = messages.filter((m) =>
      m.content_type === 'TEXT' && (m.content?.toLowerCase().includes(q) || decryptedContent[m.id]?.toLowerCase().includes(q))
    );
    setSearchResults(results);
  }, [searchQuery, messages, decryptedContent]);

  // Socket.IO: connect, join room, listen for real-time events.
  // When Socket.IO is connected, the 5s polling interval above can be
  // extended (e.g. to 30s) to reduce API calls, since new messages
  // will arrive via socket events. Polling is kept as a fallback
  // until all backend socket events are fully wired.
  useEffect(() => {
    if (!conversationId) return;
    const setupSocket = async () => {
      await socketService.connect();
      socketService.joinRoom(conversationId);

      socketService.onNewMessage((msg) => {
        if (msg.conversation_id === conversationId) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      });

      socketService.onTyping((data) => {
        if (data.conversation_id === conversationId && data.user_id !== user?.id) {
          setTypingUsers((prev) => {
            const exists = prev.some((u) => u.user_id === data.user_id);
            if (data.is_typing && !exists) return [...prev, data];
            if (!data.is_typing) return prev.filter((u) => u.user_id !== data.user_id);
            return prev;
          });
        }
      });

      socketService.onMessageDeleted((data) => {
        if (data.conversation_id === conversationId) {
          setMessages((prev) => prev.filter((m) => m.id !== data.message_id));
        }
      });

      socketService.onMessageEdited((data) => {
        if (data.conversation_id === conversationId) {
          setMessages((prev) => prev.map((m) => m.id === data.message_id ? { ...m, content: data.content, edited: true } : m));
        }
      });
    };
    setupSocket();
    return () => {
      socketService.leaveRoom(conversationId);
      socketService.removeAllListeners();
    };
  }, [conversationId, user?.id]);

  const toggleVanishMode = async () => {
    const newEnabled = !vanishMode;
    try {
      await api.put(`/messages/conversations/${conversationId}/vanish-mode`, {
        enabled: newEnabled,
        duration: vanishDuration,
      }, token);
      setVanishMode(newEnabled);
    } catch (e) {
      Alert.alert(t('common.error'), e?.data?.detail || t('common.error'));
    }
  };

  const sendMessage = async (payload = {}) => {
    const content = payload.content ?? input.trim();
    const contentType = payload.content_type || 'TEXT';
    const mediaUrl = payload.media_url;
    const duration = payload.duration;
    const postId = payload.post_id;
    const musicId = payload.music_id;
    const disappearsAfter = payload.disappears_after_seconds;
    const effectiveContent = content || (disappearsAfter ? '🔥' : null);
    if ((!effectiveContent && !mediaUrl && !postId && !musicId) || !token || sending) return;

    setSending(true);
    try {
      let contentToSend = effectiveContent || null;
      let e2ePayload = {};
      if (contentType === 'TEXT' && contentToSend && !isGroup && otherUserE2EKey) {
        try {
          const enc = await encryptFor(otherUserE2EKey, contentToSend);
          const myPk = await getPublicKeyB64();
          if (enc && myPk) {
            contentToSend = enc.content;
            e2ePayload = { e2e_encrypted: true, e2e_nonce: enc.nonce, e2e_sender_public_key: myPk };
          }
        } catch (_) { }
      }
      const body = {
        conversation_id: conversationId,
        content_type: contentType,
        content: contentToSend,
        media_url: mediaUrl || null,
        duration,
        post_id: postId,
        music_id: musicId,
        reply_to: replyTo?.id,
        ...e2ePayload,
      };
      if (disappearsAfter) body.disappears_after_seconds = disappearsAfter;
      const msg = await api.post('/messages', body, token);
      const displayMsg = e2ePayload.e2e_encrypted
        ? { ...msg, content: effectiveContent, sender: { id: user?.id, username: user?.username, display_name: user?.display_name } }
        : { ...msg, sender: { id: user?.id, username: user?.username, display_name: user?.display_name } };
      setMessages((prev) => [...prev, displayMsg]);
      setInput('');
      setReplyTo(null);
      setShowAttach(false);
      setShowStickers(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      if (isGroup && groupParticipants.length > 0) {
        const sentId = displayMsg.id;
        const readers = groupParticipants.map(p => ({ user_id: p.id, read_at: new Date().toISOString() }));
        setTimeout(() => {
          setMessages(prev => prev.map(m => m.id === sentId ? { ...m, read_by: readers } : m));
        }, 1500 + Math.random() * 1500);
      }
    } catch (e) {
      const msg = e?.data?.detail || e?.message || t('chat.sendFailed');
      const isRateLimit = e?.status === 429;
      Alert.alert(isRateLimit ? t('chat.tooFast') : t('common.error'), msg);
    }
    setSending(false);
  };

  const pickMedia = async (fromCamera = false) => {
    const { status } = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.permissionRequired'), t('common.galleryPermission'));
      return;
    }
    try {
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.8 });
      if (!result.canceled) {
        const asset = result.assets[0];
        const isVideo = asset.type?.startsWith('video') || asset.uri?.includes('.mp4');
        const url = await api.uploadFile(asset.uri, token, 'message', isVideo ? 'video/mp4' : 'image/jpeg');
        await sendMessage({
          content_type: isVideo ? 'VIDEO' : 'IMAGE',
          media_url: url,
          content: '',
        });
      }
    } catch (e) {
      Alert.alert(t('common.error'), e?.message || t('common.error'));
    }
  };

  const recordingRef = useRef(null);
  const recordingStartRef = useRef(0);

  const startVoiceRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.permissionRequired'), t('common.micPermission'));
        return;
      }
      await Audio.setAudioModeAsync({ playsInSilentMode: true, staysActiveInBackground: false, shouldDuckAndroid: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recordingRef.current = rec;
      recordingStartRef.current = Date.now();
      setRecording(true);
    } catch (e) {
      Alert.alert(t('common.error'), e?.message || t('common.error'));
    }
  };

  const stopVoiceRecording = async () => {
    const rec = recordingRef.current;
    if (!rec) return;
    setRecording(false);
    recordingRef.current = null;
    const duration = Math.max(1, Math.round((Date.now() - recordingStartRef.current) / 1000));
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (uri) {
        const url = await api.uploadFile(uri, token, 'message', 'audio/m4a', { duration });
        await sendMessage({ content_type: 'VOICE', media_url: url, duration, content: '' });
      }
    } catch { }
  };

  const sendSticker = (emoji) => {
    sendMessage({ content_type: 'TEXT', content: emoji });
    setShowStickers(false);
  };

  const sendGif = async (gifUrl) => {
    if (gifUrl) {
      await sendMessage({ content_type: 'GIF', media_url: gifUrl, content: '' });
      setShowGifPicker(false);
      setGifSearch('');
      return;
    }
    try {
      const res = await api.get(`/messages/gif/search?limit=20`, token);
      const gifs = res?.gifs || [];
      if (gifs.length === 0) {
        Alert.alert(t('common.info'), t('chat.gifLoadFailed'));
        return;
      }
      setGifResults(gifs);
      setShowGifPicker(true);
    } catch {
      Alert.alert(t('common.info'), t('chat.gifLoadFailed'));
    }
  };

  const addReaction = async (msgId, emoji) => {
    try {
      await api.post('/messages/reaction', { message_id: msgId, reaction: emoji }, token);
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, reactions: [...(m.reactions || []), { user_id: user?.id, reaction: emoji }] } : m)));
    } catch { }
    setReactionPicker(null);
  };

  const forwardMessage = (msg) => {
    setReactionPicker(null);
    const preview = msg.content_type === 'TEXT' ? (msg.content || '').slice(0, 40) : (msg.content_type === 'IMAGE' ? `📷 ${t('chat.photo')}` : msg.content_type === 'VOICE' ? `🎤 ${t('chat.voiceMessage')}` : t('chat.media'));
    navigation.navigate('ForwardTargetPicker', { messageId: msg.id, conversationId, messagePreview: preview });
  };

  const deleteMessage = async (msg) => {
    setReactionPicker(null);
    const isOwn = isMe(msg);
    const options = isOwn
      ? [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('chat.deleteForEveryone'), style: 'destructive', onPress: () => doDelete(msg.id, true) },
        { text: t('chat.deleteForMe'), onPress: () => doDelete(msg.id, false) },
      ]
      : [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('chat.deleteForMe'), style: 'destructive', onPress: () => doDelete(msg.id, false) },
      ];
    Alert.alert(t('chat.deleteMessage'), isOwn ? t('chat.deleteOwnQuestion') : t('chat.deleteOtherMessage'), options);
  };

  const doDelete = async (messageId, deleteForEveryone) => {
    try {
      await api.delete(`/messages/${messageId}?delete_for_everyone=${deleteForEveryone}`, token);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch { }
  };

  const editMessage = async (msg, newContent) => {
    if (!newContent?.trim()) return;
    try {
      let contentToSend = newContent.trim();
      let e2ePayload = {};
      if (!isGroup && otherUserE2EKey) {
        try {
          const enc = await encryptFor(otherUserE2EKey, contentToSend);
          const myPk = await getPublicKeyB64();
          if (enc && myPk) {
            contentToSend = enc.content;
            e2ePayload = { e2e_encrypted: true, e2e_nonce: enc.nonce, e2e_sender_public_key: myPk };
          }
        } catch (_) { }
      }
      await api.put(`/messages/${msg.id}`, { content: contentToSend, ...e2ePayload }, token);
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, content: newContent.trim(), edited: true } : m)));
    } catch (e) {
      Alert.alert(t('common.error'), e?.data?.detail || t('common.error'));
    }
    setEditModal(null);
  };

  const isMe = (msg) => msg.sender_id === user?.id || msg.sender?.id === user?.id;
  const displayName = isGroup
    ? (conversation?.group_name || conversation?.name || t('chat.group'))
    : (otherUser?.display_name || otherUser?.username || t('chat.user'));
  const avatar = isGroup
    ? (conversation?.group_avatar || `https://i.pravatar.cc/100?g=${conversation?.id || 'group'}`)
    : (otherUser?.avatar_url || `https://i.pravatar.cc/100?u=${otherUser?.username}`);

  // Load group participants — fallback to localStorage if params were lost during navigation
  const groupParticipants = useMemo(() => {
    if ((conversation?.participants || []).length > 0) return conversation.participants;
    try {
      if (typeof window !== 'undefined') {
        const groups = JSON.parse(localStorage.getItem('_mock_groups') || '[]');
        const found = groups.find(g => g.id === conversationId);
        return found?.participants || [];
      }
    } catch {}
    return [];
  }, [conversation?.participants, conversationId]);

  const renderMessage = ({ item }) => {
    const mine = isMe(item);
    const reactions = item.reactions || [];
    const myReaction = reactions.find((r) => r.user_id === user?.id);

    const senderName = !mine && isGroup
      ? (item.sender?.display_name || item.sender?.username || '')
      : null;
    const senderAvatar = !mine && isGroup
      ? (item.sender?.avatar_url || `https://i.pravatar.cc/80?u=${item.sender_id}`)
      : null;

    const bubbleContent = (
      <>
        {pinnedMessages.includes(item.id) && (
          <View style={styles.pinnedBadge}>
            <Ionicons name="pin" size={12} color="#F59E0B" />
            <Text style={styles.pinnedText}>{t('chat.pinnedMessages')}</Text>
          </View>
        )}
        {item.quoted_message && (
          <View style={styles.quoted}>
            <Text style={styles.quotedText} numberOfLines={2}>{item.quoted_message.content || `📷 ${t('chat.media')}`}</Text>
          </View>
        )}
        {item.content_type === 'IMAGE' && item.media_url && (
          <Image source={{ uri: mediaUri(item.media_url) }} style={styles.mediaMsg} resizeMode="cover" />
        )}
        {item.content_type === 'VIDEO' && item.media_url && (
          <Image source={{ uri: mediaUri(item.media_url) }} style={styles.mediaMsg} resizeMode="cover" />
        )}
        {item.content_type === 'VOICE' && (
          <View style={styles.voiceRow}>
            <Ionicons name="mic" size={20} color={mine ? '#fff' : colors.primary} />
            <Text style={[styles.voiceText, mine && styles.voiceTextMe]}>{item.duration || 0}s</Text>
          </View>
        )}
        {item.content_type === 'GIF' && item.media_url && (
          <Image source={{ uri: item.media_url }} style={styles.gifMsg} resizeMode="cover" />
        )}
        {item.content_type === 'POST' && item.post_id ? (
          <View style={styles.shareCard}>
            <Ionicons name="newspaper" size={24} color={mine ? '#fff' : colors.primary} />
            <Text style={[styles.shareCardText, mine && styles.shareCardTextMe]} numberOfLines={2}>{item.content || t('chat.postShared')}</Text>
          </View>
        ) : item.content_type === 'MUSIC' && item.music_id ? (
          <TouchableOpacity style={styles.shareCard} onPress={() => { }} activeOpacity={0.8}>
            <Ionicons name="musical-notes" size={24} color={mine ? '#fff' : colors.primary} />
            <Text style={[styles.shareCardText, mine && styles.shareCardTextMe]} numberOfLines={2}>{item.content || t('chat.musicShared')}</Text>
          </TouchableOpacity>
        ) : item.content_type === 'PLAYLIST' && item.playlist_id ? (
          <TouchableOpacity style={styles.shareCard} onPress={() => navigation.navigate('PlaylistDetail', { playlistId: item.playlist_id })} activeOpacity={0.8}>
            <Ionicons name="list" size={24} color={mine ? '#fff' : '#8B5CF6'} />
            <Text style={[styles.shareCardText, mine && styles.shareCardTextMe]} numberOfLines={2}>{item.content || t('chat.playlistShared')}</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        ) : item.content_type === 'PROFILE' && item.user_id ? (
          <TouchableOpacity style={styles.shareCard} onPress={() => navigation.navigate('UserProfile', { userId: item.user_id })} activeOpacity={0.8}>
            <Ionicons name="person" size={24} color={mine ? '#fff' : '#8B5CF6'} />
            <Text style={[styles.shareCardText, mine && styles.shareCardTextMe]} numberOfLines={2}>{item.content || t('chat.profileShared')}</Text>
            <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        ) : (item.content_type === 'TEXT' || !item.content_type) && (item.content || decryptedContent[item.id]) ? (
          <Text style={[styles.msgText, mine ? styles.msgTextMe : styles.msgTextOther]}>
            {item.e2e_encrypted && !mine ? (decryptedContent[item.id] ?? `🔒 ${t('chat.encrypting')}`) : item.content}
            {item.edited && <Text style={styles.edited}> {t('chat.edited')}</Text>}
          </Text>
        ) : null}
        <View style={styles.msgFooter}>
          {item.disappears_after_seconds && <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.5)" style={{ marginRight: 4 }} />}
          <Text style={styles.msgTime}>{formatLocaleTime(item.created_at, { hour: '2-digit', minute: '2-digit' })}</Text>
          {mine && isGroup && (item.read_by || []).filter(r => r.user_id !== (user?.id || 'preview-1')).length > 0 ? (
            <View style={styles.groupReadAvatars}>
              {(item.read_by || []).filter(r => r.user_id !== (user?.id || 'preview-1')).slice(0, 3).map(r => (
                <Image key={r.user_id} source={{ uri: `https://i.pravatar.cc/40?u=${r.user_id}` }} style={styles.groupReadAvatar} />
              ))}
            </View>
          ) : mine ? (
            <Ionicons
              name={item.read_by?.length > 1 ? 'checkmark-done' : 'checkmark'}
              size={14}
              color={item.read_by?.length > 1 ? '#60A5FA' : 'rgba(255,255,255,0.6)'}
            />
          ) : null}
        </View>
        {reactions.length > 0 && (
          <View style={styles.reactionsRow}>
            {[...new Set(reactions.map((r) => r.reaction))].map((emoji) => (
              <Text key={emoji} style={styles.reactionEmoji}>{emoji}</Text>
            ))}
          </View>
        )}
      </>
    );

    return (
      <TouchableOpacity
        style={[styles.msgRow, mine ? styles.msgRowMe : styles.msgRowOther]}
        onPress={() => {
          if (showSearch && searchQuery) {
            const idx = messages.findIndex((m) => m.id === item.id);
            if (idx >= 0) {
              setShowSearch(false);
              setSearchQuery('');
              setTimeout(() => flatListRef.current?.scrollToIndex({ index: idx, animated: true }), 100);
            }
          }
        }}
        onLongPress={() => setReactionPicker(item.id)}
        activeOpacity={1}
      >
        {!mine && isGroup ? (
          <View style={styles.groupMsgOtherRow}>
            <Image source={{ uri: senderAvatar }} style={styles.groupMsgAvatar} />
            <View style={{ flex: 1 }}>
              {senderName ? <Text style={styles.groupMsgSenderName}>{senderName}</Text> : null}
              <View style={[styles.bubble, styles.bubbleOther, vanishMode && styles.bubbleOtherVanish]}>
                {bubbleContent}
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleOther, vanishMode && (mine ? styles.bubbleMeVanish : styles.bubbleOtherVanish)]}>
            {bubbleContent}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { flex: 1 }]}>
    <KeyboardAvoidingView
      style={{ flex: 1, paddingTop: insets.top }}
      behavior="padding"
      keyboardVerticalOffset={insets.top}
    >
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => isGroup && setShowGroupInfo(true)}
          activeOpacity={isGroup ? 0.7 : 1}
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
        >
          {isGroup && groupParticipants.length > 0 ? (
            <View style={styles.groupHeaderAvatarWrap}>
              {groupParticipants.slice(0, 2).map((p, i) => (
                <Image key={p.id || i} source={{ uri: p.avatar_url || `https://i.pravatar.cc/80?u=${p.id}` }}
                  style={[styles.groupHeaderAvatarSmall, i === 1 && styles.groupHeaderAvatarSmall2]} />
              ))}
            </View>
          ) : (
            <Image source={{ uri: avatar }} style={styles.headerAvatar} />
          )}
          <View style={styles.headerInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
            {!isGroup && otherUserE2EKey && (
              <Ionicons name="lock-closed" size={14} color="#10B981" />
            )}
          </View>
          {typingUsers.length > 0 ? (
            <Text style={styles.typingText}>{t('chat.typing')}</Text>
          ) : isGroup ? (
            <Text style={styles.lastSeenText} numberOfLines={1}>
              {groupParticipants.map(p => p.display_name || p.username).join(', ') || `${groupParticipants.length + 1} üye`}
            </Text>
          ) : onlineStatus?.is_online ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>{t('chat.onlineNow')}</Text>
            </View>
          ) : onlineStatus?.last_seen ? (
            <Text style={styles.lastSeenText}>{t('chat.lastSeen', { time: formatRelativeTime(onlineStatus.last_seen, t) })}</Text>
          ) : null}
          </View>
        </TouchableOpacity>
        {!isGroup && otherUser?.id && (
          <>
            <TouchableOpacity
              onPress={async () => {
                try {
                  await api.post(`/messages/calls/ring?callee_id=${encodeURIComponent(otherUser.id)}&conversation_id=${encodeURIComponent(conversationId)}&call_type=voice`, {}, token);
                  navigation.navigate('Call', { conversationId, callType: 'voice', otherUserName: displayName });
                } catch (e) {
                  Alert.alert(t('common.error'), e?.data?.detail || e?.message || t('chat.callFailed'));
                }
              }}
              style={styles.headerIconBtn}
            >
              <Ionicons name="call-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                try {
                  await api.post(`/messages/calls/ring?callee_id=${encodeURIComponent(otherUser.id)}&conversation_id=${encodeURIComponent(conversationId)}&call_type=video`, {}, token);
                  navigation.navigate('Call', { conversationId, callType: 'video', otherUserName: displayName });
                } catch (e) {
                  Alert.alert(t('common.error'), e?.data?.detail || e?.message || t('chat.callFailed'));
                }
              }}
              style={styles.headerIconBtn}
            >
              <Ionicons name="videocam-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </>
        )}
        {isGroup && conversationId && (
          <>
            <TouchableOpacity
              onPress={() => navigation.navigate('Call', { conversationId, callType: 'voice', isGroup: true, otherUserName: displayName })}
              style={styles.headerIconBtn}
            >
              <Ionicons name="call-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Call', { conversationId, callType: 'video', isGroup: true, otherUserName: displayName })}
              style={styles.headerIconBtn}
            >
              <Ionicons name="videocam-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity onPress={toggleVanishMode} style={styles.headerIconBtn}>
          <Ionicons
            name={vanishMode ? 'eye-off' : 'eye-off-outline'}
            size={22}
            color={vanishMode ? colors.primary : '#fff'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setShowSearch(!showSearch); setSearchQuery(''); }}
          style={styles.headerIconBtn}
        >
          <Ionicons name="search-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowChatOptions(true)} style={styles.headerMoreBtn}>
          <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {showSearch && (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder={t('chat.searchMessages')}
            placeholderTextColor="#6B7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery ? (
            <Text style={styles.searchCount}>{searchResults.length}</Text>
          ) : null}
          <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(''); }}>
            <Ionicons name="close" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      )}

      {vanishMode && (
        <View style={styles.vanishBanner}>
          <Ionicons name="eye-off" size={16} color="#fff" />
          <Text style={styles.vanishBannerText}>{t('chat.vanishModeOn', { defaultValue: 'Vanish mode is on' })}</Text>
        </View>
      )}

      {showChatOptions && (
        <Modal transparent visible animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowChatOptions(false)}>
            <View style={styles.chatOptionsPanel} onStartShouldSetResponder={() => true}>
              {isGroup && (conversation?.admins || []).includes(user?.id) && (
                <TouchableOpacity
                  style={styles.chatOptionRow}
                  onPress={() => {
                    setShowChatOptions(false);
                    navigation.navigate('GroupSettings', {
                      conversationId,
                      groupName: conversation?.group_name,
                      groupAvatar: conversation?.group_avatar,
                    });
                  }}
                >
                  <Ionicons name="settings-outline" size={22} color="#fff" />
                  <Text style={styles.chatOptionText}>{t('chat.groupSettings')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.chatOptionRow}
                onPress={async () => {
                  if (isMuted) {
                    try {
                      await api.delete(`/messages/conversations/${conversationId}/mute`, token);
                      setIsMuted(false);
                      queryClient.invalidateQueries({ queryKey: ['conversations'] });
                    } catch { }
                    setShowChatOptions(false);
                  } else {
                    setShowChatOptions(false);
                    setShowMutePicker(true);
                  }
                }}
              >
                <Ionicons name={isMuted ? 'notifications' : 'notifications-off'} size={22} color="#fff" />
                <Text style={styles.chatOptionText}>{isMuted ? t('chat.unmuteChat') : t('chat.muteChat')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.chatOptionRow}
                onPress={async () => {
                  try {
                    if (isPinned) {
                      await api.delete(`/messages/conversations/${conversationId}/pin`, token);
                      setIsPinned(false);
                    } else {
                      await api.post(`/messages/conversations/${conversationId}/pin`, {}, token);
                      setIsPinned(true);
                    }
                    queryClient.invalidateQueries({ queryKey: ['conversations'] });
                  } catch { }
                  setShowChatOptions(false);
                }}
              >
                <Ionicons name={isPinned ? 'pin' : 'pin-outline'} size={22} color="#fff" />
                <Text style={styles.chatOptionText}>{isPinned ? t('chat.unpinChat') : t('chat.pinChat')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.chatOptionRow}
                onPress={async () => {
                  try {
                    if (isArchived) {
                      await api.delete(`/messages/conversations/${conversationId}/archive`, token);
                      setIsArchived(false);
                    } else {
                      await api.post(`/messages/conversations/${conversationId}/archive`, {}, token);
                      setIsArchived(true);
                      setShowChatOptions(false);
                      navigation.goBack();
                    }
                    queryClient.invalidateQueries({ queryKey: ['conversations'] });
                    queryClient.invalidateQueries({ queryKey: ['conversationsArchived'] });
                  } catch { }
                  setShowChatOptions(false);
                }}
              >
                <Ionicons name={isArchived ? 'archive' : 'archive-outline'} size={22} color="#fff" />
                <Text style={styles.chatOptionText}>{isArchived ? t('chat.unarchiveChat') : t('chat.archiveChat')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chatOptionRow, styles.chatOptionDanger]}
                onPress={() => {
                  Alert.alert(t('chat.deleteChat'), t('chat.deleteChatConfirm'), [
                    { text: t('common.cancel'), style: 'cancel', onPress: () => setShowChatOptions(false) },
                    {
                      text: t('common.delete'),
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await api.delete(`/messages/conversations/${conversationId}`, token);
                          queryClient.invalidateQueries({ queryKey: ['conversations'] });
                          setShowChatOptions(false);
                          navigation.goBack();
                        } catch { }
                      },
                    },
                  ]);
                }}
              >
                <Ionicons name="trash-outline" size={22} color="#EF4444" />
                <Text style={styles.chatOptionTextDanger}>{t('chat.deleteChat')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.chatOptionRow} onPress={() => setShowChatOptions(false)}>
                <Text style={styles.chatOptionText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={showSearch && searchQuery ? searchResults : messages}
          renderItem={renderMessage}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={[styles.list, { paddingBottom: 16, justifyContent: 'flex-end', flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          ListEmptyComponent={<Text style={styles.empty}>{t('chat.noMessages')}</Text>}
          onContentSizeChange={(_, h) => { if (!refreshing) flatListRef.current?.scrollToEnd({ animated: false }); }}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); try { await loadMessages(); } finally { setRefreshing(false); } }}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {recording && (
        <View style={styles.recordingBar}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>{t('chat.recording')}</Text>
          <TouchableOpacity style={styles.recordingStopBtn} onPress={stopVoiceRecording}>
            <Text style={styles.recordingStopText}>{t('chat.recordingSend')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {replyTo && (
        <View style={styles.replyBar}>
          <Text style={styles.replyLabel}>{t('chat.replyTo', { text: replyTo.content?.slice(0, 30) || t('chat.media') })}...</Text>
          <TouchableOpacity onPress={() => setReplyTo(null)}><Ionicons name="close" size={20} color="#fff" /></TouchableOpacity>
        </View>
      )}

      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity onPress={() => setShowAttach(!showAttach)} style={styles.attachBtn}>
          <Ionicons name="add-circle-outline" size={28} color="#8B5CF6" />
        </TouchableOpacity>
        {showAttach && (
          <View style={styles.attachMenu}>
            <TouchableOpacity style={styles.attachItem} onPress={() => { pickMedia(false); setShowAttach(false); }}>
              <Ionicons name="images-outline" size={24} color="#fff" />
              <Text style={styles.attachLabel}>{t('chat.gallery')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachItem} onPress={() => { pickMedia(true); setShowAttach(false); }}>
              <Ionicons name="camera-outline" size={24} color="#fff" />
              <Text style={styles.attachLabel}>{t('chat.camera')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachItem} onPress={() => { if (!recording) { startVoiceRecording(); } setShowAttach(false); }}>
              <Ionicons name="mic-outline" size={24} color="#fff" />
              <Text style={styles.attachLabel}>{t('chat.voice')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachItem} onPress={() => { sendGif(); setShowAttach(false); }}>
              <Ionicons name="film-outline" size={24} color="#fff" />
              <Text style={styles.attachLabel}>{t('chat.gif')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachItem} onPress={() => { setShowDisappearingPicker(true); setShowAttach(false); }}>
              <Ionicons name="time-outline" size={24} color="#fff" />
              <Text style={styles.attachLabel}>{t('chat.disappearing')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachItem} onPress={() => { setShowStickers(true); setShowAttach(false); }}>
              <Text style={styles.attachEmoji}>😀</Text>
              <Text style={styles.attachLabel}>{t('chat.stickers')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachItem} onPress={() => { navigation.navigate('ShareMusicPicker', { conversationId }); setShowAttach(false); }}>
              <Ionicons name="musical-notes-outline" size={24} color="#fff" />
              <Text style={styles.attachLabel}>{t('chat.music')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachItem} onPress={() => { navigation.navigate('SharePlaylistPicker', { conversationId }); setShowAttach(false); }}>
              <Ionicons name="list-outline" size={24} color="#fff" />
              <Text style={styles.attachLabel}>{t('chat.playlist')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachItem} onPress={() => { navigation.navigate('ShareProfilePicker', { conversationId }); setShowAttach(false); }}>
              <Ionicons name="person-outline" size={24} color="#fff" />
              <Text style={styles.attachLabel}>{t('chat.profileShare')}</Text>
            </TouchableOpacity>
          </View>
        )}
        <TextInput
          style={styles.input}
          placeholder={t('chat.placeholder')}
          placeholderTextColor="#6B7280"
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={2000}
          onSubmitEditing={() => sendMessage()}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={() => sendMessage()}
          disabled={!input.trim() || sending}
        >
          {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={22} color="#fff" />}
        </TouchableOpacity>
      </View>

      {showGifPicker && (
        <Modal transparent visible animationType="slide">
          <View style={[styles.modalOverlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={[styles.stickerPanel, { flex: 1 }]} onStartShouldSetResponder={() => true}>
              <Text style={styles.stickerTitle}>{t('chat.gif')} (GIPHY)</Text>
              <TextInput
                style={styles.gifSearchInput}
                placeholder={t('search.searchPlaceholder')}
                placeholderTextColor="#6B7280"
                value={gifSearch}
                onChangeText={setGifSearch}
                onSubmitEditing={async () => {
                  try {
                    const res = await api.get(`/messages/gif/search?q=${encodeURIComponent(gifSearch)}&limit=20`, token);
                    setGifResults(res?.gifs || []);
                  } catch { setGifResults([]); }
                }}
              />
              <FlatList
                data={gifResults}
                numColumns={2}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.gifGridItem} onPress={() => sendGif(item.url)}>
                    <Image source={{ uri: item.preview || item.url }} style={styles.gifThumb} resizeMode="cover" />
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { setShowGifPicker(false); setGifSearch(''); setGifResults([]); }}>
                <Text style={styles.modalCloseText}>{t('common.close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {showStickers && (
        <Modal transparent visible animationType="slide">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowStickers(false)}>
            <View style={[styles.stickerPanel, { paddingBottom: insets.bottom }]}>
              <Text style={styles.stickerTitle}>{t('chat.stickers')}</Text>
              {STICKER_PACKS.map((pack, i) => (
                <ScrollView key={i} horizontal showsHorizontalScrollIndicator={false} style={styles.stickerRow}>
                  {pack.map((emoji) => (
                    <TouchableOpacity key={emoji} style={styles.stickerBtn} onPress={() => sendSticker(emoji)}>
                      <Text style={styles.stickerEmoji}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {showDisappearingPicker && (
        <Modal transparent visible animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDisappearingPicker(false)}>
            <View style={[styles.chatOptionsPanel, { marginBottom: 0 }]} onStartShouldSetResponder={() => true}>
              <Text style={styles.mutePickerTitle}>{t('chat.disappearingDuration')}</Text>
              {[
                { s: 1, label: t('chat.disappearing1s') },
                { s: 2, label: t('chat.disappearing2s') },
                { s: 5, label: t('chat.disappearing5s') },
                { s: 8, label: t('chat.disappearing8s') },
                { s: 10, label: t('chat.disappearing10s') },
                { s: 15, label: t('chat.disappearing15s') },
                { s: 24, label: t('chat.disappearing24s') },
                { s: 60, label: t('chat.disappearing1min') },
                { s: 3600, label: t('chat.disappearing1h') },
                { s: 86400, label: t('chat.disappearing24h') },
              ].map(({ s, label }) => (
                <TouchableOpacity
                  key={s}
                  style={styles.chatOptionRow}
                  onPress={async () => {
                    try {
                      await sendMessage({ content_type: 'TEXT', content: input.trim() || '🔥', disappears_after_seconds: s });
                      setInput('');
                      setShowDisappearingPicker(false);
                    } catch { }
                  }}
                >
                  <Text style={styles.chatOptionText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {showMutePicker && (
        <Modal transparent visible animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMutePicker(false)}>
            <View style={[styles.chatOptionsPanel, { marginBottom: 0 }]} onStartShouldSetResponder={() => true}>
              <Text style={styles.mutePickerTitle}>{t('chat.muteDuration')}</Text>
              {[
                { d: '1s', label: t('chat.muteDuration1s') },
                { d: '8s', label: t('chat.muteDuration8s') },
                { d: '1h', label: t('chat.muteDuration1h') },
                { d: 'always', label: t('chat.muteDurationAlways') },
              ].map(({ d, label }) => (
                <TouchableOpacity
                  key={d}
                  style={styles.chatOptionRow}
                  onPress={async () => {
                    try {
                      await api.post(`/messages/conversations/${conversationId}/mute?duration=${d}`, {}, token);
                      setIsMuted(true);
                      queryClient.invalidateQueries({ queryKey: ['conversations'] });
                    } catch { }
                    setShowMutePicker(false);
                  }}
                >
                  <Text style={styles.chatOptionText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {reactionPicker && (
        <Modal transparent visible animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setReactionPicker(null)}>
            <View style={styles.reactionPanel}>
              {REACTIONS.map((emoji) => (
                <TouchableOpacity key={emoji} style={styles.reactionBtn} onPress={() => addReaction(reactionPicker, emoji)}>
                  <Text style={styles.reactionBtnText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.reactionBtn} onPress={() => { setReplyTo(messages.find((m) => m.id === reactionPicker)); setReactionPicker(null); }}>
                <Ionicons name="arrow-undo" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.reactionBtn} onPress={() => forwardMessage(messages.find((m) => m.id === reactionPicker))}>
                <Ionicons name="share-outline" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reactionBtn}
                onPress={async () => {
                  const msg = messages.find((m) => m.id === reactionPicker);
                  if (!msg) return;
                  try {
                    await api.post(`/messages/${msg.id}/star`, {}, token);
                    setReactionPicker(null);
                  } catch { }
                }}
              >
                <Ionicons name="star-outline" size={24} color="#FBBF24" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reactionBtn}
                onPress={async () => {
                  const msg = messages.find((m) => m.id === reactionPicker);
                  if (!msg) return;
                  try {
                    const isPinned = pinnedMessages.includes(msg.id);
                    if (isPinned) {
                      await api.delete(`/messages/${msg.id}/pin`, token);
                      setPinnedMessages((prev) => prev.filter((id) => id !== msg.id));
                    } else {
                      await api.post(`/messages/${msg.id}/pin`, {}, token);
                      setPinnedMessages((prev) => [...prev, msg.id]);
                    }
                    setReactionPicker(null);
                  } catch { }
                }}
              >
                <Ionicons name={pinnedMessages.includes(reactionPicker) ? 'pin' : 'pin-outline'} size={24} color="#F59E0B" />
              </TouchableOpacity>
              {messages.find((m) => m.id === reactionPicker) && isMe(messages.find((m) => m.id === reactionPicker)) && (
                <>
                  {canEdit(messages.find((m) => m.id === reactionPicker)) && (
                    <TouchableOpacity style={styles.reactionBtn} onPress={() => { setEditModal(messages.find((m) => m.id === reactionPicker)); setReactionPicker(null); }}>
                      <Ionicons name="pencil" size={24} color="#fff" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.reactionBtn} onPress={() => deleteMessage(messages.find((m) => m.id === reactionPicker))}>
                    <Ionicons name="trash-outline" size={24} color="#ef4444" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {editModal && (
        <Modal transparent visible animationType="fade">
          <View style={styles.editModalOverlay}>
            <View style={styles.editModal}>
              <Text style={styles.editTitle}>{t('chat.editMessage')}</Text>
              <TextInput
                style={styles.editInput}
                defaultValue={editModal.content}
                placeholder={t('chat.textPlaceholder')}
                placeholderTextColor="#6B7280"
                multiline
                onChangeText={(t) => setEditModal((m) => ({ ...m, content: t }))}
              />
              <View style={styles.editActions}>
                <TouchableOpacity onPress={() => setEditModal(null)}><Text style={styles.editCancel}>{t('common.cancel')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => editMessage(editModal, editModal.content)}><Text style={styles.editSave}>{t('common.save')}</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </KeyboardAvoidingView>
    {/* Group Info Sheet */}
    {isGroup && showGroupInfo && (
      <GroupInfoSheet
        displayName={displayName}
        groupParticipants={groupParticipants}
        user={user}
        colors={colors}
        styles={styles}
        conversationId={conversationId}
        onClose={() => setShowGroupInfo(false)}
        onMemberPress={(p) => { setShowGroupInfo(false); navigation.navigate('UserProfile', { username: p.username || p.id }); }}
        onLeave={() => {
          Alert.alert('Gruptan Ayrıl', 'Bu gruptan ayrılmak istiyor musunuz?', [
            { text: 'İptal', style: 'cancel' },
            { text: 'Ayrıl', style: 'destructive', onPress: () => {
              try {
                if (typeof window !== 'undefined') {
                  const groups = JSON.parse(localStorage.getItem('_mock_groups') || '[]');
                  localStorage.setItem('_mock_groups', JSON.stringify(groups.filter(g => g.id !== conversationId)));
                }
              } catch {}
              setShowGroupInfo(false);
              navigation.navigate('Conversations');
            }},
          ]);
        }}
      />
    )}
    </View>
  );
}

/* ─── GroupInfoSheet ─────────────────────────────────────────────────────── */
function GroupInfoSheet({ displayName, groupParticipants, user, colors, styles, conversationId, onClose, onMemberPress, onLeave }) {
  const overlayStyle = Platform.OS === 'web'
    ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' }
    : { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' };

  const sheet = (
    <View style={[styles.groupInfoSheet, { backgroundColor: colors.surface || '#1A0A2E' }]}>
      <View style={styles.groupInfoHandle} />
      <View style={styles.groupInfoHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.groupInfoTitle, { color: colors.text }]}>{displayName}</Text>
          <Text style={[styles.groupInfoSubtitle, { color: colors.textMuted }]}>
            {groupParticipants.length + 1} üye
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
        {/* Current user */}
        <View style={styles.groupMemberRow}>
          <Image source={{ uri: user?.avatar_url || `https://i.pravatar.cc/80?u=${user?.id}` }} style={styles.groupMemberAvatar} />
          <View style={styles.groupMemberInfo}>
            <Text style={[styles.groupMemberName, { color: colors.text }]}>{user?.display_name || user?.username}</Text>
            <Text style={[styles.groupMemberUsername, { color: colors.primary }]}>Sen (Yönetici)</Text>
          </View>
          <View style={[styles.groupAdminBadge, { backgroundColor: colors.primaryGlow || 'rgba(192,132,252,0.2)' }]}>
            <Text style={[styles.groupAdminText, { color: colors.primary }]}>Admin</Text>
          </View>
        </View>

        {/* Other participants */}
        {groupParticipants.length === 0 ? (
          <Text style={[styles.groupMemberUsername, { color: colors.textMuted, paddingHorizontal: 20, paddingVertical: 12 }]}>
            Üye bilgisi yüklenemedi
          </Text>
        ) : (
          groupParticipants.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.groupMemberRow}
              activeOpacity={0.7}
              onPress={() => onMemberPress(p)}
            >
              <Image source={{ uri: p.avatar_url || `https://i.pravatar.cc/80?u=${p.id}` }} style={styles.groupMemberAvatar} />
              <View style={styles.groupMemberInfo}>
                <Text style={[styles.groupMemberName, { color: colors.text }]}>{p.display_name || p.username}</Text>
                {p.username ? <Text style={[styles.groupMemberUsername, { color: colors.textMuted }]}>@{p.username}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textGhost || 'rgba(255,255,255,0.15)'} />
            </TouchableOpacity>
          ))
        )}

        {/* Leave group */}
        <TouchableOpacity style={styles.leaveGroupBtn} onPress={onLeave}>
          <Ionicons name="exit-outline" size={20} color="#F87171" />
          <Text style={styles.leaveGroupText}>Gruptan Ayrıl</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={overlayStyle}>
        {/* backdrop */}
        <Pressable
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {/* sheet sits at the bottom above backdrop */}
        <View style={{ position: 'relative', zIndex: 1 }}>
          {sheet}
        </View>
      </View>
    );
  }
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={overlayStyle}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={{ position: 'relative' }}>
          {sheet}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  backBtn: { padding: 4 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerInfo: { flex: 1, minWidth: 0 },
  headerName: { fontSize: 16, fontWeight: '700', color: colors.text },
  typingText: { fontSize: 12, color: colors.accent, marginTop: 2 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginRight: 4 },
  onlineText: { fontSize: 12, color: colors.success, marginTop: 2 },
  lastSeenText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  headerMoreBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  headerIconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginLeft: 8 },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surface, gap: 8 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  searchCount: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  chatOptionsPanel: { backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 32 },
  chatOptionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  chatOptionText: { fontSize: 16, color: colors.text },
  chatOptionDanger: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8 },
  mutePickerTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 },
  chatOptionTextDanger: { fontSize: 16, color: colors.error },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, flexGrow: 1, justifyContent: 'flex-end' },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 40 },
  groupHeaderAvatarWrap: { width:40, height:40, position:'relative' },
  groupHeaderAvatarSmall: { position:'absolute', width:26, height:26, borderRadius:13, top:0, left:0, borderWidth:1.5, borderColor:'rgba(8,6,15,1)' },
  groupHeaderAvatarSmall2: { top:12, left:12 },
  groupMsgOtherRow: { flexDirection:'row', alignItems:'flex-end', gap:8, maxWidth:'85%' },
  groupMsgAvatar: { width:28, height:28, borderRadius:14, flexShrink:0 },
  groupMsgSenderName: { fontSize:11, fontWeight:'600', color:colors.primary, marginBottom:3, marginLeft:2 },
  groupReadAvatars: { flexDirection:'row', gap:2, marginLeft:4, alignItems:'center' },
  groupReadAvatar: { width:14, height:14, borderRadius:7, borderWidth:1.5, borderColor:'rgba(8,6,15,0.9)' },
  leaveGroupBtn: { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:20, paddingVertical:18, marginTop:4, borderTopWidth:1, borderTopColor:'rgba(255,255,255,0.08)' },
  leaveGroupText: { fontSize:15, color:'#F87171', fontWeight:'700' },
  groupInfoOverlay: { flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,0.65)', zIndex:9999, elevation:10 },
  groupInfoSheet: { borderTopLeftRadius:24, borderTopRightRadius:24, paddingBottom:32, overflow:'hidden' },
  groupInfoHandle: { width:40, height:4, borderRadius:2, backgroundColor:'rgba(255,255,255,0.25)', alignSelf:'center', marginTop:14, marginBottom:4 },
  groupInfoHeader: { flexDirection:'row', alignItems:'flex-start', paddingHorizontal:20, paddingVertical:14, gap:12 },
  groupInfoTitle: { fontSize:18, fontWeight:'800', letterSpacing:-0.3, marginBottom:2 },
  groupInfoSubtitle: { fontSize:13 },
  groupMemberRow: { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingVertical:12, gap:12, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.04)' },
  groupMemberAvatar: { width:46, height:46, borderRadius:23 },
  groupMemberInfo: { flex:1, gap:2 },
  groupMemberName: { fontSize:15, fontWeight:'600' },
  groupMemberUsername: { fontSize:12 },
  groupAdminBadge: { borderRadius:8, paddingHorizontal:8, paddingVertical:3 },
  groupAdminText: { fontSize:11, fontWeight:'700' },
  msgRow: { marginBottom: 8 },
  msgRowMe: { alignItems: 'flex-end' },
  msgRowOther: { alignItems: 'flex-start' },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24 },
  bubbleMe: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleMeVanish: { backgroundColor: colors.accent },
  bubbleOther: { backgroundColor: 'rgba(255,255,255,0.06)', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  bubbleOtherVanish: { backgroundColor: 'rgba(167, 139, 250, 0.12)', borderColor: colors.accent },
  vanishBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8, backgroundColor: colors.primary },
  vanishBannerText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  quoted: { borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 8, marginBottom: 6 },
  quotedText: { fontSize: 12, color: colors.textSecondary },
  pinnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  pinnedText: { fontSize: 11, color: colors.warning },
  mediaMsg: { width: 200, height: 200, borderRadius: 12, marginVertical: 4 },
  gifMsg: { width: 180, height: 120, borderRadius: 12 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voiceText: { fontSize: 14, color: colors.accent },
  voiceTextMe: { color: colors.text },
  msgText: { fontSize: 15 },
  msgTextMe: { color: '#fff' },
  msgTextOther: { color: colors.text },
  shareCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingRight: 8 },
  shareCardText: { flex: 1, fontSize: 14, color: colors.accent },
  shareCardTextMe: { color: colors.text },
  edited: { fontSize: 11, opacity: 0.7 },
  msgFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: 'flex-end' },
  msgTime: { fontSize: 11, color: colors.textMuted },
  reactionsRow: { flexDirection: 'row', marginTop: 4, gap: 4 },
  reactionEmoji: { fontSize: 14 },
  recordingBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.primary, gap: 12 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  recordingText: { color: '#fff', fontSize: 14, flex: 1 },
  recordingStopBtn: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  recordingStopText: { color: colors.primary, fontWeight: '600' },
  replyBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surface, gap: 8 },
  replyLabel: { color: colors.textMuted, fontSize: 13, flex: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 8, gap: 8, backgroundColor: 'rgba(8,6,15,0.98)', borderTopWidth: 1, borderTopColor: 'rgba(192,132,252,0.12)' },
  attachBtn: { padding: 8 },
  attachMenu: { position: 'absolute', bottom: 60, left: 12, right: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12, backgroundColor: colors.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  attachItem: { alignItems: 'center', width: 60 },
  attachLabel: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  attachEmoji: { fontSize: 28 },
  input: { flex: 1, backgroundColor: colors.surface, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, fontSize: 16, color: colors.text, maxHeight: 120, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  stickerPanel: { backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  stickerTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 },
  stickerRow: { marginBottom: 8 },
  stickerBtn: { padding: 12, marginRight: 8 },
  stickerEmoji: { fontSize: 32 },
  gifSearchInput: { backgroundColor: colors.surface, borderRadius: 10, padding: 12, color: colors.text, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  gifGridItem: { flex: 1, aspectRatio: 1, padding: 4 },
  gifThumb: { width: '100%', height: '100%', borderRadius: 8 },
  modalCloseBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  modalCloseText: { color: '#fff', fontWeight: '600' },
  reactionPanel: { position: 'absolute', bottom: 120, alignSelf: 'center', flexDirection: 'row', backgroundColor: colors.card, padding: 8, borderRadius: 24, gap: 4, borderWidth: 1, borderColor: colors.border },
  reactionBtn: { padding: 10 },
  reactionBtnText: { fontSize: 24 },
  editModalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 24 },
  editModal: { backgroundColor: colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: colors.border },
  editTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 16 },
  editInput: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, fontSize: 16, color: colors.text, minHeight: 80, textAlignVertical: 'top', marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  editCancel: { color: colors.textMuted, fontSize: 16 },
  editSave: { color: colors.accent, fontSize: 16, fontWeight: '600' },
});
