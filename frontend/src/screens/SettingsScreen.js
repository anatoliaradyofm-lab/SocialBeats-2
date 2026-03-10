import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Modal, Alert, Image, TextInput, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';
import haptic from '../utils/haptics';

function SectionHeader({ title, colors }) {
  return <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>;
}

function SettingsRow({ icon, label, colors, onPress, rightElement, danger, subtitle }) {
  return (
    <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowIcon, { backgroundColor: danger ? 'rgba(239,68,68,0.1)' : colors.surfaceElevated }]}>
        <Ionicons name={icon} size={18} color={danger ? '#EF4444' : BRAND.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: danger ? '#EF4444' : colors.text }]}>{label}</Text>
        {subtitle && <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>{subtitle}</Text>}
      </View>
      {rightElement || <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }) {
  const { t } = useTranslation();
  const { logout, user, token } = useAuth();
  const { colors, themeMode, resolvedTheme, setTheme, accentHSL, setAccentHSL, resetAccent, themeId } = useTheme();
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [tempHSL, setTempHSL] = useState(accentHSL);
  const [logoutModal, setLogoutModal] = useState(false);
  const [switchModal, setSwitchModal] = useState(false);
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [addAccountModal, setAddAccountModal] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [screenTime, setScreenTime] = useState(null);

  useEffect(() => {
    api.get('/user/linked-accounts', token).then(r => setLinkedAccounts(r.accounts || [])).catch(() => {});
    api.get('/user/screen-time?days=1', token).then(r => setScreenTime(r)).catch(() => {});
  }, [token]);

  const handleLogout = () => { setLogoutModal(false); logout(); };

  const handleAddAccount = async () => {
    if (!addUsername.trim() || !addPassword.trim()) return;
    setAddLoading(true);
    try {
      await api.post('/user/linked-accounts', { username: addUsername, password: addPassword }, token);
      const res = await api.get('/user/linked-accounts', token);
      setLinkedAccounts(res.accounts || []);
      setAddAccountModal(false);
      setAddUsername('');
      setAddPassword('');
      Alert.alert(t('common.success'), t('settings.accountLinked'));
    } catch (err) {
      Alert.alert(t('common.error'), err?.data?.detail || t('settings.accountLinkFailed'));
    }
    setAddLoading(false);
  };

  const removeAccount = async (id) => {
    try {
      await api.delete(`/user/linked-accounts/${id}`, token);
      setLinkedAccounts(prev => prev.filter(a => a.id !== id));
    } catch {}
  };

  const todayMinutes = screenTime?.daily_average_minutes || 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('settings.settings')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={[styles.accountCard, { backgroundColor: colors.surfaceElevated }]}>
          <TouchableOpacity style={styles.accountCardTop} onPress={() => setSwitchModal(true)}>
            <View style={[styles.accountAvatar, { backgroundColor: colors.card }]}>
              {user?.avatar_url ? <Image source={{ uri: user.avatar_url }} style={styles.accountAvatar} /> : <Ionicons name="person" size={20} color={BRAND.primaryLight} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.accountCardTitle, { color: colors.text }]}>{user?.display_name || user?.username}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 1 }}>@{user?.username}</Text>
            </View>
            {linkedAccounts.length > 1 && (
              <View style={[styles.switchBadge, { backgroundColor: BRAND.primary + '20' }]}>
                <Text style={{ color: BRAND.primary, fontSize: 10, fontWeight: '600' }}>{t('settings.accountCount', { count: linkedAccounts.length })}</Text>
              </View>
            )}
            <Ionicons name="swap-horizontal" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <SectionHeader title={t('settings.accountSection')} colors={colors} />
        <View style={[styles.sectionCard, { backgroundColor: colors.surfaceElevated }]}>
          <SettingsRow icon="person-outline" label={t('settings.editProfile')} colors={colors} onPress={() => navigation.navigate('ProfileEdit')} />
          <SettingsRow icon="lock-closed-outline" label={t('settings.changePassword')} colors={colors} onPress={() => navigation.navigate('ChangePassword')} />
          <SettingsRow icon="shield-outline" label={t('settings.privacy')} colors={colors} onPress={() => navigation.navigate('Privacy')} />
          <SettingsRow icon="swap-horizontal-outline" label={t('settings.switchAccount')} colors={colors} subtitle={t('settings.accountCountMax', { current: linkedAccounts.length })} onPress={() => setSwitchModal(true)} />
        </View>

        <SectionHeader title={t('settings.appearance')} colors={colors} />
        <View style={[styles.sectionCard, { backgroundColor: colors.surfaceElevated }]}>
          {[
            { id: 'dark', icon: 'moon', label: t('settings.darkTheme') },
            { id: 'light', icon: 'sunny', label: t('settings.lightTheme') },
            { id: 'system', icon: 'phone-portrait-outline', label: t('settings.systemTheme') },
          ].map(opt => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.row, { borderBottomColor: colors.border }]}
              onPress={() => { haptic.selection(); setTheme(opt.id); }}
              activeOpacity={0.7}
            >
              <View style={[styles.rowIcon, { backgroundColor: themeMode === opt.id ? BRAND.primary + '20' : colors.surfaceElevated }]}>
                <Ionicons name={opt.icon} size={18} color={themeMode === opt.id ? BRAND.primary : colors.textMuted} />
              </View>
              <Text style={[styles.rowLabel, { flex: 1, color: colors.text }]}>{opt.label}</Text>
              {themeMode === opt.id && <Ionicons name="checkmark-circle" size={20} color={BRAND.primary} />}
            </TouchableOpacity>
          ))}
          <SettingsRow
            icon="color-palette"
            label={t('settings.colorCustomize')}
            colors={colors}
            subtitle={t('settings.colorCustomizeDesc')}
            onPress={() => { setTempHSL(accentHSL); setShowColorPicker(true); }}
          />
        </View>

        <SectionHeader title={t('settings.preferences')} colors={colors} />
        <View style={[styles.sectionCard, { backgroundColor: colors.surfaceElevated }]}>
          <SettingsRow icon="notifications-outline" label={t('settings.notifications')} colors={colors} onPress={() => navigation.navigate('NotificationSettings')} />
          <SettingsRow icon="language-outline" label={t('settings.language')} colors={colors} onPress={() => navigation.navigate('Language')} />
          <SettingsRow icon="megaphone-outline" label={t('settings.adPreferences')} colors={colors} onPress={() => navigation.navigate('AdSettings')} />
        </View>

        <SectionHeader title={t('settings.musicSection')} colors={colors} />
        <View style={[styles.sectionCard, { backgroundColor: colors.surfaceElevated }]}>
          <SettingsRow icon="options-outline" label={t('settings.equalizer')} colors={colors} onPress={() => navigation.navigate('Equalizer')} />
          <SettingsRow icon="musical-notes-outline" label={t('settings.musicQuality')} colors={colors} onPress={() => navigation.navigate('MusicQuality')} />
          <SettingsRow icon="download-outline" label={t('settings.downloadSettings')} colors={colors} onPress={() => navigation.navigate('DownloadSettings')} />
          <SettingsRow icon="color-palette-outline" label={t('settings.musicTasteTest')} colors={colors} subtitle={t('settings.personalizeRecommendations')} onPress={() => navigation.navigate('MusicTasteTest')} />
        </View>

        <SectionHeader title={t('settings.securitySection')} colors={colors} />
        <View style={[styles.sectionCard, { backgroundColor: colors.surfaceElevated }]}>
          <SettingsRow icon="shield-checkmark-outline" label={t('settings.security')} colors={colors} onPress={() => navigation.navigate('Security')} />
          <SettingsRow icon="cloud-outline" label={t('settings.backup')} colors={colors} onPress={() => navigation.navigate('Backup')} />
          <SettingsRow icon="server-outline" label={t('settings.dataManagement')} colors={colors} onPress={() => navigation.navigate('DataManagement')} />
        </View>

        <SectionHeader title={t('settings.statistics')} colors={colors} />
        <View style={[styles.sectionCard, { backgroundColor: colors.surfaceElevated }]}>
          <SettingsRow icon="bar-chart-outline" label={t('settings.listeningStats')} colors={colors} onPress={() => navigation.navigate('ListeningStats')} />
          <SettingsRow icon="time-outline" label={t('settings.screenTime')} colors={colors} subtitle={todayMinutes > 0 ? t('settings.todayMinutes', { count: todayMinutes }) : undefined} onPress={() => navigation.navigate('ScreenTime')} />
          <SettingsRow icon="calendar-outline" label={t('settings.yearlyWrap')} colors={colors} onPress={() => navigation.navigate('YearlyWrap')} />
          <SettingsRow icon="share-social-outline" label={t('settings.shareProfile')} colors={colors} onPress={() => navigation.navigate('ShareProfile')} />
        </View>

        {user?.is_admin && (
          <>
            <SectionHeader title={t('settings.management')} colors={colors} />
            <View style={[styles.sectionCard, { backgroundColor: colors.surfaceElevated }]}>
              <SettingsRow icon="shield-checkmark" label={t('settings.adminPanel')} colors={colors} subtitle={t('settings.adminPanelDesc')} onPress={() => navigation.navigate('AdminPanel')} />
            </View>
          </>
        )}

        <SectionHeader title={t('settings.infoAndSupport')} colors={colors} />
        <View style={[styles.sectionCard, { backgroundColor: colors.surfaceElevated }]}>
          <SettingsRow icon="help-circle-outline" label={t('settings.help')} colors={colors} onPress={() => navigation.navigate('Help')} />
          <SettingsRow icon="information-circle-outline" label={t('settings.about')} colors={colors} onPress={() => navigation.navigate('About')} />
        </View>

        <SectionHeader title={t('settings.session')} colors={colors} />
        <View style={[styles.sectionCard, { backgroundColor: colors.surfaceElevated }]}>
          <SettingsRow icon="log-out-outline" label={t('auth.logout')} colors={colors} danger onPress={() => setLogoutModal(true)} />
        </View>

        <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 24, fontSize: 12 }}>SocialBeats v1.0.0</Text>
      </ScrollView>

      {/* Logout Modal */}
      <Modal visible={logoutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <View style={styles.modalIconWrap}><Ionicons name="log-out-outline" size={32} color={BRAND.primary} /></View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('auth.logout')}</Text>
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 6 }}>{t('auth.logoutConfirm')}</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.card }]} onPress={() => setLogoutModal(false)}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#EF4444' }]} onPress={handleLogout}>
                <Text style={{ color: '#FFF', fontWeight: '600' }}>{t('auth.logout')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Account Switch Modal */}
      <Modal visible={switchModal} transparent animationType="slide">
        <View style={[styles.modalOverlay, { justifyContent: 'flex-end' }]}>
          <View style={[styles.switchSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 16 }]}>{t('settings.accounts')}</Text>

            {linkedAccounts.map(acc => (
              <View key={acc.id} style={[styles.accountRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.accountAvi, { backgroundColor: colors.surfaceElevated }]}>
                  {acc.avatar_url ? <Image source={{ uri: acc.avatar_url }} style={styles.accountAvi} /> : <Ionicons name="person" size={18} color={BRAND.primaryLight} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '500' }}>@{acc.username}</Text>
                  {acc.is_current && <Text style={{ color: BRAND.primary, fontSize: 11, fontWeight: '600' }}>{t('settings.active')}</Text>}
                </View>
                {acc.is_current ? (
                  <Ionicons name="checkmark-circle" size={20} color={BRAND.primary} />
                ) : (
                  <TouchableOpacity onPress={() => removeAccount(acc.id)}>
                    <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {linkedAccounts.length < 3 && (
              <TouchableOpacity style={[styles.addAccountBtn, { borderColor: colors.border }]} onPress={() => { setSwitchModal(false); setAddAccountModal(true); }}>
                <Ionicons name="add-circle-outline" size={20} color={BRAND.primary} />
                <Text style={{ color: BRAND.primary, fontWeight: '600' }}>{t('settings.addAccount')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 16 }} onPress={() => setSwitchModal(false)}>
              <Text style={{ color: colors.textMuted }}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Color Picker Modal */}
      <Modal visible={showColorPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface, width: '88%' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('settings.colorCustomize')}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4, marginBottom: 16 }}>{t('settings.colorCustomizeModalDesc')}</Text>

            <View style={[styles.colorPreview, { backgroundColor: `hsl(${tempHSL.h}, ${tempHSL.s}%, ${tempHSL.l}%)` }]} />

            <Text style={{ color: colors.textSecondary, fontSize: 12, alignSelf: 'flex-start', marginTop: 12 }}>{t('settings.hue')}: {tempHSL.h}°</Text>
            <Slider style={{ width: '100%', height: 40 }} minimumValue={0} maximumValue={360} step={1} value={tempHSL.h} onValueChange={v => setTempHSL(p => ({ ...p, h: v }))} minimumTrackTintColor={BRAND.primary} maximumTrackTintColor={colors.border} thumbTintColor={`hsl(${tempHSL.h}, ${tempHSL.s}%, ${tempHSL.l}%)`} />

            <Text style={{ color: colors.textSecondary, fontSize: 12, alignSelf: 'flex-start' }}>{t('settings.saturation')}: {tempHSL.s}%</Text>
            <Slider style={{ width: '100%', height: 40 }} minimumValue={10} maximumValue={100} step={1} value={tempHSL.s} onValueChange={v => setTempHSL(p => ({ ...p, s: v }))} minimumTrackTintColor={BRAND.primary} maximumTrackTintColor={colors.border} thumbTintColor={`hsl(${tempHSL.h}, ${tempHSL.s}%, ${tempHSL.l}%)`} />

            <Text style={{ color: colors.textSecondary, fontSize: 12, alignSelf: 'flex-start' }}>{t('settings.lightness')}: {tempHSL.l}%</Text>
            <Slider style={{ width: '100%', height: 40 }} minimumValue={15} maximumValue={85} step={1} value={tempHSL.l} onValueChange={v => setTempHSL(p => ({ ...p, l: v }))} minimumTrackTintColor={BRAND.primary} maximumTrackTintColor={colors.border} thumbTintColor={`hsl(${tempHSL.h}, ${tempHSL.s}%, ${tempHSL.l}%)`} />

            <View style={styles.presetColors}>
              {[
                { h: 262, s: 83, l: 58 }, { h: 188, s: 95, l: 43 }, { h: 330, s: 81, l: 60 },
                { h: 142, s: 71, l: 45 }, { h: 34, s: 100, l: 50 }, { h: 0, s: 84, l: 60 },
                { h: 220, s: 83, l: 53 }, { h: 48, s: 96, l: 53 },
              ].map((c, i) => (
                <TouchableOpacity key={i} style={[styles.presetDot, { backgroundColor: `hsl(${c.h}, ${c.s}%, ${c.l}%)` }]} onPress={() => { haptic.light(); setTempHSL(c); }} />
              ))}
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.card }]} onPress={() => { resetAccent(); setShowColorPicker(false); }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{t('settings.reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.card }]} onPress={() => setShowColorPicker(false)}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: `hsl(${tempHSL.h}, ${tempHSL.s}%, ${tempHSL.l}%)` }]} onPress={() => { setAccentHSL(tempHSL); setShowColorPicker(false); haptic.success(); }}>
                <Text style={{ color: '#FFF', fontWeight: '600' }}>{t('settings.apply')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Account Modal */}
      <Modal visible={addAccountModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface, width: '85%' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('settings.linkAccount')}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 16 }}>{t('settings.linkAccountDesc')}</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.inputBg || colors.surfaceElevated, color: colors.text, borderColor: colors.border }]} placeholder={t('auth.username')} placeholderTextColor={colors.textMuted} value={addUsername} onChangeText={setAddUsername} autoCapitalize="none" />
            <TextInput style={[styles.input, { backgroundColor: colors.inputBg || colors.surfaceElevated, color: colors.text, borderColor: colors.border }]} placeholder={t('auth.password')} placeholderTextColor={colors.textMuted} value={addPassword} onChangeText={setAddPassword} secureTextEntry />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.card }]} onPress={() => { setAddAccountModal(false); setAddUsername(''); setAddPassword(''); }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: BRAND.primary, opacity: addLoading ? 0.6 : 1 }]} onPress={handleAddAccount} disabled={addLoading}>
                {addLoading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={{ color: '#FFF', fontWeight: '600' }}>{t('settings.link')}</Text>}
              </TouchableOpacity>
            </View>
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
  accountCard: { marginHorizontal: 16, marginTop: 8, borderRadius: 16, padding: 16 },
  accountCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  accountCardTitle: { fontSize: 15, fontWeight: '600' },
  switchBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, paddingHorizontal: 16, marginTop: 24, marginBottom: 8 },
  sectionCard: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 0.5, gap: 12 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: 14, fontWeight: '400' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  modalBox: { width: '80%', borderRadius: 20, padding: 24, alignItems: 'center' },
  modalIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(124,58,237,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  switchSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, width: '100%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#999', alignSelf: 'center', marginBottom: 16 },
  accountRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5, gap: 12 },
  accountAvi: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  addAccountBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderWidth: 1, borderRadius: 12, borderStyle: 'dashed', marginTop: 12 },
  input: { width: '100%', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 10 },
  colorPreview: { width: '100%', height: 48, borderRadius: 12 },
  presetColors: { flexDirection: 'row', gap: 10, marginVertical: 12, flexWrap: 'wrap', justifyContent: 'center' },
  presetDot: { width: 32, height: 32, borderRadius: 16 },
});
