import React, { useState } from 'react';
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
} from 'react-native';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

export default function ResetPasswordScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const email = route.params?.email || '';
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!token.trim()) {
      Alert.alert(t('common.error'), 'E-postanıza gelen 6 haneli kodu girin');
      return;
    }
    if (!newPassword.trim()) {
      Alert.alert(t('common.error'), 'Yeni şifrenizi girin');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), 'Şifreler eşleşmiyor');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/password-reset/confirm', {
        token: token.trim(),
        new_password: newPassword,
      });
      Alert.alert('Başarılı', 'Şifreniz güncellendi. Giriş yapabilirsiniz.', [
        { text: 'Tamam', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }) },
      ]);
    } catch (err) {
      const msg = err.data?.detail || err.message || 'Bir hata oluştu';
      Alert.alert(t('common.error'), typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Yeni Şifre</Text>
        <Text style={styles.subtitle}>
          E-postanıza gelen 6 haneli kodu ve yeni şifrenizi girin.
        </Text>
        {email ? <Text style={styles.emailHint}>{email}</Text> : null}
        <TextInput
          style={styles.input}
          placeholder="6 haneli kod"
          placeholderTextColor="#6B7280"
          value={token}
          onChangeText={setToken}
          keyboardType="number-pad"
          maxLength={6}
        />
        <TextInput
          style={styles.input}
          placeholder="Yeni şifre"
          placeholderTextColor="#6B7280"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Yeni şifre (tekrar)"
          placeholderTextColor="#6B7280"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleReset}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Şifreyi Güncelle</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.link} onPress={() => navigation.navigate('ForgotPassword', { email })}>
          <Text style={styles.linkText}>Kod gelmedi mi? Tekrar gönder</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.link} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}>
          <Text style={styles.linkText}>← Girişe dön</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#9CA3AF', marginBottom: 16 },
  emailHint: { fontSize: 14, color: colors.accent, marginBottom: 16 },
  input: { backgroundColor: '#1F2937', borderRadius: 12, padding: 16, fontSize: 16, color: colors.text, marginBottom: 16 },
  button: { backgroundColor: '#8B5CF6', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  link: { marginTop: 16, alignItems: 'center' },
  linkText: { color: colors.accent, fontSize: 14 },
});
