/**
 * NotificationsScreen — AURORA Design System 2026
 * Transparent modal bottom sheet — matches screenshot exactly
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';

const { height: SCREEN_H } = Dimensions.get('window');

// Demo data — shown when API returns empty (web preview)
const DEMO_NOTIFS = [
  { id:'n1',  type:'follow_request', user:'nova.beats',    avatar:'https://i.pravatar.cc/80?u=nb1',  time:'2 dk',  read:false, preview:null, reference_id:'req1', actor_username:'nova.beats' },
  { id:'n2',  type:'follow',         user:'DJ Aurora',     avatar:'https://i.pravatar.cc/80?u=dj1',  time:'5 dk',  read:false, preview:null, reference_id:null,   actor_username:'djauroramusic' },
  { id:'n3',  type:'like',           user:'beatmaker99',   avatar:'https://i.pravatar.cc/80?u=bm2',  time:'12 dk', read:false, preview:null, reference_id:'post1', actor_username:'beatmaker99' },
  { id:'n4',  type:'comment',        user:'melodica_tr',   avatar:'https://i.pravatar.cc/80?u=ml3',  time:'30 dk', read:false, preview:'Harika bir parça 🔥', reference_id:'post1', actor_username:'melodica_tr' },
  { id:'n5',  type:'mention',        user:'synthwave_fan', avatar:'https://i.pravatar.cc/80?u=sw5',  time:'1 sa',  read:false, preview:'bu parçayı mutlaka dinle', reference_id:'post2', actor_username:'synthwave_fan' },
  { id:'n6',  type:'follow_accepted',user:'The Midnight',  avatar:'https://picsum.photos/seed/tm/80/80', time:'2 sa', read:true, preview:null, reference_id:null, actor_username:'themidnight' },
  { id:'n7',  type:'release',        user:'The Midnight',  avatar:'https://picsum.photos/seed/alb/80/80', time:'3 sa', read:true, preview:'Heroes', reference_id:null, actor_username:'themidnight' },
  { id:'n8',  type:'message',        user:'techno.vibes',  avatar:'https://i.pravatar.cc/80?u=tv4',  time:'1 gün', read:true,  preview:null, reference_id:null, actor_username:'technovibes' },
  { id:'n9',  type:'playlist',       user:'Discover',      avatar:'https://picsum.photos/seed/disc/80/80', time:'1 gün', read:true, preview:'Haftalık keşif listeniz güncellendi', reference_id:null, actor_username:null },
  { id:'n10', type:'story_react',    user:'kara.müzik',    avatar:'https://i.pravatar.cc/80?u=km6',  time:'2 gün', read:true,  preview:null, reference_id:null, actor_username:'karamuzik' },
];

const TYPE_META = {
  like:            { icon: 'heart',               colorKey: 'iconCoral'   },
  comment:         { icon: 'chatbubble',           colorKey: 'iconViolet'  },
  reply:           { icon: 'return-down-forward',  colorKey: 'iconViolet'  },
  follow:          { icon: 'person-add',           colorKey: 'iconCyan'    },
  follow_request:  { icon: 'person-add-outline',   colorKey: 'iconAmber'   },
  follow_accepted: { icon: 'checkmark-circle',     colorKey: 'iconGreen'   },
  friend_request:  { icon: 'person-add-outline',   colorKey: 'iconAmber'   },
  friend_accepted: { icon: 'checkmark-circle',     colorKey: 'iconGreen'   },
  mention:         { icon: 'at',                   colorKey: 'iconAmber'   },
  share:           { icon: 'share-social',         colorKey: 'iconGreen'   },
  playlist:        { icon: 'musical-notes',        colorKey: 'iconBlue'    },
  live:            { icon: 'radio',                colorKey: 'iconPink'    },
  release:         { icon: 'disc',                 colorKey: 'iconViolet'  },
  story_react:     { icon: 'heart-circle',         colorKey: 'iconCoral'   },
  story_reaction:  { icon: 'heart-circle',         colorKey: 'iconCoral'   }, // backend alias
  story_reply:     { icon: 'chatbubble-ellipses',  colorKey: 'iconViolet'  },
  message:         { icon: 'mail',                 colorKey: 'iconGreen'   },
  new_message:     { icon: 'mail',                 colorKey: 'iconGreen'   },
};

const TYPE_LABEL = {
  like:            'paylaşımını beğendi',
  comment:         'gönderine yorum yaptı',
  reply:           'yorumuna yanıt verdi',
  follow:          'seni takip etmeye başladı',
  follow_request:  'seni takip etmek istiyor',
  follow_accepted: 'takip isteğini kabul etti',
  friend_request:  'sana arkadaşlık isteği gönderdi',
  friend_accepted: 'arkadaşlık isteğini kabul etti',
  mention:         'senden bahsetti',
  share:           'parçanı paylaştı',
  playlist:        '',
  live:            'canlı yayına başladı',
  release:         'yeni albüm yayınladı:',
  story_react:     'hikayene tepki verdi',
  story_reaction:  'hikayene tepki verdi',
  story_reply:     'hikayeni yanıtladı',
  message:         'sana mesaj attı',
  new_message:     'sana mesaj attı',
};

function resolveNavigation(notif, navigation) {
  const { type, reference_id: refId, actor_username: username } = notif;
  switch (type) {
    case 'follow_request':
    case 'friend_request':
      if (username) navigation.navigate('UserProfile', { username, requestId: refId, notifId: notif.id });
      break;
    case 'follow':
    case 'follow_accepted':
    case 'friend_accepted':
    case 'live':
      if (username) navigation.navigate('UserProfile', { username });
      break;
    case 'reply':
    case 'like':
    case 'comment':
    case 'mention':
    case 'share':
      if (refId) navigation.navigate('PostDetail', { postId: refId });
      else if (username) navigation.navigate('UserProfile', { username });
      break;
    case 'playlist':
      if (refId) navigation.navigate('PlaylistDetail', { playlistId: refId });
      break;
    case 'story_react':
    case 'story_reply':
      navigation.navigate('StoryArchive');
      break;
    case 'message':
    case 'new_message':
      if (refId) navigation.navigate('ChatDetail', { conversationId: refId });
      else if (username) navigation.navigate('UserProfile', { username });
      break;
    default:
      if (username) navigation.navigate('UserProfile', { username });
  }
}

function timeAgo(iso) {
  if (!iso) return '';
  try {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60)   return `${diff} sn`;
    if (diff < 3600) return `${Math.floor(diff / 60)} dk`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} sa`;
    return `${Math.floor(diff / 86400)} gün`;
  } catch { return ''; }
}

// Types where body = "username action" full sentence — don't use as preview
const LABEL_TYPES = new Set(['follow','follow_request','follow_accepted','friend_request','friend_accepted','live','release','story_react','story_reaction','story_reply','message','new_message','playlist']);

function normaliseNotif(n) {
  const username = n.actor_username || n.from_username || n.from_user?.username || n.user || 'user';
  const rawTime  = n.time_ago || (n.created_at ? timeAgo(n.created_at) : '');
  const type     = n.type || n.notification_type || 'like';
  // Only use body as supplementary preview for content types (comment, like, mention, reply)
  // For other types body IS the full sentence — skip it to avoid duplication
  const bodyAsPreview = LABEL_TYPES.has(type) ? null : (n.body || null);
  const preview  = n.content || n.preview || bodyAsPreview || null;
  return {
    id:             n.id || n._id || String(Math.random()),
    type,
    user:           username,
    avatar:         n.actor_avatar || n.from_avatar || n.from_user?.avatar_url || `https://i.pravatar.cc/80?u=${username}`,
    time:           rawTime,
    read:           n.is_read ?? n.read ?? false,
    preview,
    reference_id:   n.reference_id || n.ref_id || null,
    actor_username: username,
  };
}

function NotifItem({ item, colors, onPress, token, onUpdate, navigation }) {
  const meta      = TYPE_META[item.type]  || TYPE_META.like;
  const label     = TYPE_LABEL[item.type] ?? 'bildirdi';
  const iconColor = colors[meta.colorKey] || colors.primary;
  const isUnread  = !item.read;
  const [reqState, setReqState] = React.useState('pending'); // pending | accepted | rejected | loading


  const handleAccept = async () => {
    if (!item.reference_id) return;
    setReqState('loading');
    try {
      await api.post(`/social/follow-request/${item.reference_id}/accept`, {}, token);
      try { await api.delete(`/notifications/${item.id}`, token); } catch {}
      setReqState('accepted');
      onUpdate?.(item.id, 'accepted');
    } catch {
      setReqState('pending');
    }
  };

  const handleReject = async () => {
    if (!item.reference_id) return;
    setReqState('loading');
    try {
      await api.post(`/social/follow-request/${item.reference_id}/reject`, {}, token);
      try { await api.delete(`/notifications/${item.id}`, token); } catch {}
      setReqState('rejected');
      onUpdate?.(item.id, 'rejected');
    } catch {
      setReqState('pending');
    }
  };

  return (
    <TouchableOpacity
      style={[
        ni.row,
        { borderBottomColor: colors.borderLight },
        isUnread && { backgroundColor: 'rgba(167,139,250,0.05)' },
      ]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      {/* Avatar + badge — tıklanınca profil */}
      <TouchableOpacity
        style={ni.avatarWrap}
        onPress={() => item.actor_username && navigation.navigate('UserProfile', { username: item.actor_username })}
        activeOpacity={0.8}
      >
        <Image source={{ uri: item.avatar }} style={ni.avatar} />
        <View style={[ni.badge, { backgroundColor: iconColor, borderColor: '#0D0A1A' }]}>
          <Ionicons name={meta.icon} size={10} color="#FFF" />
        </View>
      </TouchableOpacity>

      {/* Text + actions */}
      <View style={ni.content}>
        <Text
          style={[
            ni.msg,
            { color: isUnread ? colors.text : colors.textSecondary,
              fontWeight: isUnread ? '400' : '400' },
          ]}
          numberOfLines={2}
        >
          <Text
            style={{ fontWeight: '700', color: isUnread ? colors.text : colors.textSecondary }}
            onPress={() => item.actor_username && navigation.navigate('UserProfile', { username: item.actor_username })}
          >{item.user}</Text>
          {label ? ` ${label}` : ''}
          {item.preview ? `: "${item.preview}"` : ''}
        </Text>
        <Text style={[ni.time, { color: colors.textMuted }]}>{item.time} önce</Text>

        {item.type === 'follow_request' && reqState === 'pending' && (
          <View style={ni.reqActions}>
            <TouchableOpacity style={ni.acceptBtn} onPress={handleAccept}>
              <Text style={ni.acceptTx}>Kabul Et</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ni.rejectBtn} onPress={handleReject}>
              <Text style={ni.rejectTx}>Reddet</Text>
            </TouchableOpacity>
          </View>
        )}
        {item.type === 'follow_request' && reqState === 'loading' && (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
        )}
        {item.type === 'follow_request' && reqState === 'accepted' && (
          <Text style={[ni.reqDone, { color: colors.iconGreen || '#4ADE80' }]}>Kabul edildi</Text>
        )}
        {item.type === 'follow_request' && reqState === 'rejected' && (
          <Text style={[ni.reqDone, { color: colors.textMuted }]}>Reddedildi</Text>
        )}
      </View>

      {/* Unread dot */}
      {isUnread && <View style={[ni.dot, { backgroundColor: colors.primary }]} />}
    </TouchableOpacity>
  );
}

