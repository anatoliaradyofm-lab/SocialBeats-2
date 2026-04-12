/**
 * PlaylistsScreen — Modern Library
 * Liste görünümü · Beğenilen + Son Dinlenen pinned playlist olarak · FAB · Rename modal
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  RefreshControl, TextInput, ActivityIndicator, Animated, Pressable, Modal, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NativeAdSlot from '../components/ads/NativeAdSlot';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { Alert } from '../components/ui/AppAlert';
import {
  getStoredTrackCount,
  getPlaylistsCache,
  setPlaylistsCache,
  removePlaylistFromCache,
} from '../lib/playlistStore';

export { removePlaylistFromCache, getPlaylistsCache };

// Local alias so existing code in this file still works
const _loadCache  = () => getPlaylistsCache();
let   _cache      = getPlaylistsCache();

const PLACEHOLDER = Array.from({ length: 8 }, (_, i) => ({
  id: `pl-${i}`,
  name: ['Chill Vibes 🌙','Workout Power 💪','Rainy Day ☔','Party Time 🎉','Focus Mode 🎯','Road Trip 🛣️','Morning Coffee ☕','Night Owl 🦉'][i],
  cover: `https://picsum.photos/seed/lib${i * 13}/400/400`,
  covers: [
    `https://picsum.photos/seed/lib${i*13}/200/200`,
    `https://picsum.photos/seed/lib${i*13+1}/200/200`,
    `https://picsum.photos/seed/lib${i*13+2}/200/200`,
    `https://picsum.photos/seed/lib${i*13+3}/200/200`,
  ],
  track_count: [24,18,32,15,20,28,12,22][i],
  updated: ['2 saat önce','Dün','3 gün önce','1 hafta önce','2 gün önce','5 gün önce','Bugün','3 saat önce'][i],
}));

// ─── Pinned smart playlists (Beğenilen + Son Dinlenen) ───────────────────────
const PINNED = [
  {
    id: '__liked__',
    name: 'Beğenilen Şarkılar',
    subtitle: 'Beğendiğin tüm parçalar',
    icon: 'heart',
    iconColor: '#fff',
    bgColors: ['#4C1D95', '#C084FC'],
    glowColor: 'rgba(192,132,252,0.55)',
    route: 'Liked',
    track_count: null,
  },
  {
    id: '__recent__',
    name: 'Son Dinlenen',
    subtitle: 'Son çaldığın parçalar',
    icon: 'radio',
    iconColor: '#fff',
    bgColors: ['#7C2D12', '#FB923C'],
    glowColor: 'rgba(251,146,60,0.55)',
    route: 'ListeningHistory',
    track_count: null,
  },
];

// ─── 4-image collage cover ───────────────────────────────────────────────────
function CollageCover({ covers, size }) {
  const half = size / 2;
  if (!covers?.length) return (
    <LinearGradient
      colors={['#4C1D95', '#7C3AED', '#C084FC']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name="musical-notes" size={size * 0.42} color="rgba(255,255,255,0.85)" />
    </LinearGradient>
  );
  if (covers.length < 4) {
    return <Image source={{ uri: covers[0] }} style={{ width: size, height: size, borderRadius: 12 }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: 12, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap' }}>
      {covers.slice(0, 4).map((uri, i) => (
        <Image key={i} source={{ uri }} style={{ width: half, height: half }} />
      ))}
    </View>
  );
}

// ─── Pinned Playlist Row ─────────────────────────────────────────────────────
function PinnedRow({ item, onPress, colors }) {
  return (
    <TouchableOpacity
      style={[pr.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={item.bgColors}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[pr.cover, { shadowColor: item.glowColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 8 }]}
      >
        <Ionicons name={item.icon} size={28} color={item.iconColor} />
      </LinearGradient>
      <View style={pr.info}>
        <Text style={[pr.name, { color: colors.text }]}>{item.name}</Text>
        <Text style={[pr.sub, { color: colors.textMuted }]}>{item.subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textGhost || colors.textMuted} />
    </TouchableOpacity>
  );
}

const pr = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth, gap: 14 },
  cover: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info:  { flex: 1, gap: 4 },
  name:  { fontSize: 15, fontWeight: '700' },
  sub:   { fontSize: 12 },
});

// ─── List Row ────────────────────────────────────────────────────────────────
function ListRow({ item, colors, onPress }) {
  return (
    <TouchableOpacity
      style={[lr.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <CollageCover covers={item.covers || [item.cover]} size={60} />
      <View style={lr.info}>
        <Text style={[lr.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[lr.meta, { color: colors.textMuted }]}>{getStoredTrackCount(item.id) ?? item.track_count} parça · {item.updated}</Text>
      </View>
    </TouchableOpacity>
  );
}

const lr = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  info:    { flex: 1, gap: 3 },
  name:    { fontSize: 15, fontWeight: '700' },
  meta:    { fontSize: 12 },
});

// ─── Bottom Sheet Modal ──────────────────────────────────────────────────────
function BottomModal({ visible, onClose, title, children, bottomOffset = 68 }) {
  const { colors } = useTheme();
  const translateY = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 200 }).start();
    } else {
      Animated.timing(translateY, { toValue: 400, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  const sheetStyle = {
    backgroundColor: '#08060F',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderColor: 'rgba(192,132,252,0.18)',
    padding: 24,
    paddingBottom: 40,
    overflow: 'hidden',
    alignSelf: 'stretch',
  };

  if (Platform.OS === 'web') {
    if (!visible) return null;
    return (
      <View style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: bottomOffset, zIndex: 9999 }} pointerEvents="box-none">
        <Pressable style={bm.overlay} onPress={onClose}>
          <Pressable style={sheetStyle} onPress={e => e.stopPropagation()}>
            <LinearGradient colors={['rgba(26,10,46,0.35)', 'rgba(16,8,28,0.10)', 'rgba(10,5,18,0.02)', 'transparent']} locations={[0, 0.38, 0.68, 1]} style={bm.topGrad} pointerEvents="none" />
            <View style={bm.handle} />
            {title && <Text style={[bm.title, { color: colors.text }]}>{title}</Text>}
            {children}
          </Pressable>
        </Pressable>
      </View>
    );
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={bm.overlay} onPress={onClose}>
        <Animated.View style={[sheetStyle, { transform: [{ translateY }] }]}>
          <Pressable onPress={e => e.stopPropagation()}>
            <LinearGradient colors={['rgba(26,10,46,0.35)', 'rgba(16,8,28,0.10)', 'rgba(10,5,18,0.02)', 'transparent']} locations={[0, 0.38, 0.68, 1]} style={bm.topGrad} pointerEvents="none" />
            <View style={bm.handle} />
            {title && <Text style={[bm.title, { color: colors.text }]}>{title}</Text>}
            {children}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const bm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(8,6,15,0.88)', justifyContent: 'flex-end' },
  topGrad: { position: 'absolute', top: 0, left: 0, right: 0, height: 110, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  handle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(192,132,252,0.30)', alignSelf: 'center', marginBottom: 20 },
  title:   { fontSize: 18, fontWeight: '800', marginBottom: 20 },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function PlaylistsScreen({ navigation }) {
  const { colors }              = useTheme();
  const { user, token, isGuest } = useAuth();
  const { t }                   = useTranslation();
  const insets          = useSafeAreaInsets();

  const [loading, setLoading]         = useState(!_cache);
  const [refreshing, setRefreshing]   = useState(false);
  const [playlists, setPlaylists]     = useState(() => {
    if (isGuest) return (_cache || []).filter(p => String(p.id).startsWith('local-'));
    // Gerçek kullanıcı: local- prefix'li (misafir) listeler gösterilmez
    return (_cache || PLACEHOLDER).filter(p => !String(p.id).startsWith('local-'));
  });

  // Keep module cache in sync so remounts restore state
  const setPlaylistsCached = useCallback((updater) => {
    setPlaylists(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      _cache = next;
      setPlaylistsCache(next);
      return next;
    });
  }, []);
  const [search, setSearch]           = useState('');
  const [showSearch, setShowSearch]   = useState(false);

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [inputVal, setInputVal]       = useState('');
  const [saving, setSaving]           = useState(false);

  // ── Load ─────────────────────────────────────────────────────────────────
  const loadPlaylists = useCallback(async () => {
    if (isGuest || !token) { setLoading(false); return; }
    try {
      const res  = await api.get('/playlists', token);
      const list = Array.isArray(res) ? res : res?.playlists || res?.items || [];
      if (list.length > 0) {
        // Gerçek kullanıcı: sadece API'dan gelen listeler (local- prefix'liler dahil edilmez)
        setPlaylistsCached(list.filter(p => !String(p.id).startsWith('local-')));
      }
    } catch (_) {}
    finally { setLoading(false); }
  }, [token, isGuest]);

  useEffect(() => { loadPlaylists(); }, [loadPlaylists]);

  // Ekrana dönüldüğünde cache'den güncelle (silme sonrası listeyi yenile)
  useFocusEffect(useCallback(() => {
    const fresh = getPlaylistsCache();
    if (isGuest) {
      setPlaylists(fresh.filter(p => String(p.id).startsWith('local-')));
    } else {
      // Gerçek kullanıcı: local- prefix'li listeler de gösterilir (API onaylayana kadar)
      setPlaylistsCached(fresh);
    }
  }, [isGuest]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPlaylists();
    setRefreshing(false);
  }, [loadPlaylists]);

  // ── Create ───────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!inputVal.trim()) return;
    setSaving(true);
    const tempId = `local-${Date.now()}`;
    const newItem = { id: tempId, name: inputVal.trim(), covers: [], track_count: 0, updated: 'Şimdi' };
    setPlaylistsCached(p => [newItem, ...p]);
    setCreateModal(false);
    setInputVal('');
    setSaving(false);
    // Misafirde sadece local kayıt — API çağrısı yok
    if (isGuest || !token) return;
    try {
      const res = await api.post('/playlists', { name: newItem.name }, token);
      if (res?.id) {
        setPlaylistsCached(p => p.map(pl => pl.id === tempId ? { ...newItem, ...res } : pl));
      }
    } catch {
      setPlaylistsCached(p => p.filter(pl => pl.id !== tempId));
      Alert.alert('Hata', 'Oynatma listesi oluşturulamadı.');
    }
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = search.trim()
    ? playlists.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()))
    : playlists;

  const totalTracks = playlists.reduce((s, p) => s + (getStoredTrackCount(p.id) ?? p.track_count ?? 0), 0);

  // ── Render ────────────────────────────────────────────────────────────────
  const renderItem = useCallback(({ item }) => (
    <ListRow
      item={item}
      colors={colors}
      onPress={() => navigation.navigate('PlaylistDetail', { playlistId: item.id, playlist: item })}
    />
  ), [colors, navigation]);

  const s = createStyles(colors, insets);

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.greeting}>Merhaba 👋</Text>
            <Text style={s.title}>Kütüphanem</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[s.iconBtn, { backgroundColor: colors.surface }]}
              onPress={() => { setShowSearch(v => !v); if (showSearch) setSearch(''); }}
            >
              <Ionicons name={showSearch ? 'close' : 'search'} size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar */}
        {showSearch && (
          <View style={[s.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={[s.searchInput, { color: colors.text }]}
              placeholder="Playlist ara..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
        )}

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statChip}>
            <Ionicons name="musical-notes" size={13} color={colors.primary} />
            <Text style={[s.statText, { color: colors.textSecondary }]}>{playlists.length} playlist</Text>
          </View>
          <View style={[s.statDivider, { backgroundColor: colors.border }]} />
          <View style={s.statChip}>
            <Ionicons name="disc" size={13} color={colors.primary} />
            <Text style={[s.statText, { color: colors.textSecondary }]}>{totalTracks} parça</Text>
          </View>
        </View>
      </View>

      {/* ── Pinned Playlists (Beğenilen + Son Dinlenen) ── */}
      <View style={[s.pinnedSection, { borderBottomColor: colors.border }]}>
        {PINNED.map(item => (
          <PinnedRow
            key={item.id}
            item={item}
            colors={colors}
            onPress={() => item.route && navigation.navigate(item.route)}
          />
        ))}
      </View>

      {/* ── Section Header ── */}
      <View style={s.sectionHeader}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>Oynatma Listelerim</Text>
      </View>

      {/* ── List ── */}
      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<NativeAdSlot colors={colors} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="musical-notes-outline" size={56} color={colors.textGhost || colors.textMuted} />
              <Text style={[s.emptyTitle, { color: colors.text }]}>Henüz playlist yok</Text>
              <Text style={[s.emptySub, { color: colors.textMuted }]}>İlk oynatma listeni oluştur</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setCreateModal(true)}>
                <LinearGradient colors={['#A78BFA', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.emptyBtnGrad}>
                  <Ionicons name="add" size={18} color="#FFF" />
                  <Text style={s.emptyBtnText}>Oluştur</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* ── Create Modal ── */}
      <BottomModal visible={createModal} onClose={() => setCreateModal(false)} title="Yeni Playlist">
        <TextInput
          style={[s.modalInput, { color: colors.text, backgroundColor: colors.surface || '#111', borderColor: colors.border }]}
          value={inputVal}
          onChangeText={setInputVal}
          placeholder="Playlist adı..."
          placeholderTextColor={colors.textMuted}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
        <TouchableOpacity onPress={handleCreate} disabled={saving || !inputVal.trim()} activeOpacity={0.85}>
          <LinearGradient
            colors={['#A78BFA', '#7C3AED']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[s.modalBtn, (!inputVal.trim() || saving) && { opacity: 0.45 }]}
          >
            {saving
              ? <ActivityIndicator color="#FFF" />
              : <><Ionicons name="add-circle-outline" size={18} color="#FFF" /><Text style={s.modalBtnText}>Oluştur</Text></>
            }
          </LinearGradient>
        </TouchableOpacity>
      </BottomModal>


    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
