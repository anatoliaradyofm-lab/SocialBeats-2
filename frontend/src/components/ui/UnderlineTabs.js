import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, ScrollView, StyleSheet } from 'react-native';
import { useTheme, BRAND } from '../../contexts/ThemeContext';
import haptic from '../../utils/haptics';

export default function UnderlineTabs({ tabs, active, onChange, scrollable = false }) {
  const { colors } = useTheme();
  const underlineX = useRef(new Animated.Value(0)).current;
  const tabWidths = useRef({});
  const tabPositions = useRef({});

  useEffect(() => {
    const pos = tabPositions.current[active];
    const width = tabWidths.current[active];
    if (pos !== undefined && width) {
      Animated.spring(underlineX, { toValue: pos, useNativeDriver: true, tension: 120, friction: 14 }).start();
    }
  }, [active]);

  const handleLayout = (id, e) => {
    tabPositions.current[id] = e.nativeEvent.layout.x;
    tabWidths.current[id] = e.nativeEvent.layout.width;
  };

  const Wrapper = scrollable ? ScrollView : View;
  const wrapperProps = scrollable ? { horizontal: true, showsHorizontalScrollIndicator: false, contentContainerStyle: styles.row } : { style: styles.row };

  return (
    <View>
      <Wrapper {...wrapperProps}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => { haptic.selection(); onChange(tab.id); }}
            onLayout={(e) => handleLayout(tab.id, e)}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, { color: active === tab.id ? colors.text : colors.textMuted, fontWeight: active === tab.id ? '700' : '500' }]}>
              {tab.label}
            </Text>
            {tab.badge != null && (
              <View style={[styles.badge, { backgroundColor: BRAND.primary }]}>
                <Text style={styles.badgeText}>{tab.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </Wrapper>
      <View style={[styles.underlineTrack, { backgroundColor: colors.border }]}>
        <Animated.View style={[styles.underline, {
          width: tabWidths.current[active] || 60,
          transform: [{ translateX: underlineX }],
        }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 16, gap: 24 },
  tab: { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 15 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  underlineTrack: { height: 2 },
  underline: { height: 2, backgroundColor: BRAND.primary, borderRadius: 1 },
});
