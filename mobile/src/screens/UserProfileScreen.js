/**
 * UserProfileScreen — AURORA Design 2026
 * Music-first social profile · No photo/video posts · Follow system only
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Alert, Modal, Linking, Dimensions, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

const { width: SW } = Dimensions.get('window');
const COVER_H = 80;

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

/* ── Graphical genre bar ── */
function GenreBar({ label, pct, color }) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: pct, duration: 900, delay: 200, useNativeDriver: false }).start();
  }, [pct]);
  return (
    <View style={gb.row}>
      <Text style={gb.label}>{label}</Text>
      <View style={gb.track}>
        <Animated.View style={[gb.fill, { backgroundColor: color, width: w.interpolate({ inputRange:[0,100], outputRange:['0%','100%'] }) }]} />
      </View>
      <Text style={gb.pct}>{pct}%</Text>
    </View>
  );
}
const gb = StyleSheet.create({
  row:   { flexDirection:'row', alignItems:'center', gap:10, marginBottom:9 },
  label: { width:72, fontSize:12, color:'rgba(248,248,248,0.55)', fontWeight:'500' },
  track: { flex:1, height:6, backgroundColor:'rgba(255,255,255,0.07)', borderRadius:3, overflow:'hidden' },
  fill:  { height:'100%', borderRadius:3 },
  pct:   { width:30, fontSize:11, color:'rgba(248,248,248,0.35)', textAlign:'right' },
});

