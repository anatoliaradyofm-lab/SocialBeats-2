import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet,
  ScrollView, RefreshControl, Alert, Modal, TextInput, SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { usePlayer } from '../contexts/PlayerContext';
import api from '../services/api';

const MAIN_TABS = [
  { id: 'liked', label: 'Beğenilenler', icon: 'heart' },
  { id: 'saved', label: 'Kaydedilenler', icon: 'bookmark' },
  { id: 'history', label: 'Geçmiş', icon: 'time' },
];

const LIKED_SUBS = [
  { id: 'tracks', label: 'Parçalar', icon: 'musical-note' },
  { id: 'albums', label: 'Albümler', icon: 'disc' },
  { id: 'artists', label: 'Sanatçılar', icon: 'person' },
  { id: 'playlists', label: 'Listeler', icon: 'list' },
];

const SAVED_SUBS = [
  { id: 'posts', label: 'Gönderiler', icon: 'images' },
  { id: 'stories', label: 'Hikayeler', icon: 'play-circle' },
  { id: 'profiles', label: 'Profiller', icon: 'people' },
];

const HISTORY_FILTERS = [
  { id: 'all', label: 'Tümü' },
  { id: '7', label: 'Son 7 gün' },
  { id: '14', label: 'Son 14 gün' },
  { id: '30', label: 'Son 30 gün' },
];

