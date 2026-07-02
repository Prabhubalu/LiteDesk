import { ref } from 'vue';
import apiClient from '@/utils/apiClient';

export function useMarketingDashboard() {
  const dashboard = ref(null);
  const comparison = ref([]);
  const loading = ref(false);
  const comparing = ref(false);

  async function fetchDashboard(options = {}) {
    loading.value = true;
    try {
      const response = await apiClient.get('/marketing/dashboard', {
        params: { days: options.days || 30 },
        cache: 'no-store'
      });

      if (response?.success) {
        dashboard.value = response.data;
      } else {
        dashboard.value = null;
      }

      return response;
    } finally {
      loading.value = false;
    }
  }

  async function compareCampaigns(ids = []) {
    comparing.value = true;
    try {
      const response = await apiClient.get('/marketing/dashboard/compare', {
        params: { ids: ids.join(',') },
        cache: 'no-store'
      });

      if (response?.success) {
        comparison.value = Array.isArray(response.data) ? response.data : [];
      } else {
        comparison.value = [];
      }

      return response;
    } finally {
      comparing.value = false;
    }
  }

  return {
    dashboard,
    comparison,
    loading,
    comparing,
    fetchDashboard,
    compareCampaigns
  };
}
