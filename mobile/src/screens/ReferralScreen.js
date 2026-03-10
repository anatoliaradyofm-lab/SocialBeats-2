/**
 * ReferralScreen - Davet kodu sistemi
 * Backend: /referral/generate, /referral/me, /referral/apply
 */
import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    ActivityIndicator, Alert, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

export default function ReferralScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
    const insets = useSafeAreaInsets();
    const { token } = useAuth();
    const { t } = useTranslation();
    const [code, setCode] = useState('');
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [applyCode, setApplyCode] = useState('');
    const [applying, setApplying] = useState(false);

    useEffect(() => {
        const loadReferral = async () => {
            try {
                const res = await api.get('/referral/me', token);
                setCode(res?.code || '');
                setStats(res);
            } catch {
                // No code yet
            } finally {
                setLoading(false);
            }
        };
        if (token) loadReferral();
        else setLoading(false);
    }, [token]);

    const generateCode = async () => {
        try {
            const res = await api.post('/referral/generate', {}, token);
            setCode(res?.code || '');
            Alert.alert('✅', res?.message || 'Code generated!');
        } catch (err) {
            Alert.alert(t('common.error'), err?.data?.detail || 'Failed');
        }
    };

    const shareCode = async () => {
        if (!code) return;
        try {
            await Share.share({
                message: `🎵 SocialBeats'e katıl! Davet kodum: ${code}\nhttps://socialbeats.app/invite/${code}`,
            });
        } catch { }
    };

    const applyReferral = async () => {
        if (!applyCode.trim()) return;
        setApplying(true);
        try {
            const res = await api.post(`/referral/apply?code=${encodeURIComponent(applyCode.trim().toUpperCase())}`, {}, token);
            Alert.alert('✅', res?.message || 'Code applied!');
            setApplyCode('');
        } catch (err) {
            Alert.alert(t('common.error'), err?.data?.detail || 'Invalid code');
        } finally {
            setApplying(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                    <Text style={styles.title}>{t('referral.title') || 'Invite Friends'}</Text>
                </View>
                <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.title}>{t('referral.title') || 'Invite Friends'}</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.heroSection}>
                    <Ionicons name="gift-outline" size={64} color="#8B5CF6" />
                    <Text style={styles.heroTitle}>{t('referral.inviteTitle') || 'Invite your friends!'}</Text>
                    <Text style={styles.heroDesc}>
                        {t('referral.inviteDesc') || 'Share your invite code and earn rewards when friends join.'}
                    </Text>
                </View>

                {code ? (
                    <View style={styles.codeSection}>
                        <Text style={styles.codeLabel}>{t('referral.yourCode') || 'Your Invite Code'}</Text>
                        <View style={styles.codeBox}>
                            <Text style={styles.codeText}>{code}</Text>
                            <TouchableOpacity onPress={shareCode} style={styles.shareBtn}>
                                <Ionicons name="share-social-outline" size={22} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        {stats && (
                            <View style={styles.statsRow}>
                                <View style={styles.statBox}>
                                    <Text style={styles.statValue}>{stats.total_invited || 0}</Text>
                                    <Text style={styles.statLabel}>{t('referral.invited') || 'Invited'}</Text>
                                </View>
                                <View style={styles.statBox}>
                                    <Text style={styles.statValue}>{stats.total_joined || 0}</Text>
                                    <Text style={styles.statLabel}>{t('referral.joined') || 'Joined'}</Text>
                                </View>
                            </View>
                        )}
                    </View>
                ) : (
                    <TouchableOpacity style={styles.generateBtn} onPress={generateCode}>
                        <Ionicons name="key-outline" size={20} color="#fff" />
                        <Text style={styles.generateText}>{t('referral.generateCode') || 'Generate Invite Code'}</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.applySection}>
                    <Text style={styles.applyLabel}>{t('referral.haveCode') || 'Have an invite code?'}</Text>
                    <View style={styles.applyRow}>
                        <TextInput
                            style={styles.applyInput}
                            placeholder="XXXXXXXX"
                            placeholderTextColor="#6B7280"
                            value={applyCode}
                            onChangeText={setApplyCode}
                            autoCapitalize="characters"
                        />
                        <TouchableOpacity style={styles.applyBtn} onPress={applyReferral} disabled={applying}>
                            {applying ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.applyBtnText}>{t('referral.apply') || 'Apply'}</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
}

const createStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937', gap: 12 },
    backBtn: { padding: 4 },
    title: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { flex: 1, padding: 24 },
    heroSection: { alignItems: 'center', marginBottom: 32 },
    heroTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 16 },
    heroDesc: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', marginTop: 8, lineHeight: 22 },
    codeSection: { marginBottom: 32 },
    codeLabel: { fontSize: 14, color: '#9CA3AF', marginBottom: 8 },
    codeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2937', borderRadius: 16, padding: 16, gap: 12 },
    codeText: { flex: 1, fontSize: 24, fontWeight: '700', color: colors.accent, letterSpacing: 4, textAlign: 'center' },
    shareBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
    statBox: { alignItems: 'center' },
    statValue: { fontSize: 24, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 13, color: '#6B7280', marginTop: 4 },
    generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#8B5CF6', borderRadius: 16, paddingVertical: 16, marginBottom: 32 },
    generateText: { color: colors.text, fontSize: 16, fontWeight: '600' },
    applySection: { marginTop: 'auto' },
    applyLabel: { fontSize: 14, color: '#9CA3AF', marginBottom: 12 },
    applyRow: { flexDirection: 'row', gap: 12 },
    applyInput: { flex: 1, backgroundColor: '#1F2937', borderRadius: 12, padding: 14, fontSize: 16, color: colors.text, letterSpacing: 2 },
    applyBtn: { paddingHorizontal: 24, backgroundColor: '#8B5CF6', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    applyBtnText: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