export default function LibraryScreen({ navigation }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { playTrack } = usePlayer();
  const [activeTab, setActiveTab] = useState('liked');
  const [likedSub, setLikedSub] = useState('tracks');
  const [savedSub, setSavedSub] = useState('posts');
  const [historyFilter, setHistoryFilter] = useState('30');
  const [data, setData] = useState([]);
  const [folders, setFolders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const fetchData = useCallback(async () => {
    try {
      let res;
      if (activeTab === 'liked') {
        switch (likedSub) {
          case 'tracks':
            res = await api.get('/library/favorites', token);
            setData(res.tracks || res || []);
            break;
          case 'albums':
            res = await api.get('/library/albums', token);
            setData(res.albums || []);
          break;
          case 'artists':
            res = await api.get('/library/artists', token);
            setData(res.artists || []);
          break;
          case 'playlists':
            res = await api.get('/library/playlists/liked', token);
            setData(res.playlists || []);
          break;
        }
      } else if (activeTab === 'saved') {
        switch (savedSub) {
          case 'posts':
          res = await api.get('/social/posts/saved', token);
          setData(res.posts || res || []);
            try {
              const fc = await api.get('/collections/saved', token);
              setFolders(Array.isArray(fc) ? fc : fc.collections || []);
            } catch { setFolders([]); }
            break;
          case 'stories':
            res = await api.get('/library/saved-stories', token);
            setData(res.stories || []);
            break;
          case 'profiles':
            res = await api.get('/library/saved-profiles', token);
            setData(res.profiles || []);
          break;
        }
      } else if (activeTab === 'history') {
        const days = historyFilter === 'all' ? 365 : parseInt(historyFilter, 10);
        res = await api.get(`/library/recent?days=${days}&limit=200`, token);
        setData(res.tracks || res || []);
      }
    } catch { setData([]); }
  }, [activeTab, likedSub, savedSub, historyFilter, token]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const clearHistory = () => {
    Alert.alert('Geçmişi Temizle', 'Tüm dinleme geçmişiniz silinecek.', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Temizle', style: 'destructive',
        onPress: async () => {
    try { await api.delete('/library/recent', token); setData([]); } catch {}
        }
      },
    ]);
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api.post('/collections/saved', { name: newFolderName.trim() }, token);
      setNewFolderName('');
      setShowFolderModal(false);
      fetchData();
    } catch {}
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const renderLikedTrack = (item) => (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={() => playTrack(item, data)}>
      <View style={[styles.thumb, { backgroundColor: colors.surfaceElevated }]}>
        {item.thumbnail ? <Image source={{ uri: item.thumbnail }} style={styles.thumb} /> : <Ionicons name="musical-note" size={16} color={BRAND.primaryLight} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>{item.title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.artist}</Text>
      </View>
      <Ionicons name="heart" size={18} color={BRAND.pink} />
    </TouchableOpacity>
  );

  const renderAlbum = (item) => (
    <TouchableOpacity style={[styles.gridItem, { backgroundColor: colors.surfaceElevated }]}>
      <View style={styles.gridThumb}>
        {item.cover_url ? <Image source={{ uri: item.cover_url }} style={styles.gridThumb} /> : <Ionicons name="disc" size={28} color={BRAND.accent} />}
      </View>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500', marginTop: 8 }} numberOfLines={1}>{item.name}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>{item.artist}</Text>
    </TouchableOpacity>
  );

  const renderArtist = (item) => (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={[styles.thumbRound, { backgroundColor: colors.surfaceElevated }]}>
        {item.image ? <Image source={{ uri: item.image }} style={styles.thumbRound} /> : <Ionicons name="person" size={20} color={BRAND.primary} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>{item.name}</Text>
        {item.genres?.length > 0 && (
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.genres.slice(0, 3).join(', ')}</Text>
        )}
      </View>
      <Ionicons name="heart" size={18} color={BRAND.pink} />
    </TouchableOpacity>
  );

  const renderPlaylist = (item) => (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={() => navigation.navigate('PlaylistDetail', { playlistId: item.id || item._id })}>
      <View style={[styles.thumb, { backgroundColor: colors.surfaceElevated }]}>
        {item.cover_url ? <Image source={{ uri: item.cover_url }} style={styles.thumb} /> : <Ionicons name="musical-notes" size={20} color={BRAND.primaryLight} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>{item.name}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.track_count || item.tracks?.length || 0} parça</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );

  const renderSavedPost = (item) => (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={() => navigation.navigate('PostDetail', { postId: item.id || item._id })}>
      <View style={[styles.thumb, { backgroundColor: colors.surfaceElevated }]}>
        {item.media_url || item.media_urls?.[0] ? <Image source={{ uri: item.media_url || item.media_urls[0] }} style={styles.thumb} /> : <Ionicons name="bookmark" size={18} color={BRAND.accent} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 14 }} numberOfLines={2}>{item.content || 'Gönderi'}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.user?.username || ''}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderSavedStory = (item) => (
    <TouchableOpacity style={[styles.gridItem, { backgroundColor: colors.surfaceElevated }]}>
      <View style={styles.gridThumb}>
        {item.story?.media_url ? <Image source={{ uri: item.story.media_url }} style={styles.gridThumb} /> : <Ionicons name="play-circle" size={28} color={BRAND.accent} />}
      </View>
      <Text style={{ color: colors.text, fontSize: 12, marginTop: 6 }} numberOfLines={1}>{item.story?.username || 'Hikaye'}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 10 }}>{formatDate(item.saved_at)}</Text>
    </TouchableOpacity>
  );

  const renderSavedProfile = (item) => (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={() => navigation.navigate('UserProfile', { userId: item.profile_id })}>
      <View style={[styles.thumbRound, { backgroundColor: colors.surfaceElevated }]}>
        {item.profile?.avatar ? <Image source={{ uri: item.profile.avatar }} style={styles.thumbRound} /> : <Ionicons name="person" size={20} color={BRAND.primary} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>{item.profile?.username || item.profile?.display_name || 'Profil'}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{formatDate(item.saved_at)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderHistoryTrack = (item) => (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={() => playTrack(item, data)}>
      <View style={[styles.thumb, { backgroundColor: colors.surfaceElevated }]}>
        {item.thumbnail ? <Image source={{ uri: item.thumbnail }} style={styles.thumb} /> : <Ionicons name="musical-note" size={16} color={BRAND.primaryLight} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>{item.title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.artist}</Text>
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 10 }}>{formatDate(item.played_at)}</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => {
    if (activeTab === 'liked') {
      if (likedSub === 'tracks') return renderLikedTrack(item);
      if (likedSub === 'albums') return renderAlbum(item);
      if (likedSub === 'artists') return renderArtist(item);
      if (likedSub === 'playlists') return renderPlaylist(item);
    } else if (activeTab === 'saved') {
      if (savedSub === 'posts') return renderSavedPost(item);
      if (savedSub === 'stories') return renderSavedStory(item);
      if (savedSub === 'profiles') return renderSavedProfile(item);
    } else if (activeTab === 'history') {
      return renderHistoryTrack(item);
    }
    return null;
  };

  const numColumns = (activeTab === 'liked' && likedSub === 'albums') || (activeTab === 'saved' && savedSub === 'stories') ? 2 : 1;
  const useGrid = numColumns === 2;

  const getEmptyIcon = () => {
    if (activeTab === 'liked') return LIKED_SUBS.find(s => s.id === likedSub)?.icon || 'heart';
    if (activeTab === 'saved') return SAVED_SUBS.find(s => s.id === savedSub)?.icon || 'bookmark';
    return 'time';
  };

  const getEmptyText = () => {
    if (activeTab === 'liked') {
      const labels = { tracks: 'Beğenilen parça', albums: 'Beğenilen albüm', artists: 'Beğenilen sanatçı', playlists: 'Beğenilen çalma listesi' };
      return `${labels[likedSub] || 'İçerik'} yok`;
    }
    if (activeTab === 'saved') {
      const labels = { posts: 'Kaydedilen gönderi', stories: 'Kaydedilen hikaye', profiles: 'Kaydedilen profil' };
      return `${labels[savedSub] || 'İçerik'} yok`;
    }
    return 'Dinleme geçmişi boş';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Kütüphane</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => navigation.navigate('SmartPlaylists')} style={{ padding: 4 }}>
            <Ionicons name="sparkles" size={22} color={BRAND.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('ListeningStats')} style={{ padding: 4 }}>
            <Ionicons name="stats-chart" size={22} color={BRAND.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('YearlyWrap')} style={{ padding: 4 }}>
            <Ionicons name="trophy" size={22} color="#F59E0B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {MAIN_TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, { backgroundColor: activeTab === t.id ? BRAND.primary : colors.surfaceElevated }]}
            onPress={() => setActiveTab(t.id)}
          >
            <Ionicons name={t.icon} size={16} color={activeTab === t.id ? '#FFF' : colors.textMuted} />
            <Text style={{ color: activeTab === t.id ? '#FFF' : colors.textSecondary, fontSize: 13, fontWeight: '500' }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sub-tabs for Liked */}
      {activeTab === 'liked' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabRow}>
          {LIKED_SUBS.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[styles.subTab, likedSub === s.id && { borderBottomColor: BRAND.primary, borderBottomWidth: 2 }]}
              onPress={() => setLikedSub(s.id)}
            >
              <Ionicons name={s.icon} size={14} color={likedSub === s.id ? BRAND.primary : colors.textMuted} />
              <Text style={{ color: likedSub === s.id ? BRAND.primary : colors.textMuted, fontSize: 12, fontWeight: '500' }}>{s.label}</Text>
        </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Sub-tabs for Saved */}
      {activeTab === 'saved' && (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabRow}>
            {SAVED_SUBS.map(s => (
              <TouchableOpacity
                key={s.id}
                style={[styles.subTab, savedSub === s.id && { borderBottomColor: BRAND.primary, borderBottomWidth: 2 }]}
                onPress={() => setSavedSub(s.id)}
              >
                <Ionicons name={s.icon} size={14} color={savedSub === s.id ? BRAND.primary : colors.textMuted} />
                <Text style={{ color: savedSub === s.id ? BRAND.primary : colors.textMuted, fontSize: 12, fontWeight: '500' }}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {savedSub === 'posts' && folders.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.folderRow}>
              {folders.map(f => (
                <TouchableOpacity key={f.id} style={[styles.folderChip, { backgroundColor: colors.surfaceElevated }]} onPress={() => navigation.navigate('PostDetail', { collectionId: f.id })}>
                  <Ionicons name="folder" size={14} color={BRAND.accent} />
                  <Text style={{ color: colors.text, fontSize: 12 }}>{f.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 10 }}>{f.posts_count || 0}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[styles.folderChip, { backgroundColor: colors.surfaceElevated, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border }]} onPress={() => setShowFolderModal(true)}>
                <Ionicons name="add" size={14} color={BRAND.primary} />
                <Text style={{ color: BRAND.primary, fontSize: 12 }}>Yeni Klasör</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
                </View>
      )}

      {/* History filter + clear */}
      {activeTab === 'history' && (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabRow}>
            {HISTORY_FILTERS.map(f => (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterChip, { backgroundColor: historyFilter === f.id ? BRAND.primary : colors.surfaceElevated }]}
                onPress={() => setHistoryFilter(f.id)}
              >
                <Text style={{ color: historyFilter === f.id ? '#FFF' : colors.textSecondary, fontSize: 12 }}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {data.length > 0 && (
            <View style={styles.historyMeta}>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{data.length} parça</Text>
              <TouchableOpacity onPress={clearHistory}>
                <Text style={{ color: BRAND.pink, fontSize: 12, fontWeight: '500' }}>Geçmişi Temizle</Text>
              </TouchableOpacity>
              </View>
          )}
              </View>
      )}

      <FlatList
        key={`${activeTab}-${likedSub}-${savedSub}-${numColumns}`}
        data={data}
        renderItem={renderItem}
        numColumns={numColumns}
        columnWrapperStyle={useGrid ? styles.gridRow : undefined}
        keyExtractor={(item, i) => item.id || item._id || item.track_id || `${i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name={getEmptyIcon()} size={44} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 14 }}>{getEmptyText()}</Text>
          </View>
        }
      />

      {/* Create Folder Modal */}
      <Modal visible={showFolderModal} transparent animationType="fade" onRequestClose={() => setShowFolderModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Yeni Klasör Oluştur</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border }]}
              placeholder="Klasör adı (ör. Favoriler, Sonra İzle)"
              placeholderTextColor={colors.textMuted}
              value={newFolderName}
              onChangeText={setNewFolderName}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => setShowFolderModal(false)}>
                <Text style={{ color: colors.textSecondary }}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: BRAND.primary }]} onPress={createFolder}>
                <Text style={{ color: '#FFF', fontWeight: '600' }}>Oluştur</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', gap: 12 },
  tabRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, gap: 6 },
  subTabRow: { paddingHorizontal: 16, paddingBottom: 4, gap: 16 },
  subTab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 2 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  historyMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6 },
  folderRow: { paddingHorizontal: 16, paddingVertical: 6, gap: 8 },
  folderChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, gap: 12 },
  thumb: { width: 52, height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  thumbRound: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  gridRow: { paddingHorizontal: 12, gap: 8 },
  gridItem: { flex: 1, margin: 4, borderRadius: 14, padding: 10, alignItems: 'center' },
  gridThumb: { width: '100%', aspectRatio: 1, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.05)' },
  empty: { alignItems: 'center', paddingTop: 80 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
});
