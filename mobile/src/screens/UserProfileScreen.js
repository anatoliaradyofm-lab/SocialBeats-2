import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, FlatList, ActivityIndicator, Alert, Modal, Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { getApiUrl } from '../services/api';
import ProfileStoriesHighlights from '../components/profile/ProfileStoriesHighlights';
import VerifiedBadge from '../components/VerifiedBadge';
import RichText from '../components/RichText';
import { useTheme } from '../contexts/ThemeContext';

const getReportReasons = (t) => [
  { value: 'spam', label: t('report.spam') },
  { value: 'harassment', label: t('report.harassment') },
  { value: 'hate_speech', label: t('report.hateSpeech') },
  { value: 'violence', label: t('report.violence') },
  { value: 'nudity', label: t('report.nudity') },
  { value: 'false_info', label: t('report.falseInfo') },
  { value: 'impersonation', label: t('report.impersonation') },
  { value: 'copyright', label: t('report.copyright') },
  { value: 'other', label: t('report.other') },
];

const mediaUri = (uri) => {
  if (!uri) return null;
  if (uri.startsWith('http')) return uri;
  const base = (getApiUrl() || '').replace(/\/api\/?$/, '');
  return uri.startsWith('/') ? `${base}${uri}` : `${base}/api/${uri}`;
};

