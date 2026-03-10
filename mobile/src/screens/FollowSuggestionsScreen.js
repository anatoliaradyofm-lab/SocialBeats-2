/**
 * Takip önerileri ve popüler kullanıcılar
 * GET /social/suggestions/users + GET /discover/popular?content_type=users
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, RefreshControl} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const avatar = (u) => u?.avatar_url || `https://i.pravatar.cc/100?u=${u?.username || u?.id}`;

export default function FollowSuggestionsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [popular, setPopular] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [following, setFollowing] = useState({}); // id -> true when follow request sent

  const load = async () => {
    if (!token) return;
    try {
      const [sug, popRes] = await Promise.all([
        api.get('/social/suggestions/users', token).catch(() => []),
        api.get('/discover/popular?content_type=users&limit=20', token).catch(() => ({})),
      ]);
      setSuggestions(Array.isArray(sug) ? sug : []);
      setPopular(Array.isArray(popRes?.users) ? popRes.users : []);
    } catch {
      setSuggestions([]);
      setPopular([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const followUser = async (user) => {
    try {
      await api.post(`/social/friend-request/${user.id}`, {}, token);
      setFollowing((f) => ({ ...f, [user.id]: true }));
    } catch {}
  };

  const renderUser = ({ item }) => (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.left}
        onPress={() => navigation.navigate('UserProfile', { username: item.username })}
        activeOpacity={0.8}
      >
        <Image source={{ uri: avatar(item) }} style={styles.avatar} />
        <View style={styles.info}>
          <Text style={styles.name}>{item.display_name || item.username}</Text>
          <Text style={styles.username}>@{item.username}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.followBtn, following[item.id] && styles.followBtnDone]}
        onPress={() => !following[item.id] && followUser(item)}
        disabled={!!following[item.id]}
      >
        <Text style={styles.followBtnText}>{following[item.id] ? 'İstek gönderildi' : 'Arkadaş ol'}</Text>
      </TouchableOpacity>
    </View>
  );

  const sections = [
    ...(suggestions.length > 0 ? [{ title: 'Takip önerileri', data: suggestions }] : []),
    ...(popular.length > 0 ? [{ title: 'Popüler kullanıcılar', data: popular }] : []),
  ];

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Keşfet</Text>
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
        <Text style={styles.title}>Keşfet</Text>
      </View>
      <FlatList
        data={sections.flatMap((s) => [{ _section: s.title }, ...s.data.map((u) => ({ ...u, _section: s.title }))])}
        keyExtractor={(item, i) => item._section ? `sec-${i}` : item.id}
        renderItem={({ item }) =>
          item._section ? (
            <Text style={styles.sectionTitle}>{item._section}</Text>
          ) : (
            renderUser({ item })
          )
        }
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListEmptyComponent={<Text style={styles.empty}>Henüz öneri yok</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#8B5CF6" />}
      />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  backBtn: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  sectionTitle: { fontSize: 14, color: '#9CA3AF', marginTop: 20, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 14 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  username: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
  followBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#8B5CF6' },
  followBtnDone: { backgroundColor: '#374151' },
  followBtnText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  empty: { color: '#9CA3AF', textAlign: 'center', padding: 40 },
});
