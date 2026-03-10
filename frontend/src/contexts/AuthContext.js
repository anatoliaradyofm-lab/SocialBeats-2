import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = '@auth_token';
const AUTH_USER_KEY = '@auth_user';
const REMEMBER_ME_KEY = '@remember_me';
const ACCOUNTS_KEY = '@auth_accounts';
const CURRENT_ACCOUNT_INDEX_KEY = '@auth_current_account_index';
const MAX_ACCOUNTS = 3;
const GUEST_USER = { id: 'guest', username: 'misafir', display_name: 'Misafir', isGuest: true };

async function secureSet(key, value) {
  try { await SecureStore.setItemAsync(key, value); }
  catch { await AsyncStorage.setItem(key, value); }
}

async function secureGet(key) {
  try {
    const v = await SecureStore.getItemAsync(key);
    return v ?? await AsyncStorage.getItem(key);
  } catch { return AsyncStorage.getItem(key); }
}

async function secureDel(key) {
  try { await SecureStore.deleteItemAsync(key); } catch {}
  try { await AsyncStorage.removeItem(key); } catch {}
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [currentAccountIndex, setCurrentAccountIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => { loadStoredAuth(); }, []);

  async function loadStoredAuth() {
    try {
      const rm = await AsyncStorage.getItem(REMEMBER_ME_KEY);
      const usePersist = rm !== 'false';
      setRememberMe(usePersist);
      if (!usePersist) { setIsLoading(false); return; }

      const [storedToken, storedUser, accountsJson, idxStr] = await Promise.all([
        secureGet(AUTH_TOKEN_KEY), secureGet(AUTH_USER_KEY),
        AsyncStorage.getItem(ACCOUNTS_KEY), AsyncStorage.getItem(CURRENT_ACCOUNT_INDEX_KEY),
      ]);

      let accts = [];
      try { if (accountsJson) accts = JSON.parse(accountsJson); } catch {}

      if (Array.isArray(accts) && accts.length > 0) {
        setAccounts(accts);
        const idx = Math.min(parseInt(idxStr || '0', 10), accts.length - 1);
        setCurrentAccountIndex(idx);
        const acc = accts[idx];
        if (acc?.token && acc?.user) {
          setToken(acc.token);
          setUser(acc.user);
          setIsLoading(false);
          return;
        }
      }

      if (storedToken && storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed?.isGuest) { setIsLoading(false); return; }
          setUser(parsed);
          setToken(storedToken);
        } catch { await clearStorage(); }
      }
    } catch { await clearStorage(); }
    finally { setIsLoading(false); }
  }

  async function clearStorage() {
    await Promise.all([
      secureDel(AUTH_TOKEN_KEY), secureDel(AUTH_USER_KEY),
      AsyncStorage.multiRemove([ACCOUNTS_KEY, CURRENT_ACCOUNT_INDEX_KEY]),
    ]);
    setUser(null); setToken(null); setAccounts([]); setCurrentAccountIndex(0);
  }

  async function persistAccounts(accts, idx) {
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accts));
    await AsyncStorage.setItem(CURRENT_ACCOUNT_INDEX_KEY, String(idx));
    if (rememberMe && accts[idx]) {
      await secureSet(AUTH_TOKEN_KEY, accts[idx].token);
      await secureSet(AUTH_USER_KEY, JSON.stringify(accts[idx].user));
    }
  }

  async function login(authToken, userData, doRememberMe = true) {
    if (!authToken || !userData) throw new Error('Invalid auth data');
    setRememberMe(doRememberMe);
    await AsyncStorage.setItem(REMEMBER_ME_KEY, doRememberMe ? 'true' : 'false');
    let accts = [...accounts];
    const existingIdx = accts.findIndex(a => a.user?.id === userData.id);
    let idx;
    if (existingIdx >= 0) {
      accts[existingIdx] = { token: authToken, user: userData };
      idx = existingIdx;
    } else {
      if (accts.length >= MAX_ACCOUNTS) accts = accts.slice(1);
      accts.push({ token: authToken, user: userData });
      idx = accts.length - 1;
    }
    setAccounts(accts); setCurrentAccountIndex(idx);
    setToken(authToken); setUser(userData);
    await persistAccounts(accts, idx);
  }

  async function switchAccount(index) {
    if (index < 0 || index >= accounts.length) return;
    const acc = accounts[index];
    if (!acc?.token || !acc?.user) return;
    setCurrentAccountIndex(index); setToken(acc.token); setUser(acc.user);
    await persistAccounts(accounts, index);
  }

  async function removeAccount(index) {
    if (index < 0 || index >= accounts.length) return;
    const accts = accounts.filter((_, i) => i !== index);
    setAccounts(accts);
    if (accts.length === 0) { await clearStorage(); return; }
    const newIdx = Math.min(currentAccountIndex, accts.length - 1);
    setCurrentAccountIndex(newIdx);
    setToken(accts[newIdx].token); setUser(accts[newIdx].user);
    await persistAccounts(accts, newIdx);
  }

  async function enterAsGuest() {
    await AsyncStorage.setItem(REMEMBER_ME_KEY, 'false');
    setToken(null); setUser(GUEST_USER);
  }

  function exitGuest() { setUser(null); setToken(null); }
  async function logout() { await clearStorage(); }

  async function updateUser(userData) {
    if (!userData) return;
    setUser(userData);
    if (token && rememberMe) await secureSet(AUTH_USER_KEY, JSON.stringify(userData));
    if (accounts[currentAccountIndex]) {
      const accts = [...accounts];
      accts[currentAccountIndex] = { ...accts[currentAccountIndex], user: userData };
      setAccounts(accts);
      await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accts));
    }
  }

  return (
    <AuthContext.Provider value={{
      user, token, accounts, currentAccountIndex, isLoading,
      isAuthenticated: !!(token && user), isGuest: user?.isGuest === true,
      login, logout, updateUser, enterAsGuest, exitGuest, switchAccount, removeAccount,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
