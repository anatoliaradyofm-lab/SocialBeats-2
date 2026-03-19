// expo-linear-gradient — CSS gradient on web
import React from 'react';
import { View } from 'react-native';

export function LinearGradient({ colors = [], start, end, locations, style, children, ...props }) {
  const angle = (() => {
    if (!start || !end) return '135deg';
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const rad = Math.atan2(dy, dx);
    return Math.round(rad * 180 / Math.PI) + 90 + 'deg';
  })();

  const stops = colors.map((c, i) => {
    const pct = locations ? locations[i] * 100 : (i / Math.max(colors.length - 1, 1)) * 100;
    return `${c} ${pct}%`;
  }).join(', ');

  return (
    <View
      style={[
        style,
        { background: `linear-gradient(${angle}, ${stops})` },
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

export default LinearGradient;
