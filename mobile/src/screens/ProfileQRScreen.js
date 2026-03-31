import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

let QRCode = null;
try {
  QRCode = require('react-native-qrcode-svg').default;
} catch { }

const { width } = Dimensions.get('window');
const QR_SIZE = width * 0.6;

export default function ProfileQRScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useTranslation();
  const profileUrl = `https://socialbeats.app/u/${user?.username || ''}`;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${t('profile.shareProfile')}: ${profileUrl}`,
        url: profileUrl,
      });
    } catch { }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('profile.profileQR')}</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Ionicons name="share-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <View style={styles.qrCard}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={40} color="#8B5CF6" />
          </View>
          <Text style={styles.username}>@{user?.username}</Text>
          <Text style={styles.displayName}>{user?.display_name || user?.username}</Text>
          <View style={styles.qrBox}>
            {QRCode ? (
              <QRCode value={profileUrl} size={QR_SIZE * 0.8} color="#0A0A0B" backgroundColor="#fff" />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Ionicons name="qr-code" size={QR_SIZE * 0.7} color="#8B5CF6" />
              </View>
            )}
          </View>
          <Text style={styles.profileUrl}>{profileUrl}</Text>
        </View>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="link-outline" size={20} color="#fff" />
          <Text style={styles.shareButtonText}>{t('profile.shareProfileLink')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  shareBtn: { padding: 4 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  qrCard: { backgroundColor: '#1F2937', borderRadius: 24, padding: 32, alignItems: 'center', width: '100%', maxWidth: 340 },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#1E1B4B', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  username: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  displayName: { fontSize: 14, color: '#9CA3AF', marginBottom: 24 },
  qrBox: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
  qrPlaceholder: { width: QR_SIZE, height: QR_SIZE, alignItems: 'center', justifyContent: 'center' },
  profileUrl: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
  shareButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#8B5CF6', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 14, marginTop: 24 },
  shareButtonText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
