/**
 * Fetch consolidated per-question response summary for engagement forms.
 */
import { ref } from 'vue';
import apiClient from '@/utils/apiClient';

export function useFormResponseSummary() {
  const summary = ref(null);
  const loading = ref(false);
  const error = ref(null);

  async function fetchSummary(formId, options = {}) {
    if (!formId) {
      summary.value = null;
      return null;
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await apiClient.get(`/forms/${formId}/response-summary`, {
        params: {
          textPreviewLimit: options.textPreviewLimit ?? 5
        }
      });

      if (response?.success) {
        summary.value = response.data || null;
        return summary.value;
      }

      summary.value = null;
      return null;
    } catch (err) {
      console.error('Error fetching form response summary:', err);
      error.value = err;
      summary.value = null;
      return null;
    } finally {
      loading.value = false;
    }
  }

  function reset() {
    summary.value = null;
    loading.value = false;
    error.value = null;
  }

  return {
    summary,
    loading,
    error,
    fetchSummary,
    reset
  };
}
