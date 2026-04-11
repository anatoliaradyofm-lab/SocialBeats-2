import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Share } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../services/api';
import { Alert } from '../ui/AppAlert';

export default function ProfileShareQR() {
  const { user } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);

  const base = (getApiUrl() || '').replace(/\/api\/?$/, '') || 'https://socialbeats.app';
  const profileUrl = `${base}/@${user?.username || ''}`;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `SocialBeats profilim: ${profileUrl}`,
        title: `${user?.display_name || user?.username || 'Profil'} - SocialBeats`,
      });
    } catch (err) {
      if (err.message !== 'User did not share') Alert.alert('Hata', err.message);
    }
  };

  let QRCode = null;
  try {
    QRCode = require('react-native-qrcode-svg').default;
  } catch (_) {
    // Package not installed - show fallback
  }

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={() => setModalVisible(true)}>
        <Text style={styles.buttonText}>QR ile Paylaş</Text>
      </TouchableOpacity>
      <Modal visible={modalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Profil Paylaş</Text>
            <Text style={styles.profileUrl}>@{user?.username}</Text>
            {QRCode ? (
              <View style={styles.qrWrap}>
                <QRCode value={profileUrl} size={180} backgroundColor="#fff" color="#0A0A0B" />
              </View>
            ) : (
              <View style={styles.qrPlaceholder}>
                <Text style={styles.qrPlaceholderText}>QR kodu görüntülemek için{'\n'}react-native-qrcode-svg kurulu olmalıdır</Text>
              </View>
            )}
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Text style={styles.shareBtnText}>Bağlantıyı Paylaş</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#1F2937', borderRadius: 8, alignSelf: 'center' },
  buttonText: { color: '#8B5CF6', fontSize: 14, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#1F2937', borderRadius: 20, padding: 24, width: '100%', maxWidth: 320, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  profileUrl: { fontSize: 16, color: '#8B5CF6', marginBottom: 20 },
  qrWrap: { padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 20 },
  qrPlaceholder: { width: 180, height: 180, backgroundColor: '#374151', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  qrPlaceholderText: { color: '#9CA3AF', fontSize: 12, textAlign: 'center' },
  shareBtn: { backgroundColor: '#8B5CF6', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, width: '100%', alignItems: 'center', marginBottom: 12 },
  shareBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  closeBtn: { paddingVertical: 12 },
  closeBtnText: { color: '#9CA3AF', fontSize: 14 },
});
