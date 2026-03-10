import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  handleRetry = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Ionicons name="warning-outline" size={56} color="#7C3AED" />
          <Text style={styles.title}>Bir Hata Oluştu</Text>
          <Text style={styles.desc}>Beklenmeyen bir sorun oluştu. Lütfen tekrar deneyin.</Text>
          <TouchableOpacity style={styles.btn} onPress={this.handleRetry}>
            <Ionicons name="refresh" size={18} color="#FFF" />
            <Text style={styles.btnText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090B', padding: 32 },
  title: { color: '#FFF', fontSize: 22, fontWeight: '700', marginTop: 16 },
  desc: { color: '#71717A', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#7C3AED', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, marginTop: 24 },
  btnText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
});
