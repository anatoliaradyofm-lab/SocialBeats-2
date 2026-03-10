import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform, Modal, Alert, FlatList, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video } from 'expo-av';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';
import ShareSheet from '../components/ShareSheet';

const { width: SW } = Dimensions.get('window');
const REACTIONS = ['❤️', '🔥', '👏', '😂', '😮', '😢'];

function MediaCarousel({ urls, colors }) {
  const [activeIdx, setActiveIdx] = useState(0);
  if (!urls || urls.length === 0) return null;

  const isVideo = (url) => /\.(mp4|mov|webm)(\?|$)/i.test(url);

  return (
    <View>
      <FlatList
        horizontal
        pagingEnabled
        data={urls}
        onMomentumScrollEnd={(e) => setActiveIdx(Math.round(e.nativeEvent.contentOffset.x / SW))}
        renderItem={({ item }) =>
          isVideo(item) ? (
            <Video source={{ uri: item }} style={styles.postMedia} useNativeControls resizeMode="contain" shouldPlay={false} />
          ) : (
            <Image source={{ uri: item }} style={styles.postMedia} resizeMode="cover" />
          )
        }
        keyExtractor={(_, i) => `${i}`}
        showsHorizontalScrollIndicator={false}
      />
      {urls.length > 1 && (
        <View style={styles.carouselDots}>
          {urls.map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === activeIdx ? BRAND.primary : 'rgba(255,255,255,0.5)' }]} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function PostDetailScreen({ route, navigation }) {
  const { postId } = route.params;
  const { user, token } = useAuth();
  const { colors } = useTheme();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [translatedPost, setTranslatedPost] = useState(null);
  const [translatingPost, setTranslatingPost] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [translatedComments, setTranslatedComments] = useState({});
  const [showEdit, setShowEdit] = useState(false);
  const [editText, setEditText] = useState('');
  const [relatedPosts, setRelatedPosts] = useState([]);

  const fetchPost = useCallback(async () => {
    try {
      const res = await api.get(`/social/posts/${postId}`, token);
      const p = res.post || res;
      setPost(p);
      setLiked(!!p.user_reaction || p.is_liked);
      setSaved(p.is_saved || false);
      setEditText(p.content || '');
      const c = await api.get(`/social/posts/${postId}/comments`, token).catch(() => ({ comments: [] }));
      setComments(c.comments || c || []);
      api.get(`/social/posts/${postId}/related?limit=5`, token)
        .then(r => setRelatedPosts(Array.isArray(r) ? r : r.posts || []))
        .catch(() => {});
    } catch {}
  }, [postId, token]);

  useEffect(() => { fetchPost(); }, [fetchPost]);

  const handleReact = async (emoji) => {
    try {
      await api.post(`/social/posts/${postId}/react`, { emoji }, token);
      setLiked(!liked);
      setShowReactions(false);
    } catch {}
  };

  const handleSave = async () => {
    try { await api.post(`/social/posts/${postId}/save`, {}, token); setSaved(!saved); } catch {}
  };

  const handleArchive = async () => {
    try { await api.post(`/social/posts/${postId}/archive`, {}, token); setShowMore(false); Alert.alert('Arşivlendi'); } catch {}
  };

  const handlePin = async () => {
    try { await api.post(`/social/posts/${postId}/pin`, {}, token); setShowMore(false); Alert.alert('Sabitlendi'); } catch {}
  };

  const handleHide = async () => {
    try { await api.post(`/social/posts/${postId}/hide`, {}, token); setShowMore(false); navigation.goBack(); } catch {}
  };

  const handleDelete = async () => {
    Alert.alert('Gönderiyi Sil', 'Bu işlem geri alınamaz. Emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        try { await api.delete(`/social/posts/${postId}`, token); navigation.goBack(); } catch {}
      }},
    ]);
  };

  const handleEdit = async () => {
    if (!editText.trim()) return;
    try {
      await api.put(`/social/posts/${postId}`, { content: editText.trim() }, token);
      setPost(prev => ({ ...prev, content: editText.trim() }));
      setShowEdit(false);
      Alert.alert('Güncellendi');
    } catch { Alert.alert('Hata', 'Gönderi güncellenemedi'); }
  };

  const sendComment = async () => {
    if (!commentText.trim()) return;
    try {
      const body = { content: commentText.trim() };
      if (replyTo) body.parent_id = replyTo.id;
      await api.post(`/social/posts/${postId}/comments`, body, token);
      setCommentText('');
      setReplyTo(null);
      fetchPost();
    } catch {}
  };

  const isOwner = post?.user_id === user?.id;
  const allMedia = post?.media_urls?.length > 0 ? post.media_urls : (post?.media_url ? [post.media_url] : []);

  if (!post) return <View style={[styles.container, { backgroundColor: colors.background }]} />;

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Gönderi</Text>
        <TouchableOpacity onPress={() => setShowMore(true)}>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* User info */}
        <TouchableOpacity style={styles.postUser} onPress={() => navigation.navigate('UserProfile', { userId: post.user?.id || post.user_id })}>
          <View style={[styles.postAvatar, { backgroundColor: colors.surfaceElevated }]}>
            {(post.user?.avatar_url || post.user_avatar) ? <Image source={{ uri: post.user?.avatar_url || post.user_avatar }} style={styles.postAvatar} /> : <Ionicons name="person" size={16} color={BRAND.primaryLight} />}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{post.user?.display_name || post.user_display_name || post.username || ''}</Text>
              {(post.is_verified || post.user?.is_verified) && <Ionicons name="checkmark-circle" size={14} color={BRAND.primary} />}
              {post.is_pinned && <Ionicons name="pin" size={12} color={BRAND.accent} />}
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 11 }}>@{post.username || post.user?.username || ''} · {post.created_ago || ''}</Text>
          </View>
        </TouchableOpacity>

        {/* Media */}
        {allMedia.length > 0 && <MediaCarousel urls={allMedia} colors={colors} />}

        {/* Content */}
        {post.content ? (
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{post.content}</Text>
            {translatedPost && (
              <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: colors.border }}>
                <Text style={{ color: BRAND.accent, fontSize: 12, fontWeight: '600', marginBottom: 2 }}>Çeviri:</Text>
                <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18 }}>{translatedPost}</Text>
              </View>
            )}
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}
              onPress={async () => {
                if (translatedPost) { setTranslatedPost(null); return; }
                setTranslatingPost(true);
                try {
                  const res = await api.post('/translate', { text: post.content, source_language: 'auto', target_language: 'tr', content_type: 'post' }, token);
                  setTranslatedPost(res.translated_text || post.content);
                } catch { setTranslatedPost(null); }
                setTranslatingPost(false);
              }}
            >
              <Ionicons name="language" size={14} color={BRAND.accent} />
              <Text style={{ color: BRAND.accent, fontSize: 12 }}>{translatingPost ? 'Çevriliyor...' : translatedPost ? 'Orijinal göster' : 'Çeviriyi göster'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Music track */}
        {post.music_track_id && (
          <View style={[styles.musicTag, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="musical-note" size={14} color={BRAND.accent} />
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>Müzik ekli</Text>
          </View>
        )}

        {/* Location */}
        {(post.location || post.location_name) && (
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 4 }}
            onPress={() => navigation.navigate('MapView', {
              locationName: post.location_name || post.location,
              latitude: post.latitude || post.location_lat,
              longitude: post.longitude || post.location_lon,
            })}
          >
            <Ionicons name="location" size={12} color={BRAND.pink} />
            <Text style={{ color: BRAND.pink, fontSize: 12 }}>{post.location_name || post.location}</Text>
          </TouchableOpacity>
        )}

        {/* Hashtags */}
        {post.hashtags?.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 8, gap: 6 }}>
            {post.hashtags.map((h, i) => (
              <Text key={i} style={{ color: BRAND.primary, fontSize: 13 }}>#{h}</Text>
            ))}
          </View>
        )}

        {/* Stats row */}
        <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {Object.values(post.reactions || {}).reduce((a, b) => a + b, 0) || post.likes || 0} beğeni
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{comments.length || post.comments_count || 0} yorum</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{post.shares_count || post.shares || 0} paylaşım</Text>
          {(post.views_count || post.view_count) > 0 && <Text style={{ color: colors.textMuted, fontSize: 12 }}>{post.views_count || post.view_count} görüntüleme</Text>}
        </View>

        {/* Actions */}
        <View style={[styles.actions, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleReact('❤️')} onLongPress={() => setShowReactions(true)}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? BRAND.pink : colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowShareSheet(true)}>
            <Ionicons name="paper-plane-outline" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={handleSave}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? BRAND.accent : colors.text} />
          </TouchableOpacity>
        </View>

        {/* Comments */}
        <View style={{ paddingHorizontal: 16 }}>
          {comments.map((c, i) => (
            <View key={c.id || i} style={[styles.comment, { borderBottomColor: colors.border }]}>
              <View style={[styles.commentAvatar, { backgroundColor: colors.surfaceElevated }]}>
                {c.user?.avatar_url ? <Image source={{ uri: c.user.avatar_url }} style={styles.commentAvatar} /> : <Ionicons name="person" size={12} color={BRAND.primaryLight} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 13 }}>
                  <Text style={{ fontWeight: '600' }}>{c.user?.username || c.username || ''} </Text>{c.content}
                </Text>
                {translatedComments[c.id] && (
                  <View style={{ marginTop: 4, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: colors.border }}>
                    <Text style={{ color: BRAND.accent, fontSize: 11, fontWeight: '600' }}>Çeviri:</Text>
                    <Text style={{ color: colors.text, fontSize: 12 }}>{translatedComments[c.id]}</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>{c.created_ago || c.created_at?.substring(0, 10) || ''}</Text>
                  <TouchableOpacity onPress={() => setReplyTo(c)}>
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>Yanıtla</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => api.post(`/social/comments/${c.id}/like`, {}, token).catch(() => {})}>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>♡ {c.likes || c.likes_count || 0}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={async () => {
                    if (translatedComments[c.id]) { setTranslatedComments(prev => { const n = {...prev}; delete n[c.id]; return n; }); return; }
                    try {
                      const res = await api.post('/translate', { text: c.content, source_language: 'auto', target_language: 'tr', content_type: 'comment' }, token);
                      setTranslatedComments(prev => ({ ...prev, [c.id]: res.translated_text }));
                    } catch {}
                  }}>
                    <Text style={{ color: BRAND.accent, fontSize: 11 }}>{translatedComments[c.id] ? 'Orijinal' : 'Çevir'}</Text>
                  </TouchableOpacity>
                </View>
                {c.replies?.map((r, j) => (
                  <View key={j} style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
                    <View style={[styles.replyAvatar, { backgroundColor: colors.surfaceElevated }]}>
                      {r.user?.avatar_url ? <Image source={{ uri: r.user.avatar_url }} style={styles.replyAvatar} /> : <Ionicons name="person" size={10} color={BRAND.primaryLight} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 12 }}>
                      <Text style={{ fontWeight: '600' }}>{r.user?.username || ''} </Text>{r.content}
                    </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2 }}>{r.created_ago || ''}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', paddingHorizontal: 16, marginBottom: 12 }}>İlgili Gönderiler</Text>
            <FlatList
              horizontal
              data={relatedPosts}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.relatedCard, { backgroundColor: colors.surfaceElevated }]} onPress={() => navigation.push('PostDetail', { postId: item.id })}>
                  {item.media_urls?.[0] ? (
                    <Image source={{ uri: item.media_urls[0] }} style={styles.relatedMedia} />
                  ) : (
                    <View style={[styles.relatedMedia, { justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="document-text" size={20} color={colors.textMuted} />
                    </View>
                  )}
                  <Text style={{ color: colors.text, fontSize: 12, padding: 8 }} numberOfLines={2}>{item.content}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 16 }}
              showsHorizontalScrollIndicator={false}
            />
          </View>
        )}
      </ScrollView>

      {/* Comment input */}
      <View style={[styles.commentBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {replyTo && (
          <View style={styles.replyBar}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>Yanıtlanıyor: @{replyTo.user?.username || replyTo.username}</Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}><Ionicons name="close" size={16} color={colors.textMuted} /></TouchableOpacity>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[styles.commentInput, { backgroundColor: colors.inputBg || colors.surfaceElevated }]}>
            <TextInput style={{ flex: 1, color: colors.text, fontSize: 13 }} placeholder="Yorum ekle..." placeholderTextColor={colors.textMuted} value={commentText} onChangeText={setCommentText} />
          </View>
          <TouchableOpacity onPress={sendComment} style={{ padding: 8 }}>
            <Ionicons name="send" size={20} color={BRAND.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Reactions popup */}
      {showReactions && (
        <TouchableOpacity style={styles.reactionsOverlay} onPress={() => setShowReactions(false)} activeOpacity={1}>
          <View style={[styles.reactionsBar, { backgroundColor: colors.surface }]}>
            {REACTIONS.map(e => (
              <TouchableOpacity key={e} style={styles.reactionBtn} onPress={() => handleReact(e)}>
                <Text style={{ fontSize: 26 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      )}

      {/* More options */}
      <Modal visible={showMore} transparent animationType="slide" onRequestClose={() => setShowMore(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            {[
              ...(isOwner ? [{ icon: 'create-outline', label: 'Düzenle', action: () => { setShowMore(false); setShowEdit(true); } }] : []),
              { icon: 'bookmark-outline', label: saved ? 'Kayıttan Çıkar' : 'Kaydet', action: () => { handleSave(); setShowMore(false); } },
              ...(isOwner ? [{ icon: 'archive-outline', label: 'Arşivle', action: handleArchive }] : []),
              ...(isOwner ? [{ icon: 'pin-outline', label: post.is_pinned ? 'Sabitlemeyi Kaldır' : 'Sabitle', action: handlePin }] : []),
              ...(isOwner ? [{ icon: 'eye-off-outline', label: 'Gizle', action: handleHide }] : []),
              { icon: 'flag-outline', label: 'Rapor Et', action: () => { setShowMore(false); navigation.navigate('Report', { targetId: postId, targetType: 'post' }); } },
              ...(isOwner ? [{ icon: 'trash-outline', label: 'Sil', action: handleDelete, danger: true }] : []),
            ].map((item, i) => (
              <TouchableOpacity key={i} style={[styles.modalRow, { borderBottomColor: colors.border }]} onPress={item.action}>
                <Ionicons name={item.icon} size={20} color={item.danger ? '#EF4444' : colors.text} />
                <Text style={{ color: item.danger ? '#EF4444' : colors.text, fontSize: 15, marginLeft: 12 }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowMore(false)}>
              <Text style={{ color: colors.textMuted }}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={showEdit} transparent animationType="fade" onRequestClose={() => setShowEdit(false)}>
        <View style={styles.editOverlay}>
          <View style={[styles.editContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.editTitle, { color: colors.text }]}>Gönderiyi Düzenle</Text>
            <TextInput
              style={[styles.editInput, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border }]}
              value={editText}
              onChangeText={setEditText}
              multiline
              maxLength={2200}
              textAlignVertical="top"
            />
            <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 12 }}>{2200 - editText.length} karakter kaldı</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => setShowEdit(false)}>
                <Text style={{ color: colors.textSecondary }}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.editBtn, { backgroundColor: BRAND.primary }]} onPress={handleEdit}>
                <Text style={{ color: '#FFF', fontWeight: '600' }}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ShareSheet
        visible={showShareSheet}
        onClose={() => { setShowShareSheet(false); try { api.post(`/social/posts/${postId}/share`, {}, token); } catch {} }}
        type="post"
        id={postId}
        title={post?.content?.slice(0, 60)}
        description={post?.user?.display_name || post?.user?.username}
        imageUrl={post?.media_urls?.[0]}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  postUser: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  postAvatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  postMedia: { width: SW, aspectRatio: 1 },
  carouselDots: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingVertical: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  musicTag: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, padding: 8, borderRadius: 10, gap: 6, marginBottom: 4 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 16, borderTopWidth: 0.5 },
  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 0.5, borderBottomWidth: 0.5, gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center' },
  comment: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 0.5, gap: 10 },
  commentAvatar: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  replyAvatar: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  commentBar: { paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 0.5 },
  replyBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  commentInput: { flex: 1, borderRadius: 20, paddingHorizontal: 14, height: 38 },
  reactionsOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  reactionsBar: { flexDirection: 'row', borderRadius: 28, paddingHorizontal: 8, paddingVertical: 6, gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  reactionBtn: { padding: 6 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0.5 },
  modalClose: { alignItems: 'center', paddingTop: 16 },
  editOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  editContent: { width: '90%', borderRadius: 20, padding: 24 },
  editTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  editInput: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 14, lineHeight: 20, minHeight: 120, marginBottom: 4 },
  editBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  relatedCard: { width: 150, borderRadius: 14, overflow: 'hidden' },
  relatedMedia: { width: 150, height: 120, backgroundColor: 'rgba(0,0,0,0.05)' },
});
