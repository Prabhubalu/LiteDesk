<template>
  <div
    v-if="visible"
    class="border-b border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/30"
  >
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 sm:px-6 lg:px-8">
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <svg
          class="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p class="min-w-0 text-xs leading-snug text-amber-900 dark:text-amber-100 sm:text-sm">
          <span class="font-medium">{{ t('auth.emailVerificationBannerTitle') }}</span>
          <span class="text-amber-800 dark:text-amber-200">
            <span class="hidden sm:inline"> — </span>
            <span class="block sm:inline">{{ t('auth.emailVerificationBannerBody', { email: userEmail }) }}</span>
          </span>
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          class="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 sm:text-sm"
          :disabled="resending"
          @click="resendVerification"
        >
          {{ resending ? t('auth.emailVerificationResending') : t('auth.emailVerificationResend') }}
        </button>
        <button
          type="button"
          class="rounded-md px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/50 sm:text-sm"
          @click="snoozeBanner"
        >
          {{ t('auth.emailVerificationDismiss') }}
        </button>
      </div>
    </div>
    <p
      v-if="feedback"
      class="border-t border-amber-200/70 px-4 py-1 text-center text-xs text-amber-800 dark:border-amber-800/70 dark:text-amber-200 sm:px-6 lg:px-8"
    >
      {{ feedback }}
    </p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';

const DISMISS_KEY = 'arivu:email-verification-banner-dismissed-until';
const DISMISS_MS = 24 * 60 * 60 * 1000;

const { t } = useI18n();
const authStore = useAuthStore();
const resending = ref(false);
const feedback = ref('');

const userEmail = computed(() => authStore.user?.email || '');

const dismissedUntil = ref(0);

const readDismissedUntil = () => {
  try {
    return Number(localStorage.getItem(DISMISS_KEY) || 0);
  } catch (_error) {
    return 0;
  }
};

dismissedUntil.value = readDismissedUntil();

const visible = computed(() => {
  if (!authStore.isAuthenticated) return false;
  if (authStore.user?.emailVerifiedAt) return false;
  return dismissedUntil.value <= Date.now();
});

const snoozeBanner = () => {
  const until = Date.now() + DISMISS_MS;
  try {
    localStorage.setItem(DISMISS_KEY, String(until));
  } catch (_error) {
    /* optional */
  }
  dismissedUntil.value = until;
};

const resendVerification = async () => {
  resending.value = true;
  feedback.value = '';
  try {
    const response = await apiClient.post('/users/profile/resend-verification');
    if (response.success) {
      if (response.data?.alreadyVerified) {
        authStore.markEmailVerified();
        feedback.value = t('auth.emailVerificationAlreadyVerified');
      } else if (response.data?.sent) {
        feedback.value = t('auth.emailVerificationResent');
      } else {
        feedback.value = t('auth.emailVerificationResendFailed');
      }
    } else {
      feedback.value = response.message || t('auth.emailVerificationResendFailed');
    }
  } catch (error) {
    feedback.value = error.message || t('auth.emailVerificationResendFailed');
  } finally {
    resending.value = false;
  }
};
</script>
