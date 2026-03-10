import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';

/**
 * 404 / Not Found screen - shown when navigating to invalid route or deep link
 */
export default function NotFoundScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.code}>404</Text>
      <Text style={styles.title}>{t('notFound.title')}</Text>
      <Text style={styles.subtitle}>{t('notFound.subtitle')}</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Main' }] })}
      >
        <Text style={styles.buttonText}>{t('notFound.goHome')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  code: { fontSize: 72, fontWeight: '800', color: colors.accent, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '600', color: colors.text, marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#9CA3AF', marginBottom: 32, textAlign: 'center' },
  button: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
