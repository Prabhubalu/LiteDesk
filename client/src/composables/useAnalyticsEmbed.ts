import { ref } from 'vue';
import apiClient from '@/utils/apiClient';
import { getApiUrlForFetch } from '@/config/apiBase';
import type { AnalyticsDashboardLayoutItem, AnalyticsDashboardRecord } from '@/types/analytics.types';

import type { AnalyticsDashboardWidgetPayload } from '@/composables/useAnalyticsDashboards';

export interface AnalyticsEmbedExecutePayload {
  dashboard: Partial<AnalyticsDashboardRecord> & { layout: AnalyticsDashboardLayoutItem[] };
  widgets: AnalyticsDashboardWidgetPayload[];
}

export function useAnalyticsEmbed() {
  const dashboard = ref<Partial<AnalyticsDashboardRecord> | null>(null);
  const executePayload = ref<AnalyticsEmbedExecutePayload | null>(null);
  const loading = ref(false);
  const executing = ref(false);
  const embedToken = ref<string | null>(null);

  function setToken(token: string) {
    embedToken.value = token;
  }

  async function fetchEmbedDashboard(token: string) {
    loading.value = true;
    embedToken.value = token;
    try {
      const url = getApiUrlForFetch(`/analytics/embed/dashboard?token=${encodeURIComponent(token)}`);
      const response = await fetch(url, { cache: 'no-store' });
      const json = await response.json();
      if (json?.success) {
        dashboard.value = json.data;
      }
      return json;
    } finally {
      loading.value = false;
    }
  }

  async function executeEmbedDashboard(token: string, body: Record<string, unknown> = {}) {
    executing.value = true;
    embedToken.value = token;
    try {
      const url = getApiUrlForFetch('/analytics/embed/dashboard/execute');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, token }),
      });
      const json = await response.json();
      if (json?.success) {
        executePayload.value = json.data;
        dashboard.value = json.data.dashboard;
      }
      return json;
    } finally {
      executing.value = false;
    }
  }

  async function createEmbedToken(dashboardId: string, name: string) {
    return apiClient.post(`/analytics/dashboards/${dashboardId}/embed-tokens`, { name });
  }

  function widgetPayloadByInstance(instanceId: string): AnalyticsDashboardWidgetPayload | null {
    return executePayload.value?.widgets.find((w) => w.instanceId === instanceId) || null;
  }

  return {
    dashboard,
    executePayload,
    loading,
    executing,
    embedToken,
    setToken,
    fetchEmbedDashboard,
    executeEmbedDashboard,
    createEmbedToken,
    widgetPayloadByInstance,
  };
}
