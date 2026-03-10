import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet,
  Dimensions, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

const { width: SW } = Dimensions.get('window');

export default function UserProfileScreen({ route, navigation }) {
  const { userId } = route.params;
  const { user: currentUser, token } = useAuth();
  const { colors } = useTheme();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isCloseFriend, setIsCloseFriend] = useState(false);
  const [isMutual, setIsMutual] = useState(false);
  const [isRestricted, setIsRestricted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const [p, postsRes, status] = await Promise.all([
        api.get(`/user/${userId}`, token),
        api.get(`/social/posts/user/${userId}`, token).catch(() => ({ posts: [] })),
        api.get(`/social/interaction-status/${userId}`, token).catch(() => ({})),
      ]);
      const u = p.user || p;
      setProfile(u);
      setIsFollowing(status.is_following || u.is_following || false);
      setIsCloseFriend(status.is_close_friend || u.is_close_friend || false);
      setIsMutual(status.is_mutual || false);
      setIsRestricted(status.is_restricted || false);
      setIsMuted(status.is_muted || false);
      setPosts(postsRes.posts || postsRes || []);
    } catch {}
  }, [userId, token]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await api.delete(`/social/unfollow/${userId}`, token);
      } else {
        await api.post(`/social/follow/${userId}`, {}, token);
      }
      setIsFollowing(!isFollowing);
      if (!isFollowing) {
        const status = await api.get(`/social/interaction-status/${userId}`, token).catch(() => ({}));
        setIsMutual(status.is_mutual || false);
      } else {
        setIsMutual(false);
      }
    } catch {}
  };

  const handleBlock = async () => {
    Alert.alert('Engelle', `${profile?.username}'ı engellemek istediğinize emin misiniz?`, [
      { text: 'İptal' },
      { text: 'Engelle', style: 'destructive', onPress: async () => {
        try { await api.post(`/social/block/${userId}`, {}, token); navigation.goBack(); } catch {}
      }},
    ]);
  };

  const handleMute = async () => {
    try {
      if (isMuted) {
        await api.delete(`/social/mute/${userId}`, token);
        setIsMuted(false);
        Alert.alert('Sesi açıldı');
      } else {
        await api.post(`/social/mute/${userId}`, {}, token);
        setIsMuted(true);
        Alert.alert('Sessize alındı');
      }
    } catch {}
  };

  const handleRestrict = async () => {
    try {
      if (isRestricted) {
        await api.delete(`/social/restrict/${userId}`, token);
        setIsRestricted(false);
        Alert.alert('Kısıtlama kaldırıldı');
      } else {
        await api.post(`/social/restrict/${userId}`, {}, token);
        setIsRestricted(true);
        Alert.alert('Hesap kısıtlandı', 'Bu kişi sadece mesajlarınızı görebilir.');
      }
    } catch {}
  };

  const toggleCloseFriend = async () => {
    try {
      if (isCloseFriend) {
        await api.delete(`/social/close-friends/${userId}`, token);
      } else {
        await api.post(`/social/close-friends/${userId}`, {}, token);
      }
      setIsCloseFriend(!isCloseFriend);
    } catch {}
  };

  if (!profile) return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  const isSelf = currentUser?.id === userId;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.coverWrap}>
          {profile.cover_url ? <Image source={{ uri: profile.cover_url }} style={styles.coverImg} /> : <View style={[styles.coverImg, { backgroundColor: BRAND.primaryDark }]} />}
          <View style={styles.coverOverlay} />
          <View style={styles.coverHeader}>
            <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={22} color="#FFF" /></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowMore(true)}><Ionicons name="ellipsis-horizontal" size={22} color="#FFF" /></TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileSection}>
          <View style={[styles.avatarWrap, { borderColor: colors.background }]}>
            <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated }]}>
              {profile.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} /> : <Ionicons name="person" size={36} color={BRAND.primaryLight} />}
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <Text style={[styles.displayName, { color: colors.text }]}>{profile.display_name || profile.username}</Text>
            {profile.is_verified && <Ionicons name="checkmark-circle" size={18} color={BRAND.accent} />}
            {isMutual && !isSelf && (
              <View style={[styles.mutualBadge, { backgroundColor: BRAND.primary + '20' }]}>
                <Ionicons name="people" size={12} color={BRAND.primary} />
                <Text style={{ color: BRAND.primary, fontSize: 11, fontWeight: '600' }}>Arkadaş</Text>
              </View>
            )}
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>@{profile.username}</Text>
          {profile.bio && <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 }}>{profile.bio}</Text>}

          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statItem}>
              <Text style={[styles.statNum, { color: colors.text }]}>{posts.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Gönderi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('FollowersList', { userId })}>
              <Text style={[styles.statNum, { color: colors.text }]}>{profile.followers_count || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Takipçi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statItem} onPress={() => navigation.navigate('FollowingList', { userId })}>
              <Text style={[styles.statNum, { color: colors.text }]}>{profile.following_count || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Takip</Text>
            </TouchableOpacity>
          </View>

          {!isSelf && (
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.followBtn, { backgroundColor: isFollowing ? colors.surfaceElevated : BRAND.primary }]} onPress={handleFollow}>
                <Text style={{ color: isFollowing ? colors.text : '#FFF', fontWeight: '600', fontSize: 13 }}>
                  {isFollowing ? 'Takipten Çık' : 'Takip Et'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.msgBtn, { borderColor: colors.border }]}
                onPress={() => navigation.navigate('Chat', { recipientId: userId, recipientName: profile.display_name || profile.username })}>
                <Ionicons name="chatbubble-outline" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {profile.highlights?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlightRow}>
            {profile.highlights.map((h, i) => (
              <TouchableOpacity key={i} style={styles.highlightItem}>
                <View style={[styles.highlightCircle, { borderColor: BRAND.primary }]}>
                  {h.cover_url ? <Image source={{ uri: h.cover_url }} style={styles.highlightImg} /> : <Ionicons name="bookmark" size={16} color={BRAND.primaryLight} />}
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 4 }}>{h.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.gridWrap}>
          {posts.map((post, i) => (
            <TouchableOpacity key={post.id || i} style={styles.gridItem} onPress={() => navigation.navigate('PostDetail', { postId: post.id || post._id })}>
              {post.media_url ? (
                <Image source={{ uri: post.media_url }} style={styles.gridImg} />
              ) : (
                <View style={[styles.gridImg, { backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="document-text" size={24} color={colors.textMuted} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {showMore && (
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowMore(false)} activeOpacity={1}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            {[
              { icon: isMuted ? 'volume-high-outline' : 'volume-mute-outline', label: isMuted ? 'Sesi Aç' : 'Sessize Al', action: () => { handleMute(); setShowMore(false); } },
              { icon: isRestricted ? 'lock-open-outline' : 'lock-closed-outline', label: isRestricted ? 'Kısıtlamayı Kaldır' : 'Kısıtla', action: () => { handleRestrict(); setShowMore(false); } },
              { icon: isCloseFriend ? 'star' : 'star-outline', label: isCloseFriend ? 'Yakın Arkadaştan Çıkar' : 'Yakın Arkadaşa Ekle', action: () => { toggleCloseFriend(); setShowMore(false); } },
              { icon: 'flag-outline', label: 'Rapor Et', action: () => { setShowMore(false); navigation.navigate('Report', { targetId: userId, targetType: 'user' }); } },
              { icon: 'ban-outline', label: 'Engelle', action: () => { setShowMore(false); handleBlock(); }, danger: true },
            ].map((item, i) => (
              <TouchableOpacity key={i} style={[styles.modalRow, { borderBottomColor: colors.border }]} onPress={item.action}>
                <Ionicons name={item.icon} size={20} color={item.danger ? '#EF4444' : colors.text} />
                <Text style={{ color: item.danger ? '#EF4444' : colors.text, fontSize: 15, marginLeft: 12 }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={{ alignItems: 'center', paddingTop: 16 }} onPress={() => setShowMore(false)}>
              <Text style={{ color: colors.textMuted }}>İptal</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  coverWrap: { height: 180, position: 'relative' },
  coverImg: { width: '100%', height: '100%' },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.15)' },
  coverHeader: { position: 'absolute', top: 50, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  profileSection: { paddingHorizontal: 16, marginTop: -40 },
  avatarWrap: { borderWidth: 4, borderRadius: 48, alignSelf: 'flex-start' },
  avatar: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  displayName: { fontSize: 22, fontWeight: '800' },
  mutualBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statsRow: { flexDirection: 'row', gap: 24, marginTop: 14 },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: 17, fontWeight: '700' },
  statLabel: { fontSize: 11 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  followBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  msgBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  highlightRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  highlightItem: { alignItems: 'center', width: 64 },
  highlightCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  highlightImg: { width: 60, height: 60, borderRadius: 30 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: SW / 3, height: SW / 3, padding: 1 },
  gridImg: { width: '100%', height: '100%' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5 },
});
