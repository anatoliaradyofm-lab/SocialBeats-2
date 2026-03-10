import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

export default function LoginScreen({ navigation }) {
  const { login, enterAsGuest } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setError(t('auth.allFieldsRequired')); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/login', { email: email.trim(), password });
      if (res.requires_2fa) {
        navigation.navigate('TwoFactorVerify', { tempToken: res.temp_token, email: email.trim() });
      } else if (res.token && res.user) {
        await login(res.user, res.token);
      } else {
        setError(res.detail || t('auth.loginFailed'));
      }
    } catch (e) { setError(t('common.connectionError')); }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    Alert.alert(
      t('auth.googleLoginTitle'),
      t('auth.googleLoginDesc'),
      [
        { text: t('common.cancel') },
        { text: t('common.confirm'), onPress: async () => {
          setLoading(true); setError('');
          try {
            const authUrl = await api.get('/auth/google/login');
            if (authUrl?.url) {
              Linking.openURL(authUrl.url);
            } else {
              const res = await api.post('/auth/google/mobile', {
                email: email.trim() || undefined,
                provider: 'google',
              });
              if (res.token && res.user) await login(res.user, res.token);
              else setError(res.detail || t('auth.loginFailed'));
            }
          } catch { setError(t('auth.loginFailed')); }
          setLoading(false);
        }},
      ]
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoGlow}>
            <Ionicons name="headset" size={48} color={BRAND.primary} />
          </View>
          <Text style={styles.logoText}>
            <Text style={{ color: BRAND.primary, fontWeight: '800' }}>Social</Text>
            <Text style={{ color: BRAND.accent, fontWeight: '300' }}>Beats</Text>
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 8, fontSize: 14 }}>{t('auth.welcomeTitle')}</Text>
        </View>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
            <Ionicons name="warning" size={16} color={colors.danger} />
            <Text style={{ color: colors.danger, marginLeft: 8, fontSize: 13 }}>{error}</Text>
          </View>
        ) : null}

        <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={t('auth.email')}
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={t('auth.password')}
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={[styles.forgotText, { color: BRAND.primaryLight }]}>{t('auth.forgotPassword')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.loginBtnText}>{t('auth.login')}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.guestBtn, { borderColor: colors.border }]} onPress={() => enterAsGuest?.()}>
          <Ionicons name="eye-outline" size={18} color={colors.textSecondary} />
          <Text style={[styles.guestText, { color: colors.textSecondary }]}>{t('auth.guestLogin')}</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={[styles.divLine, { backgroundColor: colors.border }]} />
          <Text style={{ color: colors.textMuted, fontSize: 12, paddingHorizontal: 12 }}>{t('auth.or')}</Text>
          <View style={[styles.divLine, { backgroundColor: colors.border }]} />
        </View>

        <TouchableOpacity style={[styles.socialBtn, { backgroundColor: colors.surfaceElevated }]} onPress={handleGoogleLogin}>
          <Ionicons name="logo-google" size={18} color={colors.text} />
          <Text style={[styles.socialText, { color: colors.text }]}>{t('auth.googleLogin')}</Text>
        </TouchableOpacity>

        <View style={styles.registerRow}>
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('auth.noAccount')} </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={{ color: BRAND.primary, fontWeight: '600', fontSize: 14 }}>{t('auth.register')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 40 },

  logoWrap: { alignItems: 'center', marginBottom: 40 },
  logoGlow: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(124,58,237,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  logoText: { fontSize: 30 },

  errorBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 16 },

  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 52, marginBottom: 12, gap: 10 },
  input: { flex: 1, fontSize: 15 },

  forgotText: { textAlign: 'right', fontSize: 13, marginBottom: 20, fontWeight: '500' },

  loginBtn: { backgroundColor: BRAND.primary, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: BRAND.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  loginBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  guestBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 48, borderRadius: 14, borderWidth: 1, marginTop: 12, gap: 8 },
  guestText: { fontSize: 14, fontWeight: '500' },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
  divLine: { flex: 1, height: 0.5 },

  socialBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 48, borderRadius: 14, gap: 10 },
  socialText: { fontSize: 14, fontWeight: '500' },

  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
});
