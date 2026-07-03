import { ref } from 'vue';
import apiClient from '@/utils/apiClient';
import type { AnalyticsAlertRecord } from '@/types/analytics.types';

export interface AnalyticsAlertListMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export function useAnalyticsAlerts() {
  const alerts = ref<AnalyticsAlertRecord[]>([]);
  const alert = ref<AnalyticsAlertRecord | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const listMeta = ref<AnalyticsAlertListMeta | null>(null);

  async function fetchAlerts(params: Record<string, string | number | boolean | undefined> = {}) {
    loading.value = true;
    try {
      const response = await apiClient.get('/analytics/alerts', { params, cache: 'no-store' });
      if (response?.success) {
        alerts.value = response.data ?? [];
        listMeta.value = response.meta ?? null;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function fetchAlert(id: string) {
    loading.value = true;
    try {
      const response = await apiClient.get(`/analytics/alerts/${id}`, { cache: 'no-store' });
      if (response?.success) {
        alert.value = response.data;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function createAlert(payload: Partial<AnalyticsAlertRecord> & { widgetId: string; threshold: number }) {
    saving.value = true;
    try {
      const response = await apiClient.post('/analytics/alerts', payload);
      if (response?.success) {
        alert.value = response.data;
      }
      return response;
    } finally {
      saving.value = false;
    }
  }

  async function updateAlert(id: string, payload: Partial<AnalyticsAlertRecord>) {
    saving.value = true;
    try {
      const response = await apiClient.put(`/analytics/alerts/${id}`, payload);
      if (response?.success) {
        alert.value = response.data;
      }
      return response;
    } finally {
      saving.value = false;
    }
  }

  async function deleteAlert(id: string) {
    return apiClient.delete(`/analytics/alerts/${id}`);
  }

  async function pauseAlert(id: string) {
    return apiClient.post(`/analytics/alerts/${id}/pause`, {});
  }

  async function resumeAlert(id: string) {
    return apiClient.post(`/analytics/alerts/${id}/resume`, {});
  }

  return {
    alerts,
    alert,
    loading,
    saving,
    listMeta,
    fetchAlerts,
    fetchAlert,
    createAlert,
    updateAlert,
    deleteAlert,
    pauseAlert,
    resumeAlert,
  };
}
