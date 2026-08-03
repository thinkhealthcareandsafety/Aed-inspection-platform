import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';

const BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: attach JWT ───────────────────────────────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('aed_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ── Response: handle 401 globally ────────────────────────────────────────────
apiClient.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ error?: { message?: string } }>) => {
    if (err.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('aed_token');
        window.location.href = '/login';
      }
    }
    const message =
      err.response?.data?.error?.message ?? err.message ?? 'Request failed';
    toast.error(message);
    return Promise.reject(err);
  },
);

// ── Typed helpers ─────────────────────────────────────────────────────────────

export const api = {
  auth: {
    login: (email: string, password: string) =>
      apiClient.post<{ token: string; user: import('@/types').User }>('/auth/login', {
        email,
        password,
      }),
    register: (data: {
      name: string;
      email: string;
      password: string;
      role?: string;
    }) =>
      apiClient.post<{ token: string; user: import('@/types').User }>('/auth/register', data),
    me: () => apiClient.get<{ user: import('@/types').User }>('/auth/me'),
  },

  inspections: {
    list: (params?: {
      page?: number;
      limit?: number;
      result?: string;
      manufacturer?: string;
      locationId?: string;
    }) =>
      apiClient.get<
        import('@/types').PaginatedResponse<import('@/types').Inspection>
      >('/inspections', { params }),

    create: (data: { locationId?: string; notes?: string }) =>
      apiClient.post<{ inspection: import('@/types').Inspection }>('/inspections', data),

    get: (id: string) =>
      apiClient.get<{ inspection: import('@/types').Inspection }>(`/inspections/${id}`),

    update: (id: string, data: Partial<import('@/types').Inspection>) =>
      apiClient.patch<{ inspection: import('@/types').Inspection }>(`/inspections/${id}`, data),

    stats: () =>
      apiClient.get<import('@/types').InspectionStats>('/inspections/stats/summary'),
  },

  reports: {
    pdf: (inspectionId: string) =>
      `${BASE_URL}/api/v1/reports/${inspectionId}/pdf`,
    json: (inspectionId: string) =>
      apiClient.get(`/reports/${inspectionId}/json`),
  },
};
