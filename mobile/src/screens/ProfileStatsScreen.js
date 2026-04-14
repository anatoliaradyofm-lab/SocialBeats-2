import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const PRI    = '#C084FC';
const ACC    = '#FB923C';
const RED    = '#F87171';
const GREEN  = '#4ADE80';
const BLUE   = '#60A5FA';

const PERIODS = [
  { key: 'week',  label: '7G',   folKey: '7d'   },
  { key: 'month', label: '30G',  folKey: '30d'  },
  { key: '90d',   label: '90G',  folKey: '90d'  },
  { key: '180d',  label: '180G', folKey: '180d' },
  { key: 'year',  label: '1 Yıl', folKey: 'all' },
];

function fmt(n) {
  if (n == null) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}
function fmtMin(min) {
  if (!min) return '0 dk';
  if (min >= 60) return Math.floor(min / 60) + ' sa ' + (min % 60) + ' dk';
  return min + ' dk';
}

function MiniBar({ value, max, color = PRI, borderColor = 'rgba(255,255,255,0.09)' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={[mb.track, { backgroundColor: borderColor }]}>
      <View style={[mb.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}
const mb = StyleSheet.create({
  track: { height: 5, borderRadius: 3, overflow: 'hidden', flex: 1 },
  fill:  { height: '100%', borderRadius: 3 },
});

function Chip({ icon, label, value, color = PRI, textColor = '#F8F8F8', mutedColor = 'rgba(248,248,248,0.32)' }) {
  return (
    <View style={ch.wrap}>
      <View style={[ch.icon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[ch.val, { color: textColor }]}>{value}</Text>
      <Text style={[ch.lbl, { color: mutedColor }]}>{label}</Text>
    </View>
  );
}
const ch = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  icon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  val:  { fontSize: 20, fontWeight: '800' },
  lbl:  { fontSize: 11, marginTop: 2, textAlign: 'center' },
});

function Card({ children, style, cardBg = 'rgba(255,255,255,0.055)', cardBorder = 'rgba(255,255,255,0.09)' }) {
  return <View style={[cd.card, { backgroundColor: cardBg, borderColor: cardBorder }, style]}>{children}</View>;
}
const cd = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 20, marginBottom: 14 },
});

