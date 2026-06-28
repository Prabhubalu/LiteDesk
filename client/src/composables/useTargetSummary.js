import { ref, watch } from 'vue';
import apiClient from '@/utils/apiClient';

export function useTargetSummary(options = {}) {
  const summary = ref([]);
  const loading = ref(false);
  const error = ref(null);

  async function fetchSummary() {
    loading.value = true;
    error.value = null;
    try {
      const params = {};
      if (options.assignedTo?.value) params.assignedTo = options.assignedTo.value;
      if (options.appKey?.value) params.appKey = options.appKey.value;
      if (options.moduleKey?.value) params.moduleKey = options.moduleKey.value;
      const res = await apiClient.get('/targets/summary', { params });
      summary.value = res?.data || [];
    } catch (e) {
      error.value = e?.message || 'Failed to load targets';
      summary.value = [];
    } finally {
      loading.value = false;
    }
  }

  if (options.immediate !== false) {
    watch(
      () => [options.assignedTo?.value, options.appKey?.value, options.moduleKey?.value],
      () => fetchSummary(),
      { immediate: true }
    );
  }

  return { summary, loading, error, fetchSummary };
}
