import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

export default function ForgotPasswordScreen({ navigation }) {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!email.trim()) { setError('E-posta gerekli'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch { setError('Bir hata oluştu'); }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.content}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        {sent ? (
          <View style={styles.sentWrap}>
            <View style={styles.sentIcon}><Ionicons name="mail" size={40} color={BRAND.primary} /></View>
            <Text style={[styles.title, { color: colors.text }]}>E-posta Gönderildi</Text>
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>Şifre sıfırlama bağlantısı e-posta adresine gönderildi.</Text>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Text style={{ color: '#FFF', fontWeight: '600' }}>Giriş Sayfasına Dön</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.iconWrap}><Ionicons name="lock-open" size={40} color={BRAND.primary} /></View>
            <Text style={[styles.title, { color: colors.text }]}>Şifreni Sıfırla</Text>
            <Text style={{ color: colors.textMuted, marginTop: 8, marginBottom: 30, lineHeight: 20 }}>Hesabınla ilişkili e-posta adresini gir, sana sıfırlama bağlantısı gönderelim.</Text>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>
              </View>
            ) : null}

            <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
              <TextInput style={[styles.input, { color: colors.text }]} placeholder="E-posta" placeholderTextColor={colors.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>

            <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={loading} activeOpacity={0.85}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Gönder</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 60 },
  back: { marginBottom: 30 },
  iconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(124,58,237,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  errorBox: { padding: 12, borderRadius: 12, marginBottom: 16 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 52, gap: 10, marginBottom: 16 },
  input: { flex: 1, fontSize: 15 },
  sendBtn: { backgroundColor: BRAND.primary, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: BRAND.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  sentWrap: { alignItems: 'center', paddingTop: 40 },
  sentIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(124,58,237,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  backBtn: { marginTop: 30, backgroundColor: BRAND.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
});
