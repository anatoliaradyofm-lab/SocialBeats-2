// @expo/vector-icons — renders ionicons web components
import React from 'react';

// Maps Ionicons name to ionicons web component name
const toIon = (name = '') =>
  name.replace(/-outline$/, '').replace(/-sharp$/, '') + (name.endsWith('-outline') ? '-outline' : '');

function IonIcon({ name, size = 24, color = '#fff', style }) {
  return (
    <ion-icon
      name={toIon(name)}
      style={{
        fontSize: size,
        color,
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...(style || {}),
      }}
    />
  );
}

// Named exports matching @expo/vector-icons
export const Ionicons     = IonIcon;
export const MaterialIcons= IonIcon;
export const FontAwesome  = IonIcon;
export const AntDesign    = IonIcon;
export const Feather      = IonIcon;
export const Entypo       = IonIcon;
export const SimpleLineIcons = IonIcon;
export const Foundation   = IonIcon;
export const Octicons     = IonIcon;
export const Zocial       = IonIcon;
export const EvilIcons    = IonIcon;
export default IonIcon;
