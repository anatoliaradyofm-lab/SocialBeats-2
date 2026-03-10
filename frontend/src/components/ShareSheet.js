import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Image, TextInput,
  StyleSheet, Share, Linking, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import BottomSheet from './ui/BottomSheet';
import api from '../services/api';
import haptic from '../utils/haptics';

const APP_SCHEME = 'socialbeats://';
const WEB_BASE = 'https://socialbeats.app';

const PLATFORMS = [
  { id: 'instagram_story', icon: 'logo-instagram', label: 'Hikaye', color: '#E4405F', section: 'social' },
  { id: 'instagram_post', icon: 'logo-instagram', label: 'Gönderi', color: '#C13584', section: 'social' },
  { id: 'whatsapp', icon: 'logo-whatsapp', label: 'WhatsApp', color: '#25D366', section: 'social' },
  { id: 'twitter', icon: 'logo-twitter', label: 'X / Twitter', color: '#000000', section: 'social' },
  { id: 'facebook', icon: 'logo-facebook', label: 'Facebook', color: '#1877F2', section: 'social' },
  { id: 'telegram', icon: 'paper-plane', label: 'Telegram', color: '#26A5E4', section: 'social' },
  { id: 'message', icon: 'chatbubble', label: 'Mesaj', color: BRAND.primary, section: 'app' },
  { id: 'copy', icon: 'copy', label: 'Kopyala', color: '#71717A', section: 'other' },
  { id: 'more', icon: 'share-social', label: 'Diğer', color: '#3B82F6', section: 'other' },
];

function buildShareUrl(type, id) {
  if (!type || !id) return WEB_BASE;
  const paths = { post: `/post/${id}`, profile: `/@${id}`, playlist: `/playlist/${id}`, track: `/track/${id}`, story: `/story/${id}` };
  return `${WEB_BASE}${paths[type] || `/${type}/${id}`}`;
}

function buildDeepLink(type, id) {
  if (!type || !id) return APP_SCHEME;
  return `${APP_SCHEME}${type}/${id}`;
}

