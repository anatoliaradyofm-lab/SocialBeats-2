import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

const NAV_ITEMS_TOP = [
  { name: 'ChangeEmail',    label: 'E-posta Değiştir', icon: 'mail-outline',        color: '#60A5FA' },
  { name: 'ChangePassword', label: 'Şifre Değiştir',   icon: 'lock-closed-outline', color: '#A78BFA' },
];

const NAV_ITEMS_BOTTOM = [
  { name: 'BlockedUsers',  label: 'Engellenen Kullanıcılar', icon: 'ban-outline',   color: '#F87171' },
  { name: 'FreezeAccount', label: 'Hesabı Dondur',           icon: 'snow-outline',  color: '#60A5FA' },
  { name: 'DeleteAccount', label: 'Hesabımı Kalıcı Sil',     icon: 'trash-outline', color: '#F87171' },
];

const MSG_OPTIONS = ['Herkes', 'Takip Ettiklerim', 'Hiç Kimse'];

export default function AccountSettingsScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [privateProfile, setPrivateProfile] = useState(false);
  const [msgPermission, setMsgPermission]   = useState('Herkes');
  const [msgModalVisible, setMsgModalVisible] = useState(false);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Hesap Ayarları</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}>

        {/* E-posta + Şifre */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
          {NAV_ITEMS_TOP.map((item, i) => (
            <TouchableOpacity
              key={item.name}
              style={[s.row, i < NAV_ITEMS_TOP.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
              onPress={() => navigation.navigate(item.name)}
              activeOpacity={0.72}
            >
              <View style={[s.iconWrap, { backgroundColor: item.color + '22' }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={[s.rowLabel, { color: colors.text }]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textGhost} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Mesaj İzinleri */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
          <TouchableOpacity style={s.row} onPress={() => setMsgModalVisible(true)} activeOpacity={0.72}>
            <View style={[s.iconWrap, { backgroundColor: '#34D39922' }]}>
              <Ionicons name="chatbubble-outline" size={20} color="#34D399" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[s.rowLabel, { color: colors.text }]}>Mesaj İzinleri</Text>
              <Text style={[s.rowSub, { color: colors.textMuted }]}>{msgPermission}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textGhost} />
          </TouchableOpacity>
        </View>

        {/* Mesaj İzinleri Modal */}
        <Modal visible={msgModalVisible} transparent animationType="slide" onRequestClose={() => setMsgModalVisible(false)}>
          <Pressable style={s.backdrop} onPress={() => setMsgModalVisible(false)}>
            <Pressable style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.glassBorder }]} onPress={() => {}}>
              <View style={[s.sheetHandle, { backgroundColor: colors.textGhost }]} />
              <Text style={[s.sheetTitle, { color: colors.text }]}>Mesaj İzinleri</Text>
              <Text style={[s.sheetSub, { color: colors.textMuted }]}>Kimler sana mesaj gönderebilir?</Text>
              {MSG_OPTIONS.map((opt, i) => {
                const active = msgPermission === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[s.optRow, i < MSG_OPTIONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
                    onPress={() => { setMsgPermission(opt); setMsgModalVisible(false); }}
                    activeOpacity={0.72}
                  >
                    <Text style={[s.optLabel, { color: active ? colors.primary : colors.text }]}>{opt}</Text>
                    {active && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </Pressable>
          </Pressable>
        </Modal>

        {/* Profil Gizliliği */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
          <View style={s.toggleRow}>
            <View style={[s.iconWrap, { backgroundColor: '#A78BFA22' }]}>
              <Ionicons name="eye-off-outline" size={20} color="#A78BFA" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[s.rowLabel, { color: colors.text }]}>Profil Gizliliği</Text>
              <Text style={[s.rowSub, { color: colors.textMuted }]}>Profilin yalnızca takipçilere görünür</Text>
            </View>
            <Switch
              value={privateProfile}
              onValueChange={setPrivateProfile}
              trackColor={{ false: colors.surfaceHigh, true: colors.primary + '99' }}
              thumbColor={privateProfile ? colors.primary : colors.textMuted}
            />
          </View>
        </View>

        {/* Alt navigasyon */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
          {NAV_ITEMS_BOTTOM.map((item, i) => (
            <TouchableOpacity
              key={item.name}
              style={[s.row, i < NAV_ITEMS_BOTTOM.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
              onPress={() => navigation.navigate(item.name)}
              activeOpacity={0.72}
            >
              <View style={[s.iconWrap, { backgroundColor: item.color + '22' }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={[s.rowLabel, { color: item.name === 'DeleteAccount' ? colors.error : colors.text }]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textGhost} />
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
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
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingBottom: 32, paddingTop: 12 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  sheetTitle: { fontSize: 17, fontWeight: '800', paddingHorizontal: 20, marginBottom: 4 },
  sheetSub: { fontSize: 13, paddingHorizontal: 20, marginBottom: 14 },
  optRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  optLabel: { fontSize: 16, fontWeight: '600' },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12 },
});
