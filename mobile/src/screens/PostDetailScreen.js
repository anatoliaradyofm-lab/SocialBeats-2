import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  ScrollView,
  Dimensions,
  ActionSheetIOS,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useReactPostMutation, useSavePostMutation, useSharePostMutation } from '../hooks/useFeedQuery';
import api from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import { getApiUrl } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const getReportReasons = (t) => [
  { value: 'spam', label: t('report.spam') },
  { value: 'harassment', label: t('report.harassment') },
  { value: 'hate_speech', label: t('report.hateSpeech') },
  { value: 'violence', label: t('report.violence') },
  { value: 'nudity', label: t('report.nudity') },
  { value: 'false_info', label: t('report.falseInfo') },
  { value: 'impersonation', label: t('report.impersonation') },
  { value: 'copyright', label: t('report.copyright') },
  { value: 'other', label: t('report.other') },
];

const mediaUri = (uri) => {
  if (!uri) return null;
  if (uri.startsWith('http')) return uri;
  const base = (getApiUrl() || '').replace(/\/api\/?$/, '');
  return uri.startsWith('/') ? `${base}${uri}` : `${base}/api/${uri}`;
};

const formatTime = (isoStr, t) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return t('notifications.justNow');
  if (diff < 3600) return t('notifications.minutesAgo', { count: Math.floor(diff / 60) });
  if (diff < 86400) return t('notifications.hoursAgo', { count: Math.floor(diff / 3600) });
  if (diff < 604800) return t('notifications.daysAgo', { count: Math.floor(diff / 86400) });
  return d.toLocaleDateString();
};

