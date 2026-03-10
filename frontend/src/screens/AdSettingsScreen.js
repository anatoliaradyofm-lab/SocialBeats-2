import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

const AD_CATEGORIES = [
  { id: 'music', label: 'Müzik & Konserler', icon: 'musical-notes' },
  { id: 'tech', label: 'Teknoloji', icon: 'hardware-chip' },
  { id: 'fashion', label: 'Moda & Giyim', icon: 'shirt' },
  { id: 'food', label: 'Yiyecek & İçecek', icon: 'fast-food' },
  { id: 'sports', label: 'Spor & Fitness', icon: 'fitness' },
  { id: 'gaming', label: 'Oyun', icon: 'game-controller' },
  { id: 'travel', label: 'Seyahat', icon: 'airplane' },
  { id: 'education', label: 'Eğitim', icon: 'school' },
];

export default function AdSettingsScreen({ navigation }) {
  const { token, user } = useAuth();
  const { colors } = useTheme();
  const [personalizedAds, setPersonalizedAds] = useState(true);
  const [adPreferences, setAdPreferences] = useState({});
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    api.get('/ads/settings', token).then(r => {
      const p = r.preferences || r || {};
      setPersonalizedAds(p.personalized !== false);
      setAdPreferences(p.categories || {});
      setIsPremium(p.is_premium || user?.is_premium || false);
    }).catch(() => {});
  }, [token]);

  const toggleCategory = (id) => {
    const updated = { ...adPreferences, [id]: !adPreferences[id] };
    setAdPreferences(updated);
    api.put('/ads/settings', { categories: updated }, token).catch(() => {});
  };

  const goPremium = () => {
    Alert.alert('Premium', 'Premium üyelik ile reklamsız deneyim yaşayın!\n\nYakında kullanıma sunulacak.');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Reklam Tercihleri</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {!isPremium && (
          <TouchableOpacity style={styles.premiumCard} onPress={goPremium}>
            <View style={styles.premiumIcon}>
              <Ionicons name="diamond" size={28} color="#FFF" />
            </View>
            <Text style={styles.premiumTitle}>Premium'a Geç</Text>
            <Text style={styles.premiumDesc}>Reklamsız, yüksek kaliteli müzik deneyimi</Text>
            <View style={styles.premiumBtn}>
              <Text style={{ color: BRAND.primary, fontWeight: '700' }}>Planları Gör</Text>
            </View>
          </TouchableOpacity>
        )}

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>REKLAM AYARLARI</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 14 }}>Kişiselleştirilmiş Reklamlar</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>İlgi alanlarına göre reklam göster</Text>
            </View>
            <Switch value={personalizedAds} onValueChange={(v) => { setPersonalizedAds(v); api.put('/ads/settings', { personalized: v }, token).catch(() => {}); }} trackColor={{ true: BRAND.primary, false: colors.border }} thumbColor="#FFF" />
          </View>
        </View>

        {personalizedAds && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>İLGİ ALANLARI</Text>
            <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
              {AD_CATEGORIES.map((cat, i) => (
                <View key={cat.id} style={[styles.switchRow, i > 0 && { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
                  <Ionicons name={cat.icon} size={20} color={adPreferences[cat.id] ? BRAND.primary : colors.textMuted} style={{ marginRight: 12 }} />
                  <Text style={{ color: colors.text, flex: 1, fontSize: 14 }}>{cat.label}</Text>
                  <Switch value={adPreferences[cat.id] !== false} onValueChange={() => toggleCategory(cat.id)} trackColor={{ true: BRAND.primary, false: colors.border }} thumbColor="#FFF" />
                </View>
              ))}
            </View>
          </>
        )}

        <View style={[styles.infoCard, { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons name="information-circle" size={18} color={BRAND.accent} />
          <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1, marginLeft: 8, lineHeight: 16 }}>
            Reklam tercihlerini değiştirmek göreceğin reklam sayısını değiştirmez, yalnızca içeriklerini etkiler.
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
  premiumCard: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16, backgroundColor: BRAND.primary, overflow: 'hidden' },
  premiumIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  premiumTitle: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  premiumDesc: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  premiumBtn: { marginTop: 16, backgroundColor: '#FFF', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginTop: 8, marginBottom: 8 },
  card: { borderRadius: 16, padding: 14, marginBottom: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 14, marginTop: 4 },
});
