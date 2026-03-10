import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Animated, Dimensions, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import haptic from '../utils/haptics';

const { width: SW } = Dimensions.get('window');
const SCAN_SIZE = SW * 0.7;

let CameraModule = null;
try { CameraModule = require('expo-camera'); } catch {}

export default function QRScannerScreen({ navigation }) {
  const { colors } = useTheme();
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const scanLineY = useRef(new Animated.Value(0)).current;
  const CameraView = CameraModule?.CameraView;

  useEffect(() => {
    (async () => {
      if (CameraModule?.Camera) {
        const { status } = await CameraModule.Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      } else if (CameraModule?.requestCameraPermissionsAsync) {
        const { status } = await CameraModule.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      } else {
        setHasPermission(false);
      }
    })();
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineY, { toValue: SCAN_SIZE - 4, duration: 2000, useNativeDriver: true }),
        Animated.timing(scanLineY, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleBarCodeScanned = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    haptic.success();

    if (data.includes('socialbeats.app/') || data.startsWith('socialbeats://')) {
      const path = data.replace('https://socialbeats.app', '').replace('socialbeats://', '/');
      if (path.startsWith('/@')) {
        navigation.replace('UserProfile', { username: path.slice(2) });
      } else if (path.startsWith('/playlist/')) {
        navigation.replace('PlaylistDetail', { playlistId: path.split('/')[2] });
      } else if (path.startsWith('/post/')) {
        navigation.replace('PostDetail', { postId: path.split('/')[2] });
      } else if (path.startsWith('/track/')) {
        navigation.replace('FullPlayer', { trackId: path.split('/')[2] });
      } else {
        Alert.alert('QR Kod', `Bağlantı: ${data}`, [
          { text: 'Aç', onPress: () => Linking.openURL(data) },
          { text: 'Tamam' },
        ]);
      }
    } else if (data.startsWith('http')) {
      Alert.alert('QR Kod', `Bağlantı: ${data}`, [
        { text: 'Aç', onPress: () => Linking.openURL(data) },
        { text: 'Kopyala', onPress: async () => {
          try { const Clipboard = require('expo-clipboard'); await Clipboard.setStringAsync(data); } catch {}
        }},
        { text: 'Tamam' },
      ]);
    } else {
      Alert.alert('QR Kod', data, [{ text: 'Tamam' }]);
    }

    setTimeout(() => setScanned(false), 3000);
  };

  const renderNoCamera = (msg) => (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>QR Tarayıcı</Text>
        <View style={{ width: 22 }} />
      </View>
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={64} color={colors.textMuted} />
        <Text style={{ color: colors.textMuted, marginTop: 12, textAlign: 'center', paddingHorizontal: 32 }}>{msg}</Text>
      </View>
    </View>
  );

  if (!CameraView) return renderNoCamera('Kamera modülü yüklü değil. expo-camera paketini yükleyin.');
  if (hasPermission === null) return renderNoCamera('Kamera izni isteniyor...');
  if (hasPermission === false) return renderNoCamera('Kamera izni verilmedi. Ayarlardan izin verin.');

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      <View style={styles.overlay}>
        <View style={styles.overlayTop} />
        <View style={{ flexDirection: 'row' }}>
          <View style={styles.overlaySide} />
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom} />
      </View>

      <View style={styles.headerOverlay}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitleOverlay}>QR Tarayıcı</Text>
        <TouchableOpacity onPress={() => setTorch(t => !t)} style={styles.headerBtn}>
          <Ionicons name={torch ? 'flash' : 'flash-off'} size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.bottomHint}>
        <Text style={styles.hintText}>QR kodu çerçevenin içine hizalayın</Text>
        {scanned && (
          <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
            <Ionicons name="refresh" size={18} color="#FFF" />
            <Text style={{ color: '#FFF', fontWeight: '600' }}>Tekrar Tara</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  scanArea: { width: SCAN_SIZE, height: SCAN_SIZE },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: BRAND.primary, borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  scanLine: { width: '100%', height: 2, backgroundColor: BRAND.primary, opacity: 0.8 },
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  headerTitleOverlay: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  bottomHint: { position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center', gap: 12 },
  hintText: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  rescanBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: BRAND.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
});
