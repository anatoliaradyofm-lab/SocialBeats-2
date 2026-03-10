/**
 * React Native Share - Unified share (post, story, profile, music)
 */
import { Share, Platform } from 'react-native';

export async function shareText(title, message, url = '') {
  try {
    const content = url ? `${message}\n${url}` : message;
    const result = await Share.share(
      Platform.OS === 'ios'
        ? { title, message: content }
        : { title, message: content, url: url || undefined },
    );
    return result.action === Share.sharedAction;
  } catch (e) {
    console.warn('Share error:', e);
    return false;
  }
}

export async function sharePost(postId, text, shareUrl) {
  return shareText('SocialBeats', text || 'Bir gönderi paylaşıyorum', shareUrl || `socialbeats://post/${postId}`);
}

export async function shareProfile(username, shareUrl) {
  return shareText('SocialBeats Profil', `@${username} profilini gör`, shareUrl || `socialbeats://user/${username}`);
}

export async function shareTrack(title, artist, shareUrl) {
  return shareText('SocialBeats Müzik', `${title} - ${artist}`, shareUrl || '');
}

export async function sharePlaylist(name, shareUrl) {
  return shareText('SocialBeats Çalma Listesi', name, shareUrl || '');
}