export default function ProfileStatsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { token } = useAuth();

  const s = createStyles(colors);
  const cardProps = { cardBg: colors.card, cardBorder: colors.border };
  const chipProps = { textColor: colors.text, mutedColor: colors.textMuted };
  const barProps  = { borderColor: colors.border };
  const [period, setPeriod]       = useState('month');
  const [data, setData]           = useState(null);
  const [followers, setFollowers] = useState(null);
  const [loading, setLoading]     = useState(true);

  const periodRef = useRef(period);
  const tokenRef  = useRef(token);
  useEffect(() => { periodRef.current = period; }, [period]);
  useEffect(() => { tokenRef.current  = token;  }, [token]);

  const load = useCallback(async (p, showSpinner) => {
    if (showSpinner) setLoading(true);
    const periodCfg = PERIODS.find(x => x.key === p) || PERIODS[1];
    try {
      const [stats, fol] = await Promise.all([
        api.get(`/stats/user?period=${p}`, tokenRef.current),
        api.get(`/profile/analytics/followers?period=${periodCfg.folKey}`, tokenRef.current),
      ]);
      setData(stats);
      setFollowers(fol);
    } catch (e) {
      console.warn('stats error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  /* Period değişince hemen yükle */
  useEffect(() => { load(period, true); }, [period]);

  /* Ekran odaklandığında anlık yükle + 60s polling */
  useFocusEffect(useCallback(() => {
    load(periodRef.current, false);
    const interval = setInterval(() => load(periodRef.current, false), 60_000);
    return () => clearInterval(interval);
  }, [load]));

  const listening    = data?.listening   || {};
  const activity     = data?.activity    || {};
  const folSummary   = followers?.summary || {};
  const topFollowers = followers?.top_followers || [];
  const topArtists   = listening.top_artists || [];
  const topTracks    = listening.top_tracks  || [];
  const maxArtistPlays = topArtists[0]?.play_count || 1;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* ── Header ── */}
      <View style={s.hdr}>
        <TouchableOpacity style={s.hdrBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>İstatistikler</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Period pills ── */}
      <View style={s.pills}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[s.pill, period === p.key && s.pillActive]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[s.pillTx, period === p.key && s.pillTxActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator color={PRI} size="large" />
          <Text style={s.loaderTx}>Veriler yükleniyor…</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16) + 32 }}
        >
          {/* ── Özet ── */}
          <Text style={s.sec}>Özet</Text>
          <Card {...cardProps}>
            <View style={{ flexDirection: 'row' }}>
              <Chip {...chipProps} icon="people"     label="Takipçi"    value={fmt(folSummary.total_followers)}          color={PRI}     />
              <View style={s.vDiv} />
              <Chip {...chipProps} icon="person-add" label="Yeni Takip" value={`+${fmt(folSummary.new_followers || 0)}`} color={GREEN}   />
              <View style={s.vDiv} />
              <Chip {...chipProps} icon="flash"      label="Aktif Gün"  value={fmt(activity.days_active)}                color="#FACC15" />
            </View>
          </Card>

          {/* ── Takipçi özeti ── */}
          <Text style={s.sec}>Takipçiler</Text>
          <Card {...cardProps}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              {[
                { val: fmt(folSummary.total_followers),  color: '#fff',  lbl: 'Toplam'    },
                { val: `+${fmt(folSummary.new_followers  || 0)}`, color: GREEN, lbl: 'Kazanılan' },
                { val: `-${fmt(folSummary.lost_followers || 0)}`, color: RED,   lbl: 'Kaybedilen'},
                { val: (folSummary.net_growth >= 0 ? '+' : '') + fmt(folSummary.net_growth || 0),
                  color: (folSummary.net_growth || 0) >= 0 ? GREEN : RED, lbl: 'Net Büyüme' },
              ].map((item, i, arr) => (
                <React.Fragment key={i}>
                  <View style={s.folStat}>
                    <Text style={[s.folVal, { color: item.color }]}>{item.val}</Text>
                    <Text style={s.folLbl}>{item.lbl}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={[s.vDiv, { height: 40 }]} />}
                </React.Fragment>
              ))}
            </View>
          </Card>

          {/* ── Dinleme ── */}
          <Text style={s.sec}>Dinleme</Text>
          <Card {...cardProps}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View>
                <Text style={s.bigVal}>{fmtMin(listening.total_minutes)}</Text>
                <Text style={s.bigLbl}>Toplam Dinleme Süresi</Text>
              </View>
              <LinearGradient colors={[PRI + '33', 'transparent']} style={s.pulseCircle}>
                <Ionicons name="musical-notes" size={28} color={PRI} />
              </LinearGradient>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <View style={s.listenChip}>
                <Ionicons name="disc-outline"  size={13} color={ACC}   />
                <Text style={s.listenChipTx}>{fmt(listening.total_tracks)} şarkı</Text>
              </View>
              <View style={s.listenChip}>
                <Ionicons name="mic-outline"   size={13} color={BLUE}  />
                <Text style={s.listenChipTx}>{fmt(listening.unique_artists)} sanatçı</Text>
              </View>
              <View style={s.listenChip}>
                <Ionicons name="time-outline"  size={13} color={GREEN} />
                <Text style={s.listenChipTx}>{fmtMin(listening.daily_average)} / gün</Text>
              </View>
            </View>
          </Card>

          {/* ── En çok dinlenen sanatçılar ── */}
          {topArtists.length > 0 && (
            <>
              <Text style={s.sec}>En Çok Dinlenen Sanatçılar</Text>
              <Card {...cardProps}>
                {topArtists.map((a, i) => (
                  <View key={i} style={{ marginBottom: i < topArtists.length - 1 ? 14 : 0 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={s.rank}>{i + 1}</Text>
                        <Text style={s.artistName}>{a.name}</Text>
                      </View>
                      <Text style={s.playCount}>{a.play_count} oynatma</Text>
                    </View>
                    <MiniBar {...barProps} value={a.play_count} max={maxArtistPlays} color={PRI} />
                  </View>
                ))}
              </Card>
            </>
          )}

          {/* ── En çok dinlenen şarkılar ── */}
          {topTracks.length > 0 && (
            <>
              <Text style={s.sec}>En Çok Dinlenen Şarkılar</Text>
              <Card {...cardProps}>
                {topTracks.map((t, i) => (
                  <View key={i} style={[s.trackRow, i < topTracks.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                    <View style={[s.trackNum, { backgroundColor: i === 0 ? PRI + '33' : colors.surface }]}>
                      <Text style={[s.trackNumTx, { color: i === 0 ? PRI : 'rgba(255,255,255,0.4)' }]}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.trackTitle}  numberOfLines={1}>{t.title}</Text>
                      <Text style={s.trackArtist} numberOfLines={1}>{t.artist}</Text>
                    </View>
                    <View style={s.playBadge}>
                      <Ionicons name="play" size={10} color={ACC} />
                      <Text style={s.playBadgeTx}>{t.play_count}</Text>
                    </View>
                  </View>
                ))}
              </Card>
            </>
          )}

          {/* ── Etkileşim kuran takipçiler ── */}
          {topFollowers.length > 0 && (
            <>
              <Text style={s.sec}>Etkileşim Kuran Takipçiler</Text>
              <Card {...cardProps} style={{ padding: 8 }}>
                {topFollowers.map((f, i) => (
                  <TouchableOpacity
                    key={f.id}
                    style={[s.followerRow, i < topFollowers.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                    onPress={() => navigation.navigate('UserProfile', { userId: f.id })}
                  >
                    {f.avatar_url
                      ? <Image source={{ uri: f.avatar_url }} style={s.fAvatar} />
                      : (
                        <View style={[s.fAvatar, { backgroundColor: PRI + '33', justifyContent: 'center', alignItems: 'center' }]}>
                          <Ionicons name="person" size={18} color={PRI} />
                        </View>
                      )
                    }
                    <View style={{ flex: 1 }}>
                      <Text style={s.fName}>{f.display_name || f.username}</Text>
                      <Text style={s.fUser}>@{f.username}</Text>
                    </View>
                    <View style={s.engBadge}>
                      <Ionicons name="pulse" size={11} color={GREEN} />
                      <Text style={s.engTx}>{f.engagement_score}%</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </Card>
            </>
          )}

          {/* ── Aktivite ── */}
          <Text style={s.sec}>Aktivite</Text>
          <Card {...cardProps}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[
                { icon: 'calendar-outline', color: PRI,       val: activity.days_active    || 0, lbl: 'Aktif Gün'    },
                { icon: 'flame-outline',    color: ACC,       val: activity.streak_days    || 0, lbl: 'Güncel Seri'  },
                { icon: 'trophy-outline',   color: '#FACC15', val: activity.longest_streak || 0, lbl: 'En Uzun Seri' },
              ].map((item, i) => (
                <View key={i} style={s.actBox}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                  <Text style={s.actVal}>{item.val}</Text>
                  <Text style={s.actLbl}>{item.lbl}</Text>
                </View>
              ))}
            </View>
          </Card>

        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  root:         { flex: 1, backgroundColor: colors.background },
  hdr:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 60, borderBottomWidth: 1, borderBottomColor: colors.border },
  hdrBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  hdrTitle:     { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  pills:        { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
  pill:         { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  pillActive:   { backgroundColor: PRI + '33', borderColor: PRI },
  pillTx:       { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  pillTxActive: { color: PRI, fontWeight: '700' },
  loader:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loaderTx:     { color: colors.textMuted, fontSize: 14 },
  sec:          { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  vDiv:         { width: 1, backgroundColor: colors.border, marginHorizontal: 4 },
  hDiv:         { height: 1, backgroundColor: colors.border },
  bigVal:       { fontSize: 28, fontWeight: '900', color: colors.text, letterSpacing: -1 },
  bigLbl:       { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  pulseCircle:  { width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center' },
  listenChip:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: colors.border },
  listenChipTx: { fontSize: 12, color: colors.text, fontWeight: '600' },
  rank:         { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.surface, textAlign: 'center', lineHeight: 22, fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  artistName:   { fontSize: 14, fontWeight: '700', color: colors.text },
  playCount:    { fontSize: 12, color: colors.textMuted },
  trackRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  trackNum:     { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  trackNumTx:   { fontSize: 13, fontWeight: '800' },
  trackTitle:   { fontSize: 14, fontWeight: '700', color: colors.text },
  trackArtist:  { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  playBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: ACC + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  playBadgeTx:  { fontSize: 12, color: ACC, fontWeight: '700' },
  folStat:      { alignItems: 'center', flex: 1 },
  folVal:       { fontSize: 18, fontWeight: '800', color: colors.text },
  folLbl:       { fontSize: 11, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  followerRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8 },
  fAvatar:      { width: 42, height: 42, borderRadius: 21 },
  fName:        { fontSize: 14, fontWeight: '700', color: colors.text },
  fUser:        { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  engBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: GREEN + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  engTx:        { fontSize: 12, color: GREEN, fontWeight: '700' },
  actBox:       { flex: 1, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: 'center', paddingVertical: 16, gap: 6 },
  actVal:       { fontSize: 22, fontWeight: '800', color: colors.text },
  actLbl:       { fontSize: 11, color: colors.textMuted },
});
