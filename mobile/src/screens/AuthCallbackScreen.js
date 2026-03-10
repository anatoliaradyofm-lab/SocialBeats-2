import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

/**
 * OAuth callback handler - processes token from URL params (deep link)
 * Used when user returns from Google/Spotify OAuth in browser
 */
export default function AuthCallbackScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const { login } = useAuth();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = route?.params || {};
    const token = params.token || params.access_token;
    const user = params.user;

    if (token) {
      if (user && typeof user === 'object') {
        login(token, user)
          .then(() => {
            setStatus('success');
            setTimeout(() => {
              navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
            }, 500);
          })
          .catch((err) => {
            setError(err.message);
            setStatus('error');
          });
      } else {
        api
          .get('/auth/me', token)
          .then((userData) => {
            return login(token, userData);
          })
          .then(() => {
            setStatus('success');
            setTimeout(() => {
              navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
            }, 500);
          })
          .catch((err) => {
            setError(err.message);
            setStatus('error');
          });
      }
    } else {
      setError(t('login.noTokenReceived'));
      setStatus('error');
    }
  }, [route?.params]);

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.text}>{t('login.completingSignIn')}</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error || t('login.authFailed')}</Text>
        <Text
          style={styles.link}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
        >
          {t('login.backToLogin')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#8B5CF6" />
      <Text style={styles.text}>{t('login.successRedirecting')}</Text>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  text: { color: '#9CA3AF', marginTop: 16, fontSize: 16 },
  errorText: { color: '#DC2626', marginBottom: 16, textAlign: 'center', paddingHorizontal: 24 },
  link: { color: colors.accent, fontSize: 16 },
});
