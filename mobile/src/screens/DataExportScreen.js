/**
 * DataExportScreen — GDPR/KVKK Veri Dışa Aktarma
 * POST /account/data-export → job başlat
 * GET  /account/data-export/status → durumu takip et
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Linking, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert } from '../components/ui/AppAlert';

const STATUS_CONFIG = {
  none:       { icon: 'cloud-download-outline', color: null,         label: 'Henüz talep yok' },
  pending:    { icon: 'hourglass-outline',       color: '#FBBF24',    label: 'Beklemede...' },
  processing: { icon: 'sync-outline',            color: '#60A5FA',    label: 'İşleniyor...' },
  ready:      { icon: 'checkmark-circle-outline',color: '#34D399',    label: 'Hazır! İndirilebilir' },
  failed:     { icon: 'alert-circle-outline',    color: '#F87171',    label: 'Hata oluştu' },
};

const DATA_CONTENTS = [
  { icon: 'person-outline',       label: 'Profil bilgileri ve ayarlar' },
  { icon: 'image-outline',        label: 'Gönderiler ve medya dosyaları' },
  { icon: 'musical-notes-outline',label: 'Dinleme geçmişi ve çalma listeleri' },
  { icon: 'chatbubbles-outline',  label: 'Mesajlaşma geçmişi' },
  { icon: 'people-outline',       label: 'Takipçi ve takip listesi' },
  { icon: 'heart-outline',        label: 'Beğeniler ve kaydedilenler' },
];

export default function DataExportScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [jobStatus, setJobStatus] = useState('none');
  const [jobData, setJobData] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const pollRef = useRef(null);

  const checkStatus = async (silent = false) => {
    if (!token) return;
    if (!silent) setCheckingStatus(true);
    try {
      const res = await api.get('/account/data-export/status', token);
      setJobStatus(res?.status || 'none');
      setJobData(res);
      if (res?.status === 'pending' || res?.status === 'processing') {
        startPolling();
      } else {
        stopPolling();
      }
    } catch {
      // ignore
    } finally {
      if (!silent) setCheckingStatus(false);
    }
  };

  const startPolling = () => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => checkStatus(true), 8000);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    checkStatus();
    return () => stopPolling();
  }, [token]);

  const requestExport = async () => {
    Alert.alert(
      'Veri Talebi Oluştur',
      'Tüm verileriniz hazırlanacak. Bu işlem birkaç dakika sürebilir. E-posta adresinize hazır olduğunda bildirim gönderilecektir.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Talep Et',
          onPress: async () => {
            setRequesting(true);
            try {
              const res = await api.post('/account/data-export', {}, token);
              setJobStatus('pending');
              setJobData(res);
              startPolling();
            } catch (err) {
              Alert.alert('Hata', err?.data?.detail || 'Talep oluşturulamadı.');
            } finally {
              setRequesting(false);
            }
          },
        },
      ]
    );
  };

  const openDownload = () => {
    const url = jobData?.download_url;
    if (!url) return;
    const text = encodeURIComponent(`SocialBeats verileriniz hazır. İndirmek için:\n${url}`);
    const waUrl = Platform.OS === 'web'
      ? `https://wa.me/?text=${text}`
      : `whatsapp://send?text=${text}`;
    Linking.openURL(waUrl).catch(() => {
      // WhatsApp yoksa tarayıcıda aç
      Linking.openURL(url).catch(() => Alert.alert('Hata', 'Link açılamadı.'));
    });
  };

  const statusCfg = STATUS_CONFIG[jobStatus] || STATUS_CONFIG.none;
  const isInProgress = jobStatus === 'pending' || jobStatus === 'processing';
  const canRequest = jobStatus === 'none' || jobStatus === 'failed' || jobStatus === 'ready';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verilerimi İndir</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Status Card */}
        {jobStatus !== 'none' && (
          <View style={[
            styles.statusCard,
            {
              backgroundColor: colors.card,
              borderColor: statusCfg.color ? statusCfg.color + '40' : colors.border,
            }
          ]}>
            <Ionicons
              name={statusCfg.icon}
              size={32}
              color={statusCfg.color || colors.primary}
              style={isInProgress && styles.spinIcon}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusLabel, { color: statusCfg.color || colors.text }]}>
                {statusCfg.label}
              </Text>
              {jobData?.requested_at && (
                <Text style={[styles.statusDate, { color: colors.textMuted }]}>
                  Talep tarihi: {new Date(jobData.requested_at).toLocaleString('tr-TR')}
                </Text>
              )}
              {jobData?.completed_at && (
                <Text style={[styles.statusDate, { color: colors.textMuted }]}>
                  Tamamlanma: {new Date(jobData.completed_at).toLocaleString('tr-TR')}
                </Text>
              )}
            </View>
            {isInProgress && <ActivityIndicator color={statusCfg.color} size="small" />}
          </View>
        )}

        {/* Download Button (when ready) */}
        {jobStatus === 'ready' && jobData?.download_url && (
          <TouchableOpacity
            style={[styles.downloadBtn, { backgroundColor: colors.successBg, borderColor: colors.success + '50' }]}
            onPress={openDownload}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-whatsapp" size={20} color={colors.success} />
            <Text style={[styles.downloadBtnText, { color: colors.success }]}>WhatsApp ile Gönder</Text>
          </TouchableOpacity>
        )}

        {/* GDPR Info */}
        <View style={[styles.infoBanner, { backgroundColor: colors.primaryGlow, borderColor: colors.primary + '30' }]}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            GDPR ve KVKK kapsamında verilerinizi talep etme hakkına sahipsiniz. Veriler hazırlandığında WhatsApp üzerinden size gönderilir.
          </Text>
        </View>

        {/* What's included */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>DIŞA AKTARILACAK VERİLER</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
          {DATA_CONTENTS.map((item, i) => (
            <View
              key={i}
              style={[
                styles.dataRow,
                i < DATA_CONTENTS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
              ]}
            >
              <Ionicons name={item.icon} size={18} color={colors.primary} style={{ marginRight: 12 }} />
              <Text style={[styles.dataRowText, { color: colors.textSecondary }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Request Button */}
        {canRequest && (
          <TouchableOpacity
            style={[
              styles.requestBtn,
              { backgroundColor: colors.primaryGlow, borderColor: colors.primary + '40' },
              requesting && { opacity: 0.6 },
            ]}
            onPress={requestExport}
            disabled={requesting}
            activeOpacity={0.8}
          >
            {requesting ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name="cloud-download-outline" size={20} color={colors.primary} />
                <Text style={[styles.requestBtnText, { color: colors.primary }]}>
                  {jobStatus === 'ready' ? 'Yeni Talep Oluştur' : 'Veri Talebinde Bulun'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Check status button */}
        {(isInProgress) && (
          <TouchableOpacity
            style={[styles.checkBtn, { borderColor: colors.border }]}
            onPress={() => checkStatus()}
            disabled={checkingStatus}
          >
            {checkingStatus ? (
              <ActivityIndicator color={colors.textMuted} size="small" />
            ) : (
              <Text style={[styles.checkBtnText, { color: colors.textMuted }]}>Durumu Kontrol Et</Text>
            )}
          </TouchableOpacity>
        )}

        <Text style={[styles.note, { color: colors.textGhost }]}>
          Veriler genellikle 24-48 saat içinde hazırlanır. Hazır olduğunda WhatsApp mesajı alırsınız.
        </Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  scroll: { padding: 16 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  statusLabel: { fontSize: 15, fontWeight: '700' },
  statusDate: { fontSize: 12, marginTop: 2 },
  spinIcon: {},
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  downloadBtnText: { fontSize: 16, fontWeight: '700' },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dataRowText: { fontSize: 14 },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  requestBtnText: { fontSize: 16, fontWeight: '700' },
  checkBtn: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  checkBtnText: { fontSize: 14 },
  note: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
