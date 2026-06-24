import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/auth/login';
        }
      } else {
        window.location.href = '/auth/login';
      }
    }

    const message = error.response?.data?.error || 'Something went wrong';
    if (error.response?.status !== 401) {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  register: (data: { email: string; username: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),
};

export const numbersApi = {
  list: (params?: Record<string, any>) => api.get('/numbers', { params }),
  get: (id: string) => api.get(`/numbers/${id}`),
  telegram: () => api.get('/numbers/telegram'),
  create: (data: any) => api.post('/numbers', data),
  update: (id: string, data: any) => api.put(`/numbers/${id}`, data),
  delete: (id: string) => api.delete(`/numbers/${id}`),
};

export const ordersApi = {
  list: () => api.get('/orders'),
  get: (id: string) => api.get(`/orders/${id}`),
  create: (numberId: string) => api.post('/orders', { numberId }),
  cancel: (id: string) => api.post(`/orders/${id}/cancel`),
};

export const smsApi = {
  byNumber: (numberId: string) => api.get(`/sms/number/${numberId}`),
  byOrder: (orderId: string) => api.get(`/sms/order/${orderId}`),
  simulate: (data: { numberId: string; sender: string; text: string }) =>
    api.post('/sms/simulate', data),
};

export const usersApi = {
  profile: () => api.get('/users/profile'),
  balance: () => api.get('/users/balance'),
  transactions: (params?: Record<string, any>) => api.get('/users/transactions', { params }),
  notifications: () => api.get('/users/notifications'),
  readNotification: (id: string) => api.put(`/users/notifications/${id}/read`),
  favorites: () => api.get('/users/favorites'),
  toggleFavorite: (numberId: string) => api.post(`/users/favorites/${numberId}`),
  topup: (amount: number) => api.post('/users/balance/topup', { amount }),
  list: (params?: Record<string, any>) => api.get('/users', { params }),
  toggleUser: (id: string) => api.put(`/users/${id}/toggle`),
};

export const adminApi = {
  stats: () => api.get('/admin/stats'),
  logs: (params?: Record<string, any>) => api.get('/admin/logs', { params }),
  countries: () => api.get('/admin/countries'),
  createCountry: (data: any) => api.post('/admin/countries', data),
};

export const countriesApi = {
  list: () => api.get('/countries'),
  numbersByCode: (code: string) => api.get(`/countries/${code}/numbers`),
};
