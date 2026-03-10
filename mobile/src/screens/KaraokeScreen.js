/**
 * KaraokeScreen - Karaoke modu (senkronize şarkı sözleri)
 * Backend: /karaoke/lyrics/{track_id}, /karaoke/search
 */
import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    ActivityIndicator, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

export default function KaraokeScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
    const insets = useSafeAreaInsets();
    const { token } = useAuth();
    const { t } = useTranslation();
    const [trackName, setTrackName] = useState(route?.params?.trackName || '');
    const [artistName, setArtistName] = useState(route?.params?.artistName || '');
    const [lyrics, setLyrics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [synced, setSynced] = useState(false);

    const searchLyrics = async () => {
        if (!trackName.trim()) return;
        setLoading(true);
        try {
            const res = await api.get(
                `/karaoke/search?track=${encodeURIComponent(trackName.trim())}&artist=${encodeURIComponent(artistName.trim())}`,
                token
            );
            setLyrics(res?.lyrics || []);
            setSynced(res?.synced || false);
        } catch {
            setLyrics([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.title}>{t('karaoke.title') || 'Karaoke'}</Text>
                <Ionicons name="mic-outline" size={24} color="#8B5CF6" />
            </View>

            <View style={styles.searchSection}>
                <TextInput
                    style={styles.input}
                    placeholder={t('karaoke.trackName') || 'Track name'}
                    placeholderTextColor="#6B7280"
                    value={trackName}
                    onChangeText={setTrackName}
                />
                <TextInput
                    style={styles.input}
                    placeholder={t('karaoke.artistName') || 'Artist name'}
                    placeholderTextColor="#6B7280"
                    value={artistName}
                    onChangeText={setArtistName}
                />
                <TouchableOpacity style={styles.searchBtn} onPress={searchLyrics} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.searchBtnText}>{t('karaoke.findLyrics') || 'Find Lyrics'}</Text>
                    )}
                </TouchableOpacity>
            </View>

            {lyrics && (
                <View style={styles.lyricsSection}>
                    <View style={styles.lyricsHeader}>
                        <Ionicons name={synced ? 'timer-outline' : 'document-text-outline'} size={20} color="#8B5CF6" />
                        <Text style={styles.lyricsLabel}>
                            {synced ? (t('karaoke.syncedLyrics') || 'Synced Lyrics') : (t('karaoke.plainLyrics') || 'Lyrics')}
                        </Text>
                    </View>
                    <FlatList
                        data={lyrics}
                        keyExtractor={(item, i) => `${item.time}-${i}`}
                        renderItem={({ item }) => (
                            <View style={styles.lyricLine}>
                                {synced && (
                                    <Text style={styles.lyricTime}>
                                        {Math.floor(item.time / 60000)}:{String(Math.floor((item.time % 60000) / 1000)).padStart(2, '0')}
                                    </Text>
                                )}
                                <Text style={styles.lyricText}>{item.text}</Text>
                            </View>
                        )}
                        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <Ionicons name="musical-notes-outline" size={48} color="#555" />
                                <Text style={styles.emptyText}>{t('karaoke.noLyrics') || 'No lyrics found'}</Text>
                            </View>
                        }
                    />
                </View>
            )}

            {!lyrics && !loading && (
                <View style={styles.hero}>
                    <Ionicons name="mic" size={80} color="#8B5CF622" />
                    <Text style={styles.heroText}>{t('karaoke.heroText') || 'Enter a track name to start karaoke!'}</Text>
                </View>
            )}
        </View>
    );
}

const createStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937', gap: 12 },
    backBtn: { padding: 4 },
    title: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
    searchSection: { padding: 16, gap: 12 },
    input: { backgroundColor: '#1F2937', borderRadius: 12, padding: 14, fontSize: 16, color: colors.text },
    searchBtn: { backgroundColor: '#8B5CF6', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    searchBtnText: { color: colors.text, fontSize: 16, fontWeight: '600' },
    lyricsSection: { flex: 1, paddingHorizontal: 16 },
    lyricsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    lyricsLabel: { color: colors.accent, fontSize: 14, fontWeight: '600' },
    lyricLine: { flexDirection: 'row', paddingVertical: 8, gap: 12 },
    lyricTime: { color: '#6B7280', fontSize: 12, width: 40 },
    lyricText: { flex: 1, color: colors.text, fontSize: 18, lineHeight: 28 },
    empty: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: '#6B7280', fontSize: 14, marginTop: 12 },
    hero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
    heroText: { color: '#6B7280', fontSize: 16, textAlign: 'center', paddingHorizontal: 40 },
});
