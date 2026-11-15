import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // send httpOnly cookies
  headers: { 'Content-Type': 'application/json' },
});

let csrfToken;

const csrfClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use(async (config) => {
  if (['post', 'put', 'patch', 'delete'].includes(config.method)) {
    if (!csrfToken) {
      const response = await csrfClient.get('/auth/csrf');
      csrfToken = response.data.csrfToken;
    }
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

// Response interceptor — redirect to login on 401
api.interceptors.response.use(
  (response) => {
    if (response.config.url?.endsWith('/auth/login') || response.config.url?.endsWith('/auth/register')) {
      csrfToken = null;
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401 && !error.config?.skipAuthRedirect) {
      // Only redirect if not already on auth pages
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
