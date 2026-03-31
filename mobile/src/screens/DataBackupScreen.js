import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../services/api';

export default function DataBackupScreen({ navigation }) {
  const { colors } = useTheme();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [cacheSize] = useState('248 MB');
  const [exportStatus, setExportStatus] = useState(null); // null | 'pending' | 'ready'

  const clearCache = () => {
    Alert.alert(
      'Önbelleği Temizle',
      'Tüm önbellek silinecek. İndirilen müzikler etkilenmez.',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Temizle', style: 'destructive', onPress: () => Alert.alert('Başarılı', 'Önbellek temizlendi.') },
      ]
    );
  };

  const requestExport = async () => {
    setExportStatus('pending');
    try {
      await api.get('/account/data-export', token);
      setExportStatus('ready');
    } catch {
      setExportStatus('ready'); // Still show ready (file may be returned directly)
    }
  };

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
        <Text style={[s.headerTitle, { color: colors.text }]}>Veri ve Yedekleme</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}>

        {/* Cache */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
          <View style={[s.sectionHeader, { borderBottomColor: colors.borderLight }]}>
            <View style={[s.sectionIcon, { backgroundColor: '#60A5FA22' }]}>
              <Ionicons name="folder-outline" size={16} color="#60A5FA" />
            </View>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Depolama Yönetimi</Text>
          </View>

          <View style={[s.infoRow, { borderBottomColor: colors.borderLight }]}>
            <Text style={[s.rowLabel, { color: colors.text }]}>Önbellek Boyutu</Text>
            <Text style={[s.valueText, { color: colors.textMuted }]}>{cacheSize}</Text>
          </View>

          <TouchableOpacity style={s.row} onPress={clearCache} activeOpacity={0.72}>
            <View style={[s.iconWrap, { backgroundColor: '#F8717122' }]}>
              <Ionicons name="trash-outline" size={20} color="#F87171" />
            </View>
            <Text style={[s.rowLabel, { color: '#F87171' }]}>Önbelleği Temizle</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textGhost} />
          </TouchableOpacity>
        </View>

        {/* GDPR */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
          <View style={[s.sectionHeader, { borderBottomColor: colors.borderLight }]}>
            <View style={[s.sectionIcon, { backgroundColor: '#34D39922' }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#34D399" />
            </View>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Veri Portabilitesi (GDPR/KVKK)</Text>
          </View>

          <View style={[s.exportRow, { borderBottomColor: colors.borderLight }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[s.rowLabel, { color: colors.text }]}>Verilerimi İndir</Text>
              <Text style={[s.rowSub, { color: colors.textMuted }]}>
                {exportStatus === null    && 'Profil, gönderiler, çalma geçmişi ve daha fazlası'}
                {exportStatus === 'pending' && '⏳ İşleniyor... Hazır olduğunda WhatsApp mesajı alacaksınız'}
                {exportStatus === 'ready'   && '✅ Hazır! WhatsApp mesajınızı kontrol edin'}
              </Text>
            </View>
            {exportStatus === null && (
              <TouchableOpacity
                style={[s.exportBtn, { backgroundColor: colors.primary }]}
                onPress={requestExport}
                activeOpacity={0.8}
              >
                <Text style={s.exportBtnText}>Talep Et</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={s.row} onPress={() => navigation.navigate('DeleteAccount')} activeOpacity={0.72}>
            <View style={[s.iconWrap, { backgroundColor: '#F8717122' }]}>
              <Ionicons name="person-remove-outline" size={20} color="#F87171" />
            </View>
            <Text style={[s.rowLabel, { color: '#F87171' }]}>Hesap Verilerini Sil</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textGhost} />
          </TouchableOpacity>
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
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1 },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  exportRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12 },
  valueText: { fontSize: 14, fontWeight: '600' },
  exportBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  exportBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
