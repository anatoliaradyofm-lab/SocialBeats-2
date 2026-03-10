/**
 * GroupSettingsScreen - Grup adı, fotoğraf, üyeler, admin kontrolleri
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Image,
  ActivityIndicator, Alert, ScrollView, Switch} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { getApiUrl } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const mediaUri = (uri) => {
  if (!uri) return null;
  if (uri.startsWith('http')) return uri;
  const base = (getApiUrl() || '').replace(/\/api\/?$/, '');
  return uri.startsWith('/') ? `${base}${uri}` : `${base}/api/${uri}`;
};

export default function GroupSettingsScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { conversationId, groupName: initialName, groupAvatar: initialAvatar } = route.params || {};
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState(initialName || '');
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar || null);
  const [saving, setSaving] = useState(false);
  const [groupData, setGroupData] = useState(null);
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [onlyAdminsCanSend, setOnlyAdminsCanSend] = useState(false);

  const loadGroup = useCallback(async () => {
    if (!token || !conversationId) return;
    setLoadingGroup(true);
    try {
      const data = await api.get(`/messages/groups/${conversationId}`, token);
      setGroupData(data);
      setName(data.group_name || initialName || '');
      setAvatarUrl(data.group_avatar || initialAvatar);
      setOnlyAdminsCanSend(data.only_admins_can_send || false);
    } catch {
      setName(initialName || '');
      setAvatarUrl(initialAvatar);
    } finally {
      setLoadingGroup(false);
    }
  }, [token, conversationId, initialName, initialAvatar]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  const isAdmin = groupData && (groupData.admins || []).includes(user?.id);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.permissionRequired'), t('common.galleryPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (!uri || !token) return;
    setSaving(true);
    try {
      const url = await api.uploadFile(uri, token, 'avatar', 'image/jpeg');
      setAvatarUrl(url?.url || url?.image_url || url);
    } catch (e) {
      Alert.alert(t('common.error'), e?.data?.detail || t('common.operationFailed'));
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!name.trim() || !token || !conversationId || saving) return;
    setSaving(true);
    try {
      const params = new URLSearchParams({ name: name.trim() });
      if (avatarUrl) params.set('avatar_url', avatarUrl);
      params.set('only_admins_can_send', String(onlyAdminsCanSend));
      await api.put(`/messages/groups/${conversationId}?${params}`, {}, token);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setGroupData((g) => g ? { ...g, group_name: name.trim(), group_avatar: avatarUrl, only_admins_can_send: onlyAdminsCanSend } : null);
    } catch (e) {
      Alert.alert(t('common.error'), e?.data?.detail || t('common.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const toggleOnlyAdmins = async (value) => {
    if (!token || !conversationId || !isAdmin) return;
    setOnlyAdminsCanSend(value);
    try {
      const params = new URLSearchParams({ name: name.trim(), only_admins_can_send: String(value) });
      if (avatarUrl) params.set('avatar_url', avatarUrl);
      await api.put(`/messages/groups/${conversationId}?${params}`, {}, token);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (e) {
      setOnlyAdminsCanSend(!value);
      Alert.alert(t('common.error'), e?.data?.detail || t('common.updateFailed'));
    }
  };

  const makeAdmin = async (memberId) => {
    try {
      await api.post(`/messages/groups/${conversationId}/admins/${memberId}`, {}, token);
      loadGroup();
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (e) {
      Alert.alert(t('common.error'), e?.data?.detail || t('common.operationFailed'));
    }
  };

  const removeAdmin = async (memberId) => {
    try {
      await api.delete(`/messages/groups/${conversationId}/admins/${memberId}`, token);
      loadGroup();
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (e) {
      Alert.alert(t('common.error'), e?.data?.detail || t('common.operationFailed'));
    }
  };

  const removeMember = async (memberId, memberName) => {
    Alert.alert(
      t('groups.removeMember'),
      t('groups.removeMemberConfirm', { name: memberName || '' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('groups.removeMember'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/messages/groups/${conversationId}/members/${memberId}`, token);
              loadGroup();
              queryClient.invalidateQueries({ queryKey: ['conversations'] });
              if (memberId === user?.id) navigation.goBack();
            } catch (e) {
              Alert.alert(t('common.error'), e?.data?.detail || t('common.operationFailed'));
            }
          },
        },
      ]
    );
  };

  const leaveGroup = () => {
    Alert.alert(t('groups.leaveGroup'), t('groups.leaveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('groups.leaveGroup'),
        style: 'destructive',
        onPress: () => removeMember(user?.id, user?.display_name || user?.username),
      },
    ]);
  };

  if (loadingGroup && !groupData) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>{t('groups.settings')}</Text>
        </View>
        <View style={styles.loadingCenter}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('groups.settings')}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.callButtons}>
        <TouchableOpacity
          style={styles.callBtn}
          onPress={() => navigation.navigate('Call', { conversationId, callType: 'voice', isGroup: true, otherUserName: initialName })}
        >
          <Ionicons name="call-outline" size={22} color="#fff" />
          <Text style={styles.callBtnText}>{t('calls.groupCall')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.callBtn}
          onPress={() => navigation.navigate('Call', { conversationId, callType: 'video', isGroup: true, otherUserName: initialName })}
        >
          <Ionicons name="videocam-outline" size={22} color="#fff" />
          <Text style={styles.callBtnText}>{t('calls.groupVideoCall')}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.avatarWrap} onPress={pickImage} disabled={saving}>
        <Image
          source={{ uri: avatarUrl ? mediaUri(avatarUrl) : `https://i.pravatar.cc/200?g=${conversationId}` }}
          style={styles.avatar}
        />
        {saving ? <ActivityIndicator size="small" color="#8B5CF6" style={styles.avatarLoader} /> : (
          <View style={styles.avatarBadge}>
            <Ionicons name="camera" size={20} color="#fff" />
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.field}>
        <Text style={styles.label}>{t('groups.groupName')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('groups.groupNamePlaceholderEdit')}
          placeholderTextColor="#6B7280"
          maxLength={50}
        />
      </View>

      {isAdmin && (
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{t('groups.onlyAdmins')}</Text>
          <Switch value={onlyAdminsCanSend} onValueChange={toggleOnlyAdmins} trackColor={{ true: '#8B5CF6' }} thumbColor="#fff" />
        </View>
      )}

      {groupData?.members?.length > 0 && (
        <View style={styles.membersSection}>
          <Text style={styles.membersSectionTitle}>{t('groups.members')} ({groupData.members.length})</Text>
          {groupData.members.map((member) => (
            <View key={member.id} style={styles.memberRow}>
              <Image source={{ uri: member.avatar_url ? mediaUri(member.avatar_url) : `https://i.pravatar.cc/100?u=${member.id}` }} style={styles.memberAvatar} />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.display_name || member.username || member.id}</Text>
                {member.is_admin && <Text style={styles.adminBadge}>{t('groups.admins')}</Text>}
              </View>
              {isAdmin && member.id !== user?.id && (
                <View style={styles.memberActions}>
                  {member.is_admin ? (
                    <TouchableOpacity style={styles.memberActionBtn} onPress={() => removeAdmin(member.id)}>
                      <Text style={styles.memberActionText}>{t('groups.removeAdmin')}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.memberActionBtn} onPress={() => makeAdmin(member.id)}>
                      <Text style={styles.memberActionText}>{t('groups.addAdmin')}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.memberActionBtn, styles.memberActionDanger]} onPress={() => removeMember(member.id, member.display_name || member.username)}>
                    <Text style={styles.memberActionTextDanger}>{t('groups.removeMember')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.saveBtn, (!name.trim() || saving) && styles.saveBtnDisabled]}
        onPress={save}
        disabled={!name.trim() || saving}
      >
        {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>{t('common.save')}</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.leaveBtn} onPress={leaveGroup}>
        <Text style={styles.leaveBtnText}>{t('groups.leaveGroup')}</Text>
      </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  backBtn: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  avatarWrap: { alignSelf: 'center', marginTop: 32, position: 'relative' },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  avatarLoader: { position: 'absolute', bottom: 8, right: 8 },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center' },
  field: { padding: 20 },
  label: { fontSize: 14, color: '#9CA3AF', marginBottom: 8 },
  input: { backgroundColor: '#1F2937', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: colors.text },
  saveBtn: { marginHorizontal: 20, marginTop: 24, backgroundColor: '#8B5CF6', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  callButtons: { paddingHorizontal: 20, paddingTop: 16, gap: 8 },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1F2937', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 8 },
  callBtnText: { color: colors.text, fontSize: 15, fontWeight: '500' },
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 4, marginTop: 8 },
  toggleLabel: { fontSize: 15, color: colors.text },
  membersSection: { marginTop: 24 },
  membersSectionTitle: { fontSize: 14, color: '#9CA3AF', marginBottom: 12 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937', gap: 12 },
  memberAvatar: { width: 40, height: 40, borderRadius: 20 },
  memberInfo: { flex: 1, minWidth: 0 },
  memberName: { fontSize: 15, color: colors.text, fontWeight: '500' },
  adminBadge: { fontSize: 11, color: colors.accent, marginTop: 2 },
  memberActions: { flexDirection: 'row', gap: 8 },
  memberActionBtn: { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#374151', borderRadius: 8 },
  memberActionText: { fontSize: 12, color: colors.accent },
  memberActionDanger: { backgroundColor: 'rgba(239,68,68,0.2)' },
  memberActionTextDanger: { fontSize: 12, color: colors.error },
  leaveBtn: { marginTop: 24, paddingVertical: 14, alignItems: 'center' },
  leaveBtnText: { color: colors.error, fontSize: 15, fontWeight: '500' },
});
