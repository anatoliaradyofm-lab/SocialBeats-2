import React, { useState } from 'react';
import { Image, View, StyleSheet, ActivityIndicator } from 'react-native';

const imageCache = new Map();

export default function CachedImage({ source, style, resizeMode = 'cover', ...props }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const uri = typeof source === 'object' ? source.uri : source;

  if (!uri) {
    return <View style={[style, styles.placeholder]} />;
  }

  return (
    <View style={style}>
      <Image
        source={{ uri, cache: 'force-cache' }}
        style={[StyleSheet.absoluteFill, { resizeMode }]}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => {
          setLoading(false);
          imageCache.set(uri, true);
        }}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
        fadeDuration={200}
        {...props}
      />
      {loading && !imageCache.has(uri) && (
        <View style={[StyleSheet.absoluteFill, styles.loader]}>
          <ActivityIndicator size="small" color="#8B5CF6" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: '#1A1A2E' },
  loader: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A2E' },
});
