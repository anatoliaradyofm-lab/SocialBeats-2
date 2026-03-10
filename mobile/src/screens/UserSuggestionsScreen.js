/**
 * Takip önerileri - GET /social/suggestions/users
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, RefreshControl} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const avatar = (u) => u?.avatar_url || `https://i.pravatar.cc/100?u=${u?.username || u?.id}`;

export default function UserSuggestionsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!token) return;
    try {
      const list = await api.get('/users/discover?limit=30', token);
      setUsers(Array.isArray(list) ? list : []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const follow = async (u) => {
    try {
      await api.post(`/social/friend-request/${u.id}`, {}, token);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch {}
  };

  const renderItem = ({ item }) => (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.left}
        onPress={() => navigation.navigate('UserProfile', { username: item.username })}
        activeOpacity={0.8}
      >
        <Image source={{ uri: avatar(item) }} style={styles.avatar} />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.display_name || item.username}</Text>
            {item.is_verified && <Ionicons name="checkmark-circle" size={16} color="#8B5CF6" style={{ marginLeft: 4 }} />}
          </View>
          <Text style={styles.username}>@{item.username}</Text>
          {item.suggestion_type === 'mutual' && item.mutual_friends > 0 ? (
            <View style={styles.mutualBadge}>
              <Ionicons name="people" size={12} color="#8B5CF6" />
              <Text style={styles.mutualText}>{item.mutual_friends} mutual</Text>
            </View>
          ) : item.follower_count > 0 ? (
            <Text style={styles.followerHint}>{item.follower_count} followers</Text>
          ) : null}
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.followBtn} onPress={() => follow(item)}>
        <Text style={styles.followBtnText}>{t('suggestions.follow')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('suggestions.title')}</Text>
        <TouchableOpacity style={styles.contactsBtn} onPress={() => navigation.navigate('FindContacts')}>
          <Ionicons name="people-outline" size={22} color="#8B5CF6" />
          <Text style={styles.contactsBtnText}>{t('suggestions.findFromContacts')}</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ListEmptyComponent={<Text style={styles.empty}>{t('suggestions.noSuggestions')}</Text>}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#8B5CF6" />}
        />
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  backBtn: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
  contactsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 },
  contactsBtnText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 14 },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '600', color: colors.text, flexShrink: 1 },
  username: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
  mutualBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, backgroundColor: '#1F2937', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' },
  mutualText: { fontSize: 11, color: colors.accent, fontWeight: '600' },
  followerHint: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  followBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#8B5CF6' },
  followBtnText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  empty: { color: '#9CA3AF', textAlign: 'center', padding: 40 },
});
