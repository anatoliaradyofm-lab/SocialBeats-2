import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, BRAND } from '../contexts/ThemeContext';

const FAQ = [
  { q: 'Müzik kalitesini nasıl değiştiririm?', a: 'Ayarlar > Müzik Kalitesi bölümünden değiştirebilirsiniz. Düşük, Normal, Yüksek ve Otomatik seçenekleri mevcuttur.' },
  { q: 'Hesabımı nasıl silerim?', a: 'Ayarlar > Veri Yönetimi sayfasından hesabınızı kalıcı olarak silebilirsiniz.' },
  { q: 'Şifremi unuttum, ne yapmalıyım?', a: 'Giriş ekranında "Şifremi Unuttum" seçeneğine tıklayarak e-posta adresinize sıfırlama bağlantısı gönderebilirsiniz.' },
  { q: 'Nasıl Premium olurum?', a: 'Profil > Ayarlar > Reklam Tercihleri bölümünden Premium planlarını inceleyebilirsiniz.' },
  { q: 'Ekolayzır nasıl kullanılır?', a: 'Tam ekran oynatıcıda veya Ayarlar > Ekolayzır menüsünden frekans bantlarını ayarlayabilirsiniz.' },
  { q: 'Çevrimdışı dinleme mümkün mü?', a: 'Premium üyelik ile şarkıları indirebilir ve çevrimdışı dinleyebilirsiniz.' },
  { q: 'Birden fazla hesap kullanabilir miyim?', a: 'Ayarlar > Çıkış Yap yaparak farklı hesabınızla giriş yapabilirsiniz.' },
  { q: 'Uyku zamanlayıcı nasıl ayarlanır?', a: 'Tam ekran oynatıcıda saat ikonuna dokunarak uyku zamanlayıcısı kurabilirsiniz.' },
];

export default function HelpScreen({ navigation }) {
  const { colors } = useTheme();
  const [expandedIdx, setExpandedIdx] = useState(null);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Yardım</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={[styles.contactCard, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.contactTitle, { color: colors.text }]}>Destek Ekibi</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 14 }}>
            Sorularınız için bize ulaşabilirsiniz.
          </Text>
          <View style={styles.contactBtns}>
            <TouchableOpacity style={[styles.contactBtn, { backgroundColor: `${BRAND.primary}18` }]} onPress={() => Linking.openURL('mailto:support@socialbeats.app').catch(() => {})}>
              <Ionicons name="mail" size={20} color={BRAND.primary} />
              <Text style={{ color: BRAND.primary, fontSize: 12, fontWeight: '500' }}>E-posta</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.contactBtn, { backgroundColor: `${BRAND.accent}18` }]} onPress={() => {}}>
              <Ionicons name="chatbubbles" size={20} color={BRAND.accent} />
              <Text style={{ color: BRAND.accent, fontSize: 12, fontWeight: '500' }}>Canlı Destek</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>SIK SORULAN SORULAR</Text>
        {FAQ.map((item, i) => (
          <TouchableOpacity key={i} style={[styles.faqCard, { backgroundColor: colors.surfaceElevated }]} onPress={() => setExpandedIdx(expandedIdx === i ? null : i)}>
            <View style={styles.faqHeader}>
              <Text style={[styles.faqQ, { color: colors.text }]}>{item.q}</Text>
              <Ionicons name={expandedIdx === i ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            </View>
            {expandedIdx === i && <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 8 }}>{item.a}</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  contactCard: { borderRadius: 16, padding: 20, marginBottom: 16 },
  contactTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  contactBtns: { flexDirection: 'row', gap: 12 },
  contactBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', gap: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },
  faqCard: { borderRadius: 14, padding: 14, marginBottom: 8 },
  faqHeader: { flexDirection: 'row', alignItems: 'center' },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '500' },
});
