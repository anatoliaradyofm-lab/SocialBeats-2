/**
 * Rehberden arkadaş bulma - POST /social/contacts/find
 * expo-contacts ile rehber okunur, eşleşen kullanıcılar gösterilir
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, Alert, PermissionsAndroid,
  Platform} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const avatar = (u) => u?.avatar_url || `https://i.pravatar.cc/100?u=${u?.username || u?.id}`;

export default function FindFriendsFromContactsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadContacts();
  }, [token]);

  const loadContacts = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      let phones = [];
      let emails = [];

      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
          { title: 'Rehber Erişimi', message: 'Arkadaşlarınızı bulmak için rehbere erişim gerekir.' }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setError('Rehber izni verilmedi');
          setUsers([]);
          setLoading(false);
          return;
        }
      }

      try {
        const { Status } = await import('expo-contacts');
        const { requestPermissionsAsync, getContactsAsync } = await import('expo-contacts');
        const { status } = await requestPermissionsAsync();
        if (status !== Status.GRANTED) {
          setError('Rehber izni verilmedi');
          setUsers([]);
          setLoading(false);
          return;
        }
        const { data } = await getContactsAsync({ fields: ['phoneNumbers', 'emails'] });
        for (const c of data || []) {
          for (const p of c.phoneNumbers || []) {
            if (p.number) phones.push(p.number);
          }
          for (const e of c.emails || []) {
            if (e.email) emails.push(e.email);
          }
        }
      } catch (e) {
        setError('Rehber okunamadı: ' + (e.message || 'expo-contacts yüklü olmayabilir'));
        setUsers([]);
        setLoading(false);
        return;
      }

      if (phones.length === 0 && emails.length === 0) {
        setError('Rehberde iletişim bilgisi bulunamadı');
        setUsers([]);
        setLoading(false);
        return;
      }

      const list = await api.post('/social/contacts/find', { phones, emails }, token);
      setUsers(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err?.data?.detail || err.message || 'Yüklenemedi');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const follow = async (u) => {
    try {
      await api.post(`/social/friend-request/${u.id}`, {}, token);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (e) {
      Alert.alert('Hata', e?.data?.detail || 'İstek gönderilemedi');
    }
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
      <TouchableOpacity style={styles.followBtn} onPress={() => follow(item)}>
        <Text style={styles.followBtnText}>Arkadaş ol</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Rehberden Arkadaş Bul</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadContacts}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Rehberinizde uygulamada kayıtlı kişi bulunamadı</Text>
              <Text style={styles.emptySubtext}>Arkadaşlarınız uygulamaya katıldığında burada görünecek</Text>
            </View>
          }
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: colors.error, textAlign: 'center', marginBottom: 16 },
  retryBtn: { padding: 12, backgroundColor: '#8B5CF6', borderRadius: 10 },
  retryText: { color: colors.text, fontWeight: '600' },
  list: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 14 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  username: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
  followBtn: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#8B5CF6', borderRadius: 8 },
  followBtnText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#9CA3AF', fontSize: 16 },
  emptySubtext: { color: '#6B7280', fontSize: 14, marginTop: 8 },
});
