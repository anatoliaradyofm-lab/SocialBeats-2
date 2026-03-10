import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Modal,
  TextInput, Switch, Alert, ActivityIndicator, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { usePlayer } from '../contexts/PlayerContext';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

let QRCode = null;
try {
  QRCode = require('react-native-qrcode-svg').default;
} catch { }

export default function PlaylistDetailScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { playTrack } = usePlayer();
  const { playlistId, name } = route.params || {};
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingTrackId, setRemovingTrackId] = useState(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  const loadPlaylist = useCallback(async () => {
    if (!playlistId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/playlists/${playlistId}`, token);
      setPlaylist(data);
      setEditName(data?.name || '');
      setEditIsPublic(!!(data?.is_public ?? true));
    } catch (err) {
      setPlaylist(null);
      setError(err?.data?.detail || err?.message || t('common.error', 'Error'));
    } finally {
      setLoading(false);
    }
  }, [playlistId, token, t]);

  useEffect(() => {
    loadPlaylist();
  }, [loadPlaylist]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadPlaylist);
    return unsubscribe;
  }, [navigation, loadPlaylist]);

  const tracks = playlist?.tracks || [];
  const isOwner = !!(playlist?.owner_id && user?.id && playlist.owner_id === user.id);

  const handleEdit = () => {
    setMenuVisible(false);
    setEditName(playlist?.name || '');
    setEditIsPublic(!!(playlist?.is_public ?? true));
    setEditModalVisible(true);
  };

  const handleEditCover = async () => {
    setMenuVisible(false);
    try {
      const { launchImageLibraryAsync } = await import('expo-image-picker');
      const { MediaTypeOptions } = await import('expo-image-picker');
      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (!result.canceled && result.assets?.[0]?.uri && token) {
        const url = await api.uploadFile(result.assets[0].uri, token, 'playlist_cover', 'image/jpeg');
        await api.put(`/playlists/${playlistId}`, { cover_url: url }, token);
        setPlaylist((p) => p ? { ...p, cover_url: url } : p);
      }
    } catch (err) {
      if (err?.code !== 'ERR_MODULE_NOT_FOUND') {
        Alert.alert(t('common.error', 'Error'), err?.message || t('common.operationFailed', 'Operation failed'));
      } else {
        Alert.alert(t('common.info', 'Info'), t('playlistDetail.editCover', 'Edit Cover') + ' – ' + (t('common.operationFailed', 'Operation failed')));
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!token || !playlistId || saving) return;
    setSaving(true);
    try {
      await api.put(`/playlists/${playlistId}`, { name: editName.trim() || playlist?.name, is_public: editIsPublic }, token);
      setPlaylist((p) => p ? { ...p, name: editName.trim() || p.name, is_public: editIsPublic } : p);
      setEditModalVisible(false);
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err?.data?.detail || err?.message || t('common.operationFailed', 'Operation failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert(
      t('playlistDetail.deletePlaylist', 'Delete Playlist'),
      t('playlistDetail.deleteConfirm', 'Are you sure you want to delete this playlist?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/playlists/${playlistId}`, token);
              navigation.goBack();
            } catch (err) {
              Alert.alert(t('common.error', 'Error'), err?.data?.detail || err?.message || t('common.operationFailed', 'Operation failed'));
            }
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    setMenuVisible(false);
    try {
      const shareUrl = process.env.EXPO_PUBLIC_API_URL
        ? `${process.env.EXPO_PUBLIC_API_URL.replace('/api', '')}/playlist/${playlistId}`
        : `https://social-music-fix.preview.emergentagent.com/playlist/${playlistId}`;
      await Share.share({
        message: `${playlist?.name || t('playlist.playlist', 'Playlist')}: ${shareUrl}`,
        title: t('playlistDetail.shareTitle', 'Share playlist'),
        url: shareUrl,
      });
    } catch { }
  };

  const getShareUrl = () => {
    return process.env.EXPO_PUBLIC_API_URL
      ? `${process.env.EXPO_PUBLIC_API_URL.replace('/api', '')}/playlist/${playlistId}`
      : `https://social-music-fix.preview.emergentagent.com/playlist/${playlistId}`;
  };

  const handleShareQR = () => {
    setMenuVisible(false);
    setQrModalVisible(true);
  };

  const handleAddSongs = () => {
    setMenuVisible(false);
    navigation.navigate('AddSongsToPlaylist', { playlistId, playlistName: playlist?.name });
  };

  const handleMoveTrack = async (index, direction) => {
    if (!token || !playlistId) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= tracks.length) return;
    const newTracks = [...tracks];
    const [moved] = newTracks.splice(index, 1);
    newTracks.splice(newIndex, 0, moved);
    setPlaylist(p => p ? { ...p, tracks: newTracks } : p);
    try {
      const trackIds = newTracks.map(t => t.id || t.song_id);
      await api.put(`/playlists/${playlistId}/reorder`, { track_ids: trackIds }, token);
    } catch {
      setPlaylist(p => p ? { ...p, tracks } : p);
    }
  };

  const handleRemoveTrack = async (track) => {
    const trackId = track.id || track.song_id;
    if (!trackId || !token || removingTrackId) return;
    Alert.alert(
      t('playlistDetail.removeSong', 'Remove from playlist'),
      `${t('playlistDetail.removeSong', 'Remove')} "${track.title || track.name}"?`,
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            setRemovingTrackId(trackId);
            try {
              await api.delete(`/playlists/${playlistId}/tracks/${trackId}`, token);
              setPlaylist((p) => {
                if (!p) return p;
                const newTracks = (p.tracks || []).filter((t) => String(t.id || t.song_id) !== String(trackId));
                return { ...p, tracks: newTracks, track_count: newTracks.length };
              });
            } catch (err) {
              Alert.alert(t('common.error', 'Error'), err?.data?.detail || err?.message);
            } finally {
              setRemovingTrackId(null);
            }
          },
        },
      ]
    );
  };

  const renderTrack = ({ item, index }) => {
    const trackId = item.id || item.song_id;
    const removing = removingTrackId === trackId;
    return (
      <TouchableOpacity
        style={styles.trackRow}
        activeOpacity={0.7}
        onPress={() => playTrack(item)}
        onLongPress={() => isOwner && handleRemoveTrack(item)}
      >
        <Text style={styles.trackNum}>{index + 1}</Text>
        <Image source={{ uri: item.cover_url || item.thumbnail }} style={styles.trackThumb} />
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={1}>{item.title || item.name}</Text>
          <Text style={styles.trackArtist} numberOfLines={1}>{item.artist}</Text>
        </View>
        {isOwner && (
          <View style={styles.reorderBtns}>
            <TouchableOpacity
              onPress={() => handleMoveTrack(index, -1)}
              disabled={index === 0}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-up" size={20} color={index === 0 ? '#374151' : '#9CA3AF'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleMoveTrack(index, 1)}
              disabled={index === tracks.length - 1}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-down" size={20} color={index === tracks.length - 1 ? '#374151' : '#9CA3AF'} />
            </TouchableOpacity>
          </View>
        )}
        {isOwner && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => handleRemoveTrack(item)}
            disabled={removing}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {removing ? (
              <ActivityIndicator size="small" color="#9CA3AF" />
            ) : (
              <Ionicons name="close-circle-outline" size={24} color="#9CA3AF" />
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← {t('playlistDetail.back', 'Back')}</Text>
          </TouchableOpacity>
          <View style={styles.headerActions}>
            {isOwner && (
              <TouchableOpacity style={styles.addBtn} onPress={handleAddSongs}>
                <Ionicons name="add" size={26} color="#8B5CF6" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={22} color="#fff" />
            </TouchableOpacity>
            {isOwner && (
              <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuVisible(true)}>
                <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={styles.title} numberOfLines={1}>{playlist?.name || name || t('playlist.playlist', 'Playlist')}</Text>
        <Text style={styles.subtitle}>
          {tracks.length} {t('search.songs', 'songs')}
          {playlist && ` • ${playlist.is_public ? t('playlistDetail.public', 'Public') : t('playlistDetail.private', 'Private')}`}
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.empty}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadPlaylist}>
            <Text style={styles.retryText}>{t('common.retry', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={tracks}
          renderItem={renderTrack}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
          getItemLayout={(_, index) => ({ length: 73, offset: 73 * index, index })}
          keyExtractor={(item) => item.id || String(Math.random())}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          ListEmptyComponent={
            <Text style={styles.empty}>{t('playlistDetail.emptyPlaylist', 'No songs in this playlist yet')}</Text>
          }
        />
      )}

      {/* Menu Modal */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuSheet}>
            <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
              <Ionicons name="pencil-outline" size={22} color="#fff" />
              <Text style={styles.menuText}>{t('playlistDetail.editName', 'Edit Name')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleEditCover}>
              <Ionicons name="image-outline" size={22} color="#fff" />
              <Text style={styles.menuText}>{t('playlistDetail.editCover', 'Edit Cover')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
              <Ionicons name="share-outline" size={22} color="#fff" />
              <Text style={styles.menuText}>{t('common.share', 'Share')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleShareQR}>
              <Ionicons name="qr-code-outline" size={22} color="#fff" />
              <Text style={styles.menuText}>{t('playlistDetail.shareQR', 'QR Code')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, styles.menuItemDanger]} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
              <Text style={[styles.menuText, styles.menuTextDanger]}>{t('common.delete', 'Delete')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* QR Code Modal */}
      <Modal visible={qrModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setQrModalVisible(false)}
        >
          <View style={styles.qrModal}>
            <Text style={styles.qrTitle}>{t('playlistDetail.shareQR', 'QR Kod ile Paylaş')}</Text>
            <View style={styles.qrContainer}>
              {QRCode ? (
                <QRCode value={getShareUrl()} size={200} color="#fff" backgroundColor="#1F2937" />
              ) : (
                <Text style={styles.qrFallbackText}>{getShareUrl()}</Text>
              )}
            </View>
            <Text style={styles.qrUrl} numberOfLines={2}>{getShareUrl()}</Text>
            <TouchableOpacity style={styles.qrShareBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color="#fff" />
              <Text style={styles.qrShareText}>{t('common.share', 'Paylaş')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.qrCloseBtn} onPress={() => setQrModalVisible(false)}>
              <Text style={styles.qrCloseText}>{t('common.close', 'Kapat')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.editModal, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.editTitle}>{t('common.edit', 'Edit')}</Text>
            <TextInput
              style={styles.editInput}
              placeholder={t('playlistDetail.playlistName', 'Playlist name')}
              placeholderTextColor="#6B7280"
              value={editName}
              onChangeText={setEditName}
              autoCapitalize="none"
            />
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{editIsPublic ? t('playlistDetail.public', 'Public') : t('playlistDetail.private', 'Private')}</Text>
              <Switch
                value={editIsPublic}
                onValueChange={setEditIsPublic}
                trackColor={{ false: '#4B5563', true: '#7C3AED' }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.editCancel} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.editCancelText}>{t('common.cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editSave}
                onPress={handleSaveEdit}
                disabled={saving}
              >
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.editSaveText}>{t('common.save', 'Save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  backBtn: {},
  backText: { color: colors.accent, fontSize: 16 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addBtn: { padding: 4 },
  shareBtn: { padding: 4 },
  menuBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  empty: { color: '#9CA3AF', textAlign: 'center', paddingVertical: 40 },
  retryBtn: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 16 },
  retryText: { color: colors.accent, fontSize: 16 },
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  trackNum: { width: 28, color: '#9CA3AF', fontSize: 14 },
  trackThumb: { width: 48, height: 48, borderRadius: 6, marginRight: 12 },
  trackInfo: { flex: 1 },
  trackTitle: { fontSize: 16, color: colors.text },
  trackArtist: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
  removeBtn: { padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: '#1F2937', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 32 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 },
  menuItemDanger: {},
  menuText: { fontSize: 18, color: colors.text },
  menuTextDanger: { color: colors.error },
  editModal: { backgroundColor: '#1F2937', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24 },
  editTitle: { fontSize: 20, fontWeight: '600', color: colors.text, marginBottom: 16 },
  editInput: { height: 48, backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 16, color: colors.text, fontSize: 16, marginBottom: 16 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  toggleLabel: { fontSize: 16, color: colors.text },
  editActions: { flexDirection: 'row', gap: 12 },
  editCancel: { flex: 1, height: 48, borderRadius: 8, backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' },
  editCancelText: { color: colors.text, fontSize: 16 },
  editSave: { flex: 1, height: 48, borderRadius: 8, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center' },
  editSaveText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  reorderBtns: { flexDirection: 'column', alignItems: 'center', marginRight: 4 },
  qrModal: { backgroundColor: '#1F2937', borderRadius: 16, padding: 24, margin: 24, alignItems: 'center' },
  qrTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 20 },
  qrContainer: { padding: 16, backgroundColor: '#1F2937', borderRadius: 12, marginBottom: 16 },
  qrFallbackText: { color: '#9CA3AF', fontSize: 12, textAlign: 'center' },
  qrUrl: { color: '#9CA3AF', fontSize: 12, textAlign: 'center', marginBottom: 20 },
  qrShareBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#8B5CF6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginBottom: 12 },
  qrShareText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  qrCloseBtn: { padding: 8 },
  qrCloseText: { color: '#9CA3AF', fontSize: 14 },
});
