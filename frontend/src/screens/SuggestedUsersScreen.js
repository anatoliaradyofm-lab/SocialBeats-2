import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, StyleSheet,
  ActivityIndicator, TextInput, Alert, SectionList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import api from '../services/api';

const TABS = [
  { id: 'suggested', label: 'Öneriler', icon: 'sparkles' },
  { id: 'popular', label: 'Popüler', icon: 'trending-up' },
  { id: 'contacts', label: 'Rehber', icon: 'call' },
];

export default function SuggestedUsersScreen({ navigation }) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState('suggested');
  const [suggested, setSuggested] = useState([]);
  const [popular, setPopular] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followedIds, setFollowedIds] = useState(new Set());
  const [phoneInput, setPhoneInput] = useState('');
  const [searchingContacts, setSearchingContacts] = useState(false);

  useEffect(() => {
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sugRes, popRes] = await Promise.all([
        api.get('/social/suggested-users', token).catch(() => ({ users: [] })),
        api.get('/social/popular-users', token).catch(() => ({ users: [] })),
      ]);
      setSuggested(sugRes.users || []);
      setPopular(popRes.users || []);
    } catch {}
    setLoading(false);
  };

  const toggleFollow = async (userId) => {
    const isFollowed = followedIds.has(userId);
    setFollowedIds(prev => {
      const next = new Set(prev);
      isFollowed ? next.delete(userId) : next.add(userId);
      return next;
    });
    try {
      if (isFollowed) {
        await api.delete(`/social/unfollow/${userId}`, token);
      } else {
        await api.post(`/social/follow/${userId}`, {}, token);
      }
    } catch {}
  };

  const searchContacts = async () => {
    if (!phoneInput.trim()) {
      Alert.alert('Uyarı', 'Lütfen telefon numarası girin');
      return;
    }
    setSearchingContacts(true);
    try {
      const numbers = phoneInput.split(',').map(n => n.trim()).filter(n => n.length > 0);
      const res = await api.post('/social/find-by-phone', { phone_numbers: numbers }, token);
      setContacts(res.users || []);
      if ((res.users || []).length === 0) {
        Alert.alert('Sonuç', 'Bu numaralara kayıtlı kullanıcı bulunamadı');
      }
    } catch {
      Alert.alert('Hata', 'Arama sırasında bir hata oluştu');
    }
    setSearchingContacts(false);
  };

  const renderUserCard = (item) => {
    const uid = item.id || item._id;
    const isFollowed = followedIds.has(uid) || item.is_following;
    return (
      <TouchableOpacity style={[styles.userRow, { borderBottomColor: colors.border }]} onPress={() => navigation.navigate('UserProfile', { userId: uid })}>
        <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated }]}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
          ) : (
            <Ionicons name="person" size={22} color={BRAND.primaryLight} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{item.display_name || item.username}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>@{item.username}</Text>
          {item.mutual_friends > 0 && (
            <Text style={{ color: BRAND.primaryLight, fontSize: 11, marginTop: 2 }}>{item.mutual_friends} ortak arkadaş</Text>
          )}
          {item.common_genres?.length > 0 && (
            <Text style={{ color: '#10B981', fontSize: 11, marginTop: 1 }}>Ortak: {item.common_genres.slice(0, 3).join(', ')}</Text>
          )}
          {activeTab === 'popular' && item.followers_count != null && (
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>{item.followers_count} takipçi</Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.followBtn, isFollowed ? { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border } : { backgroundColor: BRAND.primary }]}
          onPress={() => toggleFollow(uid)}
        >
          <Text style={{ color: isFollowed ? colors.text : '#FFF', fontSize: 12, fontWeight: '600' }}>
            {isFollowed ? 'Takipte' : 'Takip Et'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const currentData = activeTab === 'suggested' ? suggested : activeTab === 'popular' ? popular : contacts;

  if (loading) return (
    <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={BRAND.primary} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Kişileri Keşfet</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive, activeTab === tab.id && { borderBottomColor: BRAND.primary }]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons name={tab.icon} size={16} color={activeTab === tab.id ? BRAND.primary : colors.textMuted} />
            <Text style={{ color: activeTab === tab.id ? BRAND.primary : colors.textMuted, fontSize: 13, fontWeight: activeTab === tab.id ? '600' : '400' }}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
              </View>

      {activeTab === 'contacts' && (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <View style={[styles.phoneInputWrap, { backgroundColor: colors.surfaceElevated }]}>
            <Ionicons name="call-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.phoneInput, { color: colors.text }]}
              placeholder="Telefon numarası (virgülle ayırın)"
              placeholderTextColor={colors.textMuted}
              value={phoneInput}
              onChangeText={setPhoneInput}
              keyboardType="phone-pad"
            />
              </View>
              <TouchableOpacity
            style={[styles.searchBtn, { opacity: searchingContacts ? 0.6 : 1 }]}
            onPress={searchContacts}
            disabled={searchingContacts}
          >
            {searchingContacts ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={{ color: '#FFF', fontWeight: '600' }}>Rehberde Ara</Text>
            )}
              </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={currentData}
        renderItem={({ item }) => renderUserCard(item)}
        keyExtractor={(item, i) => item.id || item._id || `${i}`}
        contentContainerStyle={{ paddingBottom: 80 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 80 }}>
            <Ionicons
              name={activeTab === 'contacts' ? 'call-outline' : activeTab === 'popular' ? 'trending-up-outline' : 'people-outline'}
              size={48}
              color={colors.textMuted}
            />
            <Text style={{ color: colors.textMuted, marginTop: 16 }}>
              {activeTab === 'contacts' ? 'Numaraları girerek rehberden arayın' : activeTab === 'popular' ? 'Popüler kullanıcı bulunamadı' : 'Öneri bulunamadı'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: {},
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  followBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  phoneInputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 14, height: 46, gap: 10 },
  phoneInput: { flex: 1, fontSize: 14 },
  searchBtn: { backgroundColor: BRAND.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 8 },
});
