import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, FlatList, Image,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { usePlayer } from '../contexts/PlayerContext';
import api from '../services/api';

const SMART_TYPES = [
  { id: 'most_played', label: 'En Çok Dinlenen', icon: 'trending-up', color: BRAND.primary },
  { id: 'recently_added', label: 'Son Eklenen', icon: 'time', color: BRAND.accent },
  { id: 'never_played', label: 'Hiç Dinlenmemiş', icon: 'eye-off', color: '#F59E0B' },
  { id: 'favorites', label: 'Beğeniler', icon: 'heart', color: BRAND.pink },
  { id: 'weekly_mix', label: 'Haftalık Karma', icon: 'shuffle', color: '#10B981' },
  { id: 'mood_happy', label: 'Mutlu Anlar', icon: 'sunny', color: '#F59E0B' },
  { id: 'mood_chill', label: 'Rahatlatıcı', icon: 'leaf', color: '#06B6D4' },
  { id: 'mood_energy', label: 'Enerjik', icon: 'flash', color: '#EF4444' },
  { id: 'activity_workout', label: 'Spor', icon: 'fitness', color: '#EF4444' },
  { id: 'activity_sleep', label: 'Uyku', icon: 'moon', color: '#6366F1' },
  { id: 'activity_study', label: 'Çalışma', icon: 'book', color: '#8B5CF6' },
];

export default function SmartPlaylistScreen({ navigation }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { playTrack } = usePlayer();
  const [selectedType, setSelectedType] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [seasonal, setSeasonal] = useState([]);

  useEffect(() => {
    api.get('/playlists/seasonal-suggestions', token).then(r => setSeasonal(r.suggestions || [])).catch(() => {});
  }, [token]);

  const generatePlaylist = async (type) => {
    setSelectedType(type);
    setLoading(true);
    try {
      const res = await api.post('/playlists/generate-smart', { type: type.id }, token);
      setTracks(res.tracks || res.playlist?.tracks || res.songs || []);
    } catch { setTracks([]); }
    setLoading(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Akıllı Listeler</Text>
        <View style={{ width: 22 }} />
      </View>

      {!selectedType ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>OTOMATİK LİSTELER</Text>
          {SMART_TYPES.map(type => (
            <TouchableOpacity key={type.id} style={[styles.typeCard, { backgroundColor: colors.surfaceElevated }]} onPress={() => generatePlaylist(type)}>
              <View style={[styles.typeIcon, { backgroundColor: `${type.color}18` }]}>
                <Ionicons name={type.icon} size={22} color={type.color} />
              </View>
              <Text style={[styles.typeLabel, { color: colors.text }]}>{type.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ))}

          {seasonal.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 24 }]}>MEVSIMSEL</Text>
              {seasonal.map((s, i) => (
                <TouchableOpacity key={i} style={[styles.typeCard, { backgroundColor: colors.surfaceElevated }]}>
                  <Ionicons name="calendar" size={22} color={BRAND.accent} style={{ marginRight: 12 }} />
                  <Text style={{ color: colors.text, flex: 1 }}>{s.name || s.title}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      ) : (
        <>
          <TouchableOpacity style={styles.backRow} onPress={() => { setSelectedType(null); setTracks([]); }}>
            <Ionicons name="arrow-back" size={18} color={BRAND.primary} />
            <Text style={{ color: BRAND.primary, marginLeft: 6 }}>Tüm Listeler</Text>
          </TouchableOpacity>
          <View style={[styles.selectedHeader, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name={selectedType.icon} size={28} color={selectedType.color} />
            <Text style={[styles.selectedTitle, { color: colors.text }]}>{selectedType.label}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{tracks.length} parça</Text>
          </View>
          {loading ? (
            <ActivityIndicator size="large" color={BRAND.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={tracks}
              renderItem={({ item, index }) => (
                <TouchableOpacity style={[styles.trackRow, { borderBottomColor: colors.border }]} onPress={() => playTrack(item, tracks)}>
                  <Text style={[styles.trackIndex, { color: colors.textMuted }]}>{index + 1}</Text>
                  <View style={[styles.trackThumb, { backgroundColor: colors.card }]}>
                    {item.thumbnail ? <Image source={{ uri: item.thumbnail }} style={styles.trackThumb} /> : <Ionicons name="musical-note" size={16} color={BRAND.primaryLight} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>{item.title}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.artist}</Text>
                  </View>
                </TouchableOpacity>
              )}
              keyExtractor={(item, i) => item.id || `${i}`}
              contentContainerStyle={{ paddingBottom: 120 }}
              ListEmptyComponent={<View style={styles.empty}><Text style={{ color: colors.textMuted }}>Henüz parça yok</Text></View>}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 12 },
  typeCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 8, gap: 12 },
  typeIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  typeLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  backRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  selectedHeader: { marginHorizontal: 16, padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 12, gap: 6 },
  selectedTitle: { fontSize: 20, fontWeight: '700' },
  trackRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, gap: 10 },
  trackIndex: { width: 24, textAlign: 'center', fontSize: 13 },
  trackThumb: { width: 46, height: 46, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  empty: { alignItems: 'center', paddingTop: 60 },
});
