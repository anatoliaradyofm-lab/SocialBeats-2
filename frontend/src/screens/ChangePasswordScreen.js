import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

export default function ChangePasswordScreen({ navigation }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = async () => {
    if (!current || !newPass || !confirm) { setError('Tüm alanlar gerekli'); return; }
    if (newPass !== confirm) { setError('Yeni şifreler eşleşmiyor'); return; }
    if (newPass.length < 6) { setError('Yeni şifre en az 6 karakter olmalı'); return; }
    setLoading(true); setError('');
    try {
      await api.put('/auth/change-password', { current_password: current, new_password: newPass }, token);
      setSuccess(true);
      setTimeout(() => navigation.goBack(), 1500);
    } catch { setError('Mevcut şifre yanlış'); }
    setLoading(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Şifre Değiştir</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.form}>
        {error ? <View style={[styles.msgBox, { backgroundColor: 'rgba(239,68,68,0.1)' }]}><Text style={{ color: '#EF4444', fontSize: 13 }}>{error}</Text></View> : null}
        {success ? <View style={[styles.msgBox, { backgroundColor: 'rgba(16,185,129,0.1)' }]}><Text style={{ color: '#10B981', fontSize: 13 }}>Şifre başarıyla değiştirildi</Text></View> : null}

        <Text style={[styles.label, { color: colors.textSecondary }]}>Mevcut Şifre</Text>
        <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <TextInput style={[styles.input, { color: colors.text }]} value={current} onChangeText={setCurrent} secureTextEntry placeholder="••••••••" placeholderTextColor={colors.textMuted} />
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Yeni Şifre</Text>
        <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <TextInput style={[styles.input, { color: colors.text }]} value={newPass} onChangeText={setNewPass} secureTextEntry placeholder="••••••••" placeholderTextColor={colors.textMuted} />
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Yeni Şifre (Tekrar)</Text>
        <View style={[styles.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <TextInput style={[styles.input, { color: colors.text }]} value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="••••••••" placeholderTextColor={colors.textMuted} />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleChange} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Şifreyi Güncelle</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  form: { padding: 16 },
  msgBox: { padding: 12, borderRadius: 12, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 6, marginTop: 12 },
  inputWrap: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 48 },
  input: { flex: 1, fontSize: 14, height: '100%' },
  saveBtn: { backgroundColor: BRAND.primary, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 28 },
});