function createStyles(colors, insets) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },

    // Header
    header: {
      paddingTop: insets.top + 12,
      paddingHorizontal: 20,
      paddingBottom: 14,
      gap: 12,
    },
    headerTop:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    greeting:    { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
    title:       { fontSize: 30, fontWeight: '900', color: colors.text, letterSpacing: -1 },
    iconBtn:     { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, marginTop: 4 },

    // Search
    searchBar:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
    searchInput: { flex: 1, fontSize: 15, padding: 0 },

    // Stats
    statsRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
    statChip:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
    statText:    { fontSize: 12, fontWeight: '600' },
    statDivider: { width: 1, height: 12 },

    // Pinned section
    pinnedSection: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 4, marginBottom: 4 },

    // Section
    sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
    sectionTitle:  { fontSize: 17, fontWeight: '800', flex: 1, color: colors.text },
    sectionCount:  { fontSize: 13, fontWeight: '600' },

    // List
    listContent: { paddingBottom: 0 },

    // Loading / Empty
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    empty:       { alignItems: 'center', paddingTop: 60, gap: 10 },
    emptyTitle:  { fontSize: 17, fontWeight: '700', marginTop: 8 },
    emptySub:    { fontSize: 14 },
    emptyBtn:    { borderRadius: 24, overflow: 'hidden', marginTop: 8 },
    emptyBtnGrad:{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 12 },
    emptyBtnText:{ color: '#FFF', fontWeight: '700', fontSize: 15 },

    // Create button
    createBtn:     { borderRadius: 20, overflow: 'hidden' },
    createBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 7 },
    createBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

    // Modal
    modalInput:   { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 16 },
    modalBtn:     { height: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    modalBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

    // Menu
    menuRow:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
    menuIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    menuLabel:    { flex: 1, fontSize: 15, fontWeight: '600' },
  });
}
