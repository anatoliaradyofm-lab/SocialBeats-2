import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, TextInput, StyleSheet, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

export default function CloseFriendsScreen({ navigation }) {
  const { user: currentUser, token } = useAuth();
  const { colors } = useTheme();
  const [friends, setFriends] = useState([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [closeFriendIds, setCloseFriendIds] = useState(new Set());

  const fetchFriends = useCallback(async () => {
    try {
      const res = await api.get('/social/close-friends', token);
      const list = res.close_friends || res.users || res || [];
      setFriends(list);
      setCloseFriendIds(new Set(list.map(f => f.id || f._id)));
    } catch { setFriends([]); }
  }, [token]);

  const fetchSuggestions = useCallback(async () => {
    try {
      const uid = currentUser?.id || 'me';
      const res = await api.get(`/social/following/${uid}`, token);
      setSuggestions(res.following || res.users || []);
    } catch {}
  }, [token, currentUser]);

  useEffect(() => { fetchFriends(); fetchSuggestions(); }, [fetchFriends, fetchSuggestions]);
  const onRefresh = async () => { setRefreshing(true); await fetchFriends(); await fetchSuggestions(); setRefreshing(false); };

  const toggleCloseFriend = async (userId, isClose) => {
    try {
      if (isClose) {
        await api.delete(`/social/close-friends/${userId}`, token);
        setFriends(prev => prev.filter(f => (f.id || f._id) !== userId));
        setCloseFriendIds(prev => { const n = new Set(prev); n.delete(userId); return n; });
      } else {
        await api.post(`/social/close-friends/${userId}`, {}, token);
        setCloseFriendIds(prev => new Set(prev).add(userId));
        fetchFriends();
      }
    } catch {}
  };

  const filtered = friends.filter(f => (f.username || f.display_name || '').toLowerCase().includes(search.toLowerCase()));
  const suggestionsFiltered = suggestions.filter(s => {
    const uid = s.id || s._id;
    return !closeFriendIds.has(uid) && (s.username || s.display_name || '').toLowerCase().includes(search.toLowerCase());
  });

  const renderItem = ({ item, section }) => {
    const uid = item.id || item._id;
    const isClose = closeFriendIds.has(uid);
    return (
      <View style={[styles.row, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }} onPress={() => navigation.navigate('UserProfile', { userId: uid })}>
          <View style={[styles.avatar, { backgroundColor: colors.card }]}>
            {item.avatar_url ? <Image source={{ uri: item.avatar_url }} style={styles.avatar} /> : <Ionicons name="person" size={18} color={BRAND.primaryLight} />}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: colors.text, fontWeight: '500' }}>{item.display_name || item.username}</Text>
              {isClose && <Ionicons name="star" size={12} color="#10B981" />}
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>@{item.username}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[isClose ? styles.removeBtn : styles.addBtn, { backgroundColor: isClose ? colors.surfaceElevated : BRAND.primary + '15' }]}
          onPress={() => toggleCloseFriend(uid, isClose)}
        >
          <Text style={{ color: isClose ? colors.text : BRAND.primary, fontSize: 12, fontWeight: '600' }}>
            {isClose ? 'Çıkar' : 'Ekle'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Yakın Arkadaşlar</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={[styles.infoCard, { backgroundColor: colors.surfaceElevated }]}>
        <Ionicons name="star" size={20} color="#10B981" />
        <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1, marginLeft: 10 }}>
          Yakın arkadaşlarınla özel hikaye ve içerik paylaşabilirsin.
        </Text>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.surfaceElevated }]}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Ara..." placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
      </View>

      <FlatList
        data={[...filtered, ...(suggestionsFiltered.length > 0 ? [{ _separator: true }] : []), ...suggestionsFiltered]}
        renderItem={({ item }) => {
          if (item._separator) {
            return (
              <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>TAKİP ETTİKLERİN</Text>
              </View>
            );
          }
          return renderItem({ item });
        }}
        keyExtractor={(item, i) => item._separator ? '_sep' : (item.id || item._id || `${i}`)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          friends.length > 0 ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>YAKIN ARKADAŞLAR ({friends.length})</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 40 }}>
            <Ionicons name="star-outline" size={44} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 12 }}>Henüz yakın arkadaş yok</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Takip ettiklerinden ekleyebilirsin</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  infoCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, padding: 14, borderRadius: 14, marginBottom: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, height: 40, gap: 8, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  removeBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  addBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
});
