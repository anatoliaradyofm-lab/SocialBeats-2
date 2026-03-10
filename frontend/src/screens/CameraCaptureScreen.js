/**
 * CameraCaptureScreen - VisionCamera ile fotoğraf/video çekimi.
 * CreatePost ve StoryCreate için kullanılır.
 * route.params: { onCapture: (assets) => void, maxVideoDuration?: number }
 */
import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, BRAND } from '../contexts/ThemeContext';

let VisionCamera = null;
try {
  VisionCamera = require('react-native-vision-camera');
} catch {}

const { width: SW } = Dimensions.get('window');
const DEFAULT_MAX_VIDEO = 60;

export default function CameraCaptureScreen({ navigation, route }) {
  const { colors } = useTheme();
  const onCapture = route?.params?.onCapture;
  const maxVideoSec = route?.params?.maxVideoDuration ?? DEFAULT_MAX_VIDEO;
  const [facing, setFacing] = useState('back');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const cameraRef = useRef(null);
  const recordingTimerRef = useRef(null);

  const device = VisionCamera?.useCameraDevice(facing, { physicalDevices: ['wide-angle-camera', 'ultra-wide-angle-camera'] });
  const { hasPermission, requestPermission } = VisionCamera?.useCameraPermission() || {};
  const { hasPermission: hasMic, requestPermission: requestMic } = VisionCamera?.useMicrophonePermission() || {};

  const checkPerms = useCallback(async () => {
    if (!VisionCamera) return false;
    let cam = hasPermission;
    if (!cam) cam = await requestPermission();
    if (!cam) {
      Alert.alert('İzin Gerekli', 'Kameraya erişim için izin verin.');
      return false;
    }
    return true;
  }, [hasPermission, requestPermission]);

  const handleFlip = useCallback(() => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  }, []);

  const handleTakePhoto = useCallback(async () => {
    if (!VisionCamera || !cameraRef.current) return;
    const ok = await checkPerms();
    if (!ok) return;
    try {
      const photo = await cameraRef.current.takePhoto({ enableShutterSound: true });
      const uri = photo.path.startsWith('file') ? photo.path : `file://${photo.path}`;
      const assets = [{ uri, type: 'image' }];
      onCapture?.(assets);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Fotoğraf çekilemedi');
    }
  }, [checkPerms, onCapture, navigation]);

  const handleStartRecord = useCallback(async () => {
    if (!VisionCamera || !cameraRef.current || isRecording) return;
    const ok = await checkPerms();
    if (!ok) return;
    if (!hasMic) await requestMic?.();
    try {
      cameraRef.current.startRecording({
        flash: 'off',
        onRecordingFinished: (video) => {
          setIsRecording(false);
          if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
          const uri = video.path?.startsWith('file') ? video.path : `file://${video.path}`;
          const duration = video.duration ?? recordingSec * 1000;
          const assets = [{ uri, type: 'video', duration }];
          onCapture?.(assets);
          navigation.goBack();
        },
        onRecordingError: (e) => {
          setIsRecording(false);
          if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
          Alert.alert('Hata', e?.message || 'Video kaydedilemedi');
        },
      });
      setIsRecording(true);
      setRecordingSec(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSec((s) => {
          if (s >= maxVideoSec - 1) {
            cameraRef.current?.stopRecording();
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      Alert.alert('Hata', e?.message || 'Kayıt başlatılamadı');
    }
  }, [checkPerms, hasMic, requestMic, isRecording, onCapture, navigation, maxVideoSec, recordingSec]);

  const handleStopRecord = useCallback(() => {
    if (!cameraRef.current || !isRecording) return;
    cameraRef.current.stopRecording();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
  }, [isRecording]);

  const handleClose = useCallback(() => {
    if (isRecording) return;
    navigation.goBack();
  }, [isRecording, navigation]);

  if (!VisionCamera) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Kamera</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.fallbackText, { color: colors.textMuted }]}>
            VisionCamera yüklü değil. Geliştirme build kullanın veya galeriden seçin.
          </Text>
        </View>
      </View>
    );
  }

  if (hasPermission === null) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={BRAND.primary} />
          <Text style={[styles.fallbackText, { color: colors.textMuted, marginTop: 12 }]}>Kamera izni isteniyor...</Text>
        </View>
      </View>
    );
  }
  if (hasPermission === false) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.fallbackText, { color: colors.textMuted }]}>Kamera izni gerekli</Text>
          <TouchableOpacity style={[styles.permBtn, { backgroundColor: BRAND.primary }]} onPress={requestPermission}>
            <Text style={styles.permBtnText}>İzin Ver</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={BRAND.primary} />
          <Text style={[styles.fallbackText, { color: colors.textMuted, marginTop: 12 }]}>Kamera hazırlanıyor...</Text>
        </View>
      </View>
    );
  }

  const { Camera } = VisionCamera;

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        photo={true}
        video={true}
        audio={true}
      />
      <TouchableOpacity style={[styles.closeBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={handleClose}>
        <Ionicons name="close" size={26} color="#FFF" />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.flipBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={handleFlip}>
        <Ionicons name="camera-reverse" size={24} color="#FFF" />
      </TouchableOpacity>
      {isRecording && (
        <View style={styles.recBadge}>
          <View style={styles.recDot} />
          <Text style={styles.recText}>{recordingSec}s / {maxVideoSec}s</Text>
        </View>
      )}
      <View style={styles.bottom}>
        <View style={styles.captureRow}>
          <TouchableOpacity
            style={[styles.captureBtn, isRecording && styles.captureBtnRecording]}
            onPress={isRecording ? handleStopRecord : handleTakePhoto}
          >
            {isRecording ? <Ionicons name="stop" size={32} color="#FFF" /> : <Ionicons name="camera" size={32} color="#FFF" />}
          </TouchableOpacity>
          {!isRecording && (
            <TouchableOpacity style={[styles.recordBtn, { borderColor: '#FFF' }]} onPress={handleStartRecord}>
              <Text style={styles.recordBtnText}>Video</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, zIndex: 10 },
  title: { fontSize: 18, fontWeight: '700' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  fallbackText: { fontSize: 14, textAlign: 'center', marginTop: 12 },
  permBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  permBtnText: { color: '#FFF', fontWeight: '600' },
  closeBtn: { position: 'absolute', top: 54, left: 16, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  flipBtn: { position: 'absolute', top: 54, right: 16, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  recBadge: { position: 'absolute', top: 54, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.9)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 6, zIndex: 10 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },
  recText: { color: '#FFF', fontWeight: '600', fontSize: 12 },
  bottom: { position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  captureRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.3)', borderWidth: 4, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  captureBtnRecording: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  recordBtn: { borderWidth: 2, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  recordBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
});
