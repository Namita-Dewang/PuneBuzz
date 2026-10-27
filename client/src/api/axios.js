import axios from 'axios';
import { clearToken, getToken } from '../utils/authStorage';

const baseURL = import.meta.env.VITE_API_URL;
if (!baseURL) {
  throw new Error('VITE_API_URL is not set. Copy client/.env.example to client/.env.');
}

const api = axios.create({
  baseURL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Codes the API uses when the token itself is the problem. Other 401s, such
// as INVALID_CREDENTIALS from a wrong password, must not log anyone out.
const TOKEN_ERRORS = new Set(['AUTH_REQUIRED', 'INVALID_TOKEN', 'TOKEN_EXPIRED']);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const sentToken = Boolean(error.config?.headers?.Authorization);
    const code = error.response?.data?.error?.code;
    if (error.response?.status === 401 && sentToken && TOKEN_ERRORS.has(code)) {
      clearToken('expired');
    }
    return Promise.reject(error);
  }
);

export default api;
