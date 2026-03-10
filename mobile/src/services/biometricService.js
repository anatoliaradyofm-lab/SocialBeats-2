import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const BIOMETRIC_TOKEN_KEY = 'biometric_token';

const biometricService = {
  async isAvailable() {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      if (!compatible) return { available: false, reason: 'no_hardware' };

      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) return { available: false, reason: 'not_enrolled' };

      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const hasFaceId = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
      const hasTouchId = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

      return {
        available: true,
        hasFaceId,
        hasTouchId,
        type: hasFaceId ? 'face' : hasTouchId ? 'fingerprint' : 'biometric',
      };
    } catch {
      return { available: false, reason: 'error' };
    }
  },

  async authenticate(promptMessage = 'Authenticate to continue') {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use passcode',
      });
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async isEnabled() {
    try {
      const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch {
      return false;
    }
  },

  async enable(token) {
    try {
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
      if (token) {
        await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, token);
      }
      return true;
    } catch {
      return false;
    }
  },

  async disable() {
    try {
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'false');
      await SecureStore.deleteItemAsync(BIOMETRIC_TOKEN_KEY);
      return true;
    } catch {
      return false;
    }
  },

  async getSavedToken() {
    try {
      return await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async biometricLogin() {
    const available = await this.isAvailable();
    if (!available.available) return { success: false, reason: 'not_available' };

    const enabled = await this.isEnabled();
    if (!enabled) return { success: false, reason: 'not_enabled' };

    const auth = await this.authenticate('Sign in to SocialBeats');
    if (!auth.success) return { success: false, reason: 'auth_failed' };

    const token = await this.getSavedToken();
    if (!token) return { success: false, reason: 'no_token' };

    return { success: true, token };
  },
};

export default biometricService;
