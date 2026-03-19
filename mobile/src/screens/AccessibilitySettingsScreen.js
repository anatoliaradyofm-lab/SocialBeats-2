import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

const THEME_OPTIONS = [
  { key: 'dark',   label: 'Karanlık', icon: 'moon-outline' },
  { key: 'light',  label: 'Aydınlık', icon: 'sunny-outline' },
  { key: 'system', label: 'Otomatik', icon: 'phone-portrait-outline' },
];

const COLOR_THEMES = [
  { key: 'purple', color: '#A855F7' },
  { key: 'blue',   color: '#3B82F6' },
  { key: 'cyan',   color: '#22D3EE' },
  { key: 'green',  color: '#10B981' },
  { key: 'rose',   color: '#F43F5E' },
  { key: 'orange', color: '#F97316' },
  { key: 'yellow', color: '#EAB308' },
  { key: 'pink',   color: '#EC4899' },
];

export default function AccessibilitySettingsScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [themeMode,     setThemeMode]    = useState('dark');
  const [colorTheme,    setColorTheme]   = useState('purple');
  const [highContrast,  setHighContrast] = useState(false);
  const [reduceMotion,  setReduceMotion] = useState(false);
  const [largeText,     setLargeText]    = useState(false);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Erişilebilirlik ve Görünüm</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}>

        {/* Tema modu */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
          <View style={[s.sectionHeader, { borderBottomColor: colors.borderLight }]}>
            <View style={[s.sectionIcon, { backgroundColor: '#A78BFA22' }]}>
              <Ionicons name="contrast-outline" size={16} color="#A78BFA" />
            </View>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Görünüm</Text>
          </View>

          <View style={[s.themeRow, { borderBottomColor: colors.borderLight }]}>
            {THEME_OPTIONS.map(opt => {
              const active = themeMode === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[s.themeBtn, { backgroundColor: active ? colors.primary : colors.surfaceHigh, flex: 1 }]}
                  onPress={() => setThemeMode(opt.key)}
                  activeOpacity={0.72}
                >
                  <Ionicons name={opt.icon} size={18} color={active ? '#fff' : colors.textMuted} />
                  <Text style={[s.themeBtnText, { color: active ? '#fff' : colors.textMuted }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={s.colorRow}>
            <Text style={[s.rowLabel, { color: colors.text, marginBottom: 10 }]}>Tema Rengi</Text>
            <View style={s.swatches}>
              {COLOR_THEMES.map(c => (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => setColorTheme(c.key)}
                  style={[s.swatch, { backgroundColor: c.color, borderWidth: colorTheme === c.key ? 3 : 0, borderColor: '#fff' }]}
                  activeOpacity={0.75}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Erişilebilirlik */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
          <View style={[s.sectionHeader, { borderBottomColor: colors.borderLight }]}>
            <View style={[s.sectionIcon, { backgroundColor: '#F472B622' }]}>
              <Ionicons name="accessibility-outline" size={16} color="#F472B6" />
            </View>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Erişilebilirlik</Text>
          </View>

          {[
            { key: 'highContrast', label: 'Yüksek Kontrast', sub: 'Metin ve arka plan kontrastını artır', value: highContrast, set: setHighContrast },
            { key: 'reduceMotion', label: 'Animasyonları Azalt', sub: 'Geçiş animasyonlarını devre dışı bırak', value: reduceMotion, set: setReduceMotion },
            { key: 'largeText',   label: 'Büyük Metin', sub: 'Uygulama içi yazı tipi boyutunu artır', value: largeText, set: setLargeText },
          ].map((item, i, arr) => (
            <View
              key={item.key}
              style={[s.toggleRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.rowLabel, { color: colors.text }]}>{item.label}</Text>
                <Text style={[s.rowSub, { color: colors.textMuted }]}>{item.sub}</Text>
              </View>
              <Switch
                value={item.value}
                onValueChange={item.set}
                trackColor={{ false: colors.surfaceHigh, true: colors.primary + '99' }}
                thumbColor={item.value ? colors.primary : colors.textMuted}
              />
            </View>
          ))}
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
  scroll: { padding: 16, gap: 16 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1 },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  themeRow: { flexDirection: 'row', gap: 8, padding: 12, borderBottomWidth: 1 },
  themeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  themeBtnText: { fontSize: 13, fontWeight: '600' },
  colorRow: { padding: 16 },
  swatches: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  swatch: { width: 32, height: 32, borderRadius: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12 },
});
