import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

export default function DeleteAccountScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { token, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = () => {
    if (!password.trim()) {
      Alert.alert('Hata', 'Şifrenizi girin');
      return;
    }
    if (confirm !== 'HESABIMI SİL') {
      Alert.alert('Hata', 'Onaylamak için "HESABIMI SİL" yazın');
      return;
    }
    Alert.alert(
      'Hesabı Kalıcı Olarak Sil',
      'Bu işlem geri alınamaz. Tüm verileriniz (gönderiler, takipçiler, mesajlar vb.) silinecek. Emin misiniz?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet, Sil',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await api.delete('/account/delete', token);
              await logout();
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
              Alert.alert('Hesap Silindi', 'Hesabınız kalıcı olarak silindi.');
            } catch (err) {
              const msg = err.data?.detail || err.message || 'İşlem başarısız';
              Alert.alert('Hata', typeof msg === 'string' ? msg : JSON.stringify(msg));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hesabı Sil</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.warning}>
          ⚠️ Bu işlem geri alınamaz. Tüm verileriniz (gönderiler, takipçiler, mesajlar, çalma listeleri vb.) kalıcı olarak silinecektir.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Şifreniz"
          placeholderTextColor="#6B7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Text style={styles.confirmHint}>Onaylamak için aşağıya "HESABIMI SİL" yazın</Text>
        <TextInput
          style={styles.input}
          placeholder="HESABIMI SİL"
          placeholderTextColor="#6B7280"
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="characters"
        />
        <TouchableOpacity
          style={[styles.deleteBtn, loading && styles.buttonDisabled]}
          onPress={handleDelete}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteText}>Hesabı Kalıcı Olarak Sil</Text>}
        </TouchableOpacity>
      </ScrollView>
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
  backBtn: {},
  backText: { color: colors.accent, fontSize: 16 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginLeft: 16 },
  scroll: { flex: 1 },
  content: { padding: 24 },
  warning: { fontSize: 14, color: '#F59E0B', marginBottom: 20, lineHeight: 22 },
  confirmHint: { fontSize: 14, color: '#9CA3AF', marginBottom: 8 },
  input: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    marginBottom: 16,
  },
  deleteBtn: {
    marginTop: 24,
    backgroundColor: '#DC2626',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  deleteText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
