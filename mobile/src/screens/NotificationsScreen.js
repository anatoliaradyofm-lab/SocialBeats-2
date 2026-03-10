/**
 * NotificationsScreen - Bildirim merkezi
 * - Okundu işaretleme (tekli/toplu)
 * - Bildirim silme (tekli/toplu)
 * - Bildirim erteleme (snooze)
 * - Tip simgeleri
 * - Tıklanınca ilgili ekrana yönlendirme
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Image,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import api from '../services/api';
import { formatDate as formatLocaleDate } from '../lib/localeUtils';
import { useTheme } from '../contexts/ThemeContext';

const avatar = (item) =>
  item?.from_avatar || item?.sender?.avatar_url || `https://i.pravatar.cc/50?u=${item?.sender_id || item?.id}`;

const TYPE_ICONS = {
  like: 'heart',
  reaction: 'heart',
  comment: 'chatbubble',
  reply: 'arrow-undo',
  follow: 'person-add',
  message: 'chatbubble',
  mention: 'at',
  tag: 'pricetag',
  story_reply: 'chatbubble-ellipses',
  friend_request: 'people',
  friend_accepted: 'checkmark-circle',
  weekly_summary: 'bar-chart',
  call_incoming: 'call',
  new_content: 'musical-notes',
  playlist_invite: 'list',
};

const getTypeIcon = (type) => TYPE_ICONS[type] || 'notifications';

const TYPE_ACTION_LABELS = {
  like: 'liked your post',
  reaction: 'liked your post',
  comment: 'commented on your post',
  reply: 'replied to your comment',
  follow: 'followed you',
  message: 'sent you a message',
  mention: 'mentioned you',
  tag: 'tagged you',
  story_reply: 'replied to your story',
  friend_request: 'sent you a friend request',
  friend_accepted: 'accepted your friend request',
};

function getTargetKey(n) {
  const d = n.data || {};
  const postId = d.post_id || n.post_id;
  const convId = d.conversation_id;
  const username = n.sender?.username || n.from_username || d.username;
  if (postId) return `post_${postId}`;
  if (convId) return `conv_${convId}`;
  if (username) return `user_${username}`;
  return `id_${n.id}`;
}

function getSectionKey(iso) {
  if (!iso) return 'Earlier';
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);
  if (d >= startOfToday) return 'Today';
  if (d >= startOfWeek) return 'This Week';
  return 'Earlier';
}

const SECTION_ORDER = ['Today', 'This Week', 'Earlier'];

function buildGroupedSections(notifications) {
  const bySection = { Today: {}, 'This Week': {}, Earlier: {} };
  for (const n of notifications) {
    const section = getSectionKey(n.created_at);
    const type = n.type || 'unknown';
    const targetKey = getTargetKey(n);
    const groupKey = `${type}_${targetKey}`;
    if (!bySection[section][groupKey]) bySection[section][groupKey] = [];
    bySection[section][groupKey].push(n);
  }
  const sections = [];
  for (const sectionTitle of SECTION_ORDER) {
    const groups = bySection[sectionTitle];
    const data = [];
    for (const groupKey of Object.keys(groups)) {
      const items = groups[groupKey].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      data.push({
        groupKey,
        items,
        primary: items[0],
        type: items[0]?.type || 'unknown',
      });
    }
    data.sort((a, b) => new Date(b.primary.created_at) - new Date(a.primary.created_at));
    if (data.length > 0) {
      sections.push({ title: sectionTitle, data });
    }
  }
  return sections;
}

function formatTime(iso, t) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return t('notifications.justNow');
  if (diff < 3600) return t('notifications.minutesAgo', { count: Math.floor(diff / 60) });
  if (diff < 86400) return t('notifications.hoursAgo', { count: Math.floor(diff / 3600) });
  if (diff < 604800) return t('notifications.daysAgo', { count: Math.floor(diff / 86400) });
  return formatLocaleDate(d);
}

export default function NotificationsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { refreshUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const loadNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications?limit=100&offset=0', token);
      setNotifications(res?.notifications || []);
      refreshUnreadCount();
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, refreshUnreadCount]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const markRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`, {}, token);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, is_read: true } : n))
      );
      refreshUnreadCount();
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all', {}, token);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true, is_read: true })));
      refreshUnreadCount();
    } catch {}
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`, token);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      refreshUnreadCount();
    } catch {}
  };

  const clearAll = () => {
    Alert.alert(t('notifications.clearAll'), t('notifications.clearAllConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('notifications.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete('/notifications', token);
            setNotifications([]);
            refreshUnreadCount();
          } catch {}
        },
      },
    ]);
  };

  const snoozeNotification = async (id) => {
    try {
      await api.post(`/notifications/${id}/snooze`, { minutes: 60 }, token).catch(() => {});
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      refreshUnreadCount();
    } catch {}
  };

  const handleNotificationPress = (item) => {
    if (!item.read && !item.is_read) markRead(item.id);

    const data = item.data || {};
    const postId = data.post_id || item.post_id;
    const username = item.sender?.username || item.from_username || data.username;
    const type = item.type;

    if (type === 'message' && data.conversation_id) {
      navigation.navigate('Chat', { conversationId: data.conversation_id });
      return;
    }
    if (postId) {
      navigation.navigate('PostDetail', { postId });
      return;
    }
    if (username) {
      navigation.navigate('UserProfile', { username });
      return;
    }
    if (type === 'friend_request' || type === 'follow') {
      if (username) navigation.navigate('UserProfile', { username });
    }
  };

  const toggleGroupExpanded = (groupKey) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const showItemActions = (item) => {
    const options = [t('notifications.markRead'), t('notifications.snooze1h'), t('notifications.delete'), t('common.cancel')];
    const cancelIdx = 3;
    Platform.OS === 'ios'
      ? ActionSheetIOS.showActionSheetWithOptions(
          { options, cancelButtonIndex: cancelIdx, destructiveButtonIndex: 2 },
          (idx) => {
            if (idx === 0) markRead(item.id);
            else if (idx === 1) snoozeNotification(item.id);
            else if (idx === 2) deleteNotification(item.id);
          }
        )
      : Alert.alert(t('notifications.notification'), undefined, [
          { text: t('notifications.markRead'), onPress: () => markRead(item.id) },
          { text: t('notifications.snooze1h'), onPress: () => snoozeNotification(item.id) },
          { text: t('notifications.delete'), style: 'destructive', onPress: () => deleteNotification(item.id) },
          { text: t('common.cancel'), style: 'cancel' },
        ]);
  };

  const getPrimaryName = (item) =>
    item?.sender?.display_name || item?.sender?.username || item?.from_username || item?.data?.username || 'Someone';

  const renderGroupedItem = ({ item: group }) => {
    const { groupKey, items, primary, type } = group;
    const isExpanded = expandedGroups.has(groupKey);
    const otherCount = items.length - 1;
    const actionLabel = TYPE_ACTION_LABELS[type] || 'notified you';
    const iconName = getTypeIcon(type);
    const hasUnread = items.some((n) => !n.read && !n.is_read);

    if (items.length === 1) {
      const n = items[0];
      const isUnread = !n.read && !n.is_read;
      return (
        <TouchableOpacity
          style={[styles.row, isUnread && styles.unread]}
          activeOpacity={0.7}
          onPress={() => handleNotificationPress(n)}
          onLongPress={() => showItemActions(n)}
        >
          <Image source={{ uri: avatar(n) }} style={styles.avatar} />
          <View style={styles.iconBadge}>
            <Ionicons name={iconName} size={14} color="#fff" />
          </View>
          <View style={styles.info}>
            <Text style={styles.body} numberOfLines={2}>
              {n.body || n.title || n.content}
            </Text>
            <Text style={styles.time}>{formatTime(n.created_at, t)}</Text>
          </View>
          {isUnread && <View style={styles.dot} />}
        </TouchableOpacity>
      );
    }

    const primaryName = getPrimaryName(primary);
    const groupedBody =
      otherCount > 0 ? `${primaryName} and ${otherCount} other${otherCount > 1 ? 's' : ''} ${actionLabel}` : `${primaryName} ${actionLabel}`;

    return (
      <View style={[styles.groupWrapper, hasUnread && styles.unread]}>
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.7}
          onPress={() => toggleGroupExpanded(groupKey)}
        >
          <Image source={{ uri: avatar(primary) }} style={styles.avatar} />
          <View style={styles.iconBadge}>
            <Ionicons name={iconName} size={14} color="#fff" />
          </View>
          <View style={styles.info}>
            <Text style={styles.body} numberOfLines={2}>
              {groupedBody}
            </Text>
            <Text style={styles.time}>{formatTime(primary.created_at, t)}</Text>
          </View>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#9CA3AF" />
          {hasUnread && <View style={styles.dot} />}
        </TouchableOpacity>
        {isExpanded &&
          items.map((n) => {
            const isUnread = !n.read && !n.is_read;
            const name = getPrimaryName(n);
            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.expandedRow, isUnread && styles.unread]}
                activeOpacity={0.7}
                onPress={() => handleNotificationPress(n)}
                onLongPress={() => showItemActions(n)}
              >
                <Image source={{ uri: avatar(n) }} style={styles.expandedAvatar} />
                <View style={styles.info}>
                  <Text style={styles.body} numberOfLines={2}>
                    {n.body || n.title || n.content || `${name} ${actionLabel}`}
                  </Text>
                  <Text style={styles.time}>{formatTime(n.created_at, t)}</Text>
                </View>
                {isUnread && <View style={styles.dot} />}
              </TouchableOpacity>
            );
          })}
      </View>
    );
  };

  const renderSectionHeader = ({ section: { title } }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  const groupedSections = buildGroupedSections(notifications);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('notifications.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('notifications.title')}</Text>
        <View style={styles.headerActions}>
          {notifications.some((n) => !n.read && !n.is_read) && (
            <TouchableOpacity onPress={markAllRead} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>{t('notifications.markAllRead')}</Text>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity onPress={clearAll} style={styles.headerBtn}>
              <Ionicons name="trash-outline" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <SectionList
        sections={groupedSections}
        renderItem={renderGroupedItem}
        renderSectionHeader={renderSectionHeader}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        keyExtractor={(item) => item.groupKey}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />
        }
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="notifications-off-outline" size={64} color="#374151" />
            <Text style={styles.empty}>{t('notifications.empty')}</Text>
          </View>
        }
      />
    </View>
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
  backBtn: { marginRight: 12 },
  backText: { color: colors.accent, fontSize: 16 },
  title: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.text },
  headerActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  headerBtn: { padding: 4 },
  headerBtnText: { color: colors.accent, fontSize: 14 },
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  unread: { backgroundColor: 'rgba(139,92,246,0.1)' },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  iconBadge: {
    position: 'absolute',
    left: 44,
    top: 40,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: { flex: 1 },
  body: { fontSize: 15, color: colors.text },
  time: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8B5CF6',
    marginLeft: 8,
  },
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  empty: { color: '#9CA3AF', marginTop: 16, fontSize: 16 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  groupWrapper: {
    borderRadius: 12,
    marginBottom: 4,
    overflow: 'hidden',
  },
  expandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    paddingLeft: 60,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  expandedAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
});
