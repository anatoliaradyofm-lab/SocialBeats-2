import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, TextInput, useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { usePlayer } from '../contexts/PlayerContext';
import axios from 'axios';

// Backend URL (Frankfurt lokasyonlu Cloud Run servisiniz)
const BACKEND_URL = 'https://YOUR_CLOUD_RUN_URL_HERE'; 

export default function AudiomackScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { playTrack } = usePlayer();

  const [searchQuery, setSearchQuery] = useState('');
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchTracks = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const response = await axios.get(`${BACKEND_URL}/search`, {
        params: { q: searchQuery }
      });
      setTracks(response.data.results || []);
    } catch (error) {
      console.error('Audiomack search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = async (item) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/stream/${item.id}`);
      const streamUrl = response.data.stream_url;

      // PlayerContext'e uygun track objesini hazırlıyoruz
      const trackToPlay = {
        id: `am_${item.id}`,
        title: item.title,
        artist: item.artist,
        artwork: item.image,
        url: streamUrl,
        duration: item.duration,
        isAudiomack: true
      };

      playTrack(trackToPlay);
    } catch (error) {
      console.error('Playback error:', error);
    }
  };

  const renderTrack = ({ item }) => (
    <TouchableOpacity
      style={styles.trackCard}
      onPress={() => handlePlay(item)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: item.image }} style={styles.artwork} />
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.trackArtist} numberOfLines={1}>{item.artist}</Text>
      </View>
      <Ionicons name="play-circle" size={32} color={colors.primary || '#8B5CF6'} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Audiomack Pro</Text>
        <Text style={styles.headerSubtitle}>Legal Music Streaming</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Sanatçı veya şarkı ara..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={searchTracks}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={searchTracks}>
          <Ionicons name="search" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      ) : (
        <FlatList
          data={tracks}
          renderItem={renderTrack}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Audiomack kütüphanesinde keşfe başla!</Text>
          }
        />
      )}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background || '#0A0A0B',
  },
  header: {
    padding: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text || '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '600',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    height: 50,
    backgroundColor: '#1A1A1C',
    borderRadius: 12,
    paddingHorizontal: 15,
    color: '#fff',
    fontSize: 16,
  },
  searchBtn: {
    width: 50,
    height: 50,
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  listContent: {
    paddingHorizontal: 15,
    paddingBottom: 100,
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161618',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  artwork: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#333',
  },
  trackInfo: {
    flex: 1,
    marginLeft: 15,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  trackArtist: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 15,
  },
});
