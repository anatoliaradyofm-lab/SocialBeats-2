import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, I18nManager } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from '../ui/AppAlert';

export default function StoryCamera({ visible, onCapture, onClose }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [facing, setFacing] = useState('back');
  const cameraRef = useRef(null);

  useEffect(() => {
    if (visible) {
      (async () => {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPermission(status === 'granted');
      })();
    }
  }, [visible]);

  const capture = async () => {
    if (!cameraRef.current) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });
      if (photo?.uri) onCapture?.(photo.uri);
    } catch (e) {
      Alert.alert('Hata', e.message || 'Fotoğraf alınamadı');
    }
    setCapturing(false);
  };

  const openPicker = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin gerekli', 'Kamera kullanımı için izin verin');
      return;
    }
    setCapturing(true);
    try {
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, allowsEditing: true, quality: 0.8 });
      if (!result.canceled && result.assets?.[0]?.uri) onCapture?.(result.assets[0].uri);
    } catch (e) {
      Alert.alert('Hata', e.message || 'Fotoğraf alınamadı');
    }
    setCapturing(false);
  };

  if (!visible) return null;

  if (hasPermission === null) {
    return (
      <View style={styles.fallback}>
        <ActivityIndicator color={"#fff"} />
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.fallback}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
        <TouchableOpacity style={styles.captureBtn} onPress={openPicker}>
          <Text style={styles.captureText}>Kamera Aç</Text>
        </TouchableOpacity>
        <Text style={{ color: '#fff', marginTop: 100 }}>Kamera erişimi reddedildi.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />
      <TouchableOpacity style={styles.closeBtn} onPress={onClose}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
      <TouchableOpacity style={styles.flipBtn} onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}>
        <Text style={styles.flipText}>⟲</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.captureBtn, capturing && styles.captureDisabled]} onPress={capture} disabled={capturing}>
        {capturing ? <ActivityIndicator color="#fff" /> : <View style={styles.captureInner} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  fallback: { flex: 1, backgroundColor: '#0A0A0B', justifyContent: 'center', alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 50, [I18nManager.isRTL ? 'left' : 'right']: 20, zIndex: 10, padding: 8 },
  closeText: { color: '#fff', fontSize: 24 },
  captureBtn: { position: 'absolute', bottom: 50, alignSelf: 'center', width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  captureInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  captureDisabled: { opacity: 0.6 },
  captureText: { color: '#fff', fontSize: 16, textAlign: 'center' },
  flipBtn: { position: 'absolute', bottom: 62, [I18nManager.isRTL ? 'left' : 'right']: 32, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  flipText: { color: '#fff', fontSize: 26 },
});
