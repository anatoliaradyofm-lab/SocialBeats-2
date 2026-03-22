/**
 * NativeAdSlot — İçerik listelerine yerleşik native reklam
 * ADMOB_NATIVE_UNIT_ID kullanır.
 * Native build gerektirir; web/Expo Go'da null döner.
 */
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { AD_UNITS } from '../../hooks/useInterstitialAd';

import {
  NativeAd       as NativeAdView,
  MediaView,
  HeadlineView,
  TaglineView,
  CallToActionView,
  AdvertiserView,
} from 'react-native-google-mobile-ads';

export default function NativeAdSlot({ colors }) {
  if (Platform.OS === 'web' || !NativeAdView) return null;

  const bg     = colors?.card    ?? 'rgba(255,255,255,0.055)';
  const text   = colors?.text    ?? '#F8F8F8';
  const muted  = colors?.textMuted ?? 'rgba(248,248,248,0.45)';
  const accent = colors?.accent  ?? '#FB923C';

  return (
    <NativeAdView adUnitId={AD_UNITS.native} style={[s.card, { backgroundColor: bg }]}>
      <View style={s.badge}>
        <Text style={[s.badgeText, { color: accent }]}>Reklam</Text>
      </View>
      {HeadlineView     && <HeadlineView     style={[s.headline,  { color: text }]}  />}
      {TaglineView      && <TaglineView      style={[s.tagline,   { color: muted }]} />}
      {MediaView        && <MediaView        style={s.media} resizeMode="cover" />}
      {CallToActionView && <CallToActionView style={[s.cta, { backgroundColor: accent }]} textStyle={s.ctaText} />}
      {AdvertiserView   && <AdvertiserView   style={[s.advertiser, { color: muted }]} />}
    </NativeAdView>
  );
}

const s = StyleSheet.create({
  card:       { borderRadius: 16, padding: 14, marginHorizontal: 20, marginVertical: 6, overflow: 'hidden' },
  badge:      { alignSelf: 'flex-start', marginBottom: 6 },
  badgeText:  { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  headline:   { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  tagline:    { fontSize: 12, fontWeight: '400', marginBottom: 10 },
  media:      { width: '100%', height: 140, borderRadius: 10, marginBottom: 10 },
  cta:        { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16, alignSelf: 'flex-start' },
  ctaText:    { color: '#fff', fontSize: 13, fontWeight: '600' },
  advertiser: { fontSize: 11, marginTop: 6 },
});
