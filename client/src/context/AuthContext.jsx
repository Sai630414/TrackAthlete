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
    async organizerLogin(credentials) {
      const { data } = await api.post('/organizer/auth/login', credentials);
      const next = { token: data.token, user: { ...data.organizer, role: 'organizer' } };
      localStorage.setItem(storageKey, JSON.stringify(next)); setSession(next); return next.user;
    },
    async organizerSignup(formData) { return (await api.post('/organizer/auth/signup', formData)).data; },
    async verifyOrganizerEmail(email, otp) {
      const { data } = await api.post('/organizer/auth/verify-email', { email, otp });
      const next = { token: data.token, user: { ...data.organizer, role: 'organizer' } };
      localStorage.setItem(storageKey, JSON.stringify(next)); setSession(next); return next.user;
    },
    async forgotPassword(email) {
      const { data } = await api.post('/auth/forgot-password', { email });
      return data;
    },
    async verifyResetOTP(email, otp) {
      const { data } = await api.post('/auth/verify-reset-otp', { email, otp });
      return data;
    },
    async resetPassword(payload) {
      const { data } = await api.post('/auth/reset-password', payload);
      return data;
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
