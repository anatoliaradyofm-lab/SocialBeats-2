import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, FlatList,
  StyleSheet, Modal, TextInput, RefreshControl, Alert, SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

const TABS = [
  { key: 'highlights', label: 'Vurgular' },
  { key: 'archive', label: 'Arşiv' },
];

export default function HighlightsScreen({ navigation }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState('highlights');
  const [highlights, setHighlights] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const [editingHighlight, setEditingHighlight] = useState(null);
  const [editName, setEditName] = useState('');

  const [highlightStories, setHighlightStories] = useState([]);
  const [viewingHighlight, setViewingHighlight] = useState(null);

  const [archiveMonths, setArchiveMonths] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const fetchHighlights = useCallback(async () => {
    try {
      const res = await api.get('/highlights', token);
      setHighlights(res.highlights || res || []);
    } catch { setHighlights([]); }
  }, [token]);

  const fetchArchive = useCallback(async () => {
    setArchiveLoading(true);
    try {
      const res = await api.get('/stories/archive/monthly', token);
      setArchiveMonths(res.months || []);
    } catch { setArchiveMonths([]); }
    setArchiveLoading(false);
  }, [token]);

  useEffect(() => {
    fetchHighlights();
    fetchArchive();
  }, [fetchHighlights, fetchArchive]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHighlights();
    await fetchArchive();
    setRefreshing(false);
  };

  const createHighlight = async () => {
    if (!newName.trim()) return;
    try {
      await api.post('/highlights', { name: newName.trim() }, token);
      setShowCreate(false); setNewName('');
      fetchHighlights();
    } catch {}
  };

  const updateHighlight = async () => {
    if (!editingHighlight || !editName.trim()) return;
    try {
      await api.put(`/highlights/${editingHighlight.id}`, { name: editName.trim() }, token);
      setEditingHighlight(null); setEditName('');
      fetchHighlights();
    } catch {}
  };

  const deleteHighlight = (id) => {
    Alert.alert('Silme Onayı', 'Bu vurguyu silmek istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
    try { await api.delete(`/highlights/${id}`, token); fetchHighlights(); } catch {}
      }},
    ]);
  };

  const openHighlight = async (highlight) => {
    try {
      const res = await api.get(`/highlights/${highlight.id}/stories`, token);
      const stories = res.stories || res || [];
      if (stories.length > 0) {
        navigation.navigate('StoryViewer', { stories, startIndex: 0 });
      } else {
        Alert.alert('', 'Bu vurguda hikaye yok');
      }
    } catch { Alert.alert('Hata', 'Hikayeler yüklenemedi'); }
  };

  const removeStoryFromHighlight = async (highlightId, storyId) => {
    try {
      await api.delete(`/highlights/${highlightId}/stories/${storyId}`, token);
      setHighlightStories(prev => prev.filter(s => s.id !== storyId));
      fetchHighlights();
    } catch {}
  };

  const viewHighlightStories = async (highlight) => {
    try {
      const res = await api.get(`/highlights/${highlight.id}/stories`, token);
      setHighlightStories(res.stories || res || []);
      setViewingHighlight(highlight);
    } catch { setHighlightStories([]); setViewingHighlight(highlight); }
  };

  const viewArchiveStory = (story) => {
    navigation.navigate('StoryViewer', { stories: [story], startIndex: 0 });
  };

  const formatMonth = (key) => {
    if (!key || key === 'unknown') return 'Bilinmeyen';
    try {
      const [y, m] = key.split('-');
      const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      return `${months[parseInt(m) - 1]} ${y}`;
    } catch { return key; }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Hikayeler</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={24} color={BRAND.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && { borderBottomColor: BRAND.primary }]}>
            <Text style={{ color: activeTab === tab.key ? BRAND.primary : colors.textMuted, fontWeight: activeTab === tab.key ? '600' : '400' }}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'highlights' && (
      <FlatList
        data={highlights}
        numColumns={3}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => (
            <TouchableOpacity style={styles.highlightItem} onPress={() => openHighlight(item)}
              onLongPress={() => { setEditingHighlight(item); setEditName(item.name); }}>
            <View style={[styles.highlightCover, { backgroundColor: colors.surfaceElevated }]}>
              {item.cover_url ? (
                <Image source={{ uri: item.cover_url }} style={styles.highlightCover} />
              ) : (
                <Ionicons name="bookmark" size={28} color={BRAND.primaryLight} />
              )}
            </View>
            <Text style={{ color: colors.text, fontSize: 12, marginTop: 6 }} numberOfLines={1}>{item.name}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 10 }}>{item.story_count || 0} hikaye</Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item, i) => item.id || item._id || `${i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="bookmark-outline" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 16 }}>Henüz vurgu yok</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCreate(true)}>
              <Text style={{ color: '#FFF', fontWeight: '600' }}>İlk Vurguyu Oluştur</Text>
            </TouchableOpacity>
          </View>
        }
      />
      )}

      {activeTab === 'archive' && (
        <SectionList
          sections={archiveMonths.map(m => ({ title: formatMonth(m.month), data: m.stories || [] }))}
          keyExtractor={(item, i) => item.id || `${i}`}
          renderSectionHeader={({ section }) => (
            <View style={[styles.monthHeader, { backgroundColor: colors.background }]}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{section.title}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{section.data.length} hikaye</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.archiveRow, { borderBottomColor: colors.border }]} onPress={() => viewArchiveStory(item)}>
              <View style={[styles.archiveThumb, { backgroundColor: item.background_color || colors.surfaceElevated }]}>
                {item.media_url ? (
                  <Image source={{ uri: item.media_url }} style={styles.archiveThumb} />
                ) : (
                  <Ionicons name={item.story_type === 'poll' ? 'bar-chart' : 'text'} size={18} color="#FFF" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '500' }} numberOfLines={1}>
                  {item.caption || item.text || (item.story_type === 'poll' ? 'Anket' : 'Hikaye')}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                  {item.created_at ? new Date(item.created_at).toLocaleDateString('tr-TR') : ''}
                  {item.viewers_count ? ` · ${item.viewers_count} görüntüleme` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginTop: 16 }}>Arşivde hikaye yok</Text>
            </View>
          }
        />
      )}

      {/* Create Modal */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Yeni Vurgu</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="Vurgu adı..." placeholderTextColor={colors.textMuted}
              value={newName} onChangeText={setNewName} autoFocus
            />
            <TouchableOpacity style={styles.modalBtn} onPress={createHighlight}>
              <Text style={{ color: '#FFF', fontWeight: '700' }}>Oluştur</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', marginTop: 12 }} onPress={() => setShowCreate(false)}>
              <Text style={{ color: colors.textMuted }}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      {editingHighlight && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Vurguyu Düzenle</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder="Vurgu adı..." placeholderTextColor={colors.textMuted}
                value={editName} onChangeText={setEditName}
              />
              <TouchableOpacity style={styles.modalBtn} onPress={updateHighlight}>
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Kaydet</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surfaceElevated, marginTop: 8 }]}
                onPress={() => viewHighlightStories(editingHighlight)}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Hikayeleri Yönet</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#EF4444', marginTop: 8 }]}
                onPress={() => { setEditingHighlight(null); deleteHighlight(editingHighlight.id); }}>
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Sil</Text>
              </TouchableOpacity>

              <TouchableOpacity style={{ alignItems: 'center', marginTop: 12 }} onPress={() => setEditingHighlight(null)}>
                <Text style={{ color: colors.textMuted }}>İptal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Highlight Stories Management Modal */}
      {viewingHighlight && (
        <Modal visible transparent animationType="slide">
          <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: 54 }]}>
              <TouchableOpacity onPress={() => setViewingHighlight(null)}>
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: colors.text }]}>{viewingHighlight.name}</Text>
              <View style={{ width: 24 }} />
            </View>
            <FlatList
              data={highlightStories}
              renderItem={({ item }) => (
                <View style={[styles.archiveRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.archiveThumb, { backgroundColor: item.background_color || colors.surfaceElevated }]}>
                    {item.media_url ? (
                      <Image source={{ uri: item.media_url }} style={styles.archiveThumb} />
                    ) : <Ionicons name="image" size={16} color="#FFF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text }} numberOfLines={1}>{item.caption || item.text || 'Hikaye'}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>{item.created_at ? new Date(item.created_at).toLocaleDateString('tr-TR') : ''}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeStoryFromHighlight(viewingHighlight.id, item.id)}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              )}
              keyExtractor={(item, i) => item.id || `${i}`}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: 'center', padding: 40 }}>Bu vurguda hikaye yok</Text>}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 0.5 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  gridRow: { justifyContent: 'flex-start', gap: 16 },
  highlightItem: { alignItems: 'center', marginBottom: 16 },
  highlightCover: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 2, borderColor: BRAND.primary },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyBtn: { marginTop: 20, backgroundColor: BRAND.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  archiveRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12, borderBottomWidth: 0.5 },
  archiveThumb: { width: 48, height: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 16 },
  modalBtn: { backgroundColor: BRAND.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
});
