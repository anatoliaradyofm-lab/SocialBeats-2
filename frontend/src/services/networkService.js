import * as Network from 'expo-network';
import { AppState } from 'react-native';

let _isConnected = true;
let _listeners = [];

export const networkService = {
  get isConnected() { return _isConnected; },

  async check() {
    try {
      const state = await Network.getNetworkStateAsync();
      _isConnected = state.isConnected && state.isInternetReachable !== false;
    } catch { _isConnected = true; }
    return _isConnected;
  },

  onChange(cb) {
    _listeners.push(cb);
    return () => { _listeners = _listeners.filter(l => l !== cb); };
  },

  _notify() {
    _listeners.forEach(cb => { try { cb(_isConnected); } catch {} });
  },

  startMonitoring() {
    const poll = async () => {
      const prev = _isConnected;
      await this.check();
      if (prev !== _isConnected) this._notify();
    };
    const interval = setInterval(poll, 10000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') poll(); });
    return () => { clearInterval(interval); sub?.remove?.(); };
  },
};

export default networkService;
