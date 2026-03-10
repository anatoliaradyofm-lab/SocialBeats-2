import { Platform } from 'react-native';

let Haptics = null;
try { Haptics = require('expo-haptics'); } catch {}

export const haptic = {
  light() {
    try { Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Light); } catch {}
  },
  medium() {
    try { Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Medium); } catch {}
  },
  heavy() {
    try { Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
  },
  success() {
    try { Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Success); } catch {}
  },
  error() {
    try { Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Error); } catch {}
  },
  warning() {
    try { Haptics?.notificationAsync?.(Haptics.NotificationFeedbackType.Warning); } catch {}
  },
  selection() {
    try { Haptics?.selectionAsync?.(); } catch {}
  },
};

export default haptic;
