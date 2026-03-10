/**
 * ArchivedConversationsScreen - Arşivlenmiş sohbetler
 * Backend: GET /messages/conversations/archived
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  RefreshControl, ActivityIndicator} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useArchivedConversationsQuery } from '../hooks/useConversationsQuery';
import api from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { formatDate as formatLocaleDate, formatTime as formatLocaleTime } from '../lib/localeUtils';
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

export default function ArchivedConversationsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data: conversations = [], isLoading, isRefetching, refetch } = useArchivedConversationsQuery(token);

  const getOtherUser = (conv) => {
    const others = conv.other_participants || [];
    return others[0] || {};
  };

  const unarchive = async (conv) => {
    try {
      await api.delete(`/messages/conversations/${conv.id}/archive`, token);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversationsArchived'] });
    } catch {}
  };

  const renderItem = ({ item }) => {
    const isGroup = item.is_group;
    const other = getOtherUser(item);
    const displayName = isGroup ? (item.group_name || t('archivedConversations.group')) : (other.display_name || other.username || t('archivedConversations.user'));
    const avatar = isGroup ? (item.group_avatar || `https://i.pravatar.cc/100?g=${item.id}`) : (other.avatar_url || `https://i.pravatar.cc/100?u=${other.username || other.id}`);
    const lastMsg = item.last_message;
    let preview = lastMsg?.content_type === 'TEXT' ? (lastMsg.content || '') : `📷 ${t('archivedConversations.media')}`;
    if (lastMsg?.content_type === 'IMAGE') preview = `📷 ${t('archivedConversations.photo')}`;
    else if (lastMsg?.content_type === 'VIDEO') preview = `🎥 ${t('archivedConversations.video')}`;
    else if (lastMsg?.content_type === 'VOICE') preview = `🎤 ${t('archivedConversations.voiceMessage')}`;
    else if (lastMsg?.content_type === 'GIF') preview = 'GIF';

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('Chat', { conversationId: item.id, otherUser: other, isGroup, conversation: { ...item, is_archived: true } })}
      >
        <Image source={{ uri: avatar }} style={styles.avatar} />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            <TouchableOpacity onPress={() => unarchive(item)} style={styles.unarchiveBtn}>
              <Ionicons name="arrow-undo-outline" size={20} color="#8B5CF6" />
            </TouchableOpacity>
          </View>
          <Text style={styles.preview} numberOfLines={1}>{preview || t('archivedConversations.chat')}</Text>
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
          <Text style={styles.title}>{t('archivedConversations.archive')}</Text>
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
        <Text style={styles.title}>{t('archivedConversations.title')}</Text>
      </View>
      <FlatList
        data={conversations}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#8B5CF6" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="archive-outline" size={64} color="#555" />
            <Text style={styles.emptyText}>{t('archivedConversations.noArchived')}</Text>
          </View>
        }
      />
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
  row: { flexDirection: 'row', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1F2937', alignItems: 'center' },
  avatar: { width: 52, height: 52, borderRadius: 26, marginRight: 14 },
  info: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  unarchiveBtn: { padding: 8 },
  preview: { fontSize: 14, color: '#9CA3AF' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#9CA3AF', marginTop: 16 },
});
