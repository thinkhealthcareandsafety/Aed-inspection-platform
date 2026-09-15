import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';

export const BASE_URL =
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

    complete: (id: string) =>
      apiClient.post<{ inspection: import('@/types').Inspection }>(`/inspections/${id}/complete`),
  },

  checklist: {
    upload: (inspectionId: string, itemId: string, file: File | Blob, filename: string) => {
      const form = new FormData();
      form.append('file', file, filename);
      return apiClient.post<{
        item: import('@/types').ChecklistItemResult;
        inspectionResult: import('@/types').InspectionResult;
      }>(`/inspections/${inspectionId}/checklist/${itemId}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 45_000,
      });
    },

    skip: (inspectionId: string, itemId: string) =>
      apiClient.post<{ item: import('@/types').ChecklistItemResult }>(
        `/inspections/${inspectionId}/checklist/${itemId}/skip`,
      ),
  },

  reports: {
    json: (inspectionId: string) =>
      apiClient.get(`/reports/${inspectionId}/json`),

    // The PDF route requires a Bearer token, so a plain `<a href>` (no JS,
    // no auth header) 401s — especially on mobile browsers navigating
    // straight to the URL. Fetch it as an authenticated blob instead and
    // hand the browser a local object URL to download.
    downloadPdf: async (inspectionId: string) => {
      const res = await apiClient.get(`/reports/${inspectionId}/pdf`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(res.data as Blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `aed-inspection-${inspectionId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    },
  },

  // Public, unauthenticated walk-up inspection flow (inspector.aedsmartx.com landing page).
  public: {
    createInspection: (data: { name: string; email: string; phone: string; aedModel: string }) =>
      apiClient.post<{ inspection: import('@/types').Inspection }>('/public/inspections', data),

    get: (id: string) =>
      apiClient.get<{ inspection: import('@/types').Inspection }>(`/public/inspections/${id}`),

    checklist: {
      upload: (inspectionId: string, itemId: string, file: File | Blob, filename: string) => {
        const form = new FormData();
        form.append('file', file, filename);
        return apiClient.post<{
          item: import('@/types').ChecklistItemResult;
          inspectionResult: import('@/types').InspectionResult;
        }>(`/public/inspections/${inspectionId}/checklist/${itemId}`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 45_000,
        });
      },
      skip: (inspectionId: string, itemId: string) =>
        apiClient.post<{ item: import('@/types').ChecklistItemResult }>(
          `/public/inspections/${inspectionId}/checklist/${itemId}/skip`,
        ),
    },

    complete: (id: string) =>
      apiClient.post<{
        inspection: import('@/types').Inspection;
        email: { sent: boolean; recipients: string[]; reason?: string };
      }>(`/public/inspections/${id}/complete`),

    downloadPdf: async (inspectionId: string) => {
      const res = await apiClient.get(`/public/inspections/${inspectionId}/report/pdf`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(res.data as Blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `aed-inspection-${inspectionId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    },
  },
};
