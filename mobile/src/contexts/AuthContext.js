/**
 * AuthContext - Manages authentication state for SocialBeats mobile
 * Supports token (JWT), user persistence, guest mode, "Beni hatırla",
 * and account switch (max 3 accounts)
 * Uses SecureStore for sensitive data (token, user); falls back to AsyncStorage on failure.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import biometricService from '../services/biometricService';

import api from '../services/api';

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';
const REMEMBER_ME_KEY = '@remember_me';
const ACCOUNTS_KEY = '@auth_accounts';
const CURRENT_ACCOUNT_INDEX_KEY = '@auth_current_account_index';
const MAX_ACCOUNTS = 3;

const GUEST_USER = { id: 'guest', username: 'misafir', display_name: 'Misafir', isGuest: true };

async function secureSetItem(key, value) {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (e) {
    console.warn('SecureStore set failed, falling back to AsyncStorage:', e?.message);
    await AsyncStorage.setItem(key, value);
  }
}

async function secureGetItem(key) {
  try {
    const value = await SecureStore.getItemAsync(key);
    if (value !== null) return value;
    return await AsyncStorage.getItem(key);
  } catch (e) {
    console.warn('SecureStore get failed, falling back to AsyncStorage:', e?.message);
    return await AsyncStorage.getItem(key);
  }
}

async function secureDeleteItem(key) {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (_) { }
  try {
    await AsyncStorage.removeItem(key);
  } catch (_) { }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [currentAccountIndex, setCurrentAccountIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Sync token to API singleton
  useEffect(() => {
    api.setToken(token);
  }, [token]);

  async function loadStoredAuth() {
    try {
      const rm = await AsyncStorage.getItem(REMEMBER_ME_KEY);
      const usePersist = rm !== 'false';
      setRememberMe(usePersist);
      if (!usePersist) {
        setIsLoading(false);
        return;
      }
      const [storedToken, storedUser, accountsJson, idxStr] = await Promise.all([
        secureGetItem(AUTH_TOKEN_KEY),
        secureGetItem(AUTH_USER_KEY),
        AsyncStorage.getItem(ACCOUNTS_KEY),
        AsyncStorage.getItem(CURRENT_ACCOUNT_INDEX_KEY),
      ]);
      let accts = [];
      try {
        if (accountsJson) accts = JSON.parse(accountsJson);
      } catch { }
      if (Array.isArray(accts) && accts.length > 0) {
        setAccounts(accts);
        const idx = Math.min(parseInt(idxStr || '0', 10), accts.length - 1);
        setCurrentAccountIndex(idx);
        const acc = accts[idx];
        if (acc?.token && acc?.user) {
          setToken(acc.token);
          setUser(acc.user);
          await secureSetItem(AUTH_TOKEN_KEY, acc.token);
          await secureSetItem(AUTH_USER_KEY, JSON.stringify(acc.user));
          setIsLoading(false);
          return;
        }
      }
      if (storedToken && storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed?.isGuest) return;
          setUser(parsed);
          setToken(storedToken);
          accts = [{ token: storedToken, user: parsed }];
          setAccounts(accts);
          setCurrentAccountIndex(0);
          await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accts));
          await AsyncStorage.setItem(CURRENT_ACCOUNT_INDEX_KEY, '0');
          await secureSetItem(AUTH_TOKEN_KEY, storedToken);
          await secureSetItem(AUTH_USER_KEY, storedUser);
        } catch (_) {
          await clearStorage();
        }
      }
    } catch (err) {
      console.error('Auth load error:', err);
      await clearStorage();
    } finally {
      setIsLoading(false);
    }
  }

  async function clearStorage() {
    await Promise.all([
      secureDeleteItem(AUTH_TOKEN_KEY),
      secureDeleteItem(AUTH_USER_KEY),
      AsyncStorage.multiRemove([ACCOUNTS_KEY, CURRENT_ACCOUNT_INDEX_KEY]),
    ]);
    setUser(null);
    setToken(null);
    setAccounts([]);
    setCurrentAccountIndex(0);
  }

  async function persistAccounts(accts, idx) {
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accts));
    await AsyncStorage.setItem(CURRENT_ACCOUNT_INDEX_KEY, String(idx));
    if (rememberMe && accts[idx]) {
      await secureSetItem(AUTH_TOKEN_KEY, accts[idx].token);
      await secureSetItem(AUTH_USER_KEY, JSON.stringify(accts[idx].user));
    }
  }

  // ── Internal: apply auth state (called after API response) ──────────────────
  async function applyAuth(authToken, userData, doRememberMe = true) {
    const u = userData && typeof userData === 'object' ? userData : null;
    if (!authToken || !u) throw new Error('Invalid auth data');
    setRememberMe(doRememberMe);
    await AsyncStorage.setItem(REMEMBER_ME_KEY, doRememberMe ? 'true' : 'false');
    let accts = [...accounts];
    const existingIdx = accts.findIndex((a) => a.user?.id === u.id || a.user?.username === u.username);
    let idx = 0;
    if (existingIdx >= 0) {
      accts[existingIdx] = { token: authToken, user: u };
      idx = existingIdx;
      setCurrentAccountIndex(idx);
    } else {
      if (accts.length >= MAX_ACCOUNTS) accts = accts.slice(1);
      accts.push({ token: authToken, user: u });
      idx = accts.length - 1;
      setCurrentAccountIndex(idx);
    }
    setAccounts(accts);
    setToken(authToken);
    setUser(u);
    await persistAccounts(accts, idx);

    try {
      const biometricEnabled = await biometricService.isEnabled();
      if (biometricEnabled) {
        await biometricService.enable(authToken);
      }
    } catch (_) { }
  }

  // ── Public: login with email + password (calls backend) ──────────────────────
  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    if (!res?.access_token) {
      throw new Error(res?.detail || 'Invalid email or password');
    }
    await applyAuth(res.access_token, res.user);
  }

  // ── Public: register new account (calls backend + auto-login) ────────────────
  async function register({ email, password, username, name }) {
    const res = await api.post('/auth/register', {
      email,
      password,
      username,
      display_name: name || username,
    });
    if (!res?.access_token) {
      throw new Error(res?.detail || 'Registration failed');
    }
    await applyAuth(res.access_token, res.user);
  }

  // ── Public: enter as guest ───────────────────────────────────────────────────
  async function loginAsGuest() {
    await enterAsGuest();
  }

  async function switchAccount(index) {
    if (index < 0 || index >= accounts.length) return;
    const acc = accounts[index];
    if (!acc?.token || !acc?.user) return;
    setCurrentAccountIndex(index);
    setToken(acc.token);
    setUser(acc.user);
    await persistAccounts(accounts, index);
  }

  async function removeAccount(index) {
    if (index < 0 || index >= accounts.length) return;
    const accts = accounts.filter((_, i) => i !== index);
    setAccounts(accts);
    if (accts.length === 0) {
      await clearStorage();
      return;
    }
    const newIdx = Math.min(currentAccountIndex >= accts.length ? accts.length - 1 : currentAccountIndex, accts.length - 1);
    setCurrentAccountIndex(newIdx);
    const acc = accts[newIdx];
    setToken(acc.token);
    setUser(acc.user);
    await persistAccounts(accts, newIdx);
  }

  async function enterAsGuest() {
    await AsyncStorage.setItem(REMEMBER_ME_KEY, 'false');
    setToken(null);
    setUser(GUEST_USER);
  }

  function exitGuest() {
    setUser(null);
    setToken(null);
  }

  async function logout() {
    await clearStorage();
  }

  async function updateUser(userData) {
    if (!userData) return;
    const u = userData && typeof userData === 'object' ? userData : null;
    if (u) {
      if (token && rememberMe) {
        await secureSetItem(AUTH_USER_KEY, JSON.stringify(u));
      }
      setUser(u);
      if (accounts[currentAccountIndex]) {
        const accts = [...accounts];
        accts[currentAccountIndex] = { ...accts[currentAccountIndex], user: u };
        setAccounts(accts);
        await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accts));
      }
    }
  }

  const value = {
    user,
    token,
    accounts,
    currentAccountIndex,
    isLoading,
    isAuthenticated: !!(token && user),
    isGuest: user?.isGuest === true,
    login,
    register,
    loginAsGuest,
    logout,
    updateUser,
    enterAsGuest,
    exitGuest,
    switchAccount,
    removeAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
