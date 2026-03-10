import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, FlatList, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';

const COLS = 3;
const GAP = 2;

export default function ProfilePosts({ onPostPress, liked }) {
  const { user, token } = useAuth();
  const { t } = useTranslation();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // grid | list

  useEffect(() => {
    loadPosts();
  }, [user?.username]);

  const loadPosts = async () => {
    if (!user?.username || !token) {
      setLoading(false);
      return;
    }
    try {
      const endpoint = liked
        ? `/user/${user.username}/liked?limit=50`
        : `/user/${user.username}/activity?limit=50`;
      const res = await api.get(endpoint, token);
      setPosts(res.posts || res.liked || res || []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const { width } = Dimensions.get('window');
  const cellSize = (width - 40 - GAP * (COLS - 1)) / COLS;

  const renderGridItem = ({ item }) => {
    const img = item.image_url || item.cover_url || item.track?.cover_url;
    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => onPostPress?.(item)}
        activeOpacity={0.8}
      >
        {img ? (
          <Image source={{ uri: img }} style={styles.gridImage} />
        ) : (
          <View style={styles.gridPlaceholder}>
            <Ionicons name="musical-notes" size={28} color="#6B7280" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderListItem = ({ item }) => {
    const img = item.image_url || item.cover_url || item.track?.cover_url;
    const title = item.content?.slice(0, 60) || item.track?.title || 'Gönderi';
    return (
      <TouchableOpacity style={styles.listRow} onPress={() => onPostPress?.(item)} activeOpacity={0.7}>
        {img ? (
          <Image source={{ uri: img }} style={styles.listThumb} />
        ) : (
          <View style={styles.listPlaceholder}>
            <Ionicons name="musical-notes" size={24} color="#6B7280" />
          </View>
        )}
        <View style={styles.listInfo}>
          <Text style={styles.listTitle} numberOfLines={2}>{title}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#6B7280" />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{liked ? t('profile.likedTab', 'Beğenilenler') : t('profile.postsTab', 'Gönderiler')}</Text>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'grid' && styles.toggleBtnActive]}
            onPress={() => setViewMode('grid')}
          >
            <Ionicons name="grid" size={20} color={viewMode === 'grid' ? '#fff' : '#6B7280'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list" size={20} color={viewMode === 'list' ? '#fff' : '#6B7280'} />
          </TouchableOpacity>
        </View>
      </View>
      {posts.length === 0 ? (
        <Text style={styles.empty}>{liked ? t('profile.noLiked', 'Henüz beğeni yok') : t('profile.noPosts', 'Henüz gönderi yok')}</Text>
      ) : viewMode === 'grid' ? (
        <View style={[styles.grid, { paddingRight: 0 }]}>
          {posts.map((item, i) => (
            <View key={item.id || i} style={[styles.gridCell, { width: cellSize, height: cellSize, marginRight: (i + 1) % COLS === 0 ? 0 : GAP }]}>
              {renderGridItem({ item })}
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id || item._id || String(Math.random())}
          renderItem={renderListItem}
          scrollEnabled={false}
          style={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  center: { minHeight: 120, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '600', color: '#fff' },
  viewToggle: { flexDirection: 'row', gap: 4 },
  toggleBtn: { padding: 8, borderRadius: 8 },
  toggleBtnActive: { backgroundColor: '#8B5CF6' },
  empty: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: GAP },
  gridCell: { marginBottom: GAP },
  gridItem: { flex: 1, borderRadius: 6, overflow: 'hidden' },
  gridImage: { width: '100%', height: '100%', borderRadius: 6 },
  gridPlaceholder: { flex: 1, backgroundColor: '#1F2937', borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  list: {},
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  listThumb: { width: 56, height: 56, borderRadius: 8, marginRight: 12 },
  listPlaceholder: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#1F2937', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  listInfo: { flex: 1 },
  listTitle: { fontSize: 15, color: '#fff' },
});
