/**
 * ProfileScreen — QENARA Design System 2026
 * Own profile · Music-first · No photo/video posts · Graphical listening stats
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  Dimensions, RefreshControl, Modal, Animated, Pressable, ActivityIndicator, Platform, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const { width: SW } = Dimensions.get('window');

const COVER_H = 80;

const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/* ── Weekly bar chart ── */
function WeeklyBars({ data }) {
  const max = Math.max(...data, 1);
  return (
    <View style={wb.wrap}>
      {data.map((v, i) => {
        const h = Math.max(4, (v / max) * 56);
        const isToday = i === (new Date().getDay() + 6) % 7;
        return (
          <View key={i} style={wb.col}>
            <View style={wb.barTrack}>
              <View style={[wb.bar, { height: h, backgroundColor: isToday ? '#C084FC' : 'rgba(192,132,252,0.32)' }]} />
            </View>
            <Text style={[wb.day, isToday && { color: '#C084FC' }]}>{DAYS[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}
const wb = StyleSheet.create({
  wrap:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 8 },
  col:      { alignItems: 'center', gap: 6, flex: 1 },
  barTrack: { height: 56, justifyContent: 'flex-end' },
  bar:      { width: 10, borderRadius: 5 },
  day:      { fontSize: 10, color: 'rgba(248,248,248,0.30)', fontWeight: '500' },
});

/* ── Animated genre bar ── */
function GenreBar({ label, pct, color }) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: pct, duration: 900, delay: 200, useNativeDriver: false }).start();
  }, [pct]);
  return (
    <View style={gb.row}>
      <Text style={gb.label}>{label}</Text>
      <View style={gb.track}>
        <Animated.View style={[gb.fill, {
          backgroundColor: color,
          width: w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
        }]} />
      </View>
      <Text style={gb.pct}>{pct}%</Text>
    </View>
  );
}
const gb = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
  label: { width: 72, fontSize: 12, color: 'rgba(248,248,248,0.55)', fontWeight: '500' },
  track: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 3 },
  pct:   { width: 30, fontSize: 11, color: 'rgba(248,248,248,0.35)', textAlign: 'right' },
});

/* ── Mock highlights ── */

