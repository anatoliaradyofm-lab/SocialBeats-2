import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Image,
  StyleSheet, Dimensions, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import BottomSheet from './ui/BottomSheet';
import api from '../services/api';

const { width: SW } = Dimensions.get('window');
const COLS = 2;
const GIF_SIZE = (SW - 48 - 8) / COLS;

export default function GifPicker({ visible, onClose, onSelect }) {
  const { colors } = useTheme();
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('trending');
  const searchTimer = useRef(null);

  useEffect(() => {
    if (visible) loadTrending();
    return () => clearTimeout(searchTimer.current);
  }, [visible]);

  const loadTrending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/gifs/trending?limit=30', token);
      setGifs(res.gifs || []);
    } catch { setGifs([]); }
    setLoading(false);
  }, [token]);

  const searchGifs = useCallback(async (text) => {
    if (!text.trim()) { loadTrending(); setTab('trending'); return; }
    setLoading(true);
    setTab('search');
    try {
      const res = await api.get(`/gifs/search?q=${encodeURIComponent(text)}&limit=30`, token);
      setGifs(res.gifs || []);
    } catch { setGifs([]); }
    setLoading(false);
  }, [token, loadTrending]);

  const handleQueryChange = (text) => {
    setQuery(text);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchGifs(text), 400);
  };

  const handleSelect = (gif) => {
    onSelect?.(gif);
    onClose?.();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} height={0.7}>
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        <Text style={[styles.title, { color: colors.text }]}>GIF Gönder</Text>

        <View style={[styles.searchBar, { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="GIF ara..." placeholderTextColor={colors.textMuted}
            value={query} onChangeText={handleQueryChange}
            returnKeyType="search" onSubmitEditing={() => searchGifs(query)}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); loadTrending(); setTab('trending'); }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
          <TouchableOpacity style={[styles.tab, tab === 'trending' && { borderBottomColor: BRAND.primary }]} onPress={() => { setTab('trending'); setQuery(''); loadTrending(); }}>
            <Ionicons name="flame" size={14} color={tab === 'trending' ? BRAND.primary : colors.textMuted} />
            <Text style={{ color: tab === 'trending' ? BRAND.primary : colors.textMuted, fontSize: 12, fontWeight: '600' }}>Trend</Text>
          </TouchableOpacity>
          {tab === 'search' && (
            <View style={[styles.tab, { borderBottomColor: BRAND.primary }]}>
              <Ionicons name="search" size={14} color={BRAND.primary} />
              <Text style={{ color: BRAND.primary, fontSize: 12, fontWeight: '600' }}>Sonuçlar</Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={BRAND.primary} /></View>
        ) : (
          <FlatList
            data={gifs}
            numColumns={COLS}
            keyExtractor={(item, i) => item.id || item.url || `${i}`}
            columnWrapperStyle={{ gap: 8 }}
            contentContainerStyle={{ paddingBottom: 20, gap: 8 }}
            renderItem={({ item }) => {
              const url = item.preview_url || item.url || item.images?.fixed_height?.url;
              if (!url) return null;
              return (
                <TouchableOpacity onPress={() => handleSelect(item)} activeOpacity={0.8}>
                  <Image source={{ uri: url }} style={[styles.gifItem, { backgroundColor: colors.skeleton }]} resizeMode="cover" />
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.center}>
                <Ionicons name="images-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, marginTop: 8 }}>{tab === 'search' ? 'Sonuç bulunamadı' : 'GIF yükleniyor...'}</Text>
              </View>
            }
          />
        )}

        <Text style={[styles.powered, { color: colors.textMuted }]}>Powered by GIPHY</Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 4 },
  tabs: { flexDirection: 'row', gap: 20, borderBottomWidth: 1, marginBottom: 10 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  gifItem: { width: GIF_SIZE, height: GIF_SIZE * 0.75, borderRadius: 10 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  powered: { fontSize: 10, textAlign: 'center', paddingVertical: 6 },
});
