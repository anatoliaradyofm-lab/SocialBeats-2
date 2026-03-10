import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, Image, TouchableOpacity, RefreshControl, Modal, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { usePlaylistsQuery, useCreatePlaylistMutation } from '../hooks/usePlaylistsQuery';
import NativeAd from '../components/ads/NativeAd';
import { useTheme } from '../contexts/ThemeContext';

export default function PlaylistsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { data: playlists = [], isLoading, isRefetching, refetch } = usePlaylistsQuery(token);
  const createMutation = useCreatePlaylistMutation(token);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const onRefresh = () => refetch();

  const listData = useMemo(() => {
    const out = [];
    for (let i = 0; i < playlists.length; i += 2) {
      if (i > 0 && i % 6 === 0) out.push({ type: 'ad', id: `ad-${i}`, adIndex: Math.floor(i / 6) - 1 });
      out.push({ type: 'row', items: playlists.slice(i, i + 2) });
    }
    return out;
  }, [playlists]);

  const createPlaylist = async () => {
    if (!newName.trim() || !token) return;
    try {
      const pl = await createMutation.mutateAsync({ name: newName.trim(), is_public: true });
      setNewName('');
      setShowCreate(false);
      navigation.navigate('PlaylistDetail', { playlistId: pl.id, name: pl.name });
    } catch {}
  };

  const renderItem = ({ item }) => {
    if (item.type === 'ad') {
      return (
        <View style={styles.adWrapper}>
          <NativeAd placement="discover" adIndex={item.adIndex} />
        </View>
      );
    }
    return (
      <View style={styles.row}>
        {item.items.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('PlaylistDetail', { playlistId: p.id, name: p.name })}
          >
            <Image source={{ uri: p.cover_url || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300' }} style={styles.cover} />
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.cardMeta}>{p.track_count || 0} şarkı</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (isLoading && playlists.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Listelerim</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Listelerim</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.createBtnText}>+ Yeni Liste</Text>
        </TouchableOpacity>
      </View>
      <Modal visible={showCreate} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowCreate(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Yeni Liste</Text>
            <TextInput
              style={styles.input}
              placeholder="Liste adı"
              placeholderTextColor="#6B7280"
              value={newName}
              onChangeText={setNewName}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowCreate(false)}><Text style={styles.cancelText}>İptal</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, createMutation.isPending && { opacity: 0.7 }]} onPress={createPlaylist} disabled={createMutation.isPending}>
                <Text style={styles.submitText}>{createMutation.isPending ? '...' : 'Oluştur'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <FlatList
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item) => item.type === 'ad' ? item.id : `row-${item.items[0]?.id || Math.random()}`}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#8B5CF6" />}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
        ListEmptyComponent={<Text style={styles.empty}>Henüz liste yok</Text>}
      />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  createBtn: { backgroundColor: '#8B5CF6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  createBtnText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#1F2937', borderRadius: 16, padding: 24, zIndex: 1 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },
  input: { backgroundColor: '#374151', borderRadius: 12, padding: 16, fontSize: 16, color: colors.text },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 20 },
  cancelText: { color: '#9CA3AF', fontSize: 16 },
  submitBtn: { backgroundColor: '#8B5CF6', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10 },
  submitText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  list: { padding: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  adWrapper: { width: '100%', marginBottom: 16 },
  card: { width: '48%', backgroundColor: '#1F2937', borderRadius: 12, overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 1 },
  cardInfo: { padding: 12 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  cardMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  empty: { color: '#9CA3AF', textAlign: 'center', paddingVertical: 40 },
});
