import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet,
  RefreshControl, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationContext';
import api from '../services/api';

const getTabs = (t) => [
  { id: 'all', label: t('notifications.tabAll'), icon: 'notifications' },
  { id: 'like', label: t('notifications.tabLike'), icon: 'heart' },
  { id: 'comment', label: t('notifications.tabComment'), icon: 'chatbubble' },
  { id: 'follow', label: t('notifications.tabFollow'), icon: 'person-add' },
  { id: 'message', label: t('notifications.tabMessage'), icon: 'mail' },
  { id: 'repost', label: t('notifications.tabRepost'), icon: 'repeat' },
  { id: 'mention', label: t('notifications.tabMention'), icon: 'at' },
  { id: 'story_reply', label: t('notifications.tabStoryReply'), icon: 'chatbubble-ellipses' },
  { id: 'new_content', label: t('notifications.tabNewContent'), icon: 'sparkles' },
];

const TYPE_ICONS = {
    like: { name: 'heart', color: BRAND.pink },
    comment: { name: 'chatbubble', color: BRAND.accent },
    follow: { name: 'person-add', color: BRAND.primary },
  follow_request: { name: 'person-add-outline', color: BRAND.primary },
    message: { name: 'mail', color: '#10B981' },
    mention: { name: 'at', color: '#F59E0B' },
  story_reply: { name: 'chatbubble-ellipses', color: '#8B5CF6' },
  repost: { name: 'repeat', color: '#3B82F6' },
  new_content: { name: 'sparkles', color: '#10B981' },
    music: { name: 'musical-note', color: BRAND.primaryLight },
  weekly_summary: { name: 'bar-chart', color: BRAND.primary },
  daily_reminder: { name: 'alarm', color: '#F59E0B' },
  system: { name: 'notifications', color: '#6B7280' },
};

const getSnoozeOptions = (t) => [
  { label: t('notifications.snooze30min'), minutes: 30 },
  { label: t('notifications.snooze1hour'), minutes: 60 },
  { label: t('notifications.snooze4hours'), minutes: 240 },
  { label: t('notifications.snooze1day'), minutes: 1440 },
];

