import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, FlatList,
  StyleSheet, Dimensions, Modal, TextInput, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

const { width: SW } = Dimensions.get('window');

const ROOM_TYPES = [
  { id: 'all', label: 'Tümü' },
  { id: 'party', label: 'Parti' },
  { id: 'chill', label: 'Chill' },
  { id: 'study', label: 'Çalışma' },
  { id: 'live', label: 'Canlı' },
];

function RoomCard({ room, colors, onPress }) {
  const listenerCount = room.listener_count || room.participants?.length || 0;
  return (
    <TouchableOpacity style={[styles.roomCard, { backgroundColor: colors.surfaceElevated }]} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.roomCover, { backgroundColor: colors.card }]}>
        {room.cover_url ? <Image source={{ uri: room.cover_url }} style={styles.roomCover} /> : <Ionicons name="radio" size={32} color={BRAND.primaryLight} />}
        {room.is_live && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>CANLI</Text>
          </View>
        )}
        <View style={styles.listenerBadge}>
          <Ionicons name="headset" size={12} color="#FFF" />
          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600' }}>{listenerCount}</Text>
        </View>
      </View>
      <View style={styles.roomInfo}>
        <Text style={[styles.roomTitle, { color: colors.text }]} numberOfLines={1}>{room.name || 'Oda'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
          <Ionicons name="person" size={11} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>{room.host || 'Ev sahibi'}</Text>
        </View>
        {room.current_track && (
          <View style={styles.roomTrack}>
            <Ionicons name="musical-note" size={11} color={BRAND.accent} />
            <Text style={{ color: BRAND.accent, fontSize: 11 }} numberOfLines={1}>{room.current_track}</Text>
          </View>
        )}
        <View style={styles.roomAvatars}>
          {(room.participants || []).slice(0, 4).map((p, i) => (
            <View key={i} style={[styles.roomParticipant, { backgroundColor: colors.card, marginLeft: i > 0 ? -8 : 0 }]}>
              {p.avatar_url ? <Image source={{ uri: p.avatar_url }} style={styles.roomParticipant} /> : <Ionicons name="person" size={10} color={colors.textMuted} />}
            </View>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MusicRoomsScreen({ navigation }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const [rooms, setRooms] = useState([]);
  const [activeType, setActiveType] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const endpoint = activeType === 'all' ? '/listening-rooms' : `/listening-rooms?type=${activeType}`;
      const res = await api.get(endpoint, token);
      setRooms(res.rooms || res || []);
    } catch { setRooms([]); }
  }, [token, activeType]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);
  const onRefresh = async () => { setRefreshing(true); await fetchRooms(); setRefreshing(false); };

  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      const res = await api.post('/listening-rooms', { name: newRoomName, type: activeType === 'all' ? 'chill' : activeType }, token);
      setModalVisible(false);
      setNewRoomName('');
      if (res.room?.id || res.room?._id) navigation.navigate('ListeningRoom', { roomId: res.room.id || res.room._id });
      fetchRooms();
    } catch {}
  };

  const activeCount = rooms.filter(r => r.is_live || r.listener_count > 0).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Müzik Odaları</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{activeCount} aktif oda</Text>
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={18} color="#FFF" />
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>Oluştur</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
        {ROOM_TYPES.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.typeChip, { backgroundColor: activeType === t.id ? BRAND.primary : colors.surfaceElevated }]}
            onPress={() => setActiveType(t.id)}
          >
            <Text style={{ color: activeType === t.id ? '#FFF' : colors.textSecondary, fontSize: 13, fontWeight: '500' }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={rooms}
        renderItem={({ item }) => <RoomCard room={item} colors={colors} onPress={() => navigation.navigate('ListeningRoom', { roomId: item.id || item._id })} />}
        keyExtractor={(item, i) => item.id || item._id || `${i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name="radio-outline" size={48} color={BRAND.primaryLight} /></View>
            <Text style={{ color: colors.textMuted, marginTop: 16, fontSize: 14 }}>Henüz aktif oda yok</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setModalVisible(true)}>
              <Text style={{ color: '#FFF', fontWeight: '600' }}>İlk Odayı Oluştur</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Yeni Oda</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="Oda adı..."
              placeholderTextColor={colors.textMuted}
              value={newRoomName}
              onChangeText={setNewRoomName}
            />
            <TouchableOpacity style={styles.modalCreateBtn} onPress={createRoom}>
              <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }}>Oluştur</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: BRAND.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22 },

  typeRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  typeChip: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },

  roomCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 14 },
  roomCover: { width: '100%', height: 140, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  liveBadge: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.9)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  liveText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  listenerBadge: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 4 },

  roomInfo: { padding: 14 },
  roomTitle: { fontSize: 16, fontWeight: '600' },
  roomTrack: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  roomAvatars: { flexDirection: 'row', marginTop: 8 },
  roomParticipant: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(124,58,237,0.1)', justifyContent: 'center', alignItems: 'center' },
  emptyBtn: { marginTop: 20, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24, backgroundColor: BRAND.primary },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 16 },
  modalCreateBtn: { backgroundColor: BRAND.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
});
