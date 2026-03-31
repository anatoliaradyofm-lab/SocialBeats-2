/**
 * BackupScreen - Veri yedekleme ve geri yükleme
 * Backend: /backup/create, /backup/list, /backup/restore/{id}
 */
import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, FlatList,
    ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function BackupScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
    const insets = useSafeAreaInsets();
    const { token } = useAuth();
    const { t } = useTranslation();
    const [backups, setBackups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    const fetchBackups = async () => {
        try {
            const res = await api.get('/backup/list', token);
            setBackups(Array.isArray(res) ? res : res?.backups || []);
        } catch {
            setBackups([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchBackups(); }, [token]);

    const createBackup = async () => {
        setCreating(true);
        try {
            await api.post('/backup/create', {}, token);
            Alert.alert('✅', t('backup.created') || 'Backup created successfully!');
            fetchBackups();
        } catch (err) {
            Alert.alert(t('common.error'), err?.data?.detail || 'Failed');
        } finally {
            setCreating(false);
        }
    };

    const restoreBackup = (id) => {
        Alert.alert(
            t('backup.restoreTitle') || 'Restore Backup',
            t('backup.restoreConfirm') || 'This will overwrite your current data. Continue?',
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('backup.restore') || 'Restore',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.post(`/backup/${id}/restore`, {}, token);
                            Alert.alert('✅', t('backup.restored') || 'Backup restored!');
                        } catch (err) {
                            Alert.alert(t('common.error'), err?.data?.detail || 'Failed');
                        }
                    },
                },
            ]
        );
    };

    const formatDate = (dateStr) => {
        try {
            return new Date(dateStr).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            });
        } catch { return dateStr; }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.title}>{t('backup.title') || 'Backup & Restore'}</Text>
            </View>

            <View style={styles.createSection}>
                <Text style={styles.createDesc}>{t('backup.description') || 'Back up your posts, playlists, and settings'}</Text>
                <TouchableOpacity style={styles.createBtn} onPress={createBackup} disabled={creating}>
                    {creating ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                            <Text style={styles.createText}>{t('backup.createNow') || 'Create Backup Now'}</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>{t('backup.history') || 'Backup History'}</Text>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
            ) : (
                <FlatList
                    data={backups}
                    keyExtractor={(item) => item.id || String(Math.random())}
                    renderItem={({ item }) => (
                        <View style={styles.card}>
                            <View style={styles.cardInfo}>
                                <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
                                <Text style={styles.cardSize}>{item.size || 'Unknown size'}</Text>
                            </View>
                            <TouchableOpacity style={styles.restoreBtn} onPress={() => restoreBackup(item.id)}>
                                <Ionicons name="cloud-download-outline" size={18} color="#8B5CF6" />
                                <Text style={styles.restoreText}>{t('backup.restore') || 'Restore'}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="cloud-offline-outline" size={48} color="#555" />
                            <Text style={styles.emptyText}>{t('backup.noBackups') || 'No backups yet'}</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const createStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937', gap: 12 },
    backBtn: { padding: 4 },
    title: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
    createSection: { padding: 24, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
    createDesc: { fontSize: 14, color: '#9CA3AF', marginBottom: 16 },
    createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#8B5CF6', borderRadius: 14, paddingVertical: 16 },
    createText: { color: colors.text, fontSize: 16, fontWeight: '600' },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: '#9CA3AF', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { paddingHorizontal: 16 },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2937', borderRadius: 14, padding: 16, marginBottom: 12 },
    cardInfo: { flex: 1 },
    cardDate: { fontSize: 15, color: colors.text, fontWeight: '500' },
    cardSize: { fontSize: 13, color: '#6B7280', marginTop: 4 },
    restoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#8B5CF620' },
    restoreText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
    empty: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: '#6B7280', fontSize: 14, marginTop: 12 },
});
