import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, RefreshControl, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';
import cacheService from '../services/cacheService';

const fmtSize = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

function Section({ title, icon, children, colors }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={18} color={BRAND.primary} />
        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function ActionRow({ icon, label, sublabel, color, onPress, loading, colors, danger }) {
  return (
    <TouchableOpacity
      style={[styles.actionRow, { borderBottomColor: colors.border }]}
      onPress={onPress}
      disabled={loading}
    >
      <View style={[styles.actionIcon, { backgroundColor: `${color || BRAND.primary}12` }]}>
        {loading ? <ActivityIndicator size="small" color={color || BRAND.primary} /> :
          <Ionicons name={icon} size={18} color={color || BRAND.primary} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionLabel, { color: danger ? '#EF4444' : colors.text }]}>{label}</Text>
        {sublabel ? <Text style={{ color: colors.textMuted, fontSize: 11 }}>{sublabel}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function DataManagementScreen({ navigation }) {
  const { token, user } = useAuth();
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const [localSize, setLocalSize] = useState(0);
  const [breakdown, setBreakdown] = useState(null);
  const [serverStorage, setServerStorage] = useState(null);
  const [backups, setBackups] = useState([]);
  const [backupSettings, setBackupSettings] = useState(null);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [showCompare, setShowCompare] = useState(null);
  const [compareData, setCompareData] = useState(null);
  const [showMerge, setShowMerge] = useState(false);
  const [mergeId, setMergeId] = useState('');
  const [mergePass, setMergePass] = useState('');
  const [merging, setMerging] = useState(false);

  const fetchLocal = useCallback(async () => {
    const size = await cacheService.getStorageSize();
    setLocalSize(size);
    const bd = await cacheService.getStorageBreakdown();
    setBreakdown(bd);
  }, []);

  const fetchServer = useCallback(async () => {
    try {
      const res = await api.get('/backup/storage-usage', token);
      setServerStorage(res);
    } catch { setServerStorage(null); }
  }, [token]);

  const fetchBackups = useCallback(async () => {
    try {
      const res = await api.get('/backup/list', token);
      setBackups(res.backups || []);
    } catch { setBackups([]); }
  }, [token]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get('/backup/settings', token);
      setBackupSettings(res);
    } catch { setBackupSettings(null); }
  }, [token]);

  useEffect(() => {
    fetchLocal();
    fetchServer();
    fetchBackups();
    fetchSettings();
    cacheService.autoCleanIfNeeded();
  }, [fetchLocal, fetchServer, fetchBackups, fetchSettings]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchLocal(), fetchServer(), fetchBackups(), fetchSettings()]);
    setRefreshing(false);
  };

  const handleClearCache = () => {
    Alert.alert('Önbelleği Temizle', 'Tüm önbellek verileri silinecek.', [
      { text: 'İptal' },
      { text: 'Temizle', style: 'destructive', onPress: async () => {
        setClearing(true);
        await cacheService.clear();
        await fetchLocal();
        setClearing(false);
        Alert.alert('Temizlendi', 'Önbellek başarıyla silindi.');
      }},
    ]);
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const res = await api.post('/backup/create', {}, token);
      Alert.alert('Yedek Oluşturuldu', `${res.label}\nBoyut: ${fmtSize(res.size_bytes)}`);
      fetchBackups();
    } catch { Alert.alert('Hata', 'Yedek oluşturulamadı.'); }
    setCreating(false);
  };

  const handleRestore = (backup) => {
    Alert.alert(
      'Geri Yükleme',
      `"${backup.label}" yedeğini geri yüklemek istiyor musunuz?\n\nTüm verileri mi yoksa belirli kategorileri mi geri yüklemek istersiniz?`,
      [
        { text: 'İptal' },
        { text: 'Seçici Geri Yükle', onPress: () => selectiveRestore(backup) },
        { text: 'Tümünü Geri Yükle', style: 'destructive', onPress: () => doRestore(backup.id) },
      ]
    );
  };

  const selectiveRestore = (backup) => {
    const cols = (backup.collections || []).filter(c => c !== 'profile');
    if (!cols.length) { doRestore(backup.id); return; }
    Alert.alert(
      'Kategori Seçin',
      `Mevcut kategoriler:\n${cols.join(', ')}\n\nHangi kategorileri geri yüklemek istiyorsunuz? (virgülle ayırın)`,
      [
        { text: 'İptal' },
        { text: 'Tümü', onPress: () => doRestore(backup.id) },
      ]
    );
  };

  const doRestore = async (backupId, collections) => {
    setRestoring(backupId);
    try {
      const url = collections
        ? `/backup/${backupId}/restore?collections=${collections}`
        : `/backup/${backupId}/restore`;
      const res = await api.post(url, {}, token);
      const summary = Object.entries(res.restored || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
      Alert.alert('Geri Yükleme Tamamlandı', summary || 'Veri geri yüklendi.');
    } catch { Alert.alert('Hata', 'Geri yükleme başarısız.'); }
    setRestoring(null);
  };

  const handleCompare = async (backup) => {
    setShowCompare(backup.id);
    try {
      const res = await api.get(`/backup/${backup.id}/compare`, token);
      setCompareData(res);
    } catch {
      Alert.alert('Hata', 'Karşılaştırma yapılamadı.');
      setShowCompare(null);
    }
  };

  const handleDeleteBackup = (backup) => {
    Alert.alert('Yedeği Sil', `"${backup.label}" silinecek.`, [
      { text: 'İptal' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/backup/${backup.id}`, token);
          fetchBackups();
        } catch { Alert.alert('Hata', 'Silinemedi.'); }
      }},
    ]);
  };

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const res = await api.get(`/backup/export/gdpr?fmt=${format}`, token);
      Alert.alert(
        'Dışa Aktarma Hazır',
        `Format: ${format.toUpperCase()}\nBoyut: ${fmtSize(res.size_bytes)}\n\n7 gün içinde indirilebilir.`
      );
    } catch { Alert.alert('Bilgi', 'Dışa aktarma isteği alındı.'); }
    setExporting(false);
  };

  const handleMerge = async () => {
    if (!mergeId || !mergePass) { Alert.alert('Hata', 'Hesap ID ve şifre gerekli.'); return; }
    setMerging(true);
    try {
      const res = await api.post(`/backup/merge-accounts?source_user_id=${mergeId}&password=${encodeURIComponent(mergePass)}`, {}, token);
      const summary = Object.entries(res.migrated || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
      Alert.alert('Birleştirme Tamamlandı', summary || 'Hesaplar birleştirildi.');
      setShowMerge(false);
      setMergeId('');
      setMergePass('');
    } catch (e) { Alert.alert('Hata', 'Birleştirme başarısız. Şifreyi kontrol edin.'); }
    setMerging(false);
  };

  const handleClearHistory = (type, endpoint) => {
    Alert.alert(`${type} Temizle`, `Tüm ${type.toLowerCase()} silinecek.`, [
      { text: 'İptal' },
      { text: 'Temizle', style: 'destructive', onPress: () => api.delete(endpoint, token).catch(() => {}) },
    ]);
  };

  const deleteAccount = () => {
    Alert.alert('Adım 1/3 - Hesap Silme', 'E-posta adresinize bir doğrulama kodu gönderilecek.', [
      { text: 'İptal' },
      { text: 'Kodu Gönder', style: 'destructive', onPress: async () => {
        try {
          await api.post('/account/delete/request', {}, token);
          Alert.prompt('Adım 2/3 - Kodu Doğrula', 'E-postanıza gelen 6 haneli kodu girin.', [
            { text: 'İptal' },
            { text: 'Doğrula', onPress: async (code) => {
              if (!code || code.length < 6) { Alert.alert('Hata', 'Geçerli bir kod girin.'); return; }
              try {
                await api.post(`/account/delete/verify-code?code=${code}`, {}, token);
                Alert.prompt('Adım 3/3 - Son Onay', 'Şifrenizi girin.', [
          { text: 'Vazgeç' },
                  { text: 'Kalıcı Olarak Sil', style: 'destructive', onPress: async (pw) => {
                    if (!pw) return;
                    try {
                      await api.delete(`/account/delete?password=${encodeURIComponent(pw)}&code=${code}`, token);
                      Alert.alert('Silindi', 'Hesabınız kalıcı olarak silindi.');
                    } catch { Alert.alert('Hata', 'Şifre yanlış.'); }
                  }},
                ], 'secure-text');
              } catch { Alert.alert('Hata', 'Geçersiz kod.'); }
            }},
          ], 'plain-text');
        } catch { Alert.alert('Hata', 'İstek gönderilemedi.'); }
      }},
    ]);
  };

  const toggleAutoBackup = async () => {
    const current = backupSettings?.auto_backup_enabled ?? true;
    try {
      await api.put('/backup/settings', { auto_backup_enabled: !current }, token);
      fetchSettings();
    } catch {}
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Yedekleme & Veri Yönetimi</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />}
      >
        {/* ====== STORAGE ====== */}
        <Section title="Depolama Kullanımı" icon="pie-chart" colors={colors}>
          <View style={styles.storageHero}>
            <Ionicons name="server" size={28} color={BRAND.primary} />
            <Text style={[styles.storageTotal, { color: colors.text }]}>{fmtSize(localSize)}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>Cihaz Önbelleği</Text>
          </View>

          {breakdown?.categories && (
            <View style={{ marginTop: 12, gap: 6 }}>
              {Object.entries(breakdown.categories).map(([key, val]) => (
                val.count > 0 ? (
                  <View key={key} style={styles.breakdownRow}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, flex: 1, textTransform: 'capitalize' }}>{key}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>{val.count} adet</Text>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600', width: 60, textAlign: 'right' }}>{fmtSize(val.size)}</Text>
                  </View>
                ) : null
              ))}
            </View>
          )}

          {serverStorage && (
            <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: colors.border }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 6 }}>Sunucu Kullanımı</Text>
              <View style={styles.storageHero}>
                <Ionicons name="cloud" size={22} color={BRAND.accent} />
                <Text style={[styles.storageTotal, { color: colors.text, fontSize: 20 }]}>{serverStorage.total_display}</Text>
              </View>
              {Object.entries(serverStorage.categories || {}).map(([key, val]) => (
                val.count > 0 ? (
                  <View key={key} style={styles.breakdownRow}>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, flex: 1 }}>{key.replace(/_/g, ' ')}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>{val.count}</Text>
                    <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600', width: 55, textAlign: 'right' }}>{val.size_display}</Text>
                  </View>
                ) : null
              ))}
            </View>
          )}

          <ActionRow icon="trash-outline" label="Önbelleği Temizle" sublabel="Tek tıkla tüm önbelleği sil" color={BRAND.primary} onPress={handleClearCache} loading={clearing} colors={colors} />
        </Section>

        {/* ====== BACKUPS ====== */}
        <Section title="Yedekleme" icon="cloud-upload" colors={colors}>
          <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }}>Otomatik Yedekleme</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>Günlük otomatik yedekleme (03:00 UTC)</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, { backgroundColor: backupSettings?.auto_backup_enabled ? BRAND.primary : colors.border }]}
              onPress={toggleAutoBackup}
            >
              <View style={[styles.toggleDot, { transform: [{ translateX: backupSettings?.auto_backup_enabled ? 18 : 2 }] }]} />
            </TouchableOpacity>
          </View>

          <ActionRow icon="add-circle" label="Manuel Yedek Oluştur" sublabel="Tüm verilerinin anlık yedeği" color="#10B981" onPress={handleCreateBackup} loading={creating} colors={colors} />

          {backups.length > 0 && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 6 }}>{backups.length} yedek mevcut</Text>
              {backups.slice(0, 5).map(b => (
                <View key={b.id} style={[styles.backupItem, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500' }}>{b.label}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                      {new Date(b.created_at).toLocaleDateString('tr-TR')} • {fmtSize(b.size_bytes)} • {b.type === 'auto' ? 'Otomatik' : 'Manuel'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity style={styles.miniBtn} onPress={() => handleRestore(b)}>
                      <Ionicons name="refresh" size={16} color="#10B981" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.miniBtn} onPress={() => handleCompare(b)}>
                      <Ionicons name="git-compare" size={16} color={BRAND.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.miniBtn} onPress={() => handleDeleteBackup(b)}>
                      <Ionicons name="trash" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
                </View>
              ))}
            </View>
          )}
        </Section>

        {/* ====== EXPORT ====== */}
        <Section title="Veri Dışa Aktarma (GDPR)" icon="download" colors={colors}>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10, lineHeight: 18 }}>
            Tüm verilerinizin bir kopyasını JSON veya CSV formatında indirebilirsiniz. GDPR/KVKK uyumludur.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.exportBtn, { backgroundColor: BRAND.primary }]}
              onPress={() => handleExport('json')}
              disabled={exporting}
            >
              {exporting ? <ActivityIndicator size="small" color="#FFF" /> :
                <><Ionicons name="code-slash" size={16} color="#FFF" /><Text style={styles.exportBtnText}>JSON</Text></>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportBtn, { backgroundColor: BRAND.accent }]}
              onPress={() => handleExport('csv')}
              disabled={exporting}
            >
              <Ionicons name="grid" size={16} color="#FFF" />
              <Text style={styles.exportBtnText}>CSV</Text>
          </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportBtn, { backgroundColor: '#F59E0B' }]}
              onPress={() => handleExport('zip')}
              disabled={exporting}
            >
              <Ionicons name="archive" size={16} color="#FFF" />
              <Text style={styles.exportBtnText}>ZIP</Text>
          </TouchableOpacity>
        </View>
        </Section>

        {/* ====== CLOUD BACKUP (opsiyonel) ====== */}
        <Section title="Bulut Yedekleme" icon="cloud" colors={colors}>
          <ActionRow
            icon="logo-google"
            label="Google Drive Yedekleme"
            sublabel={backupSettings?.google_drive_enabled ? 'Aktif' : 'Henüz bağlı değil'}
            color="#4285F4"
            onPress={() => Alert.alert('Google Drive', 'Google Drive entegrasyonu için uygulamayı Google hesabınıza bağlayın.\n\nAyarlar > Bağlı Hesaplar bölümünden bağlantı kurabilirsiniz.')}
            colors={colors}
          />
          <ActionRow
            icon="logo-apple"
            label="iCloud Yedekleme"
            sublabel={backupSettings?.icloud_enabled ? 'Aktif' : 'Henüz bağlı değil'}
            color="#333"
            onPress={() => Alert.alert('iCloud', 'iCloud yedekleme iOS cihazlarda otomatik olarak çalışır.\n\nCihaz Ayarları > iCloud > SocialBeats bölümünden etkinleştirin.')}
            colors={colors}
          />
        </Section>

        {/* ====== MERGE ====== */}
        <Section title="Hesap Birleştirme" icon="git-merge" colors={colors}>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10, lineHeight: 18 }}>
            Eski hesabınızdaki verileri bu hesaba taşıyabilirsiniz. Kaynak hesabın şifresi gereklidir.
          </Text>
          <ActionRow
            icon="people"
            label="Hesapları Birleştir"
            sublabel="Eski hesaptan veri taşı"
            color={BRAND.accent}
            onPress={() => setShowMerge(true)}
            colors={colors}
          />
        </Section>

        {/* ====== HISTORY CLEAR ====== */}
        <Section title="Geçmiş Temizleme" icon="time" colors={colors}>
          <ActionRow icon="musical-notes" label="Dinleme Geçmişi" sublabel="Tüm dinleme kaydını sil" color="#F59E0B" onPress={() => handleClearHistory('Dinleme Geçmişi', '/library/recent')} colors={colors} />
          <ActionRow
            icon="search"
            label="Arama Geçmişi"
            sublabel="Tüm aramaları temizle"
            color={colors.textSecondary}
            onPress={async () => {
              const AS = require('@react-native-async-storage/async-storage').default;
              await AS.removeItem('@search_history');
            Alert.alert('Temizlendi');
            }}
            colors={colors}
          />
        </Section>

        {/* ====== DANGER ZONE ====== */}
        <View style={[styles.card, { backgroundColor: 'rgba(239,68,68,0.06)' }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="warning" size={18} color="#EF4444" />
          <Text style={[styles.cardTitle, { color: '#EF4444' }]}>Tehlikeli Bölge</Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 10, lineHeight: 18 }}>
            Hesabınızı sildiğinizde tüm verileriniz kalıcı olarak silinir. Bu işlem geri alınamaz.
          </Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={deleteAccount}>
            <Ionicons name="skull" size={18} color="#FFF" />
            <Text style={{ color: '#FFF', fontWeight: '700' }}>Hesabımı Sil</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Compare Modal */}
      <Modal visible={!!showCompare} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Yedek Karşılaştırma</Text>
              <TouchableOpacity onPress={() => { setShowCompare(null); setCompareData(null); }}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            {compareData ? (
              <ScrollView style={{ maxHeight: 400 }}>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 10 }}>
                  Yedek tarihi: {new Date(compareData.backup_date).toLocaleDateString('tr-TR')}
                </Text>
                {Object.entries(compareData.diff || {}).map(([key, val]) => (
                  <View key={key} style={[styles.compareRow, { borderBottomColor: colors.border }]}>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '500', flex: 1 }}>{key}</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>Şimdi: {val.current_count} | Yedek: {val.backup_count}</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                        {val.added_since_backup > 0 && <Text style={{ color: '#10B981', fontSize: 11, fontWeight: '600' }}>+{val.added_since_backup} yeni</Text>}
                        {val.removed_since_backup > 0 && <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '600' }}>-{val.removed_since_backup} silinen</Text>}
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : <ActivityIndicator size="large" color={BRAND.primary} style={{ marginTop: 40 }} />}
          </View>
        </View>
      </Modal>

      {/* Merge Modal */}
      <Modal visible={showMerge} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Hesap Birleştirme</Text>
              <TouchableOpacity onPress={() => setShowMerge(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 14, lineHeight: 18 }}>
              Kaynak hesaptaki gönderiler, mesajlar, çalma listeleri ve takipçiler bu hesaba taşınacak. Kaynak hesap devre dışı bırakılacak.
            </Text>
            <TextInput
              placeholder="Kaynak Hesap ID"
              placeholderTextColor={colors.textMuted}
              value={mergeId}
              onChangeText={setMergeId}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
            />
            <TextInput
              placeholder="Kaynak Hesap Şifresi"
              placeholderTextColor={colors.textMuted}
              value={mergePass}
              onChangeText={setMergePass}
              secureTextEntry
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
            />
            <TouchableOpacity
              style={[styles.mergeBtn, { backgroundColor: BRAND.primary, opacity: merging ? 0.6 : 1 }]}
              onPress={handleMerge}
              disabled={merging}
            >
              {merging ? <ActivityIndicator color="#FFF" /> :
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Birleştir</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  card: { borderRadius: 16, padding: 16, marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  storageHero: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  storageTotal: { fontSize: 26, fontWeight: '900' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 0.5 },
  actionIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { fontSize: 14, fontWeight: '500' },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5 },
  toggle: { width: 44, height: 26, borderRadius: 13, justifyContent: 'center' },
  toggleDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  backupItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5 },
  miniBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(150,150,150,0.1)', justifyContent: 'center', alignItems: 'center' },
  exportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12 },
  exportBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: '#EF4444' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  compareRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 10 },
  mergeBtn: { alignItems: 'center', paddingVertical: 14, borderRadius: 12, marginTop: 4 },
});
