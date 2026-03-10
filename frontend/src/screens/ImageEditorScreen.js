import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet, ScrollView, TextInput,
  Dimensions, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, BRAND } from '../contexts/ThemeContext';

const { width: SW } = Dimensions.get('window');
const IMG_SIZE = SW - 32;

const FILTERS = [
  { id: 'original', name: 'Orijinal', style: {} },
  { id: 'grayscale', name: 'Siyah Beyaz', style: { opacity: 0.9, tintColor: undefined }, overlay: 'rgba(0,0,0,0.1)' },
  { id: 'sepia', name: 'Sepya', style: {}, overlay: 'rgba(112,66,20,0.25)' },
  { id: 'warm', name: 'Sıcak', style: {}, overlay: 'rgba(255,165,0,0.15)' },
  { id: 'cool', name: 'Soğuk', style: {}, overlay: 'rgba(0,100,255,0.12)' },
  { id: 'vintage', name: 'Vintage', style: {}, overlay: 'rgba(160,120,60,0.2)' },
  { id: 'dramatic', name: 'Dramatik', style: {}, overlay: 'rgba(0,0,0,0.25)' },
  { id: 'fade', name: 'Solgun', style: { opacity: 0.7 }, overlay: 'rgba(255,255,255,0.15)' },
  { id: 'vivid', name: 'Canlı', style: {}, overlay: 'rgba(255,0,100,0.08)' },
  { id: 'sunset', name: 'Gün Batımı', style: {}, overlay: 'rgba(255,100,0,0.18)' },
  { id: 'ocean', name: 'Okyanus', style: {}, overlay: 'rgba(0,150,200,0.15)' },
  { id: 'noir', name: 'Noir', style: {}, overlay: 'rgba(0,0,0,0.35)' },
];

const STICKERS = ['😀', '😂', '❤️', '🔥', '⭐', '🎵', '🎉', '👍', '🌟', '💯', '🎶', '🌈', '🎸', '🎤', '🎧', '💜', '💙', '💚', '💛', '🧡', '🖤', '🤍', '✨', '🎭'];
const FONTS = ['System', 'serif', 'monospace'];
const BRUSH_SIZES = [2, 4, 8, 12];

const TABS = [
  { id: 'filters', label: 'Filtre', icon: 'color-palette' },
  { id: 'adjust', label: 'Ayar', icon: 'options' },
  { id: 'crop', label: 'Kırp', icon: 'crop' },
  { id: 'text', label: 'Metin', icon: 'text' },
  { id: 'sticker', label: 'Çıkartma', icon: 'happy' },
  { id: 'draw', label: 'Çizim', icon: 'brush' },
];

