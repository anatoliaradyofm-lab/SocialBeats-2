import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, BRAND } from '../contexts/ThemeContext';

let WebViewComponent = null;

const LEAFLET_HTML = (lat, lon, zoom, label) => `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%}
  .pulse{width:16px;height:16px;border-radius:50%;background:${BRAND.primary};border:3px solid #fff;box-shadow:0 0 0 0 rgba(124,58,237,0.6);animation:pulse 2s infinite}
  @keyframes pulse{0%{box-shadow:0 0 0 0 rgba(124,58,237,0.6)}70%{box-shadow:0 0 0 12px rgba(124,58,237,0)}100%{box-shadow:0 0 0 0 rgba(124,58,237,0)}}
</style>
</head>
<body>
<div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false}).setView([${lat},${lon}],${zoom});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'&copy; OpenStreetMap',maxZoom:19
}).addTo(map);
L.control.zoom({position:'bottomright'}).addTo(map);
var icon=L.divIcon({className:'pulse',iconSize:[22,22],iconAnchor:[11,11]});
var marker=L.marker([${lat},${lon}],{icon:icon}).addTo(map);
${label ? `marker.bindPopup('<b>${label.replace(/'/g, "\\'")}</b>').openPopup();` : ''}
</script>
</body>
</html>`;

export default function MapViewScreen({ route, navigation }) {
  const { latitude, longitude, locationName } = route.params || {};
  const { colors } = useTheme();
  const [webViewAvailable, setWebViewAvailable] = useState(null);

  useEffect(() => {
    try {
      WebViewComponent = require('react-native-webview').WebView;
      setWebViewAvailable(true);
    } catch {
      setWebViewAvailable(false);
    }
  }, []);

  const lat = latitude || 41.0082;
  const lon = longitude || 28.9784;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {locationName || 'Konum'}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>
            {lat.toFixed(4)}, {lon.toFixed(4)}
          </Text>
        </View>
      </View>

      {webViewAvailable && WebViewComponent ? (
        <WebViewComponent
          source={{ html: LEAFLET_HTML(lat, lon, 14, locationName || '') }}
          style={{ flex: 1 }}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
        />
      ) : webViewAvailable === false ? (
        <View style={[styles.fallback, { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons name="map-outline" size={64} color={colors.textMuted} />
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600', marginTop: 16 }}>
            {locationName || 'Konum'}
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 8, textAlign: 'center' }}>
            Harita goruntuleme icin react-native-webview gerekli{'\n'}
            npx expo install react-native-webview
          </Text>
          <Text style={{ color: BRAND.primary, marginTop: 12, fontSize: 13 }}>
            {lat.toFixed(6)}, {lon.toFixed(6)}
          </Text>
        </View>
      ) : (
        <View style={styles.fallback}>
          <ActivityIndicator size="large" color={BRAND.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, gap: 12 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700' },
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
});
