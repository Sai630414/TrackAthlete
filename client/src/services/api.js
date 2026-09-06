import axios from 'axios';

// Production must never fall back to localhost. VITE_API_URL may be either the
// server origin or the full /api base, so normalize both safely.
const configuredApiUrl = import.meta.env.VITE_API_URL;
const apiBase = configuredApiUrl
  ? `${configuredApiUrl.replace(/\/$/, '').replace(/\/api$/, '')}/api`
  : (import.meta.env.PROD ? 'https://trackathletefederation-server.vercel.app/api' : 'http://localhost:5000/api');

const api = axios.create({
  baseURL: apiBase
});

const organizerSessionKey = 'trackathlete-organizer-session';
const standardSessionKey = 'trackathlete-session';
const readSession = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
};

api.interceptors.request.use((config) => {
  const isOrganizerRequest = /^\/?organizer(?:\/|$)/.test(config.url || '');
  // Organizer APIs must never inherit a Federation or standard-portal token.
  // Their session is deliberately isolated from the five normal workspaces.
  const organizerSession = readSession(organizerSessionKey);
  const standardSession = readSession(standardSessionKey);
  const token = isOrganizerRequest
    ? organizerSession?.token
    : (localStorage.getItem('trackathlete-federation-token') || standardSession?.token || localStorage.getItem('token') || localStorage.getItem('trackathlete-token'));

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (config.headers) {
    delete config.headers.Authorization;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(undefined, (error) => {
  const isOrganizerRequest = /^\/?organizer(?:\/|$)/.test(error.config?.url || '');
  if (isOrganizerRequest && error.response?.status === 401) {
    localStorage.removeItem(organizerSessionKey);
    const standard = readSession(standardSessionKey);
    if (standard?.user?.role === 'organizer') localStorage.removeItem(standardSessionKey);
    if (window.location.pathname.startsWith('/organizer')) window.location.assign('/organizer/login?session=expired');
  }
  return Promise.reject(error);
});

export default api;
