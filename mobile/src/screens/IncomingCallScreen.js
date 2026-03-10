/**
 * IncomingCallScreen - Gelen arama ekranı
 * Arama bildirimi (call_incoming) tıklandığında açılır. Kabul -> CallScreen, Red -> geri
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

export default function IncomingCallScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { conversationId, callerName, callType = 'video', callId } = route.params || {};
  const callerDisplayName = callerName || t('calls.caller');

  const accept = () => {
    navigation.replace('Call', {
      conversationId,
      callType: callType || 'video',
      otherUserName: callerDisplayName,
      isIncoming: true,
    });
  };

  const reject = () => {
    navigation.goBack();
  };

  const isVideo = callType !== 'voice';

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <View style={styles.avatar}>
          <Ionicons name={isVideo ? 'videocam' : 'call'} size={64} color="#fff" />
        </View>
        <Text style={styles.name}>{callerDisplayName}</Text>
        <Text style={styles.subtitle}>{isVideo ? t('calls.videoCall') : t('calls.voiceCall')}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.rejectBtn]} onPress={reject}>
          <Ionicons name="call-reject" size={36} color="#fff" />
          <Text style={styles.btnLabel}>{t('calls.decline')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.acceptBtn]} onPress={accept}>
          <Ionicons name="call" size={36} color="#fff" />
          <Text style={styles.btnLabel}>{t('calls.accept')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: 'space-between', padding: 24 },
  content: { alignItems: 'center', gap: 8 },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 16, color: '#9CA3AF' },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 48 },
  btn: { alignItems: 'center', gap: 8 },
  rejectBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#DC2626', justifyContent: 'center' },
  acceptBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#16A34A', justifyContent: 'center' },
  btnLabel: { fontSize: 14, color: colors.text, fontWeight: '600' },
});
