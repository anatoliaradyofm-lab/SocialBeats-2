import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, TextInput, StyleSheet, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

export default function FollowingListScreen({ route, navigation }) {
  const { userId } = route?.params || {};
  const { user: currentUser, token } = useAuth();
  const { colors } = useTheme();
  const [following, setFollowing] = useState([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const targetId = userId || currentUser?.id || 'me';

  const fetchFollowing = useCallback(async () => {
    try {
      const res = await api.get(`/social/following/${targetId}`, token);
      setFollowing(res.following || res.users || res || []);
    } catch { setFollowing([]); }
  }, [token, targetId]);

  useEffect(() => { fetchFollowing(); }, [fetchFollowing]);
  const onRefresh = async () => { setRefreshing(true); await fetchFollowing(); setRefreshing(false); };

  const unfollow = async (uid) => {
    try {
      await api.delete(`/social/unfollow/${uid}`, token);
      setFollowing(prev => prev.filter(u => (u.id || u._id) !== uid));
    } catch {}
  };

  const filtered = following.filter(f => (f.username || f.display_name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Takip Edilenler</Text>
        <View style={{ width: 22 }} />
      </View>
      <View style={[styles.searchBar, { backgroundColor: colors.surfaceElevated }]}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Ara..." placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
      </View>
      <FlatList
        data={filtered}
        renderItem={({ item }) => {
          const uid = item.id || item._id;
          return (
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }} onPress={() => navigation.navigate('UserProfile', { userId: uid })}>
                <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated }]}>
                  {item.avatar_url ? <Image source={{ uri: item.avatar_url }} style={styles.avatar} /> : <Ionicons name="person" size={18} color={BRAND.primaryLight} />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>{item.display_name || item.username}</Text>
                    {item.is_mutual && <View style={[styles.mutualBadge, { backgroundColor: BRAND.primary + '20' }]}>
                      <Ionicons name="people" size={10} color={BRAND.primary} />
                      <Text style={{ color: BRAND.primary, fontSize: 9, fontWeight: '600' }}>Karşılıklı</Text>
                    </View>}
                  </View>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>@{item.username}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.unfollowBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => unfollow(uid)}>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '500' }}>Takipte</Text>
              </TouchableOpacity>
            </View>
          );
        }}
        keyExtractor={(item, i) => item.id || item._id || `${i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}
        ListEmptyComponent={<View style={styles.empty}><Text style={{ color: colors.textMuted }}>Takip edilen yok</Text></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, height: 40, gap: 8, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  unfollowBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 },
  mutualBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  empty: { alignItems: 'center', paddingTop: 80 },
});
