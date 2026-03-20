import { AppRegistry } from 'react-native';
import { createRoot } from 'react-dom/client';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable, Image, Animated, Modal, FlatList, ScrollView, TextInput } from 'react-native';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 0, staleTime: Infinity } } });

import i18n from '../../mobile/src/i18n';
import { ThemeProvider, useTheme } from '../../mobile/src/contexts/ThemeContext';
import { AuthProvider } from '../../mobile/src/contexts/AuthContext';
import { NotificationProvider } from '../../mobile/src/contexts/NotificationContext';
import { PlayerProvider, usePlayer } from './mocks/player-context.jsx';
import { isLiked, toggleLike, subscribe as likedSubscribe } from '../../mobile/src/lib/likedStore';
import { getPlaylistsCache, enqueuePendingTrack } from '../../mobile/src/lib/playlistStore';

// Screens
import LoginScreen                from '../../mobile/src/screens/LoginScreen';
import RegisterScreen             from '../../mobile/src/screens/RegisterScreen';
import SettingsScreen             from '../../mobile/src/screens/SettingsScreen';
import NotificationsScreen        from '../../mobile/src/screens/NotificationsScreen';
import DashboardScreen            from '../../mobile/src/screens/DashboardScreen';
import ProfileScreen              from '../../mobile/src/screens/ProfileScreen';
import ForgotPasswordScreen       from '../../mobile/src/screens/ForgotPasswordScreen';
import ResetPasswordScreen        from '../../mobile/src/screens/ResetPasswordScreen';
import PlaylistsScreen            from '../../mobile/src/screens/PlaylistsScreen';
import PlaylistDetailScreen       from '../../mobile/src/screens/PlaylistDetailScreen';
import AddSongsToPlaylistScreen   from '../../mobile/src/screens/AddSongsToPlaylistScreen';
import ARMusicScreen              from '../../mobile/src/screens/ARMusicScreen';
import ListeningRoomScreen        from '../../mobile/src/screens/ListeningRoomScreen';
import SearchScreen               from '../../mobile/src/screens/SearchScreen';
import ConversationsScreen        from '../../mobile/src/screens/ConversationsScreen';
import ChatScreen                 from '../../mobile/src/screens/ChatScreen';
import CreateGroupScreen          from '../../mobile/src/screens/CreateGroupScreen';
import GroupSettingsScreen        from '../../mobile/src/screens/GroupSettingsScreen';
import UserProfileScreen          from '../../mobile/src/screens/UserProfileScreen';
import ProfileEditScreen          from '../../mobile/src/screens/ProfileEditScreen';
import ProfileStatsScreen         from '../../mobile/src/screens/ProfileStatsScreen';
import ProfileQRScreen            from '../../mobile/src/screens/ProfileQRScreen';
import FollowersListScreen        from '../../mobile/src/screens/FollowersListScreen';
import FollowingListScreen        from '../../mobile/src/screens/FollowingListScreen';
import BlockedUsersScreen         from '../../mobile/src/screens/BlockedUsersScreen';
import MutedUsersScreen           from '../../mobile/src/screens/MutedUsersScreen';
import DiscoverPeopleScreen       from '../../mobile/src/screens/DiscoverPeopleScreen';
import StoryViewerScreen          from '../../mobile/src/screens/StoryViewerScreen';
import StoriesScreen              from '../../mobile/src/screens/StoriesScreen';
import StoryCreateScreen          from '../../mobile/src/screens/StoryCreateScreen';
import StoryArchiveScreen         from '../../mobile/src/screens/StoryArchiveScreen';
import EqualizerScreen            from '../../mobile/src/screens/EqualizerScreen';
import SongRadioScreen            from '../../mobile/src/screens/SongRadioScreen';
import LyricsScreen               from '../../mobile/src/screens/LyricsScreen';
import ListeningHistoryScreen     from '../../mobile/src/screens/ListeningHistoryScreen';
import MusicDiscoverScreen        from '../../mobile/src/screens/MusicDiscoverScreen';
import ChangePasswordScreen       from '../../mobile/src/screens/ChangePasswordScreen';
import ChangeEmailScreen          from '../../mobile/src/screens/ChangeEmailScreen';
import DeleteAccountScreen        from '../../mobile/src/screens/DeleteAccountScreen';
import SessionsScreen             from '../../mobile/src/screens/SessionsScreen';
import TwoFASettingsScreen        from '../../mobile/src/screens/TwoFASettingsScreen';
import ScreenTimeScreen           from '../../mobile/src/screens/ScreenTimeScreen';
import DataExportScreen           from '../../mobile/src/screens/DataExportScreen';
import NotificationSettingsScreen from '../../mobile/src/screens/NotificationSettingsScreen';
import LikedScreen                from '../../mobile/src/screens/LikedScreen';
import SavedScreen                from '../../mobile/src/screens/SavedScreen';
import MusicTasteTestScreen       from '../../mobile/src/screens/MusicTasteTestScreen';
import AchievementsScreen         from '../../mobile/src/screens/AchievementsScreen';
import BackupScreen               from '../../mobile/src/screens/BackupScreen';
import FeedbackScreen             from '../../mobile/src/screens/FeedbackScreen';
import LicensesScreen             from '../../mobile/src/screens/LicensesScreen';
import AudiomackScreen            from '../../mobile/src/screens/AudiomackScreen';
import AccountSettingsScreen      from '../../mobile/src/screens/AccountSettingsScreen';
import NotifSettingsScreen        from '../../mobile/src/screens/NotifSettingsScreen';
import AudioSettingsScreen        from '../../mobile/src/screens/AudioSettingsScreen';
import LanguageRegionScreen       from '../../mobile/src/screens/LanguageRegionScreen';
import DataBackupScreen           from '../../mobile/src/screens/DataBackupScreen';
import AccessibilitySettingsScreen from '../../mobile/src/screens/AccessibilitySettingsScreen';
import LegalSettingsScreen        from '../../mobile/src/screens/LegalSettingsScreen';

