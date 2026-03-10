import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

export default function ProfileExport() {
  const { t } = useTranslation();
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const data = await api.get('/users/profile/export', token);
      const jsonStr = JSON.stringify(data, null, 2);
      await Share.share({
        message: jsonStr,
        title: (user?.username || 'profile') + '-export.json',
      });
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('profile.exportFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleExport} disabled={loading}>
      {loading ? <ActivityIndicator size="small" color="#8B5CF6" /> : <Text style={styles.buttonText}>{t('profile.exportData')}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: '#1F2937', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#8B5CF6', fontSize: 14, fontWeight: '500' },
});
