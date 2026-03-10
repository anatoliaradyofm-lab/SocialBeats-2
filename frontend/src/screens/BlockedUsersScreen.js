import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

export default function BlockedUsersScreen({ navigation }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const [users, setUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBlocked = useCallback(async () => {
    try {
      const res = await api.get('/social/blocked', token);
      setUsers(res.users || res || []);
    } catch { setUsers([]); }
  }, [token]);

  useEffect(() => { fetchBlocked(); }, [fetchBlocked]);
  const onRefresh = async () => { setRefreshing(true); await fetchBlocked(); setRefreshing(false); };

  const unblock = async (userId) => {
    Alert.alert('Engeli Kaldır', 'Bu kullanıcının engelini kaldırmak istiyor musunuz?', [
      { text: 'İptal' },
      { text: 'Kaldır', onPress: async () => {
        try {
          await api.delete(`/social/block/${userId}`, token);
          setUsers(prev => prev.filter(u => (u.id || u._id) !== userId));
        } catch {}
      }},
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Engellenen Hesaplar</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={[styles.infoCard, { backgroundColor: colors.surfaceElevated }]}>
        <Ionicons name="information-circle" size={20} color={BRAND.primaryLight} />
        <Text style={{ color: colors.textSecondary, fontSize: 13, flex: 1, marginLeft: 10 }}>
          Engellediğiniz kişiler profilinizi, gönderilerinizi ve hikayelerinizi göremez.
        </Text>
      </View>

      <FlatList
        data={users}
        renderItem={({ item }) => (
          <View style={[styles.userRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated }]}>
              {item.avatar_url ? <Image source={{ uri: item.avatar_url }} style={styles.avatar} /> : <Ionicons name="person" size={18} color={BRAND.primaryLight} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>{item.display_name || item.username}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>@{item.username}</Text>
            </View>
            <TouchableOpacity style={[styles.unblockBtn, { borderColor: colors.border }]} onPress={() => unblock(item.id || item._id)}>
              <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '500' }}>Engeli Kaldır</Text>
            </TouchableOpacity>
          </View>
        )}
        keyExtractor={(item, i) => item.id || item._id || `${i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="ban-outline" size={44} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 12 }}>Engellenen hesap yok</Text>
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
  infoCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, padding: 14, borderRadius: 14, marginBottom: 8 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  unblockBtn: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  empty: { alignItems: 'center', paddingTop: 100 },
});
