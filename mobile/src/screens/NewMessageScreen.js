/**
 * NewMessageScreen — Yeni mesaj başlat
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';

export default function NewMessageScreen({ navigation }) {
  const { colors }  = useTheme();
  const { token }   = useAuth();
  const insets      = useSafeAreaInsets();

  const [query, setQuery]           = useState('');
  const [allUsers, setAllUsers]     = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [searching, setSearching]   = useState(false);
  const [tab, setTab]               = useState('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const loadUsers = async () => {
      try {
        const [fRes, gRes] = await Promise.all([
          api.get('/users/me/followers', token),
          api.get('/users/me/following', token),
        ]);
        if (cancelled) return;

        const norm = (u, defaultType) => ({
          id: u.id,
          username: u.username || '',
          display_name: u.display_name || u.name || u.username || '',
          avatar_url: u.avatar_url || u.avatar || `https://i.pravatar.cc/80?u=${u.id}`,
          type: u.type || defaultType,
          is_following: u.is_following || false,
        });

        const followers = (Array.isArray(fRes) ? fRes : (fRes?.users ?? [])).map(u => norm(u, 'follower'));
        const following = (Array.isArray(gRes) ? gRes : (gRes?.users ?? [])).map(u => norm(u, 'following'));

        const seen = new Set();
        const merged = [];
        for (const u of [...followers, ...following]) {
          if (!seen.has(u.id)) { seen.add(u.id); merged.push(u); }
        }
        if (!cancelled) setAllUsers(merged);
      } catch {
        try {
          const res = await api.get('/users/search?limit=50', token);
          if (!cancelled) {
            const list = (Array.isArray(res) ? res : (res?.users ?? [])).map(u => ({
              id: u.id,
              username: u.username || '',
              display_name: u.display_name || u.name || u.username || '',
              avatar_url: u.avatar_url || `https://i.pravatar.cc/80?u=${u.id}`,
              type: 'follower',
              is_following: false,
            }));
            setAllUsers(list);
          }
        } catch {}
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadUsers();
    return () => { cancelled = true; };
  }, [token]);

  // Search all users when query changes
  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return; }
    let cancelled = false;
    setSearching(true);
    api.get(`/users/search?q=${encodeURIComponent(query.trim())}&limit=50`, token)
      .then(res => {
        if (cancelled) return;
        const list = (Array.isArray(res) ? res : (res?.users ?? [])).map(u => ({
          id: u.id,
          username: u.username || '',
          display_name: u.display_name || u.name || u.username || '',
          avatar_url: u.avatar_url || `https://i.pravatar.cc/80?u=${u.id}`,
          type: u.type || '',
          is_following: u.is_following || false,
        }));
        setSearchResults(list);
      })
      .catch(() => { if (!cancelled) setSearchResults([]); })
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [query, token]);

  const filtered = query.trim()
    ? searchResults
    : (() => {
        if (tab === 'followers') return allUsers.filter(u => u.type === 'follower');
        if (tab === 'following') return allUsers.filter(u => u.type === 'following' || u.is_following);
        return allUsers;
      })();

  const startChat = (u) => {
    navigation.navigate('Chat', {
      conversationId: `new_${u.id}`,
      otherUser: { id: u.id, username: u.username, display_name: u.display_name, avatar_url: u.avatar_url },
    });
  };

  const s = createStyles(colors, insets);

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.text }]}>Yeni Mesaj</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={[s.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          style={[s.searchInput, { color: colors.text }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Kullanıcı ara..."
          placeholderTextColor={colors.textGhost}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searching
          ? <ActivityIndicator size="small" color={colors.primary} />
          : query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
      </View>

      {/* Tabs */}
      {!query.trim() && (
        <View style={s.tabs}>
          {[
            { key: 'all',       label: 'Tümü' },
            { key: 'followers', label: 'Takipçiler' },
            { key: 'following', label: 'Takip Edilenler' },
          ].map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.tab, tab === t.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[s.tabText, { color: tab === t.key ? colors.primary : colors.textMuted }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          ListEmptyComponent={
            <Text style={[s.empty, { color: colors.textMuted }]}>
              {query.trim() ? `"${query}" için kullanıcı bulunamadı` : 'Kullanıcı bulunamadı'}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={[s.row, { borderBottomColor: colors.borderLight }]} onPress={() => startChat(item)} activeOpacity={0.8}>
              <Image source={{ uri: item.avatar_url }} style={s.avatar} />
              <View style={s.info}>
                <Text style={[s.name, { color: colors.text }]}>{item.display_name || item.username}</Text>
                <Text style={[s.uname, { color: colors.textMuted }]}>@{item.username}</Text>
              </View>
              {item.type ? (
                <View style={[s.typeTag, { backgroundColor: colors.primaryGlow }]}>
                  <Text style={[s.typeText, { color: colors.primary }]}>
                    {item.type === 'follower' ? 'Takipçi' : 'Takip'}
                  </Text>
                </View>
              ) : null}
              <Ionicons name="chatbubble-outline" size={18} color={colors.textGhost} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function createStyles(colors, insets) {
  return StyleSheet.create({
    root:        { flex: 1, backgroundColor: colors.background },
    header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title:       { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
    searchBar:   { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
    searchInput: { flex: 1, fontSize: 15 },
    tabs:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
    tab:         { flex: 1, alignItems: 'center', paddingVertical: 12 },
    tabText:     { fontSize: 13, fontWeight: '600' },
    row:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
    avatar:      { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface },
    info:        { flex: 1, gap: 2 },
    name:        { fontSize: 15, fontWeight: '700' },
    uname:       { fontSize: 12 },
    typeTag:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    typeText:    { fontSize: 11, fontWeight: '600' },
    empty:       { textAlign: 'center', paddingVertical: 40, fontSize: 14 },
    center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  });
}
