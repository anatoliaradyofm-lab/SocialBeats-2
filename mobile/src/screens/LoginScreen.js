/**
 * LoginScreen — NOVA Design System v3.0
 * Immersive 2025 auth experience
 * Inspired by: UI8 premium kits · Dribbble auth trends · Behance case studies
 * Aurora mesh background · Glassmorphism card · Electric gradient CTA
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView,
  Platform, ScrollView, Alert, ActivityIndicator, Dimensions, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

const { width: W, height: H } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { login, loginAsGuest } = useAuth();

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [focused, setFocused]     = useState(null);
  const [errors, setErrors]       = useState({});

  const passRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, []);

  const validate = () => {
    const e = {};
    if (!email.trim()) e.email = t('Email required');
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = t('Invalid email');
    if (!password) e.password = t('Password required');
    else if (password.length < 8) e.password = t('Min 8 characters');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = useCallback(async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigation.navigate('Main');
    } catch (err) {
      const msg = err?.data?.detail;
      const detail = Array.isArray(msg) ? msg.map(m => m.msg || m).join(', ') : (msg || err?.message || t('Check your credentials'));
      Alert.alert(t('Login failed'), detail);
    } finally {
      setLoading(false);
    }
  }, [email, password]);


  const s = createStyles(colors, insets);

  return (
    <View style={s.root}>
      {/* ── Auth Background — adapts per theme ── */}
      <LinearGradient
        colors={colors.authBgGrad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Glow orbs */}
      <View style={[s.orb, s.orb1, { backgroundColor: colors.orbColor1 }]} />
      <View style={[s.orb, s.orb2, { backgroundColor: colors.orbColor2 }]} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[s.inner, { opacity: fadeAnim }]}>

            {/* ── Logo ── */}
            <View style={s.logoWrap}>
              <LinearGradient
                colors={colors.gradPrimary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.logoIcon}
              >
                <Ionicons name="musical-notes" size={32} color="#FFF" />
              </LinearGradient>
              <Text style={s.logoText}>SocialBeats</Text>
              <Text style={s.logoSub}>Your music universe</Text>
            </View>

            {/* ── Glass Card ── */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Welcome back</Text>
              <Text style={s.cardSub}>Sign in to continue</Text>

              {/* Email */}
              <View style={s.fieldWrap}>
                <Text style={s.label}>Email</Text>
                <View style={[s.inputRow, focused === 'email' && s.inputFocused, errors.email && s.inputError]}>
                  <Ionicons name="mail-outline" size={18} color={focused === 'email' ? colors.primary : colors.textMuted} style={s.inputIcon} />
                  <TextInput
                    style={s.input}
                    value={email}
                    onChangeText={v => { setEmail(v); setErrors(e => ({ ...e, email: null })); }}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.textGhost}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="next"
                    onSubmitEditing={() => passRef.current?.focus()}
                    onFocus={() => setFocused('email')}
                    onBlur={() => setFocused(null)}
                  />
                </View>
                {errors.email && <Text style={s.errorText}>{errors.email}</Text>}
              </View>

              {/* Password */}
              <View style={s.fieldWrap}>
                <Text style={s.label}>Password</Text>
                <View style={[s.inputRow, focused === 'pass' && s.inputFocused, errors.password && s.inputError]}>
                  <Ionicons name="lock-closed-outline" size={18} color={focused === 'pass' ? colors.primary : colors.textMuted} style={s.inputIcon} />
                  <TextInput
                    ref={passRef}
                    style={s.input}
                    value={password}
                    onChangeText={v => { setPassword(v); setErrors(e => ({ ...e, password: null })); }}
                    placeholder="Min. 8 characters"
                    placeholderTextColor={colors.textGhost}
                    secureTextEntry={!showPass}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                    onFocus={() => setFocused('pass')}
                    onBlur={() => setFocused(null)}
                  />
                  <TouchableOpacity onPress={() => setShowPass(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                {errors.password && <Text style={s.errorText}>{errors.password}</Text>}
              </View>

              {/* Forgot */}
              <TouchableOpacity style={s.forgotRow} onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={s.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              {/* Sign In Button */}
              <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.85} style={s.btnWrap}>
                <LinearGradient
                  colors={colors.gradPrimary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.btn}
                >
                  {loading
                    ? <ActivityIndicator color="#FFF" />
                    : <Text style={s.btnText}>Sign In</Text>
                  }
                </LinearGradient>
              </TouchableOpacity>

              {/* Guest */}
              <TouchableOpacity style={s.guestBtn} onPress={() => loginAsGuest?.()} activeOpacity={0.75}>
                <Text style={s.guestText}>Browse as guest</Text>
              </TouchableOpacity>
            </View>

            {/* ── Register Link ── */}
            <View style={s.footer}>
              <Text style={s.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={s.footerLink}>Create one</Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(colors, insets) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    orb: {
      position: 'absolute',
      borderRadius: 999,
      opacity: 0.35,
    },
    orb1: {
      width: 280,
      height: 280,
      top: -60,
      right: -60,
    },
    orb2: {
      width: 200,
      height: 200,
      bottom: 100,
      left: -80,
    },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingTop: insets.top + 24,
      paddingBottom: insets.bottom + 32,
    },
    inner: { gap: 24 },

    // Logo
    logoWrap: { alignItems: 'center', gap: 10 },
    logoIcon: {
      width: 72,
      height: 72,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 12,
    },
    logoText: {
      fontSize: 32,
      fontWeight: '900',
      color: colors.text,
      letterSpacing: -1.2,
    },
    logoSub: {
      fontSize: 14,
      color: colors.textMuted,
      letterSpacing: 0.3,
    },

    // Card
    card: {
      backgroundColor: colors.glass,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: 24,
      gap: 4,
    },
    cardTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.8,
    },
    cardSub: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 16,
    },

    // Fields
    fieldWrap: { gap: 6, marginBottom: 4 },
    label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.4, textTransform: 'uppercase' },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 14 : 10,
      gap: 10,
    },
    inputFocused: {
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    inputError: { borderColor: colors.error },
    inputIcon: { width: 20 },
    input: { flex: 1, fontSize: 15, color: colors.text, fontWeight: '400' },
    errorText: { fontSize: 12, color: colors.error, marginTop: 2 },

    forgotRow: { alignSelf: 'flex-end', marginTop: 2, marginBottom: 4 },
    forgotText: { fontSize: 13, color: colors.primary, fontWeight: '600' },

    // Buttons
    btnWrap: { marginTop: 8 },
    btn: {
      height: 54,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.40,
      shadowRadius: 16,
      elevation: 8,
    },
    btnText: { fontSize: 16, fontWeight: '700', color: '#FFF', letterSpacing: 0.2 },

    guestBtn: { alignItems: 'center', paddingVertical: 10 },
    guestText: { fontSize: 14, color: colors.textMuted, textDecorationLine: 'underline' },

    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    footerText: { fontSize: 14, color: colors.textMuted },
    footerLink: { fontSize: 14, fontWeight: '700', color: colors.primary },
  });
}
