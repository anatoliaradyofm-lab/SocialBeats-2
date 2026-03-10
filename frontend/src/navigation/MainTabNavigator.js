import React from 'react';
import { View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationContext';

import DashboardScreen from '../screens/DashboardScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import LibraryScreen from '../screens/LibraryScreen';
import PeopleDiscoverScreen from '../screens/PeopleDiscoverScreen';
import ReelsScreen from '../screens/ReelsScreen';
import MusicRoomsScreen from '../screens/MusicRoomsScreen';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home: { active: 'home', inactive: 'home-outline' },
  Discover: { active: 'compass', inactive: 'compass-outline' },
  Library: { active: 'library', inactive: 'library-outline' },
  People: { active: 'people', inactive: 'people-outline' },
  Social: { active: 'play-circle', inactive: 'play-circle-outline' },
  Rooms: { active: 'radio', inactive: 'radio-outline' },
};

const BADGE_TABS = ['Home', 'People'];

export default function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const { colors, brand } = useTheme();
  const { unreadCount } = useNotifications();
  const BOTTOM = Math.max(insets.bottom, 6);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, size }) => {
          const iconSet = TAB_ICONS[route.name];
          const showBadge = BADGE_TABS.includes(route.name) && unreadCount > 0;
          return (
            <View style={{ alignItems: 'center' }}>
              <View>
                <Ionicons
                  name={focused ? iconSet.active : iconSet.inactive}
                  size={size - 2}
                  color={focused ? brand.primary : colors.textMuted}
                />
                {showBadge && (
                  <View style={{
                    position: 'absolute',
                    top: -3,
                    right: -8,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: '#EF4444',
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 4,
                  }}>
                    <Text style={{
                      color: '#FFF',
                      fontSize: 9,
                      fontWeight: '700',
                    }}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
              {focused && (
                <View style={{
                  width: 4, height: 4, borderRadius: 2,
                  backgroundColor: brand.accent, marginTop: 3,
                }} />
              )}
            </View>
          );
        },
        tabBarActiveTintColor: brand.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 0.5,
          height: 52 + BOTTOM,
          paddingBottom: BOTTOM,
          paddingTop: 6,
          elevation: 0,
          shadowOpacity: 0,
        },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="People" component={PeopleDiscoverScreen} />
      <Tab.Screen name="Social" component={ReelsScreen} />
      <Tab.Screen name="Rooms" component={MusicRoomsScreen} />
    </Tab.Navigator>
  );
}
