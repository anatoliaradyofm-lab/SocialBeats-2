/**
 * CommunitiesScreen - Topluluklar listesi ve katılma
 * Backend: /communities (GET, POST, join, leave, members, posts)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
    ActivityIndicator, TextInput, Modal, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

export default function CommunitiesScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
    const insets = useSafeAreaInsets();
    const { token } = useAuth();
    const { t } = useTranslation();
    const [communities, setCommunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [creating, setCreating] = useState(false);

    const fetchCommunities = useCallback(async () => {
        try {
            const res = await api.get('/communities', token);
            setCommunities(Array.isArray(res) ? res : res?.communities || []);
        } catch {
            setCommunities([]);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => { fetchCommunities(); }, [fetchCommunities]);

    const joinCommunity = async (id) => {
        try {
            await api.post(`/communities/${id}/join`, {}, token);
            fetchCommunities();
        } catch (err) {
            Alert.alert(t('common.error'), err?.data?.detail || 'Failed');
        }
    };

    const leaveCommunity = async (id) => {
        try {
            await api.post(`/communities/${id}/leave`, {}, token);
            fetchCommunities();
        } catch (err) {
            Alert.alert(t('common.error'), err?.data?.detail || 'Failed');
        }
    };

    const createCommunity = async () => {
        if (!newName.trim()) return;
        setCreating(true);
        try {
            await api.post('/communities', { name: newName.trim(), description: newDesc.trim() }, token);
            setShowCreate(false);
            setNewName('');
            setNewDesc('');
            fetchCommunities();
        } catch (err) {
            Alert.alert(t('common.error'), err?.data?.detail || 'Failed');
        } finally {
            setCreating(false);
        }
    };

    const renderCommunity = ({ item }) => (
        <View style={styles.card}>
            <Image
                source={{ uri: item.cover_url || `https://picsum.photos/seed/${item.id}/100/100` }}
                style={styles.cover}
            />
            <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description || ''}</Text>
                <Text style={styles.cardMeta}>
                    {item.members_count || 0} {t('communities.members') || 'members'} · {item.genre || 'General'}
                </Text>
            </View>
            <TouchableOpacity
                style={[styles.joinBtn, item.is_member && styles.leaveBtn]}
                onPress={() => item.is_member ? leaveCommunity(item.id) : joinCommunity(item.id)}
            >
                <Text style={[styles.joinText, item.is_member && styles.leaveText]}>
                    {item.is_member ? (t('communities.leave') || 'Leave') : (t('communities.join') || 'Join')}
                </Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.title}>{t('communities.title') || 'Communities'}</Text>
                <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.addBtn}>
                    <Ionicons name="add-circle-outline" size={28} color="#8B5CF6" />
                </TouchableOpacity>
            </View>
            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
            ) : (
                <FlatList
                    data={communities}
                    renderItem={renderCommunity}
                    keyExtractor={(item) => item.id || String(Math.random())}
                    contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="people-outline" size={64} color="#555" />
                            <Text style={styles.emptyText}>{t('communities.empty') || 'No communities yet'}</Text>
                            <TouchableOpacity style={styles.createFirstBtn} onPress={() => setShowCreate(true)}>
                                <Text style={styles.createFirstText}>{t('communities.createFirst') || 'Create the first one!'}</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}

            <Modal visible={showCreate} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalPanel, { paddingBottom: insets.bottom + 24 }]}>
                        <Text style={styles.modalTitle}>{t('communities.create') || 'Create Community'}</Text>
                        <TextInput
                            style={styles.input}
                            placeholder={t('communities.namePlaceholder') || 'Community name'}
                            placeholderTextColor="#6B7280"
                            value={newName}
                            onChangeText={setNewName}
                        />
                        <TextInput
                            style={[styles.input, { height: 80 }]}
                            placeholder={t('communities.descPlaceholder') || 'Description (optional)'}
                            placeholderTextColor="#6B7280"
                            value={newDesc}
                            onChangeText={setNewDesc}
                            multiline
                        />
                        <TouchableOpacity style={styles.submitBtn} onPress={createCommunity} disabled={creating}>
                            {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('common.create') || 'Create'}</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                            <Text style={styles.cancelText}>{t('common.cancel') || 'Cancel'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const createStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937', gap: 12 },
    backBtn: { padding: 4 },
    title: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
    addBtn: { padding: 4 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 16 },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2937', borderRadius: 16, padding: 14, marginBottom: 12, gap: 12 },
    cover: { width: 56, height: 56, borderRadius: 12 },
    cardInfo: { flex: 1 },
    cardName: { fontSize: 16, fontWeight: '600', color: colors.text },
    cardDesc: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
    cardMeta: { fontSize: 12, color: '#6B7280', marginTop: 4 },
    joinBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#8B5CF6' },
    leaveBtn: { backgroundColor: '#374151' },
    joinText: { color: colors.text, fontSize: 13, fontWeight: '600' },
    leaveText: { color: '#9CA3AF' },
    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 16, color: '#9CA3AF', marginTop: 16 },
    createFirstBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#8B5CF6', borderRadius: 12 },
    createFirstText: { color: colors.text, fontSize: 14, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalPanel: { backgroundColor: '#1F2937', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 20 },
    input: { backgroundColor: '#374151', borderRadius: 12, padding: 16, fontSize: 16, color: colors.text, marginBottom: 16 },
    submitBtn: { backgroundColor: '#8B5CF6', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
    submitText: { color: colors.text, fontSize: 16, fontWeight: '600' },
    cancelBtn: { paddingVertical: 14, alignItems: 'center' },
    cancelText: { color: '#9CA3AF', fontSize: 16 },
});
