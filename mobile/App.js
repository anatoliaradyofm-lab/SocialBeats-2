// E2E: crypto polyfill - MUST be first (before any other imports)
import 'react-native-get-random-values';

import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { View, ActivityIndicator, Platform } from 'react-native';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { queryClient } from './src/lib/queryClient';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import { ScreenTimeProvider } from './src/contexts/ScreenTimeContext';
import { PlayerProvider } from './src/contexts/PlayerContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { AlertProvider } from './src/contexts/AlertContext';
import { InterstitialAdProvider } from './src/contexts/InterstitialAdContext';
import AppNavigator from './src/navigation/AppNavigator';
import MiniPlayer from './src/components/player/MiniPlayer';
import FullPlayer from './src/components/player/FullPlayer';
import notificationService from './src/services/notificationService';
import { navigate, navigationRef } from './src/navigation/navigationRef';
import ErrorBoundary from './src/components/ErrorBoundary';
import { AppAlertPortal } from './src/components/ui/AppAlert';
import localizationService from './src/services/LocalizationService';
import OnboardingScreen, { isOnboardingCompleted } from './src/screens/OnboardingScreen';
import OfflineBanner from './src/components/OfflineBanner';
import * as Linking from 'expo-linking';

// i18n
import './src/i18n';
import i18n from './src/i18n';
import { useTranslation } from 'react-i18next';
import { isRTL, applyRTL } from './src/i18n';

// Notification handler wrapper component
function NotificationHandler({ children }) {
  const { user, isAuthenticated } = useAuth();
  const notificationListenerRef = useRef(null);
  const responseListenerRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      // Initialize push notifications
      initializeNotifications();
    }

    return () => {
      notificationService.cleanup();
    };
  }, [isAuthenticated, user]);

  const initializeNotifications = async () => {
    try {
      const token = await notificationService.initialize(
        // On notification received (app in foreground)
        (notification) => {
          console.log('Notification received:', notification);
          // Optionally show in-app notification
        },
        // On notification response (user tapped notification)
        (response) => {
          console.log('Notification response:', response);
          const data = response.notification.request.content.data || {};
          const title = response.notification.request.content.title;

          if (data?.type === 'call') {
            const conversationId = data.conversation_id || (data.url || '').replace(/^messages\//, '') || '';
            if (conversationId && navigationRef.isReady()) {
              navigate('IncomingCall', {
                conversationId,
                callerName: data.caller_name || title || 'Arayan',
                callType: data.call_type || 'video',
                callId: data.call_id,
              });
            }
            return;
          }

          if (data?.url) {
            console.log('Navigate to:', data.url);
          }
        }
      );

      if (token) {
        console.log('Push token:', token);
      }
    } catch (error) {
      console.error('Error initializing notifications:', error);
    }
  };

  return children;
}

export default function App() {
  console.log("App component rendered on web!");
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [localeReady, setLocaleReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          ...Ionicons.font,
        });
        setFontsLoaded(true);
      } catch (error) {
        console.error('Error loading fonts:', error);
        setFontsLoaded(true);
      }
    }
    loadFonts();
  }, []);

  useEffect(() => {
    isOnboardingCompleted().then((completed) => {
      setShowOnboarding(!completed);
      setOnboardingChecked(true);
    });
  }, []);

  // Auto language and region: 1) preferred_language 2) geo/me 3) device locale
  useEffect(() => {
    async function initializeLocale() {
      try {
        const { initFromStorage } = await import('./src/lib/localeStore');
        await initFromStorage();
        const localeData = await localizationService.initialize();

        // i18n dilini ayarla: manuel seçim varsa onu uygula, yoksa otomatik algıla
        const detectedLang = localeData.language;
        if (detectedLang && detectedLang !== i18n.language) {
          await i18n.changeLanguage(detectedLang);
        }

        applyRTL(i18n.language);

        setLocaleReady(true);
      } catch (error) {
        console.error('Locale initialization error:', error);
        setLocaleReady(true);
      }
    }
    initializeLocale();
  }, []);

  // Deep linking handler
  useEffect(() => {
    const handleDeepLink = (event) => {
      const { path, queryParams } = Linking.parse(event.url);
      if (!path) return;

      if (path.startsWith('profile/')) {
        const username = path.replace('profile/', '');
        if (username && navigationRef.isReady()) navigate('UserProfile', { username });
      } else if (path.startsWith('post/')) {
        const postId = path.replace('post/', '');
        if (postId && navigationRef.isReady()) navigate('PostDetail', { postId });
      } else if (path.startsWith('playlist/')) {
        const playlistId = path.replace('playlist/', '');
        if (playlistId && navigationRef.isReady()) navigate('PlaylistDetail', { playlistId });
      } else if (path.startsWith('room/')) {
        const roomId = path.replace('room/', '');
        if (roomId && navigationRef.isReady()) navigate('ListeningRoom', { roomId });
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => subscription?.remove();
  }, []);

  const [activeRoute, setActiveRoute] = useState('');

  if (!fontsLoaded || !localeReady || !onboardingChecked) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0B' }}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  if (showOnboarding) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <OnboardingScreen onComplete={() => setShowOnboarding(false)} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  const isFeedActive = activeRoute === 'Feed';

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <NotificationProvider>
                <ScreenTimeProvider>
                  <ThemeProvider>
                    <AlertProvider>
                      <InterstitialAdProvider>
                        <NotificationHandler>
                          <PlayerProvider>
                            <ThemedStatusBar />
                            <OfflineBanner />
                            <AppAlertPortal />
                            <AppNavigator onRouteChanged={setActiveRoute} />
                            {!isFeedActive && (
                              <>
                                <MiniPlayer />
                                <FullPlayer />
</>
                            )}
                          </PlayerProvider>
                        </NotificationHandler>
                      </InterstitialAdProvider>
                    </AlertProvider>
                  </ThemeProvider>
                </ScreenTimeProvider>
              </NotificationProvider>
            </AuthProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

// Themed StatusBar component
function ThemedStatusBar() {
  const { themeId } = useTheme();
  return <StatusBar style={themeId === 'light' ? 'dark' : 'light'} />;
}
