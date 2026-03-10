import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

export default function ProfileVisitors({ onUserPress }) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadVisitors = async () => {
    try {
      const res = await api.get('/user/profile-visitors', token);
      const list = res.visitors || [];
      setVisitors(list);
    } catch {
      setVisitors([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadVisitors(); }, []);

  const onRefresh = () => { setRefreshing(true); loadVisitors(); };

  const renderItem = ({ item }) => {
    const username = item?.visitor_username || item?.username || item?.visitor_id || '?';
    const displayName = item?.visitor_display_name || item?.display_name || username;
    const avatar = item?.visitor_avatar || item?.avatar_url;
    return (
    <TouchableOpacity style={styles.row} onPress={() => onUserPress?.({ username, id: item?.visitor_id, avatar_url: avatar, display_name: displayName })} activeOpacity={0.7}>
      <Image source={{ uri: avatar || 'https://i.pravatar.cc/100?u=' + username }} style={styles.avatar} />
      <View style={styles.info}>
        <Text style={styles.displayName}>{displayName}</Text>
        <Text style={styles.username}>@{username}</Text>
      </View>
    </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('profile.visitors')}</Text>
      {visitors.length === 0 ? (
        <Text style={styles.empty}>{t('profile.noVisitors')}</Text>
      ) : (
        <View>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <Text style={styles.refreshText}>{refreshing ? '...' : 'Yenile'}</Text>
          </TouchableOpacity>
          {visitors.map((item, i) => (
            <View key={item?.id || item?.visitor_id || i}>
              {renderItem({ item })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 120 },
  title: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 16 },
  empty: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  list: { flex: 1 },
  refreshBtn: { marginBottom: 8 },
  refreshText: { color: '#8B5CF6', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  info: { flex: 1 },
  displayName: { fontSize: 16, fontWeight: '500', color: '#fff' },
  username: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
});
