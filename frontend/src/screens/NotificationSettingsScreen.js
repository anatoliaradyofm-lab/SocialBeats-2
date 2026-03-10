import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch,
  Alert, TextInput, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

const NOTIF_TYPES = [
  { id: 'likes', label: 'Beğeniler', icon: 'heart', desc: 'Gönderilerine beğeni geldiğinde' },
  { id: 'comments', label: 'Yorumlar', icon: 'chatbubble', desc: 'Gönderilerine yorum yapıldığında' },
  { id: 'follows', label: 'Yeni Takipçiler', icon: 'person-add', desc: 'Seni takip etmeye başladığında' },
  { id: 'messages', label: 'Mesajlar', icon: 'mail', desc: 'Yeni mesaj aldığında' },
  { id: 'reposts', label: 'Repostlar', icon: 'repeat', desc: 'Gönderin paylaşıldığında' },
  { id: 'mentions', label: 'Bahsetmeler', icon: 'at', desc: 'Senden bahsedildiğinde' },
  { id: 'story_replies', label: 'Hikaye Yanıtları', icon: 'chatbubble-ellipses', desc: 'Hikayelerine yanıt verildiğinde' },
  { id: 'new_content', label: 'Yeni İçerik', icon: 'sparkles', desc: 'Takip ettiklerinden yeni içerik' },
  { id: 'music', label: 'Müzik Önerileri', icon: 'musical-note', desc: 'Yeni müzik önerileri' },
  { id: 'live', label: 'Canlı Yayın', icon: 'radio', desc: 'Takip ettiklerin canlıya geçtiğinde' },
];

const SOUNDS = [
  { id: 'default', label: 'Varsayılan', icon: 'volume-medium' },
  { id: 'chime', label: 'Çan', icon: 'notifications' },
  { id: 'pop', label: 'Pop', icon: 'ellipse' },
  { id: 'bubble', label: 'Baloncuk', icon: 'water' },
  { id: 'none', label: 'Sessiz', icon: 'volume-mute' },
];

const DND_PRESETS = [
  { label: '1 saat', minutes: 60 },
  { label: '4 saat', minutes: 240 },
  { label: 'Akşama kadar', minutes: null },
  { label: 'Zamanlayıcı', minutes: -1 },
];

