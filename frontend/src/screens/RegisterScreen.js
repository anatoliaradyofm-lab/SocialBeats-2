import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

export default function RegisterScreen({ navigation }) {
  const { login } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) { setError(t('auth.allFieldsRequired')); return; }
    if (password !== confirmPassword) { setError(t('auth.passwordMismatch')); return; }
    if (password.length < 6) { setError(t('auth.passwordTooShort')); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/register', { username: username.trim(), email: email.trim(), password });
      if (res.token && res.user) await login(res.user, res.token);
      else setError(res.detail || t('auth.registerFailed'));
    } catch { setError(t('common.connectionError')); }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.text }]}>{t('auth.createAccount')}</Text>
        <Text style={{ color: colors.textMuted, marginBottom: 30, fontSize: 14 }}>{t('home.welcomeDesc')}</Text>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
            <Ionicons name="warning" size={16} color={colors.danger} />
            <Text style={{ color: colors.danger, marginLeft: 8, fontSize: 13 }}>{error}</Text>
          </View>
        ) : null}

        <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Ionicons name="person-outline" size={18} color={colors.textMuted} />
          <TextInput style={[styles.input, { color: colors.text }]} placeholder={t('auth.username')} placeholderTextColor={colors.textMuted} value={username} onChangeText={setUsername} autoCapitalize="none" />
        </View>

        <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
          <TextInput style={[styles.input, { color: colors.text }]} placeholder={t('auth.email')} placeholderTextColor={colors.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        </View>

        <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
          <TextInput style={[styles.input, { color: colors.text }]} placeholder={t('auth.password')} placeholderTextColor={colors.textMuted} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.textMuted} />
          <TextInput style={[styles.input, { color: colors.text }]} placeholder={t('auth.confirmPassword')} placeholderTextColor={colors.textMuted} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} />
        </View>

        <TouchableOpacity style={styles.registerBtn} onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.registerBtnText}>{t('auth.register')}</Text>}
        </TouchableOpacity>

        <View style={styles.loginRow}>
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('auth.haveAccount')} </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ color: BRAND.primary, fontWeight: '600', fontSize: 14 }}>{t('auth.login')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  back: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  errorBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 16 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 52, marginBottom: 12, gap: 10 },
  input: { flex: 1, fontSize: 15 },
  registerBtn: { backgroundColor: BRAND.primary, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 8, shadowColor: BRAND.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  registerBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
});
