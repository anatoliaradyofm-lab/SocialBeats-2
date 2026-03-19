import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Image, Dimensions, Platform, Animated,
  TextInput, Modal, Pressable, Switch, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W, height: H } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════════
   AURORA DESIGN SYSTEM — Ultimate High-Fidelity Twin
   ═══════════════════════════════════════════════════════════════ */
const COLORS = {
  background:  '#08080F',
  surface:     'rgba(255,255,255,0.06)',
  card:        'rgba(255,255,255,0.06)',
  border:      'rgba(255,255,255,0.12)',
  borderLight: 'rgba(255,255,255,0.06)',
  text:        '#F8FAFF',
  textSecondary: 'rgba(248,250,255,0.65)',
  textMuted:   'rgba(248,250,255,0.40)',
  textGhost:   'rgba(248,250,255,0.15)',
  primary:     '#A78BFA',
  primaryDeep: '#7C3AED',
  primaryGlow: 'rgba(124, 58, 237, 0.15)',
  accent:      '#F472B6',
  accentGlow:  'rgba(244, 114, 182, 0.15)',
  highlight:   '#38BDF8',
  highlightGlow: 'rgba(56, 189, 248, 0.15)',
  success:     '#34D399',
  successBg:   'rgba(52, 211, 153, 0.15)',
  warning:     '#FBBF24',
  warningBg:   'rgba(251, 191, 36, 0.15)',
  error:       '#F87171',
  errorBg:     'rgba(248, 113, 113, 0.15)',
  badge:       '#F472B6',
  overlay:     'rgba(0,0,0,0.8)',
};

/* ─── Shared Atomic Components ──────────────────────────────────── */

const GlassCard = ({ children, style, onPress }) => (
  <TouchableOpacity activeOpacity={onPress ? 0.8 : 1} onPress={onPress}>
    <View style={[{
      backgroundColor: COLORS.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: COLORS.border,
      overflow: 'hidden',
    }, style]}>
      {children}
    </View>
  </TouchableOpacity>
);

const SectionHeader = ({ title, onSeeAll }) => (
  <View style={s.shRow}>
    <Text style={s.shTitle}>{title}</Text>
    {onSeeAll && (
      <TouchableOpacity onPress={onSeeAll}>
        <Text style={s.shAll}>See all</Text>
      </TouchableOpacity>
    )}
  </View>
);

const SettingRow = ({ icon, label, sub, rightEl, onPress, isDestructive, iconBg, iconColor }) => {
  const ic = isDestructive ? COLORS.error : (iconColor || COLORS.primary);
  const bg = isDestructive ? COLORS.errorBg : (iconBg || COLORS.primaryGlow);
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.rowIconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={19} color={ic} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, isDestructive && { color: COLORS.error }]}>{label}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      {rightEl || <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />}
    </TouchableOpacity>
  );
};

/* ─── DATA MIRROR (Source: Actual DashboardScreen.js) ─────── */

const GENRES = [
  { id: 'pop',    name: 'Pop',    emoji: '✨', colors: ['#9333EA', '#F472B6'] },
  { id: 'hiphop', name: 'Hip-Hop',emoji: '🔥', colors: ['#EA580C', '#F472B6'] },
  { id: 'edm',    name: 'EDM',    emoji: '⚡', colors: ['#0EA5E9', '#A78BFA'] },
  { id: 'lofi',   name: 'Lo-fi',  emoji: '🌙', colors: ['#1E40AF', '#7C3AED'] },
];

const FEATURED = [
  { id: 'f0', title: 'Midnight Pulse', artist: 'Aurora X', cover: 'https://picsum.photos/seed/feat0/400/400', label: 'NEW RELEASE', colors: ['#3B0764','#7C3AED'] },
  { id: 'f1', title: 'Neon Dreams', artist: 'The Midnight', cover: 'https://picsum.photos/seed/feat1/400/400', label: 'TRENDING', colors: ['#0C4A6E','#0EA5E9'] },
];

