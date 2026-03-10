/**
 * MusicTasteTestScreen - Müzik zevki testi (onboarding)
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const GENRES = [
  'Pop', 'Rock', 'Hip-Hop', 'R&B', 'Electronic', 'Jazz', 'Klasik', 'Metal',
  'Alternatif', 'Folk', 'Türkçe Pop', 'Türkçe Rock', 'Arabesk', 'Latin',
];

const MOODS = [
  { id: 'energetic', label: 'Enerjik', icon: 'flash' },
  { id: 'relaxed', label: 'Rahat', icon: 'leaf' },
  { id: 'happy', label: 'Mutlu', icon: 'happy-outline' },
  { id: 'sad', label: 'Hüzünlü', icon: 'sad-outline' },
  { id: 'focused', label: 'Odaklanmış', icon: 'headset' },
  { id: 'romantic', label: 'Romantik', icon: 'heart' },
];

export default function MusicTasteTestScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { token, updateUser } = useAuth();
  const [step, setStep] = useState(0);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedMood, setSelectedMood] = useState(null);
  const [artistInput, setArtistInput] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleGenre = (g) => {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g].slice(0, 5)
    );
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      const artists = artistInput
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5);
      await api.put(
        '/user/profile',
        {
          favorite_genres: selectedGenres,
          favorite_artists: artists,
          music_mood: selectedMood,
        },
        token
      );
      updateUser?.({ favorite_genres: selectedGenres, favorite_artists: artists, music_mood: selectedMood });
      navigation.goBack();
    } catch (e) {
      alert(e?.data?.detail || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Müzik zevki testi</Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {step === 0 && (
          <>
            <Text style={styles.question}>Hangi türleri seviyorsun? (en fazla 5)</Text>
            <View style={styles.chips}>
              {GENRES.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, selectedGenres.includes(g) && styles.chipActive]}
                  onPress={() => toggleGenre(g)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, selectedGenres.includes(g) && styles.chipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        {step === 1 && (
          <>
            <Text style={styles.question}>Müzik dinlerken nasıl hissediyorsun?</Text>
            <View style={styles.moodGrid}>
              {MOODS.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.moodBtn, selectedMood === m.id && styles.moodBtnActive]}
                  onPress={() => setSelectedMood(selectedMood === m.id ? null : m.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={m.icon} size={28} color={selectedMood === m.id ? '#fff' : '#9CA3AF'} />
                  <Text style={[styles.moodLabel, selectedMood === m.id && styles.moodLabelActive]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        {step === 2 && (
          <>
            <Text style={styles.question}>Sevdiğin sanatçılar (virgülle ayır)</Text>
            <Text style={styles.hint}>Örn: Duman, Tarkan, Madonna</Text>
            <TextInput
              style={styles.input}
              placeholder="Sanatçı isimleri..."
              placeholderTextColor="#6B7280"
              value={artistInput}
              onChangeText={setArtistInput}
              multiline
              numberOfLines={3}
            />
          </>
        )}
        <View style={styles.footer}>
          {step < 2 ? (
            <TouchableOpacity style={styles.nextBtn} onPress={() => setStep((s) => s + 1)}>
              <Text style={styles.nextBtnText}>Devam</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextBtn, saving && styles.nextBtnDisabled]}
              onPress={handleComplete}
              disabled={saving}
            >
              <Text style={styles.nextBtnText}>{saving ? 'Kaydediliyor...' : 'Tamamla'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  backBtn: {},
  backText: { color: colors.accent, fontSize: 16 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginLeft: 16 },
  content: { padding: 20 },
  question: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 20 },
  hint: { fontSize: 14, color: '#6B7280', marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1F2937',
    borderRadius: 20,
  },
  chipActive: { backgroundColor: '#8B5CF6' },
  chipText: { fontSize: 15, color: '#9CA3AF' },
  chipTextActive: { color: colors.text, fontWeight: '600' },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  moodBtn: {
    width: '30%',
    padding: 16,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    alignItems: 'center',
  },
  moodBtnActive: { backgroundColor: '#8B5CF6' },
  moodLabel: { fontSize: 13, color: '#9CA3AF', marginTop: 8 },
  moodLabelActive: { color: colors.text, fontWeight: '600' },
  input: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  footer: { marginTop: 32 },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#8B5CF6',
    padding: 16,
    borderRadius: 12,
  },
  nextBtnDisabled: { opacity: 0.7 },
  nextBtnText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
