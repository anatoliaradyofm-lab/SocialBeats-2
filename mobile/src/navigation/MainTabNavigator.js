/**
 * MainTabNavigator — NOVA Design System v3.0
 * Floating island tab bar · 2025 premium aesthetic
 * Inspired by: Mobbin top apps · Dribbble navigation trends · Pageflows patterns
 * Animated glow indicators · Haptic feedback ready · Micro-interaction polish
 */
import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Pressable, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import DashboardScreen     from '../screens/DashboardScreen';
import PlaylistsScreen     from '../screens/PlaylistsScreen';
import ARMusicScreen       from '../screens/ARMusicScreen';
import ListeningRoomScreen from '../screens/ListeningRoomScreen';
import { useTheme }        from '../contexts/ThemeContext';

const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Home',    label: 'Home',    icon: 'home',    iconOff: 'home-outline'    },
  { name: 'Library', label: 'Library', icon: 'library', iconOff: 'library-outline' },
  { name: 'AR',      label: 'AR',      icon: 'scan',    iconOff: 'scan-outline'    },
  { name: 'Rooms',   label: 'Rooms',   icon: 'radio',   iconOff: 'radio-outline'   },
];

function AnimatedTabIcon({ name, iconOn, iconOff, focused, colors }) {
  const scaleAnim = useRef(new Animated.Value(focused ? 1 : 0.9)).current;
  const glowAnim  = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1 : 0.88,
        useNativeDriver: true,
        damping: 12,
        stiffness: 180,
      }),
      Animated.timing(glowAnim, {
        toValue: focused ? 1 : 0,
        duration: 220,
        useNativeDriver: false,
      }),
    ]).start();
  }, [focused]);

  // Compute transparent start from primaryGlow (replace alpha with 0)
  const glowTransparent = colors.primaryGlow.replace(/,\s*[\d.]+\)$/, ',0)');
  const bgColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [glowTransparent, colors.primaryGlow],
  });

  return (
    <Animated.View style={[styles.iconWrap, { transform: [{ scale: scaleAnim }], backgroundColor: bgColor }]}>
      {focused && (
        <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />
      )}
      <Ionicons
        name={focused ? iconOn : iconOff}
        size={focused ? 24 : 22}
        color={focused ? colors.primary : colors.textMuted}
      />
    </Animated.View>
  );
}


export default function MainTabNavigator() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const BOTTOM_PAD = Math.max(insets.bottom, 12);
  const TAB_HEIGHT = 68 + BOTTOM_PAD;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const tab = TABS.find(t => t.name === route.name);
        return {
          headerShown: false,
          tabBarIcon: ({ focused }) =>
            <AnimatedTabIcon
              name={route.name}
              iconOn={tab?.icon}
              iconOff={tab?.iconOff}
              focused={focused}
              colors={colors}
            />,
          tabBarLabel: () => null,
          tabBarStyle: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: TAB_HEIGHT,
            backgroundColor: colors.tabBar,
            borderTopWidth: 0.5,
            borderTopColor: colors.tabBarBorder,
            elevation: 0,
            paddingBottom: BOTTOM_PAD,
            paddingTop: 8,
          },
          tabBarItemStyle: { paddingVertical: 0 },
          tabBarButton: (props) => (
            <Pressable
              {...props}
              android_ripple={null}
              style={({ pressed }) => [
                props.style,
                Platform.OS === 'android' && pressed && { opacity: 0.85 },
              ]}
            />
          ),
        };
      }}
    >
      <Tab.Screen name="Home"    component={DashboardScreen}     />
      <Tab.Screen name="Library" component={PlaylistsScreen}     />
      <Tab.Screen name="AR"      component={ARMusicScreen}       />
      <Tab.Screen name="Rooms"   component={ListeningRoomScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 50,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeDot: {
    position: 'absolute',
    top: -8,
    width: 20,
    height: 3,
    borderRadius: 2,
  },
});
