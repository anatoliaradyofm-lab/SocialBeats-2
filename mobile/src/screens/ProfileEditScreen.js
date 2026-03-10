import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

export default function ProfileEditScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { user: authUser, token, updateUser } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [bio, setBio] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const pickAvatar = async (fromCamera = false) => {
    const { status: libStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!fromCamera && libStatus !== 'granted') {
      Alert.alert('İzin gerekli', 'Galeri erişimi için izin verin.');
      return;
    }
    if (fromCamera) {
      const camStatus = await ImagePicker.requestCameraPermissionsAsync();
      if (camStatus !== 'granted') {
        Alert.alert('İzin gerekli', 'Kamera erişimi için izin verin.');
        return;
      }
    }
    try {
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        })
        : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setUploadingAvatar(true);
        try {
          const url = await api.uploadFile(result.assets[0].uri, token, 'avatar', 'image/jpeg', { upload_type: 'avatar' });
          setAvatarUrl(url);
        } catch (e) {
          Alert.alert('Hata', e?.data?.detail || e?.message || 'Yükleme başarısız');
        } finally {
          setUploadingAvatar(false);
        }
      }
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('profileEdit.photoFailed'));
    }
  };

  const pickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.error'), t('profileEdit.galleryPermission'));
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setUploadingCover(true);
        try {
          const url = await api.uploadFile(result.assets[0].uri, token, 'cover', 'image/jpeg', { upload_type: 'cover' });
          setCoverUrl(url);
        } catch (e) {
          Alert.alert(t('common.error'), e?.data?.detail || e?.message || t('profileEdit.uploadFailed'));
        } finally {
          setUploadingCover(false);
        }
      }
    } catch (err) {
      Alert.alert(t('common.error'), err.message || t('profileEdit.photoFailed'));
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.get('/auth/me', token);
      setDisplayName(data.display_name || data.username || '');
      setUsername(data.username || '');
      setAvatarUrl(data.avatar_url || '');
      setCoverUrl(data.cover_url || '');
      setBio(data.bio || '');
      setBirthDate(data.birth_date || '');
      setLocation(data.location || '');
      setWebsite(data.website || '');
      setIsPrivate(!!data.is_private);
    } catch {
      setDisplayName(authUser?.display_name || authUser?.username || '');
      setUsername(authUser?.username || '');
      setAvatarUrl(authUser?.avatar_url || '');
      setCoverUrl(authUser?.cover_url || '');
      setBio(authUser?.bio || '');
      setBirthDate(authUser?.birth_date || '');
      setLocation(authUser?.location || '');
      setWebsite(authUser?.website || '');
      setIsPrivate(!!authUser?.is_private);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const newUsername = (username || '').trim().toLowerCase();
      if (newUsername && newUsername.length < 3) {
        Alert.alert('Hata', 'Kullanıcı adı en az 3 karakter olmalı');
        setSaving(false);
        return;
      }
      const updated = await api.put(
        '/user/profile',
        {
          display_name: displayName.trim() || null,
          username: newUsername || authUser?.username || null,
          avatar_url: avatarUrl.trim() || null,
          cover_url: coverUrl.trim() || null,
          bio: (bio || '').slice(0, 200).trim() || null,
          birth_date: birthDate.trim() || null,
          location: location.trim() || null,
          website: website.trim() || null,
          is_private: isPrivate,
        },
        token
      );
      updateUser?.(updated);
      Alert.alert('Başarılı', 'Profil güncellendi', [{ text: 'Tamam', onPress: () => navigation.goBack() }]);
    } catch (err) {
      const msg = err.data?.detail || err.message || 'Güncelleme başarısız';
      Alert.alert('Hata', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← İptal</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil Düzenle</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← {t('common.cancel')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.editProfile')}</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          {saving ? <ActivityIndicator size="small" color="#8B5CF6" /> : <Text style={styles.saveText}>{t('common.save', 'Kaydet')}</Text>}
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarSection}>
          <Image
            source={{ uri: avatarUrl || `https://i.pravatar.cc/200?u=${authUser?.username}` }}
            style={styles.avatar}
          />
          <View style={styles.avatarButtons}>
            <TouchableOpacity
              style={[styles.avatarBtn, uploadingAvatar && styles.avatarBtnDisabled]}
              onPress={() => pickAvatar(false)}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#8B5CF6" />
              ) : (
                <Text style={styles.avatarBtnText}>Galeriden seç</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.avatarBtn, uploadingAvatar && styles.avatarBtnDisabled]}
              onPress={() => pickAvatar(true)}
              disabled={uploadingAvatar}
            >
              <Text style={styles.avatarBtnText}>Kamera</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, styles.avatarUrlInput]}
            placeholder={t('profileEdit.pasteUrl', 'veya URL yapıştır')}
            placeholderTextColor="#6B7280"
            value={avatarUrl}
            onChangeText={setAvatarUrl}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.coverSection}>
          <Text style={styles.sectionLabel}>{t('profileEdit.coverPhoto', 'Kapak Fotoğrafı')}</Text>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Text style={styles.coverPlaceholderText}>{t('profileEdit.noCover', 'Kapak fotoğrafı yok')}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.avatarBtn, uploadingCover && styles.avatarBtnDisabled]}
            onPress={pickCover}
            disabled={uploadingCover}
          >
            {uploadingCover ? (
              <ActivityIndicator size="small" color="#8B5CF6" />
            ) : (
              <Text style={styles.avatarBtnText}>{t('profileEdit.changeCover', 'Kapak Değiştir')}</Text>
            )}
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Kullanıcı adı (benzersiz)"
          placeholderTextColor="#6B7280"
          value={username}
          onChangeText={(t) => setUsername((t || '').toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Görünen ad"
          placeholderTextColor="#6B7280"
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TextInput
          style={[styles.input, styles.bioInput]}
          placeholder="Biyografi (max 200 karakter)"
          placeholderTextColor="#6B7280"
          value={bio}
          onChangeText={(t) => setBio(t.slice(0, 200))}
          multiline
          numberOfLines={3}
          maxLength={200}
        />
        {bio.length > 0 && <Text style={styles.charCount}>{bio.length}/200</Text>}
        <TextInput
          style={styles.input}
          placeholder="Doğum tarihi (YYYY-MM-DD)"
          placeholderTextColor="#6B7280"
          value={birthDate}
          onChangeText={setBirthDate}
          keyboardType="numbers-and-punctuation"
        />
        <TextInput
          style={styles.input}
          placeholder="Konum"
          placeholderTextColor="#6B7280"
          value={location}
          onChangeText={setLocation}
        />
        <TextInput
          style={styles.input}
          placeholder="Website (örn. example.com)"
          placeholderTextColor="#6B7280"
          value={website}
          onChangeText={setWebsite}
          autoCapitalize="none"
          keyboardType="url"
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('profileEdit.privateAccount', 'Gizli hesap')}</Text>
          <Switch
            value={isPrivate}
            onValueChange={setIsPrivate}
            trackColor={{ false: '#374151', true: '#8B5CF6' }}
            thumbColor="#fff"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  backBtn: {},
  backText: { color: colors.accent, fontSize: 16 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  saveBtn: { minWidth: 60, alignItems: 'flex-end' },
  saveText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  scroll: { flex: 1 },
  content: { padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 12 },
  avatarButtons: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  avatarBtn: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#8B5CF6', borderRadius: 10 },
  avatarBtnDisabled: { opacity: 0.6 },
  avatarBtnText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  avatarUrlInput: { marginBottom: 0 },
  input: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    marginBottom: 16,
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 12, color: '#6B7280', alignSelf: 'flex-end', marginTop: -8, marginBottom: 8 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, marginBottom: 16 },
  switchLabel: { fontSize: 16, color: colors.text },
  coverSection: { marginBottom: 24 },
  sectionLabel: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 12 },
  coverImage: { width: '100%', height: 120, borderRadius: 12, marginBottom: 12 },
  coverPlaceholder: { width: '100%', height: 120, borderRadius: 12, backgroundColor: '#1F2937', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  coverPlaceholderText: { color: '#6B7280', fontSize: 14 },
});
