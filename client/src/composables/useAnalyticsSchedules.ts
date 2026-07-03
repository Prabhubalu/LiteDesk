import { ref } from 'vue';
import apiClient from '@/utils/apiClient';
import type {
  AnalyticsScheduleRecord,
  AnalyticsSnapshotRecord,
} from '@/types/analytics.types';

export interface AnalyticsScheduleListMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export function useAnalyticsSchedules() {
  const schedules = ref<AnalyticsScheduleRecord[]>([]);
  const schedule = ref<AnalyticsScheduleRecord | null>(null);
  const snapshots = ref<AnalyticsSnapshotRecord[]>([]);
  const snapshot = ref<AnalyticsSnapshotRecord | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const running = ref(false);
  const listMeta = ref<AnalyticsScheduleListMeta | null>(null);
  const snapshotMeta = ref<AnalyticsScheduleListMeta | null>(null);

  async function fetchSchedules(params: Record<string, string | number | boolean | undefined> = {}) {
    loading.value = true;
    try {
      const response = await apiClient.get('/analytics/schedules', { params, cache: 'no-store' });
      if (response?.success) {
        schedules.value = response.data ?? [];
        listMeta.value = response.meta ?? null;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function fetchSchedule(id: string) {
    loading.value = true;
    try {
      const response = await apiClient.get(`/analytics/schedules/${id}`, { cache: 'no-store' });
      if (response?.success) {
        schedule.value = response.data;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function createSchedule(payload: Partial<AnalyticsScheduleRecord> & { reportId: string; recipients: string[] }) {
    saving.value = true;
    try {
      const response = await apiClient.post('/analytics/schedules', payload);
      if (response?.success) {
        schedule.value = response.data;
      }
      return response;
    } finally {
      saving.value = false;
    }
  }

  async function updateSchedule(id: string, payload: Partial<AnalyticsScheduleRecord>) {
    saving.value = true;
    try {
      const response = await apiClient.put(`/analytics/schedules/${id}`, payload);
      if (response?.success) {
        schedule.value = response.data;
      }
      return response;
    } finally {
      saving.value = false;
    }
  }

  async function deleteSchedule(id: string) {
    return apiClient.delete(`/analytics/schedules/${id}`);
  }

  async function pauseSchedule(id: string) {
    return apiClient.post(`/analytics/schedules/${id}/pause`, {});
  }

  async function resumeSchedule(id: string) {
    return apiClient.post(`/analytics/schedules/${id}/resume`, {});
  }

  async function runScheduleNow(id: string) {
    running.value = true;
    try {
      return apiClient.post(`/analytics/schedules/${id}/run-now`, {});
    } finally {
      running.value = false;
    }
  }

  async function fetchSnapshots(params: Record<string, string | number | boolean | undefined> = {}) {
    loading.value = true;
    try {
      const response = await apiClient.get('/analytics/snapshots', { params, cache: 'no-store' });
      if (response?.success) {
        snapshots.value = response.data ?? [];
        snapshotMeta.value = response.meta ?? null;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function fetchSnapshot(id: string) {
    loading.value = true;
    try {
      const response = await apiClient.get(`/analytics/snapshots/${id}`, { cache: 'no-store' });
      if (response?.success) {
        snapshot.value = response.data;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  return {
    schedules,
    schedule,
    snapshots,
    snapshot,
    loading,
    saving,
    running,
    listMeta,
    snapshotMeta,
    fetchSchedules,
    fetchSchedule,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    pauseSchedule,
    resumeSchedule,
    runScheduleNow,
    fetchSnapshots,
    fetchSnapshot,
  };
}
