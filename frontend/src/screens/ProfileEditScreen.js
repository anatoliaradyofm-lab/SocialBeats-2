import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';
import LocationPicker from '../components/LocationPicker';

const BIO_MAX = 200;

export default function ProfileEditScreen({ navigation }) {
  const { user, token, setUser } = useAuth();
  const { colors } = useTheme();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [website, setWebsite] = useState(user?.website || '');
  const [location, setLocation] = useState(user?.location || '');
  const [birthDate, setBirthDate] = useState(user?.birth_date || '');
  const [isPrivate, setIsPrivate] = useState(user?.is_private || false);
  const [avatar, setAvatar] = useState(user?.avatar_url || null);
  const [cover, setCover] = useState(user?.cover_url || null);
  const [loading, setLoading] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(null);
  const usernameTimer = useRef(null);

  const checkUsername = (val) => {
    setUsername(val);
    setUsernameStatus(null);
    if (val === user?.username) return;
    if (val.length < 3) { setUsernameStatus('short'); return; }
    if (!/^[a-zA-Z0-9._]+$/.test(val)) { setUsernameStatus('invalid'); return; }

    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    usernameTimer.current = setTimeout(async () => {
      try {
        const res = await api.get(`/users/check-username?username=${val}`, token);
        setUsernameStatus(res.available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('error');
      }
    }, 500);
  };

  const pickImage = async (type) => {
    try {
      const ImagePicker = require('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: type === 'cover' ? [16, 9] : [1, 1],
      });
      if (!result.canceled && result.assets?.[0]) {
        if (type === 'avatar') {
          setAvatar(result.assets[0].uri);
          try {
            const url = await api.uploadFile('/storage/avatar', result.assets[0].uri, token);
            if (url) { setAvatar(url); if (setUser) setUser(prev => ({ ...prev, avatar_url: url })); }
          } catch {}
        } else {
          setCover(result.assets[0].uri);
          try { await api.uploadFile('/user/cover', result.assets[0].uri, token); } catch {}
        }
      }
    } catch {}
  };

  const handleSave = async () => {
    if (bio.length > BIO_MAX) {
      Alert.alert('Uyarı', `Biyografi en fazla ${BIO_MAX} karakter olabilir`);
      return;
    }
    if (username !== user?.username && usernameStatus === 'taken') {
      Alert.alert('Uyarı', 'Bu kullanıcı adı zaten alınmış');
      return;
    }
    if (username.length < 3) {
      Alert.alert('Uyarı', 'Kullanıcı adı en az 3 karakter olmalı');
      return;
    }

    setLoading(true);
    try {
      const body = {
        display_name: displayName,
        username,
        bio,
        website,
        location,
        birth_date: birthDate,
        is_private: isPrivate,
      };
      await api.put('/user/profile', body, token);
      if (setUser) setUser(prev => ({ ...prev, ...body }));
      navigation.goBack();
    } catch (err) {
      const msg = err?.data?.detail || 'Profil güncellenemedi';
      Alert.alert('Hata', msg);
    }
    setLoading(false);
  };

  const usernameHint = () => {
    if (!usernameStatus || username === user?.username) return null;
    const map = {
      short: { text: 'En az 3 karakter', color: '#F59E0B' },
      invalid: { text: 'Sadece harf, rakam, . ve _ kullanın', color: '#EF4444' },
      taken: { text: 'Bu kullanıcı adı alınmış', color: '#EF4444' },
      available: { text: 'Kullanılabilir', color: '#10B981' },
      error: { text: 'Kontrol edilemedi', color: '#F59E0B' },
    };
    const info = map[usernameStatus];
    return info ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
        <Ionicons name={usernameStatus === 'available' ? 'checkmark-circle' : usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'close-circle' : 'alert-circle'} size={14} color={info.color} />
        <Text style={{ color: info.color, fontSize: 11 }}>{info.text}</Text>
      </View>
    ) : null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.textSecondary, fontSize: 15 }}>İptal</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profili Düzenle</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color={BRAND.primary} /> :
            <Text style={{ color: BRAND.primary, fontSize: 15, fontWeight: '600' }}>Kaydet</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.coverSection} onPress={() => pickImage('cover')}>
          {cover ? <Image source={{ uri: cover }} style={styles.coverImg} /> : <View style={[styles.coverImg, { backgroundColor: colors.surfaceElevated }]} />}
          <View style={styles.coverEditIcon}><Ionicons name="camera" size={16} color="#FFF" /></View>
        </TouchableOpacity>

        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={() => pickImage('avatar')}>
            <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated, borderColor: colors.background }]}>
              {avatar ? <Image source={{ uri: avatar }} style={styles.avatar} /> : <Ionicons name="person" size={36} color={BRAND.primaryLight} />}
            </View>
            <View style={styles.avatarEditIcon}><Ionicons name="camera" size={14} color="#FFF" /></View>
          </TouchableOpacity>
        </View>

        <View style={styles.fields}>
          <View style={[styles.field, { borderBottomColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Ad</Text>
            <TextInput style={[styles.fieldInput, { color: colors.text }]} value={displayName} onChangeText={setDisplayName} placeholder="Görünen adınız" placeholderTextColor={colors.textMuted} />
          </View>

          <View style={[styles.field, { borderBottomColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Kullanıcı Adı</Text>
            <TextInput style={[styles.fieldInput, { color: colors.text }]} value={username} onChangeText={checkUsername} placeholder="kullaniciadi" placeholderTextColor={colors.textMuted} autoCapitalize="none" />
            {usernameHint()}
          </View>

          <View style={[styles.field, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Bio</Text>
              <Text style={{ color: bio.length > BIO_MAX ? '#EF4444' : colors.textMuted, fontSize: 11 }}>{bio.length}/{BIO_MAX}</Text>
            </View>
            <TextInput
              style={[styles.fieldInput, { color: colors.text, minHeight: 60, textAlignVertical: 'top' }]}
              value={bio} onChangeText={setBio}
              placeholder="Kendinizden bahsedin..."
              placeholderTextColor={colors.textMuted}
              multiline maxLength={BIO_MAX + 10}
            />
          </View>

          <View style={[styles.field, { borderBottomColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Web Sitesi</Text>
            <TextInput style={[styles.fieldInput, { color: colors.text }]} value={website} onChangeText={setWebsite} placeholder="https://" placeholderTextColor={colors.textMuted} keyboardType="url" />
          </View>

          <View style={[styles.field, { borderBottomColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Konum</Text>
            <TouchableOpacity
              style={[styles.fieldInput, { justifyContent: 'center' }]}
              onPress={() => setShowLocationPicker(true)}
            >
              <Text style={{ color: location ? colors.text : colors.textMuted, fontSize: 15 }}>
                {location || 'Konum seç...'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.field, { borderBottomColor: colors.border }]}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Doğum Tarihi</Text>
            <TextInput style={[styles.fieldInput, { color: colors.text }]} value={birthDate} onChangeText={setBirthDate} placeholder="GG/AA/YYYY" placeholderTextColor={colors.textMuted} />
          </View>

          <View style={[styles.privacyRow, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 15 }}>Gizli Hesap</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>Sadece onaylanan takipçiler içeriklerinizi görebilir</Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: colors.border, true: BRAND.primaryLight }}
              thumbColor={isPrivate ? BRAND.primary : '#FFF'}
            />
          </View>
        </View>
      </ScrollView>

      <LocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={(loc) => setLocation(loc.name || '')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  coverSection: { height: 140, position: 'relative' },
  coverImg: { width: '100%', height: '100%' },
  coverEditIcon: { position: 'absolute', right: 12, bottom: 12, backgroundColor: 'rgba(0,0,0,0.5)', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  avatarSection: { alignItems: 'center', marginTop: -44 },
  avatar: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 4 },
  avatarEditIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: BRAND.primary, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  fields: { padding: 16 },
  field: { borderBottomWidth: 0.5, marginBottom: 4, paddingBottom: 8 },
  fieldLabel: { fontSize: 12, marginBottom: 4 },
  fieldInput: { fontSize: 15, paddingVertical: 6 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 0.5 },
});
