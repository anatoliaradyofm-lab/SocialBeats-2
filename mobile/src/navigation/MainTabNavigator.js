import React from 'react';
import { useTranslation } from 'react-i18next';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import DashboardScreen from '../screens/DashboardScreen';
import FeedScreen from '../screens/FeedScreen';
import SearchScreen from '../screens/SearchScreen';
import PlaylistsScreen from '../screens/PlaylistsScreen';
import ReelsScreen from '../screens/ReelsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const BOTTOM_PADDING = Math.max(insets.bottom, 8);
  const TAB_BAR_HEIGHT = 56 + BOTTOM_PADDING;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Home: focused ? 'home' : 'home-outline',
            Feed: focused ? 'musical-notes' : 'musical-notes-outline',
            Search: focused ? 'search' : 'search-outline',
            Playlists: focused ? 'list' : 'list-outline',
            Reels: focused ? 'videocam' : 'videocam-outline',
            Profile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name] || 'ellipse'} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#8B5CF6',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#0A0A0B',
          borderTopColor: '#1F2937',
          height: TAB_BAR_HEIGHT,
          paddingBottom: BOTTOM_PADDING,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11 },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ tabBarLabel: t('tabs.home'), tabBarAccessibilityLabel: t('tabs.home') }} />
      <Tab.Screen name="Feed" component={FeedScreen} options={{ tabBarLabel: t('tabs.feed'), tabBarAccessibilityLabel: t('tabs.feed') }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarLabel: t('tabs.discover'), tabBarAccessibilityLabel: t('tabs.discover') }} />
      <Tab.Screen name="Playlists" component={PlaylistsScreen} options={{ tabBarLabel: t('tabs.playlists'), tabBarAccessibilityLabel: t('tabs.playlists') }} />
      <Tab.Screen name="Reels" component={ReelsScreen} options={{ tabBarLabel: t('tabs.reels'), tabBarAccessibilityLabel: t('tabs.reels') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: t('tabs.profile'), tabBarAccessibilityLabel: t('tabs.profile') }} />
    </Tab.Navigator>
  );
}
