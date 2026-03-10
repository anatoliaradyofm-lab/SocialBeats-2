import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import { useTheme } from '../contexts/ThemeContext';

const PRESETS = [
  { id: 'flat', name: 'Flat', bands: [0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'bass_boost', name: 'Bass Boost', bands: [6, 5, 3, 1, 0, 0, 0, 0] },
  { id: 'treble_boost', name: 'Treble Boost', bands: [0, 0, 0, 0, 1, 3, 5, 6] },
  { id: 'rock', name: 'Rock', bands: [5, 3, 1, 0, -1, 1, 3, 4] },
  { id: 'pop', name: 'Pop', bands: [-1, 2, 4, 3, 1, -1, -2, -1] },
  { id: 'jazz', name: 'Jazz', bands: [3, 2, 1, 2, -1, -1, 0, 1] },
  { id: 'classical', name: 'Classical', bands: [4, 3, 1, 0, 0, 1, 3, 4] },
  { id: 'hip_hop', name: 'Hip Hop', bands: [5, 4, 1, 2, -1, 1, 0, 2] },
  { id: 'electronic', name: 'Electronic', bands: [4, 3, 0, -1, 0, 2, 4, 5] },
  { id: 'vocal', name: 'Vocal', bands: [-2, -1, 2, 4, 4, 2, 0, -1] },
];

const BAND_LABELS = ['60Hz', '170Hz', '310Hz', '600Hz', '1kHz', '3kHz', '6kHz', '12kHz'];

export default function EqualizerScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('flat');
  const [bands, setBands] = useState([0, 0, 0, 0, 0, 0, 0, 0]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('eq_settings');
      if (saved) {
        const data = JSON.parse(saved);
        setEnabled(data.enabled || false);
        setSelectedPreset(data.preset || 'flat');
        setBands(data.bands || [0, 0, 0, 0, 0, 0, 0, 0]);
      }
    } catch {}
  };

  const saveSettings = async (preset, newBands, en) => {
    try {
      await AsyncStorage.setItem('eq_settings', JSON.stringify({
        enabled: en ?? enabled,
        preset,
        bands: newBands,
      }));
    } catch {}
  };

  const selectPreset = (preset) => {
    setSelectedPreset(preset.id);
    setBands([...preset.bands]);
    saveSettings(preset.id, preset.bands);
  };

  const updateBand = (index, value) => {
    const newBands = [...bands];
    newBands[index] = Math.round(value);
    setBands(newBands);
    setSelectedPreset('custom');
    saveSettings('custom', newBands);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('settings.equalizer') || 'Equalizer'}</Text>
        <TouchableOpacity onPress={() => { setEnabled(!enabled); saveSettings(selectedPreset, bands, !enabled); }}>
          <Text style={[styles.toggleText, enabled && styles.toggleActive]}>
            {enabled ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.visualizer, !enabled && styles.disabled]}>
        {bands.map((val, i) => (
          <View key={i} style={styles.bandColumn}>
            <Text style={styles.bandValue}>{val > 0 ? `+${val}` : val}dB</Text>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={-8}
                maximumValue={8}
                step={1}
                value={val}
                onValueChange={(v) => updateBand(i, v)}
                minimumTrackTintColor="#8B5CF6"
                maximumTrackTintColor="#374151"
                thumbTintColor="#8B5CF6"
                disabled={!enabled}
              />
            </View>
            <Text style={styles.bandLabel}>{BAND_LABELS[i]}</Text>
          </View>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
        {PRESETS.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.presetChip, selectedPreset === p.id && styles.presetChipActive]}
            onPress={() => selectPreset(p)}
            disabled={!enabled}
          >
            <Text style={[styles.presetText, selectedPreset === p.id && styles.presetTextActive]}>
              {p.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  toggleText: { color: '#6B7280', fontSize: 16, fontWeight: '700' },
  toggleActive: { color: colors.accent },
  visualizer: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 8, paddingVertical: 24 },
  disabled: { opacity: 0.4 },
  bandColumn: { alignItems: 'center', flex: 1 },
  bandValue: { color: colors.accent, fontSize: 11, fontWeight: '600', marginBottom: 8 },
  sliderContainer: { height: 180, justifyContent: 'center', transform: [{ rotate: '-90deg' }], width: 180 },
  slider: { width: 180 },
  bandLabel: { color: '#9CA3AF', fontSize: 10, marginTop: 8 },
  presetScroll: { paddingHorizontal: 16, maxHeight: 50 },
  presetChip: { backgroundColor: colors.card, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  presetChipActive: { backgroundColor: '#8B5CF6' },
  presetText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
  presetTextActive: { color: colors.text },
});