const ni = StyleSheet.create({
  row:        { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingVertical:14, gap:12, borderBottomWidth:1 },
  avatarWrap: { position:'relative', flexShrink:0 },
  avatar:     { width:46, height:46, borderRadius:23 },
  badge:      { position:'absolute', bottom:-2, right:-2, width:20, height:20, borderRadius:10, alignItems:'center', justifyContent:'center', borderWidth:2 },
  content:    { flex:1 },
  msg:        { fontSize:13, lineHeight:19 },
  time:       { fontSize:11, marginTop:4 },
  dot:        { width:8, height:8, borderRadius:4, flexShrink:0, alignSelf:'center' },
  reqActions: { flexDirection:'row', gap:8, marginTop:8 },
  acceptBtn:  { paddingHorizontal:16, paddingVertical:6, borderRadius:20, backgroundColor:'#C084FC' },
  acceptTx:   { fontSize:12, fontWeight:'700', color:'#fff' },
  rejectBtn:  { paddingHorizontal:16, paddingVertical:6, borderRadius:20, backgroundColor:'rgba(255,255,255,0.08)', borderWidth:1, borderColor:'rgba(255,255,255,0.12)' },
  rejectTx:   { fontSize:12, fontWeight:'600', color:'rgba(248,248,248,0.6)' },
  reqDone:    { fontSize:12, fontWeight:'600', marginTop:6 },
});

