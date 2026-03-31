import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../services/api';

const NOTIF_ITEMS = [
  { key: 'push',     label: 'Push Bildirimleri',  sub: 'Tüm anlık bildirimleri al',             icon: 'phone-portrait-outline',   color: '#A78BFA' },
  { key: 'messages', label: 'Mesaj Bildirimleri', sub: 'Yeni mesaj geldiğinde bildir',           icon: 'chatbubble-outline',        color: '#60A5FA' },
  { key: 'likes',    label: 'Beğeni Bildirimleri',sub: 'Gönderilerin beğenildiğinde bildir',     icon: 'heart-outline',             color: '#F87171' },
  { key: 'follows',  label: 'Takip Bildirimleri', sub: 'Yeni takipçi kazandığında bildir',       icon: 'person-add-outline',        color: '#34D399' },
];

export default function NotifSettingsScreen({ navigation }) {
  const { colors } = useTheme();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();

  const DEFAULT_SETTINGS = { push: true, messages: true, likes: true, follows: true };
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/notifications/preferences', token)
      .then(data => setSettings(s => ({ ...s, ...data })))
      .catch(() => {});
  }, []);

  const toggle = useCallback((key) => {
    setSettings(prev => {
      const next = { ...prev, [key]: !prev[key] };
      setSaving(true);
      api.put('/notifications/preferences', next, token)
        .catch(() => {})
        .finally(() => setSaving(false));
      return next;
    });
  }, [token]);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[s.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Bildirim Ayarları</Text>
        <View style={{ width: 40, alignItems: 'center' }}>
          {saving && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
          {NOTIF_ITEMS.map((item, i) => (
            <View
              key={item.key}
              style={[s.row, i < NOTIF_ITEMS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
            >
              <View style={[s.iconWrap, { backgroundColor: item.color + '22' }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.rowLabel, { color: colors.text }]}>{item.label}</Text>
                <Text style={[s.rowSub, { color: colors.textMuted }]}>{item.sub}</Text>
              </View>
              <Switch
                value={settings[item.key]}
                onValueChange={() => toggle(item.key)}
                trackColor={{ false: colors.surfaceHigh, true: colors.primary + '99' }}
                thumbColor={settings[item.key] ? colors.primary : colors.textMuted}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  scroll: { padding: 16, gap: 16 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12 },
});