export default function ProfileScreen({ navigation }) {
  const { colors }       = useTheme();
  const { user, token, logout, updateUser, isGuest } = useAuth();
  const { t }            = useTranslation();
  const insets           = useSafeAreaInsets();

  const [refreshing,   setRefreshing]   = useState(false);
  const [menuVisible,  setMenuVisible]  = useState(false);
  const [showAvatar,   setShowAvatar]   = useState(false);
  const [listenStats,  setListenStats]  = useState(null);
  const [nowPlaying,   setNowPlaying]   = useState(null);
  const [myStories,    setMyStories]    = useState(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  /* Always hold latest user to avoid stale-closure in useFocusEffect */
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const loadStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [stats, np] = await Promise.all([
        api.get(`/users/${user.id}/listening-stats`).catch(() => null),
        api.get(`/users/${user.id}/now-playing`).catch(() => null),
      ]);
      if (stats) setListenStats(stats);
      if (np?.now_playing) setNowPlaying(np.now_playing);
    } catch {}
  }, [user?.id]);

  useEffect(() => { loadStats(); }, [loadStats]);

  /* Refresh profile data + own stories when screen focused */
  useFocusEffect(useCallback(() => {
    if (!token) return;
    api.get('/auth/me', token)
      .then(data => {
        if (data?.id) updateUser?.({ ...userRef.current, ...data });
      })
      .catch(() => {});
    api.get('/stories/my', token)
      .then(res => {
        const stories = Array.isArray(res) ? res : [];
        setMyStories(stories.length > 0 ? stories : null);
      })
      .catch(() => {});
  }, [token, updateUser]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  /* Demo fallbacks */
  const genres = listenStats?.top_genres || [
    { label: 'Electronic', pct: 72, color: '#C084FC' },
    { label: 'Hip-Hop',    pct: 55, color: '#FB923C' },
    { label: 'Indie',      pct: 38, color: '#34D399' },
    { label: 'R&B',        pct: 28, color: '#F472B6' },
    { label: 'Classical',  pct: 14, color: '#60A5FA' },
  ];
  const topArtists = listenStats?.top_artists || [
    { name: 'The Weeknd',   img: 'https://picsum.photos/seed/a1/80/80', plays: 142 },
    { name: 'Billie Eilish',img: 'https://picsum.photos/seed/a2/80/80', plays: 98  },
    { name: 'Tame Impala',  img: 'https://picsum.photos/seed/a3/80/80', plays: 87  },
  ];
  const weeklyHours = listenStats?.weekly_minutes_per_day
    ? listenStats.weekly_minutes_per_day.map(m => m / 60)
    : [1.2, 2.5, 0.8, 3.1, 2.0, 4.2, 1.8];
  const totalHours = listenStats?.total_hours_this_week
    ?? Math.round(weeklyHours.reduce((a, b) => a + b, 0));

  const avatar = user?.avatar_url || user?.avatar || `https://i.pravatar.cc/200?u=${user?.id}`;

  const headerOpacity = scrollY.interpolate({
    inputRange: [COVER_H - 80, COVER_H],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  if (isGuest || !token) {
    return (
      <View style={[s.root, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingTop: insets.top }]}>
        <LinearGradient
          colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
          locations={[0, 0.18, 0.32, 1]}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <TouchableOpacity
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard')}
          style={{ position: 'absolute', top: insets.top + 8, left: 16, padding: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color="#F8F8F8" />
        </TouchableOpacity>
        <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: 'rgba(192,132,252,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(192,132,252,0.3)' }}>
          <Ionicons name="person-outline" size={36} color="#C084FC" />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#F8F8F8', marginBottom: 10, letterSpacing: -0.5 }}>Profilini Oluştur</Text>
        <Text style={{ fontSize: 14, color: 'rgba(248,248,248,0.45)', textAlign: 'center', lineHeight: 21, marginBottom: 32 }}>
          Giriş yaparak müzik geçmişini takip et, arkadaşlarını takip et ve daha fazlasını keşfet.
        </Text>
        <TouchableOpacity
          style={{ width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}
          onPress={() => navigation.navigate('Auth')}
          activeOpacity={0.88}
        >
          <LinearGradient colors={['#9333EA', '#C084FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 15, alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Giriş Yap</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ width: '100%', paddingVertical: 14, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(192,132,252,0.3)' }}
          onPress={() => navigation.navigate('Register')}
          activeOpacity={0.88}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#C084FC' }}>Kayıt Ol</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Sticky header ── */}
      <Animated.View style={[s.stickyHdr, { paddingTop: insets.top, opacity: headerOpacity }]}>
        <Text style={s.stickyName} numberOfLines={1}>{user?.display_name || user?.name || user?.username}</Text>
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={s.stickyMore}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#F8F8F8" />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Float top bar ── */}
      <View style={[s.floatBar, { top: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')} style={s.floatBtn}>
          <Ionicons name="chevron-back" size={20} color="#F8F8F8" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={s.floatBtn}>
          <Ionicons name="ellipsis-horizontal" size={20} color="#F8F8F8" />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C084FC" />}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 68 + 40 }}
      >
        {/* hero gradient spacer — insets.top pushes content below status bar */}
        <View style={{ height: COVER_H + insets.top }} />

        {/* ── Identity ── */}
        <View style={s.identityBlock}>
          {/* Avatar ring — tap opens stories if any, otherwise fullscreen avatar */}
          <TouchableOpacity
            style={s.avatarRing}
            activeOpacity={0.9}
            onPress={() => {
              if (myStories) {
                navigation.navigate('StoryViewer', {
                  feed: [{
                    username: user?.username || 'me',
                    user_display_name: user?.display_name || user?.username || 'Me',
                    user_avatar: user?.avatar_url || user?.avatar || `https://i.pravatar.cc/80?u=${user?.id}`,
                    user_id: user?.id,
                    stories: myStories,
                  }],
                  startUserIndex: 0,
                  startStoryIndex: 0,
                });
              } else {
                setShowAvatar(true);
              }
            }}
          >
            <LinearGradient
              colors={myStories ? ['#9333EA', '#FB923C'] : ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.08)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.avatarGrad}
            >
              <Image source={{ uri: avatar }} style={s.avatar} />
            </LinearGradient>
            {nowPlaying && (
              <View style={s.nowDot}>
                <Ionicons name="musical-note" size={7} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          {/* Name */}
          <Text style={s.displayName}>{user?.display_name || user?.name || 'Your Name'}</Text>
          <Text style={s.handle}>@{user?.username || 'username'}</Text>
          {user?.bio ? <Text style={s.bio}>{user.bio}</Text> : null}

          {/* Location / website / social */}
          {(user?.city || user?.country || user?.location) ? (
            <View style={s.metaRow}>
              <Ionicons name="location-outline" size={13} color="rgba(248,248,248,0.35)" />
              <Text style={s.metaTx}>
                {[user?.city, user?.country].filter(Boolean).join(', ') || user?.location}
              </Text>
            </View>
          ) : null}
          {user?.website ? (
            <View style={s.metaRow}>
              <Ionicons name="globe-outline" size={13} color="rgba(248,248,248,0.35)" />
              <Text style={s.metaTx}>{user.website}</Text>
            </View>
          ) : null}
          {(user?.instagram || user?.twitter) ? (
            <View style={s.metaLinks}>
              {user?.instagram ? (
                <TouchableOpacity
                  style={s.metaChip}
                  activeOpacity={0.7}
                  onPress={() => Linking.openURL(`https://instagram.com/${user.instagram}`)}
                >
                  <Ionicons name="logo-instagram" size={13} color="#E1306C" />
                  <Text style={s.metaChipTx}>@{user.instagram}</Text>
                </TouchableOpacity>
              ) : null}
              {user?.twitter ? (
                <TouchableOpacity
                  style={s.metaChip}
                  activeOpacity={0.7}
                  onPress={() => Linking.openURL(`https://x.com/${user.twitter}`)}
                >
                  <Ionicons name="logo-twitter" size={13} color="#1DA1F2" />
                  <Text style={s.metaChipTx}>@{user.twitter}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* Stats */}
          <View style={s.statsCard}>
            <TouchableOpacity style={s.statItem}
              onPress={() => navigation.navigate('FollowersList', { userId: user?.id, displayName: 'Takipçiler' })}>
              <Text style={s.statNum}>{(user?.followers_count ?? 0).toLocaleString()}</Text>
              <Text style={s.statLabel}>Takipçi</Text>
            </TouchableOpacity>
            <View style={s.statLine} />
            <TouchableOpacity style={s.statItem}
              onPress={() => navigation.navigate('FollowingList', { userId: user?.id, displayName: 'Takip Edilenler' })}>
              <Text style={s.statNum}>{(user?.following_count ?? 0).toLocaleString()}</Text>
              <Text style={s.statLabel}>Takip</Text>
            </TouchableOpacity>
          </View>

          {/* Action buttons */}
          <View style={s.ctaRow}>
            <TouchableOpacity style={s.editBtn} onPress={() => navigation.navigate('ProfileEdit')}>
              <Ionicons name="create-outline" size={15} color="#F8F8F8" />
              <Text style={s.editTx}>Profili Düzenle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.statsBtn} onPress={() => navigation.navigate('ProfileStats')}>
              <LinearGradient
                colors={['#C084FC', '#A855F7']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.statsBtnGrad}
              >
                <View style={s.miniChart}>
                  {[0.45, 1, 0.65, 0.85].map((h, i) => (
                    <View key={i} style={[s.miniBar, { height: 13 * h, opacity: i === 1 ? 1 : 0.6 }]} />
                  ))}
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>


        {/* ── Now Playing ── */}
        {nowPlaying ? (
          <View style={s.section}>
            <View style={s.nowCard}>
              <LinearGradient
                colors={['rgba(192,132,252,0.15)', 'rgba(251,146,60,0.06)']}
                style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
              <Image
                source={{ uri: nowPlaying.cover_url || `https://picsum.photos/seed/${nowPlaying.title}/80/80` }}
                style={s.nowCover}
              />
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

        {/* ── Dinleme İstatistikleri ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Dinleme İstatistikleri</Text>

          {/* Weekly */}
          <View style={s.statsBox}>
            <View style={s.statsBoxHeader}>
              <View>
                <Text style={s.statsBoxLabel}>Bu Hafta</Text>
                <Text style={s.statsBoxValue}>
                  {totalHours} <Text style={s.statsBoxUnit}>saat</Text>
                </Text>
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
            <Text style={[s.statsBoxLabel, { marginBottom: 14 }]}>En Çok Dinlenen Türler</Text>
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


      {/* ── Avatar fullscreen ── */}
      <Modal visible={showAvatar} transparent animationType="fade" statusBarTranslucent>
        <TouchableOpacity style={s.avatarOverlay} activeOpacity={1} onPress={() => setShowAvatar(false)}>
          <Image source={{ uri: avatar }} style={s.avatarFull} resizeMode="contain" />
          <TouchableOpacity style={s.avatarClose} onPress={() => setShowAvatar(false)}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Menu Modal ── */}
      {Platform.OS === 'web' ? (
        menuVisible ? (
          <View style={[StyleSheet.absoluteFill, s.overlay]} pointerEvents="box-none">
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuVisible(false)} />
            <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} onStartShouldSetResponder={() => true}>
              <LinearGradient colors={['rgba(26,10,46,0.35)', 'rgba(16,8,28,0.10)', 'rgba(10,5,18,0.02)', 'transparent']} locations={[0, 0.38, 0.68, 1]} style={s.sheetGrad} pointerEvents="none" />
              <View style={s.sheetHandle} />
              {[
                { icon: 'settings-outline',  color: '#C084FC', label: 'Ayarlar',      nav: 'Settings'      },
                { icon: 'trending-up-outline', color: '#C084FC', label: 'İstatistikler', nav: 'ProfileStats'  },
              ].map(item => (
                <TouchableOpacity key={item.nav} style={s.menuRow} onPress={() => { setMenuVisible(false); navigation.navigate(item.nav); }}>
                  <View style={[s.menuIcon, { backgroundColor: item.color + '22' }]}>
                    <Ionicons name={item.icon} size={18} color={item.color} />
                  </View>
                  <Text style={s.menuTx}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color="rgba(248,248,248,0.2)" />
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={s.menuRow} onPress={() => { setMenuVisible(false); if (typeof window !== 'undefined' && window.__sbForceLogout) { window.__sbForceLogout(); } else { logout?.(); try { navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); } catch (_) {} } }}>
                <View style={[s.menuIcon, { backgroundColor: '#F8717122' }]}>
                  <Ionicons name="log-out-outline" size={18} color="#F87171" />
                </View>
                <Text style={[s.menuTx, { color: '#F87171' }]}>Çıkış Yap</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setMenuVisible(false)}>
                <Text style={s.cancelTx}>İptal</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null
      ) : (
        <Modal visible={menuVisible} transparent animationType="slide" onRequestClose={() => setMenuVisible(false)}>
          <Pressable style={s.overlay} onPress={() => setMenuVisible(false)}>
            <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} onStartShouldSetResponder={() => true}>
              <LinearGradient colors={['rgba(26,10,46,0.35)', 'rgba(16,8,28,0.10)', 'rgba(10,5,18,0.02)', 'transparent']} locations={[0, 0.38, 0.68, 1]} style={s.sheetGrad} pointerEvents="none" />
              <View style={s.sheetHandle} />
              {[
                { icon: 'settings-outline',  color: '#C084FC', label: 'Ayarlar',      nav: 'Settings'      },
                { icon: 'trending-up-outline', color: '#C084FC', label: 'İstatistikler', nav: 'ProfileStats'  },
              ].map(item => (
                <TouchableOpacity key={item.nav} style={s.menuRow} onPress={() => { setMenuVisible(false); navigation.navigate(item.nav); }}>
                  <View style={[s.menuIcon, { backgroundColor: item.color + '22' }]}>
                    <Ionicons name={item.icon} size={18} color={item.color} />
                  </View>
                  <Text style={s.menuTx}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color="rgba(248,248,248,0.2)" />
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={s.menuRow} onPress={() => { setMenuVisible(false); if (typeof window !== 'undefined' && window.__sbForceLogout) { window.__sbForceLogout(); } else { logout?.(); try { navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); } catch (_) {} } }}>
                <View style={[s.menuIcon, { backgroundColor: '#F8717122' }]}>
                  <Ionicons name="log-out-outline" size={18} color="#F87171" />
                </View>
                <Text style={[s.menuTx, { color: '#F87171' }]}>Çıkış Yap</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setMenuVisible(false)}>
                <Text style={s.cancelTx}>İptal</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#08060F' },

  /* Sticky header */
  stickyHdr:  { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
                flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12,
                backgroundColor: 'rgba(8,6,15,0.97)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  stickyName: { flex: 1, color: '#F8F8F8', fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  stickyMore: { padding: 4 },

  floatBar: { position: 'absolute', left: 0, right: 0, zIndex: 30,
              flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  floatBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.5)',
              alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },

  /* Hero gradient */
  heroBg: { height: COVER_H, width: '100%' },

  /* Identity */
  identityBlock: { paddingHorizontal: 20, marginTop: -46, paddingBottom: 8 },
  avatarRing:    { width: 92, height: 92, borderRadius: 46, marginBottom: 14, position: 'relative', zIndex: 20, elevation: 20 },
  avatarGrad:    { width: 92, height: 92, borderRadius: 46, padding: 3, alignItems: 'center', justifyContent: 'center' },
  avatar:        { width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: '#08060F' },
  nowDot:        { position: 'absolute', bottom: 1, right: 1, width: 20, height: 20, borderRadius: 10,
                   backgroundColor: '#C084FC', borderWidth: 2, borderColor: '#08060F',
                   alignItems: 'center', justifyContent: 'center' },

  displayName: { fontSize: 23, fontWeight: '800', color: '#F8F8F8', letterSpacing: -0.5, marginBottom: 3 },
  handle:      { fontSize: 14, color: 'rgba(248,248,248,0.38)', marginBottom: 10 },
  bio:         { fontSize: 14, color: 'rgba(248,248,248,0.60)', lineHeight: 21, marginBottom: 8 },

  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  metaTx:      { fontSize: 13, color: 'rgba(248,248,248,0.40)' },
  metaLinks:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 8 },
  metaChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.06)',
                 borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  metaChipTx:  { fontSize: 12, color: 'rgba(248,248,248,0.55)', fontWeight: '500' },

  statsCard:  { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: 18, padding: 16, marginTop: 10, marginBottom: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  statItem:   { flex: 1, alignItems: 'center' },
  statNum:    { fontSize: 19, fontWeight: '800', color: '#F8F8F8', letterSpacing: -0.5 },
  statLabel:  { fontSize: 11, color: 'rgba(248,248,248,0.38)', marginTop: 2, fontWeight: '500' },
  statLine:   { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.08)' },

  ctaRow:     { flexDirection: 'row', gap: 10, marginBottom: 8 },
  editBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                backgroundColor: 'rgba(255,255,255,0.07)', paddingVertical: 12, borderRadius: 24,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  editTx:     { color: '#F8F8F8', fontSize: 14, fontWeight: '600' },
  insightBtn:   { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(192,132,252,0.10)',
                  alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(192,132,252,0.25)' },
  statsBtn:     { width: 46, height: 46, borderRadius: 16, overflow: 'hidden',
                  shadowColor: '#C084FC', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 10, elevation: 8 },
  statsBtnGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  miniChart:    { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  miniBar:      { width: 4, borderRadius: 2, backgroundColor: '#fff' },

  /* Highlights */
  highlightsContent: { paddingHorizontal: 20, gap: 16 },
  highlightWrap:     { alignItems: 'center', gap: 6 },
  highlightAdd:      { width: 64, height: 64, borderRadius: 32, borderWidth: 1.5,
                       borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  highlightRing:     { width: 68, height: 68, borderRadius: 34, borderWidth: 2.5,
                       borderColor: '#C084FC', alignItems: 'center', justifyContent: 'center', padding: 3 },
  highlightCover:    { width: 60, height: 60, borderRadius: 30 },
  highlightLabel:    { fontSize: 11, fontWeight: '600', color: 'rgba(248,248,248,0.5)' },

  /* Sections */
  section:      { paddingHorizontal: 20, paddingTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#F8F8F8', letterSpacing: -0.2, marginBottom: 14 },

  /* Now Playing */
  nowCard:   { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, padding: 14,
               overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(192,132,252,0.22)', marginBottom: 8 },
  nowCover:  { width: 50, height: 50, borderRadius: 12 },
  nowMid:    { flex: 1 },
  nowTag:    { fontSize: 9, fontWeight: '700', color: '#C084FC', letterSpacing: 1.2, marginBottom: 4 },
  nowTitle:  { fontSize: 14, fontWeight: '700', color: '#F8F8F8', marginBottom: 2 },
  nowArtist: { fontSize: 12, color: 'rgba(248,248,248,0.45)' },
  nowWaves:  { flexDirection: 'row', alignItems: 'center', gap: 2 },
  wave:      { width: 3, borderRadius: 2, backgroundColor: '#C084FC' },

  /* Stats boxes */
  statsBox:       { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 18,
                    marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  statsBoxHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  statsBoxLabel:  { fontSize: 12, color: 'rgba(248,248,248,0.40)', fontWeight: '600', letterSpacing: 0.4,
                    textTransform: 'uppercase', marginBottom: 4 },
  statsBoxValue:  { fontSize: 26, fontWeight: '800', color: '#F8F8F8', letterSpacing: -0.8 },
  statsBoxUnit:   { fontSize: 14, fontWeight: '400', color: 'rgba(248,248,248,0.45)' },
  statsChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(52,211,153,0.12)',
                    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statsChipTx:    { fontSize: 12, color: '#34D399', fontWeight: '600' },

  /* Artists */
  artistRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
                   borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  artistRank:    { width: 18, fontSize: 13, fontWeight: '700', color: 'rgba(248,248,248,0.25)', textAlign: 'center' },
  artistAvatar:  { width: 40, height: 40, borderRadius: 20 },
  artistName:    { flex: 1, fontSize: 14, fontWeight: '600', color: '#F8F8F8' },
  artistPlays:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  artistPlaysTx: { fontSize: 12, color: 'rgba(248,248,248,0.30)' },

  /* Modal */
  overlay:     { flex: 1, backgroundColor: 'rgba(8,6,15,0.88)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: '#08060F', borderTopLeftRadius: 32, borderTopRightRadius: 32,
                 padding: 24, borderTopWidth: 1, borderColor: 'rgba(192,132,252,0.18)' },
  sheetGrad:   { position: 'absolute', top: 0, left: 0, right: 0, height: 110, borderTopLeftRadius: 32, borderTopRightRadius: 32 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(192,132,252,0.30)',
                 alignSelf: 'center', marginBottom: 20 },
  menuRow:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14,
                 borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  menuIcon:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  menuTx:      { flex: 1, fontSize: 15, color: '#F8F8F8', fontWeight: '500' },
  cancelBtn:   { marginTop: 14, paddingVertical: 14, alignItems: 'center', borderRadius: 14,
                 backgroundColor: 'rgba(255,255,255,0.05)' },
  cancelTx:    { color: 'rgba(248,248,248,0.45)', fontSize: 15, fontWeight: '500' },


  avatarOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  avatarFull:    { width: '90%', height: '90%' },
  avatarClose:   { position: 'absolute', top: 56, right: 20, width: 40, height: 40, borderRadius: 20,
                   backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});
