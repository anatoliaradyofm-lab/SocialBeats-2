import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

export default function PlaylistAddTrackScreen({ navigation, route }) {
  const track = route.params?.track;
  const { token } = useAuth();
  const { colors } = useTheme();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null);
  const [newName, setNewName] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const fetchPlaylists = useCallback(async () => {
    try {
      const res = await api.get('/playlists', token);
      setPlaylists(res.playlists || res || []);
    } catch { setPlaylists([]); }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchPlaylists(); }, [fetchPlaylists]);

  const addToPlaylist = async (playlistId) => {
    if (!track) return;
    setAdding(playlistId);
    try {
      await api.post(`/playlists/${playlistId}/tracks`, {
        id: track.id,
        title: track.title,
        artist: track.artist,
        thumbnail: track.thumbnail,
        duration: track.duration,
        source: track.source || 'youtube',
      }, token);
      Alert.alert('Eklendi', `"${track.title}" çalma listesine eklendi.`);
      navigation.goBack();
    } catch {
      Alert.alert('Hata', 'Şarkı eklenirken bir hata oluştu.');
    }
    setAdding(null);
  };

  const createAndAdd = async () => {
    if (!newName.trim()) return;
    try {
      const res = await api.post('/playlists', { name: newName.trim() }, token);
      const newId = res.id || res._id;
      if (newId && track) {
        await addToPlaylist(newId);
      } else {
        fetchPlaylists();
        setShowCreate(false);
        setNewName('');
      }
    } catch {
      Alert.alert('Hata', 'Çalma listesi oluşturulamadı.');
    }
  };

  if (!track) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 100 }}>Şarkı bulunamadı</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Listeye Ekle</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.trackPreview, { backgroundColor: colors.surfaceElevated }]}>
        <View style={[styles.thumb, { backgroundColor: colors.card }]}>
          {track.thumbnail ? (
            <Image source={{ uri: track.thumbnail }} style={styles.thumb} />
          ) : (
            <Ionicons name="musical-note" size={20} color={BRAND.primaryLight} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{track.title}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{track.artist}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.createBtn, { backgroundColor: colors.surfaceElevated }]}
        onPress={() => setShowCreate(!showCreate)}
      >
        <View style={[styles.createIcon, { backgroundColor: BRAND.primary + '20' }]}>
          <Ionicons name="add" size={22} color={BRAND.primary} />
        </View>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '500' }}>Yeni Çalma Listesi</Text>
      </TouchableOpacity>

      {showCreate && (
        <View style={[styles.createRow, { backgroundColor: colors.surfaceElevated }]}>
          <TextInput
            style={[styles.createInput, { color: colors.text, backgroundColor: colors.card }]}
            placeholder="Liste adı..."
            placeholderTextColor={colors.textMuted}
            value={newName}
            onChangeText={setNewName}
            autoFocus
          />
          <TouchableOpacity style={[styles.createSubmit, { opacity: newName.trim() ? 1 : 0.4 }]} onPress={createAndAdd}>
            <Text style={{ color: '#FFF', fontWeight: '600' }}>Oluştur</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={BRAND.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={playlists}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, { borderBottomColor: colors.border }]}
              onPress={() => addToPlaylist(item.id || item._id)}
              disabled={adding === (item.id || item._id)}
            >
              <View style={[styles.playlistThumb, { backgroundColor: colors.surfaceElevated }]}>
                {item.cover_url ? (
                  <Image source={{ uri: item.cover_url }} style={styles.playlistThumb} />
                ) : (
                  <Ionicons name="musical-notes" size={20} color={BRAND.primaryLight} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>{item.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.track_count || item.tracks?.length || 0} şarkı</Text>
              </View>
              {adding === (item.id || item._id) ? (
                <ActivityIndicator size="small" color={BRAND.primary} />
              ) : (
                <Ionicons name="add-circle-outline" size={22} color={BRAND.primary} />
              )}
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id || item._id || String(Math.random())}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="list-outline" size={44} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginTop: 12 }}>Henüz çalma listesi yok</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Yukarıdan yeni bir liste oluşturun</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  trackPreview: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, padding: 12, borderRadius: 14, gap: 12, marginBottom: 16 },
  thumb: { width: 48, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  createBtn: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, padding: 14, borderRadius: 14, gap: 12, marginBottom: 8 },
  createIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  createRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, padding: 12, borderRadius: 14, gap: 8, marginBottom: 16 },
  createInput: { flex: 1, height: 40, borderRadius: 10, paddingHorizontal: 12, fontSize: 14 },
  createSubmit: { backgroundColor: BRAND.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, gap: 12 },
  playlistThumb: { width: 52, height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  empty: { alignItems: 'center', paddingTop: 60 },
});
