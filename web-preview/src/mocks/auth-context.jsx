// AuthContext — preview mock (always logged in as guest)
import React, { createContext, useContext, useState } from 'react';

const DEFAULT_USER = {
  id: 'preview-1',
  username: 'socialbeats_user',
  display_name: 'SocialBeats User',
  email: 'preview@socialbeats.app',
  avatar_url: 'https://i.pravatar.cc/200?u=preview1',
  bio: '',
  followers_count: 1200,
  following_count: 450,
  posts_count: 2,
  instagram: '',
  twitter: '',
  country: '',
  city: '',
  location: '',
  website: '',
  is_private: false,
  isGuest: false,
};

function loadUser() {
  try { const s = localStorage.getItem('_mock_user'); if (s) return { ...DEFAULT_USER, ...JSON.parse(s) }; } catch {}
  return { ...DEFAULT_USER };
}

const PREVIEW_USER = loadUser();

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(PREVIEW_USER);

  const value = {
    user,
    token: 'preview-token',
    isAuthenticated: true,
    isGuest: false,
    loading: false,
    login:   (email, password) => Promise.resolve({ access_token: 'mock-token', user: PREVIEW_USER }),
    logout:  () => setUser(PREVIEW_USER),
    register:(data) => { if (data?.username) setUser(u => ({ ...u, username: data.username, display_name: data.name || data.username, email: data.email || u.email })); return Promise.resolve({ access_token: 'mock-token', user: PREVIEW_USER }); },
    updateUser: (data) => setUser(u => {
      const next = { ...u, ...data };
      try { localStorage.setItem('_mock_user', JSON.stringify(next)); } catch {}
      return next;
    }),
    loginAsGuest: () => { setUser({ ...PREVIEW_USER, isGuest: true }); return Promise.resolve(); },
    enterAsGuest: () => { setUser({ ...PREVIEW_USER, isGuest: true }); return Promise.resolve(); },
    exitGuest:    () => setUser(PREVIEW_USER),
    switchAccount: () => {},
    accounts: [PREVIEW_USER],
    currentAccountIndex: 0,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