// Tab screens — matches MainTabNavigator exactly (Reels removed)
const TAB_SCREENS = [
  { name: 'Dashboard', label: 'Home',    icon: 'home',    iconOff: 'home-outline'    },
  { name: 'Library',   label: 'Library', icon: 'albums',  iconOff: 'albums-outline'  },
  { name: 'AR',        label: 'AR',      icon: 'glasses', iconOff: 'glasses-outline' },
  { name: 'Rooms',     label: 'Rooms',   icon: 'radio',   iconOff: 'radio-outline'   },
];

// Screens that show the tab bar
const TAB_NAMES = new Set(TAB_SCREENS.map(t => t.name));

// Screens for the dev toolbar
const ALL_SCREENS = [
  'Login', 'Register',
  'Dashboard', 'Library', 'AR', 'Rooms',
  'Search', 'Messages', 'Chat', 'Notifications',
  'Profile', 'UserProfile', 'ProfileEdit', 'FollowersList', 'FollowingList',
  'PostDetail', 'CreatePost', 'PlaylistDetail', 'SongRadio', 'Equalizer', 'Lyrics',
  'Stories', 'StoryCreate', 'StoryViewer', 'StoryArchive',
  'Settings', 'ChangePassword', 'BlockedUsers', 'ForgotPassword',
  'AccountSettings', 'NotifSettings', 'AudioSettings', 'LanguageRegion', 'DataBackup',
  'AccessibilitySettings', 'LegalSettings',
];

/* ─── Mock navigation (with history stack) ─────────────────── */
function makeMockNav(stack, setStack) {
  const current = () => stack[stack.length - 1] || { name: 'Dashboard', params: {} };

  const navigate = (name, params = {}) => {
    const resolved = name === 'Main' ? 'Dashboard' : name;
    setStack(s => {
      // Already on top — update params only
      if (s[s.length - 1]?.name === resolved)
        return [...s.slice(0, -1), { name: resolved, params }];
      // Screen exists earlier in the stack — pop back to it with merged params
      for (let i = s.length - 2; i >= 0; i--) {
        if (s[i].name === resolved) {
          const updated = [...s.slice(0, i + 1)];
          updated[i] = { name: resolved, params: { ...(s[i].params || {}), ...params } };
          return updated;
        }
      }
      // New screen — push
      return [...s, { name: resolved, params }];
    });
  };

  const goBack = () => {
    setStack(s => {
      if (s.length <= 1) return s;
      return s.slice(0, -1);
    });
  };

  return {
    navigate,
    goBack,
    push:           (name, params = {}) => setStack(s => [...s, { name, params }]),
    replace:        (name, params = {}) => setStack(s => [...s.slice(0, -1), { name, params }]),
    reset:          ({ routes } = {}) => {
      const name = routes?.[0]?.name || 'Dashboard';
      setStack([{ name: name === 'Main' ? 'Dashboard' : name, params: routes?.[0]?.params || {} }]);
    },
    setOptions:     () => {},
    setParams:      (params) => setStack(s => {
      if (!s.length) return s;
      const top = { ...s[s.length - 1], params: { ...(s[s.length - 1].params || {}), ...params } };
      return [...s.slice(0, -1), top];
    }),
    addListener:    () => () => {},
    removeListener: () => {},
    dispatch:       () => {},
    isFocused:      () => true,
    canGoBack:      () => stack.length > 1,
    getParent:      () => null,
    getId:          () => undefined,
  };
}

