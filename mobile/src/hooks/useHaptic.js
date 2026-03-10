import { Platform } from 'react-native';

let Haptics = null;
try {
  Haptics = require('expo-haptics');
} catch {
  // expo-haptics optional - no-op when unavailable
}

const haptic = {
  light: () => {
    if (Platform.OS !== 'web' && Haptics?.impactAsync) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  medium: () => {
    if (Platform.OS !== 'web' && Haptics?.impactAsync) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  heavy: () => {
    if (Platform.OS !== 'web' && Haptics?.impactAsync) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  },
  success: () => {
    if (Platform.OS !== 'web' && Haptics?.notificationAsync) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  error: () => {
    if (Platform.OS !== 'web' && Haptics?.notificationAsync) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
  selection: () => {
    if (Platform.OS !== 'web' && Haptics?.selectionAsync) Haptics.selectionAsync().catch(() => {});
  },
};

export default haptic;
