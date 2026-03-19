// expo-local-authentication — mock (web has no biometrics)
export const hasHardwareAsync       = () => Promise.resolve(false);
export const isEnrolledAsync        = () => Promise.resolve(false);
export const authenticateAsync      = () => Promise.resolve({ success: false, error: 'not_available' });
export const supportedAuthenticationTypesAsync = () => Promise.resolve([]);
export const AuthenticationType     = { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 };
