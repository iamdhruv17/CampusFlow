import axios from 'axios';
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', withCredentials: true, headers: { 'Content-Type': 'application/json' } });
let csrfToken = null;
api.interceptors.request.use(async (config) => {
  if (['post', 'put', 'patch', 'delete'].includes((config.method || '').toLowerCase()) && !config.url?.endsWith('/auth/login') && !config.url?.endsWith('/auth/register')) {
    if (!csrfToken) { const response = await axios.get(`${api.defaults.baseURL}/auth/csrf`, { withCredentials: true }); csrfToken = response.data.csrfToken; }
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});
api.interceptors.response.use((response) => { if (response.config.url?.endsWith('/auth/login') || response.config.url?.endsWith('/auth/register')) csrfToken = null; return response; }, (error) => Promise.reject(error));
export default api;
