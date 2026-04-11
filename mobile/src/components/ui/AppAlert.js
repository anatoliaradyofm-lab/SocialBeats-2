/**
 * AppAlert — Uygulamanın tasarımıyla uyumlu özel alert/dialog bileşeni
 * React Native Alert'in drop-in replacement'ı — aynı API, styled modal
 * Native: Modal kullanır | Web: AbsoluteView kullanır (telefon çerçevesinde kalır)
 */
import React, { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Pressable, Platform,
} from 'react-native';

// ── Singleton ref ─────────────────────────────────────────────────────────────
let _ref = null;

// ── Shared content renderer ───────────────────────────────────────────────────
function AlertContent({ cfg, close }) {
  const buttons = cfg.buttons?.length ? cfg.buttons : [{ text: 'Tamam' }];
  const stacked  = buttons.length > 2;

  return (
    <Pressable
      style={s.overlay}
      onPress={() => cfg.options?.cancelable !== false && close()}
    >
      <Pressable style={s.card} onPress={() => {}}>
        {!!cfg.title   && <Text style={s.title}>{cfg.title}</Text>}
        {!!cfg.message && <Text style={s.message}>{cfg.message}</Text>}

        <View style={s.divider} />

        <View style={[s.btnRow, stacked && s.btnCol]}>
          {buttons.map((btn, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={stacked ? s.dividerH : s.dividerV} />}
              <TouchableOpacity
                style={[s.btn, stacked && s.btnStacked]}
                activeOpacity={0.65}
                onPress={() => { close(); btn.onPress?.(); }}
              >
                <Text style={[
                  s.btnText,
                  btn.style === 'cancel'      && s.textCancel,
                  btn.style === 'destructive' && s.textDestructive,
                  (!btn.style || btn.style === 'default') && s.textDefault,
                ]}>
                  {btn.text}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>
      </Pressable>
    </Pressable>
  );
}

// ── AppAlertModal ─────────────────────────────────────────────────────────────
const AppAlertModal = forwardRef(function AppAlertModal(_, ref) {
  const [cfg, setCfg] = useState(null);

  useImperativeHandle(ref, () => ({
    show: (config) => setCfg(config),
  }));

  if (!cfg) return null;

  const close = () => setCfg(null);

  // Web: absolute view — telefon çerçevesi içinde kalır
  if (Platform.OS === 'web') {
    return (
      <View style={s.webPortal}>
        <AlertContent cfg={cfg} close={close} />
      </View>
    );
  }

  // Native: sistem üstü Modal
  return (
    <Modal
      transparent
      animationType="fade"
      visible
      statusBarTranslucent
      onRequestClose={() => cfg.options?.cancelable !== false && close()}
    >
      <AlertContent cfg={cfg} close={close} />
    </Modal>
  );
});

// ── Portal ────────────────────────────────────────────────────────────────────
// Native: App.js içinde render et (Modal sistem üstüne çıkar)
// Web: main.jsx'te telefon çerçevesi içine render et
export function AppAlertPortal() {
  const ref = useRef(null);
  useEffect(() => {
    _ref = ref.current;
    return () => { _ref = null; };
  }, []);
  return <AppAlertModal ref={ref} />;
}

// ── Drop-in replacement ───────────────────────────────────────────────────────
export const Alert = {
  alert(title, message, buttons, options) {
    if (_ref) {
      _ref.show({ title, message, buttons, options });
    } else {
      const RN = require('react-native');
      RN.Alert.alert(title, message, buttons, options);
    }
  },
};

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Web: telefon çerçevesi içinde tam ekran overlay
  webPortal: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 99999,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8,6,15,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#1C1432',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.18)',
    overflow: 'hidden',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8F8F8',
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 4,
  },
  message: {
    fontSize: 14,
    color: 'rgba(248,248,248,0.55)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
  },
  divider:   { height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  dividerV:  { width: 1,  backgroundColor: 'rgba(255,255,255,0.07)' },
  dividerH:  { height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },

  btnRow:    { flexDirection: 'row' },
  btnCol:    { flexDirection: 'column' },

  btn: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnStacked: { flex: 0 },

  btnText:         { fontSize: 15, fontWeight: '600' },
  textDefault:     { color: '#C084FC' },
  textCancel:      { color: 'rgba(248,248,248,0.45)', fontWeight: '400' },
  textDestructive: { color: '#F87171' },
});
