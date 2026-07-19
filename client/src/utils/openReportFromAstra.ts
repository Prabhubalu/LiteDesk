import type { Router } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/auth';

export type AstraReportAction = {
  kind?: string;
  recordId?: string;
  fields?: Record<string, string | number | boolean>;
  label?: string;
};

function resolveReportId(action: AstraReportAction): string {
  const fromFields = action?.fields?.reportId;
  return String(action?.recordId || fromFields || '').trim();
}

const BUILDER_STEP_QUERY: Record<string, string> = {
  module: '0',
  fields: '1',
  filters: '2',
  group: '3',
  preview: '4',
  save: '5',
};

/** Navigate to Report Builder edit for an Astra-created draft. */
export async function openReportBuilderFromAstraAction(
  router: Router,
  action: AstraReportAction,
): Promise<{ ok: boolean; error?: string }> {
  const reportId = resolveReportId(action);
  if (!reportId) {
    return { ok: false, error: 'Missing report id' };
  }
  const stepRaw = String(action?.fields?.step || 'fields').trim().toLowerCase();
  const step = BUILDER_STEP_QUERY[stepRaw] || (/^\d+$/.test(stepRaw) ? stepRaw : '1');
  try {
    await router.push({
      name: 'analytics-report-edit',
      params: { id: reportId },
      query: { step },
    });
    return { ok: true };
  } catch (err: unknown) {
    const e = err as { message?: string };
    return { ok: false, error: e?.message || 'Could not open Report Builder' };
  }
}

/** Navigate to report detail. */
export async function openReportFromAstraAction(
  router: Router,
  action: AstraReportAction,
): Promise<{ ok: boolean; error?: string }> {
  const reportId = resolveReportId(action);
  if (!reportId) {
    return { ok: false, error: 'Missing report id' };
  }
  try {
    await router.push({
      name: 'analytics-report-detail',
      params: { id: reportId },
    });
    return { ok: true };
  } catch (err: unknown) {
    const e = err as { message?: string };
    return { ok: false, error: e?.message || 'Could not open report' };
  }
}

/** Publish draft via Reports API, then open detail. */
export async function publishReportFromAstraAction(
  router: Router,
  action: AstraReportAction,
): Promise<{ ok: boolean; error?: string }> {
  const reportId = resolveReportId(action);
  if (!reportId) {
    return { ok: false, error: 'Missing report id' };
  }
  try {
    await apiClient.post(`/analytics/reports/${reportId}/publish`, {}, {
      skipAuthLogout: true,
    });
    await router.push({
      name: 'analytics-report-detail',
      params: { id: reportId },
    });
    return { ok: true };
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } }; message?: string };
    return {
      ok: false,
      error: e?.response?.data?.message || e?.message || 'Could not publish report',
    };
  }
}

/** Export report (publishes draft first if needed). */
export async function exportReportFromAstraAction(
  action: AstraReportAction,
): Promise<{ ok: boolean; error?: string }> {
  const reportId = resolveReportId(action);
  if (!reportId) {
    return { ok: false, error: 'Missing report id' };
  }
  const format = String(action?.fields?.format || 'csv').toLowerCase() || 'csv';
  try {
    try {
      await apiClient.post(`/analytics/reports/${reportId}/publish`, {}, {
        skipAuthLogout: true,
      });
    } catch {
      // already published
    }
    const authStore = useAuthStore();
    const token = authStore.user?.token;
    if (!token) {
      return { ok: false, error: 'Not authenticated' };
    }
    const url = getApiUrlForFetch(`/analytics/reports/${reportId}/export`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ format }),
    });
    if (!response.ok) {
      return { ok: false, error: 'Export failed' };
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] || `report-${reportId}.${format}`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    return { ok: true };
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } }; message?: string };
    return {
      ok: false,
      error: e?.response?.data?.message || e?.message || 'Could not export report',
    };
  }
}

/** Pin existing Astra report to a dashboard. */
export async function pinReportFromAstraAction(
  router: Router,
  action: AstraReportAction,
): Promise<{ ok: boolean; error?: string; dashboardName?: string }> {
  const reportId = resolveReportId(action);
  if (!reportId) {
    return { ok: false, error: 'Missing report id' };
  }
  try {
    const res = await apiClient.post('/analytics/dashboards/pin-astra-report', {
      reportId,
      chartType: String(action?.fields?.chartType || 'bar'),
    }, {
      skipAuthLogout: true,
    }) as { success?: boolean; data?: { dashboard?: { _id?: string; name?: string } }; message?: string };
    if (!res?.success) {
      return { ok: false, error: String(res?.message || 'Pin failed') };
    }
    const dashId = res.data?.dashboard?._id;
    const dashboardName = String(res.data?.dashboard?.name || '');
    if (dashId) {
      await router.push({
        name: 'analytics-dashboard-view',
        params: { id: String(dashId) },
      }).catch(() => {
        router.push(`/analytics/dashboards/${dashId}`).catch(() => {});
      });
    }
    return { ok: true, dashboardName };
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } }; message?: string };
    return {
      ok: false,
      error: e?.response?.data?.message || e?.message || 'Could not pin report',
    };
  }
}

export async function openWidgetFromAstraAction(
  router: Router,
  action: AstraReportAction,
): Promise<{ ok: boolean; error?: string }> {
  const widgetId = String(action?.recordId || action?.fields?.widgetId || '').trim();
  if (!widgetId) {
    return { ok: false, error: 'Missing widget id' };
  }
  try {
    await router.push({
      name: 'analytics-widget-edit',
      params: { id: widgetId },
    });
    return { ok: true };
  } catch (err: unknown) {
    const e = err as { message?: string };
    return { ok: false, error: e?.message || 'Could not open widget' };
  }
}

export async function openDashboardFromAstraAction(
  router: Router,
  action: AstraReportAction,
): Promise<{ ok: boolean; error?: string }> {
  const dashboardId = String(
    action?.recordId || action?.fields?.dashboardId || ''
  ).trim();
  if (!dashboardId) {
    return { ok: false, error: 'Missing dashboard id' };
  }
  try {
    await router.push({
      name: 'analytics-dashboard-view',
      params: { id: dashboardId },
    }).catch(async () => {
      await router.push(`/analytics/dashboards/${dashboardId}`);
    });
    return { ok: true };
  } catch (err: unknown) {
    const e = err as { message?: string };
    return { ok: false, error: e?.message || 'Could not open dashboard' };
  }
}