export default function ImageEditorScreen({ route, navigation }) {
  const { imageUri, onSave } = route.params || {};
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState('filters');
  const [activeFilter, setActiveFilter] = useState('original');
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [textOverlays, setTextOverlays] = useState([]);
  const [newText, setNewText] = useState('');
  const [textFont, setTextFont] = useState('System');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [stickerOverlays, setStickerOverlays] = useState([]);
  const [drawColor, setDrawColor] = useState('#FFFFFF');
  const [brushSize, setBrushSize] = useState(4);
  const [drawPaths, setDrawPaths] = useState([]);
  const [cropMode, setCropMode] = useState('square');
  const [saving, setSaving] = useState(false);

  const getFilterOverlay = useCallback(() => {
    const f = FILTERS.find(fl => fl.id === activeFilter);
    return f?.overlay || null;
  }, [activeFilter]);

  const getFilterStyle = useCallback(() => {
    const f = FILTERS.find(fl => fl.id === activeFilter);
    return f?.style || {};
  }, [activeFilter]);

  const getBrightnessOverlay = useCallback(() => {
    if (brightness > 0) return `rgba(255,255,255,${brightness * 0.005})`;
    if (brightness < 0) return `rgba(0,0,0,${Math.abs(brightness) * 0.005})`;
    return null;
  }, [brightness]);

  const addText = () => {
    if (!newText.trim()) return;
    setTextOverlays(prev => [...prev, {
      id: Date.now(),
      text: newText.trim(),
      font: textFont,
      color: textColor,
      x: IMG_SIZE / 2 - 40,
      y: IMG_SIZE / 2 - 10,
    }]);
    setNewText('');
  };

  const removeTextOverlay = (id) => setTextOverlays(prev => prev.filter(t => t.id !== id));

  const addSticker = (emoji) => {
    setStickerOverlays(prev => [...prev, {
      id: Date.now(),
      emoji,
      x: IMG_SIZE / 2 - 15,
      y: IMG_SIZE / 2 - 15,
    }]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let finalUri = imageUri;

      try {
        const Manipulator = require('expo-image-manipulator');
        const actions = [];

        if (cropMode === 'square') {
          actions.push({ resize: { width: 1080, height: 1080 } });
        } else if (cropMode === 'portrait') {
          actions.push({ resize: { width: 1080, height: 1350 } });
        } else if (cropMode === 'landscape') {
          actions.push({ resize: { width: 1080, height: 608 } });
        }

        if (actions.length > 0) {
          const result = await Manipulator.manipulateAsync(imageUri, actions, {
            compress: 0.85,
            format: Manipulator.SaveFormat.JPEG,
          });
          finalUri = result.uri;
        }
      } catch {}

      if (onSave) onSave(finalUri);
      navigation.goBack();
    } catch {
      Alert.alert('Hata', 'Resim kaydedilemedi');
    }
    setSaving(false);
  };

  const TEXT_COLORS = ['#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#FF6600', BRAND.primary, BRAND.accent];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Düzenle</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={BRAND.primary} /> : (
            <View style={styles.saveBtn}>
              <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 14 }}>Kaydet</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Image Preview */}
      <View style={styles.previewContainer}>
        <View style={[styles.imageWrap, { backgroundColor: '#000' }]}>
          <Image source={{ uri: imageUri }} style={[styles.previewImage, getFilterStyle()]} resizeMode="contain" />
          {getFilterOverlay() && <View style={[styles.filterOverlay, { backgroundColor: getFilterOverlay() }]} />}
          {getBrightnessOverlay() && <View style={[styles.filterOverlay, { backgroundColor: getBrightnessOverlay() }]} />}
          {contrast !== 0 && <View style={[styles.filterOverlay, { backgroundColor: contrast > 0 ? `rgba(0,0,0,${contrast * 0.003})` : `rgba(128,128,128,${Math.abs(contrast) * 0.005})` }]} />}

          {textOverlays.map((t) => (
            <TouchableOpacity key={t.id} style={[styles.textOverlay, { left: t.x, top: t.y }]} onLongPress={() => removeTextOverlay(t.id)}>
              <Text style={{ color: t.color, fontFamily: t.font, fontSize: 20, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 }}>{t.text}</Text>
            </TouchableOpacity>
          ))}

          {stickerOverlays.map((s) => (
            <TouchableOpacity key={s.id} style={[styles.stickerOverlay, { left: s.x, top: s.y }]} onLongPress={() => setStickerOverlays(prev => prev.filter(x => x.id !== s.id))}>
              <Text style={{ fontSize: 32 }}>{s.emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tab Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t.id} style={[styles.tab, activeTab === t.id && { borderBottomColor: BRAND.primary, borderBottomWidth: 2 }]} onPress={() => setActiveTab(t.id)}>
            <Ionicons name={t.icon} size={18} color={activeTab === t.id ? BRAND.primary : colors.textMuted} />
            <Text style={{ color: activeTab === t.id ? BRAND.primary : colors.textMuted, fontSize: 11 }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab Content */}
      <ScrollView horizontal={activeTab === 'filters' || activeTab === 'sticker'} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolContent}>
        {/* Filters */}
        {activeTab === 'filters' && FILTERS.map(f => (
          <TouchableOpacity key={f.id} style={[styles.filterBtn, activeFilter === f.id && styles.filterActive]} onPress={() => setActiveFilter(f.id)}>
            <View style={styles.filterThumb}>
              <Image source={{ uri: imageUri }} style={styles.filterThumbImg} />
              {f.overlay && <View style={[styles.filterThumbOverlay, { backgroundColor: f.overlay }]} />}
            </View>
            <Text style={{ color: activeFilter === f.id ? BRAND.primary : colors.textMuted, fontSize: 10, marginTop: 4 }}>{f.name}</Text>
          </TouchableOpacity>
        ))}

        {/* Adjustments */}
        {activeTab === 'adjust' && (
          <View style={styles.adjustContainer}>
            {[
              { label: 'Parlaklık', value: brightness, set: setBrightness, icon: 'sunny' },
              { label: 'Kontrast', value: contrast, set: setContrast, icon: 'contrast' },
              { label: 'Doygunluk', value: saturation, set: setSaturation, icon: 'color-fill' },
            ].map(adj => (
              <View key={adj.label} style={styles.adjustRow}>
                <Ionicons name={adj.icon} size={18} color={colors.textMuted} />
                <Text style={{ color: colors.text, fontSize: 13, width: 80 }}>{adj.label}</Text>
                <View style={[styles.slider, { backgroundColor: colors.surfaceElevated }]}>
                  <TouchableOpacity onPress={() => adj.set(Math.max(-100, adj.value - 10))} style={styles.sliderBtn}>
                    <Ionicons name="remove" size={16} color={colors.text} />
                  </TouchableOpacity>
                  <View style={styles.sliderTrack}>
                    <View style={[styles.sliderFill, { width: `${50 + adj.value / 2}%`, backgroundColor: BRAND.primary }]} />
                  </View>
                  <TouchableOpacity onPress={() => adj.set(Math.min(100, adj.value + 10))} style={styles.sliderBtn}>
                    <Ionicons name="add" size={16} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 12, width: 30, textAlign: 'right' }}>{adj.value}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.resetBtn} onPress={() => { setBrightness(0); setContrast(0); setSaturation(0); }}>
              <Text style={{ color: BRAND.primary, fontSize: 13 }}>Sıfırla</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Crop */}
        {activeTab === 'crop' && (
          <View style={styles.cropContainer}>
            {[
              { id: 'square', label: '1:1 Kare', icon: 'square' },
              { id: 'portrait', label: '4:5 Dikey', icon: 'phone-portrait' },
              { id: 'landscape', label: '16:9 Yatay', icon: 'phone-landscape' },
              { id: 'free', label: 'Serbest', icon: 'resize' },
            ].map(c => (
              <TouchableOpacity key={c.id} style={[styles.cropBtn, cropMode === c.id && { backgroundColor: `${BRAND.primary}18`, borderColor: BRAND.primary }]} onPress={() => setCropMode(c.id)}>
                <Ionicons name={c.icon} size={22} color={cropMode === c.id ? BRAND.primary : colors.textMuted} />
                <Text style={{ color: cropMode === c.id ? BRAND.primary : colors.textMuted, fontSize: 12 }}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Text */}
        {activeTab === 'text' && (
          <View style={styles.textContainer}>
            <View style={[styles.textInputRow, { backgroundColor: colors.surfaceElevated }]}>
              <TextInput
                style={{ flex: 1, color: colors.text, fontSize: 14 }}
                placeholder="Metin girin..."
                placeholderTextColor={colors.textMuted}
                value={newText}
                onChangeText={setNewText}
              />
              <TouchableOpacity onPress={addText} style={[styles.addTextBtn, { backgroundColor: BRAND.primary }]}>
                <Ionicons name="add" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 8 }}>
              {FONTS.map(f => (
                <TouchableOpacity key={f} style={[styles.fontBtn, textFont === f && { borderColor: BRAND.primary }]} onPress={() => setTextFont(f)}>
                  <Text style={{ fontFamily: f, color: colors.text, fontSize: 13 }}>Aa</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 8 }}>
              {TEXT_COLORS.map(c => (
                <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c, borderColor: textColor === c ? BRAND.primary : 'transparent' }]} onPress={() => setTextColor(c)} />
              ))}
            </ScrollView>
            {textOverlays.length > 0 && (
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8 }}>Uzun basarak metni kaldırabilirsiniz</Text>
            )}
          </View>
        )}

        {/* Stickers */}
        {activeTab === 'sticker' && STICKERS.map(s => (
          <TouchableOpacity key={s} style={styles.stickerBtn} onPress={() => addSticker(s)}>
            <Text style={{ fontSize: 28 }}>{s}</Text>
          </TouchableOpacity>
        ))}

        {/* Draw */}
        {activeTab === 'draw' && (
          <View style={styles.drawContainer}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Fırça Boyutu</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginBottom: 12 }}>
              {BRUSH_SIZES.map(s => (
                <TouchableOpacity key={s} style={[styles.brushBtn, brushSize === s && { borderColor: BRAND.primary }]} onPress={() => setBrushSize(s)}>
                  <View style={{ width: s * 2, height: s * 2, borderRadius: s, backgroundColor: drawColor }} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Renk</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {TEXT_COLORS.map(c => (
                <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c, borderColor: drawColor === c ? BRAND.primary : 'transparent' }]} onPress={() => setDrawColor(c)} />
              ))}
            </ScrollView>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 10 }}>Resim üzerinde parmağınızla çizin</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  saveBtn: { backgroundColor: BRAND.primary, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 18 },
  previewContainer: { alignItems: 'center', paddingVertical: 12 },
  imageWrap: { width: IMG_SIZE, height: IMG_SIZE, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  previewImage: { width: '100%', height: '100%' },
  filterOverlay: { ...StyleSheet.absoluteFillObject },
  textOverlay: { position: 'absolute' },
  stickerOverlay: { position: 'absolute' },
  tabRow: { paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: 'rgba(128,128,128,0.2)' },
  tab: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, gap: 2 },
  toolContent: { padding: 12, gap: 8 },
  filterBtn: { alignItems: 'center', marginRight: 4, padding: 4, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  filterActive: { borderColor: BRAND.primary },
  filterThumb: { width: 60, height: 60, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  filterThumbImg: { width: '100%', height: '100%' },
  filterThumbOverlay: { ...StyleSheet.absoluteFillObject },
  adjustContainer: { flex: 1, width: SW - 24 },
  adjustRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  slider: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 10, height: 36, paddingHorizontal: 4 },
  sliderBtn: { padding: 6 },
  sliderTrack: { flex: 1, height: 4, backgroundColor: 'rgba(128,128,128,0.3)', borderRadius: 2, overflow: 'hidden' },
  sliderFill: { height: '100%', borderRadius: 2 },
  resetBtn: { alignSelf: 'center', paddingVertical: 8 },
  cropContainer: { flexDirection: 'row', gap: 12, width: SW - 24, justifyContent: 'center' },
  cropBtn: { alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: 'transparent', gap: 6 },
  textContainer: { width: SW - 24 },
  textInputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  addTextBtn: { borderRadius: 16, padding: 6 },
  fontBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(128,128,128,0.3)' },
  colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2.5 },
  stickerBtn: { padding: 6 },
  drawContainer: { width: SW - 24 },
  brushBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(128,128,128,0.3)' },
});