const STORIES = [
  { user_id: 'ps-1', username: 'melodikbeat', user_avatar: 'https://i.pravatar.cc/100?u=melodikbeat', has_unviewed: true },
  { user_id: 'ps-2', username: 'djvibe',       user_avatar: 'https://i.pravatar.cc/100?u=djvibe',       has_unviewed: true },
  { user_id: 'ps-3', username: 'synthwave_',   user_avatar: 'https://i.pravatar.cc/100?u=synthwave_',   has_unviewed: true },
  { user_id: 'ps-4', username: 'lofi_girl',    user_avatar: 'https://i.pravatar.cc/100?u=lofi_girl',    has_unviewed: false },
];

const TRACKS = [
  {id:'t0',title:'Shape of You',artist:'Ed Sheeran',cover:'https://picsum.photos/seed/pop0/80/80',dur:'3:53'},
  {id:'t1',title:'Midnight City',artist:'M83',cover:'https://picsum.photos/seed/pop1/80/80',dur:'4:03'},
  {id:'t2',title:'Blinding Lights',artist:'The Weeknd',cover:'https://picsum.photos/seed/pop2/80/80',dur:'3:20'},
];

/* ─── Main App ───────────────────────────────────────────── */

export default function MobilePreview() {
  const [tab, setTab] = useState('home');
  const [subScreen, setSubScreen] = useState(null); // settings | chat | notifications | playlist | genre | story
  const [subData, setSubData] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(TRACKS[0]);

  const renderContent = () => {
    if (subScreen === 'settings') return <SettingsView onBack={() => setSubScreen(null)} />;
    if (subScreen === 'notifications') return <NotificationsView onBack={() => setSubScreen(null)} />;
    if (subScreen === 'chat') return <ChatView user={subData || "melodikbeat"} onBack={() => setSubScreen(null)} />;
    if (subScreen === 'playlist') return <PlaylistView pl={subData} onBack={() => setSubScreen(null)} onPlay={setCurrentTrack} />;
    if (subScreen === 'genre') return <GenreView g={subData} onBack={() => setSubScreen(null)} onPlay={setCurrentTrack} />;
    if (subScreen === 'story') return <StoryViewer users={STORIES} onBack={() => setSubScreen(null)} />;

    switch(tab) {
      case 'home': return <DashboardView onNotify={() => setSubScreen('notifications')} onChat={(u) => { setSubData(u); setSubScreen('chat'); }} onGenre={g => { setSubData(g); setSubScreen('genre'); }} onStory={() => setSubScreen('story')} />;
      case 'profile': return <ProfileView onSettings={() => setSubScreen('settings')} />;
      case 'search': return <PlaceholderView title="Search" icon="search" />;
      case 'library': return <PlaceholderView title="Library" icon="library" />;
      default: return null;
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1 }}>{renderContent()}</View>

      {!['story', 'chat'].includes(subScreen) && (
        <>
          <MiniPlayer track={currentTrack} onExpand={() => setShowFullPlayer(true)} isPlaying={isPlaying} onPlay={() => setIsPlaying(!isPlaying)} />
          <View style={s.tabBar}>
            {['home', 'search', 'library', 'person'].map((icon, i) => {
              const keys = ['home', 'search', 'library', 'profile'];
              const active = tab === keys[i] && !subScreen;
              return (
                <TouchableOpacity key={icon} onPress={() => { setTab(keys[i]); setSubScreen(null); }} style={s.tabItem}>
                  <Ionicons name={active ? icon : `${icon}-outline`} size={24} color={active ? COLORS.primary : COLORS.textMuted} />
                  {active && <View style={s.tabIndicator} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* Full Player Modal */}
      <Modal visible={showFullPlayer} animationType="slide">
        <FullPlayer track={currentTrack} onBack={() => setShowFullPlayer(false)} isPlaying={isPlaying} onPlay={() => setIsPlaying(!isPlaying)} />
      </Modal>
    </View>
  );
}

/* ─── Screen Mirroring Views ────────────────────────────── */

const DashboardView = ({ onNotify, onChat, onGenre, onStory }) => (
  <ScrollView style={s.view} contentContainerStyle={{ paddingBottom: 200 }} showsVerticalScrollIndicator={false}>
    <View style={[s.viewAmbient, { backgroundColor: COLORS.primaryGlow }]} />
    <View style={s.viewHeader}>
      <View>
        <Text style={s.greeting}>Good evening 🌙</Text>
        <Text style={s.userName}>Anatolia</Text>
      </View>
      <View style={s.headerIcons}>
        <TouchableOpacity style={s.iconBtn} onPress={() => onChat('melodikbeat')}><Ionicons name="chatbubble-outline" size={20} color={COLORS.textSecondary} /></TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} onPress={onNotify}>
          <Ionicons name="notifications-outline" size={20} color={COLORS.textSecondary} />
          <View style={s.badge}><Text style={s.badgeText}>3</Text></View>
        </TouchableOpacity>
        <Image source={{ uri: 'https://i.pravatar.cc/100?u=anatolia' }} style={s.headerAvatar} />
      </View>
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
      <View style={s.storyWrap}>
        <View style={s.storyAdd}><Image source={{ uri: 'https://i.pravatar.cc/100?u=anatolia' }} style={s.storyImg} /><View style={s.addDot}><Ionicons name="add" size={10} color="#fff" /></View></View>
        <Text style={s.storyName}>Your story</Text>
      </View>
      {STORIES.map(st => (
        <TouchableOpacity key={st.user_id} style={s.storyWrap} onPress={onStory}>
          <LinearGradient colors={st.has_unviewed ? [COLORS.primary, COLORS.accent] : [COLORS.border, COLORS.border]} style={s.storyRing}>
            <View style={s.storyInner}><Image source={{ uri: st.user_avatar }} style={s.storyImg} /></View>
          </LinearGradient>
          <Text style={s.storyName}>{st.username}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>

    <View style={{ height: 32 }} />
    <SectionHeader title="Featured" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 15 }}>
      {FEATURED.map(f => (
        <GlassCard key={f.id} style={s.featCard}>
          <Image source={{ uri: f.cover }} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['transparent', f.colors[0]]} style={StyleSheet.absoluteFill} />
          <View style={s.featContent}>
            <View style={[s.labelPill, { backgroundColor: COLORS.primary }]}><Text style={s.labelText}>{f.label}</Text></View>
            <Text style={s.featTitle}>{f.title}</Text>
            <Text style={s.featArtist}>{f.artist}</Text>
          </View>
        </GlassCard>
      ))}
    </ScrollView>

    <View style={{ height: 32 }} />
    <SectionHeader title="Discover Genres" />
    <View style={s.genreGrid}>
      {GENRES.map(g => (
        <TouchableOpacity key={g.id} style={s.genreCard} onPress={() => onGenre(g)}>
          <LinearGradient colors={g.colors} style={s.genreGradient}>
            <Text style={s.genreEmoji}>{g.emoji}</Text>
            <Text style={s.genreName}>{g.name}</Text>
          </LinearGradient>
        </TouchableOpacity>
      ))}
    </View>
  </ScrollView>
);

const SettingsView = ({ onBack }) => (
  <View style={s.view}>
    <View style={s.headerBar}>
      <TouchableOpacity onPress={onBack} style={s.backBtnOuter}><Ionicons name="chevron-back" size={24} color={COLORS.text} /></TouchableOpacity>
      <Text style={s.headerTitle}>Settings</Text>
      <View style={{ width: 44 }} />
    </View>
    <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
       <SectionLabel title="Account" />
       <GlassCard style={{ marginHorizontal: 20 }}>
         <SettingRow icon="person-outline" label="Account Details" sub="Change email, password" />
         <SettingRow icon="shield-checkmark-outline" label="Sessions" sub="3 active devices" iconBg={COLORS.successBg} iconColor={COLORS.success} />
         <SettingRow icon="trash-outline" label="Delete Account" isDestructive />
       </GlassCard>

       <SectionLabel title="Appearance" />
       <GlassCard style={{ marginHorizontal: 20 }}>
         <SettingRow icon="moon-outline" label="Theme" sub="AURORA Midnight" />
         <SettingRow icon="language-outline" label="Language" sub="🇹🇷 Turkish" iconBg={COLORS.highlightGlow} iconColor={COLORS.highlight} />
       </GlassCard>
    </ScrollView>
  </View>
);

const ProfileView = ({ onSettings }) => (
  <View style={s.view}>
    <View style={s.headerSimple}>
      <Text style={s.headerUsername}>anatolia <Ionicons name="chevron-down" size={12} /></Text>
      <View style={{ flexDirection: 'row', gap: 15 }}>
        <TouchableOpacity><Ionicons name="add-box-outline" size={26} color={COLORS.text} /></TouchableOpacity>
        <TouchableOpacity onPress={onSettings}><Ionicons name="settings-outline" size={26} color={COLORS.text} /></TouchableOpacity>
      </View>
    </View>
    <ScrollView>
      <View style={s.profileTop}>
        <View style={s.avatarBigWrap}>
          <Image source={{ uri: 'https://i.pravatar.cc/200?u=anatolia' }} style={s.avatarBig} />
          <View style={s.addBadge}><Ionicons name="add" size={14} color="#fff" /></View>
        </View>
        <View style={s.statsRow}>
          <View style={s.stat}><Text style={s.statVal}>2</Text><Text style={s.statLab}>posts</Text></View>
          <View style={s.stat}><Text style={s.statVal}>1.2K</Text><Text style={s.statLab}>followers</Text></View>
          <View style={s.stat}><Text style={s.statVal}>450</Text><Text style={s.statLab}>following</Text></View>
        </View>
      </View>
      <View style={s.bio}>
        <Text style={s.bioName}>Anatolia Radio FM</Text>
        <Text style={s.bioText}>AURORA Design System 2026 Virtual Twin. 🎵✨</Text>
      </View>
      <View style={s.gridRow}>
        {[1,2,3,4,5,6].map(i => <View key={i} style={s.gridSquare}><Image source={{ uri: `https://picsum.photos/seed/p${i}/300/300` }} style={StyleSheet.absoluteFill} /></View>)}
      </View>
    </ScrollView>
  </View>
);

const ChatView = ({ user, onBack }) => (
  <View style={s.container}>
    <View style={[s.viewHeader, { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, paddingTop: 60 }]}>
      <TouchableOpacity onPress={onBack}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></TouchableOpacity>
      <View style={{ flex: 1, marginLeft: 15, flexDirection: 'row', alignItems: 'center' }}>
        <Image source={{ uri: `https://i.pravatar.cc/100?u=${user}` }} style={{ width: 36, height: 36, borderRadius: 18 }} />
        <View style={{ marginLeft: 10 }}>
          <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '800' }}>{user}</Text>
          <Text style={{ color: COLORS.success, fontSize: 11 }}>online</Text>
        </View>
      </View>
      <Ionicons name="call-outline" size={22} color={COLORS.text} />
    </View>
    <ScrollView style={{ flex: 1, padding: 20 }}>
      {[{m:false, t:"Yeni parça yayınlandı! 🎵"}, {m:true, t:"Harika, hemen bakıyorum. 🔥"}].map((c,i) => (
        <View key={i} style={[s.bubble, c.m ? s.bubbleMe : s.bubbleOther]}>
          <Text style={{ color: '#fff', fontSize: 14 }}>{c.t}</Text>
          <Text style={s.bubbleTime}>10:4{i}</Text>
        </View>
      ))}
    </ScrollView>
    <View style={s.chatInputRow}>
      <TextInput style={s.chatInput} placeholder="Message..." placeholderTextColor={COLORS.textMuted} />
      <TouchableOpacity><Ionicons name="send" size={22} color={COLORS.primary} /></TouchableOpacity>
    </View>
  </View>
);

const StoryViewer = ({ users, onBack }) => {
  const [idx, setIdx] = useState(0);
  const [progress] = useState(new Animated.Value(0));

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 4000, useNativeDriver: false }).start(({ finished }) => {
      if (finished) {
        if (idx < users.length - 1) setIdx(idx + 1);
        else onBack();
      }
    });
  }, [idx]);

  return (
    <View style={s.storyViewer}>
      <Image source={{ uri: `https://picsum.photos/seed/story${idx}/800/1600` }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFill} />
      <View style={s.storyProgressRow}>
        {users.map((_, i) => (
          <View key={i} style={s.storyProgressBar}>
            <Animated.View style={[s.storyProgressFill, { width: i < idx ? '100%' : i === idx ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) : '0%' }]} />
          </View>
        ))}
      </View>
      <View style={s.storyHeader}>
        <Image source={{ uri: users[idx].user_avatar }} style={s.storyHeadAvatar} />
        <Text style={s.storyHeadName}>{users[idx].username}</Text>
        <TouchableOpacity onPress={onBack} style={{ marginLeft: 'auto' }}><Ionicons name="close" size={30} color="#fff" /></TouchableOpacity>
      </View>
      <View style={s.storyTapZone}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => idx > 0 && setIdx(idx - 1)} />
        <TouchableOpacity style={{ flex: 1 }} onPress={() => idx < users.length - 1 ? setIdx(idx + 1) : onBack()} />
      </View>
    </View>
  );
};

