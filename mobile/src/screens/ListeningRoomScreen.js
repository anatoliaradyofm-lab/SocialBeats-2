/**
 * ListeningRoomScreen - Music listening room where users can listen together in real-time
 * Two views: Room list (browse public rooms) and Inside room (when joined)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Alert,
  Share,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { usePlayer } from '../contexts/PlayerContext';
import api from '../services/api';
import socketService from '../services/socketService';
import { useTheme } from '../contexts/ThemeContext';
import { TrackPlayer, State, usePlaybackState } from '../lib/trackPlayer';

const ROOM_REFRESH_INTERVAL = 5000;

function getAvatarUrl(user) {
  if (!user?.avatar_url) return null;
  return user.avatar_url.startsWith('http') ? user.avatar_url : null;
}

function RoomCard({ item, onPress, t }) {
  const host = item.host || item.host_user;
  const hostName = host?.display_name || host?.username || t('listeningRoom.unknownHost', { defaultValue: 'Unknown' });
  const track = item.current_track || item.track;
  const trackTitle = track?.title || track?.name || t('listeningRoom.noTrack', { defaultValue: 'No track' });
  const participantCount = item.participants_count ?? item.participants?.length ?? 0;

  return (
    <TouchableOpacity style={styles.roomCard} onPress={() => onPress(item)} activeOpacity={0.8}>
      <View style={styles.roomCardLeft}>
        <View style={styles.roomCardIcon}>
          <Ionicons name="musical-notes" size={28} color="#8B5CF6" />
        </View>
        <View style={styles.roomCardInfo}>
          <Text style={styles.roomCardName} numberOfLines={1}>{item.name || t('listeningRoom.unnamedRoom', { defaultValue: 'Unnamed Room' })}</Text>
          <Text style={styles.roomCardHost}>{t('listeningRoom.hostBy', { defaultValue: 'Host: {{host}}', host: hostName })}</Text>
          <Text style={styles.roomCardTrack} numberOfLines={1}>{trackTitle}</Text>
        </View>
      </View>
      <View style={styles.roomCardRight}>
        <View style={styles.participantBadge}>
          <Ionicons name="people" size={14} color="#8B5CF6" />
          <Text style={styles.participantCount}>{participantCount}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#6B7280" />
      </View>
    </TouchableOpacity>
  );
}

export default function ListeningRoomScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { currentTrack, isPlaying, playTrack, togglePlay, playNext, playPrevious } = usePlayer();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joinedRoom, setJoinedRoom] = useState(null);
  const [roomDetail, setRoomDetail] = useState(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createIsPublic, setCreateIsPublic] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [sendingChat, setSendingChat] = useState(false);
  const [queueTrackId, setQueueTrackId] = useState('');
  const [addQueueLoading, setAddQueueLoading] = useState(false);

  const loadRooms = useCallback(async () => {
    try {
      const res = await api.get('/listening-rooms', token);
      setRooms(Array.isArray(res) ? res : res?.rooms || []);
    } catch {
      setRooms([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  const loadRoomDetail = useCallback(async (roomId) => {
    if (!roomId || !token) return;
    try {
      const res = await api.get(`/listening-rooms/${roomId}`, token);
      setRoomDetail(res);
      return res;
    } catch {
      return null;
    }
  }, [token]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    if (!joinedRoom?.id) return;
    const refreshRoom = async () => {
      const updated = await loadRoomDetail(joinedRoom.id);
      if (updated) setRoomDetail(updated);
    };
    refreshRoom();
    const interval = setInterval(refreshRoom, ROOM_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [joinedRoom?.id, loadRoomDetail]);

  const handleRefresh = () => {
    setRefreshing(true);
    if (joinedRoom) {
      loadRoomDetail(joinedRoom.id).then((r) => r && setRoomDetail(r));
    } else {
      loadRooms();
    }
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleJoinRoom = async (room) => {
    if (!token) {
      Alert.alert(
        t('listeningRoom.signInRequired', { defaultValue: 'Sign In Required' }),
        t('listeningRoom.signInToJoin', { defaultValue: 'Please sign in to join a listening room.' }),
        [{ text: t('common.ok', { defaultValue: 'OK' }) }]
      );
      return;
    }
    try {
      await api.post(`/listening-rooms/${room.id}/join`, {}, token);
      const detail = await loadRoomDetail(room.id);
      setJoinedRoom({ ...room, ...detail });
      setRoomDetail(detail || room);

      // Socket join
      if (socketService.socket) {
        socketService.socket.emit('join_listening_room', { room_id: room.id });
      }
    } catch (err) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        err?.data?.message || err?.message || t('listeningRoom.joinFailed', { defaultValue: 'Could not join room.' }),
        [{ text: t('common.ok', { defaultValue: 'OK' }) }]
      );
    }
  };

  const handleLeaveRoom = async () => {
    if (!joinedRoom?.id || !token) return;
    try {
      await api.post(`/listening-rooms/${joinedRoom.id}/leave`, {}, token);
      if (socketService.socket) {
        socketService.socket.emit('leave_listening_room', { room_id: joinedRoom.id });
      }
      setJoinedRoom(null);
      setRoomDetail(null);
      TrackPlayer.pause();
      loadRooms();
    } catch {
      setJoinedRoom(null);
      setRoomDetail(null);
    }
  };

  const handleCreateRoom = async () => {
    const name = createName.trim();
    if (!name) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), t('listeningRoom.roomNameRequired', { defaultValue: 'Please enter a room name.' }));
      return;
    }
    if (!token) {
      Alert.alert(t('listeningRoom.signInRequired', { defaultValue: 'Sign In Required' }), t('listeningRoom.signInToCreate', { defaultValue: 'Please sign in to create a room.' }));
      return;
    }
    setCreateLoading(true);
    try {
      const res = await api.post('/listening-rooms', { name, is_public: createIsPublic }, token);
      const room = res?.room || res;
      setCreateModalVisible(false);
      setCreateName('');
      setCreateIsPublic(true);
      if (room?.id) {
        const detail = await loadRoomDetail(room.id);
        setJoinedRoom({ ...room, ...detail });
        setRoomDetail(detail || room);
        if (socketService.socket) {
          socketService.socket.emit('join_listening_room', { room_id: room.id });
        }
      }
    } catch (err) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), err?.data?.message || err?.message || t('listeningRoom.createFailed', { defaultValue: 'Could not create room.' }));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleChangeTrack = async (trackId) => {
    if (!joinedRoom?.id || !token) return;
    const isHost = roomDetail?.host?.id === user?.id || roomDetail?.host_user?.id === user?.id;
    if (!isHost) return;
    try {
      await api.post(`/listening-rooms/${joinedRoom.id}/track`, { track_id: trackId }, token);
      await loadRoomDetail(joinedRoom.id);
    } catch { }
  };

  const handleAddToQueue = async () => {
    const id = queueTrackId.trim();
    if (!id || !joinedRoom?.id || !token) return;
    setAddQueueLoading(true);
    try {
      await api.post(`/listening-rooms/${joinedRoom.id}/queue`, { track_id: id }, token);
      setQueueTrackId('');
      await loadRoomDetail(joinedRoom.id);
    } catch {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), t('listeningRoom.addQueueFailed', { defaultValue: 'Could not add to queue.' }));
    } finally {
      setAddQueueLoading(false);
    }
  };

  const handleShareRoom = async () => {
    if (!joinedRoom) return;
    const base = process.env.EXPO_PUBLIC_API_URL || '';
    const url = `${base.replace(/\/api\/?$/, '')}/rooms/${joinedRoom.id}`;
    const message = t('listeningRoom.shareMessage', { defaultValue: 'Join my listening room {{name}}!', name: joinedRoom.name || 'Listening Room' }) + ' ' + url;
    try {
      await Share.share({
        message,
        url,
        title: t('listeningRoom.shareTitle', { defaultValue: 'Listening Room' }),
      });
    } catch { }
  };

  const participants = roomDetail?.participants || [];
  const queue = roomDetail?.queue || [];
  const currentRoomTrack = roomDetail?.current_track || roomDetail?.track;
  const isHost = roomDetail && (roomDetail.host?.id === user?.id || roomDetail.host_user?.id === user?.id || roomDetail.host_id === user?.id);

  // Reaction Animation
  const [reactionAnim] = useState(new Animated.Value(0));
  const [currentReaction, setCurrentReaction] = useState(null);

  useEffect(() => {
    if (!joinedRoom?.id || !socketService.socket) return;

    const onChat = (data) => {
      setChatMessages(prev => [...prev, { sender: data.user_id === user?.id ? 'You' : data.user_id, text: data.message }]);
    };
    const onReaction = (data) => {
      setCurrentReaction(data.reaction);
      Animated.sequence([
        Animated.spring(reactionAnim, { toValue: 1, useNativeDriver: true, friction: 3 }),
        Animated.timing(reactionAnim, { toValue: 0, duration: 500, delay: 1000, useNativeDriver: true })
      ]).start(() => setCurrentReaction(null));
    };
    const onSync = async (data) => {
      if (isHost) return;
      // Sync playback
      if (data.current_track) {
        const track = data.current_track;
        const state = await TrackPlayer.getState();
        const currentT = await TrackPlayer.getActiveTrack();
        if (currentT?.id !== track.id) {
          await TrackPlayer.reset();
          await TrackPlayer.add({ id: track.id, url: track.url, title: track.title, artist: track.artist, artwork: track.cover });
        }
        if (data.is_playing && state !== State.Playing) {
          await TrackPlayer.play();
        } else if (!data.is_playing && state === State.Playing) {
          await TrackPlayer.pause();
        }
      }
    };
    const onQueue = () => { loadRoomDetail(joinedRoom.id).then(r => r && setRoomDetail(r)); };

    socketService.socket.on('room_chat_received', onChat);
    socketService.socket.on('room_reaction_received', onReaction);
    socketService.socket.on('room_sync', onSync);
    socketService.socket.on('room_queue_updated', onQueue);
    socketService.socket.on('room_participant_joined', onQueue);
    socketService.socket.on('room_participant_left', onQueue);

    return () => {
      socketService.socket.off('room_chat_received', onChat);
      socketService.socket.off('room_reaction_received', onReaction);
      socketService.socket.off('room_sync', onSync);
      socketService.socket.off('room_queue_updated', onQueue);
      socketService.socket.off('room_participant_joined', onQueue);
      socketService.socket.off('room_participant_left', onQueue);
    };
  }, [joinedRoom?.id, user?.id, isHost]);

  const toggleRoomPlay = async () => {
    if (!isHost) return;
    const state = await TrackPlayer.getState();
    const isPlayingNow = state === State.Playing;
    if (isPlayingNow) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
    if (currentRoomTrack && socketService.socket) {
      api.post(`/listening-rooms/${joinedRoom.id}/sync`, { current_track: currentRoomTrack, is_playing: !isPlayingNow }, token).catch(() => { });
    }
    togglePlay();
  };

  const sendReaction = (reaction) => {
    if (socketService.socket) {
      socketService.socket.emit('send_room_reaction', { room_id: joinedRoom.id, reaction });
    }
  };

  const sendChatMsg = () => {
    if (chatInput.trim() && socketService.socket) {
      socketService.socket.emit('send_room_chat', { room_id: joinedRoom.id, message: chatInput.trim() });
      setChatInput('');
    }
  };

  if (joinedRoom) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleLeaveRoom} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{roomDetail?.name || joinedRoom.name || t('listeningRoom.unnamedRoom', { defaultValue: 'Unnamed Room' })}</Text>
            <Text style={styles.headerSub}>
              {participants.length} {t('listeningRoom.participants', { defaultValue: 'participants' })}
            </Text>
          </View>
          <TouchableOpacity onPress={handleShareRoom} style={styles.shareBtn}>
            <Ionicons name="share-outline" size={22} color="#8B5CF6" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.roomContent}
          contentContainerStyle={[styles.roomContentInner, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#8B5CF6" />}
          showsVerticalScrollIndicator={false}
        >
          {/* Current track */}
          <View style={styles.trackSection}>
            <View style={styles.trackArt}>
              {(currentRoomTrack?.thumbnail || currentRoomTrack?.cover_url || currentRoomTrack?.cover) ? (
                <Image source={{ uri: currentRoomTrack.thumbnail || currentRoomTrack.cover_url || currentRoomTrack.cover }} style={styles.trackArtImg} />
              ) : (
                <View style={styles.trackArtPlaceholder}>
                  <Ionicons name="musical-notes" size={48} color="#6B7280" />
                </View>
              )}
              {currentReaction && (
                <Animated.View style={[styles.reactionOverlay, { opacity: reactionAnim, transform: [{ scale: reactionAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.5] }) }] }]}>
                  <Text style={{ fontSize: 60 }}>{currentReaction}</Text>
                </Animated.View>
              )}
            </View>
            <View style={styles.waveformPlaceholder}>
              <View style={[styles.waveBar, { height: 12 }]} />
              <View style={[styles.waveBar, { height: 24 }]} />
              <View style={[styles.waveBar, { height: 16 }]} />
              <View style={[styles.waveBar, { height: 28 }]} />
              <View style={[styles.waveBar, { height: 20 }]} />
              <View style={[styles.waveBar, { height: 24 }]} />
              <View style={[styles.waveBar, { height: 14 }]} />
              <View style={[styles.waveBar, { height: 18 }]} />
            </View>
            <Text style={styles.trackTitle} numberOfLines={1}>{currentRoomTrack?.title || currentRoomTrack?.name || t('listeningRoom.noTrack', { defaultValue: 'No track playing' })}</Text>
            <Text style={styles.trackArtist} numberOfLines={1}>{currentRoomTrack?.artist || ''}</Text>
            <View style={styles.trackControls}>
              <TouchableOpacity onPress={() => sendReaction('🔥')} style={styles.controlBtn}>
                <Text style={{ fontSize: 24 }}>🔥</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => sendReaction('❤️')} style={styles.controlBtn}>
                <Text style={{ fontSize: 24 }}>❤️</Text>
              </TouchableOpacity>

              {isHost && (
                <TouchableOpacity onPress={toggleRoomPlay} style={styles.playBtn}>
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={36} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Participants */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('listeningRoom.participants', { defaultValue: 'Participants' })}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.participantsRow}>
              {participants.map((p, i) => (
                <View key={p.id || i} style={styles.avatarWrap}>
                  {(getAvatarUrl(p) || p.avatar_url) ? (
                    <Image source={{ uri: getAvatarUrl(p) || p.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarLetter}>{(p.display_name || p.username || '?')[0].toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={styles.avatarName} numberOfLines={1}>{p.display_name || p.username || '?'}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Host: add track to queue */}
          {isHost && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('listeningRoom.addToQueue', { defaultValue: 'Add to queue' })}</Text>
              <View style={styles.addQueueRow}>
                <TextInput
                  style={styles.queueInput}
                  placeholder={t('listeningRoom.trackIdPlaceholder', { defaultValue: 'Track ID' })}
                  placeholderTextColor="#6B7280"
                  value={queueTrackId}
                  onChangeText={setQueueTrackId}
                />
                <TouchableOpacity style={styles.addQueueBtn} onPress={handleAddToQueue} disabled={addQueueLoading}>
                  {addQueueLoading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={20} color="#fff" />}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Queue */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('listeningRoom.queue', { defaultValue: 'Upcoming' })} ({queue.length})</Text>
            {queue.length === 0 ? (
              <Text style={styles.emptyQueue}>{t('listeningRoom.queueEmpty', { defaultValue: 'Queue is empty' })}</Text>
            ) : (
              queue.map((item, idx) => (
                <View key={item.id || idx} style={styles.queueItem}>
                  <Text style={styles.queueIndex}>{idx + 1}</Text>
                  <Text style={styles.queueTitle} numberOfLines={1}>{item.title || item.name || 'Track'}</Text>
                  <Text style={styles.queueArtist} numberOfLines={1}>{item.artist || ''}</Text>
                </View>
              ))
            )}
          </View>

          {/* Mini chat */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('listeningRoom.chat', { defaultValue: 'Chat' })}</Text>
            <View style={styles.chatBox}>
              {chatMessages.length === 0 ? (
                <Text style={styles.chatEmpty}>{t('listeningRoom.noMessages', { defaultValue: 'No messages yet' })}</Text>
              ) : (
                chatMessages.map((msg, i) => (
                  <View key={i} style={styles.chatMsg}>
                    <Text style={styles.chatSender}>{msg.sender}: </Text>
                    <Text style={styles.chatText}>{msg.text}</Text>
                  </View>
                ))
              )}
            </View>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={styles.chatInputRow}>
                <TextInput
                  style={styles.chatInput}
                  placeholder={t('listeningRoom.typeMessage', { defaultValue: 'Type a message...' })}
                  placeholderTextColor="#6B7280"
                  value={chatInput}
                  onChangeText={setChatInput}
                  onSubmitEditing={sendChatMsg}
                />
                <TouchableOpacity onPress={sendChatMsg} style={styles.sendBtn}>
                  <Ionicons name="send" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </ScrollView>

        <View style={styles.leaveBar}>
          <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveRoom}>
            <Ionicons name="exit-outline" size={20} color="#EF4444" />
            <Text style={styles.leaveBtnText}>{t('listeningRoom.leave', { defaultValue: 'Leave room' })}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('listeningRoom.title', { defaultValue: 'Listening Rooms' })}</Text>
        <TouchableOpacity onPress={() => setCreateModalVisible(true)} style={styles.createBtn}>
          <Ionicons name="add" size={24} color="#8B5CF6" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      ) : (
        <FlatList
          data={rooms}
          renderItem={({ item }) => <RoomCard item={item} onPress={handleJoinRoom} t={t} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#8B5CF6" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="headset-outline" size={64} color="#555" />
              <Text style={styles.emptyText}>{t('listeningRoom.noRooms', { defaultValue: 'No rooms yet' })}</Text>
              <Text style={styles.emptySub}>{t('listeningRoom.createFirst', { defaultValue: 'Create a room to get started' })}</Text>
              <TouchableOpacity style={styles.createRoomBtn} onPress={() => setCreateModalVisible(true)}>
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.createRoomText}>{t('listeningRoom.createRoom', { defaultValue: 'Create room' })}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <Modal visible={createModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCreateModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('listeningRoom.createRoom', { defaultValue: 'Create room' })}</Text>
            <TextInput
              style={styles.createInput}
              placeholder={t('listeningRoom.roomNamePlaceholder', { defaultValue: 'Room name' })}
              placeholderTextColor="#6B7280"
              value={createName}
              onChangeText={setCreateName}
            />
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{t('listeningRoom.publicRoom', { defaultValue: 'Public room' })}</Text>
              <TouchableOpacity
                style={[styles.toggle, createIsPublic && styles.toggleOn]}
                onPress={() => setCreateIsPublic(!createIsPublic)}
              >
                <View style={[styles.toggleThumb, createIsPublic && styles.toggleThumbOn]} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setCreateModalVisible(false)}>
                <Text style={styles.modalCancelText}>{t('common.cancel', { defaultValue: 'Cancel' })}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCreate} onPress={handleCreateRoom} disabled={createLoading}>
                {createLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalCreateText}>{t('listeningRoom.create', { defaultValue: 'Create' })}</Text>}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937', gap: 12 },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
  createBtn: { padding: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  roomCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1F2937', borderRadius: 16, padding: 16, marginBottom: 12 },
  roomCardLeft: { flexDirection: 'row', flex: 1, gap: 14 },
  roomCardIcon: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#1E1B4B', alignItems: 'center', justifyContent: 'center' },
  roomCardInfo: { flex: 1 },
  roomCardName: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 2 },
  roomCardHost: { fontSize: 13, color: colors.accent, marginBottom: 2 },
  roomCardTrack: { fontSize: 12, color: '#6B7280' },
  roomCardRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  participantBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  participantCount: { fontSize: 14, color: colors.accent, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#9CA3AF', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center', maxWidth: 260 },
  createRoomBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#8B5CF6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginTop: 24 },
  createRoomText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#1F2937', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 20 },
  createInput: { backgroundColor: '#111827', borderRadius: 12, padding: 14, fontSize: 16, color: colors.text, marginBottom: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  toggleLabel: { fontSize: 16, color: '#E5E7EB' },
  toggle: { width: 52, height: 28, borderRadius: 14, backgroundColor: '#374151', padding: 4 },
  toggleOn: { backgroundColor: '#8B5CF6' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleThumbOn: { marginLeft: 24 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#374151', alignItems: 'center' },
  modalCancelText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  modalCreate: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#8B5CF6', alignItems: 'center' },
  modalCreateText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  headerSub: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  shareBtn: { padding: 4 },
  roomContent: { flex: 1 },
  roomContentInner: { padding: 16 },
  trackSection: { alignItems: 'center', marginBottom: 32 },
  trackArt: { width: 200, height: 200, borderRadius: 16, marginBottom: 16, overflow: 'hidden' },
  trackArtImg: { width: '100%', height: '100%' },
  trackArtPlaceholder: { width: '100%', height: '100%', backgroundColor: '#1E1B4B', alignItems: 'center', justifyContent: 'center' },
  reactionOverlay: { position: 'absolute', top: '50%', left: '50%', marginTop: -30, marginLeft: -30, zIndex: 10 },
  waveformPlaceholder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 32, marginBottom: 12 },
  waveBar: { width: 4, borderRadius: 2, backgroundColor: '#8B5CF6' },
  trackTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  trackArtist: { fontSize: 14, color: '#9CA3AF', marginBottom: 16 },
  trackControls: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  controlBtn: { padding: 8 },
  playBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#9CA3AF', marginBottom: 12, textTransform: 'uppercase' },
  participantsRow: { marginHorizontal: -16 },
  avatarWrap: { alignItems: 'center', marginRight: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 18, fontWeight: '700', color: colors.text },
  avatarName: { fontSize: 11, color: '#9CA3AF', marginTop: 4, maxWidth: 60 },
  addQueueRow: { flexDirection: 'row', gap: 8 },
  queueInput: { flex: 1, backgroundColor: '#111827', borderRadius: 12, padding: 12, fontSize: 14, color: colors.text },
  addQueueBtn: { backgroundColor: '#8B5CF6', width: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emptyQueue: { fontSize: 14, color: '#6B7280', fontStyle: 'italic' },
  queueItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#374151' },
  queueIndex: { fontSize: 14, color: '#6B7280', width: 24 },
  queueTitle: { flex: 1, fontSize: 14, color: colors.text },
  queueArtist: { fontSize: 12, color: '#6B7280', flex: 1 },
  chatBox: { minHeight: 80, maxHeight: 120, backgroundColor: '#111827', borderRadius: 12, padding: 12, marginBottom: 8 },
  chatEmpty: { fontSize: 14, color: '#6B7280', fontStyle: 'italic' },
  chatMsg: { flexDirection: 'row', marginBottom: 4 },
  chatSender: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  chatText: { fontSize: 13, color: '#E5E7EB' },
  chatInputRow: { flexDirection: 'row', gap: 8 },
  chatInput: { flex: 1, backgroundColor: '#111827', borderRadius: 12, padding: 12, fontSize: 14, color: colors.text },
  sendBtn: { backgroundColor: '#8B5CF6', width: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  leaveBar: { padding: 16, borderTopWidth: 1, borderTopColor: '#1F2937' },
  leaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  leaveBtnText: { fontSize: 16, color: colors.error, fontWeight: '600' },
});
