import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DOWNLOAD_QUALITY = [
  { id: 'low', label: 'Düşük', desc: '~1 MB/dakika', size: '~30 MB/albüm' },
  { id: 'normal', label: 'Normal', desc: '~2 MB/dakika', size: '~60 MB/albüm' },
  { id: 'high', label: 'Yüksek', desc: '~5 MB/dakika', size: '~150 MB/albüm' },
];

export default function DownloadSettingsScreen({ navigation }) {
  const { colors } = useTheme();
  const [quality, setQuality] = useState('normal');
  const [wifiOnly, setWifiOnly] = useState(true);
  const [autoDownload, setAutoDownload] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@dl_settings').then(raw => {
      if (raw) {
        const s = JSON.parse(raw);
        setQuality(s.quality || 'normal');
        setWifiOnly(s.wifiOnly !== false);
        setAutoDownload(s.autoDownload || false);
      }
    }).catch(() => {});
  }, []);

  const save = (updates) => {
    const data = { quality, wifiOnly, autoDownload, ...updates };
    AsyncStorage.setItem('@dl_settings', JSON.stringify(data)).catch(() => {});
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>İndirme Ayarları</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>İNDİRME KALİTESİ</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          {DOWNLOAD_QUALITY.map((q, i) => (
            <TouchableOpacity key={q.id} style={[styles.qualityRow, i < DOWNLOAD_QUALITY.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.border }]} onPress={() => { setQuality(q.id); save({ quality: q.id }); }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: quality === q.id ? BRAND.primary : colors.text, fontSize: 15, fontWeight: '500' }}>{q.label}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{q.desc} · {q.size}</Text>
              </View>
              {quality === q.id && <Ionicons name="checkmark-circle" size={22} color={BRAND.primary} />}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>İNDİRME TERCİHLERİ</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <View style={styles.switchRow}>
            <Ionicons name="wifi" size={20} color={BRAND.primary} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 14 }}>Sadece Wi-Fi ile İndir</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Mobil veri kullanımını engeller</Text>
            </View>
            <Switch value={wifiOnly} onValueChange={(v) => { setWifiOnly(v); save({ wifiOnly: v }); }} trackColor={{ true: BRAND.primary, false: colors.border }} thumbColor="#FFF" />
          </View>

          <View style={[styles.switchRow, { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
            <Ionicons name="cloud-download" size={20} color={BRAND.accent} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 14 }}>Otomatik İndir</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Beğenilen parçaları otomatik indir</Text>
            </View>
            <Switch value={autoDownload} onValueChange={(v) => { setAutoDownload(v); save({ autoDownload: v }); }} trackColor={{ true: BRAND.primary, false: colors.border }} thumbColor="#FFF" />
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons name="information-circle" size={18} color={BRAND.accent} />
          <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1, marginLeft: 8, lineHeight: 16 }}>
            İndirilen içerikler cihazınızda saklanır. Depolama alanınız azaldığında otomatik olarak uyarılırsınız.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginTop: 8, marginBottom: 8 },
  card: { borderRadius: 16, padding: 14, marginBottom: 12 },
  qualityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 14, marginTop: 4 },
});
