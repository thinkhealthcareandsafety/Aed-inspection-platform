import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';

export const BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Suppress the global error toast — for requests whose failure is an
     *  expected outcome the caller handles itself, not something to report. */
    skipErrorToast?: boolean;
  }
}

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
    if (!err.config?.skipErrorToast) {
      const message =
        err.response?.data?.error?.message ?? err.message ?? 'Request failed';
      toast.error(message);
    }
    return Promise.reject(err);
  },
);

/**
 * How long an upload-and-analyse request may run, scaled to the file.
 *
 * A fixed 45s used to cover BOTH sending the file and the AI reading it. A
 * 10-second phone video is often 20 MB; on a 3 Mbps connection the upload
 * alone takes most of that, so the request was cut off while it was still
 * making progress and the video check failed — measured locally at 45.1s.
 * Production itself holds a slow request fine (a 100s upload returned 200),
 * so the limit here was the only thing failing it.
 *
 * Budget: the analysis, plus the upload at a pessimistic ~1 Mbps. A longer
 * limit cannot break a request that is working; it only delays the report of
 * one that has genuinely died.
 */
function uploadTimeoutMs(bytes: number): number {
  const ANALYSIS_MS = 60_000;
  const SLOW_UPLOAD_BYTES_PER_MS = 128; // ≈ 1 Mbps
  const MAX_MS = 5 * 60_000;
  return Math.min(MAX_MS, ANALYSIS_MS + Math.ceil(bytes / SLOW_UPLOAD_BYTES_PER_MS));
}

/** Adapts axios's upload event to a plain 0-1 fraction. The upload is the one
 *  stage of an analysis we can actually measure, not estimate — on a stairwell
 *  connection a 20 MB video spends most of its wait here. */
function toFraction(onProgress?: (fraction: number) => void) {
  if (!onProgress) return undefined;
  return (event: import('axios').AxiosProgressEvent) => {
    if (event.total) onProgress(Math.min(1, event.loaded / event.total));
  };
}

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
    upload: (
      inspectionId: string,
      itemId: string,
      file: File | Blob,
      filename: string,
      onProgress?: (fraction: number) => void,
    ) => {
      const form = new FormData();
      form.append('file', file, filename);
      return apiClient.post<{
        item: import('@/types').ChecklistItemResult;
        inspectionResult: import('@/types').InspectionResult;
      }>(`/inspections/${inspectionId}/checklist/${itemId}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: uploadTimeoutMs(file.size),
        onUploadProgress: toFraction(onProgress),
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

  // Staff-only business intelligence: where the funnel leaks, and whose
  // consumables are about to expire.
  insights: {
    funnel: (days: number) =>
      apiClient.get<import('@/types/insights').FunnelResponse>('/insights/funnel', { params: { days } }),

    pipeline: (params?: { urgency?: string; q?: string }) =>
      apiClient.get<import('@/types/insights').PipelineResponse>('/insights/pipeline', { params }),

    downloadPipelineCsv: async () => {
      const res = await apiClient.get('/insights/pipeline.csv', { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(res.data as Blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `aed-replacement-pipeline-${new Date().toISOString().slice(0, 10)}.csv`;
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

    get: (id: string, opts?: { skipErrorToast?: boolean }) =>
      apiClient.get<{ inspection: import('@/types').Inspection }>(`/public/inspections/${id}`, {
        skipErrorToast: opts?.skipErrorToast,
      }),

    checklist: {
      upload: (
        inspectionId: string,
        itemId: string,
        file: File | Blob,
        filename: string,
        onProgress?: (fraction: number) => void,
      ) => {
        const form = new FormData();
        form.append('file', file, filename);
        return apiClient.post<{
          item: import('@/types').ChecklistItemResult;
          inspectionResult: import('@/types').InspectionResult;
        }>(`/public/inspections/${inspectionId}/checklist/${itemId}`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: uploadTimeoutMs(file.size),
          onUploadProgress: toFraction(onProgress),
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
