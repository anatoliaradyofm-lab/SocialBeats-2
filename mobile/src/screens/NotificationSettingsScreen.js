/**
 * NotificationSettingsScreen - Bildirim tercihleri
 * 11.3: Push her tip için ayrı, ses seçimi (4), DND, günlük hatırlatma,
 * haftalık özet 20:00, email, reklam bildirimleri
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const getSoundName = (id, t) => {
  const map = { default: 'default', chime: 'chime', pop: 'pop', ding: 'ding' };
  return t(`notificationSettings.${map[id] || 'default'}`);
};

const DND_STARTS = ['20:00', '21:00', '22:00', '23:00', '00:00'];
const DND_ENDS = ['06:00', '07:00', '08:00', '09:00'];

export default function NotificationSettingsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [settings, setSettings] = useState(null);
  const [dnd, setDnd] = useState({ enabled: false, start_time: '22:00', end_time: '08:00' });
  const [soundId, setSoundId] = useState('default');
  const [sounds, setSounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [soundModalVisible, setSoundModalVisible] = useState(false);
  const [dndStartModal, setDndStartModal] = useState(false);
  const [dndEndModal, setDndEndModal] = useState(false);

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [s, d, soundRes] = await Promise.all([
        api.get('/notifications/settings', token),
        api.get('/notifications/dnd', token),
        api.get('/notifications/sounds', token),
      ]);
      setSettings(s || {});
      setDnd({
        enabled: d?.enabled ?? false,
        start_time: d?.start_time ?? '22:00',
        end_time: d?.end_time ?? '08:00',
      });
      const userSettings = await api.get('/user/settings', token).catch(() => ({}));
      setSoundId(userSettings?.notification_sound || 'default');
      setSounds(soundRes?.sounds || [{ id: 'default' }, { id: 'chime' }, { id: 'pop' }, { id: 'ding' }]);
    } catch {
      setSettings({
        push_enabled: true,
        email_enabled: true,
        likes_notifications: true,
        comments_notifications: true,
        follows_notifications: true,
        messages_notifications: true,
        mentions_notifications: true,
        story_notifications: true,
        music_notifications: true,
        system_notifications: true,
        ad_notifications: false,
        weekly_summary_enabled: false,
        daily_reminder_enabled: false,
      });
      setSounds([{ id: 'default' }, { id: 'chime' }, { id: 'pop' }, { id: 'ding' }]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const updateSetting = async (key, value) => {
    try {
      await api.put('/notifications/settings', { [key]: value }, token);
      setSettings((s) => ({ ...s, [key]: value }));
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('common.updateFailed'));
    }
  };

  const updateDnd = async (updates) => {
    const next = { ...dnd, ...updates };
    try {
      const q = new URLSearchParams({
        enabled: String(next.enabled),
        start_time: next.start_time,
        end_time: next.end_time,
      }).toString();
      await api.put(`/notifications/dnd?${q}`, {}, token);
      setDnd(next);
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('common.updateFailed'));
    }
  };

  const updateSound = async (id) => {
    try {
      await api.put(`/notifications/sound?sound_id=${encodeURIComponent(id)}`, {}, token).catch(() => null);
      setSoundId(id);
      setSoundModalVisible(false);
    } catch {
      setSoundId(id);
      setSoundModalVisible(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{t('notificationSettings.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('notificationSettings.title')}</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </View>
    );
  }

  const s = settings || {};

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('notificationSettings.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bildirim Ayarları</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('notificationSettings.general')}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{t('notificationSettings.pushNotifications')}</Text>
            <Switch
              value={s.push_enabled ?? true}
              onValueChange={(v) => updateSetting('push_enabled', v)}
              trackColor={{ false: '#374151', true: '#8B5CF6' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('notificationSettings.emailNotifications')}</Text>
            <Switch
              value={s.email_enabled ?? true}
              onValueChange={(v) => updateSetting('email_enabled', v)}
              trackColor={{ false: '#374151', true: '#8B5CF6' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('notificationSettings.notificationTypes')}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{t('notificationSettings.likesNotifications')}</Text>
            <Switch
              value={s.likes_notifications ?? true}
              onValueChange={(v) => updateSetting('likes_notifications', v)}
              trackColor={{ false: '#374151', true: '#8B5CF6' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('notificationSettings.commentsNotifications')}</Text>
            <Switch
              value={s.comments_notifications ?? true}
              onValueChange={(v) => updateSetting('comments_notifications', v)}
              trackColor={{ false: '#374151', true: '#8B5CF6' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('notificationSettings.followsNotifications')}</Text>
            <Switch
              value={s.follows_notifications ?? true}
              onValueChange={(v) => updateSetting('follows_notifications', v)}
              trackColor={{ false: '#374151', true: '#8B5CF6' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('notificationSettings.messagesNotifications')}</Text>
            <Switch
              value={s.messages_notifications ?? true}
              onValueChange={(v) => updateSetting('messages_notifications', v)}
              trackColor={{ false: '#374151', true: '#8B5CF6' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('notificationSettings.mentionsNotifications')}</Text>
            <Switch
              value={s.mentions_notifications ?? true}
              onValueChange={(v) => updateSetting('mentions_notifications', v)}
              trackColor={{ false: '#374151', true: '#8B5CF6' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('notificationSettings.storyNotifications')}</Text>
            <Switch
              value={s.story_notifications ?? true}
              onValueChange={(v) => updateSetting('story_notifications', v)}
              trackColor={{ false: '#374151', true: '#8B5CF6' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('notificationSettings.musicNotifications')}</Text>
            <Switch
              value={s.music_notifications ?? true}
              onValueChange={(v) => updateSetting('music_notifications', v)}
              trackColor={{ false: '#374151', true: '#8B5CF6' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t('notificationSettings.weeklySummary')}</Text>
            <Switch
              value={s.weekly_summary_enabled ?? false}
              onValueChange={(v) => updateSetting('weekly_summary_enabled', v)}
              trackColor={{ false: '#374151', true: '#8B5CF6' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('notificationSettings.scheduled')}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{t('notificationSettings.dailyReminder')}</Text>
            <Switch
              value={s.daily_reminder_enabled ?? false}
              onValueChange={(v) => updateSetting('daily_reminder_enabled', v)}
              trackColor={{ false: '#374151', true: '#8B5CF6' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('notificationSettings.dnd')}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{t('notificationSettings.dnd')}</Text>
            <Switch
              value={dnd.enabled}
              onValueChange={(v) => updateDnd({ enabled: v })}
              trackColor={{ false: '#374151', true: '#8B5CF6' }}
              thumbColor="#fff"
            />
          </View>
          {dnd.enabled && (
            <>
              <TouchableOpacity style={styles.row} onPress={() => setDndStartModal(true)}>
                <Text style={styles.label}>{t('notificationSettings.dndStartTime')}</Text>
                <Text style={styles.value}>{dnd.start_time}</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.row} onPress={() => setDndEndModal(true)}>
                <Text style={styles.label}>{t('notificationSettings.dndEndTime')}</Text>
                <Text style={styles.value}>{dnd.end_time}</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('notificationSettings.notificationSound')}</Text>
          <TouchableOpacity style={styles.row} onPress={() => setSoundModalVisible(true)}>
            <Text style={styles.label}>{t('notificationSettings.soundSelection')}</Text>
            <Text style={styles.value}>{getSoundName(soundId, t)}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('notificationSettings.other')}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>{t('notificationSettings.adNotifications')}</Text>
            <Switch
              value={s.ad_notifications ?? false}
              onValueChange={(v) => updateSetting('ad_notifications', v)}
              trackColor={{ false: '#374151', true: '#8B5CF6' }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </ScrollView>

      <Modal visible={soundModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSoundModalVisible(false)}
        >
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>{t('notificationSettings.notificationSound')}</Text>
            <FlatList
              data={sounds.slice(0, 4)}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.optRow, soundId === item.id && styles.optRowActive]}
                  onPress={() => updateSound(item.id)}
                >
                  <Text style={[styles.optText, soundId === item.id && styles.optTextActive]}>
                    {getSoundName(item.id, t)}
                  </Text>
                  {soundId === item.id && <Ionicons name="checkmark" size={20} color="#8B5CF6" />}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setSoundModalVisible(false)}>
              <Text style={styles.modalCloseText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={dndStartModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDndStartModal(false)}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>{t('notificationSettings.dndStartTime')}</Text>
            {DND_STARTS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.optRow, dnd.start_time === t && styles.optRowActive]}
                onPress={() => {
                  updateDnd({ start_time: t });
                  setDndStartModal(false);
                }}
              >
                <Text style={[styles.optText, dnd.start_time === t && styles.optTextActive]}>{t}</Text>
                {dnd.start_time === t && <Ionicons name="checkmark" size={20} color="#8B5CF6" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={dndEndModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDndEndModal(false)}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>{t('notificationSettings.dndEndTime')}</Text>
            {DND_ENDS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.optRow, dnd.end_time === t && styles.optRowActive]}
                onPress={() => {
                  updateDnd({ end_time: t });
                  setDndEndModal(false);
                }}
              >
                <Text style={[styles.optText, dnd.end_time === t && styles.optTextActive]}>{t}</Text>
                {dnd.end_time === t && <Ionicons name="checkmark" size={20} color="#8B5CF6" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  backBtn: { marginRight: 16 },
  backText: { color: colors.accent, fontSize: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  scroll: { flex: 1 },
  content: { padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#9CA3AF', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  label: { fontSize: 16, color: colors.text, flex: 1 },
  value: { fontSize: 16, color: '#9CA3AF', marginRight: 4 },
  chevron: { fontSize: 18, color: '#9CA3AF' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1F2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '60%',
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 16 },
  optRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 4,
  },
  optRowActive: { backgroundColor: 'rgba(139,92,246,0.2)' },
  optText: { fontSize: 16, color: colors.text },
  optTextActive: { color: colors.accent, fontWeight: '600' },
  modalClose: {
    marginTop: 16,
    padding: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#374151',
  },
  modalCloseText: { color: colors.text, fontSize: 16 },
});
