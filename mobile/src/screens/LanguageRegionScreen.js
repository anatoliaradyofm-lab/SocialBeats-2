import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import i18n from '../i18n';

const LANGUAGES = [
  { code: 'tr', label: 'Türkçe',    flag: '🇹🇷' },
  { code: 'en', label: 'English',   flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch',   flag: '🇩🇪' },
  { code: 'fr', label: 'Français',  flag: '🇫🇷' },
  { code: 'es', label: 'Español',   flag: '🇪🇸' },
  { code: 'it', label: 'Italiano',  flag: '🇮🇹' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'ru', label: 'Русский',   flag: '🇷🇺' },
  { code: 'ar', label: 'العربية',   flag: '🇸🇦' },
  { code: 'ja', label: '日本語',     flag: '🇯🇵' },
  { code: 'ko', label: '한국어',     flag: '🇰🇷' },
  { code: 'zh', label: '中文',       flag: '🇨🇳' },
  { code: 'hi', label: 'हिन्दी',    flag: '🇮🇳' },
  { code: 'id', label: 'Indonesia', flag: '🇮🇩' },
  { code: 'nl', label: 'Nederlands',flag: '🇳🇱' },
  { code: 'pl', label: 'Polski',    flag: '🇵🇱' },
  { code: 'uk', label: 'Українська',flag: '🇺🇦' },
  { code: 'vi', label: 'Tiếng Việt',flag: '🇻🇳' },
  { code: 'th', label: 'ไทย',       flag: '🇹🇭' },
  { code: 'ms', label: 'Melayu',    flag: '🇲🇾' },
];

export default function LanguageRegionScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(() => {
    try { return localStorage.getItem('sb_language') || i18n.language || 'tr'; } catch { return i18n.language || 'tr'; }
  });
  const [query, setQuery] = useState('');

  const handleSelect = (code) => {
    setSelected(code);
    i18n.changeLanguage(code);
    try { localStorage.setItem('sb_language', code); } catch {}
  };

  const filtered = LANGUAGES.filter(l => l.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Dil ve Bölge</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[s.searchWrap, { backgroundColor: colors.surface, borderColor: colors.glassBorder, marginHorizontal: 16, marginTop: 16 }]}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={[s.searchInput, { color: colors.text }]}
          placeholder="Dil ara..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}>
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
          {filtered.map((lang, i) => {
            const active = selected === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[s.row, i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
                onPress={() => handleSelect(lang.code)}
                activeOpacity={0.72}
              >
                <Text style={s.flag}>{lang.flag}</Text>
                <Text style={[s.langLabel, { color: colors.text }]}>{lang.label}</Text>
                {active && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15 },
  scroll: { padding: 16, gap: 16 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  flag: { fontSize: 22 },
  langLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
});
