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

function ConvItem({ item, navigation, colors }) {
  return (
    <TouchableOpacity
      style={[ci.row, { borderBottomColor: colors.borderLight }]}
      onPress={() => navigation.navigate('Chat', { conversationId: item.id, otherUser: { username: item.user, avatar_url: item.avatar, display_name: item.user } })}
      activeOpacity={0.8}
    >
      {/* Avatar + online dot */}
      <View style={ci.avatarWrap}>
        <Image source={{ uri: item.avatar }} style={ci.avatar} />
        {item.online && <View style={[ci.onlineDot, { borderColor: colors.background }]} />}
      </View>

      {/* Content */}
      <View style={ci.content}>
        <View style={ci.topRow}>
          <Text style={[ci.username, { color: colors.text, fontWeight: item.unread > 0 ? '800' : '600' }]}>
            {item.user}
          </Text>
          <Text style={[ci.time, { color: item.unread > 0 ? colors.primary : colors.textMuted }]}>{item.time}</Text>
        </View>
        <View style={ci.bottomRow}>
          {item.typing ? (
            <Text style={[ci.typing, { color: colors.primary }]}>typing...</Text>
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
  content: { flex:1, gap:4 },
  topRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  username: { fontSize:15 },
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

  const [conversations, setConversations] = useState(MOCK_CONVERSATIONS);
  const [refreshing, setRefreshing]       = useState(false);
  const [search, setSearch]               = useState('');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/messages/conversations');
      if (Array.isArray(res) && res.length) setConversations(res);
    } catch (_) {}
    finally { setRefreshing(false); }
  }, []);

  const filtered = search
    ? conversations.filter(c => c.user?.toLowerCase().includes(search.toLowerCase()))
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
          <Text style={s.title}>Messages</Text>
          <View style={s.headerActions}>
            <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('CreateGroup')}>
              <Ionicons name="people-outline" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.iconBtn, { backgroundColor: colors.primaryGlow, borderColor: colors.primary }]}
              onPress={() => navigation.navigate('FindContacts')}
            >
              <Ionicons name="create-outline" size={20} color={colors.primary} />
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
        renderItem={({ item }) => <ConvItem item={item} navigation={navigation} colors={colors} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          /* Active now strip */
          <View style={s.activeSection}>
            <Text style={[s.activeSectionTitle, { color: colors.textMuted }]}>Active now</Text>
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
    title: { fontSize: 30, fontWeight: '900', color: colors.text, letterSpacing: -1 },
    headerActions: { flexDirection: 'row', gap: 8 },
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
