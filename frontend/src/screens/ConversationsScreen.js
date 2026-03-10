import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, TextInput,
  StyleSheet, RefreshControl, Modal, Alert, SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';
import SwipeableRow from '../components/ui/SwipeableRow';
import haptic from '../utils/haptics';

const getTabs = (t) => [
  { key: 'chats', label: t('messages.chats'), icon: 'chatbubbles' },
  { key: 'calls', label: t('messages.calls'), icon: 'call' },
];

export default function ConversationsScreen({ navigation }) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState('chats');
  const [conversations, setConversations] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [callHistory, setCallHistory] = useState([]);
  const [showMuteOptions, setShowMuteOptions] = useState(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/messages/conversations', token);
      setConversations(res.conversations || res || []);
    } catch { setConversations([]); }
  }, [token]);

  const fetchCallHistory = useCallback(async () => {
    try {
      const res = await api.get('/messages/calls/history', token);
      setCallHistory(res.calls || []);
    } catch { setCallHistory([]); }
  }, [token]);

  useEffect(() => { fetchConversations(); fetchCallHistory(); }, [fetchConversations, fetchCallHistory]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchConversations();
    await fetchCallHistory();
    setRefreshing(false);
  };

  const pinConversation = async (id) => {
    try { await api.post(`/messages/conversations/${id}/pin`, {}, token); fetchConversations(); } catch {}
  };

  const archiveConversation = async (id) => {
    try { await api.post(`/messages/conversations/${id}/archive`, {}, token); setConversations(prev => prev.filter(c => (c.id || c._id) !== id)); } catch {}
  };

  const deleteConversation = async (id) => {
    Alert.alert(t('messages.deleteConversation'), t('messages.deleteConversationConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        try { await api.delete(`/messages/conversations/${id}`, token); setConversations(prev => prev.filter(c => (c.id || c._id) !== id)); } catch {}
      }},
    ]);
  };

  const muteConversation = async (id, duration) => {
    try { await api.post(`/messages/conversations/${id}/mute`, { duration }, token); setShowMuteOptions(null); Alert.alert('', t('messages.mutedSuccess')); } catch {}
  };

  const createGroup = async () => {
    if (!groupName.trim()) return;
    try {
      const res = await api.post('/messages/groups', { name: groupName.trim() }, token);
      setShowCreateGroup(false);
      setGroupName('');
      navigation.navigate('GroupChat', { conversationId: res.conversation?.id || res.id });
    } catch {}
  };

  const filtered = conversations.filter(c =>
    (c.name || c.group_name || c.recipient?.username || '').toLowerCase().includes(search.toLowerCase())
  );

  const showConvActions = (item) => {
    const id = item.id || item._id;
    const name = item.is_group ? item.group_name || item.name : (item.recipient?.display_name || item.recipient?.username || item.name || '');
    Alert.alert(name, '', [
      { text: item.is_pinned ? t('messages.unpinConversation') : t('messages.pinConversation'), onPress: () => pinConversation(id) },
      { text: t('messages.muteConversation'), onPress: () => setShowMuteOptions(id) },
      { text: t('messages.archiveConversation'), onPress: () => archiveConversation(id) },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteConversation(id) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const formatCallDuration = (s) => {
    if (!s) return '';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('messages.messages')}</Text>
        <TouchableOpacity onPress={() => setShowCreateGroup(true)}>
          <Ionicons name="people-outline" size={22} color={BRAND.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {getTabs(t).map(tab => (
          <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && { borderBottomColor: BRAND.primary }]}>
            <Ionicons name={tab.icon} size={16} color={activeTab === tab.key ? BRAND.primary : colors.textMuted} />
            <Text style={{ color: activeTab === tab.key ? BRAND.primary : colors.textMuted, fontSize: 13, fontWeight: activeTab === tab.key ? '600' : '400' }}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'chats' && (
        <>
          <View style={[styles.searchBar, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder={t('messages.searchConversations')} placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
          </View>

          <FlatList
            data={filtered}
            renderItem={({ item }) => {
              const isGroup = item.type === 'group' || item.is_group;
              const name = isGroup ? (item.group_name || item.name) : (item.recipient?.display_name || item.recipient?.username || item.name || '');
              const avatarUrl = isGroup ? item.group_avatar : item.recipient?.avatar_url;
              const convId = item.id || item._id;
              return (
                <SwipeableRow
                  leftActions={[{ icon: item.is_pinned ? 'pin-outline' : 'pin', label: item.is_pinned ? t('messages.unpinConversation') : t('messages.pinConversation'), color: '#F59E0B', onPress: () => { haptic.medium(); pinConversation(convId); } }]}
                    rightActions={[
                    { icon: 'archive', label: t('messages.archiveConversation'), color: '#3B82F6', onPress: () => { haptic.medium(); archiveConversation(convId); } },
                    { icon: 'trash', label: t('common.delete'), color: '#EF4444', onPress: () => { haptic.heavy(); deleteConversation(convId); } },
                  ]}
                >
                <TouchableOpacity
                  style={[styles.convRow, { backgroundColor: item.is_pinned ? 'rgba(124,58,237,0.04)' : 'transparent', borderBottomColor: colors.border }]}
                  onPress={() => isGroup
                    ? navigation.navigate('GroupChat', { conversationId: item.id || item._id })
                    : navigation.navigate('Chat', { conversationId: item.id || item._id, recipientId: item.recipient?.id, recipientName: name })
                  }
                  onLongPress={() => showConvActions(item)}>
                  <View style={[styles.convAvatar, { backgroundColor: colors.surfaceElevated }]}>
                    {avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.convAvatar} /> :
                      <Ionicons name={isGroup ? 'people' : 'person'} size={20} color={BRAND.primaryLight} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: item.unread_count > 0 ? '700' : '500' }}>{name}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>{item.last_message_ago || ''}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                      <Text style={{ color: item.unread_count > 0 ? colors.text : colors.textMuted, fontSize: 12, flex: 1 }} numberOfLines={1}>
                        {item.last_message?.content || item.last_message || ''}
                      </Text>
                      {item.unread_count > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>{item.unread_count}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {item.is_pinned && <Ionicons name="pin" size={12} color={BRAND.primaryLight} style={{ marginLeft: 6 }} />}
                </TouchableOpacity>
                </SwipeableRow>
              );
            }}
            keyExtractor={(item, i) => item.id || item._id || `${i}`}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}
            contentContainerStyle={{ paddingBottom: 120 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted, marginTop: 16 }}>{t('messages.noConversations')}</Text>
              </View>
            }
          />
        </>
      )}

      {activeTab === 'calls' && (
        <FlatList
          data={callHistory}
          renderItem={({ item }) => {
            const otherUser = item.other_user || {};
            const isVideo = item.call_type === 'video';
            return (
              <TouchableOpacity style={[styles.convRow, { borderBottomColor: colors.border }]}
                onPress={() => navigation.navigate('Call', { recipientName: otherUser.display_name || otherUser.username, recipientId: otherUser.id, callType: item.call_type })}>
                <View style={[styles.convAvatar, { backgroundColor: colors.surfaceElevated }]}>
                  {otherUser.avatar_url ? <Image source={{ uri: otherUser.avatar_url }} style={styles.convAvatar} /> :
                    <Ionicons name="person" size={20} color={BRAND.primaryLight} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>{otherUser.display_name || otherUser.username || t('common.unknown')}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <Ionicons name={item.is_outgoing ? 'arrow-up' : 'arrow-down'} size={12}
                      color={item.status === 'missed' ? '#EF4444' : '#10B981'} />
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      {item.status === 'missed' ? t('messages.missed') : formatCallDuration(item.duration)}
                    </Text>
                  </View>
                </View>
                <Ionicons name={isVideo ? 'videocam' : 'call'} size={20} color={BRAND.primary} />
              </TouchableOpacity>
            );
          }}
          keyExtractor={(item, i) => item.id || `${i}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="call-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginTop: 16 }}>{t('messages.noCallHistory')}</Text>
            </View>
          }
        />
      )}

      {/* Create Group Modal */}
      <Modal visible={showCreateGroup} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('messages.newGroupChat')}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 12 }}>{t('messages.maxParticipants')}</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder={t('messages.groupName')} placeholderTextColor={colors.textMuted} value={groupName} onChangeText={setGroupName} />
            <TouchableOpacity style={styles.createBtn} onPress={createGroup}>
              <Text style={{ color: '#FFF', fontWeight: '700' }}>{t('common.create')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', marginTop: 12 }} onPress={() => setShowCreateGroup(false)}>
              <Text style={{ color: colors.textMuted }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Mute Options Modal */}
      {showMuteOptions && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('messages.muteConversation')}</Text>
              {[
                { key: '1h', label: t('messages.mute1hour') },
                { key: '8h', label: t('messages.mute8hours') },
                { key: '1d', label: t('messages.mute1day') },
                { key: 'forever', label: t('messages.muteForever') },
              ].map(opt => (
                <TouchableOpacity key={opt.key} style={[styles.muteOption, { borderBottomColor: colors.border }]}
                  onPress={() => muteConversation(showMuteOptions, opt.key)}>
                  <Text style={{ color: colors.text }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={{ alignItems: 'center', marginTop: 12 }} onPress={() => setShowMuteOptions(null)}>
                <Text style={{ color: colors.textMuted }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 0.5 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, height: 40, gap: 8, marginVertical: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  convRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, gap: 12 },
  convAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  unreadBadge: { backgroundColor: BRAND.primary, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, marginLeft: 8 },
  empty: { alignItems: 'center', paddingTop: 100 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, marginBottom: 16 },
  createBtn: { backgroundColor: BRAND.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  muteOption: { paddingVertical: 14, borderBottomWidth: 0.5 },
});
