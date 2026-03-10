import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

function formatDate(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function SessionsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(null);

  const loadSessions = async () => {
    try {
      const data = await api.get('/auth/sessions', token);
      setSessions(Array.isArray(data) ? data : []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleRevokeAll = () => {
    Alert.alert(
      'Tüm Oturumları Kapat',
      'Diğer tüm cihazlardan çıkış yapılacak. Bu cihazda oturumunuz açık kalacak. Devam edilsin mi?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kapat',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/auth/sessions/revoke-all', {}, token);
              loadSessions();
              Alert.alert('Başarılı', 'Diğer oturumlar kapatıldı');
            } catch (err) {
              Alert.alert('Hata', err.data?.detail || err.message || 'İşlem başarısız');
            }
          },
        },
      ]
    );
  };

  const handleRevokeOne = (session) => {
    if (session.is_current) return;
    Alert.alert(
      'Oturum Sonlandır',
      `${session.device || session.browser || 'Bu cihaz'} oturumunu kapatmak istiyor musunuz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sonlandır',
          style: 'destructive',
          onPress: async () => {
            setRevoking(session.id);
            try {
              await api.delete(`/auth/sessions/${session.id}`, token);
              loadSessions();
            } catch (err) {
              Alert.alert('Hata', err.data?.detail || err.message || 'İşlem başarısız');
            } finally {
              setRevoking(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Geri</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Oturum Açık Cihazlar</Text>
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
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Oturum Açık Cihazlar</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.hint}>Aşağıda hesabınıza giriş yapılan cihazlar listelenir. Şüpheli bir oturum görürseniz hemen kapatın.</Text>
        {sessions.map((item) => (
          <View key={item.id || item.device || Math.random()} style={styles.sessionRow}>
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionDevice}>{item.device || item.browser || 'Bilinmeyen Cihaz'}</Text>
              <Text style={styles.sessionMeta}>
                {item.location || ''} • Son: {formatDate(item.last_active)}
              </Text>
            </View>
            {item.is_current ? (
              <Text style={styles.currentBadge}>Bu cihaz</Text>
            ) : (
              <TouchableOpacity
                onPress={() => handleRevokeOne(item)}
                disabled={revoking === item.id}
                style={styles.revokeBtn}
              >
                {revoking === item.id ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <Text style={styles.revokeText}>Kapat</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ))}
        <TouchableOpacity style={styles.revokeAllBtn} onPress={handleRevokeAll}>
          <Text style={styles.revokeAllText}>Tüm Diğer Oturumları Kapat</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  backBtn: {},
  backText: { color: colors.accent, fontSize: 16 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginLeft: 16 },
  scroll: { flex: 1 },
  content: { padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hint: { fontSize: 14, color: '#9CA3AF', marginBottom: 20 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sessionInfo: { flex: 1 },
  sessionDevice: { fontSize: 16, fontWeight: '600', color: colors.text },
  sessionMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  currentBadge: { fontSize: 12, color: colors.accent, fontWeight: '500' },
  revokeBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  revokeText: { color: '#DC2626', fontSize: 14, fontWeight: '500' },
  revokeAllBtn: {
    marginTop: 24,
    backgroundColor: '#DC2626',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  revokeAllText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
