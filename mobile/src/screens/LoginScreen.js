import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import biometricService from '../services/biometricService';
import { useTheme } from '../contexts/ThemeContext';
import { auth as firebaseAuth, googleProvider } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

export default function LoginScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const { login, enterAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('fingerprint');
  const [biometricLoading, setBiometricLoading] = useState(false);

  useEffect(() => {
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    const result = await biometricService.isAvailable();
    if (!result.available) return;

    setBiometricType(result.type);
    const enabled = await biometricService.isEnabled();
    if (!enabled) return;

    const hasToken = await biometricService.getSavedToken();
    setBiometricAvailable(true);
    if (hasToken) {
      handleBiometricLogin();
    }
  };

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    try {
      const result = await biometricService.biometricLogin();
      if (result.success) {
        const res = await api.post('/auth/verify-token', { token: result.token });
        const authToken = res.access_token || res.token || result.token;
        if (res.user) {
          await login(authToken, res.user, true);
          navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        } else {
          await login(result.token, res, true);
          navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        }
      } else if (result.reason === 'no_token') {
        Alert.alert(t('common.error'), 'Biometric credentials not found. Please log in with password first.');
      } else if (result.reason === 'auth_failed') {
        // User cancelled or failed — do nothing
      }
    } catch (err) {
      Alert.alert(t('common.error'), err.message || 'Biometric login failed');
    } finally {
      setBiometricLoading(false);
    }
  };

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'socialbeats',
    path: 'auth/callback',
    useProxy: false,
  });

  const clientId = Platform.OS === 'android' ? (process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) : process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId || '',
      scopes: ['openid', 'email', 'profile'],
      redirectUri: Platform.select({
        web: 'http://localhost:8082/auth/callback',
        default: redirectUri,
      }),
      responseType: AuthSession.ResponseType.Token,
      usePKCE: false,
    },
    GOOGLE_DISCOVERY
  );

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      if (Platform.OS === 'web') {
        const result = await signInWithPopup(firebaseAuth, googleProvider);
        const credential = GoogleAuthProvider.credentialFromResult(result);

        let payload = {};
        if (credential?.idToken) {
          payload = { id_token: credential.idToken };
        } else if (credential?.accessToken) {
          const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${credential.accessToken}` },
          });
          const googleUser = await userInfoRes.json();
          payload = {
            email: googleUser.email,
            name: googleUser.name || googleUser.email?.split('@')[0],
            picture: googleUser.picture || null,
            google_id: googleUser.id,
            access_token: credential.accessToken,
          };
        } else if (result.user) {
          // Fallback to Firebase user info if Google auth credential missing
          const token = await result.user.getIdToken();
          payload = {
            email: result.user.email,
            name: result.user.displayName,
            picture: result.user.photoURL,
            google_id: result.user.uid,
            access_token: token,
          };
        }

        const res = await api.post('/auth/google/mobile', payload);
        const token = res.access_token || res.token;
        if (token && res.user) {
          await login(token, res.user, rememberMe);
          navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        } else {
          Alert.alert(t('common.error'), t('login.googleError'));
        }
        return;
      }

      if (!clientId) {
        Alert.alert(t('common.error'), 'Google OAuth yapılandırılmadı. Client ID eksik.');
        return;
      }
      if (!request) return;

      const result = await promptAsync();
      if (result?.type !== 'success') {
        if (result?.type === 'cancel') return;
        throw new Error(result?.params?.error || result?.error?.message || 'Giriş iptal edildi');
      }
      const idToken = result.params?.id_token;
      const accessToken = result.params?.access_token;
      let payload = {};
      if (idToken) {
        payload = { id_token: idToken };
      } else if (accessToken) {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!userInfoRes.ok) throw new Error('Kullanıcı bilgisi alınamadı');
        const googleUser = await userInfoRes.json();
        payload = {
          email: googleUser.email,
          name: googleUser.name || googleUser.email?.split('@')[0],
          picture: googleUser.picture || null,
          google_id: googleUser.id,
          access_token: accessToken,
        };
      } else {
        throw new Error('Google yanıtı geçersiz');
      }
      const res = await api.post('/auth/google/mobile', payload);
      const token = res.access_token || res.token;
      if (token && res.user) {
        await login(token, res.user, rememberMe);
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      } else {
        Alert.alert(t('common.error'), t('login.googleError'));
      }
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('login.googleError'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common.error'), t('login.fillAll'));
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email: email.trim(), password });
      const token = res.access_token || res.token;
      if (token && res.user) {
        await login(token, res.user, rememberMe);
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      } else {
        Alert.alert(t('common.error'), t('login.failed'));
      }
    } catch (err) {
      const msg = err.data?.detail || err.message || t('login.failed');
      Alert.alert(t('common.error'), typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('login.title')}</Text>
        <Text style={styles.subtitle}>{t('login.subtitle')}</Text>
        <TextInput style={styles.input} placeholder={t('login.email')} placeholderTextColor="#6B7280" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" accessibilityLabel="Email input" accessibilityRole="none" />
        <TextInput style={styles.input} placeholder={t('login.password')} placeholderTextColor="#6B7280" value={password} onChangeText={setPassword} secureTextEntry accessibilityLabel="Password input" />
        <View style={styles.rememberRow}>
          <Switch value={rememberMe} onValueChange={setRememberMe} trackColor={{ false: '#374151', true: '#8B5CF6' }} thumbColor="#fff" />
          <Text style={styles.rememberText}>Beni hatırla</Text>
        </View>
        <TouchableOpacity style={styles.linkSmall} onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={styles.linkText}>Şifremi unuttum</Text>
        </TouchableOpacity>
        {biometricAvailable && (
          <TouchableOpacity
            style={[styles.biometricBtn, (loading || biometricLoading) && styles.buttonDisabled]}
            onPress={handleBiometricLogin}
            disabled={loading || biometricLoading}
          >
            {biometricLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.biometricIcon}>
                  {biometricType === 'face' ? '👤' : '🔐'}
                </Text>
                <Text style={styles.buttonText}>
                  {biometricType === 'face' ? 'Face ID ile giriş' : biometricType === 'fingerprint' ? 'Touch ID ile giriş' : 'Biyometrik giriş'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading} accessibilityLabel="Sign in" accessibilityRole="button">
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('login.submit')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.googleButton, (loading || googleLoading) && styles.buttonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={loading || googleLoading}
          accessibilityLabel="Sign in with Google"
          accessibilityRole="button"
        >
          {googleLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('login.googleSignIn')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('Register')}>
          <Text style={styles.linkText}>{t('login.noAccount')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.guestBtn} onPress={async () => { await enterAsGuest(); navigation.reset({ index: 0, routes: [{ name: 'Main' }] }); }}>
          <Text style={styles.guestBtnText}>Misafir olarak devam et</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#9CA3AF', marginBottom: 32 },
  input: { backgroundColor: '#1F2937', borderRadius: 12, padding: 16, fontSize: 16, color: colors.text, marginBottom: 16 },
  button: { backgroundColor: '#8B5CF6', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  googleButton: { backgroundColor: '#4285F4', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  rememberRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  rememberText: { color: '#9CA3AF', fontSize: 14, marginLeft: 8 },
  linkSmall: { alignSelf: 'flex-start', marginBottom: 16 },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: colors.accent, fontSize: 14 },
  guestBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#374151', borderRadius: 12 },
  guestBtnText: { color: '#9CA3AF', fontSize: 14 },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#374151',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  biometricIcon: { fontSize: 20 },
});
