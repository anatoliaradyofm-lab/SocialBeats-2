/**
 * Takipçi listesi ekranı
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

const PRI   = '#C084FC';
const GREEN = '#4ADE80';
const avatarUri = (u) => u?.avatar_url || `https://i.pravatar.cc/100?u=${u?.username || u?.id}`;

export default function FollowersListScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token, user: currentUser } = useAuth();
  const { userId, displayName } = route.params || {};

  // Kendi takipçi listemi mi yoksa başkasının mı görüyorum?
  const isOwnList = !userId || userId === currentUser?.id || userId === 'preview-1';

  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locked,     setLocked]     = useState(false);
  // userId → bool: mevcut kullanıcının o kişiyi takip edip etmediği
  const [followStates, setFollowStates] = useState({});

  const load = useCallback(async () => {
    if (!userId || !token) return;
    try {
      const res = await api.get(`/users/${userId}/followers?limit=100`, token);
      const list = res?.users || [];
      setUsers(list);
      // followStates: her kişi için "ben onu takip ediyor muyum?" durumu
      const states = {};
      list.forEach(u => { states[u.id] = !!u.is_following; });
      setFollowStates(states);
      setLocked(false);
    } catch (e) {
      if (e?.status === 403 || e?.data?.detail?.includes('gizli')) setLocked(true);
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, token]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  /* Kendi takipçi listesinde: o kişiyi takipçilerden kaldır */
  const handleRemoveFollower = (item) => {
    Alert.alert(
      'Takipçiyi Kaldır',
      `${item.display_name || item.username} kişisini takipçilerinizden kaldırmak istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kaldır', style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/social/follower/${item.id}`, token);
              setUsers(prev => prev.filter(u => u.id !== item.id));
            } catch {
              Alert.alert('Hata', 'İşlem gerçekleştirilemedi.');
            }
          },
        },
      ]
    );
  };

  /* Başkasının takipçi listesinde: o kişiyi takip et / bırak */
  const handleToggleFollow = async (item) => {
    const isFollowing = followStates[item.id] ?? false;
    if (isFollowing) {
      Alert.alert(
        'Takibi Bırak',
        `${item.display_name || item.username} kişisini takip etmeyi bırakmak istediğinize emin misiniz?`,
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Takibi Bırak', style: 'destructive',
            onPress: async () => {
              setFollowStates(prev => ({ ...prev, [item.id]: false }));
              try {
                await api.delete(`/social/follow/${item.id}`, token);
              } catch {
                setFollowStates(prev => ({ ...prev, [item.id]: true }));
                Alert.alert('Hata', 'İşlem gerçekleştirilemedi.');
              }
            },
          },
        ]
      );
    } else {
      setFollowStates(prev => ({ ...prev, [item.id]: true }));
      try {
        await api.post(`/social/follow/${item.id}`, {}, token);
      } catch {
        setFollowStates(prev => ({ ...prev, [item.id]: false }));
        Alert.alert('Hata', 'İşlem gerçekleştirilemedi.');
      }
    }
  };

  const renderItem = ({ item }) => {
    const isMe = item.id === currentUser?.id || item.id === 'preview-1';
    const isFollowingBack = followStates[item.id] ?? false;

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => !isMe && navigation.navigate('UserProfile', { username: item.username })}
        activeOpacity={isMe ? 1 : 0.8}
      >
        <Image source={{ uri: avatarUri(item) }} style={styles.avatar} />
        <View style={styles.info}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.name}>{item.display_name || item.username}</Text>
            {isMe && <Text style={styles.meBadge}>Sen</Text>}
          </View>
          <Text style={styles.username}>@{item.username}</Text>
          <View style={styles.badgeRow}>
            {isOwnList && isFollowingBack ? (
              <View style={styles.mutualBadge}>
                <Ionicons name="people" size={10} color={GREEN} />
                <Text style={styles.mutualTx}>Karşılıklı takip</Text>
              </View>
            ) : !isOwnList && isFollowingBack ? (
              <View style={styles.followingBadge}>
                <Ionicons name="checkmark-circle" size={10} color={PRI} />
                <Text style={styles.followingTx}>Takip Ediliyor</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Buton: kendi listesinde → Takipten Çıkar, başkasının listesinde → Follow/Unfollow, kendim → hiçbir şey */}
        {!isMe && isOwnList && (
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => handleRemoveFollower(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.removeTx}>Takipten Çıkar</Text>
          </TouchableOpacity>
        )}
        {!isMe && !isOwnList && (
          <TouchableOpacity
            style={isFollowingBack ? styles.unfollowBtn : styles.followBtn}
            onPress={() => handleToggleFollow(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={isFollowingBack ? styles.unfollowTx : styles.followTx}>
              {isFollowingBack ? 'Takibi Bırak' : 'Takip Et'}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (locked) {
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
          <Text style={styles.title}>{displayName ?? t('followers.title')}</Text>
        </View>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={40} color={PRI} />
          <Text style={[styles.emptyText, { marginTop: 12 }]}>Bu hesap gizlidir</Text>
        </View>
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
        <Text style={styles.title}>{displayName ?? t('followers.title')}</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={PRI} /></View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('followers.noFollowers')}</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={PRI}
            />
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container:      { flex: 1, backgroundColor: colors.background },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  backBtn:        { padding: 4, marginRight: 12 },
  title:          { fontSize: 18, fontWeight: '700', color: colors.text },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list:           { padding: 16 },
  row:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  avatar:         { width: 48, height: 48, borderRadius: 24, marginRight: 14 },
  info:           { flex: 1 },
  name:           { fontSize: 15, fontWeight: '600', color: colors.text },
  username:       { fontSize: 13, color: '#9CA3AF', marginTop: 1 },
  meBadge:        { fontSize: 10, color: PRI, fontWeight: '700', backgroundColor: 'rgba(192,132,252,0.12)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  badgeRow:       { flexDirection: 'row', marginTop: 4 },
  followingBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(192,132,252,0.12)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  followingTx:    { fontSize: 10, color: PRI, fontWeight: '600' },
  mutualBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(74,222,128,0.12)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  mutualTx:       { fontSize: 10, color: GREEN, fontWeight: '600' },
  removeBtn:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(248,113,113,0.4)' },
  removeTx:       { fontSize: 12, color: '#F87171', fontWeight: '600' },
  unfollowBtn:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  unfollowTx:     { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  followBtn:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(192,132,252,0.5)', backgroundColor: 'rgba(192,132,252,0.12)' },
  followTx:       { fontSize: 12, color: '#C084FC', fontWeight: '600' },
  empty:          { padding: 40, alignItems: 'center' },
  emptyText:      { color: '#9CA3AF' },
});
