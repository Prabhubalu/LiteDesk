import { ref } from 'vue';
import apiClient from '@/utils/apiClient';
import type {
  AnalyticsExecuteResult,
  AnalyticsWidgetRecord,
  AnalyticsChartType,
} from '@/types/analytics.types';

export interface AnalyticsWidgetTemplate {
  templateKey: string;
  name: string;
  description: string;
  chartType: AnalyticsChartType;
  category: string;
  columnMapping: Record<string, unknown>;
  kpiValueField?: string;
  kpiLabel?: string;
  reportPreset: Record<string, unknown>;
}

export interface AnalyticsWidgetExecutePayload {
  widgetId: string;
  chartType: AnalyticsChartType;
  columnMapping: AnalyticsWidgetRecord['columnMapping'];
  thresholds?: AnalyticsWidgetRecord['thresholds'];
  kpiValueField?: string | null;
  kpiLabel?: string | null;
  kpiPrefix?: string | null;
  kpiSuffix?: string | null;
  result: AnalyticsExecuteResult;
}

export interface AnalyticsWidgetListMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export function useAnalyticsWidgets() {
  const widgets = ref<AnalyticsWidgetRecord[]>([]);
  const widget = ref<AnalyticsWidgetRecord | null>(null);
  const templates = ref<AnalyticsWidgetTemplate[]>([]);
  const executePayload = ref<AnalyticsWidgetExecutePayload | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const executing = ref(false);
  const listMeta = ref<AnalyticsWidgetListMeta | null>(null);

  async function fetchTemplates() {
    const response = await apiClient.get('/analytics/catalog/widget-templates', { cache: 'no-store' });
    if (response?.success) {
      templates.value = response.data ?? [];
    }
    return response;
  }

  async function fetchWidgets(params: Record<string, string | number | boolean | undefined> = {}) {
    loading.value = true;
    try {
      const response = await apiClient.get('/analytics/widgets', { params, cache: 'no-store' });
      if (response?.success) {
        widgets.value = response.data ?? [];
        listMeta.value = response.meta ?? null;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function fetchWidget(id: string) {
    loading.value = true;
    try {
      const response = await apiClient.get(`/analytics/widgets/${id}`, { cache: 'no-store' });
      if (response?.success) {
        widget.value = response.data;
      }
      return response;
    } finally {
      loading.value = false;
    }
  }

  async function createWidget(payload: Partial<AnalyticsWidgetRecord>) {
    saving.value = true;
    try {
      const response = await apiClient.post('/analytics/widgets', payload);
      if (response?.success) {
        widget.value = response.data;
      }
      return response;
    } finally {
      saving.value = false;
    }
  }

  async function updateWidget(id: string, payload: Partial<AnalyticsWidgetRecord>) {
    saving.value = true;
    try {
      const response = await apiClient.put(`/analytics/widgets/${id}`, payload);
      if (response?.success) {
        widget.value = response.data;
      }
      return response;
    } finally {
      saving.value = false;
    }
  }

  async function publishWidget(id: string) {
    saving.value = true;
    try {
      return await apiClient.post(`/analytics/widgets/${id}/publish`, {});
    } finally {
      saving.value = false;
    }
  }

  async function executeWidget(id: string, body: Record<string, unknown> = {}) {
    executing.value = true;
    try {
      const response = await apiClient.post(`/analytics/widgets/${id}/execute`, body);
      if (response?.success) {
        executePayload.value = response.data;
      }
      return response;
    } finally {
      executing.value = false;
    }
  }

  async function archiveWidget(id: string) {
    return apiClient.delete(`/analytics/widgets/${id}`);
  }

  async function duplicateWidget(id: string) {
    saving.value = true;
    try {
      const response = await apiClient.post(`/analytics/widgets/${id}/duplicate`, {});
      if (response?.success) {
        widget.value = response.data;
      }
      return response;
    } finally {
      saving.value = false;
    }
  }

  return {
    widgets,
    widget,
    templates,
    executePayload,
    loading,
    saving,
    executing,
    listMeta,
    fetchTemplates,
    fetchWidgets,
    fetchWidget,
    createWidget,
    updateWidget,
    publishWidget,
    executeWidget,
    archiveWidget,
    duplicateWidget,
  };
}