export default function PostDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { postId } = route.params || {};
  const { token, user } = useAuth();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const reactMutation = useReactPostMutation(token);
  const saveMutation = useSavePostMutation(token);
  const shareMutation = useSharePostMutation(token);

  const loadPost = async () => {
    if (!postId || !token) return;
    try {
      const [p, c, related] = await Promise.all([
        api.get(`/social/posts/${postId}`, token),
        api.get(`/social/posts/${postId}/comments?page=1&limit=50`, token),
        api.get(`/social/posts/${postId}/related?limit=5`, token).catch(() => []),
      ]);
      setPost(p);
      setComments(Array.isArray(c) ? c : []);
      setRelatedPosts(Array.isArray(related) ? related : []);
    } catch {
      setPost(null);
      setComments([]);
      setRelatedPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPost();
  }, [postId]);

  const handleLike = async () => {
    if (!token || !postId) return;
    try {
      await reactMutation.mutateAsync({ postId });
      setPost((p) => {
        if (!p) return null;
        const isHeart = p.user_reaction === 'heart';
        return {
          ...p,
          user_reaction: isHeart ? null : 'heart',
          reactions: { ...p.reactions, heart: Math.max(0, (p.reactions?.heart || 0) + (isHeart ? -1 : 1)) }
        };
      });
    } catch { }
  };

  const handleSave = async () => {
    if (!token || !postId) return;
    try {
      await saveMutation.mutateAsync({ postId });
      setPost((p) => (p ? { ...p, is_saved: !p.is_saved } : null));
    } catch { }
  };

  const handleShare = async () => {
    if (!token || !postId) return;
    try {
      await shareMutation.mutateAsync({ postId });
      setPost((p) => (p ? { ...p, shares_count: (p.shares_count || 0) + 1 } : null));
    } catch { }
  };

  const handleRepost = async () => {
    if (!token || !post?.id) return;
    try {
      await api.post(`/social/posts/${post.id}/repost`, {}, token);
      Alert.alert(t('common.success'), t('postDetail.repostSuccess'));
    } catch (e) {
      Alert.alert(t('common.error'), e?.data?.detail || t('common.operationFailed'));
    }
  };

  const submitComment = async () => {
    if (!newComment.trim() || !token || !postId) return;
    setSubmitting(true);
    try {
      const res = await api.post(
        `/social/posts/${postId}/comments`,
        { content: newComment.trim(), parent_id: replyingTo || undefined },
        token
      );
      setComments((prev) => [res, ...prev]);
      setNewComment('');
      setReplyingTo(null);
      setPost((p) => (p ? { ...p, comments_count: (p.comments_count || 0) + 1 } : null));
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPost();
  };

  const showPostMenu = () => {
    const isOwner = post?.user_id === user?.id;
    const options = isOwner
      ? [t('postDetail.edit'), t('postDetail.archive'), t('postDetail.pin'), t('postDetail.hide'), t('postDetail.delete'), t('common.cancel')]
      : [t('common.report'), t('common.cancel')];
    const destructiveIndex = isOwner ? 4 : -1;
    const cancelIndex = options.length - 1;

    const runAction = async (action) => {
      try {
        if (action === t('postDetail.delete')) {
          Alert.alert(t('postDetail.deletePost'), t('postDetail.deletePostConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('postDetail.delete'), style: 'destructive', onPress: async () => {
                await api.delete(`/social/posts/${postId}`, token);
                navigation.goBack();
              }
            },
          ]);
        } else if (action === t('postDetail.archive')) {
          await api.post(`/social/posts/${postId}/archive`, {}, token);
          setPost((p) => (p ? { ...p, is_archived: true } : null));
        } else if (action === t('postDetail.hide')) {
          await api.post(`/social/posts/${postId}/hide`, {}, token);
          navigation.goBack();
        } else if (action === t('postDetail.pin')) {
          await api.post(`/social/posts/${postId}/pin`, {}, token);
          setPost((p) => (p ? { ...p, is_pinned: true } : null));
        } else if (action === t('postDetail.edit')) {
          navigation.navigate('EditPost', { postId, initialContent: post?.caption || post?.content || '', initialMedia: post?.media_urls });
        }
      } catch (e) {
        Alert.alert(t('common.error'), e?.data?.detail || t('postDetail.updateFailed'));
      }
    };

    const handleReport = () => {
      setShowReport(true);
    };

    const onSelect = (i) => {
      if (i === cancelIndex) return;
      if (options[i] === t('common.report')) {
        handleReport();
      } else {
        runAction(options[i]);
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, destructiveButtonIndex: destructiveIndex >= 0 ? destructiveIndex : undefined, cancelButtonIndex: cancelIndex },
        onSelect
      );
    } else {
      Alert.alert(t('postDetail.options'), undefined, [
        ...(isOwner ? [
          { text: t('postDetail.edit'), onPress: () => runAction(t('postDetail.edit')) },
          { text: t('postDetail.archive'), onPress: () => runAction(t('postDetail.archive')) },
          { text: t('postDetail.pin'), onPress: () => runAction(t('postDetail.pin')) },
          { text: t('postDetail.hide'), onPress: () => runAction(t('postDetail.hide')) },
          { text: t('postDetail.delete'), style: 'destructive', onPress: () => runAction(t('postDetail.delete')) },
        ] : [
          { text: t('common.report'), onPress: handleReport },
        ]),
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    }
  };

  if (loading && !post) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backText}>{t('postDetail.back')}</Text></TouchableOpacity>
        </View>
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backText}>{t('postDetail.back')}</Text></TouchableOpacity>
        </View>
        <Text style={styles.empty}>{t('postDetail.postNotFound')}</Text>
      </View>
    );
  }

  const username = post.username || post.user_id || 'unknown';
  const avatar = post.user_avatar || `https://i.pravatar.cc/50?u=${username}`;
  const displayName = post.user_display_name || username;
  const content = post.caption || post.content || '';
  const mediaList = post.media_urls?.length ? post.media_urls : (post.media_url ? [post.media_url] : []);
  const reactions = post.reactions || {};
  const likeCount = (reactions.heart || 0) + (reactions.fire || 0) + (reactions.applause || 0) || 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backText}>{t('postDetail.back')}</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>{t('postDetail.title')}</Text>
        {user && (
          <TouchableOpacity onPress={showPostMenu}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={comments}
        ListHeaderComponent={
          <>
            <View style={styles.post}>
              <View style={styles.postHeader}>
                <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { username })}>
                  <Image source={{ uri: avatar }} style={styles.avatar} />
                </TouchableOpacity>
                <View style={styles.postHeaderText}>
                  <Text style={styles.username}>@{username}</Text>
                  <Text style={styles.displayName}>{displayName}</Text>
                </View>
              </View>
              {content ? <Text style={styles.content}>{content}</Text> : null}
              {mediaList.length > 0 && (
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  style={[styles.carousel, { width: SCREEN_WIDTH - 32 }]}
                  contentContainerStyle={{ width: (SCREEN_WIDTH - 32) * mediaList.length }}
                >
                  {mediaList.map((m, i) => (
                    <Image key={i} source={{ uri: mediaUri(m) }} style={[styles.media, { width: SCREEN_WIDTH - 32 }]} resizeMode="cover" />
                  ))}
                </ScrollView>
              )}
              {(post.views_count > 0 || post.shares_count > 0) && (
                <Text style={styles.views}>{[post.views_count > 0 && t('postDetail.views', { count: post.views_count }), post.shares_count > 0 && t('postDetail.shares', { count: post.shares_count })].filter(Boolean).join(' • ')}</Text>
              )}
              <View style={styles.postFooter}>
                <TouchableOpacity onPress={handleLike} style={styles.footerBtn}>
                  <Text style={styles.footerIcon}>{post.user_reaction === 'heart' ? '❤️' : '🤍'}</Text>
                  <Text style={styles.footerText}>{likeCount}</Text>
                </TouchableOpacity>
                <View style={styles.footerBtn}>
                  <Text style={styles.footerIcon}>💬</Text>
                  <Text style={styles.footerText}>{post.comments_count || 0}</Text>
                </View>
                <TouchableOpacity onPress={handleRepost} style={styles.footerBtn}>
                  <Ionicons name="repeat-outline" size={22} color="#9CA3AF" />
                  <Text style={styles.footerText}>{t('postDetail.repost')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleShare} style={styles.footerBtn}>
                  <Ionicons name="share-outline" size={18} color="#9CA3AF" />
                  <Text style={styles.footerText}>{post.shares_count || 0}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} style={styles.footerBtn}>
                  <Ionicons name={post.is_saved ? 'bookmark' : 'bookmark-outline'} size={18} color={post.is_saved ? '#8B5CF6' : '#9CA3AF'} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.commentsTitle}>{t('postDetail.comments')}</Text>
            {relatedPosts.length > 0 && (
              <>
                <Text style={styles.relatedTitle}>{t('postDetail.relatedPosts')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relatedRow}>
                  {relatedPosts.map((rp) => (
                    <TouchableOpacity
                      key={rp.id}
                      style={styles.relatedCard}
                      onPress={() => navigation.push('PostDetail', { postId: rp.id })}
                    >
                      {rp.media_urls?.[0] || rp.media_url ? (
                        <Image source={{ uri: mediaUri(rp.media_urls?.[0] || rp.media_url) }} style={styles.relatedImg} resizeMode="cover" />
                      ) : (
                        <View style={[styles.relatedImg, styles.relatedPlaceholder]}>
                          <Text style={styles.relatedPlaceholderText} numberOfLines={2}>{(rp.caption || rp.content || '').slice(0, 30)}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
          </>
        }
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View>
            <View style={styles.comment}>
              <Image source={{ uri: item.user_avatar || `https://i.pravatar.cc/40?u=${item.username}` }} style={styles.commentAvatar} />
              <View style={styles.commentBody}>
                <Text style={styles.commentUser}>@{item.username}</Text>
                <Text style={styles.commentText}>{item.content}</Text>
                {item.created_at && <Text style={styles.commentTime}>{formatTime(item.created_at, t)}</Text>}
                <TouchableOpacity onPress={() => setReplyingTo(item.id)} style={styles.replyBtn}>
                  <Text style={styles.replyText}>{t('postDetail.reply')}</Text>
                </TouchableOpacity>
              </View>
            </View>
            {(item.replies || []).map((r) => (
              <View key={r.id} style={[styles.comment, styles.commentReply]}>
                <Image source={{ uri: r.user_avatar || `https://i.pravatar.cc/40?u=${r.username}` }} style={styles.commentAvatar} />
                <View style={styles.commentBody}>
                  <Text style={styles.commentUser}>@{r.username}</Text>
                  <Text style={styles.commentText}>{r.content}</Text>
                  {r.created_at && <Text style={styles.commentTime}>{formatTime(r.created_at, t)}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
        ListEmptyComponent={<Text style={styles.noComments}>{t('postDetail.noComments')}</Text>}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      />
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 16 }]}>
        <TextInput
          style={styles.commentInput}
          placeholder={replyingTo ? t('postDetail.writeReply') : t('postDetail.writeComment')}
          placeholderTextColor="#6B7280"
          value={newComment}
          onChangeText={setNewComment}
          multiline
          maxLength={500}
        />
        <TouchableOpacity style={[styles.sendBtn, (!newComment.trim() || submitting) && styles.sendDisabled]} onPress={submitComment} disabled={!newComment.trim() || submitting}>
          {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
        </TouchableOpacity>
      </View>

      <Modal visible={showReport} transparent animationType="slide">
        <TouchableOpacity style={styles.reportModalOverlay} activeOpacity={1} onPress={() => setShowReport(false)}>
          <View style={[styles.reportModal, { paddingBottom: insets.bottom + 24 }]} onStartShouldSetResponder={() => true}>
            <Text style={styles.reportTitle}>{t('postDetail.reportPost')}</Text>
            <Text style={styles.reportSubtitle}>{t('profile.reportWhy')}</Text>
            {getReportReasons(t).map((r) => (
              <TouchableOpacity
                key={r.value}
                style={styles.reportOption}
                onPress={async () => {
                  try {
                    await api.post('/reports', { reported_id: post.id, report_type: 'post', reason: r.value }, token);
                    setShowReport(false);
                    Alert.alert(t('common.success'), t('profile.reportReceived'));
                  } catch (e) {
                    Alert.alert(t('common.error'), e?.data?.detail || t('profile.reportFailed'));
                  }
                }}
              >
                <Text style={styles.reportOptionText}>{r.label}</Text>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.reportCancel} onPress={() => setShowReport(false)}>
              <Text style={styles.reportCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  backText: { color: colors.accent, fontSize: 16 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginLeft: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#9CA3AF', textAlign: 'center', padding: 40 },
  post: { backgroundColor: '#1F2937', padding: 16, margin: 16, borderRadius: 12 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  postHeaderText: { flex: 1 },
  username: { fontSize: 15, fontWeight: '600', color: colors.text },
  displayName: { fontSize: 13, color: '#9CA3AF' },
  content: { fontSize: 15, color: colors.text, marginBottom: 8 },
  media: { height: 280, borderRadius: 8, marginBottom: 8 },
  carousel: { height: 280, marginBottom: 8, borderRadius: 8, overflow: 'hidden' },
  relatedTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginHorizontal: 16, marginTop: 20, marginBottom: 12 },
  relatedRow: { marginBottom: 16 },
  relatedCard: { width: 120, height: 120, marginLeft: 16, borderRadius: 8, overflow: 'hidden' },
  relatedImg: { width: '100%', height: '100%' },
  relatedPlaceholder: { backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' },
  relatedPlaceholderText: { color: '#9CA3AF', fontSize: 12 },
  views: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  postFooter: { flexDirection: 'row', gap: 24, marginTop: 8 },
  footerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerIcon: { fontSize: 18 },
  footerText: { fontSize: 13, color: '#9CA3AF' },
  commentsTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginHorizontal: 16, marginTop: 16, marginBottom: 12 },
  comment: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  commentReply: { marginLeft: 24 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
  commentBody: { flex: 1 },
  commentUser: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  commentText: { fontSize: 14, color: '#9CA3AF' },
  commentTime: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  replyBtn: { marginTop: 4 },
  replyText: { fontSize: 12, color: colors.accent },
  noComments: { color: '#6B7280', textAlign: 'center', padding: 24 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 16, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: '#1F2937', gap: 12 },
  commentInput: { flex: 1, backgroundColor: '#1F2937', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: colors.text, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center' },
  sendDisabled: { opacity: 0.5 },
  reportModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  reportModal: { backgroundColor: '#1F2937', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' },
  reportTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
  reportSubtitle: { fontSize: 14, color: '#9CA3AF', marginBottom: 20 },
  reportOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#374151', marginBottom: 8 },
  reportOptionText: { fontSize: 16, color: colors.text },
  reportCancel: { marginTop: 16, padding: 14, alignItems: 'center', borderRadius: 10, backgroundColor: '#374151' },
  reportCancelText: { color: colors.text, fontSize: 16 },
});
