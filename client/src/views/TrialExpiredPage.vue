<template>
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <div class="mx-auto flex min-h-screen max-w-lg items-center px-6 py-16">
      <div class="w-full">
        <div class="text-center">
          <img
            :src="brandLogoSrc"
            alt="Arivu"
            class="mx-auto h-10 w-auto"
          />
          <h1 class="mt-6 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {{ t('auth.trialExpiredTitle') }}
          </h1>
          <p class="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {{ t('auth.trialExpiredBody') }}
          </p>
          <p
            v-if="trialEndDateLabel"
            class="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {{ t('auth.trialExpiredEndedOn', { date: trialEndDateLabel }) }}
          </p>
        </div>

        <div class="mt-8 space-y-4">
          <button
            type="button"
            class="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            @click="goToSubscribe"
          >
            {{ t('auth.trialExpiredSubscribe') }}
          </button>

          <div
            v-if="canExtend"
            class="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800/50"
          >
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">
              {{ t('auth.trialExpiredExtendTitle') }}
            </h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {{ t('auth.trialExpiredExtendHint', { days: extensionDays }) }}
            </p>

            <form class="mt-4 space-y-4" @submit.prevent="handleExtendTrial">
              <div>
                <label
                  for="extension-reason"
                  class="block text-sm font-medium text-gray-900 dark:text-white"
                >
                  {{ t('auth.trialExpiredReasonLabel') }}
                </label>
                <textarea
                  id="extension-reason"
                  v-model="extensionReason"
                  rows="4"
                  required
                  :placeholder="t('auth.trialExpiredReasonPlaceholder')"
                  class="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                :disabled="extending || !extensionReason.trim()"
                class="flex w-full items-center justify-center rounded-lg border border-indigo-600 px-4 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
              >
                {{ extending ? t('auth.trialExpiredExtending') : t('auth.trialExpiredExtendAction') }}
              </button>

              <p
                v-if="extendError"
                class="text-sm text-red-600 dark:text-red-400"
              >
                {{ extendError }}
              </p>
            </form>
          </div>

          <div
            v-else-if="extensionUsed"
            class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100"
          >
            {{ t('auth.trialExpiredExtensionUsed') }}
          </div>

          <div
            v-else
            class="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-300"
          >
            {{ t('auth.trialExpiredContactAdmin') }}
          </div>
        </div>

        <div class="mt-8 text-center">
          <button
            type="button"
            class="text-sm font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            @click="handleLogout"
          >
            {{ t('auth.trialExpiredSignOut') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useColorMode } from '@/composables/useColorMode';
import { useAuthStore } from '@/stores/authRegistry';
import { getApiUrlForFetch } from '@/config/apiBase';
import {
  hasUsedTrialExtension,
  isOrganizationTrialExpired
} from '@/utils/trialStatus';

const { t, locale } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { colorMode } = useColorMode();

const extensionReason = ref('');
const extending = ref(false);
const extendError = ref('');
const extensionDays = ref(7);
const canExtendFromApi = ref(null);

const isDarkUi = computed(
  () =>
    colorMode.value === 'dark'
    || (colorMode.value === 'system'
      && typeof window !== 'undefined'
      && window.matchMedia('(prefers-color-scheme: dark)').matches),
);

const brandLogoSrc = computed(() =>
  isDarkUi.value ? '/assets/logo/Logo_word_light.svg' : '/assets/logo/Logo_word_dark.svg',
);

const extensionUsed = computed(() => hasUsedTrialExtension(authStore.organization));

const canManageBilling = computed(() => {
  if (authStore.isOwner) return true;
  const role = String(authStore.user?.role || '').toLowerCase();
  if (role === 'admin' || role === 'owner') return true;
  return Boolean(authStore.user?.permissions?.settings?.manageBilling);
});

const canExtend = computed(() =>
  canManageBilling.value && !extensionUsed.value && canExtendFromApi.value !== false,
);

const trialEndDateLabel = computed(() => {
  const endDate = authStore.organization?.subscription?.trialEndDate;
  if (!endDate) return '';
  try {
    return new Intl.DateTimeFormat(locale.value, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(new Date(endDate));
  } catch (_error) {
    return new Date(endDate).toLocaleDateString();
  }
});

const goToSubscribe = () => {
  router.push({ path: '/settings', query: { tab: 'subscriptions' } });
};

const handleLogout = () => {
  authStore.logout();
};

const refreshTrialStatus = async () => {
  if (!authStore.user?.token) return;

  try {
    const response = await fetch(getApiUrlForFetch('/api/settings/subscriptions/trial-status'), {
      headers: {
        Authorization: `Bearer ${authStore.user.token}`,
        Accept: 'application/json'
      }
    });
    const data = await response.json();
    if (!response.ok || !data.success) return;

    extensionDays.value = Number(data.data?.extensionDays) || 7;
    canExtendFromApi.value = data.data?.canExtend === true;

    if (authStore.organization) {
      authStore.organization = {
        ...authStore.organization,
        subscription: {
          ...authStore.organization.subscription,
          trialExtensionUsed: data.data?.extensionUsed === true,
          trialEndDate: data.data?.trialEndDate || authStore.organization.subscription?.trialEndDate
        }
      };
      localStorage.setItem('organization', JSON.stringify(authStore.organization));
    }
  } catch (_error) {
    canExtendFromApi.value = canManageBilling.value;
  }
};

const handleExtendTrial = async () => {
  extendError.value = '';
  extending.value = true;

  try {
    const response = await fetch(getApiUrlForFetch('/api/settings/subscriptions/extend-trial'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.user?.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ reason: extensionReason.value.trim() })
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      extendError.value = data.message || t('auth.trialExpiredExtendFailed');
      return;
    }

    if (authStore.organization && data.data?.subscription) {
      authStore.organization = {
        ...authStore.organization,
        subscription: {
          ...authStore.organization.subscription,
          ...data.data.subscription
        }
      };
      localStorage.setItem('organization', JSON.stringify(authStore.organization));
    }

    await router.replace('/platform/home');
  } catch (_error) {
    extendError.value = t('auth.trialExpiredExtendFailed');
  } finally {
    extending.value = false;
  }
};

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    await router.replace({ name: 'login' });
    return;
  }

  if (!isOrganizationTrialExpired(authStore.organization)) {
    await router.replace('/platform/home');
    return;
  }

  await refreshTrialStatus();
});
</script>
