/**
 * UserProfileScreen — AURORA Design 2026
 * Music-first social profile · No photo/video posts · Follow system only
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Modal, Linking, Dimensions, Animated, RefreshControl, Share, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { getApiUrl } from '../services/api';
import ProfileStoriesHighlights from '../components/profile/ProfileStoriesHighlights';
import RichText from '../components/RichText';
import { useTheme } from '../contexts/ThemeContext';
import { Alert } from '../components/ui/AppAlert';

const { width: SW } = Dimensions.get('window');
const COVER_H = 105;

const REPORT_REASONS = (t) => [
  { value: 'spam',          label: t('report.spam') },
  { value: 'harassment',    label: t('report.harassment') },
  { value: 'hate_speech',   label: t('report.hateSpeech') },
  { value: 'violence',      label: t('report.violence') },
  { value: 'nudity',        label: t('report.nudity') },
  { value: 'false_info',    label: t('report.falseInfo') },
  { value: 'impersonation', label: t('report.impersonation') },
  { value: 'copyright',     label: t('report.copyright') },
  { value: 'other',         label: t('report.other') },
];

const mediaUri = (uri) => {
  if (!uri) return null;
  if (uri.startsWith('http')) return uri;
  const base = (getApiUrl() || '').replace(/\/api\/?$/, '');
  return uri.startsWith('/') ? `${base}${uri}` : `${base}/api/${uri}`;
};

function getMusicPersonality(genres) {
  if (!genres || genres.length === 0) return null;
  const top = (genres[0]?.label || genres[0]?.genre || '').toLowerCase();
  if (['electronic','house','techno','edm','dance'].some(g => top.includes(g))) return { label:'Enerji Ustası',   icon:'flash',       color:'#FB923C' };
  if (['hip-hop','hip hop','trap','rap'].some(g => top.includes(g)))             return { label:'Ritim Avcısı',   icon:'mic',         color:'#C084FC' };
  if (['classical','jazz','blues'].some(g => top.includes(g)))                   return { label:'Melodi Filozofu',icon:'leaf',        color:'#34D399' };
  if (['pop'].some(g => top.includes(g)))                                        return { label:'Trend Takipçisi',icon:'star',        color:'#FBBF24' };
  if (['indie','alternative','folk'].some(g => top.includes(g)))                 return { label:'Müzik Kaşifi',   icon:'compass',     color:'#60A5FA' };
  if (['rock','metal','punk'].some(g => top.includes(g)))                        return { label:'Güç Simgesi',    icon:'thunderstorm',color:'#F87171' };
  if (['r&b','rnb','soul'].some(g => top.includes(g)))                           return { label:'Duygu Ustası',   icon:'heart',       color:'#F472B6' };
  return { label:'Müzik Kaşifi', icon:'compass', color:'#60A5FA' };
}


export default function UserProfileScreen({ navigation, route }) {
  const { colors }                = useTheme();
  const { t }                     = useTranslation();
  const insets                    = useSafeAreaInsets();
  const { token, user: authUser, isGuest } = useAuth();
  const requireAuth = (cb) => {
    if (isGuest || !token) {
      Alert.alert('Giriş Gerekli', 'Bu özelliği kullanmak için giriş yapmanız gerekiyor.', [
        { text: 'İptal', style: 'cancel' },
        { text: 'Giriş Yap', onPress: () => navigation.navigate('Auth') },
      ]);
      return;
    }
    cb?.();
  };
  const { username, requestId, notifId } = route.params || {};

  const [user,           setUser]           = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [isMuted,        setIsMuted]        = useState(false);
  const [nowPlaying,     setNowPlaying]     = useState(null);
  const [tasteMatch,     setTasteMatch]     = useState(null);
  const [listenStats,    setListenStats]    = useState(null);
  const [playlists,      setPlaylists]      = useState([]);
  const [mutualFollowers,setMutualFollowers]= useState([]);
  const [recentTracks,   setRecentTracks]   = useState([]);
  const [showMenu,       setShowMenu]       = useState(false);
  const [showReport,     setShowReport]     = useState(false);
  const [showAvatar,     setShowAvatar]     = useState(false);
  const [refreshing,     setRefreshing]     = useState(false);
  const [userStories,    setUserStories]    = useState(null);
  const [reqStatus,      setReqStatus]      = useState(null); // null | 'loading_accept' | 'loading_reject' | 'accepted' | 'rejected'
  const scrollY = useRef(new Animated.Value(0)).current;

  const isOwnProfile = authUser?.username === username;

  const loadUser = useCallback(() => {
    if (!username) { setLoading(false); return; }
    api.get(`/user/${username}`, token)
      .then(setUser).catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [username, token]);

  useEffect(() => { loadUser(); }, [loadUser]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (!loading) loadUser();
    });
    return unsubscribe;
  }, [navigation, loadUser, loading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadUser(); } finally { setRefreshing(false); }
  }, [loadUser]);

  // Load stories for this user
  useEffect(() => {
    if (!user?.id || !token) return;
    api.get(`/stories/user/${user.id}`, token)
      .then(res => {
        const stories = Array.isArray(res) ? res : [];
        setUserStories(stories.length > 0 ? stories : null);
      })
      .catch(() => setUserStories(null));
  }, [user?.id, token]);

  useEffect(() => {
    if (!user?.id || !token || isOwnProfile) return;
    api.get(`/social/is-muted/${user.id}`, token)
      .then(r => setIsMuted(r?.is_muted || false)).catch(() => {});
  }, [user?.id, token, isOwnProfile]);

  useEffect(() => {
    if (!user?.id) return;
    const locked = user.is_private && !user.is_following && authUser?.username !== username;
    if (locked) return;
    api.get(`/users/${user.id}/now-playing`, token)
      .then(r => setNowPlaying(r?.now_playing || null)).catch(() => {});
    api.get(`/users/${user.id}/listening-stats`, token)
      .then(setListenStats).catch(() => {});
    if (!isOwnProfile && token)
      api.get(`/users/${user.id}/taste-match`, token)
        .then(setTasteMatch).catch(() => {});
    api.get(`/playlists/user/${user.id}?limit=6`, token)
      .then(r => setPlaylists(r?.playlists || [])).catch(() => {});
    api.get(`/users/${user.id}/recent-tracks?limit=5`, token)
      .then(r => setRecentTracks(r?.tracks || [])).catch(() => {});
    if (!isOwnProfile && token)
      api.get(`/social/mutual-followers/${user.id}?limit=5`, token)
        .then(r => setMutualFollowers(r?.users || [])).catch(() => {});
  }, [user?.id, token, isOwnProfile]);

  // 30s live refresh — now-playing, taste match, listen stats
  useEffect(() => {
    if (!user?.id) return;
    const isLocked = !!(user.is_private && !user.is_following && authUser?.username !== username);
    if (isLocked) return;
    const iv = setInterval(() => {
      api.get(`/users/${user.id}/now-playing`, token)
        .then(r => setNowPlaying(r?.now_playing || null)).catch(() => {});
      api.get(`/users/${user.id}/listening-stats`, token)
        .then(setListenStats).catch(() => {});
      if (!isOwnProfile && token)
        api.get(`/users/${user.id}/taste-match`, token)
          .then(setTasteMatch).catch(() => {});
    }, 30000);
    return () => clearInterval(iv);
  }, [user?.id, user?.is_private, user?.is_following, token, isOwnProfile, username]);

  if (loading || !user) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backRow}>
          <Ionicons name="chevron-back" size={22} color="#C084FC" />
        </TouchableOpacity>
        <View style={s.center}>
          {loading
            ? <ActivityIndicator size="large" color="#C084FC" />
            : <Text style={s.emptyTx}>{t('profile.userNotFound')}</Text>}
        </View>
      </View>
    );
  }

  const avatar        = user.avatar_url || `https://i.pravatar.cc/200?u=${user.username}`;
  const isFollowing   = !isGuest && !user.is_blocked_by_me && (user.is_following || false);
  const isBlockedByMe = !isGuest && !!user.is_blocked_by_me;
  const isLocked      = !isBlockedByMe && (user.is_locked || (user.is_private && !isFollowing && !isOwnProfile));
  const requestStatus = user.friend_request_status || 'none';

  const handleUnblock = async () => {
    try {
      await api.delete(`/social/unblock/${user.id}`, token);
      setUser(u => ({ ...u, is_blocked_by_me: false }));
    } catch (e) { Alert.alert(t('common.error'), e?.data?.detail || t('common.unblockFailed')); }
  };

  const genres = listenStats?.top_genres || [];

  const displayFavArtists    = user.favorite_artists?.length > 0 ? user.favorite_artists : [];
  const displayPlaylists     = playlists;
  const displayRecentTracks  = recentTracks;
  const displayBadges        = user.badges?.length > 0 ? user.badges : [];
  const displayMutualFollowers = mutualFollowers;

  const tasteColor = tasteMatch?.match_percentage >= 60 ? '#34D399'
    : tasteMatch?.match_percentage >= 30 ? '#FBBF24' : '#F87171';

  const headerOpacity = scrollY.interpolate({
    inputRange: [COVER_H - 80, COVER_H],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Sticky header (on scroll) — sadece isim göster, butonlar floatBar'da sabit ── */}
      <Animated.View style={[s.stickyHdr, { paddingTop: insets.top, opacity: headerOpacity }]}>
        <View style={s.stickyBack} />
        <Text style={s.stickyName} numberOfLines={1}>{user.display_name || user.username}</Text>
        <View style={s.stickyMore} />
      </Animated.View>

      {/* ── Floating buttons (before scroll) ── */}
      <View style={[s.floatBar, { top: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.floatBtn}>
          <Ionicons name="chevron-back" size={20} color="#F8F8F8" />
        </TouchableOpacity>
        <View style={s.floatRight}>
          <TouchableOpacity style={s.floatBtn} onPress={() => {
            Share.share({ message: `SocialBeats'te ${user.display_name || user.username} profilini gör: @${user.username}` }).catch(() => {});
          }}>
            <Ionicons name="share-outline" size={20} color="#F8F8F8" />
          </TouchableOpacity>
          {!isOwnProfile && (
            <TouchableOpacity onPress={() => setShowMenu(true)} style={s.floatBtn}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#F8F8F8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor="#C084FC" colors={['#C084FC']} />
        }
      >
        {/* hero gradient spacer */}
        <View style={s.heroBg} />

        {/* ── Identity block ── */}
        <View style={s.identityBlock}>
          {/* Avatar — tap opens stories if any, else fullscreen avatar */}
          <TouchableOpacity
            style={[s.avatarRing, userStories && { borderColor: 'transparent', padding: 3 }]}
            activeOpacity={0.9}
            onPress={() => {
              if (userStories) {
                navigation.navigate('StoryViewer', {
                  feed: [{
                    user_id: user.id,
                    username: user.username,
                    user_avatar: user.avatar_url,
                    user_display_name: user.display_name || user.username,
                    stories: userStories,
                  }],
                  startUserIndex: 0,
                  startStoryIndex: 0,
                });
              } else {
                setShowAvatar(true);
              }
            }}
          >
            {userStories ? (
              <LinearGradient
                colors={['#FBBF24', '#F43F5E', '#9333EA']}
                start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
                style={{ width: '100%', height: '100%', borderRadius: 45, padding: 3, alignItems: 'center', justifyContent: 'center' }}
              >
                <View style={{ width: '100%', height: '100%', borderRadius: 42, borderWidth: 2, borderColor: '#08060F', overflow: 'hidden' }}>
                  <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} />
                </View>
              </LinearGradient>
            ) : (
              <Image source={{ uri: avatar }} style={s.avatar} />
            )}
            {nowPlaying && (
              <View style={s.nowDot}>
                <Ionicons name="musical-note" size={7} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          {/* Name + handle */}
          <View style={s.nameGroup}>
            <Text style={s.displayName}>{user.display_name || user.username}</Text>
          </View>
          <Text style={s.handle}>@{user.username}</Text>

          {/* Bio */}
          {user.bio ? <RichText style={s.bio}>{user.bio}</RichText> : null}

          {/* Location / website */}
          {(user.location || user.website) ? (
            <View style={s.metaRow}>
              {user.location ? (
                <View style={s.metaChip}>
                  <Ionicons name="location-outline" size={12} color="rgba(248,248,248,0.4)" />
                  <Text style={s.metaTx}>{user.location}</Text>
                </View>
              ) : null}
              {user.website ? (
                <TouchableOpacity style={s.metaChip} onPress={() =>
                  Linking.openURL(user.website.startsWith('http') ? user.website : 'https://' + user.website)}>
                  <Ionicons name="link-outline" size={12} color="#C084FC" />
                  <Text style={[s.metaTx, { color:'#C084FC' }]}>{user.website.replace(/^https?:\/\//, '')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* Social links */}
          {(user.instagram || user.twitter || user.social_links?.instagram || user.social_links?.twitter) ? (
            <View style={s.socialRow}>
              {(user.instagram || user.social_links?.instagram) ? (() => { const ig = (user.instagram || user.social_links?.instagram).replace('@',''); return (
                <TouchableOpacity style={s.socialBtn} onPress={() => Linking.openURL(`https://instagram.com/${ig}`)}>
                  <View style={[s.socialIcon, { backgroundColor:'rgba(225,48,108,0.15)', borderColor:'rgba(225,48,108,0.3)' }]}>
                    <Ionicons name="logo-instagram" size={16} color="#E1306C" />
                  </View>
                  <Text style={s.socialTx}>@{ig}</Text>
                </TouchableOpacity>
              ); })() : null}
              {(user.twitter || user.social_links?.twitter) ? (() => { const tw = (user.twitter || user.social_links?.twitter).replace('@',''); return (
                <TouchableOpacity style={s.socialBtn} onPress={() => Linking.openURL(`https://x.com/${tw}`)}>
                  <View style={[s.socialIcon, { backgroundColor:'rgba(29,161,242,0.15)', borderColor:'rgba(29,161,242,0.3)' }]}>
                    <Ionicons name="logo-twitter" size={16} color="#1DA1F2" />
                  </View>
                  <Text style={s.socialTx}>@{tw}</Text>
                </TouchableOpacity>
              ); })() : null}
            </View>
          ) : null}

          {/* Stats */}
          <View style={s.statsCard}>
            <TouchableOpacity style={s.statItem}
              onPress={() => user?.id && navigation.navigate('FollowersList', { userId: user.id, displayName: 'Takipçiler' })}>
              <Text style={s.statNum}>{(user.followers_count ?? 0).toLocaleString()}</Text>
              <Text style={s.statLabel}>Takipçi</Text>
            </TouchableOpacity>
            <View style={s.statLine} />
            <TouchableOpacity style={s.statItem}
              onPress={() => user?.id && navigation.navigate('FollowingList', { userId: user.id, displayName: 'Takip Edilenler' })}>
              <Text style={s.statNum}>{(user.following_count ?? 0).toLocaleString()}</Text>
              <Text style={s.statLabel}>Takip</Text>
            </TouchableOpacity>
          </View>

          {/* ── Takip isteği Kabul/Reddet (bildirimden gelince) ── */}
          {requestId && reqStatus !== 'accepted' && reqStatus !== 'rejected' && (
            <View style={s.reqRow}>
              <View style={s.reqInfo}>
                <Ionicons name="person-add-outline" size={16} color="#FBBF24" />
                <Text style={s.reqTx}>Seni takip etmek istiyor</Text>
              </View>
              <View style={s.reqBtns}>
                <TouchableOpacity
                  style={[s.reqAccept, reqStatus === 'loading_accept' && { opacity: 0.6 }]}
                  disabled={!!reqStatus}
                  onPress={async () => {
                    setReqStatus('loading_accept');
                    try {
                      await api.post(`/social/follow-request/${requestId}/accept`, {}, token);
                      if (notifId) await api.delete(`/notifications/${notifId}`, token).catch(() => {});
                      setReqStatus('accepted');
                      setUser(u => ({ ...u, followers_count: (u.followers_count || 0) + 1 }));
                    } catch (e) {
                      setReqStatus(null);
                      Alert.alert(t('common.error'), e?.data?.detail || t('common.operationFailed'));
                    }
                  }}
                >
                  {reqStatus === 'loading_accept'
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.reqAcceptTx}>Kabul Et</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.reqReject, reqStatus === 'loading_reject' && { opacity: 0.6 }]}
                  disabled={!!reqStatus}
                  onPress={async () => {
                    setReqStatus('loading_reject');
                    try {
                      await api.post(`/social/follow-request/${requestId}/reject`, {}, token);
                      if (notifId) await api.delete(`/notifications/${notifId}`, token).catch(() => {});
                      setReqStatus('rejected');
                    } catch (e) {
                      setReqStatus(null);
                      Alert.alert(t('common.error'), e?.data?.detail || t('common.operationFailed'));
                    }
                  }}
                >
                  {reqStatus === 'loading_reject'
                    ? <ActivityIndicator size="small" color="#F87171" />
                    : <Text style={s.reqRejectTx}>Reddet</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
          {requestId && reqStatus === 'accepted' && (
            <View style={s.reqDone}>
              <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
              <Text style={[s.reqTx, { color:'#4ADE80' }]}>Takip isteği kabul edildi</Text>
            </View>
          )}
          {requestId && reqStatus === 'rejected' && (
            <View style={s.reqDone}>
              <Ionicons name="close-circle" size={16} color="rgba(248,248,248,0.35)" />
              <Text style={[s.reqTx, { color:'rgba(248,248,248,0.35)' }]}>Takip isteği reddedildi</Text>
            </View>
          )}

          {/* CTA buttons — misafir için giriş yap banner'ı */}
          {!isOwnProfile && isGuest && (
            <TouchableOpacity
              style={{ flexDirection:'row', alignItems:'center', gap:10, backgroundColor:'rgba(192,132,252,0.08)',
                borderWidth:1, borderColor:'rgba(192,132,252,0.2)', borderRadius:14, padding:14, marginBottom:16 }}
              onPress={() => navigation.navigate('Auth')}
              activeOpacity={0.8}
            >
              <Ionicons name="person-add-outline" size={20} color="#C084FC" />
              <View style={{ flex:1 }}>
                <Text style={{ fontSize:13, fontWeight:'700', color:'#C084FC' }}>Takip etmek için giriş yap</Text>
                <Text style={{ fontSize:11, color:'rgba(248,248,248,0.4)', marginTop:2 }}>Giriş yap veya kayıt ol</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(192,132,252,0.5)" />
            </TouchableOpacity>
          )}
          {!isOwnProfile && authUser && !isGuest && isBlockedByMe && (
            <View style={s.ctaRow}>
              <TouchableOpacity style={s.unblockBtn} onPress={handleUnblock}>
                <Ionicons name="ban-outline" size={15} color="#F87171" />
                <Text style={s.unblockTx}>{t('common.unblock')}</Text>
              </TouchableOpacity>
            </View>
          )}
          {!isOwnProfile && authUser && !isGuest && !isBlockedByMe && (
            <View style={s.ctaRow}>
              <TouchableOpacity
                style={[s.followBtn, isFollowing && s.followBtnActive, requestStatus === 'sent' && s.followBtnPending]}
                disabled={requestStatus === 'sent'}
                onPress={() => requireAuth(async () => {
                  try {
                    if (isFollowing) {
                      await api.delete(`/social/follow/${user.id}`, token);
                      setUser(u => ({ ...u, is_following: false, followers_count: (u.followers_count || 1) - 1 }));
                    } else {
                      const res = await api.post(`/social/follow/${user.id}`, {}, token);
                      if (res?.status === 'request_sent') {
                        setUser(u => ({ ...u, friend_request_status: 'sent' }));
                      } else {
                        setUser(u => ({ ...u, is_following: true, followers_count: (u.followers_count || 0) + 1 }));
                      }
                    }
                  } catch (e) { Alert.alert(t('common.error'), e?.data?.detail || t('common.operationFailed')); }
                })}
              >
                <Ionicons
                  name={isFollowing ? 'checkmark' : requestStatus === 'sent' ? 'time-outline' : isLocked ? 'lock-closed-outline' : 'person-add-outline'}
                  size={15}
                  color={isFollowing ? '#C084FC' : '#fff'}
                />
                <Text style={[s.followTx, isFollowing && s.followTxActive]}>
                  {isFollowing ? 'Takip Ediliyor' : requestStatus === 'sent' ? 'İstek Gönderildi' : isLocked ? 'İstek Gönder' : 'Takip Et'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.msgBtn} onPress={() => {
                navigation.navigate('Chat', {
                  conversationId: null,
                  recipientId: user.id,
                  recipientUsername: user.username,
                  recipientName: user.display_name || user.username,
                  recipientAvatar: user.avatar_url,
                });
              }}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#C084FC" />
                <Text style={s.msgTx}>Mesaj</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Private lock screen ── */}
        {isLocked && (
          <View style={s.privateLock}>
            <View style={s.privateLockIcon}>
              <Ionicons name="lock-closed" size={32} color="#C084FC" />
            </View>
            <Text style={s.privateLockTitle}>Bu hesap gizlidir</Text>
            <Text style={s.privateLockSub}>
              {requestStatus === 'sent'
                ? 'Takip isteğiniz gönderildi, onay bekleniyor.'
                : 'Paylaşımlarını görmek için takip isteği gönder.'}
            </Text>
          </View>
        )}

        {/* ── Story highlights ── */}
        {!isLocked && <ProfileStoriesHighlights
          userId={user?.id} username={user?.username} token={token}
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
        />}

        {/* ── Ortak Takipçiler ── */}
        {!isOwnProfile && displayMutualFollowers.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Ortak Takipçiler</Text>
            <View style={s.mutualCard}>
              <View style={s.mutualAvatars}>
                {displayMutualFollowers.slice(0,4).map((u,i) => (
                  <Image key={i} source={{ uri: u.avatar_url || `https://i.pravatar.cc/40?u=${u.username}` }}
                    style={[s.mutualAvatar, { marginLeft: i === 0 ? 0 : -10, zIndex: 4-i }]} />
                ))}
              </View>
              <Text style={s.mutualTx} numberOfLines={2}>
                <Text style={s.mutualName}>{displayMutualFollowers[0]?.display_name || displayMutualFollowers[0]?.username}</Text>
                {displayMutualFollowers.length > 1 ? ` ve ${displayMutualFollowers.length - 1} kişi daha takip ediyor` : ' takip ediyor'}
              </Text>
            </View>
          </View>
        ) : null}

        {/* ── Taste Match (other users) ── */}
        {!isOwnProfile && tasteMatch?.match_percentage != null ? (
          <View style={s.section}>
            <View style={s.tasteCard}>
              <LinearGradient
                colors={['rgba(192,132,252,0.12)', 'rgba(251,146,60,0.06)']}
                style={StyleSheet.absoluteFill} />
              <View style={[s.tasteGauge, { borderColor: tasteColor }]}>
                <Text style={[s.tastePct, { color: tasteColor }]}>{tasteMatch.match_percentage}%</Text>
                <Text style={s.tasteSub}>uyum</Text>
              </View>
              <View style={s.tasteRight}>
                <Text style={s.tasteTitle}>🎶 Müzik Zevki Uyumu</Text>
                {tasteMatch.common_genres?.length > 0 && (
                  <View style={s.tagRow}>
                    {tasteMatch.common_genres.slice(0, 3).map((g, i) => (
                      <View key={i} style={s.tag}><Text style={s.tagTx}>{g}</Text></View>
                    ))}
                  </View>
                )}
                {tasteMatch.common_artists?.length > 0 && (
                  <Text style={s.tasteArtistsTx} numberOfLines={1}>
                    {tasteMatch.common_artists.slice(0, 3).join(' · ')}
                  </Text>
                )}
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Müzik Kişilik Tipi ── */}
        {(() => { const p = getMusicPersonality(genres); return p ? (
          <View style={s.section}>
            <View style={s.personalityCard}>
              <LinearGradient colors={[p.color+'22','transparent']} style={StyleSheet.absoluteFill} start={{x:0,y:0}} end={{x:1,y:1}} />
              <View style={[s.personalityIcon, { backgroundColor: p.color+'22', borderColor: p.color+'44' }]}>
                <Ionicons name={p.icon} size={22} color={p.color} />
              </View>
              <View style={{flex:1}}>
                <Text style={s.personalityLabel}>MÜZİK KİŞİLİĞİ</Text>
                <Text style={[s.personalityType, { color: p.color }]}>{p.label}</Text>
              </View>
            </View>
          </View>
        ) : null; })()}

        {/* ── Now Playing ── */}
        {nowPlaying ? (
          <View style={s.section}>
            <View style={s.nowCard}>
              <LinearGradient
                colors={['rgba(192,132,252,0.15)', 'rgba(251,146,60,0.06)']}
                style={StyleSheet.absoluteFill} start={{ x:0, y:0 }} end={{ x:1, y:1 }} />
              <View style={s.nowLeft}>
                <Image
                  source={{ uri: nowPlaying.cover_url || `https://picsum.photos/seed/${nowPlaying.title}/80/80` }}
                  style={s.nowCover}
                />
              </View>
              <View style={s.nowMid}>
                <Text style={s.nowTag}>ŞU AN DİNLİYOR</Text>
                <Text style={s.nowTitle} numberOfLines={1}>{nowPlaying.title}</Text>
                <Text style={s.nowArtist} numberOfLines={1}>{nowPlaying.artist || ''}</Text>
              </View>
              <View style={s.nowWaves}>
                {[10, 18, 12, 22, 14, 20, 10].map((h, i) => (
                  <View key={i} style={[s.wave, { height: h, opacity: i % 2 === 0 ? 1 : 0.5 }]} />
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Favori Sanatçılar ── */}
        {!isLocked && displayFavArtists.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Favori Sanatçılar</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginHorizontal:-4}}>
              {displayFavArtists.slice(0,8).map((artist, i) => {
                const name = typeof artist === 'string' ? artist : (artist.name || artist);
                const img  = (typeof artist === 'object' && artist.image_url) || `https://picsum.photos/seed/${name}/80/80`;
                return (
                  <TouchableOpacity key={i} style={s.favArtistItem} activeOpacity={0.75}
                    onPress={() => navigation.navigate('Search', { query: name })}>
                    <Image source={{ uri: img }} style={s.favArtistAvatar} />
                    <Text style={s.favArtistName} numberOfLines={1}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* ── Herkese Açık Playlistler ── */}
        {displayPlaylists.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Playlistler</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginHorizontal:-4}}>
              {displayPlaylists.map((pl, i) => (
                <TouchableOpacity key={i} style={s.plCard}
                  onPress={() => navigation.navigate('PlaylistDetail', { playlistId: pl.id })}>
                  <Image source={{ uri: pl.cover_url || `https://picsum.photos/seed/pl${pl.id}/120/120` }} style={s.plCover} />
                  <LinearGradient colors={['transparent','rgba(8,6,15,0.85)']} style={StyleSheet.absoluteFill} />
                  <Text style={s.plName} numberOfLines={2}>{pl.name}</Text>
                  <Text style={s.plCount}>{pl.track_count ?? 0} şarkı</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* ── Son Dinlenenler ── */}
        {displayRecentTracks.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Son Dinlenenler</Text>
            <View style={s.statsBox}>
              {displayRecentTracks.map((track, i) => (
                <View key={i} style={[s.recentRow, i === displayRecentTracks.length-1 && {borderBottomWidth:0}]}>
                  <Image source={{ uri: track.cover_url || track.thumbnail || `https://picsum.photos/seed/${track.id}/60/60` }}
                    style={s.recentCover} />
                  <View style={{flex:1}}>
                    <Text style={s.recentTitle} numberOfLines={1}>{track.title}</Text>
                    <Text style={s.recentArtist} numberOfLines={1}>{track.artist || track.artist_name}</Text>
                  </View>
                  <Ionicons name="musical-note-outline" size={16} color="rgba(192,132,252,0.4)" />
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Müzik Rozetleri ── */}
        {displayBadges.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Rozetler</Text>
            <View style={s.badgesWrap}>
              {displayBadges.map((badge, i) => {
                const badgeMap = {
                  new_user:    { icon:'sparkles',        color:'#FBBF24', label:'Yeni Üye' },
                  early_bird:  { icon:'sunny',           color:'#FB923C', label:'Erken Kuş' },
                  social:      { icon:'people',          color:'#60A5FA', label:'Sosyal Kelebek' },
                  music_lover: { icon:'heart',           color:'#F472B6', label:'Müzik Aşığı' },
                  explorer:    { icon:'compass',         color:'#34D399', label:'Kaşif' },
                  night_owl:   { icon:'moon',            color:'#C084FC', label:'Gece Kuşu' },
                  top_listener:{ icon:'headset',         color:'#FB923C', label:'Top Dinleyici' },
                  veteran:     { icon:'shield-checkmark',color:'#34D399', label:'Veteran' },
                };
                const b = badgeMap[badge] || { icon:'ribbon', color:'#C084FC', label: badge };
                return (
                  <View key={i} style={[s.badge, { borderColor: b.color+'44', backgroundColor: b.color+'11' }]}>
                    <Ionicons name={b.icon} size={18} color={b.color} />
                    <Text style={[s.badgeTx, { color: b.color }]}>{b.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

      </Animated.ScrollView>

      {/* ── Avatar fullscreen ── */}
      <Modal visible={showAvatar} transparent animationType="fade" statusBarTranslucent>
        <TouchableOpacity style={s.avatarOverlay} activeOpacity={1} onPress={() => setShowAvatar(false)}>
          <Image source={{ uri: avatar }} style={s.avatarFull} resizeMode="contain" />
          <TouchableOpacity style={s.avatarClose} onPress={() => setShowAvatar(false)}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── More menu ── */}
      {/* ── Menu sheet ── */}
      {Platform.OS === 'web' ? (
        showMenu ? (
          <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, zIndex:100 }}>
            <TouchableOpacity
              style={{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(8,6,15,0.78)' }}
              activeOpacity={1}
              onPress={() => setShowMenu(false)}
            />
            <View style={[s.sheet, { position:'absolute', bottom:0, left:0, right:0, paddingBottom: insets.bottom + 12 }]}>
              <View style={s.sheetHandle} />
              {[
                ...(isBlockedByMe ? [
                  { icon:'ban-outline', color:'#4ADE80', label: t('common.unblock'),
                    fn: async () => { await handleUnblock(); } },
                ] : !isGuest ? [
                  { icon:'ban-outline',    color:'#F87171', label: t('common.block'),    danger: true,
                    fn: async () => {
                      await api.post(`/social/block/${user.id}`, {}, token);
                      setUser(u => ({ ...u, is_following: false, is_blocked_by_me: true, followers_count: Math.max(0, (u.followers_count || 0) - 1) }));
                      Alert.alert(t('profile.blocked'), t('profile.userBlocked'));
                      navigation.goBack();
                    } },
                  { icon:'eye-off-outline',color:'#FBBF24', label: t('profile.restrict'),
                    fn: async () => { await api.post(`/social/restrict/${user.id}`, {}, token); Alert.alert(t('profile.restricted'), t('profile.userRestricted')); } },
                  { icon: isMuted ? 'volume-high-outline' : 'notifications-off-outline',
                    color:'#60A5FA', label: isMuted ? t('common.unmute') : t('common.mute'),
                    fn: async () => {
                      if (isMuted) { await api.delete(`/social/mute/${user.id}`, token); setIsMuted(false); }
                      else { await api.post(`/social/mute/${user.id}?mute_stories=true&mute_posts=true&mute_notifications=true`, {}, token); setIsMuted(true); }
                    } },
                ] : []),
                { icon:'flag-outline', color:'#FB923C', label: t('profile.reportUser'),
                  fn: () => { setShowMenu(false); setShowReport(true); } },
              ].map((item, idx) => (
                <TouchableOpacity key={idx} style={s.menuRow} onPress={async () => {
                  setShowMenu(false);
                  try { await item.fn(); }
                  catch (e) { Alert.alert(t('common.error'), e?.data?.detail || t('common.operationFailed')); }
                }}>
                  <View style={[s.menuIcon, { backgroundColor: item.color + '22' }]}>
                    <Ionicons name={item.icon} size={18} color={item.color} />
                  </View>
                  <Text style={[s.menuTx, item.danger && { color:'#F87171' }]}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color="rgba(248,248,248,0.2)" />
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowMenu(false)}>
                <Text style={s.cancelTx}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null
      ) : (
        <Modal visible={showMenu} transparent animationType="slide" onRequestClose={() => setShowMenu(false)}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
            <View style={[s.sheet, { paddingBottom: insets.bottom + 12 }]} onStartShouldSetResponder={() => true}>
              <LinearGradient colors={['rgba(26,10,46,0.35)', 'rgba(16,8,28,0.10)', 'rgba(10,5,18,0.02)', 'transparent']} locations={[0, 0.38, 0.68, 1]} style={s.sheetGrad} pointerEvents="none" />
              <View style={s.sheetHandle} />
              {[
                ...(isBlockedByMe ? [
                  { icon:'ban-outline', color:'#4ADE80', label: t('common.unblock'),
                    fn: async () => { await handleUnblock(); } },
                ] : !isGuest ? [
                  { icon:'ban-outline',    color:'#F87171', label: t('common.block'),    danger: true,
                    fn: async () => {
                      await api.post(`/social/block/${user.id}`, {}, token);
                      setUser(u => ({ ...u, is_following: false, is_blocked_by_me: true, followers_count: Math.max(0, (u.followers_count || 0) - 1) }));
                      Alert.alert(t('profile.blocked'), t('profile.userBlocked'));
                      navigation.goBack();
                    } },
                  { icon:'eye-off-outline',color:'#FBBF24', label: t('profile.restrict'),
                    fn: async () => { await api.post(`/social/restrict/${user.id}`, {}, token); Alert.alert(t('profile.restricted'), t('profile.userRestricted')); } },
                  { icon: isMuted ? 'volume-high-outline' : 'notifications-off-outline',
                    color:'#60A5FA', label: isMuted ? t('common.unmute') : t('common.mute'),
                    fn: async () => {
                      if (isMuted) { await api.delete(`/social/mute/${user.id}`, token); setIsMuted(false); }
                      else { await api.post(`/social/mute/${user.id}?mute_stories=true&mute_posts=true&mute_notifications=true`, {}, token); setIsMuted(true); }
                    } },
                ] : []),
                { icon:'flag-outline', color:'#FB923C', label: t('profile.reportUser'),
                  fn: () => { setShowMenu(false); setShowReport(true); } },
              ].map((item, idx) => (
                <TouchableOpacity key={idx} style={s.menuRow} onPress={async () => {
                  setShowMenu(false);
                  try { await item.fn(); }
                  catch (e) { Alert.alert(t('common.error'), e?.data?.detail || t('common.operationFailed')); }
                }}>
                  <View style={[s.menuIcon, { backgroundColor: item.color + '22' }]}>
                    <Ionicons name={item.icon} size={18} color={item.color} />
                  </View>
                  <Text style={[s.menuTx, item.danger && { color:'#F87171' }]}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color="rgba(248,248,248,0.2)" />
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowMenu(false)}>
                <Text style={s.cancelTx}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* ── Report sheet ── */}
      {Platform.OS === 'web' ? (
        showReport ? (
          <View style={{ position:'absolute', top:0, left:0, right:0, bottom:0, zIndex:100 }}>
            <TouchableOpacity
              style={{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(8,6,15,0.78)' }}
              activeOpacity={1}
              onPress={() => setShowReport(false)}
            />
            <View style={[s.sheet, { position:'absolute', bottom:0, left:0, right:0, paddingBottom: insets.bottom + 24 }]}>
              <View style={s.sheetHandle} />
              <Text style={s.reportTitle}>{t('profile.reportTitle', { username: user?.username })}</Text>
              <Text style={s.reportSub}>{t('profile.reportWhy')}</Text>
              {REPORT_REASONS(t).map(r => (
                <TouchableOpacity key={r.value} style={s.reportRow} onPress={async () => {
                  try {
                    await api.post('/reports', { reported_id: user.id, report_type: 'user', reason: r.value }, token);
                    setShowReport(false);
                    Alert.alert(t('profile.reportThanks'), t('profile.reportReceived'));
                  } catch (e) { Alert.alert(t('common.error'), e?.data?.detail || t('profile.reportFailed')); }
                }}>
                  <Text style={s.reportRowTx}>{r.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color="rgba(248,248,248,0.2)" />
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowReport(false)}>
                <Text style={s.cancelTx}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null
      ) : (
        <Modal visible={showReport} transparent animationType="slide" onRequestClose={() => setShowReport(false)}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowReport(false)}>
            <View style={[s.sheet, { paddingBottom: insets.bottom + 24 }]} onStartShouldSetResponder={() => true}>
              <View style={s.sheetHandle} />
              <Text style={s.reportTitle}>{t('profile.reportTitle', { username: user?.username })}</Text>
              <Text style={s.reportSub}>{t('profile.reportWhy')}</Text>
              {REPORT_REASONS(t).map(r => (
                <TouchableOpacity key={r.value} style={s.reportRow} onPress={async () => {
                  try {
                    await api.post('/reports', { reported_id: user.id, report_type: 'user', reason: r.value }, token);
                    setShowReport(false);
                    Alert.alert(t('profile.reportThanks'), t('profile.reportReceived'));
                  } catch (e) { Alert.alert(t('common.error'), e?.data?.detail || t('profile.reportFailed')); }
                }}>
                  <Text style={s.reportRowTx}>{r.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color="rgba(248,248,248,0.2)" />
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowReport(false)}>
                <Text style={s.cancelTx}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex:1, backgroundColor:'#08060F' },
  center:       { flex:1, alignItems:'center', justifyContent:'center' },
  emptyTx:      { color:'rgba(248,248,248,0.35)', fontSize:14 },
  backRow:      { paddingHorizontal:16, paddingVertical:14 },

  /* Sticky header */
  stickyHdr:    { position:'absolute', top:0, left:0, right:0, zIndex:20,
                  flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingBottom:12,
                  backgroundColor:'rgba(8,6,15,0.97)', borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.06)' },
  stickyBack:   { padding:4, marginRight:8 },
  stickyName:   { flex:1, color:'#F8F8F8', fontSize:16, fontWeight:'700', letterSpacing:-0.3 },
  stickyMore:   { padding:4 },

  floatBar:     { position:'absolute', left:0, right:0, zIndex:30, flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16 },
  floatRight:   { flexDirection:'row', gap:8 },
  floatBtn:     { width:34, height:34, borderRadius:17, backgroundColor:'rgba(0,0,0,0.5)',
                  alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.14)' },

  /* Hero gradient */
  heroBg: { height: COVER_H, width: '100%' },

  /* Identity */
  identityBlock:{ paddingHorizontal:20, marginTop:-36, paddingBottom:8 },
  avatarRing:   { width:90, height:90, borderRadius:45, borderWidth:3, borderColor:'#C084FC',
                  marginBottom:14, position:'relative', zIndex:20, elevation:20,
                  shadowColor:'#C084FC', shadowOpacity:0.55, shadowRadius:14, shadowOffset:{width:0,height:0} },
  avatar:       { width:'100%', height:'100%', borderRadius:45 },
  nowDot:       { position:'absolute', bottom:1, right:1, width:20, height:20, borderRadius:10,
                  backgroundColor:'#C084FC', borderWidth:2, borderColor:'#08060F',
                  alignItems:'center', justifyContent:'center' },

  nameGroup:    { flexDirection:'row', alignItems:'center', gap:6, marginBottom:3 },
  displayName:  { fontSize:23, fontWeight:'800', color:'#F8F8F8', letterSpacing:-0.5 },

  reqRow:       { backgroundColor:'rgba(251,191,36,0.08)', borderWidth:1, borderColor:'rgba(251,191,36,0.2)',
                  borderRadius:16, padding:14, marginBottom:14, gap:10 },
  reqInfo:      { flexDirection:'row', alignItems:'center', gap:8 },
  reqTx:        { color:'rgba(248,248,248,0.7)', fontSize:13, fontWeight:'500' },
  reqBtns:      { flexDirection:'row', gap:10 },
  reqAccept:    { flex:1, backgroundColor:'#C084FC', borderRadius:12, paddingVertical:10,
                  alignItems:'center', justifyContent:'center' },
  reqAcceptTx:  { color:'#fff', fontSize:14, fontWeight:'700' },
  reqReject:    { flex:1, backgroundColor:'rgba(248,113,113,0.12)', borderWidth:1, borderColor:'rgba(248,113,113,0.3)',
                  borderRadius:12, paddingVertical:10, alignItems:'center', justifyContent:'center' },
  reqRejectTx:  { color:'#F87171', fontSize:14, fontWeight:'600' },
  reqDone:      { flexDirection:'row', alignItems:'center', gap:8, marginBottom:14,
                  backgroundColor:'rgba(255,255,255,0.04)', borderRadius:12, padding:12 },
  handle:       { fontSize:14, color:'rgba(248,248,248,0.38)', marginBottom:10 },
  bio:          { fontSize:14, color:'rgba(248,248,248,0.62)', lineHeight:21, marginBottom:12 },

  metaRow:      { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:16 },
  metaChip:     { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'rgba(255,255,255,0.06)',
                  paddingHorizontal:10, paddingVertical:5, borderRadius:20 },
  metaTx:       { fontSize:12, color:'rgba(248,248,248,0.45)' },

  statsCard:    { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(255,255,255,0.04)',
                  borderRadius:18, padding:16, marginBottom:18, borderWidth:1, borderColor:'rgba(255,255,255,0.07)' },
  statItem:     { flex:1, alignItems:'center' },
  statNum:      { fontSize:19, fontWeight:'800', color:'#F8F8F8', letterSpacing:-0.5 },
  statLabel:    { fontSize:11, color:'rgba(248,248,248,0.38)', marginTop:2, fontWeight:'500' },
  statLine:     { width:1, height:30, backgroundColor:'rgba(255,255,255,0.08)' },

  ctaRow:       { flexDirection:'row', gap:10 },
  followBtn:    { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:7,
                  backgroundColor:'#C084FC', paddingVertical:13, borderRadius:24 },
  followBtnActive: { backgroundColor:'rgba(192,132,252,0.12)', borderWidth:1.5, borderColor:'rgba(192,132,252,0.4)' },
  followBtnPending:{ backgroundColor:'rgba(251,146,60,0.12)', borderWidth:1.5, borderColor:'rgba(251,146,60,0.4)' },
  followTx:     { color:'#fff', fontSize:14, fontWeight:'700' },
  followTxActive:{ color:'#C084FC' },

  privateLock:      { alignItems:'center', paddingVertical:40, paddingHorizontal:32 },
  privateLockIcon:  { width:64, height:64, borderRadius:32, backgroundColor:'rgba(192,132,252,0.12)',
                      borderWidth:1.5, borderColor:'rgba(192,132,252,0.3)', alignItems:'center', justifyContent:'center', marginBottom:16 },
  privateLockTitle: { fontSize:17, fontWeight:'700', color:'#F8F8F8', marginBottom:8 },
  privateLockSub:   { fontSize:13, color:'rgba(248,248,248,0.45)', textAlign:'center', lineHeight:19 },
  msgBtn:       { flexDirection:'row', alignItems:'center', gap:7, paddingVertical:13, paddingHorizontal:20,
                  borderRadius:24, backgroundColor:'rgba(192,132,252,0.1)', borderWidth:1.5, borderColor:'rgba(192,132,252,0.3)' },
  msgTx:        { color:'#C084FC', fontSize:14, fontWeight:'600' },
  unblockBtn:   { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:7,
                  backgroundColor:'rgba(248,113,113,0.1)', borderWidth:1.5, borderColor:'rgba(248,113,113,0.4)', paddingVertical:13, borderRadius:24 },
  unblockTx:    { color:'#F87171', fontSize:14, fontWeight:'700' },
  blockedBadge: { flexDirection:'row', alignItems:'center', gap:6, paddingVertical:13, paddingHorizontal:18,
                  borderRadius:24, backgroundColor:'rgba(248,113,113,0.06)', borderWidth:1, borderColor:'rgba(248,113,113,0.2)' },
  blockedBadgeTx:{ color:'rgba(248,113,113,0.7)', fontSize:13, fontWeight:'500' },

  /* Sections */
  section:      { paddingHorizontal:20, paddingTop:8 },
  sectionTitle: { fontSize:16, fontWeight:'700', color:'#F8F8F8', letterSpacing:-0.2, marginBottom:14 },

  /* Now playing */
  nowCard:      { flexDirection:'row', alignItems:'center', gap:14, borderRadius:18, padding:14,
                  overflow:'hidden', borderWidth:1, borderColor:'rgba(192,132,252,0.22)', marginBottom:8 },
  nowLeft:      {},
  nowCover:     { width:50, height:50, borderRadius:12 },
  nowMid:       { flex:1 },
  nowTag:       { fontSize:9, fontWeight:'700', color:'#C084FC', letterSpacing:1.2, marginBottom:4 },
  nowTitle:     { fontSize:14, fontWeight:'700', color:'#F8F8F8', marginBottom:2 },
  nowArtist:    { fontSize:12, color:'rgba(248,248,248,0.45)' },
  nowWaves:     { flexDirection:'row', alignItems:'center', gap:2 },
  wave:         { width:3, borderRadius:2, backgroundColor:'#C084FC' },

  /* Taste match */
  tasteCard:    { flexDirection:'row', alignItems:'center', gap:16, borderRadius:18, padding:18,
                  overflow:'hidden', borderWidth:1, borderColor:'rgba(255,255,255,0.07)', marginBottom:8 },
  tasteGauge:   { width:64, height:64, borderRadius:32, borderWidth:3,
                  alignItems:'center', justifyContent:'center', backgroundColor:'rgba(255,255,255,0.04)' },
  tastePct:     { fontSize:16, fontWeight:'800', letterSpacing:-0.5 },
  tasteSub:     { fontSize:9, color:'rgba(248,248,248,0.35)', fontWeight:'500' },
  tasteRight:   { flex:1 },
  tasteTitle:   { fontSize:14, fontWeight:'700', color:'#F8F8F8', marginBottom:8 },
  tagRow:       { flexDirection:'row', flexWrap:'wrap', gap:6, marginBottom:6 },
  tag:          { backgroundColor:'rgba(192,132,252,0.14)', paddingHorizontal:10, paddingVertical:4,
                  borderRadius:20, borderWidth:1, borderColor:'rgba(192,132,252,0.2)' },
  tagTx:        { fontSize:11, color:'#C084FC', fontWeight:'500' },
  tasteArtistsTx:{ fontSize:12, color:'rgba(248,248,248,0.4)' },

  /* Stats boxes */
  statsBox:     { backgroundColor:'rgba(255,255,255,0.04)', borderRadius:18, padding:18,
                  marginBottom:12, borderWidth:1, borderColor:'rgba(255,255,255,0.06)' },
  statsBoxHeader:{ flexDirection:'row', alignItems:'flex-start', justifyContent:'space-between', marginBottom:4 },
  statsBoxLabel: { fontSize:12, color:'rgba(248,248,248,0.4)', fontWeight:'600', letterSpacing:0.4,
                   textTransform:'uppercase', marginBottom:4 },
  statsBoxValue: { fontSize:26, fontWeight:'800', color:'#F8F8F8', letterSpacing:-0.8 },
  statsBoxUnit:  { fontSize:14, fontWeight:'400', color:'rgba(248,248,248,0.45)' },
  statsChip:    { flexDirection:'row', alignItems:'center', gap:4, backgroundColor:'rgba(52,211,153,0.12)',
                  paddingHorizontal:10, paddingVertical:5, borderRadius:20 },
  statsChipTx:  { fontSize:12, color:'#34D399', fontWeight:'600' },

  /* Artists */
  artistRow:    { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:10,
                  borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.05)' },
  artistRank:   { width:18, fontSize:13, fontWeight:'700', color:'rgba(248,248,248,0.25)', textAlign:'center' },
  artistAvatar: { width:40, height:40, borderRadius:20 },
  artistName:   { flex:1, fontSize:14, fontWeight:'600', color:'#F8F8F8' },
  artistPlays:  { flexDirection:'row', alignItems:'center', gap:4 },
  artistPlaysTx:{ fontSize:12, color:'rgba(248,248,248,0.3)' },

  /* Modals */
  overlay:      { flex:1, backgroundColor:'rgba(8,6,15,0.88)', justifyContent:'flex-end', zIndex:100 },
  sheet:        { backgroundColor:'#08060F', borderTopLeftRadius:32, borderTopRightRadius:32,
                  padding:24, borderTopWidth:1, borderColor:'rgba(192,132,252,0.18)' },
  sheetGrad:    { position:'absolute', top:0, left:0, right:0, height:80, borderTopLeftRadius:32, borderTopRightRadius:32 },
  sheetHandle:  { width:40, height:4, borderRadius:2, backgroundColor:'rgba(192,132,252,0.30)', alignSelf:'center', marginBottom:16 },
  menuRow:      { flexDirection:'row', alignItems:'center', gap:14, paddingVertical:14,
                  borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.05)' },
  menuIcon:     { width:36, height:36, borderRadius:18, alignItems:'center', justifyContent:'center' },
  menuTx:       { flex:1, fontSize:15, color:'#F8F8F8', fontWeight:'500' },
  cancelBtn:    { marginTop:14, paddingVertical:14, alignItems:'center', borderRadius:14,
                  backgroundColor:'rgba(255,255,255,0.05)' },
  cancelTx:     { color:'rgba(248,248,248,0.45)', fontSize:15, fontWeight:'500' },
  reportTitle:  { fontSize:18, fontWeight:'800', color:'#F8F8F8', marginBottom:4, letterSpacing:-0.3 },
  reportSub:    { fontSize:13, color:'rgba(248,248,248,0.4)', marginBottom:18 },
  reportRow:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center',
                  paddingVertical:14, paddingHorizontal:16, borderRadius:12,
                  backgroundColor:'rgba(255,255,255,0.04)', marginBottom:6,
                  borderWidth:1, borderColor:'rgba(255,255,255,0.06)' },
  reportRowTx:  { fontSize:14, color:'#F8F8F8' },

  /* Social links */
  socialRow:    { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:16 },
  socialBtn:    { flexDirection:'row', alignItems:'center', gap:7,
                  backgroundColor:'rgba(255,255,255,0.05)', borderRadius:20,
                  paddingHorizontal:12, paddingVertical:7,
                  borderWidth:1, borderColor:'rgba(255,255,255,0.08)' },
  socialIcon:   { width:26, height:26, borderRadius:13, alignItems:'center', justifyContent:'center',
                  borderWidth:1 },
  socialTx:     { fontSize:13, color:'rgba(248,248,248,0.7)', fontWeight:'500' },

  /* Music personality */
  personalityCard: { flexDirection:'row', alignItems:'center', gap:14, borderRadius:18, padding:16,
                     overflow:'hidden', borderWidth:1, borderColor:'rgba(255,255,255,0.08)', marginBottom:4 },
  personalityIcon: { width:46, height:46, borderRadius:23, alignItems:'center', justifyContent:'center', borderWidth:1 },
  personalityLabel:{ fontSize:9, fontWeight:'700', color:'rgba(248,248,248,0.35)', letterSpacing:1.2, textTransform:'uppercase', marginBottom:4 },
  personalityType: { fontSize:18, fontWeight:'800', letterSpacing:-0.4 },

  /* Favorite artists */
  favArtistItem:  { alignItems:'center', marginHorizontal:8, width:64 },
  favArtistAvatar:{ width:58, height:58, borderRadius:29, marginBottom:7,
                    borderWidth:2, borderColor:'rgba(192,132,252,0.3)' },
  favArtistName:  { fontSize:11, color:'rgba(248,248,248,0.6)', textAlign:'center', fontWeight:'500' },

  /* Playlists */
  plCard:       { width:120, height:150, borderRadius:16, overflow:'hidden', marginHorizontal:5,
                  justifyContent:'flex-end', padding:10 },
  plCover:      { ...StyleSheet.absoluteFillObject, width:'100%', height:'100%' },
  plName:       { fontSize:12, fontWeight:'700', color:'#F8F8F8', letterSpacing:-0.2, marginBottom:2 },
  plCount:      { fontSize:10, color:'rgba(248,248,248,0.45)' },

  /* Mutual followers */
  mutualCard:   { flexDirection:'row', alignItems:'center', gap:14,
                  backgroundColor:'rgba(255,255,255,0.04)', borderRadius:18, padding:16,
                  borderWidth:1, borderColor:'rgba(255,255,255,0.07)' },
  mutualAvatars:{ flexDirection:'row' },
  mutualAvatar: { width:36, height:36, borderRadius:18, borderWidth:2, borderColor:'#08060F' },
  mutualTx:     { flex:1, fontSize:13, color:'rgba(248,248,248,0.5)', lineHeight:18 },
  mutualName:   { color:'#F8F8F8', fontWeight:'700' },

  /* Recent tracks */
  recentRow:    { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:10,
                  borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.05)' },
  recentCover:  { width:42, height:42, borderRadius:10 },
  recentTitle:  { fontSize:14, fontWeight:'600', color:'#F8F8F8', marginBottom:2 },
  recentArtist: { fontSize:12, color:'rgba(248,248,248,0.4)' },

  /* Badges */
  badgesWrap:   { flexDirection:'row', flexWrap:'wrap', gap:8 },
  badge:        { flexDirection:'row', alignItems:'center', gap:7,
                  paddingHorizontal:14, paddingVertical:9, borderRadius:24, borderWidth:1 },
  badgeTx:      { fontSize:12, fontWeight:'700' },

  /* Avatar fullscreen */
  avatarOverlay:{ flex:1, backgroundColor:'rgba(0,0,0,0.92)', alignItems:'center', justifyContent:'center' },
  avatarFull:   { width:'90%', height:'90%' },
  avatarClose:  { position:'absolute', top:56, right:20, width:40, height:40, borderRadius:20,
                  backgroundColor:'rgba(255,255,255,0.15)', alignItems:'center', justifyContent:'center' },
});
