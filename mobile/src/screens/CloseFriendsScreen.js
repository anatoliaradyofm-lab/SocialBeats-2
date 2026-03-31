/**
 * Yakın arkadaşlar listesi - ekleme/çıkarma
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
import { LinearGradient } from 'expo-linear-gradient';

const avatar = (u) => u?.avatar_url || `https://i.pravatar.cc/100?u=${u?.username || u?.id}`;

export default function CloseFriendsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [friends, setFriends] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!token) return;
    try {
      const [list, sug] = await Promise.all([
        api.get('/social/close-friends', token),
        api.get('/social/close-friends/suggestions', token).catch(() => []),
      ]);
      setFriends(Array.isArray(list) ? list : []);
      setSuggestions(Array.isArray(sug) ? sug : []);
    } catch {
      setFriends([]);
      setSuggestions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const addFriend = async (user) => {
    try {
      await api.post(`/social/close-friends/${user.id}`, {}, token);
      setFriends((prev) => [...prev, user]);
      setSuggestions((prev) => prev.filter((u) => u.id !== user.id));
    } catch {}
  };

  const removeFriend = async (user) => {
    try {
      await api.delete(`/social/close-friends/${user.id}`, token);
      setFriends((prev) => prev.filter((u) => u.id !== user.id));
    } catch {}
  };

  const renderFriend = ({ item }) => (
    <View style={styles.row}>
      <TouchableOpacity style={styles.left} onPress={() => navigation.navigate('UserProfile', { username: item.username })} activeOpacity={0.8}>
        <Image source={{ uri: avatar(item) }} style={styles.avatar} />
        <View style={styles.info}>
          <Text style={styles.name}>{item.display_name || item.username}</Text>
          <Text style={styles.username}>@{item.username}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.removeBtn} onPress={() => removeFriend(item)}>
        <Ionicons name="close" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderSuggestion = ({ item }) => (
    <View style={styles.row}>
      <TouchableOpacity style={styles.left} onPress={() => navigation.navigate('UserProfile', { username: item.username })} activeOpacity={0.8}>
        <Image source={{ uri: avatar(item) }} style={styles.avatar} />
        <View style={styles.info}>
          <Text style={styles.name}>{item.display_name || item.username}</Text>
          <Text style={styles.username}>@{item.username}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.addBtn} onPress={() => addFriend(item)}>
        <Ionicons name="add" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('closeFriends.title')}</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : (
        <FlatList
          data={[
            ...friends.map((u) => ({ ...u, _isFriend: true })),
            ...(suggestions.length > 0 ? [{ _section: t('closeFriends.suggestions') }, ...suggestions.map((u) => ({ ...u, _isFriend: false }))] : []),
          ]}
          renderItem={({ item }) =>
            item._section ? (
              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>{item._section}</Text>
            ) : (
              <View style={styles.row}>
                <TouchableOpacity style={styles.left} onPress={() => navigation.navigate('UserProfile', { username: item.username })} activeOpacity={0.8}>
                  <Image source={{ uri: avatar(item) }} style={styles.avatar} />
                  <View style={styles.info}>
                    <Text style={styles.name}>{item.display_name || item.username}</Text>
                    <Text style={styles.username}>@{item.username}</Text>
                  </View>
                </TouchableOpacity>
                {item._isFriend ? (
                  <TouchableOpacity style={styles.removeBtn} onPress={() => removeFriend(item)}>
                    <Ionicons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.addBtn} onPress={() => addFriend(item)}>
                    <Ionicons name="add" size={22} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            )
          }
          keyExtractor={(item, i) => item._section ? `sec-${i}` : item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>{t('closeFriends.emptyDescription')}</Text></View>}
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
  sectionTitle: { fontSize: 14, color: '#9CA3AF', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 14 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  username: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center' },
  removeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' },
  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#9CA3AF', textAlign: 'center' },
});
