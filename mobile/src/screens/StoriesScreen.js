/**
 * StoriesScreen - 24 saatlik hikayeler
 * Backend: GET /stories/feed, /stories/my
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  useWindowDimensions, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

export default function StoriesScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { token } = useAuth();
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFeed = async () => {
    if (!token) return;
    try {
      const res = await api.get('/stories/feed', token);
      setFeed(Array.isArray(res) ? res : []);
    } catch {
      setFeed([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadFeed();
  };

  const COL_SIZE = width * 0.2;
  const renderUserStory = ({ item, index }) => {
    const firstStory = item.stories?.[0];
    const hasUnviewed = item.has_unviewed;
    const avatar = item.user_avatar || `https://i.pravatar.cc/100?u=${item.username}`;

    return (
      <TouchableOpacity
        style={[styles.storyCircle, { width: COL_SIZE, height: COL_SIZE + 36 }]}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('StoryViewer', { feed, startUserIndex: index })}
      >
        <View style={[styles.avatarRing, hasUnviewed && styles.avatarRingUnviewed]}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
        </View>
        <Text style={styles.username} numberOfLines={1}>{item.username}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Hikayeler</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Hikayeler</Text>
        <TouchableOpacity onPress={() => navigation.navigate('StoryCreate')} style={styles.addBtn}>
          <Ionicons name="add" size={24} color="#8B5CF6" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={feed}
        renderItem={renderUserStory}
        keyExtractor={(item) => item.user_id}
        numColumns={4}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="add-circle-outline" size={64} color="#555" />
            <Text style={styles.emptyText}>Henüz hikaye yok</Text>
            <Text style={styles.emptySub}>Takip ettiğin kişilerin hikayeleri burada görünür</Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  backBtn: { padding: 4, marginRight: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
  addBtn: { padding: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  storyCircle: { alignItems: 'center', marginBottom: 16 },
  avatarRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    padding: 3,
    borderWidth: 2,
    borderColor: '#374151',
    marginBottom: 6,
  },
  avatarRingUnviewed: { borderColor: '#8B5CF6' },
  avatar: { width: '100%', height: '100%', borderRadius: 32 },
  username: { fontSize: 12, color: '#9CA3AF' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#9CA3AF', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#6B7280', marginTop: 8 },
});
