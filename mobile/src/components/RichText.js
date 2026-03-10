import React, { useState } from 'react';
import { Text, StyleSheet, Linking, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import InAppBrowser from './InAppBrowser';

export default function RichText({ children, style, numberOfLines }) {
  const navigation = useNavigation();
  const [browserUrl, setBrowserUrl] = useState(null);

  if (typeof children !== 'string') {
    return <Text style={style} numberOfLines={numberOfLines}>{children}</Text>;
  }

  const text = children;
  const parts = [];
  let lastIndex = 0;

  const combined = /(@\w+|#\w+|https?:\/\/[^\s]+)/g;
  let match;

  while ((match = combined.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }

    const matched = match[0];
    if (matched.startsWith('@')) {
      parts.push({ type: 'mention', value: matched, username: matched.slice(1) });
    } else if (matched.startsWith('#')) {
      parts.push({ type: 'hashtag', value: matched, tag: matched.slice(1) });
    } else {
      parts.push({ type: 'url', value: matched });
    }

    lastIndex = match.index + matched.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  if (parts.length === 0) {
    return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;
  }

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) => {
        if (part.type === 'mention') {
          return (
            <Text
              key={i}
              style={styles.mention}
              onPress={() => navigation.navigate('UserProfile', { username: part.username })}
            >
              {part.value}
            </Text>
          );
        }
        if (part.type === 'hashtag') {
          return (
            <Text
              key={i}
              style={styles.hashtag}
              onPress={() => navigation.navigate('Search', { initialQuery: part.value })}
            >
              {part.value}
            </Text>
          );
        }
        if (part.type === 'url') {
          return (
            <Text
              key={i}
              style={styles.url}
              onPress={() => setBrowserUrl(part.value)}
            >
              {part.value}
            </Text>
          );
        }
        return <Text key={i}>{part.value}</Text>;
      })}
      {browserUrl && (
        <Modal visible animationType="slide" onRequestClose={() => setBrowserUrl(null)}>
          <InAppBrowser url={browserUrl} onClose={() => setBrowserUrl(null)} />
        </Modal>
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  mention: { color: '#8B5CF6', fontWeight: '600' },
  hashtag: { color: '#3B82F6', fontWeight: '500' },
  url: { color: '#60A5FA', textDecorationLine: 'underline' },
});
