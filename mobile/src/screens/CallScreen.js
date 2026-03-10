/**
 * CallScreen - Sesli/görüntülü arama (Jitsi Meet - ücretsiz WebRTC)
 * https://meet.jit.si - Açık kaynak
 */
import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

const isWeb = Platform.OS === 'web';
let WebView = null;
if (!isWeb) {
  try { WebView = require('react-native-webview').WebView; } catch { }
}

const JITSI_DOMAIN = 'https://meet.jit.si';
const safeRoom = (id) => (id || '').replace(/[^a-zA-Z0-9-]/g, '') || 'socialbeats';

export default function CallScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { conversationId, callType = 'video', otherUserName } = route.params || {};
  const room = safeRoom(conversationId);
  const isVideo = callType !== 'voice';
  const jitsiUrl = `${JITSI_DOMAIN}/${room}${isVideo ? '' : '#config.startWithVideoMuted=true'}`;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{isVideo ? 'Görüntülü arama' : 'Sesli arama'}</Text>
        {otherUserName ? <Text style={styles.subtitle}>{otherUserName}</Text> : null}
      </View>
      {isWeb ? (
        <iframe
          src={jitsiUrl}
          style={{ flex: 1, width: '100%', height: '100%', border: 'none' }}
          allow="camera; microphone; display-capture"
          allowFullScreen
        />
      ) : WebView ? (
        <WebView
          source={{ uri: jitsiUrl }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          startInLoadingState
          onError={(e) => console.warn('Jitsi WebView error:', e.nativeEvent)}
        />
      ) : null}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937', gap: 12 },
  closeBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: '#9CA3AF', marginLeft: 'auto' },
  webview: { flex: 1 },
});
