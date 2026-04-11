/**
 * DeleteAccountScreen — Hesap silme
 * Tek onay alert → sil → logout → Login
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert } from '../components/ui/AppAlert';

const CONSEQUENCES = [
  { icon: 'person-remove-outline',   text: 'Profiliniz ve tüm takipçi/takip ilişkileri silinecek' },
  { icon: 'musical-notes-outline',   text: 'Çalma listeleriniz ve beğenileriniz kalıcı olarak silinecek' },
  { icon: 'chatbubbles-outline',      text: 'Tüm mesajlarınız silinecek' },
  { icon: 'ban-outline',             text: 'Aynı kullanıcı adıyla tekrar kayıt olabilirsiniz' },
];

export default function DeleteAccountScreen({ navigation }) {
  const { colors } = useTheme();
  const s = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { token, logout } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleDelete = () => {
    Alert.alert(
      'Hesabı Kalıcı Sil',
      'Hesabınızı kalıcı olarak silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz, tüm verileriniz silinecektir.',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Evet, Sil', style: 'destructive', onPress: doDelete },
      ]
    );
  };

  const doDelete = async () => {
    setLoading(true);
    try {
      await api.delete('/account/delete', token);
      await logout?.();
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (err) {
      const msg = err?.data?.detail || err?.message || 'İşlem başarısız.';
      Alert.alert('Hata', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Hesabı Kalıcı Sil</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Warning icon */}
        <View style={s.iconWrap}>
          <LinearGradient colors={['rgba(248,113,113,0.18)', 'rgba(239,68,68,0.06)']} style={s.iconGrad}>
            <Ionicons name="trash-outline" size={44} color="#F87171" />
          </LinearGradient>
        </View>

        <Text style={[s.title, { color: colors.text }]}>Hesabı Kalıcı Sil</Text>
        <Text style={[s.desc, { color: colors.textMuted }]}>
          Bu işlem geri alınamaz. Aşağıdaki bilgilerin tamamı kalıcı olarak silinecektir.
        </Text>

        {/* Consequences */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: 'rgba(248,113,113,0.25)' }]}>
          {CONSEQUENCES.map((item, i) => (
            <View key={i} style={[s.row, i < CONSEQUENCES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
              <View style={s.rowIcon}>
                <Ionicons name={item.icon} size={18} color="#F87171" />
              </View>
              <Text style={[s.rowText, { color: colors.textSecondary }]}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* Warning banner */}
        <View style={[s.warningBanner, { backgroundColor: 'rgba(248,113,113,0.08)', borderColor: 'rgba(248,113,113,0.3)' }]}>
          <Ionicons name="warning-outline" size={18} color="#F87171" />
          <Text style={[s.warningText, { color: '#F87171' }]}>
            Hesabınız silindiğinde giriş yapmanız mümkün olmayacaktır.
          </Text>
        </View>

        {/* Delete button */}
        <TouchableOpacity
          style={[s.deleteBtn, loading && { opacity: 0.6 }]}
          onPress={handleDelete}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={s.deleteBtnText}>Hesabı Kalıcı Olarak Sil</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={s.cancelBtn} onPress={() => navigation.navigate('FreezeAccount')}>
          <Text style={[s.cancelText, { color: colors.textMuted }]}>
            Silmek yerine hesabı dondurmak ister misiniz?
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 18, fontWeight: '700' },
  content:      { padding: 20, alignItems: 'stretch' },
  iconWrap:     { alignItems: 'center', marginBottom: 20, marginTop: 8 },
  iconGrad:     { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8, letterSpacing: -0.5 },
  desc:         { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 24 },
  card:         { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  row:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16 },
  rowIcon:      { width: 32, alignItems: 'center' },
  rowText:      { flex: 1, fontSize: 14, lineHeight: 20, marginLeft: 8 },
  warningBanner:{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 24 },
  warningText:  { flex: 1, fontSize: 13, lineHeight: 19 },
  deleteBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderRadius: 16, backgroundColor: '#DC2626', marginBottom: 16 },
  deleteBtnText:{ color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn:    { alignItems: 'center', padding: 8 },
  cancelText:   { fontSize: 13, textDecorationLine: 'underline' },
});
