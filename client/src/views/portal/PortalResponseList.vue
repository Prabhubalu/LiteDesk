<template>
  <PortalPageShell
    :title="t('records.portalResponsesTitle')"
    :subtitle="t('records.portalResponsesHint')"
    :error="error"
  >
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-24" :class="PLATFORM_HOME_SKELETON_CLASS" />
    </div>
    <div
      v-else-if="!responses.length"
      :class="['p-10 text-center sm:p-12', PLATFORM_HOME_CARD_CLASS]"
    >
      <h3 class="text-lg font-medium text-neutral-900 dark:text-white">{{ t('records.portalResponsesEmpty') }}</h3>
    </div>

    <div v-else class="space-y-3">
      <router-link
        v-for="response in responses"
        :key="response._id"
        :to="{ name: 'portal-response-detail', params: { id: response._id } }"
        class="block rounded-2xl p-4 transition-colors hover:border-primary-200 dark:hover:border-primary-500/30"
        :class="PLATFORM_HOME_CARD_CLASS"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-base font-semibold text-neutral-900 dark:text-white">
              {{ response.formName || response.responseId }}
            </p>
            <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {{ response.responseId }}
            </p>
          </div>
          <span class="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            {{ response.executionStatus }}
          </span>
        </div>
        <p class="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          {{ t('records.portalResponsesSubmittedAt', { date: formatDate(response.submittedAt) }) }}
        </p>
      </router-link>
    </div>
  </PortalPageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import portalApiClient from '@/utils/portalApiClient';
import PortalPageShell from '@/components/portal/PortalPageShell.vue';
import { PLATFORM_HOME_CARD_CLASS, PLATFORM_HOME_SKELETON_CLASS } from '@/utils/platformHomeLayout';
import { formatUserDate } from '@/utils/localeFormat';

const { t } = useI18n();
const loading = ref(true);
const error = ref(null);
const responses = ref([]);

function formatDate(value) {
  if (!value) return '—';
  return formatUserDate(value) || '—';
}

async function loadResponses() {
  loading.value = true;
  error.value = null;
  try {
    const res = await portalApiClient.get('/responses');
    responses.value = Array.isArray(res?.data) ? res.data : [];
  } catch (err) {
    error.value = err.response?.data?.message || err.message || t('records.portalResponsesLoadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(loadResponses);
</script>