export default function NotificationsScreen({ navigation }) {
  const { colors } = useTheme();
  const { token }  = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications', token);
      const raw = Array.isArray(res) ? res : (res?.notifications || res?.items || []);
      const mapped = raw.map(normaliseNotif);
      setNotifications(mapped.length > 0 ? mapped : DEMO_NOTIFS);
    } catch {
      setNotifications(prev => prev.length > 0 ? prev : DEMO_NOTIFS);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  useFocusEffect(useCallback(() => { loadNotifications(); }, [loadNotifications]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  const emitNotifUpdate = () => {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('sb:notif-read'));
  };

  const markRead = useCallback(async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try { await api.post(`/notifications/${id}/read`, {}, token); } catch {}
    emitNotifUpdate();
  }, [token]);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try { await api.post('/notifications/read-all', {}, token); } catch {}
    emitNotifUpdate();
  }, [token]);

  const handlePress = useCallback((item) => {
    markRead(item.id);
    resolveNavigation(item, navigation);
  }, [markRead, navigation]);

  const handleRequestUpdate = useCallback((notifId, result) => {
    // Kısa gecikme — kullanıcı "Kabul edildi / Reddedildi" yazısını görsün
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notifId));
    }, result === 'accepted' ? 1200 : 600);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={s.overlay}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Blurred dim area — only the visible portion above sheet is blurred */}
      <TouchableOpacity
        style={s.dimArea}
        onPress={() => navigation.goBack()}
        activeOpacity={1}
      />

      {/* Bottom sheet */}
      <View style={s.sheet}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <Text style={[s.title, { color: colors.text }]}>Bildirimler</Text>
          <View style={s.actions}>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={markAllRead} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
                <Text style={[s.markAll, { color: colors.primary }]}>Tümünü Oku</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* List */}
        {loading ? (
          <View style={s.loader}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={item => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <NotifItem item={item} colors={colors} onPress={handlePress} token={token} onUpdate={handleRequestUpdate} navigation={navigation} />
            )}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="notifications-off-outline" size={52} color={colors.textMuted} />
                <Text style={[s.emptyTx, { color: colors.textMuted }]}>Henüz bildirim yok</Text>
              </View>
            }
            ListFooterComponent={<View style={{ height: 40 }} />}
          />
        )}
      </View>
    </View>
  );
}

const SHEET_MAX_H = Math.round(SCREEN_H * 0.92);

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  dimArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sheet: {
    maxHeight: SHEET_MAX_H,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title:   { fontSize: 17, fontWeight: '800' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  markAll: { fontSize: 13, fontWeight: '600', paddingHorizontal: 4, paddingVertical: 4 },
  loader:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:   { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTx: { fontSize: 14 },
});
