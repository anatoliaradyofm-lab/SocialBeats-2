import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  Alert, TextInput, Image, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

const SORT_OPTIONS = [
  { id: 'recent', label: 'Son Güncellenen' },
  { id: 'name', label: 'İsim (A-Z)' },
  { id: 'name_desc', label: 'İsim (Z-A)' },
  { id: 'tracks', label: 'Şarkı Sayısı' },
  { id: 'created', label: 'Oluşturma Tarihi' },
];

export default function PlaylistsScreen({ navigation }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const [playlists, setPlaylists] = useState([]);
  const [folders, setFolders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPublic, setNewPublic] = useState(true);
  const [sortBy, setSortBy] = useState('recent');
  const [showSort, setShowSort] = useState(false);
  const [showFolderCreate, setShowFolderCreate] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [showFolderModal, setShowFolderModal] = useState(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [view, setView] = useState('all');

  const fetchData = useCallback(async () => {
    try {
      const [plRes, foldRes] = await Promise.all([
        api.get('/playlists', token),
        api.get('/playlists/folders/list', token).catch(() => ({ folders: [] })),
      ]);
      setPlaylists(plRes.playlists || plRes || []);
      setFolders(foldRes.folders || []);
    } catch { setPlaylists([]); setFolders([]); }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const sortedPlaylists = [...playlists].sort((a, b) => {
    switch (sortBy) {
      case 'name': return (a.name || '').localeCompare(b.name || '');
      case 'name_desc': return (b.name || '').localeCompare(a.name || '');
      case 'tracks': return (b.track_count || b.tracks?.length || 0) - (a.track_count || a.tracks?.length || 0);
      case 'created': return (b.created_at || '').localeCompare(a.created_at || '');
      default: return (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '');
    }
  });

  const folderPlaylists = (folderId) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return [];
    return playlists.filter(p => folder.playlist_ids?.includes(p.id));
  };

  const unfolderedPlaylists = sortedPlaylists.filter(p => {
    return !folders.some(f => f.playlist_ids?.includes(p.id));
  });

  const createPlaylist = async () => {
    if (!newName.trim()) return;
    try {
      await api.post('/playlists', { name: newName.trim(), description: newDesc.trim(), is_public: newPublic }, token);
      setNewName(''); setNewDesc(''); setShowCreate(false);
      fetchData();
    } catch (err) {
      Alert.alert('Hata', err.data?.detail || 'Oluşturulamadı');
    }
  };

  const createFolder = async () => {
    if (!folderName.trim()) return;
    try {
      await api.post('/playlists/folders', { name: folderName.trim() }, token);
      setFolderName(''); setShowFolderCreate(false);
      fetchData();
    } catch { Alert.alert('Hata', 'Klasör oluşturulamadı'); }
  };

  const deleteFolder = async (folderId) => {
    Alert.alert('Klasörü Sil', 'Klasör silinecek, içindeki listeler kalacak.', [
      { text: 'İptal' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        try { await api.delete(`/playlists/folders/${folderId}`, token); setShowFolderModal(null); fetchData(); } catch {}
      }},
    ]);
  };

  const renameFolder = async (folderId) => {
    if (!editFolderName.trim()) return;
    try {
      await api.put(`/playlists/folders/${folderId}`, { name: editFolderName.trim() }, token);
      setShowFolderModal(null); fetchData();
    } catch {}
  };

  const getCoverCollage = (pl) => {
    if (pl.cover_url && !pl.cover_url.includes('picsum') && !pl.cover_url.includes('unsplash')) return pl.cover_url;
    const tracks = pl.tracks || [];
    const thumbs = tracks.slice(0, 4).map(t => t.thumbnail || t.cover_url).filter(Boolean);
    return thumbs.length > 0 ? thumbs[0] : null;
  };

  const renderPlaylistItem = (item) => {
    const cover = getCoverCollage(item);
    const trackCount = item.track_count || item.tracks?.length || 0;
    return (
      <TouchableOpacity
        style={[styles.playlistItem, { backgroundColor: colors.surfaceElevated }]}
        onPress={() => navigation.navigate('PlaylistDetail', { playlistId: item.id })}
      >
        <View style={[styles.playlistCover, { backgroundColor: colors.card }]}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.playlistCover} />
          ) : (
            <Ionicons name="musical-notes" size={24} color={BRAND.primaryLight} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.playlistName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{trackCount} şarkı</Text>
            {item.is_collaborative && <Ionicons name="people" size={12} color={BRAND.accent} />}
            {!item.is_public && <Ionicons name="lock-closed" size={11} color={colors.textMuted} />}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  const allData = view === 'folders'
    ? [
        ...folders.map(f => ({ type: 'folder', ...f })),
        { type: 'unfolderedHeader' },
        ...unfolderedPlaylists.map(p => ({ type: 'playlist', ...p })),
      ]
    : sortedPlaylists.map(p => ({ type: 'playlist', ...p }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Çalma Listeleri</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={() => setShowSort(true)} style={{ padding: 4 }}>
            <Ionicons name="swap-vertical" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowCreate(true)} style={{ padding: 4 }}>
            <Ionicons name="add-circle-outline" size={22} color={BRAND.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* View Tabs */}
      <View style={styles.tabRow}>
        {[
          { id: 'all', label: 'Tümü', icon: 'list' },
          { id: 'folders', label: 'Klasörler', icon: 'folder' },
        ].map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, { backgroundColor: view === t.id ? BRAND.primary : colors.surfaceElevated }]}
            onPress={() => setView(t.id)}
          >
            <Ionicons name={t.icon} size={14} color={view === t.id ? '#FFF' : colors.textMuted} />
            <Text style={{ color: view === t.id ? '#FFF' : colors.textSecondary, fontSize: 13, fontWeight: '500' }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
        {view === 'folders' && (
          <TouchableOpacity style={[styles.tab, { backgroundColor: colors.surfaceElevated }]} onPress={() => setShowFolderCreate(true)}>
            <Ionicons name="add" size={14} color={BRAND.accent} />
            <Text style={{ color: BRAND.accent, fontSize: 13, fontWeight: '500' }}>Klasör</Text>
        </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={allData}
        keyExtractor={(item, i) => `${item.type}-${item.id || i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        renderItem={({ item }) => {
          if (item.type === 'unfolderedHeader') {
            return unfolderedPlaylists.length > 0 ? (
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>KLASÖRSÜZ</Text>
            ) : null;
          }
          if (item.type === 'folder') {
            const fPlaylists = folderPlaylists(item.id);
            return (
              <TouchableOpacity
                style={[styles.folderItem, { backgroundColor: colors.surfaceElevated }]}
                onPress={() => setShowFolderModal(item)}
              >
                <View style={[styles.folderIcon, { backgroundColor: BRAND.primary + '18' }]}>
                  <Ionicons name="folder" size={22} color={BRAND.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{item.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{fPlaylists.length} liste</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            );
          }
          return renderPlaylistItem(item);
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="musical-notes-outline" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 12 }}>Henüz çalma listesi yok</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreate(true)}>
              <Text style={{ color: BRAND.primary, fontWeight: '600' }}>İlk Listeni Oluştur</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Create Playlist Modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Yeni Çalma Listesi</Text>
          <TextInput
              style={[styles.modalInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
            placeholder="Liste adı"
              placeholderTextColor={colors.textMuted}
            value={newName}
            onChangeText={setNewName}
              autoFocus
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border, minHeight: 60 }]}
              placeholder="Açıklama (opsiyonel)"
              placeholderTextColor={colors.textMuted}
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
            />
            <TouchableOpacity style={styles.toggleRow} onPress={() => setNewPublic(!newPublic)}>
              <Ionicons name={newPublic ? 'globe-outline' : 'lock-closed-outline'} size={18} color={colors.text} />
              <Text style={{ color: colors.text, flex: 1, marginLeft: 10 }}>{newPublic ? 'Herkese Açık' : 'Gizli'}</Text>
              <View style={[styles.toggle, { backgroundColor: newPublic ? BRAND.primary : colors.border }]}>
                <View style={[styles.toggleDot, { alignSelf: newPublic ? 'flex-end' : 'flex-start' }]} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.createBtnFull, { opacity: newName.trim() ? 1 : 0.4 }]} onPress={createPlaylist}>
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Oluştur</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowCreate(false); setNewName(''); setNewDesc(''); }}>
              <Text style={{ color: colors.textMuted }}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sort Modal */}
      <Modal visible={showSort} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Sırala</Text>
            {SORT_OPTIONS.map(o => (
              <TouchableOpacity key={o.id} style={[styles.sortRow, { borderBottomColor: colors.border }]} onPress={() => { setSortBy(o.id); setShowSort(false); }}>
                <Text style={{ color: sortBy === o.id ? BRAND.primary : colors.text, fontSize: 15 }}>{o.label}</Text>
                {sortBy === o.id && <Ionicons name="checkmark" size={20} color={BRAND.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSort(false)}>
              <Text style={{ color: colors.textMuted }}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create Folder Modal */}
      <Modal visible={showFolderCreate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Yeni Klasör</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              placeholder="Klasör adı"
              placeholderTextColor={colors.textMuted}
              value={folderName}
              onChangeText={setFolderName}
              autoFocus
            />
            <TouchableOpacity style={[styles.createBtnFull, { opacity: folderName.trim() ? 1 : 0.4 }]} onPress={createFolder}>
              <Text style={{ color: '#FFF', fontWeight: '700' }}>Oluştur</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowFolderCreate(false); setFolderName(''); }}>
              <Text style={{ color: colors.textMuted }}>İptal</Text>
          </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Folder Detail Modal */}
      <Modal visible={!!showFolderModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, maxHeight: '70%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="folder" size={22} color={BRAND.primary} />
              <Text style={[styles.modalTitle, { flex: 1, marginLeft: 10, marginBottom: 0 }]}>{showFolderModal?.name}</Text>
              <TouchableOpacity onPress={() => deleteFolder(showFolderModal?.id)}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border, flex: 1, marginBottom: 0 }]}
                value={editFolderName || showFolderModal?.name || ''}
                onChangeText={setEditFolderName}
                placeholder="Klasör adı"
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity style={{ backgroundColor: BRAND.primary, paddingHorizontal: 16, borderRadius: 14, justifyContent: 'center' }} onPress={() => renameFolder(showFolderModal?.id)}>
                <Ionicons name="checkmark" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {folderPlaylists(showFolderModal?.id).map(pl => (
                <View key={pl.id} style={{ marginBottom: 4 }}>{renderPlaylistItem(pl)}</View>
              ))}
              {folderPlaylists(showFolderModal?.id).length === 0 && (
                <Text style={{ color: colors.textMuted, textAlign: 'center', padding: 20 }}>Bu klasörde liste yok</Text>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowFolderModal(null); setEditFolderName(''); }}>
              <Text style={{ color: colors.textMuted }}>Kapat</Text>
          </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 54, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  playlistItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, marginBottom: 8, gap: 12 },
  playlistCover: { width: 56, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  playlistName: { fontSize: 15, fontWeight: '600' },
  folderItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 8, gap: 12 },
  folderIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyBtn: { marginTop: 16, padding: 12 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 10 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, marginBottom: 8 },
  toggle: { width: 44, height: 24, borderRadius: 12, padding: 2 },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },
  createBtnFull: { backgroundColor: BRAND.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 4 },
  cancelBtn: { alignItems: 'center', paddingTop: 16 },
  sortRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5 },
});
