/**
 * ProfileEditScreen — QENARA Design System 2026
 * Edit own profile · Dark premium aesthetic
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Image, Switch, Modal, FlatList, Platform, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { COUNTRIES } from '../lib/countries';
import { Alert } from '../components/ui/AppAlert';

/* ── palette shortcuts ── */
const C = {
  bg:          '#08060F',
  surface:     'rgba(255,255,255,0.055)',
  surfaceHigh: 'rgba(255,255,255,0.09)',
  border:      'rgba(255,255,255,0.08)',
  inputBorder: 'rgba(255,255,255,0.09)',
  primary:     '#C084FC',
  primaryGlow: 'rgba(192,132,252,0.32)',
  accent:      '#FB923C',
  text:        '#F8F8F8',
  textSec:     'rgba(248,248,248,0.55)',
  textMuted:   'rgba(248,248,248,0.32)',
  coverPh:     'rgba(255,255,255,0.04)',
};

/* ── Section label ── */
function SectionLabel({ label }) {
  return (
    <Text style={s.sectionLabel}>{label}</Text>
  );
}

/* ── Icon-prefixed input ── */
function FieldInput({ icon, placeholder, value, onChangeText, multiline, keyboardType, autoCapitalize, autoCorrect, maxLength, suffix }) {
  return (
    <View style={s.fieldWrap}>
      <View style={s.fieldIcon}>
        <Ionicons name={icon} size={18} color={C.textMuted} />
      </View>
      <TextInput
        style={[s.fieldInput, multiline && s.fieldMulti]}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={autoCorrect ?? true}
        maxLength={maxLength}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
      {suffix ? <Text style={s.fieldSuffix}>{suffix}</Text> : null}
    </View>
  );
}

