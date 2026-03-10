/**
 * Rehberden arkadaş bul - POST /social/contacts/find
 * expo-contacts ile rehberi oku, eşleşen kullanıcıları göster
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const avatar = (u) => u?.avatar_url || `https://i.pravatar.cc/100?u=${u?.username || u?.id}`;

function extractEmailsAndPhones(contacts) {
  const emails = [];
  const phones = [];
  for (const c of contacts || []) {
    for (const e of c.emails || []) {
      if (e.email) emails.push(e.email);
    }
    for (const p of c.phoneNumbers || []) {
      if (p.number) {
        const digits = p.number.replace(/\D/g, '');
        if (digits.length >= 9) phones.push(digits);
      }
    }
  }
  return { emails: [...new Set(emails)], phones: [...new Set(phones)].slice(0, 500) };
}

export default function ContactsFindScreen({ navigation }) {
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
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('Rehber erişimi için izin verin');
        setUsers([]);
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
      });
      const { emails, phones } = extractEmailsAndPhones(data);
      if (emails.length === 0 && phones.length === 0) {
        setUsers([]);
        return;
      }
      const res = await api.post('/social/contacts/find', { emails, phones }, token);
      setUsers(Array.isArray(res) ? res : []);
    } catch (err) {
      setError(err?.data?.detail || 'Yüklenemedi');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

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
          <Text style={styles.name}>{item.display_name || item.username}</Text>
          <Text style={styles.username}>@{item.username}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.followBtn} onPress={() => follow(item)}>
        <Text style={styles.followBtnText}>Takip et</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Rehberden arkadaş bul</Text>
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
              <Text style={styles.emptyText}>
                {error || 'Rehberinizde eşleşen kullanıcı bulunamadı'}
              </Text>
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
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#9CA3AF', textAlign: 'center' },
});
