import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useLiveKit } from '../hooks/useLiveKit';

const { width: SW, height: SH } = Dimensions.get('window');

export default function CallScreen({ navigation, route }) {
  const { recipientName, recipientAvatar, recipientId, callType = 'audio', conversationId } = route.params || {};
  const { token } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { info: liveKitInfo, room: liveKitRoom, hasLiveKit } = useLiveKit(roomNameRef.current, token, recipientId);
  const [callState, setCallState] = useState('connecting');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const roomNameRef = useRef(`call_${(route.params?.recipientId || 'unknown')}_${Date.now()}`);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();

    const timeout = setTimeout(() => {
      setCallState('active');
      startTimeRef.current = new Date().toISOString();
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }, 2000);

    return () => {
      clearTimeout(timeout);
      if (timerRef.current) clearInterval(timerRef.current);
      pulse.stop();
    };
  }, []);

  const formatDuration = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const endCall = async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      await api.post('/messages/calls/log', {
        callee_id: recipientId || '',
        call_type: callType,
        status: duration > 0 ? 'ended' : 'missed',
        duration,
        started_at: startTimeRef.current || new Date().toISOString(),
      }, token);
    } catch {}

    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: callType === 'video' ? '#000' : colors.background }]}>
      {callType === 'video' && isVideoEnabled && (
        <View style={styles.videoBackground}>
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>{t('messages.videoCall')}</Text>
        </View>
      )}

      <View style={styles.topArea}>
        <Text style={styles.callTypeLabel}>{callType === 'video' ? t('messages.videoCall') : t('messages.voiceCall')}</Text>
        <View style={styles.e2eBadge}>
          <Ionicons name="lock-closed" size={10} color="#10B981" />
          <Text style={{ color: '#10B981', fontSize: 10 }}>E2E Encrypted</Text>
        </View>
      </View>

      <View style={styles.center}>
        <Animated.View style={[styles.avatarPulse, { transform: [{ scale: callState === 'connecting' ? pulseAnim : 1 }] }]}>
          <View style={styles.avatarWrap}>
            {recipientAvatar ? (
              <Image source={{ uri: recipientAvatar }} style={styles.avatar} />
            ) : (
              <Ionicons name="person" size={48} color="rgba(255,255,255,0.6)" />
            )}
          </View>
        </Animated.View>
        <Text style={styles.recipientName}>{recipientName || t('auth.username')}</Text>
        <Text style={styles.statusText}>
          {callState === 'connecting' ? t('common.loading') : formatDuration(duration)}
        </Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={[styles.controlBtn, isMuted && styles.controlActive]} onPress={() => setIsMuted(!isMuted)}>
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={26} color="#FFF" />
          <Text style={styles.controlLabel}>{isMuted ? 'Muted' : 'Mic'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.controlBtn, isSpeaker && styles.controlActive]} onPress={() => setIsSpeaker(!isSpeaker)}>
          <Ionicons name={isSpeaker ? 'volume-high' : 'volume-medium'} size={26} color="#FFF" />
          <Text style={styles.controlLabel}>{t('messages.audio')}</Text>
        </TouchableOpacity>

        {callType === 'video' && (
          <TouchableOpacity style={[styles.controlBtn, !isVideoEnabled && styles.controlActive]} onPress={() => setIsVideoEnabled(!isVideoEnabled)}>
            <Ionicons name={isVideoEnabled ? 'videocam' : 'videocam-off'} size={26} color="#FFF" />
            <Text style={styles.controlLabel}>{t('ar.photo')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.controlBtn, { backgroundColor: 'transparent' }]}
          onPress={() => conversationId && navigation.navigate('Chat', { conversationId, recipientName, recipientId })}>
          <Ionicons name="chatbubble-ellipses" size={26} color="#FFF" />
          <Text style={styles.controlLabel}>{t('messages.messages')}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.endCallBtn} onPress={endCall}>
        <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
      </TouchableOpacity>

      {callType === 'video' && isVideoEnabled && (
        <View style={styles.selfVideoPreview}>
          <Ionicons name="person" size={24} color="rgba(255,255,255,0.5)" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingBottom: 60 },
  videoBackground: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A2E' },
  topArea: { paddingTop: 70, alignItems: 'center', gap: 8 },
  callTypeLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' },
  e2eBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  center: { alignItems: 'center' },
  avatarPulse: { width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(124,58,237,0.2)', justifyContent: 'center', alignItems: 'center' },
  avatarWrap: { width: 100, height: 100, borderRadius: 50, backgroundColor: BRAND.primary, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  recipientName: { color: '#FFF', fontSize: 26, fontWeight: '800', marginTop: 20 },
  statusText: { color: 'rgba(255,255,255,0.6)', fontSize: 16, marginTop: 8 },
  controls: { flexDirection: 'row', gap: 20 },
  controlBtn: { alignItems: 'center', gap: 6, width: 64, paddingVertical: 10, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)' },
  controlActive: { backgroundColor: 'rgba(124,58,237,0.4)' },
  controlLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
  endCallBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
  selfVideoPreview: { position: 'absolute', top: 60, right: 20, width: 100, height: 140, borderRadius: 16, backgroundColor: '#2A2A3E', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: BRAND.primary },
});
