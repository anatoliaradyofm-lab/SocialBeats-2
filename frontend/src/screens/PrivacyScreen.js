import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

function ToggleRow({ label, desc, value, onChange, colors }) {
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 14 }}>{label}</Text>
        {desc ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{desc}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.border, true: BRAND.primaryLight }} thumbColor={value ? BRAND.primary : '#FFF'} />
    </View>
  );
}

function NavRow({ icon, label, colors, onPress }) {
  return (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={onPress}>
      <Ionicons name={icon} size={18} color={BRAND.primary} style={{ marginRight: 12 }} />
      <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function PrivacyScreen({ navigation }) {
  const { colors } = useTheme();
  const { token } = useAuth();
  const [settings, setSettings] = useState({
    privateAccount: false, activityStatus: true, readReceipts: true,
    showSuggestions: true, allowSharing: true, showListening: true,
  });

  useEffect(() => {
    if (!token) return;
    api.get('/user/settings', token).then(r => {
      const s = r.settings || r || {};
      setSettings({
        privateAccount: s.is_private || s.privateAccount || false,
        activityStatus: s.activity_status !== false,
        readReceipts: s.read_receipts !== false,
        showSuggestions: s.show_suggestions !== false,
        allowSharing: s.allow_sharing !== false,
        showListening: s.show_listening !== false,
      });
    }).catch(() => {});
  }, [token]);

  const toggle = (key) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      const payload = {
        is_private: updated.privateAccount,
        activity_status: updated.activityStatus,
        read_receipts: updated.readReceipts,
        show_suggestions: updated.showSuggestions,
        allow_sharing: updated.allowSharing,
        show_listening: updated.showListening,
      };
      api.put('/user/settings', payload, token).catch(() => {});
      return updated;
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Gizlilik</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>HESAP GİZLİLİĞİ</Text>
        <View style={[styles.section, { backgroundColor: colors.surfaceElevated }]}>
          <ToggleRow label="Gizli Hesap" desc="Sadece takipçiler gönderi görebilir" value={settings.privateAccount} onChange={() => toggle('privateAccount')} colors={colors} />
          <ToggleRow label="Aktivite Durumu" desc="Çevrimiçi olduğun görünsün" value={settings.activityStatus} onChange={() => toggle('activityStatus')} colors={colors} />
          <ToggleRow label="Okundu Bilgisi" value={settings.readReceipts} onChange={() => toggle('readReceipts')} colors={colors} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PAYLAŞIM</Text>
        <View style={[styles.section, { backgroundColor: colors.surfaceElevated }]}>
          <ToggleRow label="Önerilerde Göster" desc="Profilin önerilen kişilerde gösterilsin" value={settings.showSuggestions} onChange={() => toggle('showSuggestions')} colors={colors} />
          <ToggleRow label="Paylaşıma İzin Ver" desc="Gönderilerin paylaşılabilir olsun" value={settings.allowSharing} onChange={() => toggle('allowSharing')} colors={colors} />
          <ToggleRow label="Dinlediğimi Göster" desc="Ne dinlediğin görünsün" value={settings.showListening} onChange={() => toggle('showListening')} colors={colors} />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ENGELLEMELER</Text>
        <View style={[styles.section, { backgroundColor: colors.surfaceElevated }]}>
          <NavRow icon="ban" label="Engellenen Hesaplar" colors={colors} onPress={() => navigation.navigate('BlockedUsers')} />
          <NavRow icon="volume-mute" label="Sessize Alınanlar" colors={colors} onPress={() => {}} />
          <NavRow icon="remove-circle" label="Kısıtlanan Hesaplar" colors={colors} onPress={() => {}} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, paddingHorizontal: 16, marginTop: 24, marginBottom: 8 },
  section: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5 },
});
