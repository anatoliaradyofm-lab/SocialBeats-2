import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

const QUALITY_OPTIONS = ['Düşük', 'Normal', 'Yüksek', 'Lossless'];

function SectionTitle({ title, color, icon, colors }) {
  return (
    <View style={[st.sectionHeader, { borderBottomColor: colors.borderLight }]}>
      <View style={[st.sectionIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[st.sectionTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );
}

function QualityPicker({ label, value, onChange, colors }) {
  return (
    <View style={[st.pickerRow, { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
      <Text style={[st.rowLabel, { color: colors.text }]}>{label}</Text>
      <View style={st.pills}>
        {QUALITY_OPTIONS.map(opt => {
          const active = value === opt;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => onChange(opt)}
              style={[st.pill, { backgroundColor: active ? colors.primary : colors.surfaceHigh, borderColor: active ? colors.primary : 'transparent' }]}
              activeOpacity={0.7}
            >
              <Text style={[st.pillText, { color: active ? '#fff' : colors.textMuted }]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function ToggleRow({ label, sub, value, onChange, last, colors }) {
  return (
    <View style={[st.toggleRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[st.rowLabel, { color: colors.text }]}>{label}</Text>
        {sub ? <Text style={[st.rowSub, { color: colors.textMuted }]}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.surfaceHigh, true: colors.primary + '99' }}
        thumbColor={value ? colors.primary : colors.textMuted}
      />
    </View>
  );
}

export default function AudioSettingsScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [cellQuality,   setCellQuality]   = useState('Normal');
  const [wifiQuality,   setWifiQuality]   = useState('Yüksek');
  const [dlQuality,     setDlQuality]     = useState('Yüksek');
  const [gapless,       setGapless]       = useState(true);
  const [crossfade,     setCrossfade]     = useState(0);
  const [normalize,     setNormalize]     = useState(true);
  const [dac,           setDac]           = useState(false);
  const [carMode,       setCarMode]       = useState(false);
  const [spatialAudio,  setSpatialAudio]  = useState(false);
  const [eqEnabled,     setEqEnabled]     = useState(false);

  return (
    <View style={[st.root, { backgroundColor: colors.background }]}>
      <View style={[st.header, { paddingTop: insets.top + 16, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: colors.text }]}>Ses ve Oynatma</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + 32 }]}>

        {/* 1. Ses Kalitesi */}
        <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
          <SectionTitle title="Ses Kalitesi" color="#34D399" icon="cellular-outline" colors={colors} />
          <QualityPicker label="Hücresel Veri" value={cellQuality} onChange={setCellQuality} colors={colors} />
          <QualityPicker label="Wi-Fi" value={wifiQuality} onChange={setWifiQuality} colors={colors} />
          <View style={st.pickerRow}>
            <Text style={[st.rowLabel, { color: colors.text }]}>İndirme</Text>
            <View style={st.pills}>
              {['Normal', 'Yüksek', 'Lossless'].map(opt => {
                const active = dlQuality === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setDlQuality(opt)}
                    style={[st.pill, { backgroundColor: active ? colors.primary : colors.surfaceHigh, borderColor: active ? colors.primary : 'transparent' }]}
                    activeOpacity={0.7}
                  >
                    <Text style={[st.pillText, { color: active ? '#fff' : colors.textMuted }]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* 2. Playback */}
        <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
          <SectionTitle title="Oynatma Teknolojisi" color="#A78BFA" icon="play-circle-outline" colors={colors} />
          <ToggleRow label="Gapless Playback" sub="Şarkılar arası boşluksuz geçiş" value={gapless} onChange={setGapless} colors={colors} />
          <View style={[st.toggleRow, { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[st.rowLabel, { color: colors.text }]}>Crossfade</Text>
              <Text style={[st.rowSub, { color: colors.textMuted }]}>{crossfade === 0 ? 'Kapalı' : `${crossfade}s geçiş`}</Text>
            </View>
            <Text style={[st.sliderVal, { color: colors.primary }]}>{crossfade}s</Text>
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <Slider
              value={crossfade}
              minimumValue={0}
              maximumValue={12}
              step={1}
              onValueChange={setCrossfade}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.surfaceHigh}
              thumbTintColor={colors.primary}
            />
          </View>
          <ToggleRow label="Ses Normalizasyonu" sub="Şarkılar arası ses seviyesi eşitleme" value={normalize} onChange={setNormalize} last colors={colors} />
        </View>

        {/* 3. Donanım */}
        <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
          <SectionTitle title="Donanım Ayarları" color="#FBBF24" icon="hardware-chip-outline" colors={colors} />
          <ToggleRow label="Harici DAC" sub="Bit-perfect çıkış, harici DAC/amp için" value={dac} onChange={setDac} colors={colors} />
          <ToggleRow label="Araç Modu (CarPlay)" sub="Büyük dokunma hedefleri, sesli komut" value={carMode} onChange={setCarMode} last colors={colors} />
        </View>

        {/* 4. Ekolayzır */}
        <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.glassBorder }]}>
          <SectionTitle title="Ekolayzır" color="#F472B6" icon="equalizer-outline" colors={colors} />
          <ToggleRow label="Dolby Atmos / Spatial Audio" sub="Uzamsal ses (cihaz destekliyorsa)" value={spatialAudio} onChange={setSpatialAudio} colors={colors} />
          <View style={st.navRow}>
            <ToggleRow label="Ekolayzır" sub="10-bant grafik EQ" value={eqEnabled} onChange={setEqEnabled} colors={colors} />
          </View>
          <TouchableOpacity
            style={[st.navItemRow, { borderTopWidth: 1, borderTopColor: colors.borderLight }]}
            onPress={() => navigation.navigate('Equalizer')}
            activeOpacity={0.72}
          >
            <Text style={[st.rowLabel, { color: colors.text }]}>EQ Ayarlarını Aç</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textGhost} />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  scroll: { padding: 16, gap: 16 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1 },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  pickerRow: { paddingHorizontal: 16, paddingVertical: 13, gap: 10 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12 },
  pills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  sliderVal: { fontSize: 14, fontWeight: '700', minWidth: 28, textAlign: 'right' },
  navRow: {},
  navItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 15 },
});
