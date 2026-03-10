/**
 * Kısıtlı kullanıcılar listesi - yorumları onay bekliyor
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

const avatar = (u) => u?.avatar_url || `https://i.pravatar.cc/100?u=${u?.username || u?.id}`;

export default function RestrictedUsersScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!token) return;
    try {
      const list = await api.get('/social/restricted-users', token);
      setUsers(Array.isArray(list) ? list : []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const unrestrict = async (user) => {
    Alert.alert(
      'Kısıtlamayı kaldır',
      `${user.display_name || user.username} kullanıcısının kısıtlamasını kaldırmak istiyor musunuz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kaldır',
          onPress: async () => {
            try {
              await api.delete(`/social/unrestrict/${user.id}`, token);
              setUsers((prev) => prev.filter((u) => u.id !== user.id));
            } catch (e) {
              Alert.alert('Hata', e?.data?.detail || 'Kısıtlama kaldırılamadı');
            }
          },
        },
      ]
    );
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
          <Text style={styles.name}>{item.display_name || item.username}</Text>
          <Text style={styles.username}>@{item.username}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.unrestrictBtn} onPress={() => unrestrict(item)}>
        <Text style={styles.unrestrictText}>Kısıtlamayı kaldır</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Kısıtlı kullanıcılar</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Kısıtlı kullanıcı yok</Text>
              <Text style={styles.emptySubtext}>Kısıtladığınız kişiler burada listelenir</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  backBtn: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 14 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  username: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
  unrestrictBtn: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#374151', borderRadius: 8 },
  unrestrictText: { fontSize: 14, color: colors.text, fontWeight: '500' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#9CA3AF', fontSize: 16 },
  emptySubtext: { color: '#6B7280', fontSize: 14, marginTop: 8 },
});
