import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, Alert, Modal, FlatList,
  Linking, Platform, TextInput, Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import i18n, { SUPPORTED_LANGUAGES } from '../i18n';
import { useAuth } from '../contexts/AuthContext';
import api, { getApiUrl } from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user, token, logout } = useAuth();

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [langModalVisible, setLangModalVisible] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api.get('/user/settings', token);
      setSettings(data);
    } catch {
      setSettings({});
    } finally {
      setLoading(false);
    }
  };


  const updateSetting = async (key, value) => {
    try {
      await api.put('/user/settings', { [key]: value }, token);
      setSettings((s) => ({ ...s, [key]: value }));
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err.message || 'Failed to update');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Oturumu Kapat',
      'Çıkış yapmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Çıkış Yap', style: 'destructive', onPress: logout },
      ]
    );
  };

  const SectionHeader = ({ title }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const SettingRow = ({ icon, label, rightText, onPress, isDestructive, iconColor = '#9CA3AF' }) => (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowLeft}>
        <View style={[styles.iconContainer, isDestructive && styles.destructiveIconBg]}>
          <Ionicons name={icon} size={20} color={isDestructive ? '#EF4444' : iconColor} />
        </View>
        <Text style={[styles.rowLabel, isDestructive && styles.destructiveText]}>{label}</Text>
      </View>
      <View style={styles.rowRight}>
        {rightText ? <Text style={styles.rightText}>{rightText}</Text> : null}
        <Ionicons name="chevron-forward" size={18} color="#4B5563" />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient colors={['#111827', '#000000']} style={StyleSheet.absoluteFill} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ayarlar</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>

        {/* 1. HESAP AYARLARI */}
        <SectionHeader title="1. HESAP AYARLARI" />
        <View style={styles.card}>
          <SettingRow icon="mail-outline" label="E-posta değiştirme" onPress={() => navigation.navigate('ChangeEmail')} />
          <SettingRow icon="key-outline" label="Şifre değiştirme" onPress={() => navigation.navigate('ChangePassword')} />
          <SettingRow icon="snow-outline" label="Hesabı dondurma" iconColor="#F59E0B" onPress={() => navigation.navigate('FreezeAccount')} />
          <SettingRow icon="trash-outline" label="Hesabı silme" isDestructive onPress={() => navigation.navigate('DeleteAccount')} />
        </View>

        {/* 2. BİLDİRİM AYARLARI */}
        <SectionHeader title="2. BİLDİRİM AYARLARI" />
        <View style={styles.card}>
          <SettingRow icon="notifications-outline" label="Push bildirim tercihleri" onPress={() => navigation.navigate('NotificationSettings')} />
          <SettingRow icon="volume-medium-outline" label="Bildirim sesi seçimi" onPress={() => navigation.navigate('NotificationSettings')} />
          <SettingRow icon="moon-outline" label="Rahatsız etme modu (zamanlayıcılı)" onPress={() => navigation.navigate('NotificationSettings')} />
          <SettingRow icon="musical-note-outline" label="Özel bildirim sesi atama" onPress={() => navigation.navigate('NotificationSettings')} />
        </View>

        <SectionHeader title="3. DİL VE BÖLGE" />
        <View style={styles.card}>
          <SettingRow
            icon="language-outline"
            label="Dil seçimi (32 dil desteği)"
            rightText={SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language)?.name || i18n.language}
            onPress={() => setLangModalVisible(true)}
          />
        </View>

        {/* 4. VERİ VE YEDEKLEME */}
        <SectionHeader title="4. VERİ VE YEDEKLEME" />
        <View style={styles.card}>
          <SettingRow icon="download-outline" label="Veri indirme (GDPR - JSON/CSV/ZIP)" onPress={() => navigation.navigate('DataExport')} />
        </View>

        {/* 5. YARDIM VE DESTEK */}
        <SectionHeader title="5. YARDIM VE DESTEK" />
        <View style={styles.card}>
          <SettingRow icon="star-outline" label="Uygulama değerlendirmesi" onPress={() => navigation.navigate('Feedback')} />
          <SettingRow icon="chatbubble-outline" label="Geri bildirim gönderme" onPress={() => navigation.navigate('Feedback')} />
        </View>

        {/* 6. YASAL BİLGİLER */}
        <SectionHeader title="6. YASAL BİLGİLER" />
        <View style={styles.card}>
          <SettingRow icon="document-text-outline" label="Kullanım koşulları" onPress={() => Linking.openURL('https://socialbeats.app/terms')} />
          <SettingRow icon="shield-outline" label="Gizlilik politikası" onPress={() => Linking.openURL('https://socialbeats.app/privacy')} />
          <SettingRow icon="ribbon-outline" label="Lisanslar" onPress={() => navigation.navigate('Licenses')} />
        </View>

        {/* Logout at bottom */}
        <View style={{ marginTop: 24, marginBottom: 20 }}>
          <View style={styles.card}>
            <SettingRow icon="log-out-outline" label="Oturumu Kapat" isDestructive onPress={handleLogout} />
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>SocialBeats</Text>
          <Text style={styles.versionText}>Versiyon 1.3.0</Text>
        </View>

      </ScrollView>

      {/* Language Modal */}
      <Modal visible={langModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setLangModalVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Dil Seçin</Text>
              <TouchableOpacity onPress={() => setLangModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={SUPPORTED_LANGUAGES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.langOption}
                  onPress={async () => {
                    i18n.changeLanguage(item.code);
                    await AsyncStorage.setItem('preferred_language', item.code);
                    setLangModalVisible(false);
                  }}
                >
                  <Text style={styles.langText}>{item.name}</Text>
                  {i18n.language === item.code && <Ionicons name="checkmark-circle" size={20} color="#8B5CF6" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 60 },
  backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  accountBanner: { margin: 16, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  accountGradient: { padding: 20 },
  accountContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  accountName: { fontSize: 18, fontWeight: '800', color: '#fff' },
  accountSub: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  sectionHeader: { paddingHorizontal: 24, marginTop: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1.2 },
  card: { backgroundColor: 'rgba(255,255,255,0.03)', marginHorizontal: 16, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  rowLabel: { fontSize: 16, fontWeight: '500', color: '#E5E7EB' },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rightText: { color: '#9CA3AF', fontSize: 14, marginRight: 8 },
  destructiveIconBg: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  destructiveText: { color: '#EF4444' },
  footer: { alignItems: 'center', padding: 40 },
  footerText: { fontSize: 16, fontWeight: '900', color: '#1F2937', letterSpacing: 2, textTransform: 'uppercase' },
  versionText: { fontSize: 12, color: '#4B5563', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#111827', borderRadius: 32, padding: 24, maxHeight: '60%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  langOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  langText: { fontSize: 16, color: '#fff', fontWeight: '500' }
});
