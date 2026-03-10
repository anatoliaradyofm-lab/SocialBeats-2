import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, TextInput, StyleSheet, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

export default function FollowersListScreen({ route, navigation }) {
  const { userId } = route?.params || {};
  const { user: currentUser, token } = useAuth();
  const { colors } = useTheme();
  const [followers, setFollowers] = useState([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const targetId = userId || currentUser?.id || 'me';

  const fetchFollowers = useCallback(async () => {
    try {
      const res = await api.get(`/social/followers/${targetId}`, token);
      setFollowers(res.followers || res.users || res || []);
    } catch { setFollowers([]); }
  }, [token, targetId]);

  useEffect(() => { fetchFollowers(); }, [fetchFollowers]);
  const onRefresh = async () => { setRefreshing(true); await fetchFollowers(); setRefreshing(false); };

  const toggleFollow = async (uid) => {
    const f = followers.find(u => (u.id || u._id) === uid);
    const isFollowing = f?.is_following;
    try {
      if (isFollowing) {
        await api.delete(`/social/unfollow/${uid}`, token);
      } else {
        await api.post(`/social/follow/${uid}`, {}, token);
      }
      setFollowers(prev => prev.map(u =>
        (u.id || u._id) === uid ? { ...u, is_following: !isFollowing } : u
      ));
    } catch {}
  };

  const filtered = followers.filter(f => (f.username || f.display_name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Takipçiler</Text>
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
          const isSelf = uid === currentUser?.id;
          return (
            <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={() => navigation.navigate('UserProfile', { userId: uid })}>
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
              {!isSelf && (
                <TouchableOpacity
                  style={[styles.followBtn, { backgroundColor: item.is_following ? colors.surfaceElevated : BRAND.primary }]}
                  onPress={() => toggleFollow(uid)}
                >
                  <Text style={{ color: item.is_following ? colors.text : '#FFF', fontSize: 12, fontWeight: '600' }}>
                    {item.is_following ? 'Takipte' : 'Takip Et'}
                  </Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        }}
        keyExtractor={(item, i) => item.id || item._id || `${i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}
        ListEmptyComponent={<View style={styles.empty}><Text style={{ color: colors.textMuted }}>Takipçi yok</Text></View>}
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
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  followBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 },
  mutualBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  empty: { alignItems: 'center', paddingTop: 80 },
});
