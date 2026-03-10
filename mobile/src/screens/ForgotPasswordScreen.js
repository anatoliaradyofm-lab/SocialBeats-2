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

export default function ForgotPasswordScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const [email, setEmail] = useState(route.params?.email || '');
  const [loading, setLoading] = useState(false);

  const handleRequest = async () => {
    if (!email.trim()) {
      Alert.alert(t('common.error'), 'E-posta adresinizi girin');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/password-reset/request', { email: email.trim().toLowerCase() });
      Alert.alert(
        'Başarılı',
        'Sıfırlama kodu e-postanıza gönderildi. Lütfen e-postanızı kontrol edin.',
        [{ text: 'Tamam', onPress: () => navigation.navigate('ResetPassword', { email: email.trim().toLowerCase() }) }]
      );
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
        <Text style={styles.title}>Şifremi Unuttum</Text>
        <Text style={styles.subtitle}>E-posta adresinizi girin, size sıfırlama kodu gönderelim.</Text>
        <TextInput
          style={styles.input}
          placeholder="E-posta"
          placeholderTextColor="#6B7280"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRequest}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Kod Gönder</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.link} onPress={() => navigation.goBack()}>
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
  subtitle: { fontSize: 16, color: '#9CA3AF', marginBottom: 32 },
  input: { backgroundColor: '#1F2937', borderRadius: 12, padding: 16, fontSize: 16, color: colors.text, marginBottom: 16 },
  button: { backgroundColor: '#8B5CF6', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: colors.accent, fontSize: 14 },
});
