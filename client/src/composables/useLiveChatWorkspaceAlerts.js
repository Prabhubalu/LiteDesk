import { computed, ref } from 'vue';

const sessionsAlertCount = ref(0);

export function useLiveChatWorkspaceAlerts() {
  const hasSessionsAlert = computed(() => sessionsAlertCount.value > 0);

  function incrementSessionsAlert(count = 1) {
    sessionsAlertCount.value += Math.max(1, Number(count) || 1);
  }

  function clearSessionsAlert() {
    sessionsAlertCount.value = 0;
  }

  return {
    sessionsAlertCount,
    hasSessionsAlert,
    incrementSessionsAlert,
    clearSessionsAlert,
  };
}
