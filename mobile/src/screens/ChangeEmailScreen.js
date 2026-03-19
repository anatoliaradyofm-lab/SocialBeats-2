/**
 * ChangeEmailScreen — E-posta Değiştir
 * Step 1: Yeni e-posta + şifre → POST /auth/change-email/request
 * Step 2: OTP kodu → POST /auth/change-email/confirm
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

export default function ChangeEmailScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { user, token, updateUser } = useAuth();

  const [step, setStep] = useState(1);          // 1 = enter email+pass, 2 = enter OTP
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const otpRef = useRef(null);

  const handleStep1 = async () => {
    const trimmedEmail = newEmail.trim().toLowerCase();
    if (!trimmedEmail) return Alert.alert('Hata', 'Yeni e-posta adresini girin');
    if (!password.trim()) return Alert.alert('Hata', 'Şifrenizi girin');
    const emailRe = /^[\w.-]+@[\w.-]+\.\w+$/;
    if (!emailRe.test(trimmedEmail)) return Alert.alert('Hata', 'Geçerli bir e-posta adresi girin');

    setLoading(true);
    try {
      await api.post('/auth/change-email/request', {
        new_email: trimmedEmail,
        password: password.trim(),
      }, token);
      setStep(2);
      setTimeout(() => otpRef.current?.focus(), 300);
    } catch (err) {
      const msg = err?.data?.detail || err?.message || 'İstek gönderilemedi';
      Alert.alert('Hata', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async () => {
    if (otp.trim().length !== 6) return Alert.alert('Hata', '6 haneli doğrulama kodunu girin');

    setLoading(true);
    try {
      const res = await api.post('/auth/change-email/confirm', {
        code: otp.trim(),
      }, token);
      updateUser?.({ ...user, email: res?.email || newEmail.trim().toLowerCase() });
      Alert.alert(
        'Başarılı',
        'E-posta adresiniz güncellendi.',
        [{ text: 'Tamam', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      const msg = err?.data?.detail || err?.message || 'Doğrulama başarısız';
      Alert.alert('Hata', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setLoading(true);
    try {
      await api.post('/auth/change-email/request', {
        new_email: newEmail.trim().toLowerCase(),
        password: password.trim(),
      }, token);
      Alert.alert('Gönderildi', 'Yeni doğrulama kodu gönderildi.');
    } catch (err) {
      Alert.alert('Hata', err?.data?.detail || 'Yeniden gönderim başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => step === 2 ? setStep(1) : navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>E-posta Değiştir</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step indicator */}
      <View style={styles.stepRow}>
        {[1, 2].map((s) => (
          <View key={s} style={styles.stepItem}>
            <View style={[
              styles.stepDot,
              { backgroundColor: step >= s ? colors.primary : colors.surface, borderColor: step >= s ? colors.primary : colors.border }
            ]}>
              {step > s
                ? <Ionicons name="checkmark" size={12} color="#fff" />
                : <Text style={[styles.stepNum, { color: step >= s ? '#fff' : colors.textMuted }]}>{s}</Text>
              }
            </View>
            <Text style={[styles.stepLabel, { color: step >= s ? colors.primary : colors.textMuted }]}>
              {s === 1 ? 'E-posta Gir' : 'Kodu Doğrula'}
            </Text>
          </View>
        ))}
        <View style={[styles.stepLine, { backgroundColor: step > 1 ? colors.primary : colors.border }]} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
      >
        {step === 1 ? (
          <>
            <Text style={[styles.currentEmail, { color: colors.textMuted }]}>
              Mevcut: {user?.email || ''}
            </Text>

            <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Yeni e-posta adresi"
                placeholderTextColor={colors.textGhost}
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Mevcut şifreniz (doğrulama için)"
                placeholderTextColor={colors.textGhost}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={[styles.infoBox, { backgroundColor: colors.primaryGlow, borderColor: colors.primary + '30' }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
              <Text style={[styles.infoBoxText, { color: colors.textSecondary }]}>
                Yeni e-posta adresinize bir doğrulama kodu gönderilecek.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary }, loading && { opacity: 0.6 }]}
              onPress={handleStep1}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Devam Et</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={[styles.otpInfo, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
              <Ionicons name="mail-open-outline" size={28} color={colors.primary} />
              <Text style={[styles.otpInfoTitle, { color: colors.text }]}>
                Kodu girin
              </Text>
              <Text style={[styles.otpInfoSub, { color: colors.textMuted }]}>
                6 haneli doğrulama kodu {newEmail.trim().toLowerCase()} adresine gönderildi.
              </Text>
            </View>

            <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Ionicons name="keypad-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                ref={otpRef}
                style={[styles.input, styles.otpInput, { color: colors.text }]}
                placeholder="000000"
                placeholderTextColor={colors.textGhost}
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary }, loading && { opacity: 0.6 }]}
              onPress={handleStep2}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>E-postayı Güncelle</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.resendBtn} onPress={resendOtp} disabled={loading}>
              <Text style={[styles.resendText, { color: colors.primary }]}>Kodu yeniden gönder</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 20,
    position: 'relative',
  },
  stepLine: {
    position: 'absolute',
    top: '50%',
    left: '30%',
    right: '30%',
    height: 2,
    zIndex: 0,
  },
  stepItem: { alignItems: 'center', flex: 1, zIndex: 1 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepNum: { fontSize: 12, fontWeight: '700' },
  stepLabel: { fontSize: 11, fontWeight: '600' },
  scroll: { padding: 20 },
  currentEmail: { fontSize: 14, marginBottom: 16 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16 },
  otpInput: { fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  eyeBtn: { padding: 4 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  infoBoxText: { flex: 1, fontSize: 13, lineHeight: 18 },
  btn: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  otpInfo: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 24,
    gap: 8,
  },
  otpInfoTitle: { fontSize: 18, fontWeight: '700' },
  otpInfoSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  resendBtn: { alignItems: 'center', padding: 12 },
  resendText: { fontSize: 14, fontWeight: '600' },
});
