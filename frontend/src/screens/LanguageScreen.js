import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { useSettingsStore } from '../stores/settingsStore';

const LANGUAGES = [
  { id: 'tr', label: 'Türkçe', native: 'Türkçe', flag: '🇹🇷' },
  { id: 'en', label: 'İngilizce', native: 'English', flag: '🇬🇧' },
  { id: 'de', label: 'Almanca', native: 'Deutsch', flag: '🇩🇪' },
  { id: 'fr', label: 'Fransızca', native: 'Français', flag: '🇫🇷' },
  { id: 'es', label: 'İspanyolca', native: 'Español', flag: '🇪🇸' },
  { id: 'ar', label: 'Arapça', native: 'العربية', flag: '🇸🇦' },
  { id: 'ru', label: 'Rusça', native: 'Русский', flag: '🇷🇺' },
  { id: 'ja', label: 'Japonca', native: '日本語', flag: '🇯🇵' },
  { id: 'ko', label: 'Korece', native: '한국어', flag: '🇰🇷' },
  { id: 'pt', label: 'Portekizce', native: 'Português', flag: '🇧🇷' },
  { id: 'it', label: 'İtalyanca', native: 'Italiano', flag: '🇮🇹' },
  { id: 'zh', label: 'Çince', native: '中文', flag: '🇨🇳' },
];

export default function LanguageScreen({ navigation }) {
  const { colors } = useTheme();
  const { language, setLanguage } = useSettingsStore();
  const [selected, setSelected] = useState(language);

  const handleSelect = (id) => {
    setSelected(id);
    setLanguage(id);
    try {
      const i18n = require('i18next').default;
      i18n.changeLanguage(id);
    } catch {}
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Dil</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={LANGUAGES}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border, backgroundColor: selected === item.id ? 'rgba(124,58,237,0.06)' : 'transparent' }]} onPress={() => handleSelect(item.id)}>
            <Text style={{ fontSize: 22 }}>{item.flag}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: selected === item.id ? '600' : '400' }}>{item.label}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.native}</Text>
            </View>
            {selected === item.id && <Ionicons name="checkmark-circle" size={22} color={BRAND.primary} />}
          </TouchableOpacity>
        )}
        keyExtractor={item => item.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, gap: 14 },
});