const GenreView = ({ g, onBack, onPlay }) => (
  <View style={s.container}>
    <LinearGradient colors={g.colors} style={{ height: 180, justifyContent: 'flex-end', padding: 20 }}>
      <TouchableOpacity onPress={onBack} style={s.backBtnAbs}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
      <Text style={{ fontSize: 32 }}>{g.emoji}</Text>
      <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>{g.name}</Text>
    </LinearGradient>
    <ScrollView style={{ flex: 1, padding: 20 }}>
      {TRACKS.map(t => (
        <TouchableOpacity key={t.id} style={s.trackRow} onPress={() => onPlay(t)}>
          <Image source={{ uri: t.cover }} style={{ width: 50, height: 50, borderRadius: 10 }} />
          <View style={{ flex: 1, marginLeft: 15 }}>
            <Text style={{ color: COLORS.text, fontWeight: '700' }}>{t.title}</Text>
            <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>{t.artist}</Text>
          </View>
          <Text style={{ color: COLORS.textMuted }}>{t.dur}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

const NotificationsView = ({ onBack }) => (
  <View style={s.view}>
    <View style={s.headerBar}><TouchableOpacity onPress={onBack}><Ionicons name="chevron-back" size={24} color={COLORS.text} /></TouchableOpacity><Text style={s.headerTitle}>Notifications</Text><View style={{ width: 44 }} /></View>
    <ScrollView style={{ padding: 20 }}>
       {["djvibe", "synthwave_", "lofi_girl"].map(u => (
         <View key={u} style={s.notifRow}>
           <Image source={{ uri: `https://i.pravatar.cc/100?u=${u}` }} style={{ width: 44, height: 44, borderRadius: 22 }} />
           <View style={{ flex: 1, marginLeft: 12 }}><Text style={{ color: COLORS.text }}><Text style={{ fontWeight: '800' }}>{u}</Text> parça paylaştı.</Text></View>
         </View>
       ))}
    </ScrollView>
  </View>
);

/* ── Player Components ───────────────────────────────────── */

const MiniPlayer = ({ track, onExpand, isPlaying, onPlay }) => (
  <Pressable style={s.miniPlayer} onPress={onExpand}>
    <LinearGradient colors={['#1A1A22', '#0A0A0B']} style={StyleSheet.absoluteFill} />
    <View style={s.miniInner}>
      <Image source={{ uri: track.cover }} style={s.miniCover} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={s.miniTitle} numberOfLines={1}>{track.title}</Text>
        <Text style={s.miniArtist}>{track.artist}</Text>
      </View>
      <TouchableOpacity onPress={onPlay}><Ionicons name={isPlaying ? "pause" : "play"} size={26} color="#fff" /></TouchableOpacity>
    </View>
    <View style={[s.playerProgress, { width: '45%' }]} />
  </Pressable>
);

const FullPlayer = ({ track, onBack, isPlaying, onPlay }) => (
  <View style={s.fullPlayer}>
    <LinearGradient colors={['#3B0764', COLORS.background]} style={StyleSheet.absoluteFill} />
    <View style={s.fullHeader}>
      <TouchableOpacity onPress={onBack}><Ionicons name="chevron-down" size={30} color="#fff" /></TouchableOpacity>
      <Text style={s.fullNowPlaying}>NOW PLAYING</Text>
      <TouchableOpacity><Ionicons name="ellipsis-horizontal" size={24} color="#fff" /></TouchableOpacity>
    </View>
    <Image source={{ uri: track.cover }} style={s.fullCover} />
    <View style={s.fullInfo}>
      <View><Text style={s.fullTitle}>{track.title}</Text><Text style={s.fullArtist}>{track.artist}</Text></View>
      <Ionicons name="heart-outline" size={28} color={COLORS.primary} />
    </View>
    <View style={s.controlsRow}>
      <Ionicons name="shuffle" size={24} color={COLORS.textMuted} />
      <View style={s.mainControls}>
        <Ionicons name="play-skip-back" size={32} color="#fff" />
        <TouchableOpacity style={s.playBtn} onPress={onPlay}><Ionicons name={isPlaying ? "pause" : "play"} size={40} color="#fff" /></TouchableOpacity>
        <Ionicons name="play-skip-forward" size={32} color="#fff" />
      </View>
      <Ionicons name="repeat" size={24} color={COLORS.textMuted} />
    </View>
  </View>
);

/* ── Remaining Helpers ──────────────────────────────────── */

const PlaceholderView = ({ title, icon }) => (
  <View style={s.centerView}><Ionicons name={icon} size={64} color={COLORS.textGhost} /><Text style={s.centerTitle}>{title}</Text></View>
);

const SectionLabel = ({ title }) => (
  <View style={{ padding: 20, paddingTop: 30 }}><Text style={{ color: COLORS.primary, fontSize: 11, fontWeight: '900', letterSpacing: 2 }}>{title.toUpperCase()}</Text></View>
);

/* ── Styles Mirror ───────────────────────────────────────── */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  view: { flex: 1, paddingTop: Platform.OS === 'ios' ? 60 : 40 },
  viewAmbient: { position: 'absolute', top: -100, left: W/2 - 150, width: 300, height: 300, borderRadius: 150, opacity: 0.15 },
  viewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  greeting: { color: COLORS.textMuted, fontSize: 12, fontWeight: '500' },
  userName: { color: COLORS.text, fontSize: 24, fontWeight: '900', marginTop: 2 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: COLORS.primary },
  badge: { position: 'absolute', top: 8, right: 8, width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.badge, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 8, fontWeight: '900' },

  storyWrap: { alignItems: 'center', width: 68 },
  storyRing: { width: 64, height: 64, borderRadius: 32, padding: 2.5, alignItems: 'center', justifyContent: 'center' },
  storyInner: { width: 59, height: 59, borderRadius: 30, backgroundColor: COLORS.background, padding: 2 },
  storyImg: { width: '100%', height: '100%', borderRadius: 28 },
  storyAdd: { width: 62, height: 62, borderRadius: 31, borderWidth: 1.5, borderColor: COLORS.border, padding: 2, position: 'relative' },
  addDot: { position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.background },
  storyName: { color: COLORS.textSecondary, fontSize: 10, marginTop: 7, textAlign: 'center' },

  featCard: { width: W * 0.75, height: 185, borderRadius: 28, overflow: 'hidden' },
  featContent: { flex: 1, justifyContent: 'flex-end', padding: 20 },
  labelPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 8 },
  labelText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  featTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  featArtist: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },

  genreGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 15, gap: 10 },
  genreCard: { width: (W - 40) / 2, borderRadius: 20, overflow: 'hidden' },
  genreGradient: { height: 85, padding: 15, justifyContent: 'flex-end' },
  genreEmoji: { fontSize: 22, marginBottom: 4 },
  genreName: { color: '#fff', fontSize: 15, fontWeight: '800' },

  tabBar: { height: 85, backgroundColor: 'rgba(8,8,15,0.98)', flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  tabItem: { flex: 1, alignItems: 'center', paddingTop: 18 },
  tabIndicator: { position: 'absolute', top: 0, width: 24, height: 3, backgroundColor: COLORS.primary, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },

  miniPlayer: { position: 'absolute', bottom: 95, left: 12, right: 12, height: 64, borderRadius: 20, overflow: 'hidden' },
  miniInner: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15 },
  miniCover: { width: 44, height: 44, borderRadius: 12 },
  miniTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  miniArtist: { color: COLORS.textSecondary, fontSize: 12 },
  playerProgress: { position: 'absolute', bottom: 0, height: 2, backgroundColor: COLORS.primary },

  fullPlayer: { flex: 1, backgroundColor: COLORS.background },
  fullHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 30, paddingTop: 60 },
  fullNowPlaying: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  fullCover: { width: W - 60, height: W - 60, borderRadius: 40, alignSelf: 'center', marginVertical: 30 },
  fullInfo: { paddingHorizontal: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fullTitle: { color: '#fff', fontSize: 26, fontWeight: '900' },
  fullArtist: { color: COLORS.primary, fontSize: 17, fontWeight: '600' },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 40, marginTop: 50 },
  mainControls: { flexDirection: 'row', alignItems: 'center', gap: 30 },
  playBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },

  headerBar: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, paddingTop: 10 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  backBtnOuter: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backBtnAbs: { position: 'absolute', top: 50, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  rowIconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  rowLabel: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },

  headerSimple: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
  headerUsername: { color: COLORS.text, fontSize: 17, fontWeight: '800' },
  profileTop: { flexDirection: 'row', alignItems: 'center', padding: 25 },
  avatarBigWrap: { position: 'relative' },
  avatarBig: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: COLORS.primary },
  addBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: COLORS.background },
  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', marginLeft: 20 },
  stat: { alignItems: 'center' },
  statVal: { color: COLORS.text, fontSize: 19, fontWeight: '900' },
  statLab: { color: COLORS.textMuted, fontSize: 11 },
  bio: { paddingHorizontal: 25 },
  bioName: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  bioText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 19 },
  gridRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 30 },
  gridSquare: { width: W/3, height: W/3, borderWidth: 0.25, borderColor: COLORS.background },

  chatInputRow: { height: 80, backgroundColor: COLORS.background, borderTopWidth: 1, borderTopColor: COLORS.borderLight, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 15, paddingBottom: Platform.OS === 'ios' ? 20 : 0 },
  chatInput: { flex: 1, height: 44, backgroundColor: COLORS.surface, borderRadius: 22, paddingHorizontal: 20, color: COLORS.text },
  bubble: { padding: 14, borderRadius: 20, marginBottom: 15, maxWidth: '78%' },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: COLORS.primaryDeep },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  bubbleTime: { fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 5, textAlign: 'right' },

  storyViewer: { flex: 1, backgroundColor: '#000' },
  storyProgressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 55, position: 'relative', zIndex: 10 },
  storyProgressBar: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  storyProgressFill: { height: '100%', backgroundColor: '#fff' },
  storyHeader: { flexDirection: 'row', alignItems: 'center', padding: 15, position: 'relative', zIndex: 10 },
  storyHeadAvatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: '#fff' },
  storyHeadName: { color: '#fff', fontSize: 14, fontWeight: '800', marginLeft: 10 },
  storyTapZone: { position: 'absolute', top: 100, bottom: 0, left: 0, right: 0, flexDirection: 'row' },

  notifRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  trackRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  shRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 18 },
  shTitle: { color: COLORS.text, fontSize: 19, fontWeight: '900' },
  shAll: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  centerView: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerTitle: { color: COLORS.textGhost, fontSize: 20, fontWeight: '900', marginTop: 15 },
});
