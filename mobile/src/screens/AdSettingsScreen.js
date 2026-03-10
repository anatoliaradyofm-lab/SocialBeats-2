/**
 * AdSettingsScreen - Reklam tercihleri
 * 12.4: Kapatma YOK (zorunlu), ilgi hedefleme, reklam bildirimleri
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const INTERESTS = [
  { id: 'music', label: 'Müzik', icon: 'musical-notes' },
  { id: 'podcast', label: 'Podcast', icon: 'mic' },
  { id: 'concerts', label: 'Konserler', icon: 'calendar' },
  { id: 'streaming', label: 'Yayın', icon: 'radio' },
  { id: 'social', label: 'Sosyal', icon: 'people' },
  { id: 'tech', label: 'Teknoloji', icon: 'hardware-chip' },
];

export default function AdSettingsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const s = await api.get('/ads/settings', token);
      setSettings(s);
    } catch {
      setSettings({ interest_targeting: true, ad_notifications: false, interests: [] });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      await api.put('/ads/settings', { [key]: value }, token);
      setSettings((s) => ({ ...s, [key]: value }));
    } catch (e) {
      console.warn(e);
    }
  };

  const toggleInterest = (id) => {
    const list = settings?.interests || [];
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    updateSetting('interests', next);
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Geri</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reklam Ayarları</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </View>
    );
  }

  const s = settings || {};

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reklam Ayarları</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={24} color="#8B5CF6" />
          <Text style={styles.infoText}>
            Reklamlar uygulamanın ücretsiz kullanımını destekler. Reklamları kapatma seçeneği bulunmamaktadır.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hedefleme</Text>
          <View style={styles.row}>
            <Text style={styles.label}>İlgi alanlarına göre reklam hedefleme</Text>
            <Switch
              value={s.interest_targeting ?? true}
              onValueChange={(v) => updateSetting('interest_targeting', v)}
              trackColor={{ false: '#374151', true: '#8B5CF6' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>İlgi alanları</Text>
          <Text style={styles.sectionSubtitle}>Bu alanlara göre size uygun reklamlar gösterilir</Text>
          <View style={styles.interestGrid}>
            {INTERESTS.map((i) => (
              <TouchableOpacity
                key={i.id}
                style={[styles.interestChip, (s.interests || []).includes(i.id) && styles.interestChipActive]}
                onPress={() => toggleInterest(i.id)}
              >
                <Ionicons
                  name={i.icon}
                  size={18}
                  color={(s.interests || []).includes(i.id) ? '#fff' : '#9CA3AF'}
                />
                <Text style={[styles.interestText, (s.interests || []).includes(i.id) && styles.interestTextActive]}>
                  {i.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bildirimler</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Reklam bildirimleri</Text>
            <Switch
              value={s.ad_notifications ?? false}
              onValueChange={(v) => updateSetting('ad_notifications', v)}
              trackColor={{ false: '#374151', true: '#8B5CF6' }}
              thumbColor="#fff"
            />
          </View>
        </View>
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
  backBtn: { marginRight: 16 },
  backText: { color: colors.accent, fontSize: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  scroll: { flex: 1 },
  content: { padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  infoText: { flex: 1, fontSize: 14, color: '#E5E7EB' },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#9CA3AF', marginBottom: 8 },
  sectionSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: { fontSize: 16, color: colors.text, flex: 1 },
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#1F2937',
  },
  interestChipActive: { backgroundColor: '#8B5CF6' },
  interestText: { fontSize: 14, color: '#9CA3AF' },
  interestTextActive: { color: colors.text, fontWeight: '600' },
});