export default function NotificationSettingsScreen({ navigation }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const [settings, setSettings] = useState({});
  const [pushEnabled, setPushEnabled] = useState(true);
  const [dnd, setDnd] = useState(false);
  const [dndStart, setDndStart] = useState('22:00');
  const [dndEnd, setDndEnd] = useState('08:00');
  const [sound, setSound] = useState('default');
  const [vibration, setVibration] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [dailyReminder, setDailyReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState('20:00');
  const [personSoundModal, setPersonSoundModal] = useState(false);
  const [personSounds, setPersonSounds] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/notifications/settings', token);
        const s = res.settings || res;
        if (s) {
          setSettings(s.types || buildTypesFromFlat(s));
          setPushEnabled(s.push_enabled !== false);
          setDnd(s.dnd?.enabled || s.quiet_hours_enabled || false);
          setDndStart(s.dnd?.start || s.quiet_hours_start || '22:00');
          setDndEnd(s.dnd?.end || s.quiet_hours_end || '08:00');
          setSound(s.sound || s.notification_sound || 'default');
          setVibration(s.vibration !== false);
          setWeeklySummary(s.weekly_summary_enabled !== false);
          setDailyReminder(s.daily_reminder_enabled || false);
          setReminderTime(s.reminder_time || '20:00');
        }
      } catch {}
      try {
        const ps = await api.get('/notifications/person-sounds', token);
        setPersonSounds(ps.person_sounds || []);
      } catch {}
    };
    load();
  }, [token]);

  const buildTypesFromFlat = (s) => {
    const types = {};
    NOTIF_TYPES.forEach(t => {
      const key = `${t.id}_notifications`;
      types[t.id] = s[key] !== false;
    });
    return types;
  };

  const toggleType = async (typeId) => {
    const newVal = !settings[typeId];
    setSettings(prev => ({ ...prev, [typeId]: newVal }));
    const payload = {};
    payload[`${typeId}_notifications`] = newVal;
    try { await api.put('/notifications/settings', payload, token); } catch {}
  };

  const updateDnd = async (enabled) => {
    setDnd(enabled);
    try {
      await api.put('/notifications/dnd', { enabled, start_time: dndStart, end_time: dndEnd }, token);
    } catch {}
  };

  const updateDndTimes = async (start, end) => {
    setDndStart(start);
    setDndEnd(end);
    if (dnd) {
      try {
        await api.put('/notifications/dnd', { enabled: true, start_time: start, end_time: end }, token);
      } catch {}
    }
  };

  const updateSound = async (s) => {
    setSound(s);
    try { await api.put('/notifications/sound', { sound_id: s }, token); } catch {}
  };

  const toggleWeeklySummary = async (val) => {
    setWeeklySummary(val);
    try { await api.put('/notifications/settings', { weekly_summary_enabled: val }, token); } catch {}
  };

  const toggleDailyReminder = async (val) => {
    setDailyReminder(val);
    try { await api.put('/notifications/settings', { daily_reminder_enabled: val }, token); } catch {}
  };

  const SectionRow = ({ icon, label, desc, value, onToggle, disabled, children }) => (
    <View style={[styles.settingRow, { borderBottomWidth: 0.5, borderBottomColor: colors.border }]}>
      <Ionicons name={icon} size={20} color={disabled ? colors.textMuted : BRAND.primaryLight} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: disabled ? colors.textMuted : colors.text, fontSize: 14 }}>{label}</Text>
        {desc ? <Text style={{ color: colors.textMuted, fontSize: 11 }}>{desc}</Text> : null}
        {children}
      </View>
      {onToggle && (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ true: BRAND.primary, false: colors.border }}
          thumbColor="#FFF"
          disabled={disabled}
        />
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Bildirim Ayarları</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Push Notifications Master Toggle */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <SectionRow
            icon="notifications"
            label="Push Bildirimler"
            desc="Tüm bildirimleri aç/kapat"
            value={pushEnabled}
            onToggle={(v) => {
              setPushEnabled(v);
              api.put('/notifications/settings', { push_enabled: v }, token).catch(() => {});
            }}
          />
        </View>

        {/* Per-Type Notification Toggles */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>BİLDİRİM TÜRLERİ</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, opacity: pushEnabled ? 1 : 0.4 }]}>
          {NOTIF_TYPES.map((type) => (
            <SectionRow
              key={type.id}
              icon={type.icon}
              label={type.label}
              desc={type.desc}
              value={settings[type.id] !== false}
              onToggle={() => toggleType(type.id)}
              disabled={!pushEnabled}
            />
          ))}
        </View>

        {/* Scheduled Notifications */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ZAMANLI BİLDİRİMLER</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <SectionRow
            icon="bar-chart"
            label="Haftalık Özet"
            desc="Her Pazar 20:00 - dinleme özetin"
            value={weeklySummary}
            onToggle={toggleWeeklySummary}
          />
          <SectionRow
            icon="alarm"
            label="Günlük Hatırlatma"
            desc={`Her gün ${reminderTime} - müzik dinleme hatırlatması`}
            value={dailyReminder}
            onToggle={toggleDailyReminder}
          />
        </View>

        {/* DND */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>RAHATSIZ ETME MODU</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <SectionRow
            icon="moon"
            label="Rahatsız Etme"
            desc="Belirli saatlerde bildirimleri kapat"
            value={dnd}
            onToggle={updateDnd}
          />
          {dnd && (
            <>
              <View style={styles.dndTime}>
                <TouchableOpacity style={[styles.dndTimeItem, { backgroundColor: colors.card }]} onPress={() => {
                  Alert.prompt ? Alert.prompt('Başlangıç Saati', 'SS:DD formatında girin', (val) => {
                    if (/^\d{2}:\d{2}$/.test(val)) updateDndTimes(val, dndEnd);
                  }, 'plain-text', dndStart) : null;
                }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>Başlangıç</Text>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{dndStart}</Text>
                </TouchableOpacity>
                <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
                <TouchableOpacity style={[styles.dndTimeItem, { backgroundColor: colors.card }]} onPress={() => {
                  Alert.prompt ? Alert.prompt('Bitiş Saati', 'SS:DD formatında girin', (val) => {
                    if (/^\d{2}:\d{2}$/.test(val)) updateDndTimes(dndStart, val);
                  }, 'plain-text', dndEnd) : null;
                }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>Bitiş</Text>
                  <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{dndEnd}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.dndPresets}>
                {DND_PRESETS.filter(p => p.minutes !== -1 && p.minutes !== null).map(p => (
                  <TouchableOpacity key={p.label} style={[styles.presetChip, { backgroundColor: colors.card }]} onPress={() => {
                    const now = new Date();
                    const end = new Date(now.getTime() + p.minutes * 60000);
                    const startStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    const endStr = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
                    updateDndTimes(startStr, endStr);
                  }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Sound & Vibration */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>SES VE TİTREŞİM</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500', marginBottom: 10 }}>Bildirim Sesi</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {SOUNDS.map(s => (
              <TouchableOpacity key={s.id} style={[styles.soundChip, { backgroundColor: sound === s.id ? BRAND.primary : colors.card }]} onPress={() => updateSound(s.id)}>
                <Ionicons name={s.icon} size={14} color={sound === s.id ? '#FFF' : colors.textSecondary} />
                <Text style={{ color: sound === s.id ? '#FFF' : colors.textSecondary, fontSize: 12 }}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={[styles.settingRow, { marginTop: 14, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 14 }]}>
            <Ionicons name="phone-portrait" size={18} color={colors.textSecondary} style={{ marginRight: 12 }} />
            <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>Titreşim</Text>
            <Switch
              value={vibration}
              onValueChange={(v) => {
                setVibration(v);
                api.put('/notifications/settings', { vibration: v }, token).catch(() => {});
              }}
              trackColor={{ true: BRAND.primary, false: colors.border }}
              thumbColor="#FFF"
            />
          </View>

          <TouchableOpacity
            style={[styles.settingRow, { borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 14 }]}
            onPress={() => setPersonSoundModal(true)}
          >
            <Ionicons name="person-circle" size={18} color={colors.textSecondary} style={{ marginRight: 12 }} />
            <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>Kişi Bazlı Ses Ayarı</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{personSounds.length} kişi</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Person Sound Modal */}
      <Modal visible={personSoundModal} transparent animationType="slide" onRequestClose={() => setPersonSoundModal(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPersonSoundModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Kişi Bazlı Ses</Text>
            <View style={{ width: 24 }} />
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 13, paddingHorizontal: 16, marginBottom: 16 }}>
            Belirli kişiler için özel bildirim sesi atayabilirsiniz.
          </Text>
          {personSounds.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <Ionicons name="volume-off" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginTop: 12 }}>Henüz özel ses atanmamış</Text>
            </View>
          ) : (
            <FlatList
              data={personSounds}
              keyExtractor={(item, i) => item.user_id || `${i}`}
              renderItem={({ item }) => (
                <View style={[styles.personRow, { borderBottomColor: colors.border }]}>
                  <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>{item.username || item.user_id}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.sound || 'default'}</Text>
                </View>
              )}
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
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, paddingHorizontal: 16, marginTop: 20, marginBottom: 8 },
  card: { marginHorizontal: 16, borderRadius: 14, padding: 16 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  dndTime: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 12, gap: 16 },
  dndTimeItem: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  dndPresets: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 12 },
  presetChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  soundChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, gap: 6 },
  modalContainer: { flex: 1, paddingTop: 50 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16 },
  personRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
});
