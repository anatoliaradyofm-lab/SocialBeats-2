/**
 * Rehberden arkadaş bulma - expo-contacts ile
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, Alert} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const avatar = (u) => u?.avatar_url || `https://i.pravatar.cc/100?u=${u?.username || u?.id}`;

function extractEmails(contacts) {
  const emails = new Set();
  contacts.forEach((c) => {
    (c.emails || []).forEach((e) => {
      if (e.email && e.email.includes('@')) emails.add(e.email.trim().toLowerCase());
    });
  });
  return Array.from(emails);
}

export default function ContactsFriendsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const loadFromContacts = async () => {
    if (!token) return;
    setLoading(true);
    setPermissionDenied(false);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        setUsers([]);
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Emails],
      });
      const emails = extractEmails(data);
      if (emails.length === 0) {
        setUsers([]);
        return;
      }
      const matched = await api.post('/social/contacts/match', { emails }, token);
      setUsers(Array.isArray(matched) ? matched : []);
    } catch (err) {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFromContacts();
  }, [token]);

  const follow = async (u) => {
    try {
      await api.post(`/social/friend-request/${u.id}`, {}, token);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_following: true } : x)));
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
      {!item.is_following ? (
        <TouchableOpacity style={styles.followBtn} onPress={() => follow(item)}>
          <Text style={styles.followBtnText}>Takip et</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.followingText}>Takip ediliyor</Text>
      )}
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
      ) : permissionDenied ? (
        <View style={styles.empty}>
          <Ionicons name="person-add-outline" size={64} color="#6B7280" />
          <Text style={styles.emptyTitle}>Rehber erişimi gerekli</Text>
          <Text style={styles.emptyText}>Rehberinizdeki kişileri bulmak için izin verin</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadFromContacts}>
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
              <Text style={styles.emptyText}>Rehberinizde uygulamayı kullanan biri bulunamadı</Text>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 14 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  username: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
  followBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#8B5CF6' },
  followBtnText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  followingText: { fontSize: 14, color: '#9CA3AF' },
  empty: { padding: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 16 },
  emptyText: { color: '#9CA3AF', textAlign: 'center', marginTop: 8 },
  retryBtn: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#8B5CF6', borderRadius: 12 },
  retryText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
