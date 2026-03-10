import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Image,
  StyleSheet, KeyboardAvoidingView, Platform, Modal, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';
import socketService from '../services/socketService';

const REACTIONS = ['❤️', '🔥', '👏', '😂', '👍', '😮'];

function MessageBubble({ msg, isOwn, colors, onReact, onQuote }) {
  const [showReactions, setShowReactions] = useState(false);
  const isVoice = msg.type === 'voice' || msg.content_type === 'VOICE';
  const isMedia = msg.type === 'media' || msg.media_url;
  const isSticker = msg.type === 'sticker' || msg.content_type === 'STICKER';
  const isDeleted = msg.is_deleted;

  if (isDeleted) {
    return (
      <View style={[styles.bubbleWrap, { alignItems: isOwn ? 'flex-end' : 'flex-start' }]}>
        <View style={[styles.bubble, { backgroundColor: colors.surfaceElevated, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border }]}>
          <Text style={{ color: colors.textMuted, fontSize: 13, fontStyle: 'italic' }}>Bu mesaj silindi</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleWrap, { alignItems: isOwn ? 'flex-end' : 'flex-start' }]}>
      {!isOwn && <Text style={[styles.senderName, { color: BRAND.primaryLight }]}>{msg.sender?.username || ''}</Text>}

      {msg.quoted_message && (
        <View style={[styles.quoteBar, { backgroundColor: 'rgba(124,58,237,0.08)', borderLeftColor: BRAND.primary }]}>
          <Text style={{ color: BRAND.primaryLight, fontSize: 11, fontWeight: '600' }}>{msg.quoted_message.sender?.username || ''}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>{msg.quoted_message.content}</Text>
        </View>
      )}

      <TouchableOpacity style={[styles.bubble, { backgroundColor: isSticker ? 'transparent' : isOwn ? BRAND.primary : colors.surfaceElevated }]}
        onLongPress={() => setShowReactions(true)} activeOpacity={0.8}>
        {isMedia && msg.media_url && <Image source={{ uri: msg.media_url }} style={styles.mediaImg} />}
        {isSticker ? (
          <Text style={{ fontSize: 48 }}>{msg.content}</Text>
        ) : isVoice ? (
          <View style={styles.voiceMsg}>
            <Ionicons name="play" size={16} color={isOwn ? '#FFF' : BRAND.primary} />
            <View style={[styles.voiceWave, { backgroundColor: isOwn ? 'rgba(255,255,255,0.3)' : colors.border }]} />
            <Text style={{ color: isOwn ? 'rgba(255,255,255,0.7)' : colors.textMuted, fontSize: 10 }}>{msg.duration || '0:00'}</Text>
          </View>
        ) : !isMedia ? (
          <Text style={{ color: isOwn ? '#FFF' : colors.text, fontSize: 14, lineHeight: 20 }}>{msg.content || msg.text}</Text>
        ) : null}
        <View style={styles.timeMeta}>
          {msg.is_edited && <Text style={{ color: isOwn ? 'rgba(255,255,255,0.4)' : colors.textMuted, fontSize: 9, marginRight: 4 }}>düzenlendi</Text>}
          <Text style={[styles.time, { color: isOwn ? 'rgba(255,255,255,0.6)' : colors.textMuted }]}>{msg.created_ago || ''}</Text>
        </View>
      </TouchableOpacity>

      {msg.reactions?.length > 0 && (
        <View style={styles.reactionRow}>
          {msg.reactions.map((r, i) => <Text key={i} style={styles.reaction}>{r.emoji || r.reaction || r}</Text>)}
        </View>
      )}

      {showReactions && (
        <View style={[styles.reactPopup, { backgroundColor: colors.surface }]}>
          {REACTIONS.map(e => (
            <TouchableOpacity key={e} onPress={() => { onReact(msg.id || msg._id, e); setShowReactions(false); }}>
              <Text style={{ fontSize: 22 }}>{e}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => { onQuote(msg); setShowReactions(false); }}>
            <Ionicons name="arrow-undo" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function GroupChatScreen({ route, navigation }) {
  const { conversationId } = route.params || {};
  const { user, token } = useAuth();
  const { colors } = useTheme();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [group, setGroup] = useState(null);
  const [showMembers, setShowMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [quotedMsg, setQuotedMsg] = useState(null);
  const [recording, setRecording] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberId, setAddMemberId] = useState('');
  const [disappearingSeconds, setDisappearingSeconds] = useState(0);
  const flatRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const [conv, msgs] = await Promise.all([
        api.get(`/messages/conversations/${conversationId}`, token),
        api.get(`/messages/${conversationId}`, token),
      ]);
      const groupData = conv.conversation || conv;
      setGroup(groupData);
      setEditGroupName(groupData.group_name || groupData.name || '');
      setDisappearingSeconds(groupData.disappearing_seconds || 0);
      setMessages((msgs.messages || msgs || []).reverse());
    } catch {}
  }, [conversationId, token]);

  useEffect(() => {
    fetchData();
    socketService.joinRoom?.(conversationId);
    const handler = (msg) => setMessages(prev => [...prev, msg]);
    socketService.on?.('new_message', handler);
    return () => { socketService.off?.('new_message', handler); socketService.leaveRoom?.(conversationId); };
  }, [conversationId, fetchData]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    const content = text.trim();
    setText('');
    try {
      if (quotedMsg) {
        await api.post('/messages/quote-reply-v2', { message_id: quotedMsg.id || quotedMsg._id, content, conversation_id: conversationId }, token);
      } else {
        await api.post('/messages', { conversation_id: conversationId, content }, token);
      }
      socketService.sendMessage?.(conversationId, content);
      setMessages(prev => [...prev, { id: Date.now().toString(), content, sender_id: user?.id, sender: { username: user?.username }, created_ago: 'şimdi', quoted_message: quotedMsg }]);
      setQuotedMsg(null);
    } catch {}
  };

  const addReaction = async (messageId, emoji) => {
    try { await api.post('/messages/reaction', { message_id: messageId, emoji }, token); } catch {}
  };

  const updateGroupName = async () => {
    if (!editGroupName.trim()) return;
    try {
      await api.put(`/messages/groups/${conversationId}`, { name: editGroupName.trim() }, token);
      setGroup(prev => ({ ...prev, group_name: editGroupName.trim() }));
      Alert.alert('', 'Grup adı güncellendi');
    } catch {}
  };

  const addMember = async () => {
    if (!addMemberId.trim()) return;
    try {
      await api.post(`/messages/groups/${conversationId}/members`, { user_id: addMemberId.trim() }, token);
      setAddMemberId('');
      setShowAddMember(false);
      fetchData();
      Alert.alert('', 'Üye eklendi');
    } catch (e) { Alert.alert('Hata', e?.response?.data?.detail || 'Eklenemedi'); }
  };

  const removeMember = async (userId) => {
    Alert.alert('Üyeyi Kaldır', 'Bu üyeyi gruptan çıkarmak istiyor musunuz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkar', style: 'destructive', onPress: async () => {
        try { await api.delete(`/messages/groups/${conversationId}/members/${userId}`, token); fetchData(); } catch {}
      }},
    ]);
  };

  const setDisappearing = async (seconds) => {
    try {
      await api.post(`/messages/conversations/${conversationId}/disappearing`, { seconds }, token);
      setDisappearingSeconds(seconds);
    } catch {}
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
        try { await api.uploadFile(`/messages/${conversationId}/voice`, uri, token); } catch {
          await api.post(`/messages/${conversationId}/voice`, { voice_url: uri }, token);
        }
        fetchData();
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

  const sendMedia = async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.8 });
      if (!result.canceled && result.assets?.[0]) {
        try { await api.uploadFile(`/messages/${conversationId}/media`, result.assets[0].uri, token); } catch {
          await api.post(`/messages/${conversationId}/media`, { media_url: result.assets[0].uri }, token);
        }
        fetchData();
      }
    } catch {}
  };

  const formatDuration = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const memberCount = group?.participants_info?.length || group?.participants?.length || group?.members?.length || 0;
  const members = group?.participants_info || group?.members || [];

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, alignItems: 'center' }} onPress={() => setShowSettings(true)}>
          <Text style={[styles.headerName, { color: colors.text }]}>{group?.group_name || group?.name || 'Grup'}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>{memberCount} üye</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowMembers(true)}>
          <Ionicons name="people" size={22} color={BRAND.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatRef}
        data={messages}
        renderItem={({ item }) => <MessageBubble msg={item} isOwn={item.sender_id === user?.id} colors={colors} onReact={addReaction} onQuote={setQuotedMsg} />}
        keyExtractor={(item, i) => item.id || `${i}`}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
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
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.recordingDot} />
              <Text style={{ color: '#EF4444', fontWeight: '600' }}>{formatDuration(recordingDuration)}</Text>
            </View>
            <TouchableOpacity onPress={stopRecording} style={styles.sendBtn}><Ionicons name="send" size={18} color="#FFF" /></TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity onPress={sendMedia}><Ionicons name="image" size={24} color={BRAND.accent} /></TouchableOpacity>
            <View style={[styles.inputWrap, { backgroundColor: colors.inputBg }]}>
              <TextInput style={[styles.input, { color: colors.text }]} placeholder="Mesaj yaz..." placeholderTextColor={colors.textMuted} value={text} onChangeText={setText} multiline />
            </View>
            {text.trim() ? (
              <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}><Ionicons name="send" size={18} color="#FFF" /></TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={startRecording}><Ionicons name="mic" size={24} color={BRAND.primary} /></TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* Members Modal */}
      <Modal visible={showMembers} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Grup Üyeleri ({memberCount}/8)</Text>
              <TouchableOpacity onPress={() => setShowMembers(false)}><Ionicons name="close" size={24} color={colors.textMuted} /></TouchableOpacity>
            </View>
            {members.map((m, i) => (
              <View key={i} style={[styles.memberRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.memberAvatar, { backgroundColor: colors.card }]}>
                  {m.avatar_url ? <Image source={{ uri: m.avatar_url }} style={styles.memberAvatar} /> : <Ionicons name="person" size={16} color={BRAND.primaryLight} />}
                </View>
                <Text style={{ color: colors.text, flex: 1 }}>{m.display_name || m.username}</Text>
                {(m.is_admin || m.id === group?.created_by) && <Text style={{ color: BRAND.accent, fontSize: 11 }}>Yönetici</Text>}
                {m.id !== user?.id && (
                  <TouchableOpacity onPress={() => removeMember(m.id)}><Ionicons name="remove-circle-outline" size={20} color="#EF4444" /></TouchableOpacity>
                )}
              </View>
            ))}
            {memberCount < 8 && (
              <TouchableOpacity style={[styles.addMemberBtn, { borderColor: BRAND.primary }]} onPress={() => { setShowMembers(false); setShowAddMember(true); }}>
                <Ionicons name="add" size={18} color={BRAND.primary} />
                <Text style={{ color: BRAND.primary, fontWeight: '600' }}>Üye Ekle</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Member */}
      {showAddMember && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Üye Ekle</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder="Kullanıcı ID" placeholderTextColor={colors.textMuted} value={addMemberId} onChangeText={setAddMemberId} autoFocus />
              <TouchableOpacity style={styles.saveBtn} onPress={addMember}><Text style={{ color: '#FFF', fontWeight: '700' }}>Ekle</Text></TouchableOpacity>
              <TouchableOpacity style={{ alignItems: 'center', marginTop: 12 }} onPress={() => setShowAddMember(false)}>
                <Text style={{ color: colors.textMuted }}>İptal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Group Settings */}
      {showSettings && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Grup Ayarları</Text>
                <TouchableOpacity onPress={() => setShowSettings(false)}><Ionicons name="close" size={22} color={colors.textMuted} /></TouchableOpacity>
              </View>

              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>Grup Adı</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                <TextInput style={[styles.modalInput, { flex: 1, backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, marginBottom: 0 }]}
                  value={editGroupName} onChangeText={setEditGroupName} />
                <TouchableOpacity style={[styles.saveBtn, { paddingHorizontal: 16 }]} onPress={updateGroupName}><Ionicons name="checkmark" size={18} color="#FFF" /></TouchableOpacity>
              </View>

              <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>Kaybolan Mesajlar</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                {[
                  { val: 0, label: 'Kapalı' },
                  { val: 5, label: '5 sn' },
                  { val: 30, label: '30 sn' },
                  { val: 300, label: '5 dk' },
                  { val: 3600, label: '1 saat' },
                  { val: 86400, label: '24 saat' },
                ].map(opt => (
                  <TouchableOpacity key={opt.val} onPress={() => setDisappearing(opt.val)}
                    style={[styles.disappearBtn, { borderColor: disappearingSeconds === opt.val ? BRAND.primary : colors.border }]}>
                    <Text style={{ color: disappearingSeconds === opt.val ? BRAND.primary : colors.text, fontSize: 12 }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 54, paddingHorizontal: 12, paddingBottom: 10, gap: 10, borderBottomWidth: 0.5 },
  headerName: { fontSize: 15, fontWeight: '600' },
  bubbleWrap: { marginBottom: 8, paddingHorizontal: 10 },
  senderName: { fontSize: 11, fontWeight: '600', marginBottom: 2, marginLeft: 4 },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  timeMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, justifyContent: 'flex-end' },
  time: { fontSize: 10 },
  reactionRow: { flexDirection: 'row', marginTop: 2, gap: 4 },
  reaction: { fontSize: 14 },
  reactPopup: { flexDirection: 'row', gap: 8, padding: 8, borderRadius: 24, marginTop: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  quoteBar: { paddingHorizontal: 10, paddingVertical: 6, borderLeftWidth: 3, borderRadius: 8, marginBottom: 4, maxWidth: '78%' },
  quotePreview: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderLeftWidth: 3, marginHorizontal: 10, borderRadius: 8, marginBottom: 4 },
  voiceMsg: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 140 },
  voiceWave: { flex: 1, height: 3, borderRadius: 1.5 },
  mediaImg: { width: 200, height: 200, borderRadius: 12, marginBottom: 6 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 0.5, gap: 8 },
  inputWrap: { flex: 1, borderRadius: 20, paddingHorizontal: 14, maxHeight: 100 },
  input: { fontSize: 14, paddingVertical: 10 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: BRAND.primary, justifyContent: 'center', alignItems: 'center' },
  recordingBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 16 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, gap: 12 },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  addMemberBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderWidth: 1, borderRadius: 14, borderStyle: 'dashed', marginTop: 12 },
  saveBtn: { backgroundColor: BRAND.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  disappearBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
});
