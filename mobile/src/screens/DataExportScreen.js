import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

export default function DataExportScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const data = await api.get('/data/export/me', token);
      const jsonStr = JSON.stringify(data, null, 2);
      await Share.share({
        message: jsonStr,
        title: 'socialbeats-veri-export.json',
      });
      Alert.alert('Başarılı', 'Verileriniz paylaşım menüsü üzerinden dışa aktarılabilir.');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Hata', err.message || 'Veri dışa aktarma başarısız.');
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
        <Text style={styles.headerTitle}>Veri Dışa Aktarma</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.description}>
          Tüm verilerinizi (profil, gönderiler, çalma listeleri, dinleme geçmişi) JSON formatında dışa aktarabilirsiniz.
          Veriler paylaşım menüsü üzerinden kaydedebileceğiniz veya e-posta ile gönderebileceğiniz bir dosya olarak sunulur.
        </Text>
        <TouchableOpacity
          style={[styles.exportBtn, loading && styles.exportBtnDisabled]}
          onPress={handleExport}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.exportBtnText}>Verilerimi Dışa Aktar</Text>
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
  exportBtn: { backgroundColor: '#8B5CF6', padding: 16, borderRadius: 12, alignItems: 'center' },
  exportBtnDisabled: { opacity: 0.7 },
  exportBtnText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
