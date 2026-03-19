/**
 * NotificationsScreen — AURORA Design System 2026
 * Transparent modal bottom sheet — matches screenshot exactly
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const { height: SCREEN_H } = Dimensions.get('window');

// Demo data — shown when API returns empty (web preview)
const DEMO_NOTIFS = [
  { id:'n1', type:'follow',  user:'DJ Aurora',    avatar:'https://i.pravatar.cc/80?u=dj1',  time:'5 dk',   read:false, preview:null, reference_id:null, actor_username:'djauroramusic' },
  { id:'n2', type:'like',    user:'beatmaker99',   avatar:'https://i.pravatar.cc/80?u=bm2',  time:'12 dk',  read:false, preview:null, reference_id:'post1', actor_username:'beatmaker99' },
  { id:'n3', type:'release', user:'The Midnight',  avatar:'https://picsum.photos/seed/alb/80/80', time:'1 sa', read:false, preview:'Heroes', reference_id:null, actor_username:'themidnight' },
  { id:'n4', type:'message', user:'melodica_tr',   avatar:'https://i.pravatar.cc/80?u=ml3',  time:'2 sa',   read:true,  preview:null, reference_id:null, actor_username:'melodica_tr' },
  { id:'n5', type:'playlist',user:'Discover',      avatar:'https://picsum.photos/seed/disc/80/80', time:'1 gün', read:true, preview:'Haftalık keşif listeniz güncellendi', reference_id:null, actor_username:null },
  { id:'n6', type:'follow',  user:'techno.vibes',  avatar:'https://i.pravatar.cc/80?u=tv4',  time:'1 gün',  read:true,  preview:'ve 2 kişi daha', reference_id:null, actor_username:'technovibes' },
  { id:'n7', type:'like',    user:'Paylaşımın',    avatar:'https://picsum.photos/seed/post3/80/80', time:'2 gün', read:true, preview:'142 beğeni aldı 🔥', reference_id:'post3', actor_username:null },
];

const TYPE_META = {
  like:        { icon: 'heart',               colorKey: 'iconCoral'   },
  comment:     { icon: 'chatbubble',          colorKey: 'iconViolet'  },
  follow:      { icon: 'person-add',          colorKey: 'iconCyan'    },
  mention:     { icon: 'at',                  colorKey: 'iconAmber'   },
  share:       { icon: 'share-social',        colorKey: 'iconGreen'   },
  playlist:    { icon: 'musical-notes',       colorKey: 'iconBlue'    },
  live:        { icon: 'radio',               colorKey: 'iconPink'    },
  release:     { icon: 'disc',               colorKey: 'iconViolet'  },
  story_react: { icon: 'heart-circle',        colorKey: 'iconCoral'   },
  story_reply: { icon: 'chatbubble-ellipses', colorKey: 'iconViolet'  },
  message:     { icon: 'mail',               colorKey: 'iconGreen'   },
};

const TYPE_LABEL = {
  like:        'paylaşımını beğendi',
  comment:     'gönderine yorum yaptı',
  follow:      'seni takip etmeye başladı',
  mention:     'senden bahsetti',
  share:       'parçanı paylaştı',
  playlist:    '',   // preview used directly
  live:        'canlı yayına başladı',
  release:     'yeni albüm yayınladı:',
  story_react: 'hikayene tepki verdi',
  story_reply: 'hikayeni yanıtladı',
  message:     'sana mesaj attı',
};

function resolveNavigation(notif, navigation) {
  const { type, reference_id: refId, actor_username: username } = notif;
  switch (type) {
    case 'follow':
    case 'live':
      if (username) navigation.navigate('UserProfile', { username });
      break;
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
    default:
      if (username) navigation.navigate('UserProfile', { username });
  }
}

function normaliseNotif(n) {
  return {
    id:             n.id || n._id || String(Math.random()),
    type:           n.type || n.notification_type || 'like',
    user:           n.actor_username || n.from_user?.username || n.user || 'user',
    avatar:         n.actor_avatar || n.from_user?.avatar_url || `https://i.pravatar.cc/80?u=${n.actor_username || n.id}`,
    time:           n.time_ago || n.created_at || '',
    read:           n.is_read ?? n.read ?? false,
    preview:        n.content || n.preview || null,
    reference_id:   n.reference_id || n.ref_id || null,
    actor_username: n.actor_username || null,
  };
}

function NotifItem({ item, colors, onPress }) {
  const meta      = TYPE_META[item.type]  || TYPE_META.like;
  const label     = TYPE_LABEL[item.type] || 'bildirdi';
  const iconColor = colors[meta.colorKey] || colors.primary;
  const isUnread  = !item.read;

  const message = item.preview && !label
    ? item.preview                                       // playlist type — preview is the full message
    : item.preview && label
    ? `${item.user} ${label} "${item.preview}"`
    : `${item.user} ${label}`;

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
      {/* Avatar + badge */}
      <View style={ni.avatarWrap}>
        <Image source={{ uri: item.avatar }} style={ni.avatar} />
        <View style={[ni.badge, { backgroundColor: iconColor, borderColor: '#0D0A1A' }]}>
          <Ionicons name={meta.icon} size={10} color="#FFF" />
        </View>
      </View>

      {/* Text */}
      <View style={ni.content}>
        <Text
          style={[
            ni.msg,
            { color: isUnread ? colors.text : colors.textSecondary,
              fontWeight: isUnread ? '600' : '400' },
          ]}
          numberOfLines={2}
        >
          {message}
        </Text>
        <Text style={[ni.time, { color: colors.textMuted }]}>{item.time} önce</Text>
      </View>

      {/* Unread dot */}
      {isUnread && <View style={[ni.dot, { backgroundColor: colors.primary }]} />}
    </TouchableOpacity>
  );
}

const ni = StyleSheet.create({
  row:       { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingVertical:14, gap:12, borderBottomWidth:1 },
  avatarWrap:{ position:'relative', flexShrink:0 },
  avatar:    { width:46, height:46, borderRadius:23 },
  badge:     { position:'absolute', bottom:-2, right:-2, width:20, height:20, borderRadius:10, alignItems:'center', justifyContent:'center', borderWidth:2 },
  content:   { flex:1 },
  msg:       { fontSize:13, lineHeight:19 },
  time:      { fontSize:11, marginTop:4 },
  dot:       { width:8, height:8, borderRadius:4, flexShrink:0, alignSelf:'center' },
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  const markRead = useCallback(async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try { await api.post(`/notifications/${id}/read`, {}, token); } catch {}
  }, [token]);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try { await api.post('/notifications/read-all', {}, token); } catch {}
  }, [token]);

  const handlePress = useCallback((item) => {
    markRead(item.id);
    resolveNavigation(item, navigation);
  }, [markRead, navigation]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={s.overlay}>
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
              <NotifItem item={item} colors={colors} onPress={handlePress} />
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
