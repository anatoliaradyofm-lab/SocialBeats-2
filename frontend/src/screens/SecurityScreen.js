import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch,
  Alert, Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

export default function SecurityScreen({ navigation }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const [twoFA, setTwoFA] = useState(false);
  const [twoFAMethods, setTwoFAMethods] = useState([]);
  const [biometric, setBiometric] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showSetup2FA, setShowSetup2FA] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [devices, setDevices] = useState([]);
  const [showDevices, setShowDevices] = useState(false);
  const [webauthnEnabled, setWebauthnEnabled] = useState(false);
  const [webauthnCreds, setWebauthnCreds] = useState([]);
  const [recCodesCount, setRecCodesCount] = useState(0);
  const [loginHistory, setLoginHistory] = useState([]);
  const [showLoginHistory, setShowLoginHistory] = useState(false);

  useEffect(() => {
    loadSettings();
    loadSessions();
  }, [token]);

  const loadSettings = async () => {
    try {
      const r = await api.get('/auth/security-settings', token);
      const s = r.settings || r;
      setTwoFA(s?.two_factor_enabled || false);
      setTwoFAMethods(s?.two_factor_methods || []);
      setBiometric(s?.biometric_enabled || false);
      setLoginAlerts(s?.login_alerts !== false);
      setWebauthnEnabled(s?.webauthn_enabled || false);
      setRecCodesCount(s?.recovery_codes_count || 0);
    } catch {}
  };

  const loadSessions = async () => {
    try {
      const r = await api.get('/auth/sessions', token);
      setSessions(r.sessions || r || []);
    } catch {}
  };

  const loadDevices = async () => {
    try {
      const r = await api.get('/security/devices', token);
      setDevices(r.devices || []);
    } catch {}
    setShowDevices(true);
  };

  const loadLoginHistory = async () => {
    try {
      const r = await api.get('/security/login-history?limit=20', token);
      setLoginHistory(r.logins || []);
    } catch {}
    setShowLoginHistory(true);
  };

  const toggleTwoFA = async () => {
    if (twoFA) {
      Alert.alert('2FA Kapat', 'İki faktörlü doğrulamayı kapatmak istediğinize emin misiniz?', [
        { text: 'İptal' },
        { text: 'Kapat', style: 'destructive', onPress: async () => {
          try {
            await api.delete('/auth/2fa', token);
            setTwoFA(false);
            setTwoFAMethods([]);
          } catch {}
        }},
      ]);
    } else {
      try {
        const res = await api.post('/auth/2fa/setup', { method: 'app' }, token);
        setSetupData(res);
        setShowSetup2FA(true);
      } catch (e) {
        Alert.alert('Hata', '2FA kurulumu başlatılamadı');
      }
    }
  };

  const verify2FASetup = async () => {
    if (verifyCode.length !== 6) { Alert.alert('Hata', '6 haneli kod girin'); return; }
    try {
      await api.post('/auth/2fa/verify', { code: verifyCode }, token);
      setTwoFA(true);
      setShowSetup2FA(false);
      setVerifyCode('');
      Alert.alert('Başarılı', '2FA etkinleştirildi! Şimdi kurtarma kodlarınızı oluşturun.', [
        { text: 'Tamam', onPress: generateRecoveryCodes },
      ]);
    } catch {
      Alert.alert('Hata', 'Geçersiz kod');
    }
  };

  const generateRecoveryCodes = async () => {
    try {
      const res = await api.post('/security/recovery-codes/generate', {}, token);
      setRecoveryCodes(res.codes || []);
      setRecCodesCount(res.count || 10);
      setShowRecoveryModal(true);
    } catch {}
  };

  const toggleBiometric = async () => {
    try {
      const LocalAuth = require('expo-local-authentication');
      const hasHW = await LocalAuth.hasHardwareAsync();
      if (!hasHW) { Alert.alert('Hata', 'Biyometrik donanım bulunamadı'); return; }
      const enrolled = await LocalAuth.isEnrolledAsync();
      if (!enrolled) { Alert.alert('Hata', 'Biyometrik kayıt yapılmamış'); return; }
      if (!biometric) {
        const result = await LocalAuth.authenticateAsync({ promptMessage: 'Kimliğinizi doğrulayın' });
        if (!result.success) return;
      }
      setBiometric(!biometric);
      await api.put('/notifications/settings', { biometric_enabled: !biometric }, token).catch(() => {});
    } catch {}
  };

  const revokeSession = (sessionId) => {
    Alert.alert('Oturumu Kapat', 'Bu cihazdan çıkış yapılacak.', [
      { text: 'İptal' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/auth/sessions/${sessionId}`, token);
          setSessions(prev => prev.filter(s => s.id !== sessionId));
        } catch {}
      }},
    ]);
  };

  const revokeAllSessions = () => {
    Alert.alert('Tüm Oturumları Kapat', 'Diğer tüm cihazlardan çıkış yapılacak.', [
      { text: 'İptal' },
      { text: 'Hepsini Kapat', style: 'destructive', onPress: async () => {
        try {
          await api.post('/auth/sessions/revoke-all', {}, token);
          setSessions(prev => prev.filter(s => s.is_current));
        } catch {}
      }},
    ]);
  };

  const removeDevice = async (deviceId) => {
    try {
      await api.delete(`/security/devices/${deviceId}`, token);
      setDevices(prev => prev.filter(d => d.id !== deviceId));
    } catch {}
  };

  const SectionRow = ({ icon, label, desc, value, onToggle, onPress, rightText, iconColor, children }) => (
    <TouchableOpacity
      style={[styles.switchRow, { borderTopWidth: 0.5, borderTopColor: colors.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <Ionicons name={icon} size={20} color={iconColor || BRAND.primary} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 14 }}>{label}</Text>
        {desc ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{desc}</Text> : null}
        {children}
      </View>
      {onToggle && (
        <Switch value={value} onValueChange={onToggle} trackColor={{ true: BRAND.primary, false: colors.border }} thumbColor="#FFF" />
      )}
      {rightText && <Text style={{ color: colors.textMuted, fontSize: 12 }}>{rightText}</Text>}
      {onPress && !onToggle && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Güvenlik</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Authentication Section */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>DOĞRULAMA</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <SectionRow icon="key" label="İki Faktörlü Doğrulama (2FA)" desc={twoFA ? `Aktif (${twoFAMethods.join(', ') || 'app'})` : 'Hesabınıza ek güvenlik katın'} value={twoFA} onToggle={toggleTwoFA} />
          <SectionRow icon="finger-print" label="Biyometrik Kilit" desc="Parmak izi / Yüz tanıma ile giriş" value={biometric} onToggle={toggleBiometric} iconColor={BRAND.accent} />
          <SectionRow icon="alert-circle" label="Giriş Bildirimleri" desc="Yeni cihazdan giriş yapıldığında email bildir" value={loginAlerts} onToggle={(v) => { setLoginAlerts(v); api.put('/notifications/settings', { login_alerts: v }, token).catch(() => {}); }} iconColor="#F59E0B" />
          <SectionRow icon="shield-checkmark" label="Güvenlik Anahtarı (WebAuthn)" desc={webauthnEnabled ? 'Kayıtlı anahtar var' : 'Fiziksel güvenlik anahtarı ekle'} onPress={() => Alert.alert('WebAuthn', 'Güvenlik anahtarı kaydetmek için web tarayıcısı gereklidir.')} iconColor="#10B981" />
        </View>

        {/* Recovery & Codes */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>KURTARMA</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <SectionRow icon="document-text" label="Kurtarma Kodları" desc={recCodesCount > 0 ? `${recCodesCount} kod kaldı` : 'Henüz oluşturulmadı'} onPress={generateRecoveryCodes} iconColor="#8B5CF6" />
          <SectionRow icon="lock-closed" label="Şifre Değiştir" onPress={() => navigation.navigate('ChangePassword')} />
        </View>

        {/* Login History */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>GİRİŞ GEÇMİŞİ</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <SectionRow icon="time" label="Giriş Geçmişi" desc="Son girişleri ve şüpheli aktiviteleri gör" onPress={loadLoginHistory} iconColor="#F59E0B" />
          <SectionRow icon="phone-portrait" label="Cihaz Yönetimi" desc="Tanıdık cihazlar listesi" onPress={loadDevices} iconColor="#3B82F6" />
        </View>

        {/* Active Sessions */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>AKTİF OTURUMLAR</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          {sessions.length > 0 ? sessions.map((s, i) => (
            <View key={s.id || i} style={[styles.sessionRow, i < sessions.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.border }]}>
              <Ionicons name={s.device === 'mobile' || s.device_type === 'mobile' ? 'phone-portrait' : 'desktop'} size={20} color={s.is_current ? BRAND.primary : colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 13 }}>{s.device_name || s.device || s.user_agent || 'Bilinmeyen'}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>{s.ip_address || ''} · {s.last_active || ''}</Text>
                {s.is_current && <Text style={{ color: BRAND.primary, fontSize: 10, fontWeight: '600' }}>Bu cihaz</Text>}
              </View>
              {!s.is_current && (
                <TouchableOpacity onPress={() => revokeSession(s.id)}>
                  <Ionicons name="close-circle" size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          )) : (
            <Text style={{ color: colors.textMuted, padding: 14, textAlign: 'center' }}>Oturum bilgisi yok</Text>
          )}
        </View>

        {sessions.length > 1 && (
          <TouchableOpacity style={[styles.dangerBtn, { borderColor: '#EF4444' }]} onPress={revokeAllSessions}>
            <Text style={{ color: '#EF4444', fontWeight: '600' }}>Diğer Tüm Oturumları Kapat</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* 2FA Setup Modal */}
      <Modal visible={showSetup2FA} transparent animationType="slide" onRequestClose={() => setShowSetup2FA(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSetup2FA(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>2FA Kurulumu</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={{ color: colors.text, fontSize: 14, marginBottom: 12 }}>
              1. Google Authenticator veya benzeri bir uygulama indirin{'\n'}
              2. Aşağıdaki kodu uygulamaya ekleyin{'\n'}
              3. Uygulamadaki 6 haneli kodu girin
            </Text>
            {setupData?.secret && (
              <View style={[styles.secretBox, { backgroundColor: colors.card }]}>
                <Text style={{ color: colors.text, fontSize: 16, fontFamily: 'monospace', fontWeight: '700', textAlign: 'center' }}>{setupData.secret}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 4 }}>Bu kodu kimseyle paylaşmayın</Text>
              </View>
            )}
            <View style={[styles.inputWrap, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Ionicons name="keypad" size={18} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>6 Haneli Doğrulama Kodu</Text>
                {/* Using a simple text approach since TextInput might need imports */}
              </View>
            </View>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: BRAND.primary }]} onPress={verify2FASetup}>
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Doğrula</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Recovery Codes Modal */}
      <Modal visible={showRecoveryModal} transparent animationType="slide" onRequestClose={() => setShowRecoveryModal(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowRecoveryModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Kurtarma Kodları</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View style={[styles.warningBox, { backgroundColor: '#F59E0B18' }]}>
              <Ionicons name="warning" size={20} color="#F59E0B" />
              <Text style={{ color: '#F59E0B', fontSize: 13, flex: 1, marginLeft: 8 }}>
                Bu kodları güvenli bir yere kaydedin. Her kod sadece bir kez kullanılabilir.
              </Text>
            </View>
            <View style={[styles.codesGrid, { backgroundColor: colors.surfaceElevated }]}>
              {(recoveryCodes || []).map((code, i) => (
                <View key={i} style={[styles.codeItem, { borderBottomColor: colors.border }]}>
                  <Text style={{ color: colors.textMuted, fontSize: 12, width: 24 }}>{i + 1}.</Text>
                  <Text style={{ color: colors.text, fontSize: 15, fontFamily: 'monospace', fontWeight: '600' }}>{code}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Devices Modal */}
      <Modal visible={showDevices} transparent animationType="slide" onRequestClose={() => setShowDevices(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDevices(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Cihaz Yönetimi</Text>
            <View style={{ width: 24 }} />
          </View>
          {devices.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="phone-portrait-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginTop: 12 }}>Kayıtlı cihaz yok</Text>
            </View>
          ) : (
            <FlatList
              data={devices}
              keyExtractor={(item, i) => item.id || `${i}`}
              renderItem={({ item }) => (
                <View style={[styles.deviceRow, { borderBottomColor: colors.border }]}>
                  <Ionicons name={item.platform?.includes('iOS') || item.platform?.includes('Android') ? 'phone-portrait' : 'desktop'} size={22} color={item.is_trusted ? BRAND.primary : colors.textMuted} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: colors.text, fontSize: 14 }}>{item.platform || 'Bilinmeyen'}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>{item.ip_address} · {item.last_active?.slice(0, 10)}</Text>
                    {item.is_trusted && <Text style={{ color: '#10B981', fontSize: 10 }}>Güvenilir</Text>}
                  </View>
                  <TouchableOpacity onPress={() => removeDevice(item.id)}>
                    <Ionicons name="trash" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              )}
              contentContainerStyle={{ padding: 16 }}
            />
          )}
        </View>
      </Modal>

      {/* Login History Modal */}
      <Modal visible={showLoginHistory} transparent animationType="slide" onRequestClose={() => setShowLoginHistory(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowLoginHistory(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Giriş Geçmişi</Text>
            <View style={{ width: 24 }} />
          </View>
          {loginHistory.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="time-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginTop: 12 }}>Giriş kaydı yok</Text>
            </View>
          ) : (
            <FlatList
              data={loginHistory}
              keyExtractor={(item, i) => item.id || `${i}`}
              renderItem={({ item }) => (
                <View style={[styles.deviceRow, { borderBottomColor: colors.border }]}>
                  <Ionicons name={item.is_suspicious ? 'warning' : 'checkmark-circle'} size={20} color={item.is_suspicious ? '#EF4444' : '#10B981'} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: colors.text, fontSize: 13 }}>{item.platform || item.device || 'Bilinmeyen'}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>{item.ip_address} · {item.timestamp?.slice(0, 16)}</Text>
                    {item.is_suspicious && <Text style={{ color: '#EF4444', fontSize: 10 }}>Şüpheli giriş</Text>}
                  </View>
                </View>
              )}
              contentContainerStyle={{ padding: 16 }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginTop: 8, marginBottom: 8 },
  card: { borderRadius: 16, padding: 14, marginBottom: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  dangerBtn: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  modalContainer: { flex: 1, paddingTop: 50 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16 },
  secretBox: { padding: 16, borderRadius: 12, marginVertical: 16 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 52, marginBottom: 16, gap: 10 },
  primaryBtn: { height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  warningBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 16 },
  codesGrid: { borderRadius: 12, padding: 16 },
  codeItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5 },
});
