import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, FlatList, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import i18n, { SUPPORTED_LANGUAGES } from '../i18n';
import { LinearGradient } from 'expo-linear-gradient';
import { COUNTRIES } from '../lib/countries';
import localizationService from '../services/LocalizationService';
import { useTranslation } from 'react-i18next';

export default function LanguageRegionScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [selected, setSelected] = useState(() => {
    try { return localStorage.getItem('sb_language') || i18n.language || 'tr'; } catch { return i18n.language || 'tr'; }
  });
  const [showLangModal, setShowLangModal] = useState(false);
  const [langQuery, setLangQuery] = useState('');

  const [selectedCountry, setSelectedCountry] = useState(() => {
    try { return localStorage.getItem('sb_country') || ''; } catch { return ''; }
  });
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');

  const handleSelect = async (code) => {
    setSelected(code);
    setShowLangModal(false);
    setLangQuery('');
    await i18n.changeLanguage(code);
    try { localStorage.setItem('sb_language', code); } catch {}
    try { await localizationService.saveLanguage(code); } catch {}
  };

  const handleCountrySelect = (country) => {
    setSelectedCountry(country.name);
    setShowCountryModal(false);
    setCountryQuery('');
    try { localStorage.setItem('sb_country', country.name); } catch {}
  };

  const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === selected);
  const filteredLangs = SUPPORTED_LANGUAGES.filter(l =>
    l.name.toLowerCase().includes(langQuery.toLowerCase())
  );
  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countryQuery.toLowerCase())
  );

  const LangModalContent = () => (
    <View style={[cm.sheet, { paddingBottom: insets.bottom + 16 }]}>
      <LinearGradient colors={['rgba(26,10,46,0.35)', 'rgba(16,8,28,0.10)', 'rgba(10,5,18,0.02)', 'transparent']} locations={[0, 0.38, 0.68, 1]} style={cm.topGrad} pointerEvents="none" />
      <View style={cm.handle} />
      <View style={cm.headerRow}>
        <Text style={[cm.title, { color: colors.text }]}>{t('settings.selectLanguage')}</Text>
        <TouchableOpacity onPress={() => { setShowLangModal(false); setLangQuery(''); }} style={cm.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
      <View style={[cm.searchRow, { backgroundColor: 'rgba(255,255,255,0.07)' }]}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          style={[cm.searchInput, { color: colors.text }]}
          placeholder={t('settings.searchLanguagePlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={langQuery}
          onChangeText={setLangQuery}
          autoFocus={Platform.OS !== 'web'}
        />
        {langQuery.length > 0 && (
          <TouchableOpacity onPress={() => setLangQuery('')}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={filteredLangs}
        keyExtractor={l => l.code}
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: 380 }}
        renderItem={({ item }) => {
          const active = selected === item.code;
          return (
            <TouchableOpacity
              style={cm.optRow}
              onPress={() => handleSelect(item.code)}
              activeOpacity={0.72}
            >
              <Text style={cm.flag}>{item.flag}</Text>
              <Text style={[cm.optLabel, { color: active ? colors.primary : colors.text, fontWeight: active ? '700' : '500' }]}>
                {item.name}
              </Text>
              {active && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );

  const CountryModalContent = () => (
    <View style={[cm.sheet, { paddingBottom: insets.bottom + 16 }]}>
      <View style={cm.handle} />
      <View style={cm.headerRow}>
        <Text style={[cm.title, { color: colors.text }]}>{t('settings.selectCountryTitle')}</Text>
        <TouchableOpacity onPress={() => { setShowCountryModal(false); setCountryQuery(''); }} style={cm.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
      <View style={[cm.searchRow, { backgroundColor: 'rgba(255,255,255,0.07)' }]}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          style={[cm.searchInput, { color: colors.text }]}
          placeholder={t('settings.searchCountry')}
          placeholderTextColor={colors.textMuted}
          value={countryQuery}
          onChangeText={setCountryQuery}
          autoFocus={Platform.OS !== 'web'}
        />
        {countryQuery.length > 0 && (
          <TouchableOpacity onPress={() => setCountryQuery('')}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={filteredCountries}
        keyExtractor={c => c.code}
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: 380 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={cm.optRow}
            onPress={() => handleCountrySelect(item)}
            activeOpacity={0.72}
          >
            <Text style={cm.flag}>{item.flag}</Text>
            <Text style={[cm.optLabel, { color: selectedCountry === item.name ? colors.primary : colors.text, fontWeight: selectedCountry === item.name ? '700' : '500' }]}>
              {item.name}
            </Text>
            {selectedCountry === item.name && (
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );

  const ModalWrapper = ({ visible, onClose, children }) => {
    if (Platform.OS === 'web') {
      if (!visible) return null;
      return (
        <View style={[StyleSheet.absoluteFill, cm.overlay]} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          {children}
        </View>
      );
    }
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <Pressable style={cm.overlay} onPress={onClose}>
          <Pressable onPress={e => e.stopPropagation()}>
            {children}
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

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
        <Text style={[s.headerTitle, { color: colors.text }]}>{t('settings.languageRegion')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.body}>
        {/* Bölge */}
        <Text style={[s.sectionTitle, { color: colors.textMuted }]}>{t('settings.region')}</Text>
        <TouchableOpacity
          style={[s.selectorRow, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}
          onPress={() => { setCountryQuery(''); setShowCountryModal(true); }}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 22 }}>
            {selectedCountry ? (COUNTRIES.find(c => c.name === selectedCountry)?.flag ?? '🌍') : '🌍'}
          </Text>
          <Text style={[s.selectorLabel, { color: selectedCountry ? colors.text : colors.textMuted }]}>
            {selectedCountry || t('settings.selectCountry')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textGhost} />
        </TouchableOpacity>

        {/* Dil */}
        <Text style={[s.sectionTitle, { color: colors.textMuted, marginTop: 24 }]}>{t('settings.languageSection')}</Text>
        <TouchableOpacity
          style={[s.selectorRow, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}
          onPress={() => { setLangQuery(''); setShowLangModal(true); }}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 22 }}>{selectedLang?.flag ?? '🌐'}</Text>
          <Text style={[s.selectorLabel, { color: colors.text }]}>
            {selectedLang?.name ?? t('settings.selectLanguage')}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textGhost} />
        </TouchableOpacity>
      </View>

      <ModalWrapper visible={showLangModal} onClose={() => { setShowLangModal(false); setLangQuery(''); }}>
        <LangModalContent />
      </ModalWrapper>

      <ModalWrapper visible={showCountryModal} onClose={() => { setShowCountryModal(false); setCountryQuery(''); }}>
        <CountryModalContent />
      </ModalWrapper>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  body: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  selectorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 20, borderWidth: 1 },
  selectorLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
});

const cm = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(8,6,15,0.88)', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: '#08060F', borderTopLeftRadius: 32, borderTopRightRadius: 32, borderTopWidth: 1, borderColor: 'rgba(192,132,252,0.18)' },
  topGrad:   { position: 'absolute', top: 0, left: 0, right: 0, height: 110, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  handle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(192,132,252,0.30)', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  title:     { fontSize: 17, fontWeight: '700' },
  closeBtn:  { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, gap: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 10 },
  optRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 20, gap: 12 },
  flag:      { width: 34, fontSize: 22 },
  optLabel:  { flex: 1, fontSize: 15 },
});
