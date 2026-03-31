import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import i18n from '../i18n';
import { LinearGradient } from 'expo-linear-gradient';
import { COUNTRIES } from '../lib/countries';

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

  // Country state
  const [selectedCountry, setSelectedCountry] = useState(() => {
    try { return localStorage.getItem('sb_country') || ''; } catch { return ''; }
  });
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');

  const handleSelect = (code) => {
    setSelected(code);
    i18n.changeLanguage(code);
    try { localStorage.setItem('sb_language', code); } catch {}
  };

  const handleCountrySelect = (country) => {
    setSelectedCountry(country.name);
    setShowCountryModal(false);
    try { localStorage.setItem('sb_country', country.name); } catch {}
  };

  const filtered = LANGUAGES.filter(l => l.label.toLowerCase().includes(query.toLowerCase()));
  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countryQuery.toLowerCase())
  );

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[s.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Dil ve Bölge</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Country section */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={[s.sectionTitle, { color: colors.textMuted }]}>BÖLGE</Text>
        <TouchableOpacity
          style={[s.card, { backgroundColor: colors.card, borderColor: colors.glassBorder, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 }]}
          onPress={() => { setCountryQuery(''); setShowCountryModal(true); }}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 22 }}>
            {selectedCountry ? (COUNTRIES.find(c => c.name === selectedCountry)?.flag ?? '🌍') : '🌍'}
          </Text>
          <Text style={{ flex: 1, color: selectedCountry ? colors.text : colors.textMuted, fontSize: 15, fontWeight: '600' }}>
            {selectedCountry || 'Ülke seçin'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textGhost} />
        </TouchableOpacity>
      </View>

      {/* Country modal */}
      <Modal visible={showCountryModal} animationType="slide" transparent onRequestClose={() => setShowCountryModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#130D22', borderRadius: 20, maxHeight: '80%', paddingBottom: 24 }}>
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
            </View>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', paddingHorizontal: 20, paddingBottom: 12 }}>Ülke Seç</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12 }}>
              <Ionicons name="search-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={{ flex: 1, color: colors.text, fontSize: 15, paddingVertical: 10, paddingLeft: 8 }}
                placeholder="Ülke ara..."
                placeholderTextColor={colors.textMuted}
                value={countryQuery}
                onChangeText={setCountryQuery}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredCountries}
              keyExtractor={c => c.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 20, gap: 12 }}
                  onPress={() => handleCountrySelect(item)}
                >
                  <Text style={{ width: 34, fontSize: 22 }}>{item.flag}</Text>
                  <Text style={{ flex: 1, color: selectedCountry === item.name ? colors.primary : colors.text, fontSize: 15, fontWeight: selectedCountry === item.name ? '700' : '500' }}>
                    {item.name}
                  </Text>
                  {selectedCountry === item.name && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Text style={[s.sectionTitle, { color: colors.textMuted, paddingHorizontal: 16, paddingTop: 16 }]}>DİL</Text>

      <View style={[s.searchWrap, { backgroundColor: colors.surface, borderColor: colors.glassBorder, marginHorizontal: 16, marginTop: 8 }]}>
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
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  scroll: { padding: 16, gap: 16 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  flag: { fontSize: 22 },
  langLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
});
