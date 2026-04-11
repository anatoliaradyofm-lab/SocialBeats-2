// Generic no-op mock for unused native modules
import React from 'react';

export const noop = () => {};

// expo-network
export const getNetworkStateAsync = () => Promise.resolve({ isConnected: true, isInternetReachable: true, type: 'wifi' });
export const NetworkStateType = { WIFI: 'wifi', CELLULAR: 'cellular', NONE: 'none', UNKNOWN: 'unknown' };

// expo-web-browser
export const openBrowserAsync = () => Promise.resolve({ type: 'cancel' });
export const maybeCompleteAuthSession = () => {};
export const dismissBrowser = () => {};

// expo-auth-session
export const makeRedirectUri = () => 'https://localhost';
export const useAuthRequest  = () => [null, null, () => {}];
export const ResponseType    = { Code: 'code', Token: 'token' };
export const startAsync      = () => Promise.resolve({ type: 'cancel' });

// expo-contacts
export const getContactsAsync = () => Promise.resolve({ data: [] });

// expo-location
export const requestForegroundPermissionsAsync = () => Promise.resolve({ status: 'denied' });
export const getCurrentPositionAsync = () => Promise.resolve({ coords: { latitude: 0, longitude: 0 } });

// expo-image-picker — browser file input kullanır
export const launchImageLibraryAsync = (options = {}) => new Promise((resolve) => {
  const input = document.createElement('input');
  input.type   = 'file';
  input.accept = 'image/*,video/*';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.onchange = (e) => {
    document.body.removeChild(input);
    const file = e.target.files?.[0];
    if (!file) { resolve({ canceled: true, assets: [] }); return; }
    const uri  = URL.createObjectURL(file);
    const type = file.type.startsWith('video/') ? 'video' : 'image';
    resolve({ canceled: false, assets: [{ uri, type, name: file.name, mimeType: file.type, width: 0, height: 0 }] });
  };

  // Kullanıcı diyalogu kapatırsa (focus geri gelince kontrol et)
  const onFocus = () => {
    window.removeEventListener('focus', onFocus);
    setTimeout(() => {
      if (!input.value) {
        try { document.body.removeChild(input); } catch (_) {}
        resolve({ canceled: true, assets: [] });
      }
    }, 500);
  };
  window.addEventListener('focus', onFocus);
  input.click();
});

export const launchCameraAsync = () => Promise.resolve({ canceled: true });
export const MediaTypeOptions  = { Images: 'Images', Videos: 'Videos', All: 'All' };

// expo-camera
function CameraComponent() { return null; }
CameraComponent.requestCameraPermissionsAsync = () => Promise.resolve({ status: 'denied', granted: false });
CameraComponent.getCameraPermissionsAsync = () => Promise.resolve({ status: 'denied', granted: false });
export const Camera = CameraComponent;
export const CameraView = () => null;
export const CameraType = { front: 'front', back: 'back' };
export const FlashMode = { off: 'off', on: 'on', auto: 'auto' };
export const useCameraPermissions = () => [{ granted: true }, () => Promise.resolve({ granted: true })];

// expo-store-review
export const requestReview = () => Promise.resolve();

// expo-battery
export const getBatteryLevelAsync       = () => Promise.resolve(1);
export const useBatteryLevel            = () => 1;
export const isLowPowerModeEnabledAsync = () => Promise.resolve(false);

// expo-image-picker (extra)
export const requestCameraPermissionsAsync       = () => Promise.resolve({ granted: true, status: 'granted' });
export const requestMediaLibraryPermissionsAsync = () => Promise.resolve({ granted: true, status: 'granted' });

// expo-location (extra)
export const reverseGeocodeAsync               = () => Promise.resolve([{ city: 'Istanbul', country: 'Turkey' }]);
export const requestBackgroundPermissionsAsync = () => Promise.resolve({ status: 'denied' });
export const watchPositionAsync                = () => Promise.resolve({ remove: () => {} });
export const GeofencingEventType               = { Enter: 1, Exit: 2 };
export const Accuracy                          = { High: 6, Balanced: 3, Low: 1 };

// expo-file-system
export const documentDirectory  = '/mock/';
export const cacheDirectory     = '/mock/cache/';
export const downloadAsync      = () => Promise.resolve({ uri: '' });
export const readAsStringAsync  = () => Promise.resolve('');
export const writeAsStringAsync = () => Promise.resolve();
export const deleteAsync        = () => Promise.resolve();
export const getInfoAsync       = () => Promise.resolve({ exists: false });
export const makeDirectoryAsync = () => Promise.resolve();
export const copyAsync          = () => Promise.resolve();
export const moveAsync          = () => Promise.resolve();

// expo-sharing
export const isAvailableAsync = () => Promise.resolve(false);
export const shareAsync       = () => Promise.resolve();

// expo-clipboard
export const setStringAsync = () => Promise.resolve();
export const getStringAsync = () => Promise.resolve('');

// expo-media-library
export const requestPermissionsAsync    = () => Promise.resolve({ status: 'denied' });
export const saveToLibraryAsync         = () => Promise.resolve();
export const createAssetAsync           = () => Promise.resolve({ id: 'mock' });
export const MediaType                  = { photo: 'photo', video: 'video' };

// expo-modules-core
export const requireNativeModule        = () => ({});
export const requireOptionalNativeModule= () => null;
export const EventEmitter               = class { addListener() {} removeAllListeners() {} };
export const NativeModulesProxy         = {};
export const Platform                   = { OS: 'web' };

// react-native-webview
export const WebView = React.forwardRef(function WebView(
  { source, style, onMessage, injectedJavaScript, onShouldStartLoadWithRequest, ...props }, ref
) {
  const iframeRef = React.useRef(null);
  React.useImperativeHandle(ref, () => ({
    postMessage: (msg) => {
      try { iframeRef.current?.contentWindow?.postMessage(msg, '*'); } catch(e) {}
    },
    injectJavaScript: (js) => {
      try { iframeRef.current?.contentWindow?.eval(js); } catch(e) {}
    },
  }));
  if (source?.html) {
    const blob = new Blob([source.html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    return React.createElement('iframe', {
      ref: iframeRef, src: url,
      style: { border: 'none', width: '100%', height: '100%', ...(style || {}) },
      allow: 'camera; microphone',
    });
  }
  if (source?.uri) {
    return React.createElement('iframe', {
      ref: iframeRef, src: source.uri,
      style: { border: 'none', width: '100%', height: '100%', ...(style || {}) },
      allow: 'camera; microphone',
    });
  }
  return null;
});

// react-native-chart-kit
export const LineChart         = () => null;
export const BarChart          = () => null;
export const PieChart          = () => null;
export const AreaChart         = () => null;
export const StackedBarChart   = () => null;
export const ProgressChart     = () => null;
export const ContributionGraph = () => null;

// @react-native-community/slider — default export
export default function Slider({ value = 0, minimumValue = 0, maximumValue = 1, step = 1, onValueChange, onSlidingComplete, style, minimumTrackTintColor }) {
  return React.createElement('input', {
    type: 'range', min: minimumValue, max: maximumValue, step, defaultValue: value,
    onChange:  (e) => onValueChange?.(parseFloat(e.target.value)),
    onMouseUp: (e) => onSlidingComplete?.(parseFloat(e.target.value)),
    style: { width: '100%', accentColor: minimumTrackTintColor || '#A78BFA', cursor: 'pointer', ...style },
  });
}
