import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Linking, Modal, FlatList, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import RewardedAd from '../components/ads/RewardedAd';
import ProfilePosts from '../components/profile/ProfilePosts';
import ProfileStoriesHighlights from '../components/profile/ProfileStoriesHighlights';
import VerifiedBadge from '../components/VerifiedBadge';
import RichText from '../components/RichText';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

export default function ProfileScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { user, token, isGuest, exitGuest } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('posts');
  const [menuVisible, setMenuVisible] = useState(false);

  const username = user?.username || 'unknown';
  const displayName = user?.display_name || username;
  const avatar = user?.avatar_url || `https://i.pravatar.cc/200?u=${username}`;

  if (isGuest) {
    return (
      <View style={[styles.container, styles.guestContainer, { paddingTop: insets.top }]}>
        <Text style={styles.guestTitle}>{t('login.title')}</Text>
        <Text style={styles.guestSubtitle}>{t('register.subtitle')}</Text>
        <TouchableOpacity style={styles.guestLoginBtn} onPress={() => exitGuest()}>
          <Text style={styles.guestLoginText}>{t('login.submit')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const menuItems = [
    { key: 'settings', icon: 'settings-outline', label: t('settings.title') || 'Settings', screen: 'Settings' },
    { key: 'conversations', icon: 'chatbubbles-outline', label: t('conversations.title'), screen: 'Conversations' },
    { key: 'liked', icon: 'heart-outline', label: t('saved.title', 'Liked'), screen: 'Liked' },
    { key: 'saved', icon: 'bookmark-outline', label: t('saved.title', 'Saved'), screen: 'Saved' },
    { key: 'playlists', icon: 'list-outline', label: t('tabs.playlists'), screen: 'Main', params: { screen: 'Playlists' } },
    { key: 'collaborative', icon: 'people-outline', label: t('collaborative.title'), screen: 'CollaborativePlaylists' },
    { key: 'history', icon: 'time-outline', label: t('listeningHistory.title'), screen: 'ListeningHistory' },
    { key: 'achievements', icon: 'trophy-outline', label: t('achievements.title'), screen: 'Achievements' },
    { key: 'events', icon: 'calendar-outline', label: t('events.title'), screen: 'Events' },
    { key: 'live', icon: 'radio-outline', label: t('liveStream.title'), screen: 'LiveStream' },
    { key: 'listeningRoom', icon: 'headset-outline', label: t('listeningRoom.title') || 'Listening Rooms', screen: 'ListeningRoom' },
    { key: 'arMusic', icon: 'color-wand-outline', label: t('arMusic.title') || 'AR Music', screen: 'ARMusic' },
    { key: 'qr', icon: 'qr-code-outline', label: t('profile.profileQR'), screen: 'ProfileQR' },
    { key: 'stats', icon: 'bar-chart-outline', label: t('profile.visitors'), screen: 'ProfileStats' },
    { key: 'suggestions', icon: 'person-add-outline', label: t('suggestions.title'), screen: 'UserSuggestions' },
    { key: 'contacts', icon: 'call-outline', label: t('findContacts.title'), screen: 'FindContacts' },
    { key: 'closeFriends', icon: 'star-outline', label: t('closeFriends.title'), screen: 'CloseFriends' },
    { key: 'followSuggestions', icon: 'people-circle-outline', label: t('suggestions.followSuggestions') || 'Follow Suggestions', screen: 'FollowSuggestions' },
    { key: 'musicDiscover', icon: 'disc-outline', label: t('musicDiscover.title') || 'Music Discover', screen: 'MusicDiscover' },
    { key: 'contactsFriends', icon: 'phone-portrait-outline', label: t('findContacts.fromContacts') || 'Friends from Contacts', screen: 'ContactsFriends' },
    { key: 'sessions', icon: 'shield-checkmark-outline', label: t('settings.activeSessions') || 'Active Sessions', screen: 'Sessions' },
    { key: 'communities', icon: 'globe-outline', label: t('communities.title') || 'Communities', screen: 'Communities' },
    { key: 'karaoke', icon: 'mic-outline', label: t('karaoke.title') || 'Karaoke', screen: 'Karaoke' },
    { key: 'referral', icon: 'gift-outline', label: t('referral.title') || 'Invite Friends', screen: 'Referral' },
    { key: 'backup', icon: 'cloud-upload-outline', label: t('backup.title') || 'Backup & Restore', screen: 'Backup' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* IG Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerLeft} activeOpacity={0.7}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.text} />
          <Text style={styles.headerUsername}>{username}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => navigation.navigate('CreatePost')} style={styles.headerIcon}>
            <Ionicons name="add-box-outline" size={28} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.headerIcon}>
            <Ionicons name="settings-outline" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Info Row */}
        <View style={styles.infoRow}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: avatar }} style={styles.avatar} />
            <View style={styles.addStoryBadge}>
              <Ionicons name="add" size={16} color="#fff" />
            </View>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{user?.posts_count ?? 0}</Text>
              <Text style={styles.statLabel}>{t('common.posts')}</Text>
            </View>
            <TouchableOpacity style={styles.statBox} onPress={() => user?.id && navigation.navigate('FollowersList', { userId: user.id })}>
              <Text style={styles.statValue}>{user?.followers_count ?? 0}</Text>
              <Text style={styles.statLabel}>{t('profile.follower')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statBox} onPress={() => user?.id && navigation.navigate('FollowingList', { userId: user.id })}>
              <Text style={styles.statValue}>{user?.following_count ?? 0}</Text>
              <Text style={styles.statLabel}>{t('profile.followText', 'Following')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.bioSection}>
          <View style={styles.displayNameRow}>
            <Text style={styles.displayName}>{displayName}</Text>
            {user?.is_verified && <VerifiedBadge size={16} />}
          </View>
          {user?.bio ? <RichText style={styles.bioText}>{user.bio}</RichText> : null}
          {user?.website ? (
            <TouchableOpacity onPress={() => Linking.openURL(user.website.startsWith('http') ? user.website : 'https://' + user.website)}>
              <Text style={styles.websiteLink}>
                <Ionicons name="link-outline" size={14} /> {user.website.replace(/^https?:\/\//, '')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('ProfileEdit')}>
            <Text style={styles.actionBtnText}>{t('profile.editProfile', 'Profili Düzenle')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('ProfileStats')}>
            <Text style={styles.actionBtnText}>{t('analytics.title', 'İstatistikler')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('ProfileQR')}>
            <Text style={styles.actionBtnText}>{t('profile.shareProfile', 'Profili Paylaş')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionIconBtn} onPress={() => navigation.navigate('UserSuggestions')}>
            <Ionicons name="person-add-outline" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Highlights */}
        <View style={styles.highlightsContainer}>
          <ProfileStoriesHighlights
            userId={user?.id}
            username={user?.username}
            token={token}
            isOwnProfile={true}
            onNavigate={async (type, hl) => {
              if (type === 'archive') navigation.navigate('StoryArchive');
              else if (type === 'highlight' && hl?.id && token) {
                try {
                  const stories = await api.get(`/highlights/${hl.id}/stories`, token);
                  if (Array.isArray(stories) && stories.length > 0) {
                    const feed = [{ user_id: user.id, username: user.username, user_avatar: user.avatar_url, stories }];
                    navigation.navigate('StoryViewer', { feed, startUserIndex: 0 });
                  }
                } catch { }
              }
            }}
          />
        </View>

        {/* Ads (if any) */}
        <View style={{ marginVertical: 10 }}><RewardedAd /></View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity style={[styles.tabItem, activeTab === 'posts' && styles.tabItemActive]} onPress={() => setActiveTab('posts')}>
            <Ionicons name="grid-outline" size={26} color={activeTab === 'posts' ? colors.text : '#666'} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabItem, activeTab === 'reels' && styles.tabItemActive]} onPress={() => setActiveTab('reels')}>
            <Ionicons name="play-circle-outline" size={30} color={activeTab === 'reels' ? colors.text : '#666'} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabItem, activeTab === 'tagged' && styles.tabItemActive]} onPress={() => setActiveTab('tagged')}>
            <Ionicons name="person-circle-outline" size={28} color={activeTab === 'tagged' ? colors.text : '#666'} />
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'posts' && <ProfilePosts />}
          {activeTab === 'reels' && (
            <View style={styles.emptyTab}>
              <Ionicons name="videocam-outline" size={60} color="#444" />
              <Text style={styles.emptyTabText}>{t('dashboard.noContent', 'No Content Yet')}</Text>
            </View>
          )}
          {activeTab === 'tagged' && (
            <View style={styles.emptyTab}>
              <Ionicons name="person-outline" size={60} color="#444" />
              <Text style={styles.emptyTabText}>{t('dashboard.noContent', 'No Content Yet')}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Hamburger Menu Modal */}
      <Modal visible={menuVisible} animationType="slide" transparent={true} onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <Pressable style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <TouchableOpacity style={styles.modalClose} onPress={() => setMenuVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={menuItems}
              keyExtractor={item => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuVisible(false);
                    navigation.navigate(item.screen, item.params);
                  }}
                >
                  <Ionicons name={item.icon} size={24} color={colors.text} style={styles.menuIcon} />
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 50 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerUsername: { fontSize: 20, fontWeight: '700', color: colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerIcon: { padding: 4 },

  content: { paddingTop: 8 },

  // Profile Info
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 },
  avatarContainer: { position: 'relative', marginRight: 24 },
  avatar: { width: 86, height: 86, borderRadius: 43 },
  addStoryBadge: {
    position: 'absolute', right: 0, bottom: 0, width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#0095F6', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.background
  },
  statsContainer: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 13, color: colors.text, marginTop: 2 },

  // Bio
  bioSection: { paddingHorizontal: 16, marginBottom: 16 },
  displayNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  displayName: { fontSize: 14, fontWeight: '700', color: colors.text },
  bioText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  websiteLink: { fontSize: 14, color: '#E0F7FA', marginTop: 4, fontWeight: '500' },

  // Actions Row
  actionsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  actionBtn: { flex: 1, backgroundColor: colors.inputBg || '#262626', paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  actionIconBtn: { backgroundColor: colors.inputBg || '#262626', padding: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center', width: 40 },

  highlightsContainer: { paddingBottom: 10 },

  // Tabs
  tabsContainer: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#262626', height: 50 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: colors.text },

  tabContent: { minHeight: 300 },
  emptyTab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTabText: { color: '#888', marginTop: 16, fontSize: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.background || '#121212', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#333', position: 'relative' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#555', marginBottom: 8 },
  modalClose: { position: 'absolute', right: 16, top: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  menuIcon: { marginRight: 16 },
  menuLabel: { fontSize: 16, color: colors.text },

  // Guest
  guestContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  guestTitle: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: 8 },
  guestSubtitle: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', marginBottom: 24 },
  guestLoginBtn: { backgroundColor: '#8B5CF6', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  guestLoginText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
