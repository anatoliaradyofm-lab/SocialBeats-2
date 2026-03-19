/**
 * Sessize alınan kullanıcılar - GET /social/muted
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const avatar = (u) => u?.avatar_url || u?.user?.avatar_url || `https://i.pravatar.cc/100?u=${u?.username || u?.user?.username || u?.muted_user_id}`;

export default function MutedUsersScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!token) return;
    try {
      const list = await api.get('/social/muted', token);
      setItems(Array.isArray(list) ? list : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const unmute = async (item) => {
    const userId = item.muted_user_id || item.user?.id;
    const name = item.user?.display_name || item.user?.username || item.muted_username || 'Bu kullanıcı';
    Alert.alert(
      'Sesi aç',
      `${name} kullanıcısının sesini açmak istiyor musunuz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Aç',
          onPress: async () => {
            try {
              await api.delete(`/social/unmute/${userId}`, token);
              setItems((prev) => prev.filter((x) => (x.muted_user_id || x.user?.id) !== userId));
            } catch (e) {
              Alert.alert('Hata', e?.data?.detail || 'İşlem başarısız');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const u = item.user || {};
    const uid = item.muted_user_id || u.id;
    const username = u.username || item.muted_username;
    return (
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.left}
          onPress={() => username && navigation.navigate('UserProfile', { username })}
          activeOpacity={0.8}
        >
          <Image source={{ uri: avatar(item) }} style={styles.avatar} />
          <View style={styles.info}>
            <Text style={styles.name}>{u.display_name || username}</Text>
            <Text style={styles.username}>@{username}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.unmuteBtn} onPress={() => unmute(item)}>
          <Text style={styles.unmuteText}>Sesi aç</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Sessize alınanlar</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.muted_user_id || item.user?.id || item.id || String(Math.random())}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Sessize alınan kullanıcı yok</Text>
              <Text style={styles.emptySubtext}>Sessize aldığınız kişilerin gönderi ve bildirimleri görünmez</Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#8B5CF6" />}
        />
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 14 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  username: { fontSize: 14, color: colors.textMuted, marginTop: 2 },
  unmuteBtn: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  unmuteText: { fontSize: 14, color: colors.text, fontWeight: '500' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 16 },
  emptySubtext: { color: colors.textGhost, fontSize: 14, marginTop: 8 },
});
