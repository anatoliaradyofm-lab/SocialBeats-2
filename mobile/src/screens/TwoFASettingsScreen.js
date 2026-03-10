/**
 * TwoFASettingsScreen - 2FA kurulum ve yönetim
 * Backend: GET /auth/2fa/status, POST /auth/2fa/setup, POST /auth/2fa/verify, DELETE /auth/2fa
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert,
  ActivityIndicator, ScrollView, Image} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

export default function TwoFASettingsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [setupMode, setSetupMode] = useState(false);
  const [verifyMode, setVerifyMode] = useState(false);
  const [code, setCode] = useState('');
  const [setupResult, setSetupResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadStatus = async () => {
    try {
      const data = await api.get('/auth/2fa/status', token);
      setStatus(data);
    } catch {
      setStatus({ is_enabled: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const startSetup = async (method = 'app') => {
    setBusy(true);
    try {
      const res = await api.post('/auth/2fa/setup', { method }, token);
      setSetupResult(res);
      setSetupMode(true);
      setVerifyMode(true);
      setCode('');
    } catch (err) {
      Alert.alert(t('common.error'), err?.data?.detail || err.message || t('settings.twoFASetupFailed'));
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!code || code.length !== 6) {
      Alert.alert(t('common.error'), t('settings.enterSixDigitCode'));
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/2fa/verify', { code }, token);
      Alert.alert('Başarılı', '2FA etkinleştirildi');
      setSetupMode(false);
      setVerifyMode(false);
      setCode('');
      setSetupResult(null);
      loadStatus();
    } catch (err) {
      Alert.alert(t('common.error'), err?.data?.detail || err.message || t('settings.verificationFailed'));
    } finally {
      setBusy(false);
    }
  };

  const disable2FA = () => {
    Alert.alert('2FA Kapat', 'İki faktörlü doğrulamayı kapatmak istediğinize emin misiniz?', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: 'Kapat',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await api.delete('/auth/2fa', token);
            Alert.alert('Başarılı', '2FA devre dışı bırakıldı');
            loadStatus();
          } catch (err) {
            Alert.alert('Hata', err?.data?.detail || err.message);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const cancelSetup = () => {
    setSetupMode(false);
    setVerifyMode(false);
    setCode('');
    setSetupResult(null);
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>İki Faktörlü Doğrulama</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>İki Faktörlü Doğrulama</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        {!setupMode ? (
          <>
            <View style={styles.statusCard}>
              <Text style={styles.statusLabel}>Durum</Text>
              <View style={styles.statusRow}>
                <Ionicons
                  name={status?.is_enabled ? 'shield-checkmark' : 'shield-outline'}
                  size={24}
                  color={status?.is_enabled ? '#22C55E' : '#9CA3AF'}
                />
                <Text style={styles.statusText}>
                  {status?.is_enabled ? 'Etkin' : 'Kapalı'}
                </Text>
              </View>
            </View>

            {status?.is_enabled ? (
              <TouchableOpacity
                style={[styles.btn, styles.btnDanger]}
                onPress={disable2FA}
                disabled={busy}
              >
                <Text style={styles.btnText}>2FA Kapat</Text>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Uygulama ile doğrulama (TOTP)</Text>
                <Text style={styles.desc}>
                  Google Authenticator veya benzeri bir uygulama ile QR kodu tarayarak 2FA aktif edebilirsiniz.
                </Text>
                <TouchableOpacity
                  style={[styles.btn, busy && styles.btnDisabled]}
                  onPress={() => startSetup('app')}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>2FA Kur</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </>
        ) : (
          <>
            {setupResult && (
              <View style={styles.setupBox}>
                <Text style={styles.setupTitle}>QR kodu tarayın</Text>
                {setupResult.qr_url && (
                  <View style={styles.qrWrap}>
                    <Image
                      source={{
                        uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                          setupResult.qr_url || setupResult.qr_code_url || ''
                        )}`,
                      }}
                      style={styles.qrCode}
                      resizeMode="contain"
                    />
                  </View>
                )}
                <Text style={styles.setupTitle}>Manuel anahtar (gerekirse)</Text>
                <Text style={styles.secretCode} selectable>{setupResult.secret}</Text>
                <Text style={styles.setupHint}>
                  Auth uygulamanızla QR tarayın veya yukarıdaki kodu manuel girin.
                </Text>
                {setupResult.backup_codes && setupResult.backup_codes.length > 0 && (
                  <View style={styles.backupCodesWrap}>
                    <Text style={styles.setupTitle}>Yedek kodlar</Text>
                    <Text style={styles.setupHint}>
                      Bu kodları güvenli bir yerde saklayın. Telefonunuzu kaybederseniz hesabınıza erişmek için kullanabilirsiniz.
                    </Text>
                    <View style={styles.backupCodesGrid}>
                      {setupResult.backup_codes.map((c, i) => (
                        <Text key={i} style={styles.backupCode} selectable>{c}</Text>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
            <Text style={styles.sectionTitle}>Doğrulama kodunu girin</Text>
            <TextInput
              style={styles.input}
              placeholder="6 haneli kod"
              placeholderTextColor="#6B7280"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <View style={styles.row}>
              <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={cancelSetup}>
                <Text style={styles.btnTextSecondary}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, busy && styles.btnDisabled]}
                onPress={verifyCode}
                disabled={busy}
              >
                {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>Doğrula</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  backBtn: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  content: { padding: 24 },
  statusCard: { backgroundColor: '#1F2937', borderRadius: 12, padding: 20, marginBottom: 24 },
  statusLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusText: { fontSize: 18, fontWeight: '600', color: colors.text },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 },
  desc: { fontSize: 14, color: '#9CA3AF', marginBottom: 20 },
  btn: { padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  btnPrimary: { backgroundColor: '#8B5CF6' },
  btnSecondary: { backgroundColor: '#374151' },
  btnDanger: { backgroundColor: '#DC2626' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  btnTextSecondary: { color: colors.text, fontSize: 16 },
  setupBox: { backgroundColor: '#1F2937', borderRadius: 12, padding: 16, marginBottom: 24 },
  setupTitle: { fontSize: 14, color: '#9CA3AF', marginBottom: 8 },
  qrWrap: { alignItems: 'center', marginBottom: 16 },
  qrCode: { width: 200, height: 200, backgroundColor: '#fff', borderRadius: 8 },
  secretCode: { fontSize: 16, fontFamily: 'monospace', color: colors.text, marginBottom: 8 },
  setupHint: { fontSize: 12, color: '#6B7280' },
  backupCodesWrap: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#374151' },
  backupCodesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  backupCode: { fontSize: 14, fontFamily: 'monospace', color: colors.text, backgroundColor: '#374151', padding: 8, borderRadius: 6 },
  input: { backgroundColor: '#1F2937', borderRadius: 12, padding: 16, fontSize: 18, color: colors.text, marginBottom: 20, letterSpacing: 8, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 12 },
});
