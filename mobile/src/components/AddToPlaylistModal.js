/**
 * AddToPlaylistModal — shows user playlists and adds a track to the selected one.
 */
import React from 'react';
import {
  Modal, View, Text, StyleSheet, FlatList, TouchableOpacity,
  Pressable, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { getPlaylistsCache, enqueuePendingTrack } from '../lib/playlistStore';

export default function AddToPlaylistModal({ visible, track, onClose }) {
  const { colors } = useTheme();
  const playlists = getPlaylistsCache().filter(p => !p.id?.startsWith('pl-')); // skip placeholders

  const handleSelect = (playlist) => {
    if (!track || !playlist?.id) return;
    enqueuePendingTrack(playlist.id, track);
    onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[s.overlay, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={e => e.stopPropagation()}>
          {/* Handle */}
          <View style={[s.handle, { backgroundColor: colors.border }]} />

          <Text style={[s.title, { color: colors.text }]}>Çalma Listesine Ekle</Text>

          {playlists.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="musical-notes-outline" size={40} color={colors.textMuted} />
              <Text style={[s.emptyText, { color: colors.textMuted }]}>Henüz çalma listesi yok</Text>
              <Text style={[s.emptySubText, { color: colors.textGhost || colors.textMuted }]}>
                Kütüphane ekranından oluşturabilirsin
              </Text>
            </View>
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={item => item.id}
              style={s.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.row, { borderBottomColor: colors.border }]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  {item.covers?.[0] || item.cover ? (
                    <Image
                      source={{ uri: item.covers?.[0] || item.cover }}
                      style={s.cover}
                    />
                  ) : (
                    <View style={[s.cover, s.coverFallback, { backgroundColor: colors.surface }]}>
                      <Ionicons name="musical-notes" size={18} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={s.info}>
                    <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[s.meta, { color: colors.textMuted }]}>{item.track_count ?? 0} parça</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:      { flex: 1, justifyContent: 'flex-end' },
  sheet:        { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, paddingTop: 12, paddingBottom: 40, maxHeight: '70%' },
  handle:       { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title:        { fontSize: 18, fontWeight: '800', paddingHorizontal: 20, marginBottom: 12 },
  list:         { flexGrow: 0 },
  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 14 },
  cover:        { width: 48, height: 48, borderRadius: 10 },
  coverFallback:{ alignItems: 'center', justifyContent: 'center' },
  info:         { flex: 1 },
  name:         { fontSize: 15, fontWeight: '700' },
  meta:         { fontSize: 12, marginTop: 2 },
  empty:        { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText:    { fontSize: 16, fontWeight: '600' },
  emptySubText: { fontSize: 13 },
});
