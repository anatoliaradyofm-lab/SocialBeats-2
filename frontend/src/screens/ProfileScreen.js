import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet,
  Dimensions, FlatList, Share, RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

const { width: SW } = Dimensions.get('window');
const PROFILE_TABS = [
  { id: 'grid', icon: 'grid' },
  { id: 'likes', icon: 'heart' },
  { id: 'saved', icon: 'bookmark' },
  { id: 'playlists', icon: 'musical-notes' },
  { id: 'tagged', icon: 'pricetag' },
];

export default function ProfileScreen({ navigation }) {
  const { t } = useTranslation();
  const { user, token } = useAuth();
  const { colors } = useTheme();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [badges, setBadges] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [activeTab, setActiveTab] = useState('grid');
  const [refreshing, setRefreshing] = useState(false);
  const [likedPosts, setLikedPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [taggedPosts, setTaggedPosts] = useState([]);

  const fetchProfile = useCallback(async () => {
    try {
      const [p, postsRes, b, h] = await Promise.all([
        api.get(`/user/${user?.id || 'me'}`, token).catch(() => ({ user: user })),
        api.get(`/social/posts/user/${user?.id}`, token).catch(() => ({ posts: [] })),
        api.get(`/user/${user?.id || 'me'}/badges`, token).catch(() => ({ badges: [] })),
        api.get('/highlights', token).catch(() => ({ highlights: [] })),
      ]);
      setProfile(p.user || p);
      setPosts(postsRes.posts || postsRes || []);
      setBadges(b.badges || b || []);
      setHighlights(h.highlights || h || []);
    } catch {}
  }, [user, token]);

  const fetchTabData = useCallback(async (tab) => {
    try {
      if (tab === 'likes' && likedPosts.length === 0) {
        const res = await api.get('/social/posts/liked', token).catch(() => ({ posts: [] }));
        setLikedPosts(res.posts || res || []);
      } else if (tab === 'saved' && savedPosts.length === 0) {
        const res = await api.get('/social/posts/saved', token).catch(() => ({ posts: [] }));
        setSavedPosts(res.posts || res || []);
      } else if (tab === 'playlists' && playlists.length === 0) {
        const res = await api.get('/playlists', token).catch(() => ({ playlists: [] }));
        setPlaylists(res.playlists || res || []);
      } else if (tab === 'tagged' && taggedPosts.length === 0) {
        const res = await api.get(`/social/posts/tagged/${user?.id}`, token).catch(() => ({ posts: [] }));
        setTaggedPosts(res.posts || res || []);
      }
    } catch {}
  }, [token, user, likedPosts.length, savedPosts.length, playlists.length, taggedPosts.length]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);
  useEffect(() => { if (activeTab !== 'grid') fetchTabData(activeTab); }, [activeTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setLikedPosts([]); setSavedPosts([]); setPlaylists([]); setTaggedPosts([]);
    setRefreshing(false);
  };

  if (!profile && !user) return null;
  const p = profile || user;

  const renderPostGrid = (data) => (
    <View style={styles.gridWrap}>
      {data.map((post, i) => (
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
      {data.length === 0 && (
        <View style={{ width: '100%', alignItems: 'center', paddingVertical: 40 }}>
          <Ionicons name={activeTab === 'likes' ? 'heart-outline' : activeTab === 'saved' ? 'bookmark-outline' : activeTab === 'tagged' ? 'pricetag-outline' : 'grid-outline'} size={44} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, marginTop: 12 }}>
            {activeTab === 'likes' ? t('profile.noLikedPosts') : activeTab === 'saved' ? t('profile.noSavedPosts') : activeTab === 'tagged' ? t('profile.noTaggedPosts') : t('profile.noPosts')}
          </Text>
        </View>
      )}
    </View>
  );

  const renderSavedContent = () => {
    if (savedPosts.length === 0) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Ionicons name="bookmark-outline" size={44} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, marginTop: 12 }}>{t('profile.noSavedPosts')}</Text>
        </View>
      );
    }
    const folders = {};
    savedPosts.forEach(post => {
      const folder = post.save_folder || t('profile.general');
      if (!folders[folder]) folders[folder] = [];
      folders[folder].push(post);
    });
    return (
      <View style={{ padding: 12 }}>
        {Object.entries(folders).map(([name, items]) => (
          <TouchableOpacity key={name} style={[styles.savedFolder, { backgroundColor: colors.surfaceElevated }]}>
            <View style={styles.savedFolderGrid}>
              {items.slice(0, 4).map((item, i) => (
                <View key={i} style={styles.savedFolderThumb}>
                  {item.media_url ? <Image source={{ uri: item.media_url }} style={{ width: '100%', height: '100%' }} /> : <View style={{ width: '100%', height: '100%', backgroundColor: colors.border }} />}
                </View>
              ))}
            </View>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600', marginTop: 6 }}>{name}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>{t('profile.postsCount', { count: items.length })}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderPlaylists = () => {
    if (playlists.length === 0) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Ionicons name="musical-notes-outline" size={44} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, marginTop: 12 }}>{t('profile.noPlaylists')}</Text>
        </View>
      );
    }
    return playlists.map((pl, i) => (
      <TouchableOpacity key={pl.id || i} style={[styles.playlistRow, { borderBottomColor: colors.border }]}
        onPress={() => navigation.navigate('PlaylistDetail', { playlistId: pl.id || pl._id })}>
        <View style={[styles.playlistCover, { backgroundColor: colors.surfaceElevated }]}>
          {pl.cover_url ? <Image source={{ uri: pl.cover_url }} style={styles.playlistCover} /> : <Ionicons name="musical-notes" size={22} color={BRAND.primaryLight} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{pl.name}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('profile.trackCount', { count: pl.track_count || 0 })}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    ));
  };

  const getTabContent = () => {
    switch (activeTab) {
      case 'grid': return renderPostGrid(posts);
      case 'likes': return renderPostGrid(likedPosts);
      case 'saved': return renderSavedContent();
      case 'playlists': return renderPlaylists();
      case 'tagged': return renderPostGrid(taggedPosts);
      default: return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.primary} />} showsVerticalScrollIndicator={false}>
        <View style={styles.coverWrap}>
          {p.cover_url ? <Image source={{ uri: p.cover_url }} style={styles.coverImg} /> : <View style={[styles.coverImg, { backgroundColor: BRAND.primaryDark }]} />}
          <View style={styles.coverOverlay} />
          <View style={styles.coverHeader}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <TouchableOpacity onPress={() => navigation.navigate('ShareProfile')}>
                <Ionicons name="qr-code-outline" size={22} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
                <Ionicons name="menu" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.profileSection}>
          <View style={[styles.avatarWrap, { borderColor: colors.background }]}>
            <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated }]}>
              {p.avatar_url ? <Image source={{ uri: p.avatar_url }} style={styles.avatar} /> : <Ionicons name="person" size={36} color={BRAND.primaryLight} />}
            </View>
          </View>

          <View style={styles.infoSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.displayName, { color: colors.text }]}>{p.display_name || p.username}</Text>
              {p.is_verified && <Ionicons name="checkmark-circle" size={18} color={BRAND.accent} />}
              {p.is_private && <Ionicons name="lock-closed" size={14} color={colors.textMuted} />}
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>@{p.username}</Text>
            {p.bio && <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 }}>{p.bio}</Text>}

            {(p.location || p.website) && (
              <View style={{ marginTop: 6, gap: 3 }}>
                {p.location && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>{p.location}</Text>
                  </View>
                )}
                {p.website && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="link-outline" size={13} color={BRAND.primary} />
                    <Text style={{ color: BRAND.primary, fontSize: 12 }}>{p.website}</Text>
                  </View>
                )}
              </View>
            )}

            {(p.xp || p.level) && (
              <View style={styles.xpRow}>
                <Ionicons name="trophy" size={14} color="#F59E0B" />
                <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '600' }}>{t('profile.level', { level: p.level || 1 })}</Text>
                <View style={[styles.xpBar, { backgroundColor: colors.border }]}>
                  <View style={[styles.xpFill, { width: `${(p.xp % 100) || 0}%` }]} />
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 10 }}>{p.xp || 0} XP</Text>
              </View>
            )}

            <View style={styles.statsRow}>
              <TouchableOpacity onPress={() => navigation.navigate('ProfileStats')}>
                <Text style={[styles.statNum, { color: colors.text }]}>{p.post_count || posts.length}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('common.posts')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('FollowersList', { userId: p.id || p._id })}>
                <Text style={[styles.statNum, { color: colors.text }]}>{p.followers_count || 0}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('common.followers')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('FollowingList', { userId: p.id || p._id })}>
                <Text style={[styles.statNum, { color: colors.text }]}>{p.following_count || 0}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('common.following')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('ProfileEdit')}>
                <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 13 }}>{t('profile.editProfile')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => navigation.navigate('ProfileStats')}>
                <Ionicons name="stats-chart" size={18} color={BRAND.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {badges.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
            {badges.map((b, i) => (
              <View key={i} style={[styles.badgeItem, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name={b.icon || 'trophy'} size={16} color={BRAND.primary} />
                <Text style={{ color: colors.text, fontSize: 10, marginTop: 2 }}>{b.name}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {highlights.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlightRow}>
            <TouchableOpacity style={styles.highlightNew} onPress={() => navigation.navigate('StoryCreate')}>
              <View style={[styles.highlightAdd, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="add" size={24} color={BRAND.primary} />
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 4 }}>{t('profile.new')}</Text>
            </TouchableOpacity>
            {highlights.map((h, i) => (
              <TouchableOpacity key={i} style={styles.highlightItem} onPress={() => navigation.navigate('Highlights')}>
                <View style={[styles.highlightCircle, { borderColor: BRAND.primary }]}>
                  {h.cover_url ? <Image source={{ uri: h.cover_url }} style={styles.highlightImg} /> : <Ionicons name="bookmark" size={18} color={BRAND.primaryLight} />}
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 4 }} numberOfLines={1}>{h.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={[styles.postTabs, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
          {PROFILE_TABS.map(tab => (
            <TouchableOpacity key={tab.id} style={[styles.postTab, activeTab === tab.id && { borderBottomColor: BRAND.primary, borderBottomWidth: 2 }]} onPress={() => setActiveTab(tab.id)}>
              <Ionicons name={activeTab === tab.id ? tab.icon : `${tab.icon}-outline`} size={20} color={activeTab === tab.id ? BRAND.primary : colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {getTabContent()}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  coverWrap: { height: 180, position: 'relative' },
  coverImg: { width: '100%', height: '100%' },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
  coverHeader: { position: 'absolute', top: 50, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  profileSection: { paddingHorizontal: 16, marginTop: -40 },
  avatarWrap: { borderWidth: 4, borderRadius: 48, alignSelf: 'flex-start' },
  avatar: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  infoSection: { marginTop: 8 },
  displayName: { fontSize: 22, fontWeight: '800' },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  xpBar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden', maxWidth: 100 },
  xpFill: { height: '100%', backgroundColor: '#F59E0B', borderRadius: 2 },
  statsRow: { flexDirection: 'row', gap: 24, marginTop: 14 },
  statNum: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  statLabel: { fontSize: 11, textAlign: 'center' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  editBtn: { flex: 1, backgroundColor: BRAND.primary, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  iconBtn: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  badgeRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  badgeItem: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 2 },
  highlightRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  highlightNew: { alignItems: 'center' },
  highlightAdd: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  highlightItem: { alignItems: 'center', width: 64 },
  highlightCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  highlightImg: { width: 60, height: 60, borderRadius: 30 },
  postTabs: { flexDirection: 'row', borderTopWidth: 0.5, borderBottomWidth: 0.5 },
  postTab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: SW / 3, height: SW / 3, padding: 1 },
  gridImg: { width: '100%', height: '100%' },
  savedFolder: { borderRadius: 14, padding: 10, marginBottom: 10 },
  savedFolderGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', height: 100, borderRadius: 10, overflow: 'hidden' },
  savedFolderThumb: { width: '50%', height: 50 },
  playlistRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, gap: 12 },
  playlistCover: { width: 50, height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
});
