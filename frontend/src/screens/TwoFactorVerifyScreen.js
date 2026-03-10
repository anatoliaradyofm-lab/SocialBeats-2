import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

export default function TwoFactorVerifyScreen({ navigation, route }) {
  const { login } = useAuth();
  const { colors } = useTheme();
  const { tempToken, email } = route.params || {};
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('code');

  const handleVerify = async () => {
    if (code.length < 6) { Alert.alert('Hata', '6 haneli kodu girin'); return; }
    setLoading(true);
    try {
      const res = await api.post('/auth/2fa/login-verify', { temp_token: tempToken, code });
      if (res.token && res.user) {
        await login(res.user, res.token);
      } else {
        Alert.alert('Hata', res.detail || 'Doğrulama başarısız');
      }
    } catch {
      Alert.alert('Hata', 'Doğrulama başarısız');
    }
    setLoading(false);
  };

  const handleRecoveryCode = async () => {
    if (code.length < 8) { Alert.alert('Hata', 'Kurtarma kodunu girin (örn: ABCD-EF12)'); return; }
    setLoading(true);
    try {
      const res = await api.post('/auth/2fa/login-verify', {
        temp_token: tempToken,
        code,
        is_recovery: true,
      });
      if (res.token && res.user) {
        await login(res.user, res.token);
      } else {
        Alert.alert('Hata', res.detail || 'Kurtarma kodu geçersiz');
      }
    } catch {
      Alert.alert('Hata', 'Kurtarma kodu geçersiz');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={[styles.iconBox, { backgroundColor: BRAND.primary + '15' }]}>
          <Ionicons name={mode === 'code' ? 'shield-checkmark' : 'key'} size={40} color={BRAND.primary} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>
          {mode === 'code' ? 'İki Faktörlü Doğrulama' : 'Kurtarma Kodu'}
        </Text>
        <Text style={{ color: colors.textMuted, textAlign: 'center', marginBottom: 24 }}>
          {mode === 'code'
            ? 'Kimlik doğrulama uygulamanızdaki 6 haneli kodu girin'
            : 'Kurtarma kodlarınızdan birini girin (örn: ABCD-EF12)'}
        </Text>

        <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Ionicons name="keypad" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={mode === 'code' ? '000000' : 'XXXX-XXXX'}
            placeholderTextColor={colors.textMuted}
            value={code}
            onChangeText={setCode}
            keyboardType={mode === 'code' ? 'number-pad' : 'default'}
            maxLength={mode === 'code' ? 6 : 9}
            autoCapitalize="characters"
            autoFocus
          />
        </View>

        <TouchableOpacity
          style={[styles.verifyBtn, { backgroundColor: BRAND.primary }]}
          onPress={mode === 'code' ? handleVerify : handleRecoveryCode}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#FFF" /> : (
            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 16 }}>Doğrula</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setMode(mode === 'code' ? 'recovery' : 'code'); setCode(''); }}>
          <Text style={{ color: BRAND.primary, textAlign: 'center', marginTop: 20, fontWeight: '500' }}>
            {mode === 'code' ? 'Kurtarma kodu kullan' : 'Doğrulama kodu kullan'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 54, paddingHorizontal: 16, paddingBottom: 8 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 80 },
  iconBox: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 56, marginBottom: 16, gap: 10 },
  input: { flex: 1, fontSize: 20, letterSpacing: 6, textAlign: 'center', fontWeight: '600' },
  verifyBtn: { height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
});
