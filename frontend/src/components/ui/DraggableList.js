import React, { useState, useRef, useCallback } from 'react';
import { View, Animated, PanResponder, StyleSheet } from 'react-native';
import haptic from '../../utils/haptics';

export default function DraggableList({ data, renderItem, onReorder, itemHeight = 60 }) {
  const [dragging, setDragging] = useState(null);
  const [items, setItems] = useState(data);
  const dragY = useRef(new Animated.Value(0)).current;
  const dragIndex = useRef(-1);
  const currentOrder = useRef([...data]);

  React.useEffect(() => { setItems(data); currentOrder.current = [...data]; }, [data]);

  const createPanResponder = useCallback((index) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      dragIndex.current = index;
      setDragging(index);
      haptic.medium();
    },
    onPanResponderMove: (_, g) => {
      dragY.setValue(g.dy);
      const newIndex = Math.max(0, Math.min(items.length - 1, Math.round(index + g.dy / itemHeight)));
      if (newIndex !== dragIndex.current) {
        dragIndex.current = newIndex;
        const reordered = [...currentOrder.current];
        const [moved] = reordered.splice(index, 1);
        reordered.splice(newIndex, 0, moved);
        currentOrder.current = reordered;
        haptic.selection();
      }
    },
    onPanResponderRelease: () => {
      setDragging(null);
      dragY.setValue(0);
      setItems([...currentOrder.current]);
      onReorder?.(currentOrder.current);
    },
  }), [items, itemHeight, onReorder]);

  return (
    <View>
      {items.map((item, index) => {
        const pr = createPanResponder(index);
        const isDragging = dragging === index;
        return (
          <Animated.View
            key={item.id || index}
            style={[styles.item, { height: itemHeight, zIndex: isDragging ? 999 : 1, opacity: isDragging ? 0.8 : 1, transform: isDragging ? [{ translateY: dragY }, { scale: 1.03 }] : [] }]}
          >
            {renderItem({ item, index, dragHandlers: pr.panHandlers, isDragging })}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { overflow: 'hidden' },
});
