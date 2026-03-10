import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

const GENRE_ICONS = {
  Pop: 'musical-note', Rock: 'flame', 'Hip-Hop': 'mic', 'R&B': 'heart', Jazz: 'cafe',
  Klasik: 'book', Elektronik: 'pulse', Country: 'leaf', Latin: 'sunny', Metal: 'skull',
  Indie: 'star', Blues: 'rainy', Reggae: 'happy', Folk: 'home', Soul: 'sparkles', Punk: 'flash',
};
const MOOD_ICONS = {
  Enerjik: 'flash', Sakin: 'leaf', Melankolik: 'rainy', Mutlu: 'happy',
  Romantik: 'heart', Motivasyon: 'rocket', Nostaljik: 'time', Agresif: 'flame',
};

export default function MusicTasteTestScreen({ navigation }) {
  const { token, setUser } = useAuth();
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const [genres, setGenres] = useState([]);
  const [moods, setMoods] = useState([]);
  const [options, setOptions] = useState(null);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedMoods, setSelectedMoods] = useState([]);
  const [artistInput, setArtistInput] = useState('');
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [opts, existing] = await Promise.all([
          api.get('/user/taste-test/options', token),
          api.get('/user/taste-test/result', token).catch(() => ({})),
        ]);
        setOptions(opts);
        setGenres(opts.genres || []);
        setMoods(opts.moods || []);
        if (existing.completed) {
          setSelectedGenres(existing.genres || []);
          setSelectedMoods(existing.moods || []);
          setArtists(existing.favorite_artists || []);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, [token]);

  const toggleGenre = (g) => {
    setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : prev.length < 8 ? [...prev, g] : prev);
  };

  const toggleMood = (m) => {
    setSelectedMoods(prev => prev.includes(m) ? prev.filter(x => x !== m) : prev.length < 5 ? [...prev, m] : prev);
  };

  const addArtist = () => {
    const name = artistInput.trim();
    if (name && !artists.includes(name) && artists.length < 10) {
      setArtists(prev => [...prev, name]);
      setArtistInput('');
    }
  };

  const handleSubmit = async () => {
    if (selectedGenres.length < 3) {
      Alert.alert('Uyarı', 'En az 3 tür seçin');
      return;
    }
    setSaving(true);
    try {
      await api.post('/user/taste-test', {
        genres: selectedGenres,
        moods: selectedMoods,
        favorite_artists: artists,
      }, token);
      if (setUser) setUser(prev => ({ ...prev, favorite_genres: selectedGenres, favorite_moods: selectedMoods, taste_test_completed: true }));
      Alert.alert('Tebrikler!', 'Müzik zevkin kaydedildi. Artık sana özel öneriler alacaksın!', [
        { text: 'Tamam', onPress: () => navigation.goBack() }
      ]);
    } catch {
      Alert.alert('Hata', 'Kaydedilemedi');
    }
    setSaving(false);
  };

  if (loading) return (
    <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={BRAND.primary} />
    </View>
  );

  const steps = [
    {
      title: 'Hangi türleri seviyorsun?',
      subtitle: `En az 3, en fazla 8 seç (${selectedGenres.length}/8)`,
      content: (
        <View style={styles.chipGrid}>
          {genres.map(g => {
            const sel = selectedGenres.includes(g);
            return (
              <TouchableOpacity key={g} style={[styles.chip, { backgroundColor: sel ? BRAND.primary : colors.surfaceElevated, borderColor: sel ? BRAND.primary : colors.border }]} onPress={() => toggleGenre(g)}>
                <Ionicons name={GENRE_ICONS[g] || 'musical-note'} size={16} color={sel ? '#FFF' : colors.text} />
                <Text style={{ color: sel ? '#FFF' : colors.text, fontSize: 13, fontWeight: sel ? '600' : '400' }}>{g}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ),
      canNext: selectedGenres.length >= 3,
    },
    {
      title: 'Hangi ruh halleri sana uygun?',
      subtitle: `En az 2, en fazla 5 seç (${selectedMoods.length}/5)`,
      content: (
        <View style={styles.chipGrid}>
          {moods.map(m => {
            const sel = selectedMoods.includes(m);
            return (
              <TouchableOpacity key={m} style={[styles.chip, { backgroundColor: sel ? BRAND.primary : colors.surfaceElevated, borderColor: sel ? BRAND.primary : colors.border }]} onPress={() => toggleMood(m)}>
                <Ionicons name={MOOD_ICONS[m] || 'sparkles'} size={16} color={sel ? '#FFF' : colors.text} />
                <Text style={{ color: sel ? '#FFF' : colors.text, fontSize: 13, fontWeight: sel ? '600' : '400' }}>{m}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ),
      canNext: selectedMoods.length >= 2,
    },
    {
      title: 'Favori sanatçıların kimler?',
      subtitle: 'İsteğe bağlı - en fazla 10 sanatçı ekle',
      content: (
        <View>
          <View style={[styles.artistInputRow, { backgroundColor: colors.surfaceElevated }]}>
            <TextInput style={[styles.artistInput, { color: colors.text }]} placeholder="Sanatçı adı..." placeholderTextColor={colors.textMuted} value={artistInput} onChangeText={setArtistInput} onSubmitEditing={addArtist} />
            <TouchableOpacity onPress={addArtist} style={[styles.addArtistBtn, { backgroundColor: BRAND.primary }]}>
              <Ionicons name="add" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.chipGrid}>
            {artists.map((a, i) => (
              <TouchableOpacity key={i} style={[styles.chip, { backgroundColor: BRAND.primary + '15', borderColor: BRAND.primary }]} onPress={() => setArtists(prev => prev.filter((_, idx) => idx !== i))}>
                <Text style={{ color: BRAND.primary, fontSize: 13, fontWeight: '500' }}>{a}</Text>
                <Ionicons name="close" size={14} color={BRAND.primary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ),
      canNext: true,
    },
  ];

  const current = steps[step];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 0 ? setStep(step - 1) : navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Müzik Zevki Testi</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>{step + 1}/3</Text>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${((step + 1) / 3) * 100}%` }]} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>{current.title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginBottom: 20 }}>{current.subtitle}</Text>
        {current.content}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        {step < 2 ? (
          <TouchableOpacity style={[styles.nextBtn, { opacity: current.canNext ? 1 : 0.4 }]} onPress={() => setStep(step + 1)} disabled={!current.canNext}>
            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 16 }}>Devam</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.nextBtn, { opacity: saving ? 0.6 : 1 }]} onPress={handleSubmit} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFF" /> : (
              <>
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 16 }}>Tamamla</Text>
                <Ionicons name="checkmark" size={20} color="#FFF" />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  progressBar: { height: 3, backgroundColor: 'rgba(124,58,237,0.1)', marginHorizontal: 16 },
  progressFill: { height: '100%', backgroundColor: BRAND.primary, borderRadius: 2 },
  stepTitle: { fontSize: 24, fontWeight: '800', marginBottom: 6 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5 },
  artistInputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingLeft: 14, marginBottom: 16, overflow: 'hidden' },
  artistInput: { flex: 1, fontSize: 14, paddingVertical: 12 },
  addArtistBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 34, borderTopWidth: 0.5 },
  nextBtn: { backgroundColor: BRAND.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16 },
});
