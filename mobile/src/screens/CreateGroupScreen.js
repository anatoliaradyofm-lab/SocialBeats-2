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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../contexts/ThemeContext';

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
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchUsers = useCallback(async (q) => {
    if (!q?.trim() || !token) {
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
      Alert.alert(t('common.error'), t('groups.enterGroupName'));
      return;
    }
    if (selected.length < 1) {
      Alert.alert(t('common.error'), t('groups.minMembers'));
      return;
    }
    setCreating(true);
    try {
      const res = await api.post(
        '/messages/groups',
        { name, participant_ids: selected.map((u) => u.id) },
        token
      );
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      navigation.replace('Chat', {
        conversationId: res.id,
        isGroup: true,
        conversation: res,
        otherUser: null,
      });
    } catch (e) {
      const msg = e?.data?.detail || e?.message || t('groups.createFailed');
      Alert.alert('Hata', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setCreating(false);
    }
  };

  const renderSelectedUser = ({ item }) => (
    <TouchableOpacity
      style={styles.selectedChip}
      onPress={() => removeUser(item.id)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: item.avatar_url || `https://i.pravatar.cc/80?u=${item.id}` }} style={styles.selectedAvatar} />
      <Text style={styles.selectedName} numberOfLines={1}>{item.display_name || item.username}</Text>
      <Ionicons name="close-circle" size={18} color="#9CA3AF" />
    </TouchableOpacity>
  );

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
          placeholderTextColor="#6B7280"
          value={groupName}
          onChangeText={setGroupName}
          maxLength={50}
          editable={!creating}
        />

        <Text style={styles.label}>{t('groups.members')} ({selected.length + 1}/{MAX_MEMBERS})</Text>
        {selected.length > 0 && (
          <FlatList
            data={selected}
            renderItem={renderSelectedUser}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectedList}
          />
        )}

        <Text style={styles.label}>{t('groups.searchPerson')}</Text>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder={t('groups.searchPlaceholder')}
            placeholderTextColor="#6B7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
            editable={!creating}
          />
          {searching && <ActivityIndicator size="small" color="#8B5CF6" />}
        </View>

        {searchQuery.length > 0 && (
          <View style={styles.results}>
            {searching ? (
              <View style={styles.centerRow}>
                <ActivityIndicator size="small" color="#8B5CF6" />
              </View>
            ) : searchResults.length === 0 ? (
              <Text style={styles.emptyResults}>{t('groups.noResults')}</Text>
            ) : (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                style={styles.resultsList}
              />
            )}
          </View>
        )}
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
    borderBottomColor: '#1F2937',
  },
  backBtn: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  form: { flex: 1, padding: 16 },
  label: { fontSize: 14, color: '#9CA3AF', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  selectedList: { paddingVertical: 8, gap: 8 },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 20,
    paddingVertical: 6,
    paddingRight: 8,
    paddingLeft: 6,
    marginRight: 8,
    maxWidth: 140,
  },
  selectedAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 6 },
  selectedName: { fontSize: 13, color: colors.text, flex: 1 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
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
  emptyResults: { fontSize: 14, color: '#6B7280', padding: 16 },
  resultsList: { flex: 1 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  resultAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 16, color: colors.text, fontWeight: '500' },
  resultUsername: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#1F2937' },
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
