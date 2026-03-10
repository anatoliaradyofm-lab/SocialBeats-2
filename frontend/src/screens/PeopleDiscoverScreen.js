import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, FlatList,
  StyleSheet, TextInput, RefreshControl, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

const { width: SW } = Dimensions.get('window');
const CARD_W = (SW - 48) / 2;

const CATEGORIES = [
  { id: 'suggested', label: 'Önerilen', icon: 'sparkles' },
  { id: 'popular', label: 'Popüler', icon: 'trending-up' },
  { id: 'nearby', label: 'Yakın', icon: 'location' },
  { id: 'artists', label: 'Sanatçılar', icon: 'mic' },
];

function PersonCard({ person, colors, onPress, onFollow }) {
  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.surfaceElevated }]} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.cardAvatarWrap, { backgroundColor: colors.card }]}>
        {person.avatar_url ? (
          <Image source={{ uri: person.avatar_url }} style={styles.cardAvatar} />
        ) : (
          <Ionicons name="person" size={32} color={BRAND.primaryLight} />
        )}
      </View>
      <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{person.display_name || person.username}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>@{person.username}</Text>
      {person.bio ? <Text style={{ color: colors.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 4 }} numberOfLines={2}>{person.bio}</Text> : null}
      <View style={styles.cardStats}>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{person.followers_count || 0} takipçi</Text>
      </View>
      <TouchableOpacity
        style={[styles.followBtn, { backgroundColor: person.is_following ? colors.card : BRAND.primary }]}
        onPress={onFollow}
        activeOpacity={0.8}
      >
        <Text style={[styles.followBtnText, { color: person.is_following ? colors.text : '#FFF' }]}>
          {person.is_following ? 'Takipte' : 'Takip Et'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function PeopleDiscoverScreen({ navigation }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const [category, setCategory] = useState('suggested');
  const [people, setPeople] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchPeople = useCallback(async () => {
    try {
      const res = await api.get(`/users/discover?category=${category}`, token);
      setPeople(res.users || res || []);
    } catch { setPeople([]); }
  }, [token, category]);

  useEffect(() => { fetchPeople(); }, [fetchPeople]);
  const onRefresh = async () => { setRefreshing(true); await fetchPeople(); setRefreshing(false); };

  const handleFollow = async (userId) => {
    try {
      await api.post(`/social/follow/${userId}`, {}, token);
      setPeople(prev => prev.map(p => p.id === userId || p._id === userId ? { ...p, is_following: !p.is_following } : p));
    } catch {}
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Kişiler</Text>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.surfaceElevated }]}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Kişi ara..." placeholderTextColor={colors.textMuted} value={searchQuery} onChangeText={setSearchQuery} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
        {CATEGORIES.map(c => (
          <TouchableOpacity
            key={c.id}
            style={[styles.catChip, { backgroundColor: category === c.id ? BRAND.primary : colors.surfaceElevated }]}
            onPress={() => setCategory(c.id)}
          >
            <Ionicons name={c.icon} size={14} color={category === c.id ? '#FFF' : colors.textMuted} />
            <Text style={{ color: category === c.id ? '#FFF' : colors.textSecondary, fontSize: 13, fontWeight: '500' }}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={people}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => (
          <PersonCard
            person={item}
            colors={colors}
            onPress={() => navigation.navigate('UserProfile', { userId: item.id || item._id })}
            onFollow={() => handleFollow(item.id || item._id)}
          />
        )}
        keyExtractor={(item, i) => item.id || item._id || `${i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name="people-outline" size={48} color={BRAND.primaryLight} /></View>
            <Text style={{ color: colors.textMuted, marginTop: 16 }}>Henüz kimse yok</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 54, paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },

  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, height: 40, gap: 8 },
  searchInput: { flex: 1, fontSize: 14 },

  catRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6 },

  gridRow: { justifyContent: 'space-between', marginBottom: 12 },
  card: { width: CARD_W, borderRadius: 16, padding: 16, alignItems: 'center' },
  cardAvatarWrap: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 10 },
  cardAvatar: { width: 72, height: 72, borderRadius: 36 },
  cardName: { fontSize: 14, fontWeight: '600' },
  cardStats: { marginTop: 6 },
  followBtn: { marginTop: 10, paddingHorizontal: 24, paddingVertical: 8, borderRadius: 20 },
  followBtnText: { fontSize: 12, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(124,58,237,0.1)', justifyContent: 'center', alignItems: 'center' },
});
