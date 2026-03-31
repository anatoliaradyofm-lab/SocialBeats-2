import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Modal,
  TextInput, Switch, ActivityIndicator, Share, Platform, Animated, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { usePlayer } from '../contexts/PlayerContext';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import {
  removePlaylistFromCache,
  getStoredTracks,
  getStoredTrackCount,
  enqueuePendingTrack,
  flushPendingTracks,
  removeStoredTrack,
} from '../lib/playlistStore';

// Re-export for backwards compatibility (other files import these from here)
export { enqueuePendingTrack, removeStoredTrack, getStoredTrackCount } from '../lib/playlistStore';

let QRCode = null;
try {
  QRCode = require('react-native-qrcode-svg').default;
} catch { }

/* ── Custom confirm sheet — replaces Alert.alert ─────────────────────────── */
function ConfirmSheet({ visible, title, message, confirmText, danger, onConfirm, onCancel }) {
  const { colors } = useTheme();
  const slideY = useRef(new Animated.Value(300)).current;
  useEffect(() => {
    Animated.spring(slideY, { toValue: visible ? 0 : 300, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
  }, [visible]);
  if (!visible) return null;
  const sheet = {
    backgroundColor: '#130A24', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 32, borderTopWidth: 1, borderColor: 'rgba(192,132,252,0.12)',
  };
  if (Platform.OS === 'web') {
    return (
      <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }} pointerEvents="box-none">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }} onPress={onCancel}>
          <Pressable style={sheet} onPress={e => e.stopPropagation()}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(192,132,252,0.25)', alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#F8F8F8', marginBottom: 8 }}>{title}</Text>
            {message ? <Text style={{ fontSize: 14, color: 'rgba(248,248,248,0.5)', marginBottom: 24 }}>{message}</Text> : <View style={{ marginBottom: 24 }} />}
            <TouchableOpacity onPress={onConfirm} style={{ height: 52, borderRadius: 16, backgroundColor: danger ? 'rgba(239,68,68,0.15)' : colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: danger ? 1 : 0, borderColor: danger ? 'rgba(239,68,68,0.4)' : undefined }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: danger ? '#F87171' : '#FFF' }}>{confirmText || 'Onayla'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onCancel} style={{ height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: 'rgba(248,248,248,0.5)' }}>İptal</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </View>
    );
  }
  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }} onPress={onCancel}>
        <Animated.View style={[sheet, { transform: [{ translateY: slideY }] }]}>
          <Pressable onPress={e => e.stopPropagation()}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(192,132,252,0.25)', alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#F8F8F8', marginBottom: 8 }}>{title}</Text>
            {message ? <Text style={{ fontSize: 14, color: 'rgba(248,248,248,0.5)', marginBottom: 24 }}>{message}</Text> : <View style={{ marginBottom: 24 }} />}
            <TouchableOpacity onPress={onConfirm} style={{ height: 52, borderRadius: 16, backgroundColor: danger ? 'rgba(239,68,68,0.15)' : colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: danger ? 1 : 0, borderColor: danger ? 'rgba(239,68,68,0.4)' : undefined }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: danger ? '#F87171' : '#FFF' }}>{confirmText || 'Onayla'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onCancel} style={{ height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: 'rgba(248,248,248,0.5)' }}>İptal</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export default function PlaylistDetailScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { playTrack, setQueue } = usePlayer();
  const { playlistId, name, playlist: initPlaylist } = route.params || {};
  // Seed from navigation params; merge any pending tracks enqueued by AddSongsToPlaylistScreen
  const [playlist, setPlaylist] = useState(() => {
    if (!playlistId) return initPlaylist || null;
    // Flush pending (just-added via AddToPlaylistModal)
    const pending = flushPendingTracks(playlistId);
    // Merge: stored (persisted) + pending (deduplicated)
    const stored = getStoredTracks(playlistId);
    const allExtra = [...stored];
    pending.forEach(t => {
      if (!allExtra.some(s => String(s.id || s.song_id) === String(t.id || t.song_id)))
        allExtra.push(t);
    });
    const base = initPlaylist || { id: playlistId, name: name || '', track_count: 0 };
    const apiTracks = base.tracks || [];
    const merged = [...apiTracks];
    allExtra.forEach(t => {
      if (!merged.some(s => String(s.id || s.song_id) === String(t.id || t.song_id)))
        merged.push(t);
    });
    if (merged.length === 0) return base;
    return { ...base, tracks: merged, track_count: merged.length };
  });
  const [loading, setLoading] = useState(!initPlaylist);
  const [error, setError] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingTrackId, setRemovingTrackId] = useState(null);
  const [confirmSheet, setConfirmSheet] = useState(null); // { title, message, confirmText, danger, onConfirm }

  const loadPlaylist = useCallback(async () => {
    if (!playlistId) return;
    // Don't re-fetch if we already have data from navigation params
    if (initPlaylist) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/playlists/${playlistId}`, token);
      const hasData = data && (data.id || data.name || Array.isArray(data.tracks));
      if (hasData) {
        // Preserve any locally-added tracks
        setPlaylist(prev => {
          const localTracks = prev?.tracks || [];
          const merged = [...(data.tracks || [])];
          localTracks.forEach(lt => {
            if (!merged.some(t => String(t.id || t.song_id) === String(lt.id || lt.song_id)))
              merged.push(lt);
          });
          return { ...data, tracks: merged, track_count: merged.length };
        });
        setEditName(data?.name || '');
        setEditIsPublic(!!(data?.is_public ?? true));
      }
    } catch (err) {
      setError(err?.data?.detail || err?.message || t('common.error', 'Error'));
    } finally {
      setLoading(false);
    }
  }, [playlistId, token, t, initPlaylist]);

  useEffect(() => { loadPlaylist(); }, [loadPlaylist]);


  const tracks = playlist?.tracks || [];
  // If playlist has no owner_id set (e.g. freshly created or mock), treat current user as owner
  const isOwner = !!(playlist && (!playlist.owner_id || (user?.id && String(playlist.owner_id) === String(user.id))));

  const handleEdit = () => {
    setMenuVisible(false);
    setEditName(playlist?.name || '');
    setEditIsPublic(!!(playlist?.is_public ?? true));
    setEditModalVisible(true);
  };


  const handleSaveEdit = async () => {
    if (!token || !playlistId || saving) return;
    setSaving(true);
    try {
      await api.put(`/playlists/${playlistId}`, { name: editName.trim() || playlist?.name, is_public: editIsPublic }, token);
      setPlaylist((p) => p ? { ...p, name: editName.trim() || p.name, is_public: editIsPublic } : p);
      setEditModalVisible(false);
    } catch (err) {
      setConfirmSheet({ title: 'Hata', message: err?.data?.detail || err?.message || 'İşlem başarısız', confirmText: 'Tamam', danger: false, onConfirm: () => setConfirmSheet(null) });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    setMenuVisible(false);
    setConfirmSheet({
      title: 'Oynatma Listesini Sil',
      message: 'Bu oynatma listesi kalıcı olarak silinecek. Bu işlem geri alınamaz.',
      confirmText: 'Sil',
      danger: true,
      onConfirm: async () => {
        setConfirmSheet(null);
        removePlaylistFromCache(playlistId);
        navigation.goBack();
        try { await api.delete(`/playlists/${playlistId}`, token); } catch {}
      },
    });
  };

  const handleShare = async () => {
    setMenuVisible(false);
    const shareUrl = getShareUrl();
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: playlist?.name || 'Playlist', url: shareUrl });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setConfirmSheet({ title: 'Kopyalandı', message: 'Bağlantı panoya kopyalandı!', confirmText: 'Tamam', danger: false, onConfirm: () => setConfirmSheet(null) });
      } else {
        await Share.share({ message: `${playlist?.name || 'Playlist'}: ${shareUrl}`, url: shareUrl });
      }
    } catch { }
  };

  const getShareUrl = () => {
    return process.env.EXPO_PUBLIC_API_URL
      ? `${process.env.EXPO_PUBLIC_API_URL.replace('/api', '')}/playlist/${playlistId}`
      : `https://social-music-fix.preview.emergentagent.com/playlist/${playlistId}`;
  };


  const handlePlayAll = () => {
    setMenuVisible(false);
    if (tracks.length > 0) setQueue(tracks, 0);
  };

  const handleShufflePlay = () => {
    if (tracks.length === 0) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    setQueue(shuffled, 0);
  };

  const handleAddSongs = () => {
    setMenuVisible(false);
    navigation.navigate('AddSongsToPlaylist', {
      playlistId,
      playlistName: playlist?.name || name,
    });
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
      await api.put(`/playlists/${playlistId}/tracks/reorder`, { track_ids: trackIds }, token);
    } catch {
      setPlaylist(p => p ? { ...p, tracks } : p);
    }
  };

  const handleRemoveTrack = (track) => {
    const trackId = track.id || track.song_id;
    if (!trackId || removingTrackId) return;
    setConfirmSheet({
      title: 'Şarkıyı Kaldır',
      message: `"${track.title || track.name}" listeden çıkarılsın mı?`,
      confirmText: 'Kaldır',
      danger: true,
      onConfirm: async () => {
        setConfirmSheet(null);
        setRemovingTrackId(trackId);
        removeStoredTrack(playlistId, trackId);
        setPlaylist((p) => {
          if (!p) return p;
          const newTracks = (p.tracks || []).filter((t) => String(t.id || t.song_id) !== String(trackId));
          return { ...p, tracks: newTracks, track_count: newTracks.length };
        });
        try { await api.delete(`/playlists/${playlistId}/tracks/${trackId}`, token); } catch {}
        setRemovingTrackId(null);
      },
    });
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
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
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
        {tracks.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity style={styles.playAllBtn} onPress={() => setQueue(tracks, 0)}>
              <Ionicons name="play-circle" size={20} color="#fff" />
              <Text style={styles.playAllText}>Tümünü Oynat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.playAllBtn, { backgroundColor: 'rgba(192,132,252,0.15)', borderWidth: 1, borderColor: 'rgba(192,132,252,0.3)' }]} onPress={handleShufflePlay}>
              <Ionicons name="shuffle" size={20} color="#C084FC" />
              <Text style={[styles.playAllText, { color: '#C084FC' }]}>Karışık Çal</Text>
            </TouchableOpacity>
          </View>
        )}
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
      {Platform.OS === 'web' ? (
        menuVisible && (
          <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 68, zIndex: 9999 }} pointerEvents="box-none">
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
              <View style={styles.menuSheet}>
                <TouchableOpacity style={styles.menuItem} onPress={handlePlayAll}>
                  <Ionicons name="play-circle-outline" size={22} color="#C084FC" />
                  <Text style={styles.menuText}>Tümünü Oynat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
                  <Ionicons name="pencil-outline" size={22} color="#fff" />
                  <Text style={styles.menuText}>Yeniden Adlandır</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
                  <Ionicons name="share-outline" size={22} color="#fff" />
                  <Text style={styles.menuText}>Paylaş</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.menuItem, styles.menuItemDanger]} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={22} color="#EF4444" />
                  <Text style={[styles.menuText, styles.menuTextDanger]}>Sil</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        )
      ) : (
        <Modal visible={menuVisible} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
            <View style={styles.menuSheet}>
              <TouchableOpacity style={styles.menuItem} onPress={handlePlayAll}>
                <Ionicons name="play-circle-outline" size={22} color="#C084FC" />
                <Text style={styles.menuText}>Tümünü Oynat</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={handleEdit}>
                <Ionicons name="pencil-outline" size={22} color="#fff" />
                <Text style={styles.menuText}>Yeniden Adlandır</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
                <Ionicons name="share-outline" size={22} color="#fff" />
                <Text style={styles.menuText}>Paylaş</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, styles.menuItemDanger]} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={22} color="#EF4444" />
                <Text style={[styles.menuText, styles.menuTextDanger]}>Sil</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Confirm Sheet */}
      <ConfirmSheet
        visible={!!confirmSheet}
        title={confirmSheet?.title || ''}
        message={confirmSheet?.message}
        confirmText={confirmSheet?.confirmText}
        danger={confirmSheet?.danger}
        onConfirm={confirmSheet?.onConfirm || (() => setConfirmSheet(null))}
        onCancel={() => setConfirmSheet(null)}
      />

      {/* Edit Modal */}
      {Platform.OS === 'web' ? (
        editModalVisible && (
          <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 68, zIndex: 9999 }} pointerEvents="box-none">
            <View style={styles.modalOverlay}>
              <View style={[styles.editModal, { paddingBottom: insets.bottom + 24 }]}>
                <Text style={styles.editTitle}>Yeniden Adlandır</Text>
                <TextInput
                  style={styles.editInput}
                  placeholder="Oynatma listesi adı..."
                  placeholderTextColor="#6B7280"
                  value={editName}
                  onChangeText={setEditName}
                  autoCapitalize="none"
                />
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>{editIsPublic ? 'Herkese Açık' : 'Gizli'}</Text>
                  <Switch value={editIsPublic} onValueChange={setEditIsPublic} trackColor={{ false: '#4B5563', true: '#7C3AED' }} thumbColor="#fff" />
                </View>
                <View style={styles.editActions}>
                  <TouchableOpacity style={styles.editCancel} onPress={() => setEditModalVisible(false)}>
                    <Text style={styles.editCancelText}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.editSave} onPress={handleSaveEdit} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.editSaveText}>Kaydet</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )
      ) : (
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
                <Switch value={editIsPublic} onValueChange={setEditIsPublic} trackColor={{ false: '#4B5563', true: '#7C3AED' }} thumbColor="#fff" />
              </View>
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.editCancel} onPress={() => setEditModalVisible(false)}>
                  <Text style={styles.editCancelText}>{t('common.cancel', 'Cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editSave} onPress={handleSaveEdit} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.editSaveText}>{t('common.save', 'Save')}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  backBtn: {},
  backText: { color: colors.accent, fontSize: 16 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addBtn: { padding: 4 },
  shareBtn: { padding: 4 },
  menuBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  empty: { color: colors.textMuted, textAlign: 'center', paddingVertical: 40 },
  retryBtn: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 16 },
  retryText: { color: colors.accent, fontSize: 16 },
  playAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 10, alignSelf: 'flex-start', marginTop: 12 },
  playAllText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  trackNum: { width: 28, color: colors.textMuted, fontSize: 14 },
  trackThumb: { width: 48, height: 48, borderRadius: 6, marginRight: 12 },
  trackInfo: { flex: 1 },
  trackTitle: { fontSize: 16, color: colors.text },
  trackArtist: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  removeBtn: { padding: 8 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: '#130A24', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, borderTopWidth: 1, borderColor: 'rgba(192,132,252,0.12)', overflow: 'hidden', marginHorizontal: 6 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 },
  menuItemDanger: {},
  menuText: { fontSize: 18, color: colors.text },
  menuTextDanger: { color: colors.error },
  editModal: { backgroundColor: '#130A24', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderTopWidth: 1, borderColor: 'rgba(192,132,252,0.12)', overflow: 'hidden', marginHorizontal: 6 },
  editTitle: { fontSize: 20, fontWeight: '600', color: colors.text, marginBottom: 16 },
  editInput: { height: 48, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 16, color: colors.text, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  toggleLabel: { fontSize: 16, color: colors.text },
  editActions: { flexDirection: 'row', gap: 12 },
  editCancel: { flex: 1, height: 48, borderRadius: 12, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  editCancelText: { color: colors.textSecondary, fontSize: 16 },
  editSave: { flex: 1, height: 48, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  editSaveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  reorderBtns: { flexDirection: 'column', alignItems: 'center', marginRight: 4 },
  qrModal: { backgroundColor: colors.card, borderRadius: 20, padding: 24, margin: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  qrTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 20 },
  qrContainer: { padding: 16, backgroundColor: colors.surface, borderRadius: 12, marginBottom: 16 },
  qrFallbackText: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  qrUrl: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 20 },
  qrShareBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginBottom: 12 },
  qrShareText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  qrCloseBtn: { padding: 8 },
  qrCloseText: { color: colors.textMuted, fontSize: 14 },
});
