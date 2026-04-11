/**
 * ShareProfilePickerScreen - Profil paylaşımı (kullanıcı ara ve paylaş)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, TextInput} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert } from '../components/ui/AppAlert';

const SEARCH_DEBOUNCE = 400;

export default function ShareProfilePickerScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { conversationId } = route.params || {};
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useFocusEffect(useCallback(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []));

  const searchUsers = useCallback(async (q) => {
    if (!q?.trim() || !token) {
      setUsers([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/users/search?q=${encodeURIComponent(q.trim())}&limit=20`, token);
      setUsers(res?.users || []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => searchUsers(query), SEARCH_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [query, searchUsers]);

  const shareProfile = async (u) => {
    if (!token || !conversationId || sending) return;
    setSending(true);
    try {
      await api.post('/messages', {
        conversation_id: conversationId,
        content_type: 'PROFILE',
        content: `@${u.username || u.id}`,
        user_id: u.id,
      }, token);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      navigation.goBack();
    } catch (e) {
      Alert.alert(t('common.error'), e?.data?.detail || t('common.shareFailed'));
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.row} onPress={() => shareProfile(item)} disabled={sending}>
      <Image source={{ uri: item.avatar_url || `https://i.pravatar.cc/80?u=${item.id}` }} style={styles.avatar} />
      <View style={styles.info}>
        <Text style={styles.name}>{item.display_name || item.username || t('common.user')}</Text>
        <Text style={styles.username}>@{item.username}</Text>
      </View>
      {sending ? <ActivityIndicator size="small" color="#8B5CF6" /> : <Ionicons name="send" size={20} color="#8B5CF6" />}
    </TouchableOpacity>
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
        <Text style={styles.title}>{t('profile.shareProfile')}</Text>
      </View>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder={t('search.searchUsers')}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={<Text style={styles.empty}>{query.trim() ? t('search.noResults') : t('search.typeToSearch')}</Text>}
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
  searchRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchInput: { flex: 1, backgroundColor: colors.inputBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, color: colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  username: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', padding: 24 },
});
