/**
 * TextWithMentions - Renders text with tappable #hashtag and @mention spans
 */
import React from 'react';
import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';

const PATTERN = /(#\w+)|(@\w+)/g;

export function TextWithMentions({ content, style, onHashtagPress, onMentionPress }) {
  if (!content || typeof content !== 'string') return null;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = PATTERN.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);
    if (before) parts.push({ type: 'text', value: before });
    const value = match[1] || match[2];
    const isHashtag = match[1] != null;
    parts.push({ type: isHashtag ? 'hashtag' : 'mention', value });
    lastIndex = match.index + value.length;
  }
  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) });
  }

  return (
    <Text style={[styles.base, style]}>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return <Text key={i}>{part.value}</Text>;
        }
        const onPress = part.type === 'hashtag' ? onHashtagPress : onMentionPress;
        const slug = part.value.slice(1); // remove # or @
        if (!onPress) {
          return <Text key={i} style={styles.link}>{part.value}</Text>;
        }
        return (
          <Text key={i} onPress={() => onPress(slug)} style={styles.link}>
            {part.value}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: { color: '#fff', fontSize: 15 },
  link: { color: '#8B5CF6', fontWeight: '600' },
});
