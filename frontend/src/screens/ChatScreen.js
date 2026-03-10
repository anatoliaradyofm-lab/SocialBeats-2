import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Image,
  StyleSheet, KeyboardAvoidingView, Platform, Modal, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import socketService from '../services/socketService';

const REACTIONS = ['❤️', '🔥', '👏', '😂', '👍', '😮'];

function MessageBubble({ msg, isOwn, colors, onReact, onQuote, onStar, onForward, onEdit, onDelete, onTranslate }) {
  const [showActions, setShowActions] = useState(false);
  const [translatedText, setTranslatedText] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [voiceProgress, setVoiceProgress] = useState(0);
  const voiceSoundRef = useRef(null);
  const isVoice = msg.type === 'voice' || msg.content_type === 'VOICE' || msg.voice_url;
  const isMedia = msg.type === 'media' || msg.content_type === 'IMAGE' || msg.content_type === 'VIDEO' || msg.media_url;
  const isSticker = msg.type === 'sticker' || msg.content_type === 'STICKER';
  const isGif = msg.type === 'gif' || msg.content_type === 'GIF';
  const isShare = msg.type === 'share' || (msg.content_type || '').startsWith('SHARE_');
  const isDeleted = msg.is_deleted;

  if (isDeleted) {
    return (
      <View style={[styles.msgWrap, { alignItems: isOwn ? 'flex-end' : 'flex-start' }]}>
        <View style={[styles.bubble, { backgroundColor: isOwn ? 'rgba(124,58,237,0.3)' : colors.surfaceElevated, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border }]}>
          <Text style={{ color: colors.textMuted, fontSize: 13, fontStyle: 'italic' }}>{t('messages.messageDeleted')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.msgWrap, { alignItems: isOwn ? 'flex-end' : 'flex-start' }]}>
      {msg.is_forwarded && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2, paddingHorizontal: 4 }}>
          <Ionicons name="arrow-redo" size={10} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: 10, fontStyle: 'italic' }}>İletildi</Text>
        </View>
      )}

      {msg.quoted_message && (
        <View style={[styles.quoteBar, { backgroundColor: isOwn ? 'rgba(255,255,255,0.1)' : 'rgba(124,58,237,0.08)', borderLeftColor: BRAND.primary }]}>
          <Text style={{ color: BRAND.primaryLight, fontSize: 11, fontWeight: '600' }}>{msg.quoted_message.sender?.username || ''}</Text>
          <Text style={{ color: isOwn ? 'rgba(255,255,255,0.7)' : colors.textMuted, fontSize: 11 }} numberOfLines={1}>{msg.quoted_message.content}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.bubble, { backgroundColor: isSticker ? 'transparent' : isOwn ? BRAND.primary : colors.surfaceElevated }]}
        onLongPress={() => setShowActions(true)} activeOpacity={0.8}>

        {isMedia && msg.media_url && <Image source={{ uri: msg.media_url }} style={styles.mediaImg} />}

        {isGif && msg.media_url && <Image source={{ uri: msg.media_url }} style={styles.mediaImg} />}

        {isShare && msg.share_data && (
          <View style={[styles.shareCard, { backgroundColor: isOwn ? 'rgba(255,255,255,0.1)' : colors.card }]}>
            {msg.share_data.thumbnail ? <Image source={{ uri: msg.share_data.thumbnail }} style={styles.shareThumb} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={{ color: isOwn ? '#FFF' : colors.text, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>{msg.share_data.title}</Text>
              <Text style={{ color: isOwn ? 'rgba(255,255,255,0.7)' : colors.textMuted, fontSize: 11 }} numberOfLines={1}>{msg.share_data.subtitle}</Text>
            </View>
          </View>
        )}

        {isSticker ? (
          <Text style={{ fontSize: 48 }}>{msg.content}</Text>
        ) : isVoice ? (
          <TouchableOpacity activeOpacity={0.7} onPress={async () => {
            const voiceUri = msg.voice_url || msg.media_url || msg.content;
            if (!voiceUri) return;
            try {
              if (voicePlaying && voiceSoundRef.current) {
                await voiceSoundRef.current.stopAsync();
                await voiceSoundRef.current.unloadAsync();
                voiceSoundRef.current = null;
                setVoicePlaying(false);
                setVoiceProgress(0);
                return;
              }
              await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
              const { sound } = await Audio.Sound.createAsync({ uri: voiceUri }, { shouldPlay: true });
              voiceSoundRef.current = sound;
              setVoicePlaying(true);
              sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.durationMillis) {
                  setVoiceProgress(status.positionMillis / status.durationMillis);
                }
                if (status.didJustFinish) {
                  setVoicePlaying(false);
                  setVoiceProgress(0);
                  sound.unloadAsync();
                  voiceSoundRef.current = null;
                }
              });
            } catch { setVoicePlaying(false); }
          }}>
          <View style={styles.voiceMsg}>
              <Ionicons name={voicePlaying ? 'pause' : 'play'} size={16} color={isOwn ? '#FFF' : BRAND.primary} />
              <View style={[styles.voiceWave, { backgroundColor: isOwn ? 'rgba(255,255,255,0.3)' : colors.border }]}>
                <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${voiceProgress * 100}%`, backgroundColor: isOwn ? '#FFF' : BRAND.primary, borderRadius: 3, opacity: 0.5 }} />
              </View>
            <Text style={{ color: isOwn ? 'rgba(255,255,255,0.7)' : colors.textMuted, fontSize: 10 }}>{msg.duration || '0:00'}</Text>
          </View>
          </TouchableOpacity>
        ) : !isMedia && !isGif && !isShare ? (
          <Text style={{ color: isOwn ? '#FFF' : colors.text, fontSize: 14, lineHeight: 20 }}>{msg.content || msg.text}</Text>
          {translating && <Text style={{ color: isOwn ? 'rgba(255,255,255,0.6)' : colors.textMuted, fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>Çevriliyor...</Text>}
          {translatedText && (
            <View style={{ marginTop: 4, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: isOwn ? 'rgba(255,255,255,0.2)' : colors.border }}>
              <Text style={{ color: isOwn ? 'rgba(255,255,255,0.8)' : BRAND.accent, fontSize: 12, fontWeight: '600' }}>Çeviri:</Text>
              <Text style={{ color: isOwn ? 'rgba(255,255,255,0.9)' : colors.text, fontSize: 13, lineHeight: 18 }}>{translatedText}</Text>
            </View>
          )}
        ) : null}

        <View style={styles.msgMeta}>
          {msg.is_edited && <Text style={{ color: isOwn ? 'rgba(255,255,255,0.4)' : colors.textMuted, fontSize: 9, marginRight: 4 }}>düzenlendi</Text>}
          <Text style={{ color: isOwn ? 'rgba(255,255,255,0.5)' : colors.textMuted, fontSize: 10 }}>{msg.created_ago || ''}</Text>
          {isOwn && (
            <Ionicons name={msg.read ? 'checkmark-done' : 'checkmark'} size={14}
              color={msg.read ? '#67E8F9' : 'rgba(255,255,255,0.4)'} style={{ marginLeft: 4 }} />
          )}
          {msg.is_starred && <Ionicons name="star" size={10} color="#F59E0B" style={{ marginLeft: 4 }} />}
        </View>
      </TouchableOpacity>

      {msg.reactions?.length > 0 && (
        <View style={[styles.reactionRow, { alignSelf: isOwn ? 'flex-end' : 'flex-start' }]}>
          {msg.reactions.map((r, i) => <Text key={i} style={styles.reaction}>{r.emoji || r.reaction || r}</Text>)}
        </View>
      )}

      {showActions && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowActions(false)}>
          <TouchableOpacity style={styles.actionOverlay} activeOpacity={1} onPress={() => setShowActions(false)}>
            <View style={[styles.actionSheet, { backgroundColor: colors.surface }]}>
              <View style={styles.reactPopup}>
          {REACTIONS.map(e => (
                  <TouchableOpacity key={e} onPress={() => { onReact(msg.id || msg._id, e); setShowActions(false); }}>
                    <Text style={{ fontSize: 24 }}>{e}</Text>
            </TouchableOpacity>
          ))}
              </View>
              <TouchableOpacity style={[styles.actionBtn, { borderBottomColor: colors.border }]} onPress={() => { onQuote(msg); setShowActions(false); }}>
                <Ionicons name="arrow-undo" size={18} color={colors.text} /><Text style={{ color: colors.text }}>Alıntıla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { borderBottomColor: colors.border }]} onPress={() => { onForward(msg); setShowActions(false); }}>
                <Ionicons name="arrow-redo" size={18} color={colors.text} /><Text style={{ color: colors.text }}>İlet</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { borderBottomColor: colors.border }]} onPress={() => { onStar(msg.id || msg._id); setShowActions(false); }}>
                <Ionicons name="star-outline" size={18} color={colors.text} /><Text style={{ color: colors.text }}>Yıldızla</Text>
              </TouchableOpacity>
              {!isVoice && !isSticker && !isGif && (
                <TouchableOpacity style={[styles.actionBtn, { borderBottomColor: colors.border }]} onPress={async () => {
                  setShowActions(false);
                  setTranslating(true);
                  try {
                    const res = await onTranslate(msg.content || msg.text || '');
                    setTranslatedText(res);
                  } catch {}
                  setTranslating(false);
                }}>
                  <Ionicons name="language" size={18} color={BRAND.accent} /><Text style={{ color: BRAND.accent }}>Çevir</Text>
                </TouchableOpacity>
              )}
              {isOwn && (
                <TouchableOpacity style={[styles.actionBtn, { borderBottomColor: colors.border }]} onPress={() => { onEdit(msg); setShowActions(false); }}>
                  <Ionicons name="pencil" size={18} color={colors.text} /><Text style={{ color: colors.text }}>Düzenle</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.actionBtn, { borderBottomColor: colors.border }]} onPress={() => { onDelete(msg, 'me'); setShowActions(false); }}>
                <Ionicons name="eye-off" size={18} color="#EF4444" /><Text style={{ color: '#EF4444' }}>Benim için sil</Text>
              </TouchableOpacity>
              {isOwn && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => { onDelete(msg, 'all'); setShowActions(false); }}>
                  <Ionicons name="trash" size={18} color="#EF4444" /><Text style={{ color: '#EF4444' }}>Herkes için sil</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

export default function ChatScreen({ route, navigation }) {
  const { conversationId, recipientId, recipientName } = route.params || {};
  const { user, token } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [quotedMsg, setQuotedMsg] = useState(null);
  const flatRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const typingTimerRef = useRef(null);

  const [showAttach, setShowAttach] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [stickerPacks, setStickerPacks] = useState([]);
  const [activeStickerPack, setActiveStickerPack] = useState(0);
  const [showGifSearch, setShowGifSearch] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState([]);
  const [showMusicShare, setShowMusicShare] = useState(false);
  const [musicQuery, setMusicQuery] = useState('');
  const [musicResults, setMusicResults] = useState([]);
  const [editingMsg, setEditingMsg] = useState(null);
  const [editText, setEditText] = useState('');
  const [showForwardPicker, setShowForwardPicker] = useState(false);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [conversations, setConversations] = useState([]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get(`/messages/${conversationId}`, token);
      setMessages((res.messages || res || []).reverse());
    } catch {}
  }, [conversationId, token]);

  useEffect(() => {
    fetchMessages();
    api.get('/messages/stickers/packs', token).then(r => setStickerPacks(r.packs || [])).catch(() => {});
    if (conversationId) {
      socketService.joinRoom?.(conversationId);
      const msgHandler = (msg) => setMessages(prev => [...prev, msg]);
      const typingHandler = (data) => { if (data.user_id !== user?.id) setIsTyping(true); setTimeout(() => setIsTyping(false), 3000); };
      socketService.on?.('new_message', msgHandler);
      socketService.on?.('user_typing', typingHandler);
      return () => {
        socketService.off?.('new_message', msgHandler);
        socketService.off?.('user_typing', typingHandler);
        socketService.leaveRoom?.(conversationId);
      };
    }
  }, [conversationId, fetchMessages, user]);

  const checkSpam = async () => {
    try {
      const r = await api.post('/messages/spam/check', {}, token);
      if (r.is_spam) { Alert.alert('Uyarı', 'Çok fazla mesaj gönderiyorsunuz. Lütfen bekleyin.'); return true; }
    } catch {}
    return false;
  };

  const sendMessage = async () => {
    if (!text.trim()) return;
    if (await checkSpam()) return;
    const content = text.trim();
    setText('');
    const body = { conversation_id: conversationId, content };
    if (quotedMsg) body.quoted_message_id = quotedMsg.id || quotedMsg._id;
    setQuotedMsg(null);
    try {
      if (quotedMsg) {
        await api.post('/messages/quote-reply-v2', { message_id: quotedMsg.id || quotedMsg._id, content, conversation_id: conversationId }, token);
      } else {
      await api.post('/messages', body, token);
      }
      socketService.sendMessage?.(conversationId, content);
      setMessages(prev => [...prev, { id: Date.now().toString(), content, sender_id: user?.id, sender: { username: user?.username }, created_ago: 'şimdi', quoted_message: quotedMsg }]);
    } catch {}
  };

  const handleTextChange = (t) => {
    setText(t);
    if (t.trim()) {
      socketService.sendTyping?.(conversationId);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {}, 3000);
    }
  };

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch {}
  };

  const stopRecording = async () => {
    if (!recording) return;
    clearInterval(recordingTimerRef.current);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setRecordingDuration(0);
      if (uri) {
        try { await api.uploadFile(`/messages/${conversationId}/voice`, uri, token); fetchMessages(); } catch {
          await api.post(`/messages/${conversationId}/voice`, { voice_url: uri, duration: formatDuration(recordingDuration) }, token);
          fetchMessages();
        }
      }
    } catch { setRecording(null); }
  };

  const cancelRecording = async () => {
    if (!recording) return;
    clearInterval(recordingTimerRef.current);
    try { await recording.stopAndUnloadAsync(); } catch {}
    setRecording(null);
    setRecordingDuration(0);
  };

  const sendMedia = async (mediaType) => {
    try {
      const ImagePicker = require('expo-image-picker');
      const opts = mediaType === 'camera'
        ? { quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.All }
        : { mediaTypes: mediaType === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images, quality: 0.8 };
      let result;
      if (mediaType === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return;
        result = await ImagePicker.launchCameraAsync(opts);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(opts);
      }
      if (!result.canceled && result.assets?.[0]) {
        try { await api.uploadFile(`/messages/${conversationId}/media`, result.assets[0].uri, token); } catch {
          await api.post(`/messages/${conversationId}/media`, { media_url: result.assets[0].uri, media_type: result.assets[0].type === 'video' ? 'VIDEO' : 'IMAGE' }, token);
        }
        fetchMessages();
      }
    } catch {}
    setShowAttach(false);
  };

  const addReaction = async (messageId, emoji) => {
    try { await api.post('/messages/reaction', { message_id: messageId, emoji }, token); } catch {}
  };

  const starMessage = async (messageId) => {
    try { await api.post(`/messages/${messageId}/star`, {}, token); } catch {}
  };

  const handleForward = (msg) => {
    setForwardMsg(msg);
    api.get('/messages/conversations', token).then(r => setConversations(r.conversations || r || [])).catch(() => {});
    setShowForwardPicker(true);
  };

  const confirmForward = async (targetConvId) => {
    if (!forwardMsg) return;
    try {
      await api.post('/messages/forward', { message_id: forwardMsg.id || forwardMsg._id, conversation_ids: [targetConvId] }, token);
      Alert.alert('', 'Mesaj iletildi');
    } catch {}
    setShowForwardPicker(false);
    setForwardMsg(null);
  };

  const handleEdit = (msg) => {
    setEditingMsg(msg);
    setEditText(msg.content || msg.text || '');
  };

  const saveEdit = async () => {
    if (!editingMsg || !editText.trim()) return;
    try {
      await api.put(`/messages/${editingMsg.id || editingMsg._id}`, { content: editText.trim() }, token);
      setMessages(prev => prev.map(m => (m.id === editingMsg.id ? { ...m, content: editText.trim(), is_edited: true } : m)));
    } catch (e) { Alert.alert('Hata', e?.response?.data?.detail || 'Düzenlenemedi'); }
    setEditingMsg(null);
  };

  const handleDelete = async (msg, mode) => {
    const id = msg.id || msg._id;
    try {
      if (mode === 'me') {
        await api.post(`/messages/${id}/delete-for-me`, {}, token);
        setMessages(prev => prev.filter(m => m.id !== id && m._id !== id));
      } else {
        await api.post(`/messages/${id}/delete-for-all`, {}, token);
        setMessages(prev => prev.map(m => (m.id === id ? { ...m, is_deleted: true, content: '[deleted]' } : m)));
      }
    } catch {}
  };

  const sendSticker = async (sticker) => {
    try {
      await api.post('/messages/stickers/send', { conversation_id: conversationId, sticker }, token);
      setMessages(prev => [...prev, { id: Date.now().toString(), content: sticker, type: 'sticker', content_type: 'STICKER', sender_id: user?.id, created_ago: 'şimdi' }]);
    } catch {}
    setShowStickers(false);
  };

  const searchGifs = async () => {
    if (!gifQuery.trim()) return;
    try {
      const r = await api.get(`/messages/gif/search?q=${encodeURIComponent(gifQuery)}`, token);
      setGifResults(r.gifs || []);
    } catch {}
  };

  const sendGif = async (gifUrl) => {
    try {
      await api.post('/messages/gif/send', { conversation_id: conversationId, gif_url: gifUrl }, token);
      setMessages(prev => [...prev, { id: Date.now().toString(), content: 'GIF', type: 'gif', media_url: gifUrl, sender_id: user?.id, created_ago: 'şimdi' }]);
    } catch {}
    setShowGifSearch(false);
  };

  const searchMusicForShare = async () => {
    if (!musicQuery.trim()) return;
    try {
      const r = await api.get(`/music/search?q=${encodeURIComponent(musicQuery)}&limit=15`, token);
      setMusicResults(r.results || r.tracks || []);
    } catch {}
  };

  const shareMusic = async (track) => {
    try {
      await api.post('/messages/share', {
        conversation_id: conversationId,
        share_type: 'music',
        item_id: track.id,
        title: track.title,
        subtitle: track.artist,
        thumbnail: track.cover_url || track.thumbnail || '',
      }, token);
      fetchMessages();
    } catch {}
    setShowMusicShare(false);
  };

  const formatDuration = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, marginLeft: 10 }} onPress={() => recipientId && navigation.navigate('UserProfile', { userId: recipientId })}>
          <Text style={[styles.headerName, { color: colors.text }]}>{recipientName || 'Sohbet'}</Text>
          {isTyping && <Text style={{ color: BRAND.accent, fontSize: 11 }}>{t('messages.typing')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={{ padding: 4 }} onPress={() => navigation.navigate('Call', { recipientName, recipientId, callType: 'audio', conversationId })}>
          <Ionicons name="call" size={20} color={BRAND.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={{ padding: 4, marginLeft: 12 }} onPress={() => navigation.navigate('Call', { recipientName, recipientId, callType: 'video', conversationId })}>
          <Ionicons name="videocam" size={22} color={BRAND.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatRef}
        data={messages}
        renderItem={({ item }) => (
          <MessageBubble msg={item} isOwn={item.sender_id === user?.id} colors={colors}
            onReact={addReaction} onQuote={setQuotedMsg} onStar={starMessage}
            onForward={handleForward} onEdit={handleEdit} onDelete={handleDelete}
            onTranslate={async (txt) => {
              const res = await api.post('/messages/translate', { text: txt, target_language: 'tr' }, token);
              return res.translated_text || txt;
            }} />
        )}
        keyExtractor={(item, i) => item.id || item._id || `${i}`}
        contentContainerStyle={{ padding: 10, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatRef.current?.scrollToEnd?.({ animated: false })}
      />

      {quotedMsg && (
        <View style={[styles.quotePreview, { backgroundColor: colors.surfaceElevated, borderLeftColor: BRAND.primary }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: BRAND.primaryLight, fontSize: 11, fontWeight: '600' }}>{quotedMsg.sender?.username || ''}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>{quotedMsg.content}</Text>
          </View>
          <TouchableOpacity onPress={() => setQuotedMsg(null)}><Ionicons name="close" size={18} color={colors.textMuted} /></TouchableOpacity>
        </View>
      )}

      <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {recording ? (
          <View style={styles.recordingBar}>
            <TouchableOpacity onPress={cancelRecording}><Ionicons name="trash" size={22} color="#EF4444" /></TouchableOpacity>
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '600' }}>{formatDuration(recordingDuration)}</Text>
            </View>
            <TouchableOpacity onPress={stopRecording} style={styles.stopRecordBtn}>
              <Ionicons name="send" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity onPress={() => setShowAttach(true)}>
              <Ionicons name="add-circle" size={26} color={BRAND.primary} />
            </TouchableOpacity>
            <View style={[styles.inputWrap, { backgroundColor: colors.inputBg }]}>
              <TextInput style={[styles.input, { color: colors.text }]} placeholder={t('messages.typeMessage')} placeholderTextColor={colors.textMuted}
                value={text} onChangeText={handleTextChange} multiline />
            </View>
            <TouchableOpacity onPress={() => setShowStickers(true)} style={{ padding: 2 }}>
              <Ionicons name="happy" size={24} color={BRAND.accent} />
            </TouchableOpacity>
            {text.trim() ? (
              <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
                <Ionicons name="send" size={18} color="#FFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={startRecording} style={{ padding: 4 }}>
                <Ionicons name="mic" size={24} color={BRAND.primary} />
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Attach Menu */}
      <Modal visible={showAttach} transparent animationType="slide">
        <TouchableOpacity style={styles.actionOverlay} activeOpacity={1} onPress={() => setShowAttach(false)}>
          <View style={[styles.attachSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.attachGrid}>
              {[
                { icon: 'image', label: 'Fotoğraf', color: '#10B981', onPress: () => sendMedia('image') },
                { icon: 'videocam', label: 'Video', color: '#6366F1', onPress: () => sendMedia('video') },
                { icon: 'camera', label: 'Kamera', color: '#F59E0B', onPress: () => sendMedia('camera') },
                { icon: 'musical-note', label: 'Müzik', color: '#EC4899', onPress: () => { setShowAttach(false); setShowMusicShare(true); } },
                { icon: 'image-outline', label: 'GIF', color: '#8B5CF6', onPress: () => { setShowAttach(false); setShowGifSearch(true); } },
              ].map((item, i) => (
                <TouchableOpacity key={i} style={styles.attachItem} onPress={item.onPress}>
                  <View style={[styles.attachIcon, { backgroundColor: item.color }]}>
                    <Ionicons name={item.icon} size={22} color="#FFF" />
                  </View>
                  <Text style={{ color: colors.text, fontSize: 11, marginTop: 6 }}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sticker Picker */}
      <Modal visible={showStickers} transparent animationType="slide">
        <TouchableOpacity style={styles.actionOverlay} activeOpacity={1} onPress={() => setShowStickers(false)}>
          <View style={[styles.attachSheet, { backgroundColor: colors.surface, maxHeight: 340 }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
              {stickerPacks.map((pack, i) => (
                <TouchableOpacity key={pack.id} onPress={() => setActiveStickerPack(i)}
                  style={[styles.packTab, { borderBottomColor: activeStickerPack === i ? BRAND.primary : 'transparent' }]}>
                  <Text style={{ color: activeStickerPack === i ? BRAND.primary : colors.textMuted, fontSize: 12, fontWeight: '600' }}>{pack.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.stickerGrid}>
              {(stickerPacks[activeStickerPack]?.stickers || []).map((s, i) => (
                <TouchableOpacity key={i} onPress={() => sendSticker(s)} style={styles.stickerCell}>
                  <Text style={{ fontSize: 30 }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* GIF Search */}
      <Modal visible={showGifSearch} transparent animationType="slide">
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12, gap: 12 }}>
            <TouchableOpacity onPress={() => setShowGifSearch(false)}><Ionicons name="arrow-back" size={22} color={colors.text} /></TouchableOpacity>
            <TextInput style={[styles.searchInput, { flex: 1, backgroundColor: colors.inputBg, color: colors.text }]}
              placeholder="GIF ara..." placeholderTextColor={colors.textMuted} value={gifQuery} onChangeText={setGifQuery}
              onSubmitEditing={searchGifs} returnKeyType="search" autoFocus />
          </View>
          <FlatList data={gifResults} numColumns={2} keyExtractor={(item, i) => item.id || `${i}`}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.gifCell} onPress={() => sendGif(item.url)}>
                <Image source={{ uri: item.preview || item.url }} style={styles.gifImg} />
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingHorizontal: 8 }}
          />
        </View>
      </Modal>

      {/* Music Share */}
      <Modal visible={showMusicShare} transparent animationType="slide">
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12, gap: 12 }}>
            <TouchableOpacity onPress={() => setShowMusicShare(false)}><Ionicons name="arrow-back" size={22} color={colors.text} /></TouchableOpacity>
            <TextInput style={[styles.searchInput, { flex: 1, backgroundColor: colors.inputBg, color: colors.text }]}
              placeholder="Şarkı ara..." placeholderTextColor={colors.textMuted} value={musicQuery} onChangeText={setMusicQuery}
              onSubmitEditing={searchMusicForShare} returnKeyType="search" autoFocus />
          </View>
          <FlatList data={musicResults} keyExtractor={(item, i) => item.id || `${i}`}
            renderItem={({ item }) => (
              <TouchableOpacity style={[styles.musicRow, { borderBottomColor: colors.border }]} onPress={() => shareMusic(item)}>
                {(item.cover_url || item.thumbnail) ? <Image source={{ uri: item.cover_url || item.thumbnail }} style={styles.musicThumb} /> :
                  <View style={[styles.musicThumb, { backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="musical-note" size={18} color={BRAND.primary} /></View>}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>{item.title}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.artist}</Text>
                </View>
                <Ionicons name="send" size={18} color={BRAND.primary} />
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Edit Message */}
      {editingMsg && (
        <Modal visible transparent animationType="fade">
          <View style={styles.actionOverlay}>
            <View style={[styles.attachSheet, { backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Mesajı Düzenle</Text>
              <TextInput style={[styles.editInput, { backgroundColor: colors.inputBg, color: colors.text }]}
                value={editText} onChangeText={setEditText} multiline autoFocus />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <TouchableOpacity style={{ flex: 1, paddingVertical: 12, alignItems: 'center' }} onPress={() => setEditingMsg(null)}>
                  <Text style={{ color: colors.textMuted }}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: BRAND.primary, borderRadius: 12 }} onPress={saveEdit}>
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Kaydet</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Forward Picker */}
      <Modal visible={showForwardPicker} transparent animationType="slide">
        <View style={styles.actionOverlay}>
          <View style={[styles.attachSheet, { backgroundColor: colors.surface, maxHeight: 400 }]}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Mesajı İlet</Text>
            <FlatList data={conversations} keyExtractor={(item, i) => item.id || `${i}`}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.forwardRow, { borderBottomColor: colors.border }]}
                  onPress={() => confirmForward(item.id || item._id)}>
                  <Ionicons name={item.is_group ? 'people' : 'person'} size={18} color={BRAND.primary} />
                  <Text style={{ color: colors.text, flex: 1 }}>{item.name || item.recipient?.username || item.group_name || 'Sohbet'}</Text>
                  <Ionicons name="send" size={16} color={BRAND.primary} />
                </TouchableOpacity>
              )}
              style={{ maxHeight: 300 }}
            />
            <TouchableOpacity style={{ alignItems: 'center', marginTop: 12 }} onPress={() => setShowForwardPicker(false)}>
              <Text style={{ color: colors.textMuted }}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 54, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 0.5 },
  headerName: { fontSize: 15, fontWeight: '600' },
  msgWrap: { marginVertical: 3, paddingHorizontal: 10 },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  msgMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, justifyContent: 'flex-end' },
  reactionRow: { flexDirection: 'row', marginTop: 2, gap: 3, paddingHorizontal: 6 },
  reaction: { fontSize: 13 },
  quoteBar: { paddingHorizontal: 10, paddingVertical: 6, borderLeftWidth: 3, borderRadius: 8, marginBottom: 4, maxWidth: '78%' },
  quotePreview: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderLeftWidth: 3, marginHorizontal: 10, borderRadius: 8, marginBottom: 4 },
  voiceMsg: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 140 },
  voiceWave: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', position: 'relative' },
  mediaImg: { width: 200, height: 200, borderRadius: 12, marginBottom: 6 },
  shareCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 12, marginBottom: 6 },
  shareThumb: { width: 40, height: 40, borderRadius: 8 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 0.5, gap: 6 },
  inputWrap: { flex: 1, borderRadius: 20, paddingHorizontal: 14, maxHeight: 100 },
  input: { fontSize: 14, paddingVertical: 10 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: BRAND.primary, justifyContent: 'center', alignItems: 'center' },
  recordingBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  recordingIndicator: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },
  stopRecordBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: BRAND.primary, justifyContent: 'center', alignItems: 'center' },
  actionOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  actionSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 40 },
  reactPopup: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.1)', marginBottom: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 0.5 },
  attachSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  attachGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, justifyContent: 'center' },
  attachItem: { alignItems: 'center', width: 60 },
  attachIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  packTab: { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 2 },
  stickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', paddingHorizontal: 8 },
  stickerCell: { padding: 6 },
  searchInput: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  gifCell: { flex: 1, margin: 4, borderRadius: 8, overflow: 'hidden' },
  gifImg: { width: '100%', aspectRatio: 1, backgroundColor: '#333' },
  musicRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12, borderBottomWidth: 0.5 },
  musicThumb: { width: 44, height: 44, borderRadius: 8, overflow: 'hidden' },
  editInput: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 50, textAlignVertical: 'top' },
  forwardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5 },
});
