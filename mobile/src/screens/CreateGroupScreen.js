/**
 * CreateGroupScreen - Grup sohbet oluşturma (max 8 kişi)
 * Backend: GET /users/search, POST /messages/groups
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, TextInput, FlatList, Image,
  TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert} from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

const MAX_MEMBERS = 8; // kendin + 7 kişi
const SEARCH_DEBOUNCE = 400;

export default function CreateGroupScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [defaultUsers, setDefaultUsers] = useState([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);

  // Load followers/following as default candidate list
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [fRes, gRes] = await Promise.all([
          api.get('/users/me/followers', token),
          api.get('/users/me/following', token),
        ]);
        const norm = (u) => ({
          ...u,
          display_name: u.display_name || u.name || u.username,
          avatar_url: u.avatar_url || u.avatar || `https://i.pravatar.cc/80?u=${u.id}`,
        });
        const fArr = (Array.isArray(fRes) ? fRes : (fRes?.users ?? [])).map(norm);
        const gArr = (Array.isArray(gRes) ? gRes : (gRes?.users ?? [])).map(norm);
        const seen = new Set();
        const merged = [];
        for (const u of [...fArr, ...gArr]) {
          if (!seen.has(u.id)) { seen.add(u.id); merged.push(u); }
        }
        if (!cancelled) setDefaultUsers(merged);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [token]);

  const fetchUsers = useCallback(async (q) => {
    if (!q?.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get(`/users/search?q=${encodeURIComponent(q.trim())}&limit=15`, token);
      const users = res?.users || [];
      const selectedIds = new Set(selected.map((s) => s.id));
      setSearchResults(users.filter((u) => !selectedIds.has(u.id)));
    } catch (e) {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [token, selected]);

  useEffect(() => {
    const t = setTimeout(() => fetchUsers(searchQuery), SEARCH_DEBOUNCE);
    return () => clearTimeout(t);
  }, [searchQuery, fetchUsers]);

  const addUser = (user) => {
    if (selected.length >= MAX_MEMBERS - 1) return;
    if (selected.some((s) => s.id === user.id)) return;
    setSelected((prev) => [...prev, user]);
    setSearchQuery('');
  };

  const removeUser = (id) => {
    setSelected((prev) => prev.filter((u) => u.id !== id));
  };

  const createGroup = async () => {
    const name = groupName.trim();
    if (!name) {
      Alert.alert(t('common.error'), t('groups.enterGroupName') || 'Grup adı giriniz');
      return;
    }
    if (selected.length < 1) {
      Alert.alert(t('common.error'), t('groups.minMembers') || 'En az 1 kişi seçiniz');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post(
        '/messages/groups',
        { name, participant_ids: selected.map((u) => u.id) },
        token
      );
      try { queryClient.invalidateQueries({ queryKey: ['conversations'] }); } catch {}
      const participants = res.participants && res.participants.length > 0
        ? res.participants
        : selected.map(u => ({ id: u.id, username: u.username, display_name: u.display_name || u.username, avatar_url: u.avatar_url }));
      // Persist group to localStorage so ConversationsScreen shows it
      // (mock may have already saved it; upsert to avoid duplication)
      try {
        if (typeof window !== 'undefined') {
          const existing = JSON.parse(localStorage.getItem('_mock_groups') || '[]');
          const newGroup = {
            id: res.id,
            name: res.name || name,
            is_group: true,
            participants,
            lastMsg: `Grup oluşturuldu · ${participants.length + 1} üye`,
            time: 'Şimdi',
            unread: 0,
            online: false,
          };
          const deduped = [newGroup, ...existing.filter(g => g.id !== res.id)];
          localStorage.setItem('_mock_groups', JSON.stringify(deduped));
        }
      } catch {}
      const chatParams = {
        conversationId: res.id,
        isGroup: true,
        conversation: { ...res, name: res.name || name, group_name: res.name || name, participants },
        otherUser: { username: res.name || name, display_name: res.name || name, avatar_url: null, isGroup: true },
      };
      // Web preview: dispatch is no-op, use sequential navigate instead
      if (Platform.OS === 'web') {
        navigation.navigate('Conversations');
        navigation.navigate('Chat', chatParams);
      } else {
        // Native: atomic stack reset — no race condition
        navigation.dispatch(
          CommonActions.reset({
            index: 2,
            routes: [
              { name: 'Main' },
              { name: 'Conversations' },
              { name: 'Chat', params: chatParams },
            ],
          })
        );
      }
    } catch (e) {
      const msg = e?.data?.detail || e?.message || t('groups.createFailed') || 'Grup oluşturulamadı';
      Alert.alert('Hata', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setCreating(false);
    }
  };


  const renderSearchResult = ({ item }) => (
    <TouchableOpacity style={styles.resultRow} onPress={() => addUser(item)} activeOpacity={0.7}>
      <Image source={{ uri: item.avatar_url || `https://i.pravatar.cc/80?u=${item.id}` }} style={styles.resultAvatar} />
      <View style={styles.resultInfo}>
        <Text style={styles.resultName}>{item.display_name || item.username || t('calls.user')}</Text>
        {item.username && <Text style={styles.resultUsername}>@{item.username}</Text>}
      </View>
      <Ionicons name="add-circle-outline" size={24} color="#8B5CF6" />
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
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
        <Text style={styles.title}>{t('groups.newGroup')}</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>{t('groups.groupName')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('groups.groupNamePlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={groupName}
          onChangeText={setGroupName}
          maxLength={50}
          editable={!creating}
        />

        <Text style={styles.label}>{t('groups.members')} ({selected.length + 1}/{MAX_MEMBERS})</Text>
        {selected.length > 0 && (
          <View style={styles.selectedWrap}>
            {selected.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.selectedChip}
                onPress={() => removeUser(item.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.selectedName} numberOfLines={1}>{item.display_name || item.username}</Text>
                <Ionicons name="close" size={12} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>{t('groups.searchPerson')}</Text>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('groups.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            editable={!creating}
          />
          {searching && <ActivityIndicator size="small" color="#8B5CF6" />}
        </View>

        <View style={styles.results}>
          {searching ? (
            <View style={styles.centerRow}>
              <ActivityIndicator size="small" color="#8B5CF6" />
            </View>
          ) : searchQuery.length > 0 ? (
            searchResults.length === 0 ? (
              <Text style={styles.emptyResults}>{t('groups.noResults') || 'Kullanıcı bulunamadı'}</Text>
            ) : (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => String(item.id)}
                keyboardShouldPersistTaps="handled"
                style={styles.resultsList}
              />
            )
          ) : (
            <FlatList
              data={defaultUsers.filter(u => !selected.some(s => s.id === u.id))}
              renderItem={renderSearchResult}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              style={styles.resultsList}
              ListEmptyComponent={<Text style={styles.emptyResults}>Takipçi bulunamadı</Text>}
            />
          )}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.createBtn, creating && styles.createBtnDisabled]}
          onPress={createGroup}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="people" size={20} color="#fff" />
              <Text style={styles.createBtnText}>{t('groups.createGroup')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  form: { flex: 1, padding: 16 },
  label: { fontSize: 14, color: colors.textMuted, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  selectedWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 6 },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryGlow || 'rgba(192,132,252,0.15)',
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 4,
  },
  selectedName: { fontSize: 13, color: colors.primary || '#C084FC', fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  results: { marginTop: 8, flex: 1, minHeight: 80 },
  centerRow: { padding: 20, alignItems: 'center' },
  emptyResults: { fontSize: 14, color: colors.textMuted, padding: 16 },
  resultsList: { flex: 1 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 16, color: colors.text, fontWeight: '500' },
  resultUsername: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  createBtnDisabled: { opacity: 0.7 },
  createBtnText: { fontSize: 16, fontWeight: '600', color: colors.text },
});
