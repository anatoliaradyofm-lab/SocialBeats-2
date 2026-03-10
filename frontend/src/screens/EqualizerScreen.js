import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { usePlayer } from '../contexts/PlayerContext';

const { width: SW } = Dimensions.get('window');
const BANDS = ['32', '64', '125', '250', '500', '1K', '2K', '4K', '8K', '16K'];
const PRESETS = [
  { name: 'Düz', values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Rock', values: [4, 3, 1, -1, 0, 1, 3, 4, 4, 3] },
  { name: 'Pop', values: [-1, 1, 3, 4, 4, 3, 1, 0, -1, -1] },
  { name: 'Jazz', values: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3] },
  { name: 'Elektronik', values: [4, 3, 1, 0, -2, -1, 0, 2, 4, 5] },
  { name: 'Klasik', values: [3, 3, 2, 1, -1, -1, 0, 1, 2, 3] },
  { name: 'Hip Hop', values: [5, 4, 3, 1, 0, -1, 1, 0, 2, 3] },
  { name: 'Bass Boost', values: [6, 5, 4, 2, 0, -1, -1, 0, 0, 0] },
  { name: 'Vokal', values: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1] },
  { name: 'Akustik', values: [3, 2, 1, 0, 1, 1, 2, 3, 2, 1] },
];

function BandSlider({ band, value, onChange, colors }) {
  return (
    <View style={styles.bandCol}>
      <Text style={[styles.bandValue, { color: value === 0 ? colors.textMuted : BRAND.primary }]}>
        {value > 0 ? `+${value}` : value}
      </Text>
      <View style={styles.sliderWrap}>
        <Slider
          style={styles.bandSlider}
          minimumValue={-6}
          maximumValue={6}
          step={1}
          value={value}
          onValueChange={onChange}
          minimumTrackTintColor={BRAND.accent}
          maximumTrackTintColor={colors.border}
          thumbTintColor={BRAND.primary}
        />
      </View>
      <Text style={[styles.bandLabel, { color: colors.textSecondary }]}>{band}</Text>
    </View>
  );
}

export default function EqualizerScreen({ navigation }) {
  const { colors } = useTheme();
  const {
    equalizerEnabled, equalizerValues, equalizerPreset,
    setEqualizerValues, setEqualizerPreset, toggleEqualizer,
  } = usePlayer();

  const values = equalizerValues;
  const activePreset = equalizerPreset;
  const enabled = equalizerEnabled;

  const applyPreset = (preset) => {
    setEqualizerValues([...preset.values]);
    setEqualizerPreset(preset.name);
  };

  const updateBand = (index, value) => {
    const next = [...values];
    next[index] = value;
    setEqualizerValues(next);
    setEqualizerPreset('');
  };

  const reset = () => {
    setEqualizerValues([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    setEqualizerPreset('Düz');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Ekolayzır</Text>
        <TouchableOpacity onPress={reset}>
          <Text style={{ color: BRAND.primaryLight, fontSize: 14, fontWeight: '500' }}>Sıfırla</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Enable toggle */}
        <TouchableOpacity
          style={[styles.enableRow, { backgroundColor: colors.surfaceElevated }]}
          onPress={toggleEqualizer}
        >
          <Ionicons name="options" size={20} color={enabled ? BRAND.primary : colors.textMuted} />
          <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>Ekolayzır</Text>
          <View style={[styles.toggle, { backgroundColor: enabled ? BRAND.primary : colors.border }]}>
            <View style={[styles.toggleDot, { alignSelf: enabled ? 'flex-end' : 'flex-start' }]} />
          </View>
        </TouchableOpacity>

        {/* Bands */}
        <View style={[styles.bandsSection, { opacity: enabled ? 1 : 0.4 }]}>
          <View style={styles.bandsRow}>
            {BANDS.map((b, i) => (
              <BandSlider key={b} band={b} value={values[i]} onChange={(v) => updateBand(i, v)} colors={colors} />
            ))}
          </View>
          <View style={[styles.scaleRow]}>
            <Text style={[styles.scaleLabel, { color: colors.textMuted }]}>+6 dB</Text>
            <Text style={[styles.scaleLabel, { color: colors.textMuted }]}>0 dB</Text>
            <Text style={[styles.scaleLabel, { color: colors.textMuted }]}>-6 dB</Text>
          </View>
        </View>

        {/* Presets */}
        <Text style={[styles.presetsTitle, { color: colors.text }]}>Hazır Ayarlar</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
          {PRESETS.map(p => (
            <TouchableOpacity
              key={p.name}
              style={[styles.presetChip, { backgroundColor: activePreset === p.name ? BRAND.primary : colors.surfaceElevated }]}
              onPress={() => applyPreset(p)}
            >
              <Text style={{ color: activePreset === p.name ? '#FFF' : colors.textSecondary, fontSize: 13, fontWeight: '500' }}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Visual */}
        <View style={[styles.visualSection, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 12 }}>Frekans Yanıtı</Text>
          <View style={styles.visualBars}>
            {values.map((v, i) => {
              const h = ((v + 6) / 12) * 80 + 4;
              return (
                <View key={i} style={styles.visualBarCol}>
                  <View style={[styles.visualBar, {
                    height: h,
                    backgroundColor: v >= 0 ? BRAND.primary : BRAND.accent,
                    opacity: 0.5 + (h / 84) * 0.5,
                  }]} />
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  enableRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, padding: 14, borderRadius: 14, gap: 12, marginBottom: 20 },
  toggle: { width: 44, height: 24, borderRadius: 12, padding: 2 },
  toggleDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },

  bandsSection: { paddingHorizontal: 8 },
  bandsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  bandCol: { alignItems: 'center', flex: 1 },
  bandValue: { fontSize: 10, fontWeight: '600', marginBottom: 4 },
  sliderWrap: { height: 160, width: 36, justifyContent: 'center' },
  bandSlider: { width: 160, height: 36, transform: [{ rotate: '-90deg' }] },
  bandLabel: { fontSize: 9, marginTop: 4 },

  scaleRow: { flexDirection: 'column', position: 'absolute', right: 0, top: 16, height: 160, justifyContent: 'space-between' },
  scaleLabel: { fontSize: 9 },

  presetsTitle: { fontSize: 17, fontWeight: '600', paddingHorizontal: 16, marginTop: 28, marginBottom: 12 },
  presetRow: { paddingHorizontal: 16, gap: 8 },
  presetChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },

  visualSection: { marginHorizontal: 16, marginTop: 24, borderRadius: 16, padding: 16 },
  visualBars: { flexDirection: 'row', alignItems: 'flex-end', height: 84, gap: 4 },
  visualBarCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  visualBar: { width: '80%', borderRadius: 4 },
});
