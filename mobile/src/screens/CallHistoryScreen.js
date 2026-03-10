/**
 * CallHistoryScreen - Arama geçmişi (sesli/görüntülü)
 * WebRTC entegrasyonu için backend hazır
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
import { formatDate as formatLocaleDate, formatTime as formatLocaleTime } from '../lib/localeUtils';
import { useTheme } from '../contexts/ThemeContext';

function formatCallTime(iso) {
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

function formatDuration(sec) {
  if (!sec || sec < 0) return '--:--';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CallHistoryScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/messages/calls/history', token);
      setCalls(res?.calls || []);
    } catch {
      setCalls([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  React.useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }) => {
    const other = item.other_user || {};
    const isOutgoing = item.caller_id !== item.callee_id && item.caller_id; // simplified
    const displayName = other.display_name || other.username || t('calls.user');
    const avatar = other.avatar_url || `https://i.pravatar.cc/80?u=${other.id}`;
    const isVideo = item.call_type === 'video';
    const isMissed = item.status === 'missed';
    const isRejected = item.status === 'rejected';

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => other?.id && navigation.navigate('Chat', { conversationId: item.conversation_id, otherUser: other, isGroup: false })}
        activeOpacity={0.8}
      >
        <Image source={{ uri: avatar }} style={styles.avatar} />
        <View style={styles.info}>
          <Text style={[styles.name, (isMissed || isRejected) && styles.missed]} numberOfLines={1}>
            {displayName}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons
              name={isVideo ? 'videocam' : 'call'}
              size={14}
              color={isMissed || isRejected ? '#EF4444' : '#9CA3AF'}
            />
            <Text style={[styles.meta, (isMissed || isRejected) && styles.metaMissed]}>
              {isMissed ? t('calls.missed') : isRejected ? t('calls.rejected') : formatDuration(item.duration_seconds)}
            </Text>
          </View>
        </View>
        <Text style={styles.time}>{formatCallTime(item.started_at)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('calls.historyTitle')}</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : (
        <FlatList
          data={calls}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#8B5CF6" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="call-outline" size={64} color="#555" />
              <Text style={styles.emptyText}>{t('calls.noHistory')}</Text>
            </View>
          }
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
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#1F2937', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  missed: { color: colors.error },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  meta: { fontSize: 13, color: '#9CA3AF' },
  metaMissed: { color: colors.error },
  time: { fontSize: 12, color: '#6B7280' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#9CA3AF', marginTop: 16 },
});
