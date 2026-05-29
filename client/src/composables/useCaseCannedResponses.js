import { ref } from 'vue';
import apiClient from '@/utils/apiClient';

export function useCaseCannedResponses() {
  const responses = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const loadedChannel = ref('');

  async function load(channel = 'email', { includeAll = true } = {}) {
    const ch = String(channel || 'email').toLowerCase();
    loading.value = true;
    error.value = null;
    try {
      const res = await apiClient.get('/helpdesk/cases/canned-responses', {
        params: {
          channel: ch,
          ...(includeAll ? { includeAll: 'true' } : {})
        }
      });
      const list = res?.data?.responses ?? res?.data ?? [];
      responses.value = Array.isArray(list) ? list : [];
      loadedChannel.value = includeAll ? `all-${ch}` : ch;
      return responses.value;
    } catch (err) {
      error.value = err?.message || 'Failed to load macros';
      responses.value = [];
      return [];
    } finally {
      loading.value = false;
    }
  }

  function invalidate() {
    loadedChannel.value = '';
    responses.value = [];
  }

  return {
    responses,
    loading,
    error,
    load,
    invalidate
  };
}
