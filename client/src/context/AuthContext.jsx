import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);
const storageKey = 'trackathlete-session';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey)) || null; } catch { return null; }
  });

  useEffect(() => {
    if (session?.token) api.defaults.headers.common.Authorization = `Bearer ${session.token}`;
    else delete api.defaults.headers.common.Authorization;
  }, [session]);

  const value = useMemo(() => ({
    user: session?.user || null,
    async login(credentials) {
      const { data } = await api.post('/auth/login', credentials);
      const next = { token: data.token, user: data.user };
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSession(next);
      return data.user;
    },
    async signup(formData) {
      const { data } = await api.post('/auth/signup', formData);
      const next = { token: data.token, user: data.user };
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSession(next);
      return data.user;
    },
    logout() {
      localStorage.removeItem(storageKey);
      setSession(null);
    }
  }), [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
