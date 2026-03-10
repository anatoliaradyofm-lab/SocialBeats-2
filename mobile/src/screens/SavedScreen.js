/**
 * SavedScreen - Kaydedilenler (klasörlü kaydetme)
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Alert, TextInput, Modal} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { getApiUrl } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const mediaUri = (uri) => {
  if (!uri) return null;
  if (uri.startsWith('http')) return uri;
  const base = (getApiUrl() || '').replace(/\/api\/?$/, '');
  return uri.startsWith('/') ? `${base}${uri}` : `${base}/api/${uri}`;
};

export default function SavedScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [posts, setPosts] = useState([]);
  const [folders, setFolders] = useState([{ id: 'all', name: 'all', count: 0 }]);
  const [activeFolder, setActiveFolder] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const loadFolders = async () => {
    try {
      const data = await api.get('/saved/folders', token);
      setFolders(Array.isArray(data) ? data : [{ id: 'all', name: 'all', count: 0 }]);
    } catch {
      setFolders([{ id: 'all', name: 'all', count: 0 }]);
    }
  };

  const loadSaved = async () => {
    try {
      const url = activeFolder === 'all' ? '/saved/posts' : `/saved/posts?folder_id=${activeFolder}`;
      const data = await api.get(url, token);
      setPosts(Array.isArray(data) ? data : []);
    } catch {
      try {
        const res = await api.get('/social/posts/saved?page=1&limit=50', token);
        setPosts(Array.isArray(res) ? res : []);
      } catch {
        setPosts([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFolders();
  }, []);

  useEffect(() => {
    if (token) {
      setLoading(true);
      loadSaved();
    }
  }, [activeFolder, token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFolders();
    await loadSaved();
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api.post('/saved/folders', { name: newFolderName.trim(), is_private: true }, token);
      setShowNewFolder(false);
      setNewFolderName('');
      await loadFolders();
    } catch (e) {
      Alert.alert(t('common.error'), e?.data?.detail || t('common.createFailed'));
    }
  };

  const toggleSave = async (postId) => {
    try {
      await api.post(`/saved/${postId}`, {}, token);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      await loadFolders();
    } catch {
      try {
        await api.post(`/social/posts/${postId}/save`, {}, token);
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      } catch {}
    }
  };

  const renderPost = ({ item }) => {
    const uname = item.username || item.user_id || item.user?.username || 'unknown';
    const avatar = item.user_avatar || item.user?.avatar_url || `https://i.pravatar.cc/50?u=${uname}`;
    const content = item.caption || item.content || item.text || '';
    const media = item.media_urls?.[0] || item.media_url;

    return (
      <View style={styles.post}>
        <View style={styles.postHeader}>
          <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { username: uname })}>
            <Image source={{ uri: avatar }} style={styles.avatar} />
          </TouchableOpacity>
          <View style={styles.postHeaderText}>
            <Text style={styles.username}>@{uname}</Text>
          </View>
          <TouchableOpacity onPress={() => toggleSave(item.id)}>
            <Ionicons name="bookmark" size={22} color="#8B5CF6" />
          </TouchableOpacity>
        </View>
        {content ? <Text style={styles.content}>{content}</Text> : null}
        {media ? (
          <TouchableOpacity onPress={() => item.id && navigation.navigate('PostDetail', { postId: item.id })}>
            <Image source={{ uri: mediaUri(media) }} style={styles.media} resizeMode="cover" />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{t('saved.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('saved.title')}</Text>
        <TouchableOpacity onPress={() => setShowNewFolder(true)} style={styles.addFolderBtn}>
          <Ionicons name="add" size={24} color="#8B5CF6" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.folderScroll} contentContainerStyle={styles.folderRow}>
        {folders.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.folderChip, activeFolder === f.id && styles.folderChipActive]}
            onPress={() => setActiveFolder(f.id)}
          >
            <Text style={[styles.folderChipText, activeFolder === f.id && styles.folderChipTextActive]}>{f.id === 'all' ? t('saved.all') : f.name}</Text>
            <Text style={[styles.folderCount, activeFolder === f.id && styles.folderCountActive]}>{f.count ?? 0}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="bookmark-outline" size={64} color="#555" />
              <Text style={styles.emptyText}>{t('saved.noSaved')}</Text>
            </View>
          }
        />
      )}

      <Modal visible={showNewFolder} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowNewFolder(false)}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24 }]} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t('saved.newFolder')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('saved.folderNamePlaceholder')}
              placeholderTextColor="#6B7280"
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowNewFolder(false); setNewFolderName(''); }}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalOk} onPress={createFolder}>
                <Text style={styles.modalOkText}>{t('saved.create')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  back: { color: colors.accent, fontSize: 16, marginRight: 16 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, flex: 1 },
  addFolderBtn: { padding: 4 },
  folderScroll: { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  folderRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  folderChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.inputBg, marginRight: 8 },
  folderChipActive: { backgroundColor: '#8B5CF6' },
  folderChipText: { fontSize: 14, color: colors.text },
  folderChipTextActive: { color: colors.text, fontWeight: '600' },
  folderCount: { fontSize: 12, color: '#9CA3AF', marginLeft: 6 },
  folderCountActive: { color: 'rgba(255,255,255,0.8)' },
  list: { padding: 16 },
  post: { backgroundColor: colors.inputBg, borderRadius: 12, padding: 16, marginBottom: 16 },
  postHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  postHeaderText: { flex: 1 },
  username: { fontSize: 14, fontWeight: '600', color: colors.text },
  content: { fontSize: 15, color: colors.text, marginTop: 8 },
  media: { height: 200, borderRadius: 8, marginTop: 12 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#7F7F7F', marginTop: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1F2937', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 16 },
  input: { backgroundColor: '#374151', borderRadius: 12, padding: 16, fontSize: 16, color: colors.text, marginBottom: 20 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#374151', alignItems: 'center' },
  modalCancelText: { color: colors.text, fontSize: 16 },
  modalOk: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#8B5CF6', alignItems: 'center' },
  modalOkText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
