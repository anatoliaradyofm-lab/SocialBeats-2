import 'react-native-get-random-values';
import './src/i18n';

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { View, ActivityIndicator } from 'react-native';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider } from './src/contexts/AuthContext';
import { PlayerProvider } from './src/contexts/PlayerContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { NotificationProvider, useNotifications } from './src/contexts/NotificationContext';
import AppNavigator from './src/navigation/AppNavigator';
import MiniPlayer from './src/components/player/MiniPlayer';
import ErrorBoundary from './src/components/ui/ErrorBoundary';
import OfflineBanner from './src/components/ui/OfflineBanner';
import NotificationPopup from './src/components/ui/NotificationPopup';
import { ToastProvider } from './src/components/ui/Toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 1000 * 60 * 5 },
  },
});

function ThemedStatusBar() {
  const { resolvedTheme, themeId } = useTheme();
  const t = resolvedTheme || themeId;
  return <StatusBar style={t === 'light' ? 'dark' : 'light'} />;
}

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    Font.loadAsync({ ...Ionicons.font })
      .then(() => setFontsLoaded(true))
      .catch(() => setFontsLoaded(true));
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0B' }}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ThemeProvider>
                <NotificationProvider>
                  <ToastProvider>
                    <PlayerProvider>
                      <ThemedStatusBar />
                      <AppNavigator />
                      <MiniPlayer />
                      <OfflineBanner />
                      <NotificationPopup />
                    </PlayerProvider>
                  </ToastProvider>
                </NotificationProvider>
              </ThemeProvider>
            </AuthProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