export default function UserProfileScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { token, user: authUser } = useAuth();
  const { username } = route.params || {};
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [nowPlaying, setNowPlaying] = useState(null);
  const [tasteMatch, setTasteMatch] = useState(null);

  const isOwnProfile = authUser?.username === username;

  useEffect(() => {
    if (username) {
      api.get(`/user/${username}`, token)
        .then(setUser)
        .catch(() => setUser(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (!user?.id || !token || isOwnProfile) return;
    api.get(`/social/is-muted/${user.id}`, token)
      .then((r) => setIsMuted(r?.is_muted || false))
      .catch(() => setIsMuted(false));
  }, [user?.id, token, isOwnProfile]);

  useEffect(() => {
    if (!user?.id) return;
    api.get(`/users/${user.id}/now-playing`, token)
      .then((r) => setNowPlaying(r?.now_playing || null))
      .catch(() => setNowPlaying(null));
  }, [user?.id, token]);

  useEffect(() => {
    if (!user?.id || !token || isOwnProfile) return;
    api.get(`/users/${user.id}/taste-match`, token)
      .then((r) => setTasteMatch(r))
      .catch(() => setTasteMatch(null));
  }, [user?.id, token, isOwnProfile]);

  useEffect(() => {
    if (!user || !token) return;
    setPostsLoading(true);
    const loadPosts = async () => {
      try {
        let data = [];
        if (activeTab === 'posts') {
          data = await api.get(`/social/posts/user/${user.id}?page=1&limit=50`, token);
        } else if (activeTab === 'saved' && isOwnProfile) {
          data = await api.get(`/social/posts/saved?page=1&limit=50`, token);
        } else if (activeTab === 'tagged' && isOwnProfile) {
          data = await api.get(`/social/posts/tagged/${username}?page=1&limit=50`, token);
        }
        setPosts(Array.isArray(data) ? data : []);
      } catch {
        setPosts([]);
      } finally {
        setPostsLoading(false);
      }
    };
    loadPosts();
  }, [user?.id, username, activeTab, token, isOwnProfile]);

  if (loading || !user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('userProfile.goBack')}</Text>
        </TouchableOpacity>
        <View style={styles.center}><Text style={styles.empty}>{loading ? t('common.loading') : t('profile.userNotFound')}</Text></View>
      </View>
    );
  }

  const avatar = user.avatar_url || `https://i.pravatar.cc/200?u=${user.username}`;

  const renderPost = ({ item }) => {
    const media = item.media_urls?.[0] || item.media_url;
    return (
      <TouchableOpacity
        style={[styles.postThumb, { aspectRatio: 1 }]}
        onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
      >
        {media ? (
          <Image source={{ uri: mediaUri(media) }} style={styles.postThumbImg} resizeMode="cover" />
        ) : (
          <View style={[styles.postThumbImg, styles.postThumbPlaceholder]}>
            <Text style={styles.postThumbText} numberOfLines={3}>{(item.caption || item.content || '').slice(0, 50)}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>{t('userProfile.goBack')}</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.headerSection}>
        <Image source={{ uri: avatar }} style={styles.avatar} />
        <View style={styles.displayNameRow}>
          <Text style={styles.displayName}>{user.display_name || user.username}</Text>
          {user.is_verified && <VerifiedBadge size={20} />}
        </View>
        <Text style={styles.username}>@{user.username}</Text>
        {nowPlaying ? (
          <View style={styles.nowPlayingBadge}>
            <Text style={styles.nowPlayingText}>
              {'\uD83C\uDFB5'} Now Playing: {nowPlaying.title}{nowPlaying.artist ? ` - ${nowPlaying.artist}` : ''}
            </Text>
          </View>
        ) : null}
        {!isOwnProfile && tasteMatch && tasteMatch.match_percentage != null ? (
          <View style={styles.tasteMatchCard}>
            <View style={styles.tasteMatchHeader}>
              <Text style={styles.tasteMatchTitle}>{'\uD83C\uDFB6'} Music Taste Match</Text>
            </View>
            <View style={styles.tasteMatchBody}>
              <View style={styles.tasteCircleOuter}>
                <View style={[styles.tasteCircleInner, {
                  borderColor: tasteMatch.match_percentage >= 60 ? '#10B981' : tasteMatch.match_percentage >= 30 ? '#F59E0B' : '#EF4444',
                }]}>
                  <Text style={[styles.tastePercent, {
                    color: tasteMatch.match_percentage >= 60 ? '#10B981' : tasteMatch.match_percentage >= 30 ? '#F59E0B' : '#EF4444',
                  }]}>{tasteMatch.match_percentage}%</Text>
                </View>
              </View>
              {tasteMatch.common_artists?.length > 0 ? (
                <View style={styles.tasteArtists}>
                  <Text style={styles.tasteArtistsLabel}>Common Artists</Text>
                  <Text style={styles.tasteArtistsList} numberOfLines={2}>
                    {tasteMatch.common_artists.join(', ')}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
        {user.bio ? <RichText style={styles.bio}>{user.bio}</RichText> : null}
        {(user.location || user.website) ? (
          <View style={styles.metaRow}>
            {user.location ? <Text style={styles.metaText}>{user.location}</Text> : null}
            {user.location && user.website ? <Text style={styles.metaDot}> · </Text> : null}
            {user.website ? (
              <Text
                style={styles.metaLink}
                onPress={() => user.website && (user.website.startsWith('http') ? Linking.openURL(user.website) : Linking.openURL('https://' + user.website))}
              >
                {user.website.replace(/^https?:\/\//, '')}
              </Text>
            ) : null}
          </View>
        ) : null}
        <ProfileStoriesHighlights
          userId={user?.id}
          username={user?.username}
          token={token}
          isOwnProfile={isOwnProfile}
          onNavigate={async (type, hl) => {
            if (type === 'archive') navigation.navigate('StoryArchive');
            else if (type === 'highlight' && hl?.id && token) {
              try {
                const stories = await api.get(`/highlights/${hl.id}/stories`, token);
                if (Array.isArray(stories) && stories.length > 0) {
                  const feed = [{ user_id: user.id, username: user.username, user_avatar: user.avatar_url, stories }];
                  navigation.navigate('StoryViewer', { feed, startUserIndex: 0 });
                }
              } catch {}
            }
          }}
        />
        <View style={styles.stats}>
          <TouchableOpacity onPress={() => user?.id && navigation.navigate('FollowersList', { userId: user.id, displayName: isOwnProfile ? t('profile.myFollowers') : t('profile.follower') })}>
            <Text style={styles.stat}>{user.followers_count ?? 0} {t('profile.follower')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => user?.id && navigation.navigate('FollowingList', { userId: user.id, displayName: isOwnProfile ? t('profile.myFollowing') : t('profile.followText') })}>
            <Text style={styles.stat}>{user.following_count ?? 0} {t('profile.followText')}</Text>
          </TouchableOpacity>
        </View>
        {!isOwnProfile && authUser && (
          <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.messageBtn, styles.actionBtn]}
            onPress={async () => {
              try {
                const conv = await api.post('/messages/conversations', { participant_ids: [user.id], is_group: false }, token);
                navigation.navigate('Chat', { conversationId: conv.id, otherUser: user });
              } catch (e) {
                Alert.alert(t('common.error'), e?.data?.detail || t('profile.chatFailed'));
              }
            }}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#fff" />
            <Text style={styles.messageBtnText}>{t('profile.message')}</Text>
          </TouchableOpacity>
          {((user.friend_request_status || 'none') === 'none' || (user.friend_request_status || 'none') === 'following' || (user.friend_request_status || 'none') === 'friends' || (user.friend_request_status || 'none') === 'sent') && (
            <TouchableOpacity
              style={[styles.friendBtn, ((user.friend_request_status || '') === 'friends' || (user.friend_request_status || '') === 'sent') && styles.friendBtnActive]}
              onPress={(user.friend_request_status || '') !== 'sent' ? async () => {
                try {
                  const status = user.friend_request_status || 'none';
                  if (status === 'friends') {
                    await api.delete(`/social/unfriend/${user.id}`, token);
                    setUser((u) => ({ ...u, friend_request_status: 'none', is_following: false }));
                  } else if (status === 'none') {
                    await api.post(`/social/friend-request/${user.id}`, {}, token);
                    setUser((u) => ({ ...u, friend_request_status: 'sent' }));
                  }
                } catch (e) {
                  Alert.alert(t('common.error'), e?.data?.detail || t('common.operationFailed'));
                }
              } : undefined}
              disabled={(user.friend_request_status || '') === 'sent'}
            >
              <Text style={styles.friendBtnText}>
                {(user.friend_request_status || '') === 'friends' ? t('profile.friends') : (user.friend_request_status || '') === 'sent' ? t('profile.friendRequestSent') : t('profile.addFriend')}
              </Text>
            </TouchableOpacity>
          )}
          {(user.friend_request_status || '') === 'received' && (
            <>
              <TouchableOpacity style={styles.acceptBtn} onPress={async () => {
                try {
                  await api.post(`/social/friend-request/${user.id}/accept`, {}, token);
                  setUser((u) => ({ ...u, friend_request_status: 'friends', is_following: true }));
                } catch (e) { Alert.alert(t('common.error'), e?.data?.detail || t('common.operationFailed')); }
              }}>
                <Text style={styles.acceptBtnText}>{t('profile.acceptRequest')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={async () => {
                try {
                  await api.post(`/social/friend-request/${user.id}/decline`, {}, token);
                  setUser((u) => ({ ...u, friend_request_status: 'none' }));
                } catch (e) { Alert.alert(t('common.error'), e?.data?.detail || t('common.operationFailed')); }
              }}>
                <Text style={styles.rejectBtnText}>{t('profile.declineRequest')}</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={styles.moreBtn} onPress={() => setShowMenu(true)}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
          </TouchableOpacity>
          </View>
        )}
        <Modal visible={showMenu} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
            <View style={styles.menuSheet} onStartShouldSetResponder={() => true}>
              <TouchableOpacity style={styles.menuItem} onPress={async () => {
                setShowMenu(false);
                try {
                  await api.post(`/social/block/${user.id}`, {}, token);
                  Alert.alert(t('profile.blocked'), t('profile.userBlocked'));
                  navigation.goBack();
                } catch (e) { Alert.alert(t('common.error'), e?.data?.detail || t('common.operationFailed')); }
              }}>
                <Ionicons name="ban-outline" size={22} color="#EF4444" />
                <Text style={[styles.menuItemText, { color: colors.error }]}>{t('common.block')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={async () => {
                setShowMenu(false);
                try {
                  await api.post(`/social/restrict/${user.id}`, {}, token);
                  Alert.alert(t('profile.restricted'), t('profile.userRestricted'));
                } catch (e) { Alert.alert(t('common.error'), e?.data?.detail || t('common.operationFailed')); }
              }}>
                <Ionicons name="eye-off-outline" size={22} color="#fff" />
                <Text style={styles.menuItemText}>{t('profile.restricted')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={async () => {
                setShowMenu(false);
                try {
                  if (isMuted) {
                    await api.delete(`/social/mute/${user.id}`, token);
                    setIsMuted(false);
                    Alert.alert(t('common.success'), t('profile.unmuteSuccess'));
                  } else {
                    await api.post(`/social/mute/${user.id}?mute_stories=true&mute_posts=true&mute_notifications=true`, {}, token);
                    setIsMuted(true);
                    Alert.alert(t('common.success'), t('profile.muteSuccess'));
                  }
                } catch (e) { Alert.alert(t('common.error'), e?.data?.detail || t('common.operationFailed')); }
              }}>
                <Ionicons name={isMuted ? 'volume-high-outline' : 'notifications-off-outline'} size={22} color="#fff" />
                <Text style={styles.menuItemText}>{isMuted ? t('common.unmute') : t('common.mute')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); setShowReport(true); }}>
                <Ionicons name="flag-outline" size={22} color="#fff" />
                <Text style={styles.menuItemText}>{t('profile.reportUser')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => setShowMenu(false)}>
                <Text style={styles.menuCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'posts' && styles.tabActive]}
            onPress={() => setActiveTab('posts')}
          >
            <Ionicons name="grid-outline" size={20} color={activeTab === 'posts' ? '#8B5CF6' : '#9CA3AF'} />
            <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>{t('profile.postsTab')}</Text>
          </TouchableOpacity>
          {isOwnProfile && (
            <>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'saved' && styles.tabActive]}
                onPress={() => setActiveTab('saved')}
              >
                <Ionicons name="bookmark-outline" size={20} color={activeTab === 'saved' ? '#8B5CF6' : '#9CA3AF'} />
                <Text style={[styles.tabText, activeTab === 'saved' && styles.tabTextActive]}>{t('profile.savedTab')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'tagged' && styles.tabActive]}
                onPress={() => setActiveTab('tagged')}
              >
                <Ionicons name="person-outline" size={20} color={activeTab === 'tagged' ? '#8B5CF6' : '#9CA3AF'} />
                <Text style={[styles.tabText, activeTab === 'tagged' && styles.tabTextActive]}>{t('profile.taggedTab')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
      {postsLoading ? (
        <View style={styles.postsLoading}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : (
        <FlatList
          data={posts}
          numColumns={3}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          columnWrapperStyle={styles.postRow}
          contentContainerStyle={[styles.postsGrid, { paddingBottom: insets.bottom + 24 }]}
          ListEmptyComponent={<Text style={styles.noPosts}>{t('profile.noPosts')}</Text>}
        />
      )}

      <Modal visible={showMenu} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={styles.menuSheet} onStartShouldSetResponder={() => true}>
            <TouchableOpacity style={styles.menuItem} onPress={async () => {
              setShowMenu(false);
              try {
                await api.post(`/social/block/${user.id}`, {}, token);
                Alert.alert(t('common.success'), t('profile.userBlocked'));
                navigation.goBack();
              } catch (e) { Alert.alert(t('common.error'), e?.data?.detail || t('common.operationFailed')); }
            }}>
              <Ionicons name="ban-outline" size={22} color="#EF4444" />
              <Text style={styles.menuItemTextDanger}>{t('common.block')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={async () => {
              setShowMenu(false);
              try {
                await api.post(`/social/restrict/${user.id}`, {}, token);
                Alert.alert(t('common.success'), t('profile.userRestricted'));
              } catch (e) { Alert.alert(t('common.error'), e?.data?.detail || t('common.operationFailed')); }
            }}>
              <Ionicons name="eye-off-outline" size={22} color="#fff" />
              <Text style={styles.menuItemText}>{t('profile.restricted')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={async () => {
              setShowMenu(false);
              try {
                if (isMuted) {
                  await api.delete(`/social/mute/${user.id}`, token);
                  setIsMuted(false);
                  Alert.alert(t('common.success'), t('profile.unmuteSuccess'));
                } else {
                  await api.post(`/social/mute/${user.id}?mute_stories=true&mute_posts=true&mute_notifications=true`, {}, token);
                  setIsMuted(true);
                  Alert.alert(t('common.success'), t('profile.muteSuccess'));
                }
              } catch (e) { Alert.alert(t('common.error'), e?.data?.detail || t('common.operationFailed')); }
            }}>
              <Ionicons name={isMuted ? 'volume-high-outline' : 'notifications-off-outline'} size={22} color="#fff" />
              <Text style={styles.menuItemText}>{isMuted ? t('common.unmute') : t('common.mute')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); setShowReport(true); }}>
              <Ionicons name="flag-outline" size={22} color="#fff" />
              <Text style={styles.menuItemText}>{t('profile.reportUser')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuCancel} onPress={() => setShowMenu(false)}>
              <Text style={styles.menuCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showReport} transparent animationType="slide">
        <TouchableOpacity style={styles.reportModalOverlay} activeOpacity={1} onPress={() => setShowReport(false)}>
          <View style={[styles.reportModal, { paddingBottom: insets.bottom + 24 }]} onStartShouldSetResponder={() => true}>
            <Text style={styles.reportTitle}>{t('profile.reportTitle', { username: user?.username })}</Text>
            <Text style={styles.reportSubtitle}>{t('profile.reportWhy')}</Text>
            {getReportReasons(t).map((r) => (
              <TouchableOpacity key={r.value} style={styles.reportOption} onPress={async () => {
                try {
                  await api.post('/reports', { reported_id: user.id, report_type: 'user', reason: r.value }, token);
                  setShowReport(false);
                  Alert.alert(t('profile.reportThanks'), t('profile.reportReceived'));
                } catch (e) { Alert.alert(t('common.error'), e?.data?.detail || t('profile.reportFailed')); }
              }}>
                <Text style={styles.reportOptionText}>{r.label}</Text>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.reportCancel} onPress={() => setShowReport(false)}>
              <Text style={styles.reportCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backBtn: { paddingHorizontal: 20, paddingVertical: 16 },
  backText: { color: colors.accent, fontSize: 16 },
  headerSection: { alignItems: 'center', padding: 20 },
  center: { flex: 1, justifyContent: 'center' },
  empty: { color: '#9CA3AF' },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 12 },
  displayNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  displayName: { fontSize: 22, fontWeight: '700', color: colors.text },
  username: { fontSize: 16, color: '#9CA3AF', marginBottom: 12 },
  nowPlayingBadge: {
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#8B5CF6',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 12,
  },
  nowPlayingText: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  tasteMatchCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#374151',
  },
  tasteMatchHeader: { marginBottom: 12 },
  tasteMatchTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  tasteMatchBody: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  tasteCircleOuter: { alignItems: 'center', justifyContent: 'center' },
  tasteCircleInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  tastePercent: { fontSize: 18, fontWeight: '800' },
  tasteArtists: { flex: 1 },
  tasteArtistsLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  tasteArtistsList: { fontSize: 13, color: '#D1D5DB', lineHeight: 18 },
  bio: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 },
  metaText: { fontSize: 13, color: '#9CA3AF' },
  metaDot: { fontSize: 13, color: '#6B7280' },
  metaLink: { fontSize: 13, color: colors.accent, textDecorationLine: 'underline' },
  stats: { flexDirection: 'row', gap: 24, marginBottom: 16 },
  stat: { fontSize: 14, color: colors.text },
  messageBtnText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  tabs: { flexDirection: 'row', gap: 16 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12 },
  tabActive: {},
  tabText: { fontSize: 14, color: '#9CA3AF' },
  tabTextActive: { color: colors.accent, fontWeight: '600' },
  postsGrid: { padding: 2 },
  postRow: { gap: 2 },
  postThumb: { flex: 1, padding: 2 },
  postThumbImg: { width: '100%', height: '100%', borderRadius: 4 },
  postThumbPlaceholder: { backgroundColor: '#1F2937', justifyContent: 'center', padding: 8 },
  postThumbText: { color: '#9CA3AF', fontSize: 10 },
  postsLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noPosts: { color: '#6B7280', textAlign: 'center', padding: 40 },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  actionBtn: { flex: 1, minWidth: 90 },
  messageBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#8B5CF6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  friendBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#1F2937', borderWidth: 1, borderColor: '#374151' },
  friendBtnActive: { backgroundColor: '#374151', borderColor: '#4B5563' },
  friendBtnText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  acceptBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#10B981' },
  acceptBtnText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  rejectBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#374151' },
  rejectBtnText: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
  moreBtn: { padding: 12, backgroundColor: '#1F2937', borderRadius: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: '#1F2937', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#374151' },
  menuItemText: { fontSize: 16, color: colors.text, fontWeight: '500' },
  menuItemTextDanger: { fontSize: 16, color: colors.error, fontWeight: '500' },
  menuCancel: { marginTop: 16, padding: 14, alignItems: 'center', borderRadius: 10, backgroundColor: '#374151' },
  menuCancelText: { color: colors.text, fontSize: 16 },
  reportModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  reportModal: { backgroundColor: '#1F2937', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' },
  reportTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  reportSubtitle: { fontSize: 14, color: '#9CA3AF', marginBottom: 20 },
  reportOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#374151', marginBottom: 8 },
  reportOptionText: { fontSize: 16, color: colors.text },
  reportCancel: { marginTop: 16, padding: 14, alignItems: 'center', borderRadius: 10, backgroundColor: '#374151' },
  reportCancelText: { color: colors.text, fontSize: 16 },
});
