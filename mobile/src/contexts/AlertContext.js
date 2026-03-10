/**
 * AlertContext - Toast/Snackbar bildirimleri (success, error)
 */
import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

const AlertContext = createContext(null);

export function AlertProvider({ children }) {
  const [alert, setAlert] = useState(null);

  const show = useCallback((message, type = 'info') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 3000);
  }, []);

  const showSuccess = useCallback((msg) => show(msg, 'success'), [show]);
  const showError = useCallback((msg) => show(msg, 'error'), [show]);
  const showInfo = useCallback((msg) => show(msg, 'info'), [show]);
  const hide = useCallback(() => setAlert(null), []);

  return (
    <AlertContext.Provider value={{ show, showSuccess, showError, showInfo, hide }}>
      {children}
      {alert && (
        <View
          style={[
            styles.toast,
            alert.type === 'success' && styles.toastSuccess,
            alert.type === 'error' && styles.toastError,
          ]}
        >
          <Text style={styles.toastText}>{alert.message}</Text>
        </View>
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const ctx = useContext(AlertContext);
  return ctx || {
    show: () => {},
    showSuccess: () => {},
    showError: () => {},
    showInfo: () => {},
    hide: () => {},
  };
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#374151',
    alignSelf: 'center',
    zIndex: 9999,
  },
  toastSuccess: { backgroundColor: '#059669' },
  toastError: { backgroundColor: '#DC2626' },
  toastText: { color: '#fff', fontSize: 14, textAlign: 'center' },
});
