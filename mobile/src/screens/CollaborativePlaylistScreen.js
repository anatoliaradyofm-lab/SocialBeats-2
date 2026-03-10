import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

export default function CollaborativePlaylistScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useTranslation();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/playlists/collaborative', token);
        setPlaylists(Array.isArray(res) ? res : []);
      } catch {
        setPlaylists([]);
      } finally {
        setLoading(false);
      }
    };
    if (token) load();
    else setLoading(false);
  }, [token]);

  const renderPlaylist = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('PlaylistDetail', { playlistId: item.id })}
    >
      <View style={styles.cardIcon}>
        <Ionicons name="people" size={28} color="#8B5CF6" />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cardSub}>{t('collaborative.members', { count: item.collaborators_count || 1 })}</Text>
        <Text style={styles.cardTracks}>{item.tracks_count || 0} {t('search.songs')}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#6B7280" />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('collaborative.title')}</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => {}}>
          <Ionicons name="add" size={24} color="#8B5CF6" />
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : (
        <FlatList
          data={playlists}
          renderItem={renderPlaylist}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={64} color="#555" />
              <Text style={styles.emptyText}>{t('collaborative.noPlaylists')}</Text>
              <Text style={styles.emptySub}>{t('collaborative.noPlaylistsSub')}</Text>
              <TouchableOpacity style={styles.createPlaylistBtn} onPress={() => {}}>
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.createPlaylistText}>{t('collaborative.create')}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  createBtn: { padding: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2937', borderRadius: 16, padding: 16, marginBottom: 12, gap: 14 },
  cardIcon: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#1E1B4B', alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 2 },
  cardSub: { fontSize: 13, color: colors.accent, marginBottom: 2 },
  cardTracks: { fontSize: 12, color: '#6B7280' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#9CA3AF', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center', maxWidth: 260 },
  createPlaylistBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#8B5CF6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginTop: 24 },
  createPlaylistText: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
