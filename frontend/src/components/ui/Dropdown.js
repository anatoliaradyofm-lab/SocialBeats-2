import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Animated, StyleSheet, Modal, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

export default function Dropdown({ options = [], selected, onSelect, placeholder = 'Seçiniz', renderItem, icon }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const scale = useRef(new Animated.Value(0.95)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 120, friction: 10 }),
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [open]);

  const close = () => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 0.95, duration: 120, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start(() => setOpen(false));
  };

  const selectedItem = options.find(o => o.id === selected || o.value === selected);

  return (
    <View>
      <TouchableOpacity style={[styles.trigger, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]} onPress={() => setOpen(true)} activeOpacity={0.7}>
        {icon && <Ionicons name={icon} size={16} color={colors.textMuted} />}
        <Text style={[styles.triggerText, { color: selectedItem ? colors.text : colors.textMuted }]} numberOfLines={1}>
          {selectedItem?.label || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </TouchableOpacity>

      {open && (
        <Modal visible transparent animationType="none" onRequestClose={close}>
          <TouchableWithoutFeedback onPress={close}>
            <View style={styles.overlay}>
              <TouchableWithoutFeedback>
                <Animated.View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border, transform: [{ scale }], opacity }]}>
                  <FlatList
                    data={options}
                    keyExtractor={(item) => String(item.id || item.value)}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[styles.option, { borderBottomColor: colors.border }]}
                        onPress={() => { onSelect(item.id || item.value); close(); }}
                      >
                        {renderItem ? renderItem(item) : (
                          <>
                            {item.icon && <Ionicons name={item.icon} size={16} color={item.id === selected ? colors.primary : colors.textMuted} />}
                            <Text style={[styles.optionText, { color: item.id === selected ? colors.primary : colors.text }]}>{item.label}</Text>
                            {item.id === selected && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  />
                </Animated.View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
  triggerText: { flex: 1, fontSize: 14 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', padding: 32 },
  menu: { width: '100%', maxWidth: 320, maxHeight: 350, borderRadius: 14, borderWidth: 0.5, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 15 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5 },
  optionText: { flex: 1, fontSize: 15 },
});
