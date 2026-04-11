/**
 * ForwardTargetPickerScreen - Mesaj iletmek için hedef sohbet seçimi
 */
import React from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useConversationsQuery } from '../hooks/useConversationsQuery';
import { useTheme } from '../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert } from '../components/ui/AppAlert';

export default function ForwardTargetPickerScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { messageId, messagePreview } = route.params || {};
  const { token } = useAuth();
  const { data: conversations = [], isLoading } = useConversationsQuery(token);
  const [sending, setSending] = React.useState(false);

  const excludeId = route.params?.conversationId || route.params?.excludeConversationId;
  const targets = conversations.filter((c) => c.id !== excludeId);

  const forwardTo = async (conv) => {
    if (!token || !messageId || sending) return;
    setSending(true);
    try {
      await api.post(`/messages/forward?message_id=${messageId}&target_conversation_id=${conv.id}`, {}, token);
      Alert.alert('Başarılı', 'Mesaj iletildi', [{ text: 'Tamam', onPress: () => navigation.goBack() }]);
    } catch (e) {
      const msg = e?.data?.detail || e?.message || 'İletilemedi';
      Alert.alert(e?.status === 429 ? 'Çok hızlı' : 'Hata', msg);
    } finally {
      setSending(false);
    }
  };

  const getOtherUser = (conv) => {
    const others = conv.other_participants || [];
    return others[0] || {};
  };

  const renderItem = ({ item }) => {
    const isGroup = item.is_group;
    const other = getOtherUser(item);
    const displayName = isGroup ? (item.group_name || 'Grup') : (other.display_name || other.username || 'Kullanıcı');
    const avatar = isGroup ? (item.group_avatar || `https://i.pravatar.cc/100?g=${item.id}`) : (other.avatar_url || `https://i.pravatar.cc/100?u=${other.username || other.id}`);

    return (
      <TouchableOpacity style={styles.row} onPress={() => forwardTo(item)} disabled={sending}>
        <Image source={{ uri: avatar }} style={styles.avatar} />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
        </View>
        {sending ? <ActivityIndicator size="small" color="#8B5CF6" /> : <Ionicons name="arrow-forward" size={20} color="#8B5CF6" />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>İlet</Text>
          {messagePreview ? <Text style={styles.subtitle} numberOfLines={1}>"{messagePreview}"</Text> : null}
        </View>
      </View>
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8B5CF6" /></View>
      ) : (
        <FlatList
          data={targets}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={<Text style={styles.empty}>İletmek için sohbet yok</Text>}
        />
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  headerText: { flex: 1 },
  subtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  backBtn: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#1F2937', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  empty: { color: '#9CA3AF', textAlign: 'center', padding: 24 },
});
