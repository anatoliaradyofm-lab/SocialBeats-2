import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, FlatList, Modal, TextInput, Switch, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

const TABS = [
  { id: 'overview', label: 'Genel', icon: 'stats-chart' },
  { id: 'users', label: 'Kullanıcılar', icon: 'people' },
  { id: 'content', label: 'İçerik', icon: 'document-text' },
  { id: 'security', label: 'Güvenlik', icon: 'shield-checkmark' },
  { id: 'ip', label: 'IP Listesi', icon: 'globe' },
  { id: 'appeals', label: 'İtirazlar', icon: 'hand-left' },
];

const RESTRICTION_TYPES = [
  { id: 'TEMPORARY_BAN', label: 'Geçici Ban', color: '#F59E0B' },
  { id: 'PERMANENT_BAN', label: 'Kalıcı Ban', color: '#EF4444' },
  { id: 'MUTE', label: 'Sessize Al', color: '#6366F1' },
  { id: 'SHADOW_BAN', label: 'Gölge Ban', color: '#8B5CF6' },
];

export default function AdminPanelScreen({ navigation }) {
  const { token, user } = useAuth();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  
  const [stats, setStats] = useState(null);
  const [apiStatus, setApiStatus] = useState([]);
  const [restrictions, setRestrictions] = useState([]);
  const [modLogs, setModLogs] = useState([]);
  const [ipLists, setIpLists] = useState({ whitelist: [], blacklist: [] });
  const [appeals, setAppeals] = useState([]);
  const [warnings, setWarnings] = useState([]);
  
  const [actionModal, setActionModal] = useState(null);
  const [targetUserId, setTargetUserId] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [selectedType, setSelectedType] = useState('TEMPORARY_BAN');
  const [durationHours, setDurationHours] = useState('24');
  const [newIp, setNewIp] = useState('');

  useEffect(() => {
    if (!user?.is_admin) {
      Alert.alert('Yetkisiz', 'Bu sayfaya erişim yetkiniz yok.');
      navigation.goBack();
      return;
    }
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setRefreshing(true);
    try {
      if (activeTab === 'overview') {
        const [s, a] = await Promise.all([
          api.get('/security/stats', token).catch(() => null),
          api.get('/admin/api-status', token).catch(() => ({ apis: [] })),
        ]);
        setStats(s);
        setApiStatus(a?.apis || []);
      } else if (activeTab === 'content') {
        const r = await api.get('/security/moderation/logs?limit=50', token).catch(() => ({ logs: [] }));
        setModLogs(r?.logs || []);
      } else if (activeTab === 'security') {
        const r = await api.get('/admin/restrictions', token).catch(() => []);
        setRestrictions(Array.isArray(r) ? r : []);
      } else if (activeTab === 'ip') {
        const r = await api.get('/admin/ip-lists', token).catch(() => ({ whitelist: [], blacklist: [] }));
        setIpLists(r);
      } else if (activeTab === 'appeals') {
        const r = await api.get('/admin/appeals', token).catch(() => []);
        setAppeals(Array.isArray(r) ? r : []);
      }
    } catch {}
    setRefreshing(false);
  };

  const handleRestriction = async () => {
    if (!targetUserId.trim() || !actionReason.trim()) {
      Alert.alert('Hata', 'Kullanıcı ID ve sebep gerekli');
      return;
    }
    try {
      const params = new URLSearchParams({
        user_id: targetUserId.trim(),
        restriction_type: selectedType,
        reason: actionReason.trim(),
      });
      if (selectedType === 'TEMPORARY_BAN') params.append('duration_hours', durationHours);
      await api.post(`/admin/restrictions?${params.toString()}`, {}, token);
      Alert.alert('Başarılı', 'Kısıtlama uygulandı');
      setActionModal(null);
      setTargetUserId('');
      setActionReason('');
      loadData();
    } catch {
      Alert.alert('Hata', 'İşlem başarısız');
    }
  };

  const handleWarning = async () => {
    if (!targetUserId.trim() || !actionReason.trim()) {
      Alert.alert('Hata', 'Kullanıcı ID ve sebep gerekli');
      return;
    }
    try {
      await api.post('/users/warnings', { user_id: targetUserId.trim(), reason: actionReason.trim() }, token);
      Alert.alert('Başarılı', 'Uyarı gönderildi');
      setActionModal(null);
      setTargetUserId('');
      setActionReason('');
    } catch {
      Alert.alert('Hata', 'Uyarı gönderilemedi');
    }
  };

  const addToIpList = async (listType) => {
    if (!newIp.trim()) return;
    try {
      await api.post(`/admin/ip-lists?ip=${newIp.trim()}&list_type=${listType}`, {}, token);
      setNewIp('');
      loadData();
    } catch {}
  };

  const removeFromIpList = async (ip, listType) => {
    try {
      await api.delete(`/admin/ip-lists?ip=${ip}&list_type=${listType}`, token);
      loadData();
    } catch {}
  };

  const handleAppealDecision = async (appealId, decision) => {
    try {
      await api.put(`/admin/restrictions/${appealId}`, { appeal_status: decision }, token);
      Alert.alert('Başarılı', decision === 'accepted' ? 'İtiraz kabul edildi' : 'İtiraz reddedildi');
      loadData();
    } catch {
      Alert.alert('Hata', 'İşlem başarısız');
    }
  };

  const StatCard = ({ label, value, icon, color }) => (
    <View style={[styles.statCard, { backgroundColor: colors.surfaceElevated }]}>
      <View style={[styles.statIcon, { backgroundColor: (color || BRAND.primary) + '15' }]}>
        <Ionicons name={icon} size={20} color={color || BRAND.primary} />
      </View>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{value ?? '-'}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 11 }}>{label}</Text>
    </View>
  );

  const renderOverview = () => (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>SİSTEM DURUMU</Text>
      <View style={styles.statsGrid}>
        <StatCard label="Kilitli IP" value={stats?.rate_limiting?.blocked_count || 0} icon="ban" color="#EF4444" />
        <StatCard label="Moderasyon" value={stats?.content_moderation?.total_checks || 0} icon="shield" color="#10B981" />
        <StatCard label="Saldırılar" value={stats?.recent_security_events?.length || 0} icon="warning" color="#F59E0B" />
        <StatCard label="Kuyruk" value={stats?.async_moderation_queue?.queue_size || 0} icon="layers" color="#6366F1" />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>API DURUMU</Text>
      <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
        {apiStatus.map((a, i) => (
          <View key={i} style={[styles.apiRow, i > 0 && { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
            <Ionicons name={a.status === 'ok' ? 'checkmark-circle' : a.status === 'error' ? 'close-circle' : 'ellipse-outline'} size={18} color={a.status === 'ok' ? '#10B981' : a.status === 'error' ? '#EF4444' : '#9CA3AF'} />
            <Text style={{ color: colors.text, fontSize: 13, flex: 1, marginLeft: 10 }}>{a.name}</Text>
            <Text style={{ color: a.status === 'ok' ? '#10B981' : '#EF4444', fontSize: 11, fontWeight: '600' }}>{a.status?.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]} onPress={() => setActionModal('warn')}>
          <Ionicons name="alert-circle" size={16} color="#FFF" />
          <Text style={styles.actionBtnText}>Uyarı Gönder</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#EF4444' }]} onPress={() => setActionModal('restrict')}>
          <Ionicons name="ban" size={16} color="#FFF" />
          <Text style={styles.actionBtnText}>Kısıtlama Uygula</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderContent = () => (
    <FlatList
      data={modLogs}
      keyExtractor={(item, i) => item.id || `${i}`}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
      ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 40 }}>Moderasyon logu yok</Text>}
      renderItem={({ item }) => (
        <View style={[styles.logRow, { backgroundColor: colors.surfaceElevated, borderLeftColor: item.action === 'deleted' ? '#EF4444' : '#F59E0B' }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{item.content_type || 'İçerik'}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>{item.reason || item.action || ''}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 10 }}>{item.created_at?.slice(0, 16)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: item.action === 'deleted' ? '#EF444418' : '#F59E0B18' }]}>
            <Text style={{ color: item.action === 'deleted' ? '#EF4444' : '#F59E0B', fontSize: 10, fontWeight: '600' }}>{item.action || 'Beklemede'}</Text>
          </View>
        </View>
      )}
      contentContainerStyle={{ padding: 16 }}
    />
  );

  const renderSecurity = () => (
    <FlatList
      data={restrictions}
      keyExtractor={(item, i) => item.id || `${i}`}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
      ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 40 }}>Aktif kısıtlama yok</Text>}
      renderItem={({ item }) => {
        const type = RESTRICTION_TYPES.find(t => t.id === item.restriction_type);
        return (
          <View style={[styles.restrictionRow, { backgroundColor: colors.surfaceElevated }]}>
            <View style={[styles.typeBadge, { backgroundColor: (type?.color || '#EF4444') + '18' }]}>
              <Text style={{ color: type?.color || '#EF4444', fontSize: 10, fontWeight: '700' }}>{type?.label || item.restriction_type}</Text>
            </View>
            <Text style={{ color: colors.text, fontSize: 13, marginTop: 6 }}>@{item.user?.username || item.user_id}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>{item.reason}</Text>
            {item.expires_at && <Text style={{ color: colors.textMuted, fontSize: 10 }}>Süre: {item.expires_at.slice(0, 16)}</Text>}
          </View>
        );
      }}
      contentContainerStyle={{ padding: 16 }}
    />
  );

  const renderIpLists = () => (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={[styles.inputRow, { borderColor: colors.border }]}>
        <TextInput
          style={[styles.ipInput, { color: colors.text }]}
          placeholder="IP Adresi"
          placeholderTextColor={colors.textMuted}
          value={newIp}
          onChangeText={setNewIp}
        />
        <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#10B981' }]} onPress={() => addToIpList('whitelist')}>
          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600' }}>Beyaz Liste</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#EF4444' }]} onPress={() => addToIpList('blacklist')}>
          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600' }}>Kara Liste</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>BEYAZ LİSTE</Text>
      {(ipLists.whitelist || []).map((ip, i) => (
        <View key={`w-${i}`} style={[styles.ipRow, { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={{ color: colors.text, flex: 1, marginLeft: 8, fontSize: 13 }}>{typeof ip === 'string' ? ip : ip.ip}</Text>
          <TouchableOpacity onPress={() => removeFromIpList(typeof ip === 'string' ? ip : ip.ip, 'whitelist')}>
            <Ionicons name="close" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      ))}

      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>KARA LİSTE</Text>
      {(ipLists.blacklist || []).map((ip, i) => (
        <View key={`b-${i}`} style={[styles.ipRow, { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons name="ban" size={16} color="#EF4444" />
          <Text style={{ color: colors.text, flex: 1, marginLeft: 8, fontSize: 13 }}>{typeof ip === 'string' ? ip : ip.ip}</Text>
          <TouchableOpacity onPress={() => removeFromIpList(typeof ip === 'string' ? ip : ip.ip, 'blacklist')}>
            <Ionicons name="close" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );

  const renderAppeals = () => (
    <FlatList
      data={appeals}
      keyExtractor={(item, i) => item.id || `${i}`}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
      ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 40 }}>İtiraz yok</Text>}
      renderItem={({ item }) => (
        <View style={[styles.appealRow, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Kullanıcı: {item.user_id?.slice(0, 8)}...</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.reason}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 10 }}>{item.created_at?.slice(0, 16)}</Text>
          {item.status === 'pending' && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#10B981' }]} onPress={() => handleAppealDecision(item.id, 'accepted')}>
                <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 11 }}>Kabul Et</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleAppealDecision(item.id, 'rejected')}>
                <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 11 }}>Reddet</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      contentContainerStyle={{ padding: 16 }}
    />
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview();
      case 'content': return renderContent();
      case 'security': return renderSecurity();
      case 'ip': return renderIpLists();
      case 'appeals': return renderAppeals();
      default: return renderOverview();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Admin Paneli</Text>
        <TouchableOpacity onPress={loadData}>
          <Ionicons name="refresh" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44 }} contentContainerStyle={{ paddingHorizontal: 12, gap: 4 }}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && { backgroundColor: BRAND.primary + '20' }]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons name={tab.icon} size={14} color={activeTab === tab.id ? BRAND.primary : colors.textMuted} />
            <Text style={{ color: activeTab === tab.id ? BRAND.primary : colors.textMuted, fontSize: 12, fontWeight: '500' }}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{ flex: 1 }}>{renderTabContent()}</View>

      {/* Action Modal (Warn / Restrict) */}
      <Modal visible={!!actionModal} transparent animationType="slide" onRequestClose={() => setActionModal(null)}>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                {actionModal === 'warn' ? 'Uyarı Gönder' : 'Kısıtlama Uygula'}
              </Text>
              <TouchableOpacity onPress={() => setActionModal(null)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
              placeholder="Kullanıcı ID"
              placeholderTextColor={colors.textMuted}
              value={targetUserId}
              onChangeText={setTargetUserId}
            />

            {actionModal === 'restrict' && (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {RESTRICTION_TYPES.map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.typeChip, { backgroundColor: selectedType === t.id ? t.color + '25' : colors.surfaceElevated, borderColor: selectedType === t.id ? t.color : colors.border }]}
                      onPress={() => setSelectedType(t.id)}
                    >
                      <Text style={{ color: selectedType === t.id ? t.color : colors.textMuted, fontSize: 11, fontWeight: '600' }}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {selectedType === 'TEMPORARY_BAN' && (
                  <TextInput
                    style={[styles.modalInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
                    placeholder="Süre (saat)"
                    placeholderTextColor={colors.textMuted}
                    value={durationHours}
                    onChangeText={setDurationHours}
                    keyboardType="number-pad"
                  />
                )}
              </>
            )}

            <TextInput
              style={[styles.modalInput, styles.multilineInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}
              placeholder="Sebep"
              placeholderTextColor={colors.textMuted}
              value={actionReason}
              onChangeText={setActionReason}
              multiline
            />

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: actionModal === 'warn' ? '#F59E0B' : '#EF4444' }]}
              onPress={actionModal === 'warn' ? handleWarning : handleRestriction}
            >
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>
                {actionModal === 'warn' ? 'Uyarı Gönder' : 'Kısıtlama Uygula'}
              </Text>
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
  headerTitle: { fontSize: 18, fontWeight: '700' },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginTop: 12, marginBottom: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: { flex: 1, minWidth: '45%', borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  statIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  card: { borderRadius: 14, padding: 12 },
  apiRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12 },
  actionBtnText: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  logRow: { borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 3, flexDirection: 'row', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  restrictionRow: { borderRadius: 12, padding: 12, marginBottom: 8 },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  ipRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, borderWidth: 1, borderRadius: 12, paddingLeft: 12, paddingRight: 4, paddingVertical: 4 },
  ipInput: { flex: 1, fontSize: 14 },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  appealRow: { borderRadius: 12, padding: 12, marginBottom: 8 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 48, marginBottom: 12, fontSize: 14 },
  multilineInput: { height: 80, textAlignVertical: 'top', paddingTop: 12 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  submitBtn: { height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
});
