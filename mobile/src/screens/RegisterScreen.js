/**
 * RegisterScreen — NOVA Design System v3.0
 * Modern multi-step registration · 2025 premium onboarding
 * Inspired by: Duolingo onboarding · Notion signup · UI8 auth kits
 * Step indicator · Smooth transitions · Validation inline
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { COUNTRIES } from '../lib/countries';

const STEPS = ['Account', 'Profile', 'Identity', 'Done'];

// ── InputField — defined OUTSIDE component so it never remounts ─────────────
// Note: use `inputRef` prop (not `ref`) — React strips `ref` from function components
function InputField({
  label, value, onChange, placeholder, secure, keyboard,
  inputRef, next, field, icon,
  colors, focusedField, setFocused, errors, setErrors, showPass, setShowPass,
}) {
  const isFocused = focusedField === field;
  const errorMsg  = errors[field];
  return (
    <View style={iStyle.fieldWrap}>
      <Text style={[iStyle.label, { color: colors.textSecondary }]}>{label}</Text>
      <View style={[
        iStyle.inputRow,
        { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
        isFocused && { borderColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width:0,height:0 }, shadowOpacity: 0.2, shadowRadius: 8 },
        errorMsg   && { borderColor: colors.error },
      ]}>
        <Ionicons name={icon} size={17} color={isFocused ? colors.primary : colors.textMuted} style={iStyle.inputIcon} />
        <TextInput
          ref={inputRef}
          style={[iStyle.input, { color: colors.text }]}
          value={value}
          onChangeText={v => { onChange(v); setErrors(e => ({ ...e, [field]: null })); }}
          placeholder={placeholder}
          placeholderTextColor={colors.textGhost}
          secureTextEntry={secure && !showPass}
          keyboardType={keyboard || 'default'}
          autoCapitalize="none"
          returnKeyType={next ? 'next' : 'done'}
          onSubmitEditing={() => next?.current?.focus?.()}
          onFocus={() => setFocused(field)}
          onBlur={() => setFocused(null)}
        />
        {secure && (
          <TouchableOpacity onPress={() => setShowPass(v => !v)} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
            <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={17} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {errorMsg && <Text style={[iStyle.errorText, { color: colors.error }]}>{errorMsg}</Text>}
    </View>
  );
}

const iStyle = StyleSheet.create({
  fieldWrap: { gap: 6, marginBottom: 4 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 9,
    gap: 10,
  },
  inputIcon: { width: 18 },
  input: { flex: 1, fontSize: 15 },
  errorText: { fontSize: 12, marginTop: 2 },
});

// ── Main Screen ─────────────────────────────────────────────────────────────
export default function RegisterScreen({ navigation }) {
  const { colors }   = useTheme();
  const { t }        = useTranslation();
  const insets       = useSafeAreaInsets();
  const { register } = useAuth();

  const [step, setStep]         = useState(0);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [username, setUsername] = useState('');
  const [name, setName]         = useState('');
  const [gender, setGender]     = useState('');
  const [country, setCountry]   = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors]     = useState({});
  const [focused, setFocused]   = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  // Refs — passed as `inputRef` prop, not `ref`
  const passRef    = useRef(null);
  const confirmRef = useRef(null);
  const userRef    = useRef(null);
  const nameRef    = useRef(null);

  const validateStep0 = () => {
    const e = {};
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) e.email = 'Valid email required';
    if (password.length < 8) e.password = 'Min 8 characters';
    if (password !== confirm) e.confirm = 'Passwords don\'t match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep1 = () => {
    const e = {};
    const cleanUser = username.trim().replace(/^@/, '');
    if (!cleanUser || cleanUser.length < 3) e.username = 'Min 3 characters';
    else if (!/^[a-zA-Z0-9_.]+$/.test(cleanUser)) e.username = 'Only letters, numbers, _ and .';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e = {};
    if (!gender) e.gender = 'Cinsiyet seçimi zorunludur';
    if (!country) e.country = 'Ülke seçimi zorunludur';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = () => {
    if (step === 0 && !validateStep0()) return;
    if (step === 1 && !validateStep1()) return;
    if (step === 2) { if (!validateStep2()) return; handleRegister(); return; }
    setStep(s => s + 1);
  };

  const handleRegister = useCallback(async () => {
    if (!validateStep1()) return;
    setLoading(true);
    try {
      const cleanUsername = username.trim().replace(/^@/, '').toLowerCase();
      await register({
        email: email.trim().toLowerCase(),
        password,
        username: cleanUsername,
        name: name.trim(),
        gender: gender || undefined,
        country: country || undefined,
      });
      setStep(3);
    } catch (err) {
      const msg = err?.data?.detail;
      const detail = Array.isArray(msg) ? msg.map(m => m.msg || m).join(', ') : (msg || err?.message || 'Please try again');
      Alert.alert('Registration failed', detail);
    } finally {
      setLoading(false);
    }
  }, [email, password, username, name]);

  // Shared props for all InputField instances
  const inputShared = { colors, focusedField: focused, setFocused, errors, setErrors, showPass, setShowPass };

  const s = createStyles(colors, insets);

  return (
    <View style={s.root}>
      <LinearGradient colors={colors.authBgGrad} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={StyleSheet.absoluteFill} />
      <View style={[s.orb, s.orb1, { backgroundColor: colors.orbColor1 }]} />
      <View style={[s.orb, s.orb2, { backgroundColor: colors.orbColor2 }]} />

      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View style={[s.inner, { opacity: fadeAnim }]}>

            {/* Back button */}
            <TouchableOpacity style={s.backBtn} onPress={() => step > 0 ? setStep(s => s - 1) : navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Step indicator */}
            <View style={s.stepIndicator}>
              {STEPS.map((st, i) => (
                <View key={i} style={s.stepWrap}>
                  <View style={[s.stepDot, i <= step && { backgroundColor: colors.primary }, i < step && { backgroundColor: colors.primaryDeep }]}>
                    {i < step
                      ? <Ionicons name="checkmark" size={12} color="#FFF" />
                      : <Text style={[s.stepNum, { color: i === step ? '#FFF' : colors.textMuted }]}>{i + 1}</Text>
                    }
                  </View>
                  {i < STEPS.length - 1 && (
                    <View style={[s.stepLine, i < step && { backgroundColor: colors.primary }]} />
                  )}
                </View>
              ))}
            </View>

            {/* Logo */}
            <View style={s.logoWrap}>
              <LinearGradient colors={colors.gradPrimary} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={s.logoIcon}>
                <Ionicons name="musical-notes" size={28} color="#FFF" />
              </LinearGradient>
            </View>

            {/* Card */}
            <View style={[s.card, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
              {step === 0 && (
                <>
                  <Text style={[s.cardTitle, { color: colors.text }]}>Create account</Text>
                  <Text style={[s.cardSub, { color: colors.textMuted }]}>Your music journey starts here</Text>

                  <InputField label="EMAIL" value={email} onChange={setEmail} placeholder="you@example.com"
                    keyboard="email-address" next={passRef} field="email" icon="mail-outline" {...inputShared} />
                  <InputField label="PASSWORD" value={password} onChange={setPassword} placeholder="Min. 8 characters"
                    secure inputRef={passRef} next={confirmRef} field="password" icon="lock-closed-outline" {...inputShared} />
                  <InputField label="CONFIRM PASSWORD" value={confirm} onChange={setConfirm} placeholder="Repeat password"
                    secure inputRef={confirmRef} field="confirm" icon="lock-closed-outline" {...inputShared} />

                  <TouchableOpacity onPress={nextStep} activeOpacity={0.85} style={s.btnWrap}>
                    <LinearGradient colors={colors.gradPrimary} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={s.btn}>
                      <Text style={s.btnText}>Continue</Text>
                      <Ionicons name="arrow-forward" size={18} color="#FFF" />
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

              {step === 1 && (
                <>
                  <Text style={[s.cardTitle, { color: colors.text }]}>Your profile</Text>
                  <Text style={[s.cardSub, { color: colors.textMuted }]}>Let the world know you</Text>

                  {/* Username with fixed @ prefix */}
                  <View style={iStyle.fieldWrap}>
                    <Text style={[iStyle.label, { color: colors.textSecondary }]}>USERNAME</Text>
                    <View style={[
                      iStyle.inputRow,
                      { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                      focused === 'username' && { borderColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width:0,height:0 }, shadowOpacity: 0.2, shadowRadius: 8 },
                      errors.username && { borderColor: colors.error },
                    ]}>
                      <Ionicons name="at-outline" size={17} color={focused === 'username' ? colors.primary : colors.textMuted} style={iStyle.inputIcon} />
                      <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '600' }}>@</Text>
                      <TextInput
                        ref={userRef}
                        style={[iStyle.input, { color: colors.text }]}
                        value={username}
                        onChangeText={v => { setUsername(v.replace(/^@+/, '')); setErrors(e => ({ ...e, username: null })); }}
                        placeholder="johndoe"
                        placeholderTextColor={colors.textGhost}
                        autoCapitalize="none"
                        returnKeyType="next"
                        onSubmitEditing={() => nameRef.current?.focus()}
                        onFocus={() => setFocused('username')}
                        onBlur={() => setFocused(null)}
                      />
                    </View>
                    {errors.username && <Text style={[iStyle.errorText, { color: colors.error }]}>{errors.username}</Text>}
                  </View>
                  <InputField label="DISPLAY NAME" value={name} onChange={setName} placeholder="Your name (optional)"
                    inputRef={nameRef} field="name" icon="person-outline" {...inputShared} />

                  <TouchableOpacity onPress={nextStep} activeOpacity={0.85} style={s.btnWrap}>
                    <LinearGradient colors={colors.gradPrimary} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={s.btn}>
                      <Text style={s.btnText}>Devam Et</Text>
                      <Ionicons name="arrow-forward" size={18} color="#FFF" />
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

              {step === 2 && (
                <>
                  <Text style={[s.cardTitle, { color: colors.text }]}>Kimliğin</Text>
                  <Text style={[s.cardSub, { color: colors.textMuted }]}>Seni daha iyi tanıyalım</Text>

                  {/* Gender */}
                  <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>CİNSİYET <Text style={{ color: colors.error }}>*</Text></Text>
                  <View style={s.genderRow}>
                    {[{ key: 'male', label: 'Erkek', icon: 'male' }, { key: 'female', label: 'Kadın', icon: 'female' }].map(g => (
                      <TouchableOpacity
                        key={g.key}
                        onPress={() => { setGender(g.key); setErrors(e => ({ ...e, gender: null })); }}
                        style={[s.genderBtn, { borderColor: gender === g.key ? colors.primary : (errors.gender ? colors.error : colors.inputBorder), backgroundColor: gender === g.key ? colors.primaryGlow : colors.inputBg }]}
                        activeOpacity={0.8}
                      >
                        <Ionicons name={g.icon} size={22} color={gender === g.key ? colors.primary : colors.textMuted} />
                        <Text style={[s.genderBtnText, { color: gender === g.key ? colors.primary : colors.textMuted }]}>{g.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {errors.gender && <Text style={{ color: colors.error, fontSize: 12, marginBottom: 8 }}>{errors.gender}</Text>}

                  {/* Country */}
                  <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>ÜLKE <Text style={{ color: colors.error }}>*</Text></Text>
                  <View style={[s.countrySearchWrap, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                    <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                    <TextInput
                      style={[s.countrySearchInput, { color: colors.text }]}
                      placeholder="Ülke ara..."
                      placeholderTextColor={colors.textGhost}
                      value={countrySearch}
                      onChangeText={setCountrySearch}
                    />
                  </View>
                  <ScrollView style={[s.countryList, errors.country && { borderWidth: 1, borderColor: colors.error, borderRadius: 12 }]} showsVerticalScrollIndicator nestedScrollEnabled>
                    {COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase())).map(c => (
                      <TouchableOpacity
                        key={c.code}
                        onPress={() => { setCountry(c.name); setErrors(e => ({ ...e, country: null })); }}
                        style={[s.countryItem, country === c.name && { backgroundColor: colors.primaryGlow }]}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 20 }}>{c.flag}</Text>
                        <Text style={[s.countryItemText, { color: country === c.name ? colors.primary : colors.text }]}>{c.name}</Text>
                        {country === c.name && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {errors.country && <Text style={{ color: colors.error, fontSize: 12, marginTop: 4, marginBottom: 4 }}>{errors.country}</Text>}

                  <TouchableOpacity onPress={nextStep} disabled={loading} activeOpacity={0.85} style={s.btnWrap}>
                    <LinearGradient colors={colors.gradPrimary} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={[s.btn, loading && { opacity:0.7 }]}>
                      {loading ? <ActivityIndicator color="#FFF" /> : (
                        <>
                          <Text style={s.btnText}>Hesap Oluştur</Text>
                          <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

              {step === 3 && (
                <View style={s.successWrap}>
                  <LinearGradient colors={colors.gradPrimary} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={s.successIcon}>
                    <Ionicons name="checkmark-circle" size={48} color="#FFF" />
                  </LinearGradient>
                  <Text style={[s.successTitle, { color: colors.text }]}>Hoş geldin! 🎉</Text>
                  <Text style={[s.successSub, { color: colors.textMuted }]}>SocialBeats'e katıldın</Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Login')}
                    activeOpacity={0.85}
                    style={[s.btnWrap, { width: '100%' }]}
                  >
                    <LinearGradient colors={colors.gradPrimary} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={s.btn}>
                      <Text style={s.btnText}>Giriş Yap</Text>
                      <Ionicons name="arrow-forward" size={18} color="#FFF" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {step < 3 && (
              <View style={s.footer}>
                <Text style={[s.footerText, { color: colors.textMuted }]}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={[s.footerLink, { color: colors.primary }]}>Sign in</Text>
                </TouchableOpacity>
              </View>
            )}

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(colors, insets) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    orb: { position:'absolute', borderRadius:999, opacity:0.3 },
    orb1: { width:250, height:250, top:-50, right:-50 },
    orb2: { width:180, height:180, bottom:120, left:-70 },

    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingTop: insets.top + 16,
      paddingBottom: insets.bottom + 32,
    },
    inner: { gap: 20 },

    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    stepIndicator: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center' },
    stepWrap: { flexDirection: 'row', alignItems: 'center' },
    stepDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNum: { fontSize: 12, fontWeight: '800' },
    stepLine: { width: 40, height: 1.5, backgroundColor: colors.border },

    logoWrap: { alignItems: 'center' },
    logoIcon: {
      width: 60,
      height: 60,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width:0,height:8 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 8,
    },

    card: {
      borderRadius: 28,
      borderWidth: 1,
      padding: 24,
      gap: 6,
    },
    cardTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.8 },
    cardSub: { fontSize: 14, marginBottom: 12 },

    btnWrap: { marginTop: 8 },
    btn: {
      height: 54,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      shadowColor: colors.primary,
      shadowOffset: { width:0,height:6 },
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 8,
    },
    btnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

    successWrap: { alignItems: 'center', gap: 16, paddingVertical: 24 },
    successIcon: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
    successTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.8 },
    successSub: { fontSize: 16 },

    footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    footerText: { fontSize: 14 },
    footerLink: { fontSize: 14, fontWeight: '700' },

    // Identity step
    fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 8, marginBottom: 6 },
    genderRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
    genderBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5,
    },
    genderBtnText: { fontSize: 15, fontWeight: '700' },
    countrySearchWrap: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginBottom: 6,
    },
    countrySearchInput: { flex: 1, fontSize: 14 },
    countryList: { maxHeight: 200, borderRadius: 12 },
    countryItem: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
    },
    countryItemText: { flex: 1, fontSize: 14, fontWeight: '500' },
  });
}