function smartGroup(notifications, t) {
  const groups = {};
  const standalone = [];

  notifications.forEach(n => {
    if (['like', 'repost'].includes(n.type) && n.data?.post_id) {
      const key = `${n.type}_${n.data.post_id}`;
      if (!groups[key]) groups[key] = { type: n.type, post_id: n.data.post_id, items: [], latest: n };
      groups[key].items.push(n);
      if (n.created_at > groups[key].latest.created_at) groups[key].latest = n;
    } else {
      standalone.push(n);
    }
  });

  const result = [...standalone];
  Object.values(groups).forEach(g => {
    if (g.items.length > 2) {
      const senders = g.items.map(i => i.sender?.username || i.from_username).filter(Boolean);
      const uniqueSenders = [...new Set(senders)].slice(0, 3);
      const othersCount = Math.max(0, new Set(senders).size - 3);
      const label = uniqueSenders.join(', ') + (othersCount > 0 ? ` ${t('notifications.andOthers', { count: othersCount })}` : '');
      const action = g.type === 'like' ? t('notifications.liked') : t('notifications.reposted');
      result.push({
        ...g.latest,
        _grouped: true,
        _groupCount: g.items.length,
        _groupLabel: `${label} ${action}`,
        _groupIds: g.items.map(i => i.id),
        read: g.items.every(i => i.read),
      });
    } else {
      result.push(...g.items);
    }
  });

  return result.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

export default function NotificationsScreen({ navigation }) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { colors } = useTheme();
  const { fetchUnreadCount } = useNotifications();
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [snoozeModal, setSnoozeModal] = useState(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications?limit=50', token);
      setNotifications(res.notifications || res || []);
    } catch { setNotifications([]); }
  }, [token]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    fetchUnreadCount();
    setRefreshing(false);
  };

  const markAsRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`, {}, token);
      setNotifications(prev => prev.map(n => (n.id || n._id) === id ? { ...n, read: true } : n));
      fetchUnreadCount();
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all', {}, token);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      fetchUnreadCount();
    } catch {}
  };

  const deleteNotif = async (id) => {
    try {
      await api.delete(`/notifications/${id}`, token);
      setNotifications(prev => prev.filter(n => (n.id || n._id) !== id));
      fetchUnreadCount();
    } catch {}
  };

  const snoozeNotif = async (id, minutes) => {
    try {
      await api.post(`/notifications/${id}/snooze`, { minutes }, token);
      setNotifications(prev => prev.filter(n => (n.id || n._id) !== id));
      setSnoozeModal(null);
    } catch {}
  };

  const filtered = activeTab === 'all' ? notifications : notifications.filter(n => n.type === activeTab);
  const grouped = smartGroup(filtered, t);
  const unreadCount = notifications.filter(n => !n.read).length;

  const handlePress = (notif) => {
    if (!notif.read) markAsRead(notif.id || notif._id);
    if (notif.data?.post_id) navigation.navigate('PostDetail', { postId: notif.data.post_id });
    else if (notif.data?.user_id) navigation.navigate('UserProfile', { userId: notif.data.user_id });
    else if (notif.data?.conversation_id) navigation.navigate('Chat', { conversationId: notif.data.conversation_id });
    else if (notif.data?.story_id) navigation.navigate('StoryViewer', { storyId: notif.data.story_id });
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return t('time.justNow');
    if (diff < 3600) return t('time.minutesShort', { count: Math.floor(diff / 60) });
    if (diff < 86400) return t('time.hoursShort', { count: Math.floor(diff / 3600) });
    if (diff < 604800) return t('time.daysShort', { count: Math.floor(diff / 86400) });
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  const renderItem = ({ item }) => {
    const iconInfo = TYPE_ICONS[item.type] || TYPE_ICONS.system;

    return (
      <TouchableOpacity
        style={[styles.notifRow, { backgroundColor: item.read ? 'transparent' : `${BRAND.primary}08`, borderBottomColor: colors.border }]}
        onPress={() => handlePress(item)}
        onLongPress={() => Alert.alert(t('notifications.options'), '', [
          { text: t('notifications.markRead'), onPress: () => markAsRead(item.id || item._id) },
          { text: t('notifications.snooze'), onPress: () => setSnoozeModal(item.id || item._id) },
          { text: t('common.delete'), style: 'destructive', onPress: () => deleteNotif(item.id || item._id) },
          { text: t('common.cancel'), style: 'cancel' },
        ])}
      >
        <View style={[styles.notifIcon, { backgroundColor: `${iconInfo.color}18` }]}>
          <Ionicons name={iconInfo.name} size={18} color={iconInfo.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18 }}>
            {item._grouped ? (
              <>
                <Text style={{ fontWeight: '600' }}>{item._groupLabel}</Text>
                {item._groupCount > 0 && <Text style={{ color: colors.textMuted }}> ({item._groupCount})</Text>}
              </>
            ) : (
              <>
                {(item.sender?.username || item.from_username) && (
                  <Text style={{ fontWeight: '600' }}>{item.sender?.username || item.from_username} </Text>
                )}
                {item.message || item.body || item.content || item.text || ''}
              </>
            )}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 3 }}>
            {item.created_ago || timeAgo(item.created_at)}
          </Text>
        </View>
        {(item.sender?.avatar_url || item.from_avatar) && (
          <Image source={{ uri: item.sender?.avatar_url || item.from_avatar }} style={styles.notifUserAvatar} />
        )}
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t('notifications.notifications')} {unreadCount > 0 && `(${unreadCount})`}
        </Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity onPress={markAllRead}>
          <Ionicons name="checkmark-done" size={22} color={BRAND.primary} />
        </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('NotificationSettings')}>
            <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        horizontal
        data={getTabs(t)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
        keyExtractor={t => t.id}
        renderItem={({ item: t }) => (
          <TouchableOpacity
            style={[styles.tab, { backgroundColor: activeTab === t.id ? BRAND.primary : colors.surfaceElevated }]}
            onPress={() => setActiveTab(t.id)}
          >
            <Ionicons name={t.icon} size={13} color={activeTab === t.id ? '#FFF' : colors.textMuted} />
            <Text style={{ color: activeTab === t.id ? '#FFF' : colors.textSecondary, fontSize: 12, fontWeight: '500' }}>{t.label}</Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={grouped}
        renderItem={renderItem}
        keyExtractor={(item, i) => item.id || item._id || `${i}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 16 }}>{t('notifications.noNotifications')}</Text>
          </View>
        }
      />

      {/* Snooze Modal */}
      <Modal visible={!!snoozeModal} transparent animationType="fade" onRequestClose={() => setSnoozeModal(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSnoozeModal(null)}>
          <View style={[styles.snoozeSheet, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 16 }}>{t('notifications.snoozeTitle')}</Text>
            {getSnoozeOptions(t).map(opt => (
              <TouchableOpacity
                key={opt.minutes}
                style={[styles.snoozeOption, { borderBottomColor: colors.border }]}
                onPress={() => snoozeNotif(snoozeModal, opt.minutes)}
              >
                <Ionicons name="time-outline" size={18} color={BRAND.primary} />
                <Text style={{ color: colors.text, fontSize: 14, marginLeft: 10 }}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.snoozeCancel} onPress={() => setSnoozeModal(null)}>
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  tabRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, gap: 5 },
  notifRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, gap: 12 },
  notifIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  notifUserAvatar: { width: 36, height: 36, borderRadius: 18 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND.primary },
  empty: { alignItems: 'center', paddingTop: 100 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  snoozeSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  snoozeOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5 },
  snoozeCancel: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
});
