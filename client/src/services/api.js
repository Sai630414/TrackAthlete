import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
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