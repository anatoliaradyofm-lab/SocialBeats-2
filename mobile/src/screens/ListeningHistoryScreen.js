import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlayer } from '../contexts/PlayerContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { formatDate as formatLocaleDate } from '../lib/localeUtils';

import { HISTORY_KEY, MAX_HISTORY, addToListeningHistory } from '../services/historyService';
import { Alert } from '../components/ui/AppAlert';

export default function ListeningHistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { playTrack } = usePlayer();
  const { token, isGuest } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    if (isGuest) { setLoading(false); return; }
    setLoading(true);
    try {
      if (token) {
        try {
          const res = await api.get('/user/listening-history?limit=100', token);
          if (res?.history?.length > 0) {
            setHistory(res.history);
            setLoading(false);
            return;
          }
        } catch { }
      }

      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      setHistory(raw ? JSON.parse(raw) : []);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const clearHistory = () => {
    Alert.alert(
      t('listeningHistory.clearTitle'),
      t('listeningHistory.clearMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('listeningHistory.clear'),
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(HISTORY_KEY);
            setHistory([]);
            if (token) {
              try { await api.delete('/user/listening-history', token); } catch { }
            }
          },
        },
      ],
    );
  };

  const formatTime = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('listeningHistory.justNow');
    if (diffMins < 60) return t('listeningHistory.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('listeningHistory.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('listeningHistory.daysAgo', { count: diffDays });
    return formatLocaleDate(date, { day: 'numeric', month: 'short' });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.trackRow}
      activeOpacity={0.7}
      onPress={() => playTrack({
        id:        item.trackId,
        title:     item.title,
        artist:    item.artist,
        thumbnail: item.thumbnail,
        cover_url: item.thumbnail,
        audio_url: item.audio_url || null,
        source:    item.source || null,
      })}
    >
      <Image
        source={{ uri: item.thumbnail || `https://i.pravatar.cc/100?u=${item.trackId}` }}
        style={styles.thumb}
      />
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.trackArtist} numberOfLines={1}>{item.artist}</Text>
        <Text style={styles.trackTime}>{formatTime(item.playedAt)}</Text>
      </View>
      <Ionicons name="play-circle" size={28} color="#8B5CF6" />
    </TouchableOpacity>
  );

  if (isGuest) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }]}>
        <LinearGradient colors={['#1A0A2E', '#100620', '#08060F', '#08060F']} locations={[0, 0.18, 0.32, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { position: 'absolute', top: insets.top + 8, left: 16 }]}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(139,92,246,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)' }}>
          <Ionicons name="time-outline" size={32} color="#8B5CF6" />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#F8F8F8', marginBottom: 8 }}>Dinleme Geçmişi</Text>
        <Text style={{ fontSize: 14, color: 'rgba(248,248,248,0.45)', textAlign: 'center', lineHeight: 20, marginBottom: 28 }}>Dinleme geçmişini takip etmek için giriş yap.</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Auth')} style={{ borderRadius: 14, overflow: 'hidden' }}>
          <LinearGradient colors={['#A78BFA', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingHorizontal: 32, paddingVertical: 14 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFF' }}>Giriş Yap</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>{t('listeningHistory.title')}</Text>
        {history.length > 0 && (
          <TouchableOpacity onPress={clearHistory} style={styles.clearBtn}>
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      ) : (
        <FlatList
          data={history}
          renderItem={renderItem}
          keyExtractor={(item, index) => `${item.trackId}-${item.playedAt}-${index}`}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="time-outline" size={64} color="#374151" />
              <Text style={styles.emptyText}>{t('listeningHistory.empty')}</Text>
              <Text style={styles.emptySubtext}>{t('listeningHistory.emptySub')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08060F' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#fff' },
  clearBtn: { padding: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  thumb: { width: 56, height: 56, borderRadius: 8, marginRight: 12 },
  trackInfo: { flex: 1 },
  trackTitle: { fontSize: 16, fontWeight: '500', color: '#fff' },
  trackArtist: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
  trackTime: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { color: '#9CA3AF', fontSize: 14, marginTop: 8, textAlign: 'center' },
});
