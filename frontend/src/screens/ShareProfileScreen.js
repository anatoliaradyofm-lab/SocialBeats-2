import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Share, Alert, Image, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';
import haptic from '../utils/haptics';
import ShareSheet from '../components/ShareSheet';

let QRCode = null;
try { QRCode = require('react-native-qrcode-svg').default; } catch {}

export default function ShareProfileScreen({ navigation, route }) {
  const { user, token } = useAuth();
  const { colors } = useTheme();
  const [showShareSheet, setShowShareSheet] = useState(false);

  const shareType = route?.params?.type || 'profile';
  const shareId = route?.params?.id || user?.username;
  const shareTitle = route?.params?.title || user?.display_name || user?.username;

  const profileUrl = shareType === 'playlist'
    ? `https://socialbeats.app/playlist/${shareId}`
    : `https://socialbeats.app/@${shareId}`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {shareType === 'playlist' ? 'Çalma Listesini Paylaş' : 'Profili Paylaş'}
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('QRScanner')}>
          <Ionicons name="scan" size={22} color={BRAND.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
        <View style={[styles.qrContainer, { backgroundColor: '#FFF' }]}>
          {QRCode ? (
            <QRCode
              value={profileUrl}
              size={180}
              color="#09090B"
              backgroundColor="#FFF"
              logo={user?.avatar_url ? { uri: user.avatar_url } : undefined}
              logoSize={40}
              logoBackgroundColor="#FFF"
              logoBorderRadius={20}
            />
          ) : (
            <View style={styles.qrFallback}>
              <Ionicons name="qr-code" size={120} color={BRAND.primary} />
            </View>
          )}
        </View>

        <Text style={[styles.username, { color: colors.text }]}>
          {shareType === 'playlist' ? shareTitle : `@${user?.username || 'user'}`}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 24 }}>QR kodu taratarak erişebilirsin</Text>

        <TouchableOpacity
          style={[styles.scanBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          onPress={() => { haptic.light(); navigation.navigate('QRScanner'); }}
        >
          <Ionicons name="scan-outline" size={22} color={BRAND.primary} />
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>QR Kod Tara</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.shareAllBtn, { backgroundColor: BRAND.primary }]}
          onPress={() => { haptic.light(); setShowShareSheet(true); }}
        >
          <Ionicons name="share-social" size={20} color="#FFF" />
          <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Paylaş</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.copyBtn, { borderColor: colors.border }]}
          onPress={async () => {
            await Clipboard.setStringAsync(profileUrl);
            haptic.success();
            Alert.alert('Kopyalandı', 'Bağlantı kopyalandı!');
          }}
        >
          <Ionicons name="copy-outline" size={18} color={colors.text} />
          <Text style={{ color: colors.text, fontSize: 13 }}>{profileUrl}</Text>
        </TouchableOpacity>
      </ScrollView>

      <ShareSheet
        visible={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        type={shareType}
        id={shareId}
        title={shareTitle}
        imageUrl={user?.avatar_url}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  qrContainer: { width: 220, height: 220, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 12, padding: 20 },
  qrFallback: { justifyContent: 'center', alignItems: 'center' },
  username: { fontSize: 20, fontWeight: '700' },
  scanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', paddingVertical: 14, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  shareAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', paddingVertical: 16, borderRadius: 16, marginBottom: 12 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed' },
});
