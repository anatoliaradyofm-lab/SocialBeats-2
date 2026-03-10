import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

const REASONS = [
  { id: 'spam', label: 'Spam', icon: 'warning' },
  { id: 'harassment', label: 'Taciz veya zorbalık', icon: 'hand-left' },
  { id: 'hate_speech', label: 'Nefret söylemi', icon: 'megaphone' },
  { id: 'violence', label: 'Şiddet veya tehdit', icon: 'skull' },
  { id: 'nudity', label: 'Uygunsuz içerik', icon: 'eye-off' },
  { id: 'false_info', label: 'Yanlış bilgi', icon: 'alert-circle' },
  { id: 'impersonation', label: 'Kimlik taklidi', icon: 'people' },
  { id: 'intellectual_property', label: 'Fikri mülkiyet ihlali', icon: 'document-text' },
  { id: 'other', label: 'Diğer', icon: 'ellipsis-horizontal' },
];

export default function ReportScreen({ route, navigation }) {
  const { targetId, targetType = 'user' } = route.params || {};
  const { token } = useAuth();
  const { colors } = useTheme();
  const [selectedReason, setSelectedReason] = useState(null);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setLoading(true);
    try {
      await api.post('/social/report', { target_id: targetId, target_type: targetType, reason: selectedReason, details: details.trim() }, token);
      setSubmitted(true);
    } catch {}
    setLoading(false);
  };

  if (submitted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={56} color="#10B981" />
        </View>
        <Text style={[styles.successTitle, { color: colors.text }]}>Rapor Gönderildi</Text>
        <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 }}>Raporunuz incelenecek. Teşekkür ederiz.</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
          <Text style={{ color: '#FFF', fontWeight: '600' }}>Tamam</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Rapor Et</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 20, lineHeight: 20 }}>
          Neden rapor ediyorsunuz? Seçiminiz gizli tutulacaktır.
        </Text>

        {REASONS.map(r => (
          <TouchableOpacity
            key={r.id}
            style={[styles.reasonRow, { backgroundColor: selectedReason === r.id ? 'rgba(124,58,237,0.08)' : colors.surfaceElevated, borderColor: selectedReason === r.id ? BRAND.primary : 'transparent' }]}
            onPress={() => setSelectedReason(r.id)}
          >
            <Ionicons name={r.icon} size={20} color={selectedReason === r.id ? BRAND.primary : colors.textSecondary} />
            <Text style={{ color: selectedReason === r.id ? BRAND.primary : colors.text, flex: 1, fontSize: 14 }}>{r.label}</Text>
            {selectedReason === r.id && <Ionicons name="checkmark-circle" size={20} color={BRAND.primary} />}
          </TouchableOpacity>
        ))}

        {selectedReason && (
          <>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 20, marginBottom: 8 }}>Detay ekleyin (opsiyonel)</Text>
            <TextInput
              style={[styles.detailInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="Daha fazla bilgi..."
              placeholderTextColor={colors.textMuted}
              value={details}
              onChangeText={setDetails}
              multiline
              textAlignVertical="top"
            />
          </>
        )}

        <TouchableOpacity style={[styles.submitBtn, { opacity: selectedReason ? 1 : 0.4 }]} onPress={handleSubmit} disabled={!selectedReason || loading}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Raporu Gönder</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  reasonRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginBottom: 6, gap: 12, borderWidth: 1.5 },
  detailInput: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 14, minHeight: 80 },
  submitBtn: { backgroundColor: BRAND.primary, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 24 },
  successIcon: { marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: '700' },
  doneBtn: { marginTop: 24, backgroundColor: BRAND.primary, paddingHorizontal: 40, paddingVertical: 14, borderRadius: 14 },
});
