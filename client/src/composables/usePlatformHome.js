import { ref } from 'vue';
import apiClient from '@/utils/apiClient';
import { summarizeAttentionItems } from '@/utils/attentionFormatters';

const emptySnapshot = () => ({
  attention: {
    items: [],
    total: 0,
    summary: { total: 0, overdue: 0, dueToday: 0 }
  },
  shell: {
    approvalsPending: 0,
    mail: { all: 0, unread: 0, assignedToMe: 0 }
  },
  resume: [],
  appPulses: [],
  greeting: null,
  focusLine: '',
  onboarding: null
});

/**
 * Platform home snapshot from GET /api/platform/home (Phase 2).
 */
export function usePlatformHome() {
  const loading = ref(true);
  const error = ref(null);
  const snapshot = ref(emptySnapshot());

  const fetchSnapshot = async () => {
    loading.value = true;
    error.value = null;

    try {
      const response = await apiClient('/platform/home', { method: 'GET' });

      if (response.success && response.data) {
        const data = response.data;
        snapshot.value = {
          attention: {
            items: data.attention?.items || [],
            total: data.attention?.total ?? 0,
            summary: data.attention?.summary || summarizeAttentionItems(data.attention?.items || [])
          },
          shell: {
            approvalsPending: data.shell?.approvalsPending ?? 0,
            mail: {
              all: data.shell?.mail?.all ?? 0,
              unread: data.shell?.mail?.unread ?? 0,
              assignedToMe: data.shell?.mail?.assignedToMe ?? 0
            }
          },
          resume: data.resume || [],
          appPulses: data.appPulses || [],
          greeting: data.greeting || null,
          focusLine: data.focusLine || '',
          onboarding: data.onboarding || null
        };
      } else {
        error.value = 'Unable to load home';
        snapshot.value = emptySnapshot();
      }
    } catch (err) {
      console.error('[PlatformHome] Error fetching snapshot:', err);
      error.value = 'Unable to load home';
      snapshot.value = emptySnapshot();
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    error,
    snapshot,
    fetchSnapshot
  };
}
