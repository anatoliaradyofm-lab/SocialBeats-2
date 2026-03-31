/**
 * FreezeAccountScreen — Hesabı dondurma
 * Reason picker + confirmation + POST /account/freeze
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

const REASONS = [
  { key: 'personal_break',    label: 'Kişisel mola ihtiyacı',    icon: 'cafe-outline' },
  { key: 'privacy_concern',   label: 'Gizlilik endişesi',         icon: 'shield-outline' },
  { key: 'switching_platform',label: 'Başka bir platform',        icon: 'phone-portrait-outline' },
  { key: 'too_much_time',     label: 'Çok fazla zaman harcıyorum',icon: 'time-outline' },
  { key: 'other',             label: 'Diğer',                     icon: 'ellipsis-horizontal-outline' },
];

export default function FreezeAccountScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { token, logout } = useAuth();
  const [selectedReason, setSelectedReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFreeze = () => {
    if (!selectedReason) {
      Alert.alert('Sebep Seçin', 'Lütfen hesabı neden dondurmak istediğinizi seçin.');
      return;
    }
    Alert.alert(
      'Hesabı Dondur',
      'Hesabınız dondurulacak:\n\n• Profiliniz gizlenecek\n• Bildirimler durduralacak\n• Verileriniz korunacak\n\nTekrar giriş yaparak hesabınızı aktifleştirebilirsiniz.',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Dondur', style: 'destructive', onPress: doFreeze },
      ]
    );
  };

  const doFreeze = async () => {
    setLoading(true);
    try {
      const reasonLabel = REASONS.find(r => r.key === selectedReason)?.label || selectedReason;
      await api.post('/account/freeze', { reason: reasonLabel }, token);
      Alert.alert(
        'Hesap Donduruldu',
        'Hesabınız donduruldu. Tekrar giriş yaparak etkinleştirebilirsiniz.',
        [{ text: 'Tamam', onPress: () => {
          logout?.();
        }}]
      );
    } catch (err) {
      const msg = err?.data?.detail || err?.message || 'Hesap dondurma başarısız.';
      Alert.alert('Hata', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hesabı Dondur</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Info Banner */}
        <View style={[styles.infoBanner, { backgroundColor: colors.warningBg, borderColor: colors.warning + '40' }]}>
          <Ionicons name="snow-outline" size={22} color={colors.warning} />
          <Text style={[styles.infoText, { color: colors.warning }]}>
            Hesabınız 30 gün boyunca dondurulacak. Bu süre zarfında profiliniz ve içerikleriniz gizlenir, verileriniz silinmez.
          </Text>
        </View>

        {/* Reason Picker */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>NEDEN DONDURMAK İSTİYORSUNUZ?</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
          {REASONS.map((reason, index) => (
            <TouchableOpacity
              key={reason.key}
              style={[
                styles.reasonRow,
                index < REASONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                selectedReason === reason.key && { backgroundColor: colors.primaryGlow },
              ]}
              onPress={() => setSelectedReason(reason.key)}
              activeOpacity={0.75}
            >
              <Ionicons name={reason.icon} size={20} color={selectedReason === reason.key ? colors.primary : colors.textMuted} style={{ marginRight: 12 }} />
              <Text style={[styles.reasonLabel, { color: selectedReason === reason.key ? colors.primary : colors.text }]}>
                {reason.label}
              </Text>
              {selectedReason === reason.key && (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* What happens info */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>NE OLACAK?</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
          {[
            { icon: 'eye-off-outline',    text: 'Profiliniz diğer kullanıcılara görünmez olacak' },
            { icon: 'notifications-off-outline', text: 'Bildirimler ve WhatsApp bildirimleri duracak' },
            { icon: 'shield-checkmark-outline',  text: 'Tüm verileriniz güvende kalacak' },
            { icon: 'refresh-outline',    text: 'Tekrar giriş yaparak hesabınızı aktifleştirebilirsiniz' },
          ].map((item, i) => (
            <View
              key={i}
              style={[
                styles.infoRow,
                i < 3 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
              ]}
            >
              <Ionicons name={item.icon} size={18} color={colors.iconGreen} style={{ marginRight: 12 }} />
              <Text style={[styles.infoRowText, { color: colors.textSecondary }]}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* Freeze Button */}
        <TouchableOpacity
          style={[
            styles.freezeBtn,
            { backgroundColor: colors.errorBg, borderColor: colors.error + '50' },
            (!selectedReason || loading) && { opacity: 0.5 },
          ]}
          onPress={handleFreeze}
          disabled={!selectedReason || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.error} />
          ) : (
            <>
              <Ionicons name="snow-outline" size={20} color={colors.error} />
              <Text style={[styles.freezeBtnText, { color: colors.error }]}>Hesabımı Dondur</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelLink}
          onPress={() => navigation.navigate('DeleteAccount')}
        >
          <Text style={[styles.cancelLinkText, { color: colors.textMuted }]}>
            Bunun yerine hesabı kalıcı olarak silmek ister misiniz?
          </Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  scroll: { padding: 16 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 4,
  },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  reasonLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  infoRowText: { flex: 1, fontSize: 14, lineHeight: 20 },
  freezeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  freezeBtnText: { fontSize: 16, fontWeight: '700' },
  cancelLink: { alignItems: 'center', padding: 8 },
  cancelLinkText: { fontSize: 13, textDecorationLine: 'underline' },
});
