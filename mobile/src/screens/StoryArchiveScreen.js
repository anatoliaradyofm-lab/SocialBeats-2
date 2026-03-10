/**
 * StoryArchiveScreen - Hikaye arşivi (son 30 gün)
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator} from 'react-native';
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

export default function StoryArchiveScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.get('/stories/archive', token)
        .then((data) => setStories(Array.isArray(data?.stories) ? data.stories : (Array.isArray(data) ? data : [])))
        .catch(() => setStories([]))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const openArchive = () => {
    if (stories.length === 0) return;
    const feed = [{
      user_id: user?.id,
      username: user?.username || 'Arşiv',
      user_avatar: user?.avatar_url,
      stories,
    }];
    navigation.navigate('StoryViewer', { feed, startUserIndex: 0 });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Hikaye arşivi</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : stories.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="time-outline" size={64} color="#555" />
          <Text style={styles.emptyText}>Arşivlenmiş hikaye yok</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {stories.map((s, i) => (
            <TouchableOpacity
              key={s.id || i}
              style={styles.thumb}
              onPress={openArchive}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: mediaUri(s.media_url) || 'https://via.placeholder.com/100' }}
                style={styles.thumbImg}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  backBtn: { marginRight: 12 },
  title: { fontSize: 18, fontWeight: '600', color: colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#9CA3AF', marginTop: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8 },
  thumb: { width: '33.33%', aspectRatio: 1, padding: 4 },
  thumbImg: { width: '100%', height: '100%', borderRadius: 8 },
});