export default function ShareSheet({ visible, onClose, type, id, title, description, imageUrl }) {
  const { colors } = useTheme();
  const { token, user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState({});
  const [showContacts, setShowContacts] = useState(false);

  const shareUrl = buildShareUrl(type, id);
  const shareText = title ? `${title} - SocialBeats` : 'SocialBeats\'te paylaştım!';
  const fullMessage = description ? `${shareText}\n${description}\n${shareUrl}` : `${shareText}\n${shareUrl}`;

  useEffect(() => {
    if (visible && token) {
      api.get('/messages/conversations', token)
        .then(r => setContacts((r.conversations || r || []).slice(0, 20)))
        .catch(() => {});
    }
  }, [visible, token]);

  const filteredContacts = contacts.filter(c => {
    const name = c.recipient?.display_name || c.recipient?.username || c.group_name || c.name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handlePlatform = useCallback(async (platformId) => {
    haptic.light();
    try {
      switch (platformId) {
        case 'instagram_story': {
          const url = `instagram-stories://share?source_application=socialbeats`;
          const canOpen = await Linking.canOpenURL(url);
          if (canOpen) { await Linking.openURL(url); }
          else {
            await Share.share({ message: fullMessage, url: shareUrl });
          }
          break;
        }
        case 'instagram_post': {
          const canOpen = await Linking.canOpenURL('instagram://app');
          if (canOpen) { await Linking.openURL('instagram://app'); }
          else { await Share.share({ message: fullMessage, url: shareUrl }); }
          break;
        }
        case 'whatsapp': {
          const waUrl = `whatsapp://send?text=${encodeURIComponent(fullMessage)}`;
          const canOpen = await Linking.canOpenURL(waUrl);
          if (canOpen) { await Linking.openURL(waUrl); }
          else { await Share.share({ message: fullMessage }); }
          break;
        }
        case 'twitter': {
          const tUrl = `twitter://post?message=${encodeURIComponent(fullMessage)}`;
          const canOpen = await Linking.canOpenURL(tUrl);
          if (canOpen) { await Linking.openURL(tUrl); }
          else {
            const webUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
            await Linking.openURL(webUrl);
          }
          break;
        }
        case 'facebook': {
          const fbUrl = `fb://share?link=${encodeURIComponent(shareUrl)}`;
          const canOpen = await Linking.canOpenURL(fbUrl);
          if (canOpen) { await Linking.openURL(fbUrl); }
          else {
            const webUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
            await Linking.openURL(webUrl);
          }
          break;
        }
        case 'telegram': {
          const tgUrl = `tg://msg?text=${encodeURIComponent(fullMessage)}`;
          const canOpen = await Linking.canOpenURL(tgUrl);
          if (canOpen) { await Linking.openURL(tgUrl); }
          else { await Share.share({ message: fullMessage }); }
          break;
        }
        case 'message': {
          setShowContacts(true);
          return;
        }
        case 'copy': {
          await Clipboard.setStringAsync(shareUrl);
          haptic.success();
          onClose?.();
          break;
        }
        case 'more': {
          await Share.share({ message: fullMessage, url: shareUrl, title: shareText });
          break;
        }
      }
      if (platformId !== 'message' && platformId !== 'copy') {
        try { await api.post(`/social/share`, { type, id, platform: platformId }, token); } catch {}
      }
    } catch {}
  }, [fullMessage, shareUrl, shareText, type, id, token]);

  const sendToContact = useCallback(async (contact) => {
    const convId = contact.id || contact._id;
    setSending(p => ({ ...p, [convId]: true }));
    haptic.medium();
    try {
      await api.post('/messages/send', {
        conversation_id: convId,
        recipient_id: contact.recipient?.id,
        content: fullMessage,
        content_type: `SHARE_${(type || 'LINK').toUpperCase()}`,
        share_data: { type, id, title, image_url: imageUrl, url: shareUrl },
      }, token);
      setSending(p => ({ ...p, [convId]: 'done' }));
      setTimeout(() => setSending(p => ({ ...p, [convId]: false })), 1500);
    } catch {
      setSending(p => ({ ...p, [convId]: false }));
    }
  }, [fullMessage, type, id, title, imageUrl, shareUrl, token]);

  return (
    <BottomSheet visible={visible} onClose={() => { setShowContacts(false); onClose?.(); }} height={showContacts ? 0.75 : 0.5}>
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
        <Text style={[styles.title, { color: colors.text }]}>Paylaş</Text>

        {showContacts ? (
          <>
            <TouchableOpacity onPress={() => setShowContacts(false)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Ionicons name="arrow-back" size={18} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 14 }}>Geri</Text>
            </TouchableOpacity>
            <View style={[styles.searchBar, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Kişi ara..." placeholderTextColor={colors.textMuted}
                value={searchQuery} onChangeText={setSearchQuery}
              />
            </View>
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.id || item._id || Math.random().toString()}
              renderItem={({ item }) => {
                const cId = item.id || item._id;
                const name = item.recipient?.display_name || item.recipient?.username || item.group_name || item.name || '';
                const avatar = item.recipient?.avatar_url || item.group_avatar;
                const state = sending[cId];
                return (
                  <TouchableOpacity style={[styles.contactRow, { borderBottomColor: colors.border }]} onPress={() => sendToContact(item)} disabled={!!state}>
                    <View style={[styles.contactAvatar, { backgroundColor: colors.surfaceElevated }]}>
                      {avatar ? <Image source={{ uri: avatar }} style={styles.contactAvatar} /> : <Ionicons name="person" size={18} color={BRAND.primaryLight} />}
                    </View>
                    <Text style={[styles.contactName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
                    {state === 'done' ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.success || '#10B981'} />
                    ) : state ? (
                      <ActivityIndicator size="small" color={BRAND.primary} />
                    ) : (
                      <View style={[styles.sendBtn, { backgroundColor: BRAND.primary }]}>
                        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>Gönder</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 20 }}>Sohbet bulunamadı</Text>}
            />
          </>
        ) : (
          <>
            {title && (
              <View style={[styles.previewRow, { backgroundColor: colors.surfaceElevated }]}>
                {imageUrl && <Image source={{ uri: imageUrl }} style={styles.previewImg} />}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{title}</Text>
                  {description && <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{description}</Text>}
                </View>
              </View>
            )}

            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>SOSYAL MEDYA</Text>
            <View style={styles.platformGrid}>
              {PLATFORMS.filter(p => p.section === 'social').map(p => (
                <TouchableOpacity key={p.id} style={styles.platformItem} onPress={() => handlePlatform(p.id)} activeOpacity={0.7}>
                  <View style={[styles.platformIconBg, { backgroundColor: `${p.color}15` }]}>
                    <Ionicons name={p.icon} size={24} color={p.color} />
                  </View>
                  <Text style={[styles.platformLabel, { color: colors.text }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>DİĞER</Text>
            <View style={styles.platformGrid}>
              {PLATFORMS.filter(p => p.section === 'app' || p.section === 'other').map(p => (
                <TouchableOpacity key={p.id} style={styles.platformItem} onPress={() => handlePlatform(p.id)} activeOpacity={0.7}>
                  <View style={[styles.platformIconBg, { backgroundColor: `${p.color}15` }]}>
                    <Ionicons name={p.icon} size={24} color={p.color} />
                  </View>
                  <Text style={[styles.platformLabel, { color: colors.text }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, marginBottom: 16 },
  previewImg: { width: 48, height: 48, borderRadius: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10, marginTop: 4 },
  platformGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  platformItem: { alignItems: 'center', width: 64 },
  platformIconBg: { width: 50, height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  platformLabel: { fontSize: 11, textAlign: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 4 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5 },
  contactAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  contactName: { flex: 1, fontSize: 14, fontWeight: '500' },
  sendBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
});
