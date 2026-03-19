// AuthContext — preview mock (always logged in as guest)
import React, { createContext, useContext, useState } from 'react';

const PREVIEW_USER = {
  id: 'preview-1',
  username: 'anatolia',
  display_name: 'Anatolia Radio FM',
  email: 'preview@socialbeats.app',
  avatar_url: 'https://i.pravatar.cc/200?u=anatolia',
  bio: 'AURORA Design System 2026 · 🎵✨',
  followers_count: 1200,
  following_count: 450,
  posts_count: 2,
  isGuest: false,
};

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
    updateUser: (data) => setUser(u => ({ ...u, ...data })),
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
