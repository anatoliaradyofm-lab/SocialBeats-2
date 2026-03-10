import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, FlatList,
  StyleSheet, Dimensions, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

const { width: SW, height: SH } = Dimensions.get('window');

function ReelItem({ reel, colors }) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 4000, useNativeDriver: true })
    );
    spin.start();
    return () => spin.stop();
  }, [spinAnim]);

  const rotation = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[styles.reelItem, { backgroundColor: '#000' }]}>
      {reel.media_url ? (
        <Image source={{ uri: reel.media_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="play-circle" size={64} color={BRAND.primaryLight} />
        </View>
      )}
      <View style={styles.reelOverlay} />

      {/* Right actions */}
      <View style={styles.reelActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setLiked(!liked)}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={28} color={liked ? BRAND.pink : '#FFF'} />
          <Text style={styles.actionLabel}>{(reel.likes || 0) + (liked ? 1 : 0)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={24} color="#FFF" />
          <Text style={styles.actionLabel}>{reel.comments_count || 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="paper-plane-outline" size={24} color="#FFF" />
          <Text style={styles.actionLabel}>Paylaş</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setSaved(!saved)}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={24} color={saved ? BRAND.accent : '#FFF'} />
        </TouchableOpacity>
        <Animated.View style={[styles.discWrap, { transform: [{ rotate: rotation }] }]}>
          <View style={[styles.disc, { backgroundColor: colors.card }]}>
            {reel.thumbnail ? (
              <Image source={{ uri: reel.thumbnail }} style={styles.disc} />
            ) : (
              <Ionicons name="musical-note" size={14} color={BRAND.primaryLight} />
            )}
          </View>
        </Animated.View>
      </View>

      {/* Bottom info */}
      <View style={styles.reelInfo}>
        <View style={styles.reelUserRow}>
          <View style={[styles.reelAvatar, { backgroundColor: colors.card }]}>
            {reel.user_avatar ? <Image source={{ uri: reel.user_avatar }} style={styles.reelAvatar} /> : <Ionicons name="person" size={14} color="#FFF" />}
          </View>
          <Text style={styles.reelUsername}>@{reel.username || 'user'}</Text>
          <TouchableOpacity style={styles.reelFollowBtn}>
            <Text style={styles.reelFollowText}>Takip Et</Text>
          </TouchableOpacity>
        </View>
        {reel.description ? <Text style={styles.reelDesc} numberOfLines={2}>{reel.description}</Text> : null}
        <View style={styles.reelMusicRow}>
          <Ionicons name="musical-note" size={12} color="#FFF" />
          <Text style={styles.reelMusicText} numberOfLines={1}>{reel.music_title || 'Orijinal Ses'}</Text>
        </View>
      </View>
    </View>
  );
}

export default function ReelsScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const [reels, setReels] = useState([]);

  const fetchReels = useCallback(async () => {
    try {
      const res = await api.get('/reels/feed', token);
      setReels(res.reels || res || []);
    } catch { setReels([]); }
  }, [token]);

  useEffect(() => { fetchReels(); }, [fetchReels]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={styles.reelHeader}>
        <Text style={styles.reelHeaderTitle}>Sosyal</Text>
      </View>
      <FlatList
        data={reels.length > 0 ? reels : [{ id: 'placeholder', description: 'Henüz paylaşım yok' }]}
        renderItem={({ item }) => <ReelItem reel={item} colors={colors} />}
        keyExtractor={(item, i) => item.id || `${i}`}
        pagingEnabled
        snapToInterval={SH}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  reelItem: { width: SW, height: SH },
  reelOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },

  reelHeader: { position: 'absolute', top: 50, left: 16, zIndex: 10 },
  reelHeaderTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },

  reelActions: { position: 'absolute', right: 12, bottom: 120, alignItems: 'center', gap: 20 },
  actionBtn: { alignItems: 'center' },
  actionLabel: { color: '#FFF', fontSize: 11, marginTop: 3 },

  discWrap: { marginTop: 8 },
  disc: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 2, borderColor: BRAND.primary },

  reelInfo: { position: 'absolute', bottom: 70, left: 16, right: 70 },
  reelUserRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reelAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  reelUsername: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  reelFollowBtn: { borderWidth: 1.5, borderColor: BRAND.primary, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4 },
  reelFollowText: { color: BRAND.primaryLight, fontSize: 12, fontWeight: '600' },
  reelDesc: { color: '#FFF', fontSize: 13, marginTop: 8, lineHeight: 18 },
  reelMusicRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  reelMusicText: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
});
