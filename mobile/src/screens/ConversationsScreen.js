/**
 * ConversationsScreen - Mesajlaşma (DM) sohbet listesi
 * Backend: GET /messages/conversations, POST /messages/conversations
 */
import React from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useConversationsQuery } from '../hooks/useConversationsQuery';
import { formatDate as formatLocaleDate, formatTime as formatLocaleTime } from '../lib/localeUtils';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return formatLocaleTime(d, { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return formatLocaleDate(d, { weekday: 'short' });
    return formatLocaleDate(d, { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

export default function ConversationsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { data: conversations = [], isLoading, isRefetching, refetch } = useConversationsQuery(token);

  const onRefresh = () => refetch();

  const getOtherUser = (conv) => {
    const others = conv.other_participants || [];
    return others[0] || {};
  };

  const renderItem = ({ item }) => {
    const isGroup = item.is_group;
    const other = getOtherUser(item);
    const displayName = isGroup ? (item.group_name || t('conversations.group')) : (other.display_name || other.username || t('conversations.user'));
    const avatar = isGroup ? (item.group_avatar || `https://i.pravatar.cc/100?g=${item.id}`) : (other.avatar_url || `https://i.pravatar.cc/100?u=${other.username || other.id}`);
    const lastMsg = item.last_message;
    let preview = lastMsg?.content_type === 'TEXT' ? (lastMsg.content || '') : `📷 ${t('chat.media')}`;
    if (lastMsg?.content_type === 'IMAGE') preview = `📷 ${t('conversations.photo')}`;
    else if (lastMsg?.content_type === 'VIDEO') preview = `🎥 ${t('conversations.video')}`;
    else if (lastMsg?.content_type === 'VOICE') preview = `🎤 ${t('conversations.voiceMessage')}`;
    else if (lastMsg?.content_type === 'GIF') preview = t('chat.gif');
    else if (lastMsg?.content_type === 'POST') preview = `📄 ${t('conversations.postShared')}`;
    else if (lastMsg?.content_type === 'MUSIC') preview = `🎵 ${t('conversations.musicShared')}`;
    else if (lastMsg?.content_type === 'PLAYLIST') preview = `📋 ${t('conversations.playlistShared')}`;
    else if (lastMsg?.content_type === 'PROFILE') preview = `👤 ${t('conversations.profileShared')}`;
    const unread = item.unread_count || 0;

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('Chat', { conversationId: item.id, otherUser: other, isGroup, conversation: item })}
      >
        <Image source={{ uri: avatar }} style={styles.avatar} />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            {item.is_pinned && <Ionicons name="pin" size={14} color="#8B5CF6" style={styles.pinIcon} />}
            <Text style={styles.time}>{formatTime(lastMsg?.created_at || item.last_message_at)}</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
              {preview || t('conversations.startChat')}
            </Text>
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('conversations.title')}</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('conversations.title')}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('CallHistory')}
          style={styles.archiveBtn}
        >
          <Ionicons name="call-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('StarredMessages')}
          style={styles.archiveBtn}
        >
          <Ionicons name="star-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('ArchivedConversations')}
          style={styles.archiveBtn}
        >
          <Ionicons name="archive-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateGroup')}
          style={styles.newGroupBtn}
        >
          <Ionicons name="people-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={conversations}
        renderItem={renderItem}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        getItemLayout={(_, index) => ({ length: 80, offset: 80 * index, index })}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#8B5CF6" />
        }
        ListHeaderComponent={
          <View style={styles.e2eBanner}>
            <Ionicons name="lock-closed" size={18} color="#10B981" />
            <Text style={styles.e2eText}>{t('chat.e2eBanner')}</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={64} color="#555" />
            <Text style={styles.emptyText}>{t('chat.noChats')}</Text>
            <Text style={styles.emptySub}>{t('chat.noChatsSub')}</Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  archiveBtn: { padding: 6, marginLeft: 'auto' },
  newGroupBtn: { padding: 6 },
  backBtn: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  e2eBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  e2eText: { fontSize: 13, color: '#10B981', flex: 1, lineHeight: 20 },
  row: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1F2937', alignItems: 'center' },
  avatar: { width: 52, height: 52, borderRadius: 26, marginRight: 14 },
  info: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pinIcon: { marginRight: 4 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  time: { fontSize: 12, color: '#6B7280' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { fontSize: 14, color: '#9CA3AF', flex: 1 },
  previewUnread: { color: colors.text, fontWeight: '500' },
  badge: { backgroundColor: '#8B5CF6', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { fontSize: 12, color: colors.text, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#9CA3AF', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#6B7280', marginTop: 8 },
});
