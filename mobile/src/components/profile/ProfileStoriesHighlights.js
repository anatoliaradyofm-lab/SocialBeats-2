/**
 * ProfileStoriesHighlights - Hikaye arşivi ve vurgular
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { getApiUrl } from '../../services/api';

const mediaUri = (uri) => {
  if (!uri) return null;
  if (uri.startsWith('http')) return uri;
  const base = (getApiUrl() || '').replace(/\/api\/?$/, '');
  return uri.startsWith('/') ? `${base}${uri}` : `${base}/api/${uri}`;
};

export default function ProfileStoriesHighlights({ userId, username, token, isOwnProfile, onNavigate }) {
  const [highlights, setHighlights] = useState([]);
  const [archiveCount, setArchiveCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const results = [];
        if (userId) {
          const [hl1, hl2] = await Promise.all([
            api.get(`/user/${userId}/highlights`, token).catch(() => []),
            api.get(`/stories/highlights/${userId}`, token).catch(() => []),
          ]);
          const arr1 = Array.isArray(hl1) ? hl1 : [];
          const arr2 = Array.isArray(hl2) ? hl2 : [];
          const seen = new Set();
          for (const h of [...arr1, ...arr2]) {
            if (h?.id && !seen.has(h.id)) {
              seen.add(h.id);
              results.push({ ...h, name: h.name || h.title || 'Highlight' });
            }
          }
        }
        setHighlights(results);
        if (isOwnProfile) {
          const arch = await api.get('/stories/archive', token);
          setArchiveCount(Array.isArray(arch) ? arch.length : 0);
        }
      } catch {
        setHighlights([]);
      }
    };
    load();
  }, [userId, token, isOwnProfile]);

  if (highlights.length === 0 && (!isOwnProfile || archiveCount === 0)) return null;

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {isOwnProfile && archiveCount > 0 && (
          <TouchableOpacity style={styles.item} onPress={() => onNavigate?.('archive')}>
            <View style={[styles.ring, styles.archiveRing]}>
              <Ionicons name="time-outline" size={24} color="#8B5CF6" />
            </View>
            <Text style={styles.label} numberOfLines={1}>Arşiv</Text>
          </TouchableOpacity>
        )}
        {highlights.map((hl) => (
          <TouchableOpacity key={hl.id} style={styles.item} onPress={() => onNavigate?.('highlight', hl)}>
            <View style={styles.ring}>
              <Image
                source={{ uri: mediaUri(hl.cover_url) || 'https://i.pravatar.cc/100' }}
                style={styles.cover}
              />
            </View>
            <Text style={styles.label} numberOfLines={1}>{hl.name || hl.title || 'Highlight'}</Text>
            {hl.story_count > 0 && (
              <Text style={styles.count}>{hl.story_count}</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  row: { paddingHorizontal: 4, gap: 16 },
  item: { alignItems: 'center', width: 72 },
  ring: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#8B5CF6',
    overflow: 'hidden',
    marginBottom: 6,
  },
  archiveRing: { backgroundColor: '#1F2937', justifyContent: 'center', alignItems: 'center' },
  cover: { width: '100%', height: '100%' },
  label: { fontSize: 12, color: '#9CA3AF', maxWidth: 72 },
  count: { fontSize: 10, color: '#6B7280', marginTop: 2 },
});
