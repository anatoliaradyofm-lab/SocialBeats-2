import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, TextInput,
  StyleSheet, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';
import socketService from '../services/socketService';

export default function ListeningRoomScreen({ route, navigation }) {
  const { roomId } = route.params;
  const { user, token } = useAuth();
  const { colors } = useTheme();
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  const fetchRoom = useCallback(async () => {
    try {
      const res = await api.get(`/listening-rooms/${roomId}`, token);
      setRoom(res.room || res);
    } catch {}
  }, [roomId, token]);

  useEffect(() => {
    fetchRoom();
    socketService.joinRoom?.(roomId);
    const handler = (msg) => setMessages(prev => [...prev, msg]);
    socketService.on?.('room_message', handler);
    return () => {
      socketService.off?.('room_message', handler);
      socketService.leaveRoom?.(roomId);
    };
  }, [roomId, fetchRoom]);

  const sendMessage = () => {
    if (!text.trim()) return;
    socketService.emit?.('room_message', { roomId, content: text.trim(), user: { username: user?.username } });
    setMessages(prev => [...prev, { id: Date.now().toString(), content: text.trim(), user: { username: user?.username } }]);
    setText('');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.roomName, { color: colors.text }]}>{room?.name || 'Oda'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={styles.liveDot} />
            <Text style={{ color: BRAND.accent, fontSize: 11 }}>Canlı</Text>
          </View>
        </View>
        <TouchableOpacity>
          <Ionicons name="people" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Now Playing */}
      <View style={[styles.npSection, { backgroundColor: colors.surfaceElevated }]}>
        <View style={[styles.npCover, { backgroundColor: colors.card }]}>
          <Ionicons name="musical-notes" size={28} color={BRAND.primaryLight} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{room?.current_track || 'Şarkı bekleniyor...'}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>DJ: {room?.host || 'Ev sahibi'}</Text>
        </View>
        <TouchableOpacity style={[styles.controlBtn, { backgroundColor: BRAND.primary }]}>
          <Ionicons name="play" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Chat */}
      <FlatList
        data={messages}
        renderItem={({ item }) => (
          <View style={styles.chatMsg}>
            <Text style={{ color: BRAND.primaryLight, fontSize: 13, fontWeight: '600' }}>{item.user?.username || 'user'}</Text>
            <Text style={{ color: colors.text, fontSize: 13, marginLeft: 6 }}>{item.content}</Text>
          </View>
        )}
        keyExtractor={(item, i) => item.id || `${i}`}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      />

      <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={[styles.inputWrap, { backgroundColor: colors.inputBg }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Mesaj yaz..."
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
          />
        </View>
        <TouchableOpacity onPress={sendMessage} style={[styles.sendBtn, { opacity: text.trim() ? 1 : 0.4 }]}>
          <Ionicons name="send" size={16} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 10, gap: 12, borderBottomWidth: 0.5 },
  roomName: { fontSize: 16, fontWeight: '700' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BRAND.accent },
  npSection: { flexDirection: 'row', alignItems: 'center', margin: 16, padding: 14, borderRadius: 16, gap: 12 },
  npCover: { width: 56, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  controlBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  chatMsg: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 0.5, gap: 8 },
  inputWrap: { flex: 1, borderRadius: 20, paddingHorizontal: 14, height: 40, justifyContent: 'center' },
  input: { fontSize: 14 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: BRAND.primary, justifyContent: 'center', alignItems: 'center' },
});
