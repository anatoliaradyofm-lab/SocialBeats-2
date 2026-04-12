import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Modal, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../services/api';
import { useTranslation } from 'react-i18next';

export default function AccountSettingsScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { t } = useTranslation();

  const [privateProfile, setPrivateProfile]     = useState(false);
  const [msgPermission, setMsgPermission]       = useState('everyone');
  const [msgModalVisible, setMsgModalVisible]   = useState(false);
  const [saving, setSaving]                     = useState(false);
  const [loading, setLoading]                   = useState(true);

  // Load current profile settings
  useEffect(() => {
    api.get('/auth/me', token).then(data => {
      setPrivateProfile(data.is_private ?? false);
      setMsgPermission(data.message_permission ?? 'everyone');
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const saveProfile = useCallback(async (patch) => {
    setSaving(true);
    try {
      await api.put('/user/profile', patch, token);
    } catch {/* silent */} finally {
      setSaving(false);
    }
  }, [token]);

  const handlePrivateToggle = (val) => {
    setPrivateProfile(val);
    saveProfile({ is_private: val });
  };

  const handleMsgPermission = (key) => {
    setMsgPermission(key);
    setMsgModalVisible(false);
    saveProfile({ message_permission: key });
  };

  const MSG_OPTIONS = [
    { key: 'everyone',  label: t('settings.msgEveryone') },
    { key: 'followers', label: t('settings.msgFollowers') },
    { key: 'none',      label: t('settings.msgNone') },
  ];

  const msgLabel = MSG_OPTIONS.find(o => o.key === msgPermission)?.label ?? t('settings.msgEveryone');

  const ALL_ROWS = [
    { key: 'msg',      label: t('settings.messagePermissions'),    icon: 'chatbubble-outline',  color: '#34D399', type: 'modal',  sub: msgLabel },
    { key: 'privacy',  label: t('settings.profilePrivacy'),        icon: 'eye-off-outline',     color: '#A78BFA', type: 'toggle', sub: t('settings.profilePrivacySub') },
    { key: 'blocked',  label: t('settings.blockedUsersRow'),       icon: 'ban-outline',         color: '#F87171', nav: 'BlockedUsers' },
    { key: 'freeze',   label: t('settings.freezeAccount'),         icon: 'snow-outline',        color: '#60A5FA', nav: 'FreezeAccount' },
    { key: 'delete',   label: t('settings.deleteAccountPermanent'),icon: 'trash-outline',       color: '#F87171', nav: 'DeleteAccount', danger: true },
  ];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[s.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>{t('settings.accountSettings')}</Text>
        <View style={{ width: 40 }}>
          {saving && <ActivityIndicator size="small" color={colors.primary} />}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
            {ALL_ROWS.map((row, i) => {
              const isLast = i === ALL_ROWS.length - 1;
              const divider = !isLast && { borderBottomWidth: 1, borderBottomColor: colors.borderLight };

              if (row.type === 'toggle') {
                return (
                  <View key={row.key} style={[s.row, divider]}>
                    <View style={[s.iconWrap, { backgroundColor: row.color + '22' }]}>
                      <Ionicons name={row.icon} size={20} color={row.color} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[s.rowLabel, { color: colors.text }]}>{row.label}</Text>
                      <Text style={[s.rowSub, { color: colors.textMuted }]}>{row.sub}</Text>
                    </View>
                    <Switch
                      value={privateProfile}
                      onValueChange={handlePrivateToggle}
                      trackColor={{ false: colors.surfaceHigh, true: colors.primary + '99' }}
                      thumbColor={privateProfile ? colors.primary : colors.textMuted}
                    />
                  </View>
                );
              }

              if (row.type === 'modal') {
                return (
                  <TouchableOpacity key={row.key} style={[s.row, divider]} onPress={() => setMsgModalVisible(true)} activeOpacity={0.72}>
                    <View style={[s.iconWrap, { backgroundColor: row.color + '22' }]}>
                      <Ionicons name={row.icon} size={20} color={row.color} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[s.rowLabel, { color: colors.text }]}>{row.label}</Text>
                      <Text style={[s.rowSub, { color: colors.textMuted }]}>{row.sub}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textGhost} />
                  </TouchableOpacity>
                );
              }

              return (
                <TouchableOpacity
                  key={row.key}
                  style={[s.row, divider]}
                  onPress={() => navigation.navigate(row.nav)}
                  activeOpacity={0.72}
                >
                  <View style={[s.iconWrap, { backgroundColor: row.color + '22' }]}>
                    <Ionicons name={row.icon} size={20} color={row.color} />
                  </View>
                  <Text style={[s.rowLabel, { color: row.danger ? '#F87171' : colors.text }]}>{row.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textGhost} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Mesaj İzinleri Modal */}
      {Platform.OS === 'web' ? (
        msgModalVisible ? (
          <View style={[StyleSheet.absoluteFill, s.backdrop]} pointerEvents="box-none">
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMsgModalVisible(false)} />
            <View style={[s.sheet, { backgroundColor: '#08060F', borderColor: 'rgba(192,132,252,0.18)' }]} onStartShouldSetResponder={() => true}>
              <LinearGradient colors={['rgba(26,10,46,0.35)', 'rgba(16,8,28,0.10)', 'rgba(10,5,18,0.02)', 'transparent']} locations={[0, 0.38, 0.68, 1]} style={s.sheetGrad} pointerEvents="none" />
              <View style={s.sheetHandle} />
              <Text style={[s.sheetTitle, { color: colors.text }]}>{t('settings.messagePermissions')}</Text>
              <Text style={[s.sheetSub, { color: colors.textMuted }]}>{t('settings.whoCanMessage')}</Text>
              {MSG_OPTIONS.map((opt, i) => {
                const active = msgPermission === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[s.optRow, i < MSG_OPTIONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
                    onPress={() => handleMsgPermission(opt.key)}
                    activeOpacity={0.72}
                  >
                    <Text style={[s.optLabel, { color: active ? colors.primary : colors.text }]}>{opt.label}</Text>
                    {active && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: insets.bottom + 8 }} />
            </View>
          </View>
        ) : null
      ) : (
        <Modal visible={msgModalVisible} transparent animationType="slide" onRequestClose={() => setMsgModalVisible(false)}>
          <Pressable style={s.backdrop} onPress={() => setMsgModalVisible(false)}>
            <Pressable style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.glassBorder }]} onPress={() => {}}>
              <View style={[s.sheetHandle, { backgroundColor: colors.textGhost }]} />
              <Text style={[s.sheetTitle, { color: colors.text }]}>{t('settings.messagePermissions')}</Text>
              <Text style={[s.sheetSub, { color: colors.textMuted }]}>{t('settings.whoCanMessage')}</Text>
              {MSG_OPTIONS.map((opt, i) => {
                const active = msgPermission === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[s.optRow, i < MSG_OPTIONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
                    onPress={() => handleMsgPermission(opt.key)}
                    activeOpacity={0.72}
                  >
                    <Text style={[s.optLabel, { color: active ? colors.primary : colors.text }]}>{opt.label}</Text>
                    {active && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: insets.bottom + 8 }} />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  scroll: { padding: 16, gap: 16 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 16 },
  backdrop: { flex: 1, backgroundColor: 'rgba(8,6,15,0.88)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#08060F', borderTopLeftRadius: 32, borderTopRightRadius: 32, borderTopWidth: 1, borderColor: 'rgba(192,132,252,0.18)', paddingTop: 12 },
  sheetGrad:   { position: 'absolute', top: 0, left: 0, right: 0, height: 110, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(192,132,252,0.30)', alignSelf: 'center', marginBottom: 18 },
  sheetTitle: { fontSize: 17, fontWeight: '800', paddingHorizontal: 20, marginBottom: 4 },
  sheetSub: { fontSize: 13, paddingHorizontal: 20, marginBottom: 14 },
  optRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  optLabel: { fontSize: 16, fontWeight: '600' },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12 },
});
