import { ref } from 'vue';
import apiClient from '@/utils/apiClient';
import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';

export function useMarketingReports() {
  const summary = ref(null);
  const loading = ref(false);
  const exporting = ref(false);

  async function fetchReportsSummary(options = {}) {
    loading.value = true;
    try {
      const response = await apiClient.get('/marketing/reports', {
        params: {
          days: options.days || 30,
          from: options.from || undefined,
          to: options.to || undefined
        },
        cache: 'no-store'
      });

      if (response?.success) {
        summary.value = response.data;
      } else {
        summary.value = null;
      }

      return response;
    } finally {
      loading.value = false;
    }
  }

  async function downloadCampaignExport(format, options = {}) {
    exporting.value = true;
    try {
      const authStore = useAuthStore();
      const params = new URLSearchParams();
      if (options.days) params.set('days', String(options.days));
      if (options.from) params.set('from', options.from);
      if (options.to) params.set('to', options.to);

      const suffix = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv';
      const url = `${getApiUrlForFetch()}/marketing/reports/campaigns/export.${suffix}?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `marketing-campaigns.${suffix}`;

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } finally {
      exporting.value = false;
    }
  }

  return {
    summary,
    loading,
    exporting,
    fetchReportsSummary,
    downloadCampaignExport
  };
}
