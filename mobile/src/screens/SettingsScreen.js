import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function SettingsScreen({ navigation }) {
  const { colors }               = useTheme();
  const { user, logout, isGuest, exitGuest } = useAuth();
  const insets                   = useSafeAreaInsets();
  const { t }                    = useTranslation();

  const CATEGORIES = [
    { name: 'AccountSettings', label: t('settings.accountSettings'),   icon: 'person-circle-outline',  color: '#A78BFA' },
    { name: 'NotifSettings',   label: t('settings.notificationSettings'), icon: 'notifications-outline', color: '#F87171' },
    { name: 'LanguageRegion',  label: t('settings.languageRegion'),    icon: 'language-outline',       color: '#FBBF24' },
    { name: 'DataBackup',      label: t('settings.dataBackup'),        icon: 'cloud-outline',          color: '#60A5FA' },
    { name: 'LegalSettings',   label: t('settings.legalAndPrivacy'),   icon: 'document-text-outline',  color: '#9CA3AF' },
  ];

  const GUEST_CATEGORIES = [
    { name: 'LanguageRegion', label: t('settings.languageRegion'),  icon: 'language-outline',      color: '#FBBF24' },
    { name: 'LegalSettings',  label: t('settings.legalAndPrivacy'), icon: 'document-text-outline', color: '#9CA3AF' },
  ];

  const visibleCategories = isGuest ? GUEST_CATEGORIES : CATEGORIES;

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>{t('settings.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}>

        {/* Profile Card — misafir için giriş yap CTA */}
        {isGuest ? (
          <TouchableOpacity
            style={[s.profileCard, { backgroundColor: 'rgba(192,132,252,0.08)', borderColor: 'rgba(192,132,252,0.25)' }]}
            onPress={() => navigation.navigate('Auth')}
            activeOpacity={0.88}
          >
            <View style={[s.avatarRing, { backgroundColor: 'rgba(192,132,252,0.15)', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="person-outline" size={22} color="#C084FC" />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[s.profileName, { color: colors.text }]}>{t('settings.guestUser')}</Text>
              <Text style={[s.profileSub, { color: '#C084FC' }]}>{t('settings.loginOrRegister')}</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.profileCard, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}
            onPress={() => navigation.navigate('ProfileEdit')}
            activeOpacity={0.88}
          >
            <LinearGradient colors={colors.gradPrimary} start={{ x:0,y:0 }} end={{ x:1,y:1 }} style={s.avatarRing}>
              <Image source={{ uri: user?.avatar_url || `https://i.pravatar.cc/100?u=${user?.id}` }} style={s.avatar} />
            </LinearGradient>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[s.profileName, { color: colors.text }]}>{user?.display_name || user?.username || 'Kullanıcı'}</Text>
              <Text style={[s.profileSub, { color: colors.textMuted }]}>{user?.phone || user?.username || t('settings.editProfile')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textGhost} />
          </TouchableOpacity>
        )}

        {/* Kategoriler */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
          {visibleCategories.map((cat, i) => (
            <TouchableOpacity
              key={cat.name}
              style={[s.row, i < visibleCategories.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
              onPress={() => navigation.navigate(cat.name)}
              activeOpacity={0.72}
            >
              <View style={[s.iconWrap, { backgroundColor: cat.color + '22' }]}>
                <Ionicons name={cat.icon} size={20} color={cat.color} />
              </View>
              <Text style={[s.rowLabel, { color: colors.text }]}>{cat.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textGhost} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Giriş Yap (misafir) / Çıkış Yap (normal) */}
        {isGuest ? (
          <TouchableOpacity
            style={[s.logoutBtn, { backgroundColor: 'rgba(192,132,252,0.1)', borderColor: 'rgba(192,132,252,0.3)' }]}
            onPress={() => navigation.navigate('Auth')}
            activeOpacity={0.8}
          >
            <Ionicons name="log-in-outline" size={20} color="#C084FC" />
            <Text style={[s.logoutText, { color: '#C084FC' }]}>{t('login.title')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.logoutBtn, { backgroundColor: colors.errorBg, borderColor: colors.error + '40' }]}
            onPress={() => {
              if (typeof window !== 'undefined' && window.__sbForceLogout) {
                window.__sbForceLogout();
              } else {
                logout?.();
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={[s.logoutText, { color: colors.error }]}>{t('settings.logout')}</Text>
          </TouchableOpacity>
        )}

        <Text style={[s.version, { color: colors.textGhost }]}>SocialBeats v3.3.0</Text>
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
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, borderWidth: 1 },
  avatarRing: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', padding: 2.5 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  profileName: { fontSize: 16, fontWeight: '800' },
  profileSub: { fontSize: 13 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 16 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 16, borderWidth: 1 },
  logoutText: { fontSize: 16, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 12 },
});