export default function ProfileEditScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user: authUser, token, updateUser } = useAuth();
  const { t } = useTranslation();

  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [displayName, setDisplayName]       = useState('');
  const [username, setUsername]             = useState('');
  const [avatarUrl, setAvatarUrl]           = useState('');

  const [bio, setBio]                       = useState('');
  const [birthDate, setBirthDate]           = useState('');
  const [location, setLocation]             = useState('');
  const [website, setWebsite]               = useState('');
  const [instagram, setInstagram]           = useState('');
  const [twitter, setTwitter]               = useState('');
  const [country, setCountry]               = useState('');
  const [city, setCity]                     = useState('');
  const [isPrivate, setIsPrivate]           = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countryQuery, setCountryQuery]     = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);


  /* ── Gallery picker ── */
  const pickAvatar = async () => {
    try {
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status === 'denied') {
          Alert.alert('İzin gerekli', "Ayarlar'dan galeri erişimine izin verin.");
          return;
        }
      } catch {}
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setUploadingAvatar(true);
        try {
          const url = await api.uploadFile(result.assets[0].uri, token, 'avatar', 'image/jpeg');
          setAvatarUrl(url);
        } catch (e) {
          Alert.alert('Hata', e?.data?.detail || e?.message || 'Yükleme başarısız');
        } finally { setUploadingAvatar(false); }
      }
    } catch (err) { Alert.alert('Hata', err.message || 'Fotoğraf seçilemedi'); }
  };

  /* ── Doğum tarihi yardımcıları ── */
  const isoToDMY = (iso) => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return iso;
  };
  const dmyToIso = (dmy) => {
    const digits = dmy.replace(/\D/g, '');
    if (digits.length < 8) return '';
    return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
  };
  const handleBirthInput = (text) => {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    let v = digits;
    if (digits.length > 4) v = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) v = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setBirthDate(v);
  };

  /* ── Load ── */
  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const data = await api.get('/auth/me', token);
      setDisplayName(data.display_name || data.username || '');
      setUsername(data.username || '');
      setAvatarUrl(data.avatar_url || '');

      setBio(data.bio || '');
      setBirthDate(isoToDMY(data.birth_date));
      setLocation(data.location || '');
      setWebsite(data.website || '');
      setInstagram(data.instagram || '');
      setTwitter(data.twitter || '');
      setCountry(data.country || '');
      setCity(data.city || '');
      setIsPrivate(!!data.is_private);
      if (data.country) { try { localStorage.setItem('sb_country', data.country); } catch {} }
    } catch {
      setDisplayName(authUser?.display_name || authUser?.username || '');
      setUsername(authUser?.username || '');
      setAvatarUrl(authUser?.avatar_url || '');

      setBio(authUser?.bio || '');
      setBirthDate(isoToDMY(authUser?.birth_date));
      setLocation(authUser?.location || '');
      setWebsite(authUser?.website || '');
      setInstagram(authUser?.instagram || '');
      setTwitter(authUser?.twitter || '');
      setCountry(authUser?.country || '');
      setCity(authUser?.city || '');
      setIsPrivate(!!authUser?.is_private);
    } finally { setLoading(false); }
  };

  /* ── Save ── */
  const handleSave = async () => {
    setSaving(true);
    try {
      const newUsername = (username || '').trim().toLowerCase();
      if (newUsername && newUsername.length < 3) {
        Alert.alert('Hata', 'Kullanıcı adı en az 3 karakter olmalı');
        setSaving(false);
        return;
      }
      /* PUT returns the full updated MongoDB document — use it directly */
      const updated = await api.put(
        '/user/profile',
        {
          display_name: displayName.trim() || null,
          username:     newUsername || authUser?.username || null,
          avatar_url:   avatarUrl.trim() || null,
          bio:          (bio || '').slice(0, 200).trim() || null,
          birth_date:   dmyToIso(birthDate) || null,
          location:     location.trim() || null,
          website:      website.trim() || null,
          instagram:    instagram.replace('@', '').trim() || null,
          twitter:      twitter.replace('@', '').trim() || null,
          country:      country.trim() || null,
          city:         city.trim() || null,
          is_private:   isPrivate,
        },
        token
      );
      /* Sync country to shared localStorage key so LanguageRegionScreen stays in sync */
      if (country) { try { localStorage.setItem('sb_country', country.trim()); } catch {} }
      /* Merge with authUser so computed fields (followers_count etc.) are preserved */
      await updateUser?.({ ...authUser, ...(updated || {}) });
      navigation.goBack();
    } catch (err) {
      const msg = err.data?.detail || err.message || 'Güncelleme başarısız';
      Alert.alert('Hata', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally { setSaving(false); }
  };

  const handleCountryPick = (item) => {
    setCountry(item.name);
    setShowCountryPicker(false);
    setCountryQuery('');
    try { localStorage.setItem('sb_country', item.name); } catch {}
  };

  const CountrySheet = () => (
    <View style={[cp.sheet, { paddingBottom: insets.bottom + 16 }]}>
      <View style={cp.handle} />
      <View style={cp.headerRow}>
        <Text style={[cp.title, { color: C.text }]}>Ülke Seç</Text>
        <TouchableOpacity onPress={() => { setShowCountryPicker(false); setCountryQuery(''); }} style={cp.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={22} color={C.textMuted} />
        </TouchableOpacity>
      </View>
      <View style={cp.searchRow}>
        <Ionicons name="search-outline" size={16} color={C.textMuted} />
        <TextInput
          style={cp.searchInput}
          placeholder="Ülke ara..."
          placeholderTextColor={C.textMuted}
          value={countryQuery}
          onChangeText={setCountryQuery}
          autoFocus={Platform.OS !== 'web'}
        />
        {countryQuery.length > 0 && (
          <TouchableOpacity onPress={() => setCountryQuery('')}>
            <Ionicons name="close-circle" size={16} color={C.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={COUNTRIES.filter(c => c.name.toLowerCase().includes(countryQuery.toLowerCase()))}
        keyExtractor={c => c.code}
        keyboardShouldPersistTaps="handled"
        style={{ maxHeight: 380 }}
        renderItem={({ item }) => (
          <TouchableOpacity style={cp.optRow} onPress={() => handleCountryPick(item)} activeOpacity={0.72}>
            <Text style={cp.flag}>{item.flag}</Text>
            <Text style={[cp.optLabel, { color: country === item.name ? C.primary : C.text, fontWeight: country === item.name ? '700' : '500' }]}>
              {item.name}
            </Text>
            {country === item.name && <Ionicons name="checkmark-circle" size={18} color={C.primary} />}
          </TouchableOpacity>
        )}
      />
    </View>
  );

  const avatarSrc = avatarUrl ? { uri: avatarUrl } : { uri: `https://i.pravatar.cc/200?u=${authUser?.username}` };

  /* ── Loading state ── */
  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBack}>
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Profil Düzenle</Text>
          <View style={{ width: 72 }} />
        </View>
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBack}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Profil Düzenle</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={s.saveWrap}>
          <LinearGradient colors={['#9333EA', '#C084FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveGrad}>
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.saveText}>Kaydet</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Avatar ── */}
        <View style={s.avatarRow}>
          <View style={s.avatarRingWrap}>
            <LinearGradient colors={['#C084FC', '#FB923C']} style={s.avatarRing}>
              <Image source={avatarSrc} style={s.avatar} />
            </LinearGradient>
            {uploadingAvatar && (
              <View style={s.avatarSpinner}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
          </View>
          <TouchableOpacity style={s.galleryBtn} onPress={pickAvatar} disabled={uploadingAvatar} activeOpacity={0.85}>
            <LinearGradient
              colors={['#9333EA', '#C084FC']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.galleryBtnInner}
            >
              <Ionicons name="images-outline" size={18} color="#fff" />
              <Text style={s.galleryBtnTxt}>Fotoğraf Değiştir</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Temel Bilgiler ── */}
        <SectionLabel label="TEMEL BİLGİLER" />
        <FieldInput
          icon="person-outline"
          placeholder="Görünen ad"
          value={displayName}
          onChangeText={setDisplayName}
        />
        <FieldInput
          icon="at-outline"
          placeholder="Kullanıcı adı"
          value={username}
          onChangeText={(v) => setUsername((v || '').toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={s.fieldWrap}>
          <View style={s.fieldIcon}>
            <Ionicons name="document-text-outline" size={18} color={C.textMuted} />
          </View>
          <TextInput
            style={[s.fieldInput, s.fieldMulti]}
            placeholder="Biyografi (max 200 karakter)"
            placeholderTextColor={C.textMuted}
            value={bio}
            onChangeText={(v) => setBio(v.slice(0, 200))}
            multiline
            maxLength={200}
            textAlignVertical="top"
          />
          {bio.length > 0 && (
            <Text style={s.charCount}>{bio.length}/200</Text>
          )}
        </View>
        <View style={s.fieldWrap}>
          <View style={s.fieldIcon}>
            <Ionicons name="calendar-outline" size={18} color={C.textMuted} />
          </View>
          <TextInput
            style={s.fieldInput}
            placeholder="Doğum tarihi (GG/AA/YYYY)"
            placeholderTextColor={C.textMuted}
            value={birthDate}
            onChangeText={handleBirthInput}
            keyboardType="number-pad"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={10}
          />
          {birthDate.replace(/\D/g,'').length === 8 && (
            <Text style={s.fieldSuffix}>
              {(() => {
                const digits = birthDate.replace(/\D/g,'');
                const y = parseInt(digits.slice(4,8)), m = parseInt(digits.slice(2,4)), d = parseInt(digits.slice(0,2));
                const today = new Date(); let age = today.getFullYear() - y;
                if (today.getMonth()+1 < m || (today.getMonth()+1 === m && today.getDate() < d)) age--;
                return age > 0 && age < 120 ? `${age} yaş` : '';
              })()}
            </Text>
          )}
        </View>
        <FieldInput
          icon="globe-outline"
          placeholder="Website"
          value={website}
          onChangeText={setWebsite}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* ── Sosyal Medya ── */}
        <SectionLabel label="SOSYAL MEDYA" />
        <FieldInput
          icon="logo-instagram"
          placeholder="Instagram kullanıcı adı"
          value={instagram}
          onChangeText={(v) => setInstagram(v.replace('@', ''))}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <FieldInput
          icon="logo-twitter"
          placeholder="Twitter / X kullanıcı adı"
          value={twitter}
          onChangeText={(v) => setTwitter(v.replace('@', ''))}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* ── Konum ── */}
        <SectionLabel label="KONUM" />

        {/* Country picker */}
        <TouchableOpacity
          style={[s.fieldWrap, s.selectRow]}
          onPress={() => { setCountryQuery(''); setShowCountryPicker(true); }}
          activeOpacity={0.8}
        >
          <View style={s.fieldIcon}>
            <Ionicons name="flag-outline" size={18} color={C.textMuted} />
          </View>
          <Text style={[s.fieldInput, { color: country ? C.text : C.textMuted, paddingTop: 0, paddingBottom: 0 }]}>
            {country
              ? `${COUNTRIES.find(c => c.name === country)?.flag ?? ''} ${country}`
              : 'Ülke seçin'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={C.textMuted} style={{ marginRight: 12 }} />
        </TouchableOpacity>

        <FieldInput
          icon="location-outline"
          placeholder="Şehir (örn. İstanbul)"
          value={city}
          onChangeText={setCity}
        />

        {/* ── Gizlilik ── */}
        <SectionLabel label="GİZLİLİK" />
        <View style={s.switchRow}>
          <View style={s.switchInfo}>
            <Ionicons name="lock-closed-outline" size={18} color={C.textMuted} style={{ marginRight: 12 }} />
            <View>
              <Text style={s.switchLabel}>Gizli Hesap</Text>
              <Text style={s.switchSub}>Sadece takipçileriniz görebilir</Text>
            </View>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={setIsPrivate}
            trackColor={{ false: 'rgba(255,255,255,0.1)', true: C.primaryGlow }}
            thumbColor={isPrivate ? C.primary : 'rgba(255,255,255,0.5)'}
          />
        </View>
      </ScrollView>

      {/* Country picker — root level, tam ekranı kaplar */}
      {Platform.OS === 'web' ? (
        showCountryPicker ? (
          <View style={[StyleSheet.absoluteFill, cp.overlay]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => { setShowCountryPicker(false); setCountryQuery(''); }} />
            <CountrySheet />
          </View>
        ) : null
      ) : (
        <Modal visible={showCountryPicker} animationType="slide" transparent onRequestClose={() => { setShowCountryPicker(false); setCountryQuery(''); }}>
          <Pressable style={cp.overlay} onPress={() => { setShowCountryPicker(false); setCountryQuery(''); }}>
            <Pressable onPress={e => e.stopPropagation()}>
              <CountrySheet />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  /* header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  headerBack:  { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: C.text, letterSpacing: -0.3 },
  saveWrap:    { borderRadius: 20, overflow: 'hidden' },
  saveGrad:    { paddingHorizontal: 18, paddingVertical: 9, alignItems: 'center', justifyContent: 'center', minWidth: 72 },
  saveText:    { fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },

  scroll:   { flex: 1 },
  content:  { paddingBottom: 40 },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center' },

  /* avatar */
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  avatarRingWrap: { position: 'relative' },
  avatarRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: C.surface },
  avatarSpinner: {
    position: 'absolute', inset: 0,
    borderRadius: 38,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  galleryBtn: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  galleryBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  galleryBtnTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },

  /* section label */
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textMuted,
    letterSpacing: 1.4,
    marginTop: 28,
    marginBottom: 12,
    paddingHorizontal: 20,
  },

  /* field input */
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 0.5,
    borderColor: C.inputBorder,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingRight: 14,
    minHeight: 50,
  },
  fieldIcon: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    color: C.text,
    paddingVertical: 14,
  },
  fieldMulti: {
    minHeight: 80,
    paddingTop: 14,
  },
  fieldSuffix: { fontSize: 13, color: C.textMuted },
  selectRow: { paddingRight: 0 },
  charCount: {
    fontSize: 11,
    color: C.textMuted,
    alignSelf: 'flex-end',
    paddingBottom: 10,
  },

  /* switch */
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    borderWidth: 0.5,
    borderColor: C.inputBorder,
    borderRadius: 14,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  switchInfo:  { flexDirection: 'row', alignItems: 'center', flex: 1 },
  switchLabel: { fontSize: 15, fontWeight: '500', color: C.text },
  switchSub:   { fontSize: 12, color: C.textMuted, marginTop: 2 },
});

const cp = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: '#08060F', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: '#0D0A18', borderTopLeftRadius: 32, borderTopRightRadius: 32, borderTopWidth: 1, borderColor: 'rgba(192,132,252,0.28)', minHeight: 420 },
  handle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(192,132,252,0.30)', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  title:     { fontSize: 17, fontWeight: '700' },
  closeBtn:  { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, gap: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 10 },
  optRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 20, gap: 12 },
  flag:      { width: 34, fontSize: 22 },
  optLabel:  { flex: 1, fontSize: 15 },
});
