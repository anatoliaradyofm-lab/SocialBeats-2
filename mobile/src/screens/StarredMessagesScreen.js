/**
 * StarredMessagesScreen - Yıldızlı mesajlar
 */
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, RefreshControl} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { getApiUrl } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

const mediaUri = (uri) => {
  if (!uri) return null;
  if (uri.startsWith('http')) return uri;
  const base = (getApiUrl() || '').replace(/\/api\/?$/, '');
  return uri.startsWith('/') ? `${base}${uri}` : `${base}/api/${uri}`;
};

function MessagePreview({ item, onPress, onUnstar, isMe, t }) {
  let content = item.content || '';
  if (item.content_type === 'IMAGE') content = `📷 ${t('starredMessages.photo')}`;
  else if (item.content_type === 'VIDEO') content = `🎥 ${t('starredMessages.video')}`;
  else if (item.content_type === 'VOICE') content = `🎤 ${t('starredMessages.voiceMessage')}`;
  else if (item.content_type === 'GIF') content = 'GIF';
  else if (item.content_type === 'POST') content = `📄 ${t('starredMessages.post')}`;
  else if (item.content_type === 'MUSIC') content = `🎵 ${t('starredMessages.music')}`;
  else if (item.content_type === 'PLAYLIST') content = `📋 ${t('starredMessages.playlist')}`;
  else if (item.content_type === 'PROFILE') content = `👤 ${t('starredMessages.profile')}`;
  else if (item.content_type && content === '') content = t('starredMessages.media');
  return (
    <TouchableOpacity style={styles.msgRow} onPress={() => onPress(item)} activeOpacity={0.8}>
      <Image source={{ uri: item.sender?.avatar_url || `https://i.pravatar.cc/80?u=${item.sender_id}` }} style={styles.avatar} />
      <View style={styles.msgInfo}>
        <Text style={styles.senderName}>{item.sender?.display_name || item.sender?.username || t('starredMessages.user')}</Text>
        <Text style={styles.msgContent} numberOfLines={2}>{content || t('starredMessages.media')}</Text>
      </View>
      <TouchableOpacity onPress={() => onUnstar(item.id)} style={styles.unstarBtn}>
        <Ionicons name="star" size={22} color="#FBBF24" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function StarredMessagesScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/messages/starred', token);
      setMessages(res?.messages || []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  React.useEffect(() => { load(); }, [load]);

  const unstar = async (messageId) => {
    try {
      await api.delete(`/messages/${messageId}/star`, token);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch {}
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
        <Text style={styles.title}>{t('starredMessages.title')}</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : (
        <FlatList
          data={messages}
          renderItem={({ item }) => (
            <MessagePreview
              item={item}
              onPress={(m) => navigation.navigate('Chat', { conversationId: m.conversation_id })}
              onUnstar={unstar}
              isMe={false}
              t={t}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#8B5CF6" />}
          ListEmptyComponent={<Text style={styles.empty}>{t('starredMessages.noMessages')}</Text>}
        />
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  backBtn: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  msgRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#1F2937', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  msgInfo: { flex: 1, minWidth: 0 },
  senderName: { fontSize: 15, fontWeight: '600', color: colors.text },
  msgContent: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
  unstarBtn: { padding: 8 },
  empty: { color: '#9CA3AF', textAlign: 'center', padding: 24 },
});
