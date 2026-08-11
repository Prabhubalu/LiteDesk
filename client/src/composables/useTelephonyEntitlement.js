import { computed } from 'vue';
import { useAuthStore } from '@/stores/authRegistry';

/**
 * Client-side gate for Telephony addon (addon key `telephony`).
 * Mirrors entitledAddons.telephony from login/profile.
 *
 * @param {{ entitledAddons?: { telephony?: boolean } | null } | null | undefined} user
 * @returns {boolean}
 */
export function isTelephonyEntitled(user) {
  if (user?.entitledAddons && typeof user.entitledAddons === 'object') {
    return user.entitledAddons.telephony === true;
  }
  return false;
}

export function useTelephonyEntitlement() {
  const authStore = useAuthStore();
  const entitled = computed(() => isTelephonyEntitled(authStore.user));
  return { entitled, isTelephonyEntitled };
}