/* ─── Playlist Picker Modal ───────────────────────────────── */
function PlaylistPickerModal({ visible, track, onClose }) {
  const playlists = getPlaylistsCache().filter(p => !String(p.id).startsWith('pl-'));
  const handleSelect = (pl) => {
    if (!track || !pl?.id) return;
    enqueuePendingTrack(pl.id, track);
    onClose?.();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={plm.overlay} onPress={onClose}>
        <Pressable style={plm.sheet} onPress={e => e.stopPropagation()}>
          <View style={plm.handle} />
          <Text style={plm.title}>Çalma Listesine Ekle</Text>
          {playlists.length === 0 ? (
            <View style={plm.empty}>
              <ion-icon name="musical-notes-outline" style={{ fontSize: 40, color: '#666' }} />
              <Text style={plm.emptyText}>Henüz çalma listesi yok</Text>
              <Text style={plm.emptySub}>Kütüphane ekranından oluşturabilirsin</Text>
            </View>
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={item => item.id}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={plm.row} onPress={() => handleSelect(item)} activeOpacity={0.7}>
                  {item.covers?.[0] || item.cover ? (
                    <Image source={{ uri: item.covers?.[0] || item.cover }} style={plm.cover} />
                  ) : (
                    <View style={[plm.cover, plm.coverFallback]}>
                      <ion-icon name="musical-notes" style={{ fontSize: 18, color: '#C084FC', pointerEvents: 'none' }} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={plm.name} numberOfLines={1}>{item.name}</Text>
                    <Text style={plm.meta}>{item.track_count ?? 0} parça</Text>
                  </View>
                  <ion-icon name="add-circle-outline" style={{ fontSize: 24, color: '#C084FC', pointerEvents: 'none' }} />
                </TouchableOpacity>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const plm = StyleSheet.create({
  overlay:     { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:       { backgroundColor: '#0E0820', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(167,139,250,0.18)', paddingTop: 12, paddingBottom: 40 },
  handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 16 },
  title:       { fontSize: 17, fontWeight: '600', color: '#fff', paddingHorizontal: 20, marginBottom: 12 },
  row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)', gap: 14 },
  cover:       { width: 48, height: 48, borderRadius: 10 },
  coverFallback: { backgroundColor: '#1a1040', alignItems: 'center', justifyContent: 'center' },
  name:        { fontSize: 15, fontWeight: '600', color: '#fff' },
  meta:        { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  empty:       { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText:   { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  emptySub:    { fontSize: 13, color: 'rgba(255,255,255,0.3)' },
});

/* ─── Full Player Screen ──────────────────────────────────── */
function FullPlayerScreen({ navigation }) {
  const { currentTrack, isPlaying, progress, duration, play, pause, skip, prev, seekTo, repeatMode, shuffleMode, toggleRepeat, toggleShuffle, queue, queueIdx } = usePlayer() || {};

  const [liked, setLiked] = useState(() => isLiked(currentTrack?.id));
  const [showPlModal, setShowPlModal] = useState(false);

  useEffect(() => {
    setLiked(isLiked(currentTrack?.id));
    return likedSubscribe(() => setLiked(isLiked(currentTrack?.id)));
  }, [currentTrack?.id]);

  const fmt = (s) => {
    s = Math.floor(s || 0);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <View style={fp.root}>
      {/* Back */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={fp.backBtn}>
        <ion-icon name="chevron-down" style={{ fontSize: 28, color: '#fff', pointerEvents: 'none' }} />
      </TouchableOpacity>

      {/* Queue info */}
      {queue?.length > 1 && (
        <Text style={fp.queueInfo}>{(queueIdx || 0) + 1} / {queue.length}</Text>
      )}

      {/* Cover */}
      <Image
        source={{ uri: currentTrack?.cover_url || currentTrack?.cover || currentTrack?.thumbnail || 'https://picsum.photos/seed/fp/400/400' }}
        style={fp.cover}
      />

      {/* Title & Artist + Like/Add row */}
      <View style={fp.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={fp.trackTitle} numberOfLines={2}>{currentTrack?.title || currentTrack?.name || 'Şarkı Yok'}</Text>
          <Text style={fp.artist}>{currentTrack?.artist || currentTrack?.artist_name || ''}</Text>
        </View>
        <View style={fp.actionBtns}>
          <TouchableOpacity
            style={fp.actionBtn}
            onPress={() => currentTrack && toggleLike(currentTrack)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ion-icon
              name={liked ? 'heart' : 'heart-outline'}
              style={{ fontSize: 26, color: liked ? '#FF2D55' : 'rgba(255,255,255,0.5)', pointerEvents: 'none' }}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={fp.actionBtn}
            onPress={() => setShowPlModal(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ion-icon name="add-circle-outline" style={{ fontSize: 26, color: 'rgba(255,255,255,0.5)', pointerEvents: 'none' }} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress */}
      <View style={fp.progressRow}>
        <Text style={fp.timeText}>{fmt(progress)}</Text>
        <View style={fp.progressTrack}>
          <View style={[fp.progressFill, { width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }]} />
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={progress || 0}
            onChange={e => seekTo?.(parseFloat(e.target.value))}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', opacity: 0, cursor: 'pointer', margin: 0 }}
          />
        </View>
        <Text style={fp.timeText}>{fmt(duration)}</Text>
      </View>

      {/* Controls */}
      <View style={fp.controls}>
        <TouchableOpacity onPress={toggleShuffle} style={fp.sideBtn}>
          <ion-icon name={shuffleMode ? 'shuffle' : 'shuffle-outline'} style={{ fontSize: 22, color: shuffleMode ? '#C084FC' : 'rgba(255,255,255,0.32)', pointerEvents: 'none' }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={prev} style={fp.ctrlBtn}>
          <ion-icon name="play-skip-back" style={{ fontSize: 32, color: '#fff', pointerEvents: 'none' }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => isPlaying ? pause?.() : play?.()} style={fp.playBtn}>
          <ion-icon name={isPlaying ? 'pause' : 'play'} style={{ fontSize: 34, color: '#fff', pointerEvents: 'none', marginLeft: isPlaying ? 0 : 3 }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={skip} style={fp.ctrlBtn}>
          <ion-icon name="play-skip-forward" style={{ fontSize: 32, color: '#fff', pointerEvents: 'none' }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleRepeat} style={fp.sideBtn}>
          <ion-icon name={repeatMode === 'one' ? 'repeat' : 'repeat-outline'} style={{ fontSize: 22, color: repeatMode !== 'off' ? '#C084FC' : 'rgba(255,255,255,0.32)', pointerEvents: 'none' }} />
        </TouchableOpacity>
      </View>

      {/* Playlist picker modal */}
      <PlaylistPickerModal
        visible={showPlModal}
        track={currentTrack}
        onClose={() => setShowPlModal(false)}
      />
    </View>
  );
}

const fp = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#08060F', alignItems: 'center', paddingTop: 56, paddingHorizontal: 28, paddingBottom: 32 },
  backBtn:      { position: 'absolute', top: 16, left: 16, padding: 10, zIndex: 10 },
  queueInfo:    { fontSize: 10, color: 'rgba(255,255,255,0.28)', marginBottom: 6, fontWeight: '500', letterSpacing: 2.0, textTransform: 'uppercase' },
  cover:        { width: 272, height: 272, borderRadius: 28, marginBottom: 28, marginTop: 4, boxShadow: '0 28px 80px rgba(192,132,252,0.38), 0 0 100px rgba(251,146,60,0.12)' },
  titleRow:     { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 24, gap: 8 },
  trackTitle:   { fontSize: 22, fontWeight: '700', color: '#F8F8F8', marginBottom: 4, letterSpacing: -0.6, fontFamily: "'Inter', system-ui, sans-serif" },
  artist:       { fontSize: 14, color: 'rgba(248,248,248,0.45)', fontWeight: '300', letterSpacing: 0.2, fontFamily: "'Inter', system-ui, sans-serif" },
  actionBtns:   { flexDirection: 'row', gap: 2 },
  actionBtn:    { padding: 8 },
  progressRow:  { flexDirection: 'row', alignItems: 'center', width: '100%', gap: 10, marginBottom: 36 },
  progressTrack:{ flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, position: 'relative', overflow: 'visible' },
  progressFill: { height: 3, backgroundColor: '#C084FC', borderRadius: 2 },
  timeText:     { fontSize: 11, color: 'rgba(248,248,248,0.32)', fontWeight: '400', width: 36, textAlign: 'center', fontFamily: "'DM Mono', 'Courier New', monospace" },
  controls:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' },
  sideBtn:      { padding: 12, flex: 1, alignItems: 'center' },
  ctrlBtn:      { padding: 12 },
  playBtn:      { width: 68, height: 68, borderRadius: 34, backgroundColor: '#FB923C', alignItems: 'center', justifyContent: 'center', marginHorizontal: 8, boxShadow: '0 0 40px rgba(251,146,60,0.65)' },
});

/* ─── Phone sizing ─────────────────────────────────────────── */
const PHONE_H    = 844;
const PHONE_W    = 390;
const TOOLBAR_H  = 52;
const FRAME_EXTRA = 58; // notch (15px visible) + home bar (15px) + margins

function usePhoneScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    function compute() {
      const winH = window.innerHeight;
      const winW = window.innerWidth;
      const maxH = winH - TOOLBAR_H - 24;
      const maxW = winW - 24;
      const byH  = maxH / (PHONE_H + FRAME_EXTRA);
      const byW  = maxW / PHONE_W;
      setScale(Math.min(1, byH, byW));
    }
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);
  return scale;
}

/* ─── Web Chat — Dribbble-inspired dark design ─────────────── */
const MOCK_CHAT_MSGS = [
  { me:false, text:'Yeni parça çıktı dinledin mi? 🎵',           time:'14:20' },
  { me:true,  text:'Evet az önce dinledim, çok iyi olmuş!',       time:'14:21' },
  { me:false, text:'Hangi bölümünü beğendin en çok?',             time:'14:21' },
  { me:true,  text:'Koronun girişi harika, o ambient layerlar 🔥', time:'14:22' },
  { me:false, text:'Teşekkürler ya, mix üzerinde çok çalıştık 😊', time:'14:23' },
  { me:true,  text:'Belli oluyor. Playlist\'ime ekledim bile',     time:'14:24' },
  { me:false, text:'👏',                                           time:'14:24' },
];

function WebChat({ navigation, route }) {
  const p        = route?.params || {};
  const other    = p.otherUser || p.user || {};
  const username = other.username || other.display_name || other.u || 'melodikbeat';
  const avatar   = other.avatar_url || other.avatar || other.img || `https://i.pravatar.cc/100?u=${username}`;

  const [msg,       setMsg]       = useState('');
  const [msgs,      setMsgs]      = useState(MOCK_CHAT_MSGS);
  const [shownTime, setShownTime] = useState(null);
  const [seenIdx,   setSeenIdx]   = useState(null); // index of last "görüldü" message
  const scrollRef  = useRef(null);
  const inputRef   = useRef(null);
  const lastTap    = useRef({ idx: null, time: 0 });

  useEffect(() => {
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      if (inputRef.current) { inputRef.current.focus(); }
    }, 150);
  }, []);

  const scrollBottom = () =>
    setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 60);

  const handleBubbleTap = (i) => {
    const now = Date.now();
    if (lastTap.current.idx === i && now - lastTap.current.time < 350) {
      setShownTime(prev => prev === i ? null : i);
      lastTap.current = { idx: null, time: 0 };
    } else {
      lastTap.current = { idx: i, time: now };
    }
  };

  const AUTO_REPLIES = [
    'Anladım 👍', 'Harika!', 'Tamam, bakacağım.', 'Süper olmuş 🔥', 'Teşekkürler!',
  ];
  const replyIdx = useRef(0);

  const send = () => {
    if (!msg.trim()) return;
    const now = new Date();
    const t = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
    let sentIdx;
    setMsgs(prev => {
      sentIdx = prev.length;
      return [...prev, { me: true, text: msg.trim(), time: t }];
    });
    setMsg('');
    scrollBottom();

    /* Karşı taraf mesajı açtı → görüldü göster (kalıcı) */
    setTimeout(() => {
      setSeenIdx(sentIdx);
    }, 2000);

    /* Karşı taraf cevap verdi → görüldü kalır, cevap mesajı eklenir */
    setTimeout(() => {
      const rNow = new Date();
      const rt = `${rNow.getHours()}:${String(rNow.getMinutes()).padStart(2,'0')}`;
      const reply = AUTO_REPLIES[replyIdx.current % AUTO_REPLIES.length];
      replyIdx.current += 1;
      setMsgs(prev => [...prev, { me: false, text: reply, time: rt }]);
      scrollBottom();
    }, 4000);
  };

  /* row = explicit flexDirection:row to override global "div { flex-direction: column }" */
  const row = { display:'flex', flexDirection:'row' };

  return (
    <div style={{ display:'flex', flexDirection:'column', background:'#0C0916', height:'100%', position:'relative' }}
         onTouchStart={() => inputRef.current?.focus()}>

      {/* ── Header ── */}
      <div style={{ ...row, alignItems:'center', gap:10,
                    paddingTop:50, paddingBottom:12, paddingLeft:14, paddingRight:14,
                    background:'linear-gradient(180deg,#130D22 0%,#0C0916 100%)',
                    borderBottom:'1px solid rgba(255,255,255,0.06)', flexShrink:0 }}>
        <button onClick={() => navigation.goBack()}
                style={{ width:36, height:36, borderRadius:18, background:'rgba(255,255,255,0.07)',
                         border:'1px solid rgba(255,255,255,0.08)', ...row, alignItems:'center',
                         justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
          <ion-icon name="chevron-back" style={{ fontSize:18, color:'rgba(248,250,255,0.7)', pointerEvents:'none' }} />
        </button>
        <div style={{ position:'relative', flexShrink:0, cursor:'pointer' }}
             onClick={() => navigation.navigate('UserProfile', { username })}>
          <img src={avatar} alt=""
               style={{ width:38, height:38, borderRadius:19, objectFit:'cover',
                        border:'2px solid rgba(147,51,234,0.5)', display:'block' }} />
          <div style={{ position:'absolute', bottom:0, right:0, width:10, height:10, borderRadius:5,
                        background:'#34D399', border:'2px solid #0C0916' }} />
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', cursor:'pointer' }}
             onClick={() => navigation.navigate('UserProfile', { username })}>
          <span style={{ color:'#F8FAFF', fontSize:15, fontWeight:700, letterSpacing:-0.2 }}>{username}</span>
          <span style={{ color:'#34D399', fontSize:11, fontWeight:500, marginTop:1 }}>aktif şimdi</span>
        </div>
      </div>

      {/* ── Date separator ── */}
      <div style={{ ...row, alignItems:'center', gap:8, margin:'10px 14px 4px' }}>
        <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.06)' }} />
        <span style={{ color:'rgba(255,255,255,0.3)', fontSize:11, fontWeight:500 }}>Bugün</span>
        <div style={{ flex:1, height:1, background:'rgba(255,255,255,0.06)' }} />
      </div>

      {/* ── Messages ── */}
      <div ref={scrollRef}
           style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column',
                    gap:4, padding:'8px 14px 8px 14px' }}>
        {msgs.map((m, i) => {
          const showOtherAv = !m.me && (i === msgs.length-1 || msgs[i+1]?.me !== false);
          const showMyAv    = m.me  && (i === msgs.length-1 || msgs[i+1]?.me !== true);
          const isSeen      = m.me && seenIdx === i;
          return m.me ? (
            /* ── Sent bubble (right) ── */
            <div key={i} style={{ position:'relative', ...row, justifyContent:'flex-end',
                                  alignItems:'flex-end', gap:6,
                                  marginBottom: isSeen ? 18 : 2 }}
                 onClick={() => handleBubbleTap(i)}>
              <div style={{ display:'block', maxWidth:'72%', padding:'9px 13px',
                            borderRadius:'18px 18px 4px 18px',
                            background:'linear-gradient(135deg,#6D28D9,#9333EA)',
                            boxShadow:'0 2px 10px rgba(109,40,217,0.30)', cursor:'pointer' }}>
                <span style={{ color:'#fff', fontSize:14, lineHeight:'21px',
                               wordBreak:'break-word' }}>{m.text}</span>
                {shownTime === i && (
                  <span style={{ color:'rgba(255,255,255,0.4)', fontSize:10, marginTop:4,
                                 display:'block', textAlign:'right' }}>{m.time}</span>
                )}
              </div>
              {showMyAv
                ? <img src="https://i.pravatar.cc/100?u=myuser" alt=""
                       onClick={e => { e.stopPropagation(); navigation.navigate('Profile'); }}
                       style={{ width:26, height:26, borderRadius:13, objectFit:'cover',
                                flexShrink:0, display:'block', cursor:'pointer' }} />
                : <div style={{ width:26, flexShrink:0 }} />}
              {isSeen && (
                <span style={{ position:'absolute', bottom:-16, right:32,
                               color:'rgba(200,180,255,0.8)', fontSize:10 }}>görüldü</span>
              )}
            </div>
          ) : (
            /* ── Received bubble (left) ── */
            <div key={i} style={{ ...row, justifyContent:'flex-start', alignItems:'flex-end',
                                  gap:6, marginBottom:2 }}
                 onClick={() => handleBubbleTap(i)}>
              {showOtherAv
                ? <img src={avatar} alt=""
                       onClick={e => { e.stopPropagation(); navigation.navigate('UserProfile', { username }); }}
                       style={{ width:26, height:26, borderRadius:13, objectFit:'cover',
                                flexShrink:0, display:'block', cursor:'pointer' }} />
                : <div style={{ width:26, flexShrink:0 }} />}
              <div style={{ display:'block', maxWidth:'68%', padding:'9px 13px',
                            borderRadius:'18px 18px 18px 4px',
                            background:'#1C1530', border:'1px solid rgba(255,255,255,0.08)',
                            cursor:'pointer' }}>
                <span style={{ color:'#F8FAFF', fontSize:14, lineHeight:'21px',
                               wordBreak:'break-word' }}>{m.text}</span>
                {shownTime === i && (
                  <span style={{ color:'rgba(255,255,255,0.4)', fontSize:10, marginTop:4,
                                 display:'block', textAlign:'left' }}>{m.time}</span>
                )}
              </div>
            </div>
          );
        })}
        <div style={{ height:4 }} />
      </div>

      {/* ── Input bar (original style) ── */}
      <div style={{ ...row, alignItems:'center', gap:8,
                    padding:'10px 14px 14px 14px', flexShrink:0,
                    background:'#08060F', borderTop:'1px solid rgba(255,255,255,0.09)' }}>
        <div style={{ flex:1, ...row, alignItems:'center',
                      background:'rgba(255,255,255,0.07)', borderRadius:24,
                      border:'0.5px solid rgba(255,255,255,0.14)',
                      paddingLeft:16, paddingRight:16 }}>
          <input
            ref={inputRef}
            value={msg}
            onChange={e => setMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Mesaj yaz..."
            autoFocus
            inputMode="text"
            style={{ flex:1, color:'#F8FAFF', fontSize:16, paddingTop:12, paddingBottom:12,
                     background:'none', border:'none', outline:'none',
                     fontFamily:'Inter,system-ui,sans-serif', width:'100%' }}
          />
        </div>
        <button onClick={send}
                style={{ width:42, height:42, borderRadius:21, flexShrink:0, ...row,
                         alignItems:'center', justifyContent:'center',
                         background:'linear-gradient(135deg,#4C1D95,#9333EA)',
                         border:'none', cursor:'pointer' }}>
          <ion-icon name="send" style={{ fontSize:15, color:'#fff', marginLeft:2, pointerEvents:'none' }} />
        </button>
      </div>
    </div>
  );
}

/* ─── Mini Player (inside phone, above tab bar) ───────────── */
function MiniPlayer({ onOpen }) {
  const { currentTrack, isPlaying, play, pause, skip, prev } = usePlayer() || {};
  const slideAnim = useRef(new Animated.Value(80)).current;

  const [liked, setLiked] = useState(() => isLiked(currentTrack?.id));
  const [showPlModal, setShowPlModal] = useState(false);

  useEffect(() => {
    setLiked(isLiked(currentTrack?.id));
    return likedSubscribe(() => setLiked(isLiked(currentTrack?.id)));
  }, [currentTrack?.id]);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: currentTrack ? 0 : 80,
      useNativeDriver: true,
      damping: 18,
      stiffness: 200,
    }).start();
  }, [!!currentTrack]);

  if (!currentTrack) return null;

  return (
    <Animated.View style={[mp.wrap, { transform: [{ translateY: slideAnim }] }]}>
      <View style={mp.bar}>
        <Pressable style={mp.infoArea} onPress={onOpen}>
          <Image
            source={{ uri: currentTrack.cover_url || currentTrack.cover || currentTrack.thumbnail || 'https://picsum.photos/seed/mp/80/80' }}
            style={mp.cover}
          />
          <View style={mp.info}>
            <Text style={mp.title} numberOfLines={1}>{currentTrack.title || currentTrack.name}</Text>
            <Text style={mp.artist} numberOfLines={1}>{currentTrack.artist || currentTrack.artist_name}</Text>
          </View>
        </Pressable>
        <TouchableOpacity onPress={() => isPlaying ? pause?.() : play?.()} style={mp.playBtn}>
          <ion-icon name={isPlaying ? 'pause' : 'play'} style={{ fontSize: 24, color: '#FB923C', pointerEvents: 'none', marginLeft: isPlaying ? 0 : 2 }} />
        </TouchableOpacity>
      </View>
      <PlaylistPickerModal
        visible={showPlModal}
        track={currentTrack}
        onClose={() => setShowPlModal(false)}
      />
    </Animated.View>
  );
}

const mp = StyleSheet.create({
  wrap:     { position: 'absolute', bottom: 62, left: 12, right: 12, zIndex: 99 },
  bar:      { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(12,8,24,0.98)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, gap: 10, borderWidth: 1, borderColor: 'rgba(192,132,252,0.18)' },
  infoArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden' },
  cover:    { width: 40, height: 40, borderRadius: 10, flexShrink: 0 },
  info:     { flex: 1, overflow: 'hidden' },
  title:    { fontSize: 13, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.2, fontFamily: "'Inter', system-ui, sans-serif" },
  artist:   { fontSize: 11, color: 'rgba(248,248,248,0.38)', marginTop: 1, fontWeight: '400', fontFamily: "'Inter', system-ui, sans-serif" },
  btn:      { padding: 4 },
  playBtn:  { padding: 6, alignItems: 'center', justifyContent: 'center' },
});

/* ─── Mock Tab Bar (inside phone) ─────────────────────────── */
function MockTabBar({ current, onChange }) {
  return (
    <View style={tb.bar}>
      {TAB_SCREENS.map(tab => {
        const active = current === tab.name;
        return (
          <Pressable key={tab.name} style={tb.item} onPress={() => onChange(tab.name)}>
            <ion-icon
              name={active ? tab.icon : tab.iconOff}
              style={{ fontSize: 24, color: active ? '#C084FC' : 'rgba(255,255,255,0.30)', pointerEvents: 'none' }}
            />
            {active && <View style={tb.underline} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const tb = StyleSheet.create({
  bar: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    height:          60,
    flexDirection:   'row',
    backgroundColor: 'rgba(8,6,15,0.98)',
    borderTopWidth:  1,
    borderTopColor:  'rgba(192,132,252,0.10)',
    paddingBottom:   8,
    paddingTop:      10,
    zIndex:          100,
  },
  item: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            4,
  },
  underline: {
    width:           20,
    height:          3,
    borderRadius:    2,
    backgroundColor: '#C084FC',
  },
});

/* ─── Phone Frame ──────────────────────────────────────────── */
function PhoneFrame({ children, showTabBar, currentTab, onTabChange, onOpenFullPlayer }) {
  const scale   = usePhoneScale();
  const scaledW = PHONE_W * scale;
  const scaledH = (PHONE_H + FRAME_EXTRA) * scale;
  return (
    /* Outer: exact visual size so layout doesn't overflow */
    <div style={{ width: scaledW, height: scaledH, flexShrink: 0 }}>
      {/* Inner: full-size content scaled from top-left corner */}
      <div style={{ transformOrigin: '0 0', transform: `scale(${scale})`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    width: PHONE_W }}>
        <View style={styles.frameNotch} />
        <View style={styles.phone}>
          {children}
          <MiniPlayer onOpen={onOpenFullPlayer} />
          {showTabBar && (
            <MockTabBar current={currentTab} onChange={onTabChange} />
          )}
        </View>
        <View style={styles.frameHome} />
      </div>
    </div>
  );
}

/* ─── Dev toolbar (outside phone) ─────────────────────────── */
function DevToolbar({ current, onChange }) {
  return (
    <View style={styles.toolbar}>
      <Text style={styles.toolbarLabel}>PREVIEW</Text>
      <View style={styles.toolbarBtns}>
        {ALL_SCREENS.map(s => (
          <TouchableOpacity
            key={s}
            onPress={() => onChange(s)}
            style={[styles.tbBtn, current === s && styles.tbBtnActive]}
          >
            <Text style={[styles.tbTxt, current === s && styles.tbTxtActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/* Screens that render as transparent modal overlay (background screen stays visible) */
const MODAL_SCREENS = new Set(['Notifications']);

/* ─── App Root ─────────────────────────────────────────────── */
function App() {
  const [stack, setStack] = useState([{ name: 'Login', params: {} }]);
  const screen = stack[stack.length - 1] || { name: 'Dashboard', params: {} };
  const nav    = makeMockNav(stack, setStack);

  const isModal   = MODAL_SCREENS.has(screen.name);
  const bgScreen  = isModal
    ? (stack.length > 1 ? stack[stack.length - 2] : { name: 'Dashboard', params: {} })
    : null;
  const LIBRARY_STACK = new Set(['PlaylistDetail', 'Liked', 'ListeningHistory', 'AddSongsToPlaylist']);
  const effectiveName = isModal && bgScreen ? bgScreen.name : screen.name;
  const showTabBar = TAB_NAMES.has(effectiveName) || LIBRARY_STACK.has(effectiveName);

  const renderScreen = (s) => {
    const r     = s || screen;
    const route = { key: r.name, name: r.name, params: r.params || {} };
    const props = { navigation: nav, route };
    switch (r.name) {
      // Auth
      case 'Login':                  return <LoginScreen {...props} />;
      case 'Register':               return <RegisterScreen {...props} />;
      case 'ForgotPassword':         return <ForgotPasswordScreen {...props} />;
      case 'ResetPassword':          return <ResetPasswordScreen {...props} />;

      // Main tabs
      case 'Dashboard':              return <DashboardScreen {...props} />;
      case 'Library':                return <PlaylistsScreen {...props} />;
      case 'AR':                     return <ARMusicScreen {...props} />;
      case 'Rooms':                  return <ListeningRoomScreen {...props} />;

      // Social
      case 'Profile':                return <ProfileScreen {...props} />;
      case 'UserProfile':            return <UserProfileScreen {...props} />;
      case 'FollowersList':          return <FollowersListScreen {...props} />;
      case 'FollowingList':          return <FollowingListScreen {...props} />;
      case 'DiscoverPeople':         return <DiscoverPeopleScreen {...props} />;

      // Posts

      // Stories
      case 'Stories':                return <StoriesScreen {...props} />;
      case 'StoryViewer':            return <StoryViewerScreen {...props} />;
      case 'StoryCreate':            return <StoryCreateScreen {...props} />;
      case 'StoryArchive':           return <StoryArchiveScreen {...props} />;

      // Playlists
      case 'PlaylistDetail':         return <PlaylistDetailScreen {...props} />;
      case 'AddSongsToPlaylist':     return <AddSongsToPlaylistScreen {...props} />;

      // Full Player
      case 'FullPlayer':             return <FullPlayerScreen {...props} />;

      // Music
      case 'SongRadio':              return <SongRadioScreen {...props} />;
      case 'Equalizer':              return <EqualizerScreen {...props} />;
      case 'Lyrics':                 return <LyricsScreen {...props} />;
      case 'ListeningHistory':       return <ListeningHistoryScreen {...props} />;
      case 'MusicDiscover':          return <MusicDiscoverScreen {...props} />;
      case 'Audiomack':              return <AudiomackScreen {...props} />;

      // Messages
      case 'Messages':               return <ConversationsScreen {...props} />;
      case 'Conversations':          return <ConversationsScreen {...props} />;
      case 'Chat':                   return <WebChat {...props} />;
      case 'CreateGroup':            return <CreateGroupScreen {...props} />;
      case 'GroupSettings':          return <GroupSettingsScreen {...props} />;

      // Settings & Profile management
      case 'Settings':               return <SettingsScreen {...props} />;
      case 'ProfileEdit':            return <ProfileEditScreen {...props} />;
      case 'ProfileStats':           return <ProfileStatsScreen {...props} />;
      case 'ProfileQR':              return <ProfileQRScreen {...props} />;
      case 'ChangePassword':         return <ChangePasswordScreen {...props} />;
      case 'ChangeEmail':            return <ChangeEmailScreen {...props} />;
      case 'DeleteAccount':          return <DeleteAccountScreen {...props} />;
      case 'Sessions':               return <SessionsScreen {...props} />;
      case 'TwoFASettings':          return <TwoFASettingsScreen {...props} />;
      case 'BlockedUsers':           return <BlockedUsersScreen {...props} />;
      case 'MutedUsers':             return <MutedUsersScreen {...props} />;
      case 'ScreenTime':             return <ScreenTimeScreen {...props} />;
      case 'DataExport':             return <DataExportScreen {...props} />;
      case 'NotificationSettings':   return <NotificationSettingsScreen {...props} />;
      case 'MusicTasteTest':         return <MusicTasteTestScreen {...props} />;
      case 'Achievements':           return <AchievementsScreen {...props} />;
      case 'Backup':                 return <BackupScreen {...props} />;
      case 'Feedback':               return <FeedbackScreen {...props} />;
      case 'Licenses':               return <LicensesScreen {...props} />;
      case 'AccountSettings':        return <AccountSettingsScreen {...props} />;
      case 'NotifSettings':          return <NotifSettingsScreen {...props} />;
      case 'AudioSettings':          return <AudioSettingsScreen {...props} />;
      case 'LanguageRegion':         return <LanguageRegionScreen {...props} />;
      case 'DataBackup':             return <DataBackupScreen {...props} />;
      case 'AccessibilitySettings':  return <AccessibilitySettingsScreen {...props} />;
      case 'LegalSettings':          return <LegalSettingsScreen {...props} />;

      // Misc
      case 'Notifications':          return <NotificationsScreen {...props} />;
      case 'Search':                 return <SearchScreen {...props} />;
      case 'Liked':                  return <LikedScreen {...props} />;
      case 'Saved':                  return <SavedScreen {...props} />;

      // Fallback
      default:                       return <DashboardScreen {...props} />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <PlayerProvider>
              <View style={styles.root}>
                <PhoneFrame
                  showTabBar={showTabBar}
                  currentTab={(isModal && bgScreen ? bgScreen : screen).name}
                  onTabChange={(name) => setStack([{ name, params: {} }])}
                  onOpenFullPlayer={() => setStack(s => [...s, { name: 'FullPlayer', params: {} }])}
                >
                  {/* Background screen (always visible) */}
                  {renderScreen(isModal && bgScreen ? bgScreen : null)}
                  {/* Modal overlay — dark scrim + blur(4px) via DOM ref (bypasses RNW style stripping) */}
                  {isModal && (
                    <View
                      ref={el => {
                        if (el && el.style) {
                          el.style.backdropFilter = 'blur(4px)';
                          el.style.webkitBackdropFilter = 'blur(4px)';
                          el.style.background = 'rgba(0,0,0,0.65)';
                        }
                      }}
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
                    >
                      {renderScreen(screen)}
                    </View>
                  )}
                </PhoneFrame>
                <DevToolbar
                  current={screen.name}
                  onChange={(name) => {
                    if (MODAL_SCREENS.has(name)) {
                      setStack([{ name: 'Dashboard', params: {} }, { name, params: {} }]);
                    } else {
                      setStack([{ name, params: {} }]);
                    }
                  }}
                />
              </View>
            </PlayerProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </I18nextProvider>
    </QueryClientProvider>
  );
}

/* ─── Styles ───────────────────────────────────────────────── */
const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: '#08060F',
    alignItems:      'center',
    justifyContent:  'center',
    height:          '100vh',
    paddingBottom:   TOOLBAR_H,
  },
  frameOuter: {
    alignItems: 'center',
  },
  frameNotch: {
    width:           120,
    height:          30,
    backgroundColor: '#1A1228',
    borderRadius:    20,
    marginBottom:    -15,
    zIndex:          10,
    borderWidth:     2,
    borderColor:     '#1A1228',
  },
  phone: {
    width:           390,
    height:          844,
    backgroundColor: '#08060F',
    borderRadius:    50,
    overflow:        'hidden',
    borderWidth:     8,
    borderColor:     '#1A1228',
    boxShadow:       '0 40px 100px rgba(0,0,0,0.90), 0 0 0 1px rgba(192,132,252,0.12), inset 0 1px 0 rgba(255,255,255,0.04)',
    position:        'relative',
  },
  frameHome: {
    width:           130,
    height:          5,
    backgroundColor: '#1A1228',
    borderRadius:    3,
    marginTop:       10,
  },
  toolbar: {
    position:        'fixed',
    bottom:          0,
    left:            0,
    right:           0,
    height:          TOOLBAR_H,
    backgroundColor: 'rgba(8,6,15,0.98)',
    borderTopWidth:  1,
    borderTopColor:  'rgba(192,132,252,0.10)',
    paddingVertical: 8,
    paddingHorizontal: 20,
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    backdropFilter:  'blur(20px)',
  },
  toolbarLabel: {
    color:         'rgba(255,255,255,0.25)',
    fontSize:      9,
    fontWeight:    '800',
    letterSpacing: 2,
  },
  toolbarBtns: {
    flexDirection: 'row',
    gap:           6,
    flexWrap:      'wrap',
  },
  tbBtn: {
    paddingVertical:   5,
    paddingHorizontal: 12,
    borderRadius:      8,
    backgroundColor:   'rgba(255,255,255,0.06)',
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.06)',
  },
  tbBtnActive: {
    backgroundColor: 'rgba(192,132,252,0.20)',
    borderColor:     '#C084FC',
  },
  tbTxt: {
    color:      'rgba(255,255,255,0.4)',
    fontSize:   11,
    fontWeight: '600',
  },
  tbTxtActive: {
    color: '#C084FC',
  },
});

/* ─── Mount ────────────────────────────────────────────────── */
createRoot(document.getElementById('root')).render(<App />);