/* ── Weekly bars ── */
const DAYS = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
function WeeklyBars({ data }) {
  const max = Math.max(...data, 1);
  return (
    <View style={wb.wrap}>
      {data.map((v, i) => {
        const h = Math.max(4, (v / max) * 56);
        const isToday = i === new Date().getDay() - 1;
        return (
          <View key={i} style={wb.col}>
            <View style={wb.barTrack}>
              <View style={[wb.bar, { height: h, backgroundColor: isToday ? '#C084FC' : 'rgba(192,132,252,0.35)' }]} />
            </View>
            <Text style={[wb.day, isToday && { color:'#C084FC' }]}>{DAYS[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}
const wb = StyleSheet.create({
  wrap:     { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-end', paddingTop:8 },
  col:      { alignItems:'center', gap:6, flex:1 },
  barTrack: { height:56, justifyContent:'flex-end' },
  bar:      { width:10, borderRadius:5 },
  day:      { fontSize:10, color:'rgba(248,248,248,0.3)', fontWeight:'500' },
});

export default function UserProfileScreen({ navigation, route }) {
  const { colors }                = useTheme();
  const { t }                     = useTranslation();
  const insets                    = useSafeAreaInsets();
  const { token, user: authUser } = useAuth();
  const { username }              = route.params || {};

  const [user,       setUser]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [isMuted,    setIsMuted]    = useState(false);
  const [nowPlaying, setNowPlaying] = useState(null);
  const [tasteMatch, setTasteMatch] = useState(null);
  const [listenStats,setListenStats]= useState(null);
  const [showMenu,   setShowMenu]   = useState(false);
  const [showReport, setShowReport] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const isOwnProfile = authUser?.username === username;

  useEffect(() => {
    if (!username) { setLoading(false); return; }
    api.get(`/user/${username}`, token)
      .then(setUser).catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    if (!user?.id || !token || isOwnProfile) return;
    api.get(`/social/is-muted/${user.id}`, token)
      .then(r => setIsMuted(r?.is_muted || false)).catch(() => {});
  }, [user?.id, token, isOwnProfile]);

  useEffect(() => {
    if (!user?.id) return;
    api.get(`/users/${user.id}/now-playing`, token)
      .then(r => setNowPlaying(r?.now_playing || null)).catch(() => {});
    api.get(`/users/${user.id}/listening-stats`, token)
      .then(setListenStats).catch(() => {});
    if (!isOwnProfile && token)
      api.get(`/users/${user.id}/taste-match`, token)
        .then(setTasteMatch).catch(() => {});
  }, [user?.id, token, isOwnProfile]);

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

  const avatar     = user.avatar_url || `https://i.pravatar.cc/200?u=${user.username}`;
  const isFollowing = user.is_following || false;

  /* Demo stats fallback */
  const genres  = listenStats?.top_genres  || [
    { label:'Electronic', pct:72, color:'#C084FC' },
    { label:'Hip-Hop',    pct:55, color:'#FB923C' },
    { label:'Indie',      pct:38, color:'#34D399' },
    { label:'R&B',        pct:28, color:'#F472B6' },
    { label:'Classical',  pct:14, color:'#60A5FA' },
  ];
  const topArtists = listenStats?.top_artists || [
    { name:'The Weeknd',  img:'https://picsum.photos/seed/a1/80/80', plays:142 },
    { name:'Billie Eilish',img:'https://picsum.photos/seed/a2/80/80',plays:98  },
    { name:'Tame Impala', img:'https://picsum.photos/seed/a3/80/80', plays:87  },
  ];
  const weeklyHours = listenStats?.weekly_minutes_per_day
    ? listenStats.weekly_minutes_per_day.map(m => m / 60)
    : [1.2, 2.5, 0.8, 3.1, 2.0, 4.2, 1.8];
  const totalHours = listenStats?.total_hours_this_week
    ?? Math.round(weeklyHours.reduce((a, b) => a + b, 0));

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

      {/* ── Sticky header (on scroll) ── */}
      <Animated.View style={[s.stickyHdr, { paddingTop: insets.top, opacity: headerOpacity }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.stickyBack}>
          <Ionicons name="chevron-back" size={22} color="#F8F8F8" />
        </TouchableOpacity>
        <Text style={s.stickyName} numberOfLines={1}>{user.display_name || user.username}</Text>
        {!isOwnProfile && (
          <TouchableOpacity onPress={() => setShowMenu(true)} style={s.stickyMore}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#F8F8F8" />
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* ── Floating buttons (before scroll) ── */}
      <View style={[s.floatBar, { top: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.floatBtn}>
          <Ionicons name="chevron-back" size={20} color="#F8F8F8" />
        </TouchableOpacity>
        {!isOwnProfile && (
          <TouchableOpacity onPress={() => setShowMenu(true)} style={s.floatBtn}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#F8F8F8" />
          </TouchableOpacity>
        )}
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* hero gradient spacer */}
        <View style={s.heroBg} />

        {/* ── Identity block ── */}
        <View style={s.identityBlock}>
          {/* Avatar */}
          <View style={s.avatarRing}>
            <Image source={{ uri: avatar }} style={s.avatar} />
            {nowPlaying && (
              <View style={s.nowDot}>
                <Ionicons name="musical-note" size={7} color="#fff" />
              </View>
            )}
          </View>

          {/* Name + handle */}
          <View style={s.nameGroup}>
            <Text style={s.displayName}>{user.display_name || user.username}</Text>
            {user.is_verified && <VerifiedBadge size={16} />}
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
            <View style={s.statLine} />
            <View style={s.statItem}>
              <Text style={s.statNum}>{listenStats?.total_tracks_played ?? '—'}</Text>
              <Text style={s.statLabel}>Dinleme</Text>
            </View>
          </View>

          {/* CTA buttons */}
          {!isOwnProfile && authUser && (
            <View style={s.ctaRow}>
              <TouchableOpacity
                style={[s.followBtn, isFollowing && s.followBtnActive]}
                onPress={async () => {
                  try {
                    if (isFollowing) {
                      await api.delete(`/social/follow/${user.id}`, token);
                      setUser(u => ({ ...u, is_following: false, followers_count: (u.followers_count || 1) - 1 }));
                    } else {
                      await api.post(`/social/follow/${user.id}`, {}, token);
                      setUser(u => ({ ...u, is_following: true, followers_count: (u.followers_count || 0) + 1 }));
                    }
                  } catch (e) { Alert.alert(t('common.error'), e?.data?.detail || t('common.operationFailed')); }
                }}
              >
                <Ionicons name={isFollowing ? 'checkmark' : 'person-add-outline'} size={15} color={isFollowing ? '#C084FC' : '#fff'} />
                <Text style={[s.followTx, isFollowing && s.followTxActive]}>
                  {isFollowing ? 'Takip Ediliyor' : 'Takip Et'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.msgBtn} onPress={async () => {
                try {
                  const conv = await api.post('/messages/conversations', { participant_ids: [user.id], is_group: false }, token);
                  navigation.navigate('Chat', { conversationId: conv.id, otherUser: user });
                } catch (e) { Alert.alert(t('common.error'), e?.data?.detail || t('profile.chatFailed')); }
              }}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#C084FC" />
                <Text style={s.msgTx}>Mesaj</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Story highlights ── */}
        <ProfileStoriesHighlights
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
        />

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

        {/* ── Taste Match (other users) ── */}
        {!isOwnProfile && tasteMatch?.match_percentage != null ? (
          <View style={s.section}>
            <View style={s.tasteCard}>
              <LinearGradient
                colors={['rgba(192,132,252,0.12)', 'rgba(251,146,60,0.06)']}
                style={StyleSheet.absoluteFill} />
              {/* Circular gauge */}
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

        {/* ── Listening Stats ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Dinleme İstatistikleri</Text>

          {/* Weekly hours card */}
          <View style={s.statsBox}>
            <View style={s.statsBoxHeader}>
              <View>
                <Text style={s.statsBoxLabel}>Bu Hafta</Text>
                <Text style={s.statsBoxValue}>{totalHours} <Text style={s.statsBoxUnit}>saat</Text></Text>
              </View>
              <View style={s.statsChip}>
                <Ionicons name="trending-up" size={12} color="#34D399" />
                <Text style={s.statsChipTx}>+12%</Text>
              </View>
            </View>
            <WeeklyBars data={weeklyHours} />
          </View>

          {/* Top genres */}
          <View style={s.statsBox}>
            <Text style={s.statsBoxLabel} style={[s.statsBoxLabel, { marginBottom: 14 }]}>En Çok Dinlenen Türler</Text>
            {genres.map((g, i) => (
              <GenreBar key={i} label={g.label || g.genre} pct={g.pct || g.percentage || 0} color={g.color || '#C084FC'} />
            ))}
          </View>

          {/* Top artists */}
          <View style={s.statsBox}>
            <Text style={[s.statsBoxLabel, { marginBottom: 14 }]}>En Çok Dinlenen Sanatçılar</Text>
            {topArtists.map((a, i) => (
              <View key={i} style={s.artistRow}>
                <Text style={s.artistRank}>{i + 1}</Text>
                <Image
                  source={{ uri: a.img || a.image_url || `https://picsum.photos/seed/${a.name}/80/80` }}
                  style={s.artistAvatar}
                />
                <Text style={s.artistName} numberOfLines={1}>{a.name || a.artist_name}</Text>
                <View style={s.artistPlays}>
                  <Ionicons name="headset-outline" size={12} color="rgba(248,248,248,0.3)" />
                  <Text style={s.artistPlaysTx}>{a.plays || a.play_count || 0}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

      </Animated.ScrollView>

      {/* ── More menu ── */}
      <Modal visible={showMenu} transparent animationType="fade">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowMenu(false)}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            {[
              { icon:'ban-outline',    color:'#F87171', label: t('common.block'),    danger: true,
                fn: async () => { await api.post(`/social/block/${user.id}`, {}, token); Alert.alert(t('profile.blocked'), t('profile.userBlocked')); navigation.goBack(); } },
              { icon:'eye-off-outline',color:'#FBBF24', label: t('profile.restricted'),
                fn: async () => { await api.post(`/social/restrict/${user.id}`, {}, token); Alert.alert(t('profile.restricted'), t('profile.userRestricted')); } },
              { icon: isMuted ? 'volume-high-outline' : 'notifications-off-outline',
                color:'#60A5FA', label: isMuted ? t('common.unmute') : t('common.mute'),
                fn: async () => {
                  if (isMuted) { await api.delete(`/social/mute/${user.id}`, token); setIsMuted(false); }
                  else { await api.post(`/social/mute/${user.id}?mute_stories=true&mute_posts=true&mute_notifications=true`, {}, token); setIsMuted(true); }
                } },
              { icon:'flag-outline',   color:'#FB923C', label: t('profile.reportUser'),
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

      {/* ── Report modal ── */}
      <Modal visible={showReport} transparent animationType="slide">
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowReport(false)}>
          <View style={[s.sheet, { paddingBottom: insets.bottom + 24 }]} onStartShouldSetResponder={() => true}>
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

  floatBar:     { position:'absolute', left:0, right:0, zIndex:15, flexDirection:'row', justifyContent:'space-between', paddingHorizontal:16 },
  floatBtn:     { width:34, height:34, borderRadius:17, backgroundColor:'rgba(0,0,0,0.5)',
                  alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.14)' },

  /* Hero gradient */
  heroBg: { height: COVER_H, width: '100%' },

  /* Identity */
  identityBlock:{ paddingHorizontal:20, marginTop:-46, paddingBottom:8 },
  avatarRing:   { width:90, height:90, borderRadius:45, borderWidth:3, borderColor:'#C084FC',
                  marginBottom:14, position:'relative',
                  shadowColor:'#C084FC', shadowOpacity:0.55, shadowRadius:14, shadowOffset:{width:0,height:0} },
  avatar:       { width:'100%', height:'100%', borderRadius:45 },
  nowDot:       { position:'absolute', bottom:1, right:1, width:20, height:20, borderRadius:10,
                  backgroundColor:'#C084FC', borderWidth:2, borderColor:'#08060F',
                  alignItems:'center', justifyContent:'center' },

  nameGroup:    { flexDirection:'row', alignItems:'center', gap:6, marginBottom:3 },
  displayName:  { fontSize:23, fontWeight:'800', color:'#F8F8F8', letterSpacing:-0.5 },
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
  followBtnActive:{ backgroundColor:'rgba(192,132,252,0.12)', borderWidth:1.5, borderColor:'rgba(192,132,252,0.4)' },
  followTx:     { color:'#fff', fontSize:14, fontWeight:'700' },
  followTxActive:{ color:'#C084FC' },
  msgBtn:       { flexDirection:'row', alignItems:'center', gap:7, paddingVertical:13, paddingHorizontal:20,
                  borderRadius:24, backgroundColor:'rgba(192,132,252,0.1)', borderWidth:1.5, borderColor:'rgba(192,132,252,0.3)' },
  msgTx:        { color:'#C084FC', fontSize:14, fontWeight:'600' },

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
  overlay:      { flex:1, backgroundColor:'rgba(8,6,15,0.78)', justifyContent:'flex-end' },
  sheet:        { backgroundColor:'#120E20', borderTopLeftRadius:26, borderTopRightRadius:26,
                  padding:24, borderWidth:1, borderColor:'rgba(255,255,255,0.07)' },
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
});
