import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

const LEGAL_ITEMS = [
  { label: 'Kullanım Koşulları',              icon: 'document-text-outline',    color: '#A78BFA', action: 'terms' },
  { label: 'Gizlilik Politikası',             icon: 'shield-outline',           color: '#60A5FA', action: 'privacy' },
  { label: 'Çerez Politikası',                icon: 'information-circle-outline',color: '#FBBF24', action: 'cookies' },
  { label: 'Açık Kaynak Lisansları',          icon: 'code-slash-outline',       color: '#34D399', action: 'licenses' },
  { label: 'Topluluk Kuralları',              icon: 'people-outline',           color: '#F472B6', action: 'community' },
  { label: 'GDPR / KVKK İşlemleri',          icon: 'finger-print-outline',     color: '#9CA3AF', action: 'gdpr' },
];

export default function LegalSettingsScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const handleItem = (action) => {
    if (action === 'licenses') {
      navigation.navigate('Licenses');
    } else if (action === 'gdpr') {
      navigation.navigate('DataExport');
    } else {
      // Open webview or external link
      const urls = {
        terms:     'https://socialbeats.app/terms',
        privacy:   'https://socialbeats.app/privacy',
        cookies:   'https://socialbeats.app/cookies',
        community: 'https://socialbeats.app/community',
      };
      if (urls[action]) Linking.openURL(urls[action]).catch(() => {});
    }
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Kullanım Koşulları ve Gizlilik</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
          {LEGAL_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[s.row, i < LEGAL_ITEMS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
              onPress={() => handleItem(item.action)}
              activeOpacity={0.72}
            >
              <View style={[s.iconWrap, { backgroundColor: item.color + '22' }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={[s.rowLabel, { color: colors.text }]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textGhost} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[s.version, { color: colors.textGhost }]}>SocialBeats v3.3.0 · © 2025 SocialBeats Inc.</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  scroll: { padding: 16, gap: 16 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 16 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  version: { textAlign: 'center', fontSize: 12 },
});
