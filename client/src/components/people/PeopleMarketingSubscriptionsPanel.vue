<template>
  <div>
  <section
    v-if="visible"
    class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
  >
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('marketing.personSubscriptionsTitle') }}
        </h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('marketing.personSubscriptionsDescription') }}
        </p>
      </div>
      <button
        type="button"
        class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
        :disabled="loading"
        @click="loadHistory"
      >
        {{ t('actions.refresh') }}
      </button>
    </div>

    <div v-if="loading" class="py-6 text-center text-sm text-gray-500">
      {{ t('states.loading') }}
    </div>

    <p v-else-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>

    <div v-else-if="!preference" class="py-4 text-sm text-gray-500 dark:text-gray-400">
      {{ t('marketing.personSubscriptionsEmpty') }}
    </div>

    <template v-else>
      <div class="mb-4 grid gap-3 sm:grid-cols-3">
        <div class="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('marketing.personSubscriptionsEmail') }}</p>
          <p class="mt-1 text-sm font-medium text-gray-900 dark:text-white">{{ preference.email }}</p>
        </div>
        <div class="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('marketing.personSubscriptionsStatus') }}</p>
          <p class="mt-1 text-sm font-medium text-gray-900 dark:text-white">
            {{ statusLabel }}
          </p>
        </div>
        <div class="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('marketing.personSubscriptionsUpdated') }}</p>
          <p class="mt-1 text-sm font-medium text-gray-900 dark:text-white">{{ formatDate(preference.updatedAt) }}</p>
        </div>
      </div>

      <div v-if="history.length > 0">
        <h4 class="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('marketing.personSubscriptionsHistoryTitle') }}
        </h4>
        <ul class="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          <li
            v-for="entry in history"
            :key="entry._id"
            class="px-4 py-3 text-sm"
          >
            <p class="font-medium text-gray-900 dark:text-white">
              {{ historyLabel(entry) }}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ formatDate(entry.recordedAt) }} · {{ entry.source }}
            </p>
          </li>
        </ul>
      </div>
    </template>
  </section>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  peopleId: { type: String, required: true }
});

const { t } = useI18n();
const authStore = useAuthStore();

const loading = ref(false);
const error = ref('');
const preference = ref(null);
const history = ref([]);

const marketingAppEnabled = computed(() => {
  const enabledApps = authStore.organization?.enabledApps;
  if (!Array.isArray(enabledApps)) return false;
  return enabledApps.some((app) => {
    const key = (typeof app === 'string' ? app : app?.appKey || '').toUpperCase();
    const active = typeof app === 'object' ? app.status === 'ACTIVE' : true;
    return key === 'MARKETING' && active;
  });
});

const visible = computed(() =>
  Boolean(props.peopleId) &&
  marketingAppEnabled.value &&
  (authStore.can('audiences', 'view') || authStore.can('campaigns', 'view'))
);

const statusLabel = computed(() =>
  preference.value?.globalStatus === 'unsubscribed'
    ? t('marketing.personSubscriptionsStatusUnsubscribed')
    : t('marketing.personSubscriptionsStatusSubscribed')
);

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function historyLabel(entry) {
  const category = entry.category || 'marketing';
  if (entry.action === 'unsubscribe') {
    return t('marketing.personSubscriptionsHistoryUnsubscribed', { category });
  }
  if (entry.action === 'subscribe') {
    return t('marketing.personSubscriptionsHistorySubscribed', { category });
  }
  return t('marketing.personSubscriptionsHistoryUpdated', { category });
}

async function loadHistory() {
  if (!visible.value || !props.peopleId) return;
  loading.value = true;
  error.value = '';
  try {
    const response = await apiClient.get(`/marketing/subscriptions/person/${props.peopleId}`, {
      cache: 'no-store'
    });
    if (!response?.success) {
      throw new Error(response?.message || t('marketing.personSubscriptionsLoadError'));
    }
    preference.value = response.data?.preference || null;
    history.value = Array.isArray(response.data?.history) ? response.data.history : [];
  } catch (err) {
    error.value = err?.message || t('marketing.personSubscriptionsLoadError');
    preference.value = null;
    history.value = [];
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.peopleId,
  () => {
    if (visible.value) loadHistory();
  },
  { immediate: true }
);
</script>
