import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, BRAND } from '../contexts/ThemeContext';

export default function AboutScreen({ navigation }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Hakkında</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 24, paddingBottom: 40 }}>
        <View style={styles.logoWrap}>
          <Ionicons name="musical-notes" size={40} color="#FFF" />
        </View>
        <Text style={[styles.appName, { color: colors.text }]}>SocialBeats</Text>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>Versiyon 1.0.0</Text>

        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: 'center' }}>
            SocialBeats, müzik dinleme ve sosyal paylaşımı bir araya getiren modern bir platformdur.
            YouTube ve Spotify entegrasyonu ile milyonlarca şarkıya erişin, arkadaşlarınızla paylaşın.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          {[
            { icon: 'document-text-outline', label: 'Kullanım Koşulları', url: 'https://socialbeats.app/terms' },
            { icon: 'shield-outline', label: 'Gizlilik Politikası', url: 'https://socialbeats.app/privacy' },
            { icon: 'code-slash-outline', label: 'Açık Kaynak Lisansları', url: '' },
            { icon: 'mail-outline', label: 'İletişim', url: 'mailto:support@socialbeats.app' },
            { icon: 'star-outline', label: 'Uygulamayı Değerlendir', url: '' },
          ].map((item, i) => (
            <TouchableOpacity key={i} style={[styles.row, i < 4 && { borderBottomWidth: 0.5, borderBottomColor: colors.border }]} onPress={() => { if (item.url) Linking.openURL(item.url).catch(() => {}); }}>
              <Ionicons name={item.icon} size={18} color={BRAND.primary} />
              <Text style={{ color: colors.text, flex: 1, fontSize: 14 }}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 20 }}>© 2026 SocialBeats. Tüm hakları saklıdır.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  logoWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: BRAND.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: BRAND.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  appName: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  card: { width: '100%', borderRadius: 16, padding: 16, marginTop: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
});
