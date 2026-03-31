import React from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Linking, FlatList
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const LIBRARIES = [
    { name: 'React Native', license: 'MIT', url: 'https://github.com/facebook/react-native' },
    { name: 'Expo', license: 'MIT', url: 'https://github.com/expo/expo' },
    { name: 'React Navigation', license: 'MIT', url: 'https://github.com/react-navigation/react-navigation' },
    { name: 'Axios', license: 'MIT', url: 'https://github.com/axios/axios' },
    { name: 'i18next', license: 'MIT', url: 'https://github.com/i18next/i18next' },
    { name: 'Ionicons', license: 'MIT', url: 'https://github.com/ionic-team/ionicons' },
    { name: 'Expo Graphics', license: 'MIT', url: 'https://github.com/expo/expo-graphics' },
    { name: 'Async Storage', license: 'MIT', url: 'https://github.com/react-native-async-storage/async-storage' },
    { name: 'Lucide React', license: 'ISC', url: 'https://github.com/lucide-dev/lucide' },
    { name: 'Lottie React Native', license: 'MIT', url: 'https://github.com/lottie-react-native/lottie-react-native' },
];

export default function LicensesScreen({ navigation }) {
    const insets = useSafeAreaInsets();

    return (
        <View style={styles.container}>
      <LinearGradient
        colors={['#1A0A2E', '#100620', '#08060F', '#08060F']}
        locations={[0, 0.18, 0.32, 1]}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
            <LinearGradient colors={['#111827', '#000000']} style={StyleSheet.absoluteFill} />

            <View style={[styles.header, { paddingTop: insets.top }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Lisanslar</Text>
                <View style={{ width: 44 }} />
            </View>

            <FlatList
                data={LIBRARIES}
                keyExtractor={(item) => item.name}
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.licenseItem}
                        onPress={() => Linking.openURL(item.url)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.licenseRow}>
                            <View>
                                <Text style={styles.libraryName}>{item.name}</Text>
                                <Text style={styles.licenseType}>{item.license} Lisansı</Text>
                            </View>
                            <Ionicons name="open-outline" size={18} color="#9CA3AF" />
                        </View>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 100 },
    backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    content: { padding: 16 },
    licenseItem: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    licenseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    libraryName: { fontSize: 16, fontWeight: '600', color: '#E5E7EB' },
    licenseType: { fontSize: 13, color: '#6B7280', marginTop: 4 }
});
