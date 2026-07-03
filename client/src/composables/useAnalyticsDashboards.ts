import { ref } from 'vue';
import apiClient from '@/utils/apiClient';
import type {
  AnalyticsDashboardLayoutItem,
  AnalyticsDashboardRecord,
  AnalyticsExecuteResult,
} from '@/types/analytics.types';

export interface AnalyticsDashboardTemplate {
  templateKey: string;
  name: string;
  description: string;
  category: AnalyticsDashboardRecord['category'];
  appKey?: string | null;
  icon?: string;
  suggestedWidgets?: string[];
}

export interface AnalyticsDashboardWidgetPayload {
  instanceId: string;
  widgetId: string;
  name?: string;
  chartType: string;
  columnMapping?: Record<string, unknown>;
  thresholds?: Array<{ min: number | null; max: number | null; color: string }> | null;
  kpiValueField?: string | null;
  kpiLabel?: string | null;
  kpiPrefix?: string | null;
  kpiSuffix?: string | null;
  showLegend?: boolean;
  orientation?: string;
  stacked?: boolean;
  smooth?: boolean;
  showDataLabels?: boolean;
  error?: string;
  result: AnalyticsExecuteResult | null;
}

export interface AnalyticsDashboardExecutePayload {
  dashboardId: string;
  widgets: AnalyticsDashboardWidgetPayload[];
  meta: { executionMs: number };
}

export interface AnalyticsDashboardListMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export function useAnalyticsDashboards() {
  const dashboards = ref<AnalyticsDashboardRecord[]>([]);
  const dashboard = ref<AnalyticsDashboardRecord | null>(null);
  const templates = ref<AnalyticsDashboardTemplate[]>([]);
  const executePayload = ref<AnalyticsDashboardExecutePayload | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const executing = ref(false);
  const listMeta = ref<AnalyticsDashboardListMeta | null>(null);

  async function fetchTemplates() {
    const response = await apiClient.get('/analytics/catalog/dashboard-templates', { cache: 'no-store' });
    if (response?.success) {
      templates.value = response.data ?? [];
    }
    return response;
  }

  async function fetchDashboards(params: Record<string, string | number | boolean | undefined> = {}) {
    loading.value = true;
    try {
      const response = await apiClient.get('/analytics/dashboards', { params, cache: 'no-store' });
      if (response?.success) {
        dashboards.value = response.data ?? [];
        listMeta.value = response.meta ?? null;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function fetchDashboard(id: string) {
    loading.value = true;
    try {
      const response = await apiClient.get(`/analytics/dashboards/${id}`, { cache: 'no-store' });
      if (response?.success) {
        dashboard.value = response.data;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function createDashboard(payload: Partial<AnalyticsDashboardRecord>) {
    saving.value = true;
    try {
      const response = await apiClient.post('/analytics/dashboards', payload);
      if (response?.success) {
        dashboard.value = response.data;
      }
      return response;
    } finally {
      saving.value = false;
    }
  }

  async function updateDashboard(id: string, payload: Partial<AnalyticsDashboardRecord>) {
    saving.value = true;
    try {
      const response = await apiClient.put(`/analytics/dashboards/${id}`, payload);
      if (response?.success) {
        dashboard.value = response.data;
      }
      return response;
    } finally {
      saving.value = false;
    }
  }

  async function publishDashboard(id: string) {
    saving.value = true;
    try {
      return await apiClient.post(`/analytics/dashboards/${id}/publish`, {});
    } finally {
      saving.value = false;
    }
  }

  async function executeDashboard(
    id: string,
    body: Record<string, unknown> = {},
  ) {
    executing.value = true;
    try {
      const response = await apiClient.post(`/analytics/dashboards/${id}/execute`, body);
      if (response?.success) {
        executePayload.value = response.data;
      }
      return response;
    } finally {
      executing.value = false;
    }
  }

  async function archiveDashboard(id: string) {
    return apiClient.delete(`/analytics/dashboards/${id}`);
  }

  async function duplicateDashboard(id: string) {
    saving.value = true;
    try {
      const response = await apiClient.post(`/analytics/dashboards/${id}/duplicate`, {});
      if (response?.success) {
        dashboard.value = response.data;
      }
      return response;
    } finally {
      saving.value = false;
    }
  }

  async function fetchDefaultDashboard(appKey: string) {
    loading.value = true;
    try {
      const response = await apiClient.get('/analytics/dashboards/default', {
        params: { appKey },
        cache: 'no-store',
      });
      if (response?.success) {
        dashboard.value = response.data;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  function widgetPayloadByInstance(instanceId: string) {
    return executePayload.value?.widgets.find((w) => w.instanceId === instanceId) || null;
  }

  return {
    dashboards,
    dashboard,
    templates,
    executePayload,
    loading,
    saving,
    executing,
    listMeta,
    fetchTemplates,
    fetchDashboards,
    fetchDashboard,
    createDashboard,
    updateDashboard,
    publishDashboard,
    executeDashboard,
    archiveDashboard,
    duplicateDashboard,
    fetchDefaultDashboard,
    widgetPayloadByInstance,
  };
}

export type { AnalyticsDashboardLayoutItem };
