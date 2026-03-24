/**
 * Takipçi listesi ekranı
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const PRI   = '#C084FC';
const GREEN = '#4ADE80';
const avatar = (u) => u?.avatar_url || `https://i.pravatar.cc/100?u=${u?.username || u?.id}`;

export default function FollowersListScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { userId, displayName } = route.params || {};
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locked, setLocked]     = useState(false);

  const load = useCallback(async () => {
    if (!userId || !token) return;
    try {
      const res = await api.get(`/users/${userId}/followers?limit=100`, token);
      setUsers(res?.users || []);
      setLocked(false);
    } catch (e) {
      if (e?.status === 403 || e?.data?.detail?.includes('gizli')) {
        setLocked(true);
      }
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRemoveFollower = async (item) => {
    Alert.alert(
      'Takipçiyi Kaldır',
      `${item.display_name || item.username} kişisini takipçilerinizden kaldırmak istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kaldır', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/social/follower/${item.id}`, token);
              setUsers(prev => prev.filter(u => u.id !== item.id));
            } catch {
              Alert.alert('Hata', 'İşlem gerçekleştirilemedi.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate('UserProfile', { username: item.username })}
      activeOpacity={0.8}
    >
      <Image source={{ uri: avatar(item) }} style={styles.avatar} />
      <View style={styles.info}>
        <Text style={styles.name}>{item.display_name || item.username}</Text>
        <Text style={styles.username}>@{item.username}</Text>
        <View style={styles.badgeRow}>
          {item.is_mutual ? (
            <View style={styles.mutualBadge}>
              <Ionicons name="people" size={10} color={GREEN} />
              <Text style={styles.mutualTx}>Karşılıklı takip</Text>
            </View>
          ) : item.is_following ? (
            <View style={styles.followingBadge}>
              <Ionicons name="checkmark-circle" size={10} color={PRI} />
              <Text style={styles.followingTx}>Takip Ediliyor</Text>
            </View>
          ) : null}
        </View>
      </View>
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => handleRemoveFollower(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.removeTx}>Takipten Çıkar</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (locked) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{displayName ?? t('followers.title')}</Text>
        </View>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={40} color={PRI} />
          <Text style={[styles.emptyText, { marginTop: 12 }]}>Bu hesap gizlidir</Text>
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
        <Text style={styles.title}>{displayName ?? t('followers.title')}</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={PRI} /></View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>{t('followers.noFollowers')}</Text></View>}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={PRI} />}
        />
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.background },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  backBtn:       { padding: 4, marginRight: 12 },
  title:         { fontSize: 18, fontWeight: '700', color: colors.text },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:          { padding: 16 },
  row:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  avatar:        { width: 48, height: 48, borderRadius: 24, marginRight: 14 },
  info:          { flex: 1 },
  name:          { fontSize: 16, fontWeight: '600', color: colors.text },
  username:      { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
  badgeRow:      { flexDirection: 'row', marginTop: 4 },
  followingBadge:{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(192,132,252,0.12)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  followingTx:   { fontSize: 10, color: PRI, fontWeight: '600' },
  mutualBadge:   { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(74,222,128,0.12)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  mutualTx:      { fontSize: 10, color: GREEN, fontWeight: '600' },
  removeBtn:     { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(248,113,113,0.4)' },
  removeTx:      { fontSize: 12, color: '#F87171', fontWeight: '600' },
  empty:         { padding: 40, alignItems: 'center' },
  emptyText:     { color: '#9CA3AF' },
});
