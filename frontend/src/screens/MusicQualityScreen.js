import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../contexts/PlayerContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';

const QUALITIES = [
  { id: 'low', label: 'Düşük', desc: '64 kbps · Daha az veri kullanır', icon: 'cellular-outline' },
  { id: 'normal', label: 'Normal', desc: '128 kbps · Dengeli kalite', icon: 'cellular' },
  { id: 'high', label: 'Yüksek', desc: '256 kbps · En iyi ses kalitesi', icon: 'signal' },
  { id: 'auto', label: 'Otomatik', desc: 'Bağlantı hızına göre ayarla', icon: 'wifi' },
];

export default function MusicQualityScreen({ navigation }) {
  const { audioQuality, setAudioQuality, crossfadeEnabled, toggleCrossfade } = usePlayer();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Müzik Kalitesi</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>AKIŞ KALİTESİ</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          {QUALITIES.map((q, i) => (
            <TouchableOpacity key={q.id} style={[styles.qualityRow, i < QUALITIES.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.border }]} onPress={() => setAudioQuality(q.id)}>
              <View style={[styles.qualityIcon, { backgroundColor: audioQuality === q.id ? `${BRAND.primary}18` : colors.card }]}>
                <Ionicons name={q.icon} size={20} color={audioQuality === q.id ? BRAND.primary : colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: audioQuality === q.id ? BRAND.primary : colors.text, fontSize: 15, fontWeight: '500' }}>{q.label}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{q.desc}</Text>
              </View>
              {audioQuality === q.id && <Ionicons name="checkmark-circle" size={22} color={BRAND.primary} />}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>OYNATMA AYARLARI</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 14 }}>Crossfade</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Şarkılar arası yumuşak geçiş (3 saniye)</Text>
            </View>
            <Switch value={crossfadeEnabled} onValueChange={toggleCrossfade} trackColor={{ true: BRAND.primary, false: colors.border }} thumbColor="#FFF" />
          </View>

          <View style={[styles.switchRow, { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 14 }}>Kesintisiz Çalma</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Şarkılar arasında boşluk bırakma</Text>
            </View>
            <Switch value={true} trackColor={{ true: BRAND.primary, false: colors.border }} thumbColor="#FFF" />
          </View>

          <View style={[styles.switchRow, { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 14 }}>Ses Normalleştirme</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Tüm şarkıları aynı seviyede çal</Text>
            </View>
            <Switch value={false} trackColor={{ true: BRAND.primary, false: colors.border }} thumbColor="#FFF" />
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons name="information-circle" size={18} color={BRAND.accent} />
          <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1, marginLeft: 8, lineHeight: 16 }}>
            Yüksek kalite daha fazla veri kullanır. Wi-Fi bağlantısında otomatik olarak en yüksek kaliteye geçilir.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginTop: 8, marginBottom: 8 },
  card: { borderRadius: 16, overflow: 'hidden', marginBottom: 14 },
  qualityRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  qualityIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 14 },
});
