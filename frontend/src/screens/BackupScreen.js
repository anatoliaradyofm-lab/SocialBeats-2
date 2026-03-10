import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

export default function BackupScreen({ navigation }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const [autoBackup, setAutoBackup] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const categories = [
    { id: 'playlists', label: 'Çalma Listeleri', icon: 'list', included: true },
    { id: 'favorites', label: 'Beğeniler', icon: 'heart', included: true },
    { id: 'settings', label: 'Ayarlar', icon: 'settings', included: true },
    { id: 'history', label: 'Dinleme Geçmişi', icon: 'time', included: true },
    { id: 'posts', label: 'Gönderiler', icon: 'images', included: true },
    { id: 'messages', label: 'Mesajlar', icon: 'chatbubbles', included: false },
  ];

  const [included, setIncluded] = useState(Object.fromEntries(categories.map(c => [c.id, c.included])));

  useEffect(() => {
    api.get('/user/backup-info', token).then(r => {
      const info = r.backup || r || {};
      setLastBackup(info.last_backup || null);
      setAutoBackup(info.auto_backup || false);
    }).catch(() => {});
  }, [token]);

  const createBackup = async () => {
    setBackingUp(true);
    try {
      const enabledCats = Object.entries(included).filter(([_, v]) => v).map(([k]) => k);
      await api.post('/user/backup', { categories: enabledCats }, token);
      setLastBackup(new Date().toISOString());
      Alert.alert('Yedeklendi', 'Verileriniz başarıyla yedeklendi.');
    } catch {
      Alert.alert('Bilgi', 'Yedekleme isteği alındı.');
    }
    setBackingUp(false);
  };

  const restoreBackup = () => {
    Alert.alert('Geri Yükle', 'Son yedekten geri yüklemek istediğinize emin misiniz?', [
      { text: 'İptal' },
      { text: 'Geri Yükle', onPress: async () => {
        setRestoring(true);
        try { await api.post('/user/restore', {}, token); Alert.alert('Başarılı', 'Verileriniz geri yüklendi.'); } catch { Alert.alert('Bilgi', 'Geri yükleme isteği alındı.'); }
        setRestoring(false);
      }},
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Yedekleme</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={[styles.statusCard, { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons name="cloud-done" size={40} color={BRAND.primary} />
          <Text style={[styles.statusTitle, { color: colors.text }]}>
            {lastBackup ? 'Son Yedekleme' : 'Henüz Yedek Yok'}
          </Text>
          {lastBackup && (
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              {new Date(lastBackup).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>YEDEKLENECEKLer</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          {categories.map((cat, i) => (
            <View key={cat.id} style={[styles.switchRow, i > 0 && { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
              <Ionicons name={cat.icon} size={20} color={included[cat.id] ? BRAND.primary : colors.textMuted} style={{ marginRight: 12 }} />
              <Text style={{ color: colors.text, flex: 1, fontSize: 14 }}>{cat.label}</Text>
              <Switch value={included[cat.id]} onValueChange={(v) => setIncluded(p => ({ ...p, [cat.id]: v }))} trackColor={{ true: BRAND.primary, false: colors.border }} thumbColor="#FFF" />
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <View style={styles.switchRow}>
            <Ionicons name="sync" size={20} color={BRAND.accent} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 14 }}>Otomatik Yedekleme</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Haftada bir otomatik yedekle</Text>
            </View>
            <Switch value={autoBackup} onValueChange={(v) => { setAutoBackup(v); api.put('/user/backup-settings', { auto_backup: v }, token).catch(() => {}); }} trackColor={{ true: BRAND.primary, false: colors.border }} thumbColor="#FFF" />
          </View>
        </View>

        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: BRAND.primary }]} onPress={createBackup} disabled={backingUp}>
          {backingUp ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="cloud-upload" size={20} color="#FFF" /><Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Şimdi Yedekle</Text></>}
        </TouchableOpacity>

        {lastBackup && (
          <TouchableOpacity style={[styles.secondaryBtn, { borderColor: BRAND.primary }]} onPress={restoreBackup} disabled={restoring}>
            {restoring ? <ActivityIndicator color={BRAND.primary} /> : <><Ionicons name="cloud-download" size={20} color={BRAND.primary} /><Text style={{ color: BRAND.primary, fontWeight: '700', fontSize: 15 }}>Geri Yükle</Text></>}
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  statusCard: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16, gap: 6 },
  statusTitle: { fontSize: 18, fontWeight: '700' },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },
  card: { borderRadius: 16, padding: 14, marginBottom: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, marginTop: 12 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, marginTop: 10, borderWidth: 1.5 },
});
