import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Share, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const isWeb = Platform.OS === 'web';
let WebView = null;
if (!isWeb) {
  try { WebView = require('react-native-webview').WebView; } catch { }
}

export default function InAppBrowser({ url, onClose, title }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState(url);
  const [canGoBack, setCanGoBack] = useState(false);
  const webViewRef = React.useRef(null);

  const handleShare = async () => {
    try {
      await Share.share({ url: currentUrl, message: currentUrl });
    } catch { }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.urlBar}>
          <Ionicons name="lock-closed" size={12} color="#8B5CF6" style={{ marginRight: 4 }} />
          <Text style={styles.urlText} numberOfLines={1}>
            {title || (currentUrl ? new URL(currentUrl).hostname : '')}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {canGoBack && !isWeb && (
            <TouchableOpacity onPress={() => webViewRef.current?.goBack()} style={styles.headerBtn}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleShare} style={styles.headerBtn}>
            <Ionicons name="share-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      {loading && !isWeb && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color="#8B5CF6" />
        </View>
      )}
      {isWeb ? (
        <iframe
          src={url}
          style={{ flex: 1, width: '100%', height: '100%', border: 'none', backgroundColor: '#0A0A0B' }}
          allowFullScreen
        />
      ) : WebView ? (
        <WebView
          ref={webViewRef}
          source={{ uri: url }}
          style={styles.webview}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={(navState) => {
            setCurrentUrl(navState.url);
            setCanGoBack(navState.canGoBack);
          }}
          startInLoadingState
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0B' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#1A1A2E',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A3E',
  },
  headerBtn: { padding: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  urlBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginHorizontal: 8,
  },
  urlText: { color: '#aaa', fontSize: 13, flex: 1 },
  loadingBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
    paddingTop: 2,
  },
  webview: { flex: 1, backgroundColor: '#0A0A0B' },
});
