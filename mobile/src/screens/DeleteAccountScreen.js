import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * 3-step account deletion flow:
 * Step 1 — Request: send email verification code
 * Step 2 — Enter code from email
 * Step 3 — Final confirmation: enter password + type "HESABIMI SİL"
 */
export default function DeleteAccountScreen({ navigation }) {
  const { colors } = useTheme();
  const s = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { token, logout } = useAuth();

  const [step, setStep]         = useState(1);
  const [code, setCode]         = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);

  // Step 1: request WhatsApp OTP
  const requestCode = async () => {
    setLoading(true);
    try {
      await api.post('/account/delete/request', {}, token);
      setStep(2);
    } catch (err) {
      const msg = err?.data?.detail || err?.message || 'İstek gönderilemedi';
      Alert.alert('Hata', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  // Step 2: verify code
  const verifyCode = async () => {
    if (!code.trim()) { Alert.alert('Hata', 'Kodu girin'); return; }
    setLoading(true);
    try {
      await api.post(`/account/delete/verify-code?code=${encodeURIComponent(code.trim())}`, {}, token);
      setStep(3);
    } catch (err) {
      const msg = err?.data?.detail || err?.message || 'Kod doğrulanamadı';
      Alert.alert('Hata', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  // Step 3: final delete
  const handleDelete = () => {
    if (!password.trim()) { Alert.alert('Hata', 'Şifrenizi girin'); return; }
    if (confirm !== 'HESABIMI SİL') { Alert.alert('Hata', '"HESABIMI SİL" yazmanız gerekiyor'); return; }
    Alert.alert(
      'Son Onay',
      'Bu işlem geri alınamaz. Tüm verileriniz kalıcı olarak silinecek.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Evet, Sil', style: 'destructive', onPress: doDelete },
      ]
    );
  };

  const doDelete = async () => {
    setLoading(true);
    try {
      await api.request(`/account/delete?password=${encodeURIComponent(password)}&code=${encodeURIComponent(code.trim())}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      await logout();
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (err) {
      const msg = err?.data?.detail || err?.message || 'İşlem başarısız';
      Alert.alert('Hata', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Hesabı Kalıcı Sil</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Step indicator */}
        <View style={s.stepRow}>
          {[1, 2, 3].map(n => (
            <View key={n} style={s.stepWrap}>
              <View style={[s.stepDot, { backgroundColor: step >= n ? '#F87171' : colors.surfaceHigh }]}>
                <Text style={[s.stepNum, { color: step >= n ? '#fff' : colors.textMuted }]}>{n}</Text>
              </View>
              {n < 3 && <View style={[s.stepLine, { backgroundColor: step > n ? '#F87171' : colors.surfaceHigh }]} />}
            </View>
          ))}
        </View>

        {/* Warning banner */}
        <View style={[s.warningBanner, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }]}>
          <Ionicons name="warning-outline" size={20} color="#F87171" />
          <Text style={[s.warningText, { color: '#F87171' }]}>
            Bu işlem geri alınamaz. Tüm verileriniz (gönderiler, takipçiler, mesajlar, çalma listeleri) kalıcı olarak silinecektir.
          </Text>
        </View>

        {step === 1 && (
          <>
            <Text style={[s.stepTitle, { color: colors.text }]}>WhatsApp Doğrulaması</Text>
            <Text style={[s.stepDesc, { color: colors.textMuted }]}>
              Hesap silme işlemini başlatmak için telefon numaranıza WhatsApp üzerinden bir doğrulama kodu gönderilecektir.
            </Text>
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: '#DC2626', opacity: loading ? 0.7 : 1 }]}
              onPress={requestCode}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                  <Text style={s.actionBtnText}>Doğrulama Kodu Gönder</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={[s.stepTitle, { color: colors.text }]}>Kodu Girin</Text>
            <Text style={[s.stepDesc, { color: colors.textMuted }]}>WhatsApp'a gönderilen 6 haneli kodu girin.</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Doğrulama Kodu"
              placeholderTextColor={colors.textMuted}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={10}
            />
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: '#DC2626', opacity: loading ? 0.7 : 1 }]}
              onPress={verifyCode}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <Text style={s.actionBtnText}>Kodu Doğrula</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.resendLink} onPress={requestCode}>
              <Text style={[s.resendText, { color: colors.textMuted }]}>WhatsApp kodu tekrar gönder</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={[s.stepTitle, { color: colors.text }]}>Son Onay</Text>
            <Text style={[s.stepDesc, { color: colors.textMuted }]}>
              Hesabınızı silmek için şifrenizi girin ve onay alanına "HESABIMI SİL" yazın.
            </Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Şifreniz"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <Text style={[s.confirmHint, { color: colors.textMuted }]}>Onaylamak için "HESABIMI SİL" yazın</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="HESABIMI SİL"
              placeholderTextColor={colors.textMuted}
              value={confirm}
              onChangeText={setConfirm}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: '#DC2626', opacity: loading ? 0.7 : 1 }]}
              onPress={handleDelete}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="trash-outline" size={20} color="#fff" />
                  <Text style={s.actionBtnText}>Hesabı Kalıcı Olarak Sil</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 20 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  stepWrap: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: 14, fontWeight: '700' },
  stepLine: { width: 48, height: 2, marginHorizontal: 4 },
  warningBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 24,
  },
  warningText: { flex: 1, fontSize: 13, lineHeight: 19 },
  stepTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  stepDesc: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  input: {
    borderRadius: 14, borderWidth: 1, padding: 16,
    fontSize: 16, marginBottom: 16,
  },
  confirmHint: { fontSize: 13, marginBottom: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, padding: 16, borderRadius: 16, marginTop: 8,
  },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendLink: { alignItems: 'center', padding: 12 },
  resendText: { fontSize: 13, textDecorationLine: 'underline' },
});
