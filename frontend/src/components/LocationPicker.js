import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Modal,
  StyleSheet, ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const { width: SW, height: SH } = Dimensions.get('window');

const LEAFLET_HTML = (lat, lon, zoom) => `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%}
  .custom-marker{background:${BRAND.primary};width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4)}
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

var markerIcon=L.divIcon({className:'custom-marker',iconSize:[20,20],iconAnchor:[10,10]});
var marker=L.marker([${lat},${lon}],{icon:markerIcon,draggable:true}).addTo(map);

marker.on('dragend',function(e){
  var p=marker.getLatLng();
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'marker_moved',lat:p.lat,lng:p.lng}));
});
map.on('click',function(e){
  marker.setLatLng(e.latlng);
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'map_click',lat:e.latlng.lat,lng:e.latlng.lng}));
});

window.moveMap=function(lat,lng,z){
  map.setView([lat,lng],z||15);
  marker.setLatLng([lat,lng]);
};
</script>
</body>
</html>`;

let WebViewComponent = null;

export default function LocationPicker({ visible, onClose, onSelect, initialLocation }) {
  const { colors } = useTheme();
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [coords, setCoords] = useState({ lat: 41.0082, lon: 28.9784 });
  const [webViewAvailable, setWebViewAvailable] = useState(null);
  const webViewRef = useRef(null);
  const searchTimer = useRef(null);

  useEffect(() => {
    try {
      WebViewComponent = require('react-native-webview').WebView;
      setWebViewAvailable(true);
    } catch {
      setWebViewAvailable(false);
    }
  }, []);

  useEffect(() => {
    if (initialLocation?.latitude && initialLocation?.longitude) {
      setCoords({ lat: initialLocation.latitude, lon: initialLocation.longitude });
    }
  }, [initialLocation]);

  const searchLocations = useCallback(async (text) => {
    if (!text || text.length < 1) { setResults([]); return; }
    setSearching(true);
    try {
      const [locRes, countriesRes] = await Promise.all([
        text.length >= 2 ? api.get(`/location/search?q=${encodeURIComponent(text)}&limit=6&lang=default`, token).catch(() => ({ results: [] })) : Promise.resolve({ results: [] }),
        api.get(`/countries?search=${encodeURIComponent(text)}&limit=8`, token).catch(() => ({ countries: [] })),
      ]);
      const locResults = (locRes.results || []).map((r) => ({ ...r, source: 'location' }));
      const countryResults = (countriesRes.countries || []).map((c) => ({
        name: c.name,
        display_name: c.capital ? `${c.name} (${c.capital})` : c.name,
        latitude: (c.latlng && c.latlng[0]) || 0,
        longitude: (c.latlng && c.latlng[1]) || 0,
        country: c.name,
        country_code: c.code,
        source: 'country',
      })).filter((c) => c.latitude && c.longitude);
      setResults([...locResults, ...countryResults]);
    } catch {
      setResults([]);
    }
    setSearching(false);
  }, [token]);

  const handleQueryChange = (text) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchLocations(text), 400);
  };

  const handleSelectResult = (item) => {
    const lat = item.latitude ?? item.lat;
    const lon = item.longitude ?? item.lon;
    setSelectedLocation(item);
    if (lat && lon) {
      setCoords({ lat, lon });
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`window.moveMap(${lat},${lon},${item.source === 'country' ? 5 : 15});true;`);
      }
    }
    setResults([]);
    setQuery(item.display_name || item.name || '');
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onSelect({
        name: selectedLocation.display_name || selectedLocation.name,
        city: selectedLocation.city,
        country: selectedLocation.country,
        latitude: selectedLocation.latitude || coords.lat,
        longitude: selectedLocation.longitude || coords.lon,
      });
    } else if (query.trim()) {
      onSelect({
        name: query.trim(),
        latitude: coords.lat,
        longitude: coords.lon,
      });
    }
    onClose();
  };

  const handleMapMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'map_click' || data.type === 'marker_moved') {
        setCoords({ lat: data.lat, lon: data.lng });
        reverseGeocode(data.lat, data.lng);
      }
    } catch {}
  };

  const reverseGeocode = async (lat, lon) => {
    try {
      const res = await api.get(`/location/reverse?lat=${lat}&lon=${lon}`, token);
      if (res.result) {
        setSelectedLocation({ ...res.result, latitude: lat, longitude: lon });
        setQuery(res.result.display_name || '');
      }
    } catch {}
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Konum Seç</Text>
          <TouchableOpacity onPress={handleConfirm} style={styles.headerBtn}>
            <Text style={{ color: BRAND.primary, fontWeight: '700', fontSize: 15 }}>Tamam</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchRow, { backgroundColor: colors.surfaceElevated }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Konum ara..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={handleQueryChange}
            autoFocus
          />
          {searching && <ActivityIndicator size="small" color={BRAND.primary} />}
          {query.length > 0 && !searching && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSelectedLocation(null); }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Search Results */}
        {results.length > 0 && (
          <FlatList
            data={results}
            keyExtractor={(_, i) => `loc-${i}`}
            style={[styles.resultsList, { backgroundColor: colors.surface }]}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={[styles.resultItem, { borderBottomColor: colors.border }]} onPress={() => handleSelectResult(item)}>
                <Ionicons name="location" size={18} color={BRAND.primary} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>{item.name || item.city}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>{item.display_name}</Text>
                </View>
                {item.country_code && (
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.country_code}</Text>
                )}
              </TouchableOpacity>
            )}
          />
        )}

        {/* Map Toggle */}
        <TouchableOpacity
          style={[styles.mapToggle, { backgroundColor: colors.surfaceElevated }]}
          onPress={() => setShowMap(!showMap)}
        >
          <Ionicons name={showMap ? 'list' : 'map'} size={18} color={BRAND.primary} />
          <Text style={{ color: BRAND.primary, fontWeight: '600', fontSize: 13 }}>
            {showMap ? 'Listeye dön' : 'Haritada göster'}
          </Text>
        </TouchableOpacity>

        {/* Map View */}
        {showMap && webViewAvailable && WebViewComponent && (
          <View style={styles.mapContainer}>
            <WebViewComponent
              ref={webViewRef}
              source={{ html: LEAFLET_HTML(coords.lat, coords.lon, 13) }}
              style={{ flex: 1 }}
              onMessage={handleMapMessage}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              scrollEnabled={false}
            />
          </View>
        )}

        {showMap && !webViewAvailable && (
          <View style={[styles.mapFallback, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="map-outline" size={48} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, marginTop: 8, textAlign: 'center' }}>
              Harita için react-native-webview gerekli{'\n'}
              <Text style={{ fontSize: 11 }}>npx expo install react-native-webview</Text>
            </Text>
            {coords.lat && coords.lon && (
              <Text style={{ color: BRAND.primary, marginTop: 8, fontSize: 12 }}>
                {coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}
              </Text>
            )}
          </View>
        )}

        {/* Selected Location Info */}
        {selectedLocation && (
          <View style={[styles.selectedInfo, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="location" size={20} color={BRAND.pink} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>{selectedLocation.name || selectedLocation.city}</Text>
              {selectedLocation.country && (
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {[selectedLocation.city, selectedLocation.state, selectedLocation.country].filter(Boolean).join(', ')}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 50, paddingBottom: 12, borderBottomWidth: 1 },
  headerBtn: { width: 60 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'center', margin: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, gap: 8 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  resultsList: { maxHeight: SH * 0.35, marginHorizontal: 12, borderRadius: 12 },
  resultItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 0.5 },
  mapToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  mapContainer: { flex: 1, margin: 12, borderRadius: 12, overflow: 'hidden' },
  mapFallback: { flex: 1, margin: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center', padding: 20 },
  selectedInfo: { flexDirection: 'row', alignItems: 'center', margin: 12, padding: 12, borderRadius: 12 },
});
