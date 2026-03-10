/**
 * ErrorBoundary - Uygulama genelinde hata yakalama bileşeni.
 * Beklenmeyen JS hatalarında kullanıcıya anlamlı bir ekran gösterir
 * ve uygulamayı yeniden başlatma imkânı sunar.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        // You can log to Sentry or other error tracking services here
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    handleRestart = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <View style={styles.iconWrap}>
                        <Ionicons name="warning-outline" size={64} color="#EF4444" />
                    </View>
                    <Text style={styles.title}>Bir hata oluştu</Text>
                    <Text style={styles.subtitle}>
                        Beklenmeyen bir sorun meydana geldi. Lütfen tekrar deneyin.
                    </Text>

                    <TouchableOpacity style={styles.button} onPress={this.handleRestart} activeOpacity={0.8}>
                        <Ionicons name="refresh" size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.buttonText}>Tekrar Dene</Text>
                    </TouchableOpacity>

                    {__DEV__ && this.state.error && (
                        <ScrollView style={styles.debugBox}>
                            <Text style={styles.debugTitle}>Debug Info:</Text>
                            <Text style={styles.debugText}>{this.state.error.toString()}</Text>
                            {this.state.errorInfo?.componentStack && (
                                <Text style={styles.debugText}>{this.state.errorInfo.componentStack}</Text>
                            )}
                        </ScrollView>
                    )}
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0A0B',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    iconWrap: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(239,68,68,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 32,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#7C3AED',
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 12,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    debugBox: {
        marginTop: 24,
        maxHeight: 200,
        backgroundColor: '#1E1E2E',
        borderRadius: 8,
        padding: 12,
        width: '100%',
    },
    debugTitle: {
        color: '#EF4444',
        fontWeight: '700',
        marginBottom: 4,
        fontSize: 12,
    },
    debugText: {
        color: '#94A3B8',
        fontSize: 11,
        fontFamily: 'monospace',
    },
});
