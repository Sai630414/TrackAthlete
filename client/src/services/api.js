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

api.interceptors.request.use((config) => {
  const fedToken = localStorage.getItem('trackathlete-federation-token');
  const sessionStr = localStorage.getItem('trackathlete-session');
  let token = fedToken;
  if (!token && sessionStr) {
    try {
      const parsed = JSON.parse(sessionStr);
      token = parsed.token;
    } catch (e) {}
  }
  if (!token) {
    token = localStorage.getItem('token') || localStorage.getItem('trackathlete-token');
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;
