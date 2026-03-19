// react-native shim: re-exports react-native-web + adds missing iOS-only APIs
export * from 'react-native-web';

// iOS-only APIs not in react-native-web
export const ActionSheetIOS = {
  showActionSheetWithOptions: ({ options, cancelButtonIndex, title, message }, callback) => {
    const result = window.confirm(`${title || ''}\n${message || ''}\n\n${options.join('\n')}`);
    callback(result ? 0 : cancelButtonIndex ?? options.length - 1);
  },
  showShareActionSheetWithOptions: () => {},
};

export const DatePickerIOS = () => null;
export const MaskedViewIOS = ({ children }) => children;

// Additional APIs sometimes missing from react-native-web
export const Vibration = { vibrate: () => {}, cancel: () => {} };
export const PermissionsAndroid = {
  request: () => Promise.resolve('granted'),
  check:   () => Promise.resolve(true),
  PERMISSIONS: {},
  RESULTS: { GRANTED: 'granted', DENIED: 'denied', NEVER_ASK_AGAIN: 'never_ask_again' },
};
export const ToastAndroid = { show: (msg) => console.log('[Toast]', msg), SHORT: 'SHORT', LONG: 'LONG' };
export const Slider = ({ value, onValueChange, minimumValue = 0, maximumValue = 1, step, style }) => {
  const React = require('react');
  return React.createElement('input', {
    type: 'range',
    value: value,
    min: minimumValue,
    max: maximumValue,
    step: step || 0.01,
    onChange: (e) => onValueChange && onValueChange(parseFloat(e.target.value)),
    style: { width: '100%', ...(style || {}) },
  });
};
export const NativeModules = {};
export const NativeEventEmitter = class { addListener() { return { remove: () => {} }; } };
export const DeviceEventEmitter = { addListener: () => ({ remove: () => {} }), emit: () => {} };

// Alert — react-native-web's Alert.alert doesn't call onPress callbacks reliably
export const Alert = {
  alert: (title, message, buttons) => {
    if (!buttons || buttons.length === 0) {
      window.alert(`${title}${message ? '\n' + message : ''}`);
      return;
    }
    if (buttons.length === 1) {
      window.alert(`${title}${message ? '\n' + message : ''}`);
      buttons[0].onPress?.();
      return;
    }
    const confirmBtn = buttons.find(b => b.style !== 'cancel');
    const ok = window.confirm(`${title}${message ? '\n' + message : ''}`);
    if (ok) confirmBtn?.onPress?.();
  },
};
