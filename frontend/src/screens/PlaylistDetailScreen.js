import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet,
  RefreshControl, Modal, TextInput, Alert, Share, Dimensions,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { usePlayer } from '../contexts/PlayerContext';
import api from '../services/api';
import ShareSheet from '../components/ShareSheet';

const { width: SW } = Dimensions.get('window');

function formatDuration(sec) {
  if (!sec || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PlaylistDetailScreen({ route, navigation }) {
  const { playlistId } = route.params;
  const { token } = useAuth();
  const { colors } = useTheme();
  const { playTrack, addToQueue } = usePlayer();
  const [playlist, setPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [newCollabId, setNewCollabId] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [showMerge, setShowMerge] = useState(false);
  const [otherPlaylists, setOtherPlaylists] = useState([]);
  const [liked, setLiked] = useState(false);

  const fetchPlaylist = useCallback(async () => {
    try {
      const res = await api.get(`/playlists/${playlistId}`, token);
      const p = res.playlist || res;
      setPlaylist(p);
      setTracks(p.tracks || p.songs || []);
      setEditName(p.name || '');
      setEditDesc(p.description || '');
    } catch {}
  }, [playlistId, token]);

  useEffect(() => { fetchPlaylist(); }, [fetchPlaylist]);
  const onRefresh = async () => { setRefreshing(true); await fetchPlaylist(); setRefreshing(false); };

  const removeTrack = async (trackId) => {
    Alert.alert('Şarkıyı Kaldır', 'Bu şarkıyı listeden çıkarmak istiyor musunuz?', [
      { text: 'İptal' },
      { text: 'Kaldır', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/playlists/${playlistId}/tracks/${trackId}`, token);
          setTracks(prev => prev.filter(t => (t.id || t.song_id) !== trackId));
        } catch {}
      }},
    ]);
  };

  const moveTrack = async (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    const newTracks = [...tracks];
    const [item] = newTracks.splice(fromIdx, 1);
    newTracks.splice(toIdx, 0, item);
    setTracks(newTracks);
    try {
      await api.put(`/playlists/${playlistId}/tracks/reorder`, { from_index: fromIdx, to_index: toIdx }, token);
    } catch {}
  };

  const updatePlaylist = async () => {
    try {
      await api.put(`/playlists/${playlistId}`, { name: editName, description: editDesc }, token);
      setPlaylist(prev => ({ ...prev, name: editName, description: editDesc }));
      setShowEdit(false);
    } catch {}
  };

  const deletePlaylist = () => {
    Alert.alert('Listeyi Sil', 'Bu işlem geri alınamaz. Emin misiniz?', [
      { text: 'İptal' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        try { await api.delete(`/playlists/${playlistId}`, token); navigation.goBack(); } catch {}
      }},
    ]);
  };

  const handleLike = async () => {
    try {
      const res = await api.post(`/playlists/${playlistId}/like`, {}, token);
      setLiked(res.liked);
    } catch {}
  };

  const handleShare = () => setShowShare(true);

  const fetchCollaborators = async () => {
    try {
      const res = await api.get(`/playlists/${playlistId}/collaborators`, token);
      setCollaborators(res.collaborators || []);
    } catch {}
  };

  const addCollaborator = async () => {
    if (!newCollabId.trim()) return;
    try {
      await api.post(`/playlists/${playlistId}/collaborators/${newCollabId.trim()}`, {}, token);
      setNewCollabId('');
      fetchCollaborators();
      Alert.alert('Başarılı', 'Katkıcı eklendi');
    } catch (err) {
      Alert.alert('Hata', err.data?.detail || 'Eklenemedi');
    }
  };

  const removeCollaborator = async (userId) => {
    try {
      await api.delete(`/playlists/${playlistId}/collaborators/${userId}`, token);
      fetchCollaborators();
    } catch {}
  };

  const openMerge = async () => {
    setShowMore(false);
    try {
      const res = await api.get('/playlists', token);
      const all = res.playlists || res || [];
      setOtherPlaylists(all.filter(p => p.id !== playlistId));
      setShowMerge(true);
    } catch {}
  };

  const mergePlaylist = async (sourceId) => {
    try {
      const res = await api.post(`/playlists/${playlistId}/merge`, { source_playlist_id: sourceId }, token);
      Alert.alert('Birleştirildi', `${res.added || 0} yeni şarkı eklendi`);
      setShowMerge(false);
      fetchPlaylist();
    } catch (err) {
      Alert.alert('Hata', err.data?.detail || 'Birleştirilemedi');
    }
  };

  const getCoverImages = () => {
    const thumbs = tracks.slice(0, 4).map(t => t.thumbnail || t.cover_url).filter(Boolean);
    return thumbs;
  };

  const totalDuration = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={handleLike} style={{ padding: 4 }}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? BRAND.pink : colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowMore(true)} style={{ padding: 4, marginLeft: 8 }}>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={tracks}
        ListHeaderComponent={() => (
          <View style={styles.hero}>
            {/* Cover - Auto collage or single image */}
            <View style={[styles.coverWrap, { backgroundColor: colors.surfaceElevated }]}>
              {playlist?.cover_url && !playlist.cover_url.includes('picsum') && !playlist.cover_url.includes('unsplash') ? (
                <Image source={{ uri: playlist.cover_url }} style={styles.coverSingle} />
              ) : getCoverImages().length >= 4 ? (
                <View style={styles.collageGrid}>
                  {getCoverImages().slice(0, 4).map((uri, i) => (
                    <Image key={i} source={{ uri }} style={styles.collageImg} />
                  ))}
                </View>
              ) : getCoverImages().length > 0 ? (
                <Image source={{ uri: getCoverImages()[0] }} style={styles.coverSingle} />
              ) : (
                <Ionicons name="musical-notes" size={56} color={BRAND.primaryLight} />
              )}
            </View>
            <Text style={[styles.plName, { color: colors.text }]}>{playlist?.name || ''}</Text>
            {playlist?.description ? (
              <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: 'center', marginTop: 4 }}>{playlist.description}</Text>
            ) : null}
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>
              {tracks.length} şarkı{totalDuration > 0 ? ` · ${Math.floor(totalDuration / 60)} dk` : ''}
              {playlist?.collaborators?.length > 0 ? ` · ${playlist.collaborators.length} katkıcı` : ''}
            </Text>
            <View style={styles.heroActions}>
              <TouchableOpacity style={styles.shuffleBtn} onPress={() => { if (tracks.length > 0) playTrack(tracks[Math.floor(Math.random() * tracks.length)], tracks); }}>
                <Ionicons name="shuffle" size={18} color="#FFF" />
                <Text style={{ color: '#FFF', fontWeight: '600', marginLeft: 6 }}>Karıştır</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.playAllBtn, { borderColor: BRAND.primary }]} onPress={() => { if (tracks.length > 0) playTrack(tracks[0], tracks); }}>
                <Ionicons name="play" size={18} color={BRAND.primary} />
                <Text style={{ color: BRAND.primary, fontWeight: '600', marginLeft: 6 }}>Çal</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        renderItem={({ item, index }) => (
          <View style={[styles.trackRow, { borderBottomColor: colors.border }]}>
            {/* Reorder buttons */}
            <View style={styles.reorderCol}>
              <TouchableOpacity onPress={() => moveTrack(index, Math.max(0, index - 1))} hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }}>
                <Ionicons name="chevron-up" size={14} color={index === 0 ? 'transparent' : colors.textMuted} />
              </TouchableOpacity>
              <Text style={[styles.trackIndex, { color: colors.textMuted }]}>{index + 1}</Text>
              <TouchableOpacity onPress={() => moveTrack(index, Math.min(tracks.length - 1, index + 1))} hitSlop={{ top: 4, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-down" size={14} color={index === tracks.length - 1 ? 'transparent' : colors.textMuted} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={{ flexDirection: 'row', flex: 1, alignItems: 'center', gap: 10 }} onPress={() => playTrack(item, tracks)}>
              <View style={[styles.trackThumb, { backgroundColor: colors.surfaceElevated }]}>
                {item.thumbnail || item.cover_url ? (
                  <Image source={{ uri: item.thumbnail || item.cover_url }} style={styles.trackThumb} />
                ) : (
                  <Ionicons name="musical-note" size={16} color={BRAND.primaryLight} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>{item.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.artist}{item.duration > 0 ? ` · ${formatDuration(item.duration)}` : ''}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={{ padding: 6 }} onPress={() => addToQueue(item)}>
              <Ionicons name="add-circle-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={{ padding: 6 }} onPress={() => removeTrack(item.id || item.song_id)}>
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}
        keyExtractor={(item, i) => item.id || item.song_id || `${i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="musical-notes-outline" size={44} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 12 }}>Bu listede henüz şarkı yok</Text>
            <TouchableOpacity style={{ marginTop: 12 }} onPress={() => navigation.navigate('Search')}>
              <Text style={{ color: BRAND.primary, fontWeight: '600' }}>Şarkı Ara ve Ekle</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Edit Modal */}
      <Modal visible={showEdit} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Listeyi Düzenle</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]} placeholder="Ad" placeholderTextColor={colors.textMuted} value={editName} onChangeText={setEditName} />
            <TextInput style={[styles.modalInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border, minHeight: 60 }]} placeholder="Açıklama" placeholderTextColor={colors.textMuted} value={editDesc} onChangeText={setEditDesc} multiline />
            <TouchableOpacity style={styles.saveBtn} onPress={updatePlaylist}>
              <Text style={{ color: '#FFF', fontWeight: '700' }}>Kaydet</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', marginTop: 12 }} onPress={() => setShowEdit(false)}>
              <Text style={{ color: colors.textMuted }}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* More Options */}
      <Modal visible={showMore} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            {[
              { icon: 'create-outline', label: 'Düzenle', action: () => { setShowMore(false); setShowEdit(true); } },
              { icon: 'people-outline', label: 'Katkıcı Yönet', action: () => { setShowMore(false); fetchCollaborators(); setShowCollaborators(true); } },
              { icon: 'share-social-outline', label: 'Paylaş', action: () => { setShowMore(false); handleShare(); } },
              { icon: 'git-merge-outline', label: 'Başka Listeyle Birleştir', action: openMerge },
              { icon: 'copy-outline', label: 'Listeyi Kopyala', action: async () => { setShowMore(false); try { await api.post(`/playlists/${playlistId}/copy`, {}, token); Alert.alert('Kopyalandı', 'Liste kütüphanenize eklendi'); } catch {} } },
              { icon: 'search-outline', label: 'Şarkı Ekle', action: () => { setShowMore(false); navigation.navigate('Search'); } },
              { icon: 'trash-outline', label: 'Sil', action: () => { setShowMore(false); deletePlaylist(); }, danger: true },
            ].map((item, i) => (
              <TouchableOpacity key={i} style={[styles.modalRow, { borderBottomColor: colors.border }]} onPress={item.action}>
                <Ionicons name={item.icon} size={20} color={item.danger ? '#EF4444' : colors.text} />
                <Text style={{ color: item.danger ? '#EF4444' : colors.text, fontSize: 15, marginLeft: 12 }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={{ alignItems: 'center', paddingTop: 16 }} onPress={() => setShowMore(false)}>
              <Text style={{ color: colors.textMuted }}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Collaborators Modal */}
      <Modal visible={showCollaborators} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Katkıcılar</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <TextInput
                style={[styles.modalInput, { flex: 1, marginBottom: 0, backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                placeholder="Kullanıcı ID'si"
                placeholderTextColor={colors.textMuted}
                value={newCollabId}
                onChangeText={setNewCollabId}
              />
              <TouchableOpacity style={{ backgroundColor: BRAND.primary, paddingHorizontal: 16, borderRadius: 14, justifyContent: 'center' }} onPress={addCollaborator}>
                <Ionicons name="add" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
            {collaborators.map((c, i) => (
              <View key={i} style={[styles.collabRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.collabAvatar, { backgroundColor: colors.card }]}>
                  {c.avatar_url ? <Image source={{ uri: c.avatar_url }} style={styles.collabAvatar} /> : <Ionicons name="person" size={16} color={colors.textMuted} />}
                </View>
                <Text style={{ color: colors.text, flex: 1 }}>{c.username || c.user_id}</Text>
                <TouchableOpacity onPress={() => removeCollaborator(c.user_id)}>
                  <Ionicons name="close" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
            {collaborators.length === 0 && <Text style={{ color: colors.textMuted, textAlign: 'center', padding: 20 }}>Henüz katkıcı yok</Text>}
            <TouchableOpacity style={{ alignItems: 'center', paddingTop: 16 }} onPress={() => setShowCollaborators(false)}>
              <Text style={{ color: colors.textMuted }}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ShareSheet
        visible={showShare}
        onClose={() => setShowShare(false)}
        type="playlist"
        id={playlistId}
        title={playlist?.name}
        description={`${playlist?.track_count || playlist?.tracks?.length || 0} şarkı`}
        imageUrl={playlist?.cover_url}
      />

      {/* Merge Modal */}
      <Modal visible={showMerge} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, maxHeight: '60%' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Listeyle Birleştir</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 12 }}>Seçtiğiniz listenin şarkıları bu listeye eklenecek</Text>
            <ScrollView>
              {otherPlaylists.map(pl => (
                <TouchableOpacity key={pl.id} style={[styles.mergeRow, { borderBottomColor: colors.border }]} onPress={() => mergePlaylist(pl.id)}>
                  <Ionicons name="musical-notes" size={18} color={BRAND.primaryLight} style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 14 }}>{pl.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>{pl.track_count || pl.tracks?.length || 0} şarkı</Text>
                  </View>
                  <Ionicons name="git-merge" size={16} color={BRAND.accent} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={{ alignItems: 'center', paddingTop: 16 }} onPress={() => setShowMerge(false)}>
              <Text style={{ color: colors.textMuted }}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 8 },
  hero: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 32 },
  coverWrap: { width: 180, height: 180, borderRadius: 20, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', shadowColor: BRAND.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  coverSingle: { width: 180, height: 180 },
  collageGrid: { width: 180, height: 180, flexDirection: 'row', flexWrap: 'wrap' },
  collageImg: { width: 90, height: 90 },
  plName: { fontSize: 22, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  heroActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  shuffleBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  playAllBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, gap: 6 },
  reorderCol: { width: 28, alignItems: 'center', justifyContent: 'center' },
  trackIndex: { fontSize: 11, textAlign: 'center' },
  trackThumb: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  empty: { alignItems: 'center', paddingTop: 60 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 10 },
  saveBtn: { backgroundColor: BRAND.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5 },
  collabRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, gap: 10 },
  collabAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  shareLinkBox: { width: '100%', padding: 14, borderRadius: 12 },
  shareAction: { alignItems: 'center' },
  shareIconWrap: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  mergeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5 },
});
