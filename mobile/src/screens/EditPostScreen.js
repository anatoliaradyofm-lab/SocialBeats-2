/**
 * EditPostScreen - Gönderi düzenleme
 * Backend: PUT /social/posts/{post_id}
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

export default function EditPostScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { postId, initialContent = '', initialMedia = [] } = route.params || {};
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!postId || !token) return;
    setSaving(true);
    try {
      await api.put(`/social/posts/${postId}`, {
        content: content.trim() || ' ',
        media_urls: initialMedia,
        visibility: 'public',
        allow_comments: true,
      }, token);
      Alert.alert(t('common.success'), t('editPost.success'), [{ text: t('common.ok'), onPress: () => navigation.goBack() }]);
    } catch (err) {
      Alert.alert(t('common.error'), err?.data?.detail || t('editPost.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>{t('editPost.cancel')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('editPost.title')}</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveText}>{t('editPost.save')}</Text>}
        </TouchableOpacity>
      </View>
      <TextInput
        style={[styles.input, { margin: 16 }]}
        placeholder={t('editPost.placeholder')}
        placeholderTextColor="#6B7280"
        value={content}
        onChangeText={setContent}
        multiline
        numberOfLines={6}
      />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  cancelText: { color: colors.accent, fontSize: 16 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  saveBtn: { backgroundColor: '#8B5CF6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  saveText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  btnDisabled: { opacity: 0.7 },
  input: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    minHeight: 150,
    textAlignVertical: 'top',
  },
});
