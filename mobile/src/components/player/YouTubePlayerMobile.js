import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { usePlayer } from '../../contexts/PlayerContext';

const isWeb = Platform.OS === 'web';
let WebView = null;
if (!isWeb) {
  try { WebView = require('react-native-webview').WebView; } catch { }
}

export default function YouTubePlayerMobile() {
  const { currentTrack } = usePlayer();
  const { t } = useTranslation();

  if (!currentTrack || (currentTrack.source !== 'youtube' && !currentTrack.youtubeUrl && !currentTrack.embedUrl)) {
    return null;
  }

  const embedUrl = currentTrack.embedUrl || `https://www.youtube.com/embed/${currentTrack.id}`;
  const watchUrl = currentTrack.youtubeUrl || `https://www.youtube.com/watch?v=${currentTrack.id}`;

  return (
    <View style={styles.container}>
      {isWeb ? (
        <iframe
          src={embedUrl}
          style={{ width: '100%', flex: 1, border: 'none', backgroundColor: '#000' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : WebView ? (
        <WebView
          source={{ uri: embedUrl }}
          style={styles.webview}
          allowsFullscreenVideo
          allowsInlineMediaPlayback
        />
      ) : (
        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => { Linking.openURL(watchUrl).catch(() => { }); }}
        >
          <Text style={styles.linkText}>{t('player.watchOnYouTube', 'YouTube\'da İzle')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 8,
    minHeight: 220,
    width: '100%',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  linkBtn: {
    backgroundColor: '#8B5CF6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  linkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
