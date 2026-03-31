/**
 * ConversationsScreen — NOVA Design System v3.0
 * Modern DM inbox · 2025 messaging aesthetic
 * Inspired by: iMessage · WhatsApp 2025 · Telegram · Mobbin messaging patterns
 * Online presence dots · Unread badges · Message previews · Story-style top row
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  TextInput, RefreshControl, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const { width: W } = Dimensions.get('window');

function loadConversations() {
  let readIds = new Set();
  let groups = [];
  try {
    if (typeof window !== 'undefined') {
      readIds = new Set(JSON.parse(localStorage.getItem('_mock_read_convs') || '[]'));
      groups = JSON.parse(localStorage.getItem('_mock_groups') || '[]');
    }
  } catch {}
  const base = MOCK_CONVERSATIONS.map(c => readIds.has(c.id) ? { ...c, unread: 0 } : c);
  return [...groups, ...base];
}

const MOCK_CONVERSATIONS = [
  { id:'c1', user:'melodikbeat', avatar:'https://i.pravatar.cc/100?u=melodikbeat', lastMsg:'Hey! Did you check the new release?', time:'2m', unread:3, online:true, typing:false },
  { id:'c2', user:'djvibe',      avatar:'https://i.pravatar.cc/100?u=djvibe',      lastMsg:'That playlist is 🔥🔥',           time:'14m', unread:0, online:true,  typing:true  },
  { id:'c3', user:'synthwave_',  avatar:'https://i.pravatar.cc/100?u=synthwave_',  lastMsg:'Check out my new track!',         time:'1h',  unread:1, online:false, typing:false },
  { id:'c4', user:'lofi_girl',   avatar:'https://i.pravatar.cc/100?u=lofi_girl',   lastMsg:'Shared a playlist with you',     time:'3h',  unread:0, online:false, typing:false },
  { id:'c5', user:'beatmaker',   avatar:'https://i.pravatar.cc/100?u=beatmaker',   lastMsg:'Let\'s collab on this!',          time:'Yesterday', unread:0, online:true, typing:false },
  { id:'c6', user:'musiclover',  avatar:'https://i.pravatar.cc/100?u=musiclover',  lastMsg:'You: 🎵 Midnight Pulse',         time:'Yesterday', unread:0, online:false, typing:false },
  { id:'c7', user:'soundcloud2', avatar:'https://i.pravatar.cc/100?u=soundcloud2', lastMsg:'Thanks for the follow!',         time:'Mon', unread:0, online:false, typing:false },
  { id:'c8', user:'retrowave',   avatar:'https://i.pravatar.cc/100?u=retrowave',   lastMsg:'So good 🙌',                    time:'Sun', unread:0, online:true,  typing:false },
];

const ACTIVE_NOW = MOCK_CONVERSATIONS.filter(c => c.online).slice(0, 5);

function ConvItem({ item, navigation, colors, onRead }) {
  const isGroup = item.is_group;
  const onPress = () => {
    onRead(item.id);
    if (isGroup) {
      navigation.navigate('Chat', {
        conversationId: item.id,
        isGroup: true,
        conversation: item,
        otherUser: { username: item.name || item.user, display_name: item.name || item.user, avatar_url: item.avatar, isGroup: true },
      });
    } else {
      navigation.navigate('Chat', { conversationId: item.id, otherUser: { username: item.user, avatar_url: item.avatar, display_name: item.user } });
    }
  };

  return (
    <TouchableOpacity style={[ci.row, { borderBottomColor: colors.borderLight }]} onPress={onPress} activeOpacity={0.8}>
      {/* Avatar */}
      <View style={ci.avatarWrap}>
        {isGroup ? (
          <View style={[ci.groupAvatarWrap, { backgroundColor: colors.surface }]}>
            {(item.participants || []).slice(0, 2).map((p, i) => (
              <Image key={p.id || i} source={{ uri: p.avatar_url || `https://i.pravatar.cc/60?u=${p.id}` }} style={[ci.groupAvatarSmall, i === 1 && ci.groupAvatarSmall2]} />
            ))}
            {(item.participants || []).length === 0 && (
              <Ionicons name="people" size={24} color={colors.textMuted} />
            )}
          </View>
        ) : (
          <>
            <Image source={{ uri: item.avatar }} style={ci.avatar} />
            {item.online && <View style={[ci.onlineDot, { borderColor: colors.background }]} />}
          </>
        )}
      </View>

      {/* Content */}
      <View style={ci.content}>
        <View style={ci.topRow}>
          <Text style={[ci.username, { color: colors.text, fontWeight: item.unread > 0 ? '800' : '600' }]} numberOfLines={1}>
            {isGroup ? (item.name || 'Grup') : item.user}
          </Text>
          <Text style={[ci.time, { color: item.unread > 0 ? colors.primary : colors.textMuted }]}>{item.time || ''}</Text>
        </View>
        <View style={ci.bottomRow}>
          {item.typing ? (
            <Text style={[ci.typing, { color: colors.primary }]}>yazıyor...</Text>
          ) : isGroup ? (
            <Text style={[ci.lastMsg, { color: colors.textMuted }]} numberOfLines={1}>
              {item.lastMsg || ((item.participants || []).map(p => p.display_name || p.username).join(', '))}
            </Text>
          ) : (
            <Text style={[ci.lastMsg, { color: item.unread > 0 ? colors.textSecondary : colors.textMuted, fontWeight: item.unread > 0 ? '600' : '400' }]} numberOfLines={1}>
              {item.lastMsg}
            </Text>
          )}
          {item.unread > 0 && (
            <View style={[ci.badge, { backgroundColor: colors.primary }]}>
              <Text style={ci.badgeText}>{item.unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
const ci = StyleSheet.create({
  row: { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingVertical:14, gap:14, borderBottomWidth:1 },
  avatarWrap: { position:'relative' },
  avatar: { width:54, height:54, borderRadius:27 },
  onlineDot: { position:'absolute', bottom:1, right:1, width:13, height:13, borderRadius:7, backgroundColor:'#4ADE80', borderWidth:2 },
  groupAvatarWrap: { width:54, height:54, borderRadius:27, alignItems:'center', justifyContent:'center', overflow:'hidden', position:'relative' },
  groupAvatarSmall: { position:'absolute', width:32, height:32, borderRadius:16, top:2, left:2 },
  groupAvatarSmall2: { top:18, left:18 },
  content: { flex:1, gap:3 },
  topRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', gap:8 },
  username: { flex:1, fontSize:15 },
  time: { fontSize:12 },
  bottomRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', gap:8 },
  lastMsg: { flex:1, fontSize:13 },
  typing: { flex:1, fontSize:13, fontStyle:'italic' },
  badge: { minWidth:20, height:20, borderRadius:10, alignItems:'center', justifyContent:'center', paddingHorizontal:5 },
  badgeText: { fontSize:11, fontWeight:'800', color:'#FFF' },
});

export default function ConversationsScreen({ navigation }) {
  const { colors }  = useTheme();
  const { user }    = useAuth();
  const { t }       = useTranslation();
  const insets      = useSafeAreaInsets();

  const [conversations, setConversations] = useState(loadConversations);
  const [refreshing, setRefreshing]       = useState(false);
  const [search, setSearch]               = useState('');

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setConversations(loadConversations());
    });
    return unsubscribe;
  }, [navigation]);

  const markAsRead = useCallback((id) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c));
    api.post(`/messages/conversations/${id}/read`).catch(() => {});
    // Web preview için Dashboard'u bilgilendir
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('sb:msg-read'));
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/messages/conversations');
      if (Array.isArray(res) && res.length) setConversations(res);
    } catch (_) {}
    finally { setRefreshing(false); }
  }, []);

  const filtered = search
    ? conversations.filter(c => {
        const q = search.toLowerCase();
        if ((c.user || c.name || '').toLowerCase().includes(q)) return true;
        if (c.is_group && (c.participants || []).some(p => (p.display_name || p.username || '').toLowerCase().includes(q))) return true;
        return false;
      })
    : conversations;

  const s = createStyles(colors, insets);

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.title}>Messages</Text>
          <View style={s.headerActions}>
            <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('CreateGroup')}>
              <Ionicons name="people-outline" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={s.composePill} onPress={() => navigation.navigate('NewMessage')}>
              <LinearGradient colors={['#9333EA', '#C084FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.composePillGrad}>
                <Ionicons name="create-outline" size={15} color="#FFF" />
                <Text style={s.composePillText}>Yeni</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={s.searchBar}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search conversations..."
            placeholderTextColor={colors.textGhost}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <ConvItem item={item} navigation={navigation} colors={colors} onRead={markAsRead} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          /* Active now strip */
          <View style={s.activeSection}>
            <Text style={[s.activeSectionTitle, { color: colors.textMuted }]}>Çevrimiçi</Text>
            <View style={s.activeRow}>
              {ACTIVE_NOW.map(u => (
                <TouchableOpacity key={u.id} style={s.activeWrap} onPress={() => navigation.navigate('Chat', { conversationId: u.id, user: { username: u.user, avatar: u.avatar } })}>
                  <View style={s.activeAvatarWrap}>
                    <Image source={{ uri: u.avatar }} style={s.activeAvatar} />
                    <View style={[s.activeOnline, { borderColor: colors.background }]} />
                  </View>
                  <Text style={[s.activeUser, { color: colors.textSecondary }]} numberOfLines={1}>{u.user}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        ListFooterComponent={<View style={{ height: 100 }} />}
      />
    </View>
  );
}

function createStyles(colors, insets) {
  return StyleSheet.create({
    root: { flex:1, backgroundColor: colors.background },
    header: {
      paddingTop: insets.top + 16,
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 14,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
    title: { flex: 1, fontSize: 24, fontWeight: '900', color: colors.text, letterSpacing: -0.8 },
    headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    composePill: { borderRadius: 20, overflow: 'hidden' },
    composePillGrad: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9 },
    composePillText: { color: '#FFF', fontSize: 13, fontWeight: '700', letterSpacing: 0.1 },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.searchBg,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    searchInput: { flex: 1, fontSize: 14, color: colors.text },

    activeSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    activeSectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 12 },
    activeRow: { flexDirection: 'row', gap: 16 },
    activeWrap: { alignItems: 'center', gap: 6, maxWidth: 56 },
    activeAvatarWrap: { position: 'relative' },
    activeAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface },
    activeOnline: { position:'absolute', bottom:1, right:1, width:12, height:12, borderRadius:6, backgroundColor: colors.success, borderWidth:2, borderColor: colors.background },
    activeUser: { fontSize: 11, fontWeight: '600', maxWidth: 52, textAlign: 'center' },
  });
}
