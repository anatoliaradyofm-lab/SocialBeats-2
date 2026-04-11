import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const LIBRARIES = [
  { name: 'React Native',                          license: 'MIT' },
  { name: 'Expo',                                  license: 'MIT' },
  { name: 'React Navigation',                      license: 'MIT' },
  { name: 'React Query (@tanstack)',                license: 'MIT' },
  { name: 'i18next',                               license: 'MIT' },
  { name: 'react-i18next',                         license: 'MIT' },
  { name: '@expo/vector-icons (Ionicons)',          license: 'MIT' },
  { name: 'expo-linear-gradient',                  license: 'MIT' },
  { name: 'expo-image-picker',                     license: 'MIT' },
  { name: 'expo-av',                               license: 'MIT' },
  { name: 'expo-localization',                     license: 'MIT' },
  { name: 'expo-linking',                          license: 'MIT' },
  { name: 'expo-font',                             license: 'MIT' },
  { name: '@react-native-async-storage/async-storage', license: 'MIT' },
  { name: 'react-native-safe-area-context',        license: 'MIT' },
  { name: 'react-native-gesture-handler',          license: 'MIT' },
  { name: 'react-native-reanimated',               license: 'MIT' },
  { name: 'react-native-get-random-values',        license: 'MIT' },
  { name: 'lottie-react-native',                   license: 'Apache-2.0' },
  { name: 'axios',                                 license: 'MIT' },
];

export default function LicensesScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#F8F8F8" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Açık Kaynak Lisansları</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
      >
        <View style={s.card}>
          {LIBRARIES.map((item, i) => (
            <View
              key={item.name}
              style={[s.row, i < LIBRARIES.length - 1 && s.divider]}
            >
              <Text style={s.name}>{item.name}</Text>
              <Text style={s.badge}>{item.license}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#F8F8F8', letterSpacing: -0.3 },
  scroll:      { padding: 16 },
  card:        { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.055)', overflow: 'hidden' },
  row:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  divider:     { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  name:        { fontSize: 14, fontWeight: '600', color: '#F8F8F8', flex: 1, marginRight: 12 },
  badge:       { fontSize: 11, fontWeight: '600', color: 'rgba(192,132,252,0.9)', backgroundColor: 'rgba(192,132,252,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
});
