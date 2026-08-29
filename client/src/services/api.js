import axios from 'axios';

const api = axios.create({
  // baseURL: 'https://track-athlete-server.vercel.app/api'
  // baseURL: 'http://localhost:5000/api'
  baseURL: 'http://localhost:5000/api'
});

export default api;