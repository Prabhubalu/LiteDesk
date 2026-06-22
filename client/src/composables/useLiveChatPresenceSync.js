import { onMounted, watch } from 'vue';
import { useUserStatus } from '@/composables/useUserStatus';
import apiClient from '@/utils/apiClient';

const USER_TO_PRESENCE = Object.freeze({
  active: 'online',
  busy: 'busy',
  away: 'away',
  offline: 'offline',
});

/**
 * Mirrors the profile availability picker (useUserStatus) into Live Chat agent
 * presence so routing and reports stay aligned with what the agent chose.
 */
export function useLiveChatPresenceSync(userIdRef, enabledRef) {
  const { state: statusState } = useUserStatus(userIdRef);

  async function syncPresence() {
    if (enabledRef && !enabledRef.value) return;
    const status = USER_TO_PRESENCE[statusState.value.type] || 'offline';
    try {
      await apiClient.put('/live-chat/presence/me', { status });
    } catch {
      // ignore — presence is best-effort
    }
  }

  watch(
    () => statusState.value.type,
    () => {
      syncPresence();
    },
  );

  onMounted(() => {
    syncPresence();
  });

  return { syncPresence };
}

export function mapUserStatusToPresence(statusType) {
  return USER_TO_PRESENCE[statusType] || 'offline';
}
