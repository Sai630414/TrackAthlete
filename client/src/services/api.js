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
  const isFederationRequest = /^\/?federation(?:\/|$)/.test(config.url || '');

  const organizerSession = readSession(organizerSessionKey);
  const standardSession = readSession(standardSessionKey);

  let token = null;
  if (isOrganizerRequest) {
    token = organizerSession?.token;
  } else if (isFederationRequest) {
    token = localStorage.getItem('trackathlete-federation-token');
  } else {
    // Normal athlete / parent / coach / sponsor / academy requests (including /organizer-events/)
    token = standardSession?.token || localStorage.getItem('token') || localStorage.getItem('trackathlete-token');
  }

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
  const url = error.config?.url || '';
  const isOrganizerRequest = /^\/?organizer(?:\/|$)/.test(url);
  const isFederationRequest = /^\/?federation(?:\/|$)/.test(url);

  if (error.response?.status === 401) {
    if (isOrganizerRequest) {
      localStorage.removeItem(organizerSessionKey);
      if (window.location.pathname.startsWith('/organizer')) {
        window.location.assign('/organizer/login?session=expired');
      }
    } else if (isFederationRequest) {
      localStorage.removeItem('trackathlete-federation-token');
      if (window.location.pathname.startsWith('/federation')) {
        window.location.assign('/federation/login?session=expired');
      }
    } else {
      localStorage.removeItem(standardSessionKey);
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/organizer') && !window.location.pathname.startsWith('/federation')) {
        window.location.assign('/login?session=expired');
      }
    }
  }
  return Promise.reject(error);
});

export default api;
