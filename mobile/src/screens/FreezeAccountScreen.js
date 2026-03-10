import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

export default function FreezeAccountScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { token, logout } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleFreeze = () => {
    Alert.alert(
      'Hesabı Dondur',
      'Hesabınız dondurulduğunda profiliniz gizlenecek ve giriş yapamayacaksınız. Daha sonra hesabınızı tekrar etkinleştirebilirsiniz. Devam etmek istiyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Dondur', style: 'destructive', onPress: doFreeze },
      ]
    );
  };

  const doFreeze = async () => {
    setLoading(true);
    try {
      await api.post('/account/freeze', {}, token);
      logout?.();
      Alert.alert('Hesap donduruldu', 'Hesabınız başarıyla donduruldu. Tekrar giriş yaparak etkinleştirebilirsiniz.');
    } catch (err) {
      Alert.alert('Hata', err.message || 'Hesap dondurma başarısız.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hesabı Dondur</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.description}>
          Hesabınızı geçici olarak dondurduğunuzda profiliniz gizlenir ve giriş yapamazsınız.
          Verileriniz silinmez; daha sonra tekrar giriş yaparak hesabınızı etkinleştirebilirsiniz.
        </Text>
        <TouchableOpacity
          style={[styles.freezeBtn, loading && styles.freezeBtnDisabled]}
          onPress={handleFreeze}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.freezeBtnText}>Hesabımı Dondur</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  backBtn: {},
  backText: { color: colors.accent, fontSize: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  content: { padding: 24, flex: 1 },
  description: { fontSize: 15, color: '#9CA3AF', lineHeight: 22, marginBottom: 32 },
  freezeBtn: { backgroundColor: '#DC2626', padding: 16, borderRadius: 12, alignItems: 'center' },
  freezeBtnDisabled: { opacity: 0.7 },
  freezeBtnText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
