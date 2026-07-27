<template>
  <div class="space-y-4">
    <div class="flex justify-end">
      <button
        type="button"
        class="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
        :disabled="loading"
        @click="load"
      >
        {{ loading ? t('states.loading') : t('actions.refresh') }}
      </button>
    </div>

    <p v-if="error" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
      {{ error }}
    </p>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div class="text-xs font-semibold uppercase tracking-wider text-gray-500">{{ t('settings.tallyHealthOk') }}</div>
        <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{{ dash?.healthState || '—' }}</div>
        <div class="mt-1 text-xs text-gray-500">{{ t('settings.tallyHealthConnection') }}: {{ dash?.connectionStatus || '—' }}</div>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div class="text-xs font-semibold uppercase tracking-wider text-gray-500">{{ t('settings.tallyQueue') }}</div>
        <div class="mt-1 text-sm text-gray-800 dark:text-gray-200">
          Pending {{ q.pending ?? 0 }} · Active {{ q.active ?? 0 }}
        </div>
        <div class="mt-1 text-sm text-gray-800 dark:text-gray-200">
          {{ t('settings.tallyFailed') }} {{ q.failed ?? 0 }} · Retry {{ q.retryQueue ?? 0 }}
        </div>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div class="text-xs font-semibold uppercase tracking-wider text-gray-500">{{ t('settings.tallyConflicts') }}</div>
        <div class="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{{ dash?.conflicts?.open ?? 0 }}</div>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div class="text-xs font-semibold uppercase tracking-wider text-gray-500">Sync timing</div>
        <div class="mt-1 text-sm text-gray-800 dark:text-gray-200">
          Avg {{ formatMs(dash?.averageSyncTimeMs) }}
        </div>
        <div class="mt-1 text-xs text-gray-500">
          Last {{ formatDateTime(dash?.lastSynchronisation) }}
        </div>
      </div>
    </div>

    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div class="border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyHealthCompanies') }}</h2>
      </div>
      <ul class="divide-y divide-gray-100 dark:divide-gray-700">
        <li v-if="!(dash?.connectedCompanies || []).length" class="px-4 py-8 text-center text-sm text-gray-500 sm:px-6">
          —
        </li>
        <li
          v-for="c in dash?.connectedCompanies || []"
          :key="c.companyGuid"
          class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm sm:px-6"
        >
          <div>
            <div class="font-medium text-gray-900 dark:text-white">{{ c.companyName || c.companyGuid }}</div>
            <div class="text-xs text-gray-500">{{ c.healthState || '—' }} · last {{ formatDateTime(c.lastSyncAt) }}</div>
          </div>
        </li>
      </ul>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyValidationTitle') }}</h2>
      <p class="mt-1 text-sm text-gray-500">{{ t('settings.tallyValidationDesc') }}</p>
      <ul class="mt-3 grid gap-2 sm:grid-cols-2">
        <li
          v-for="[key, val] in checklistEntries"
          :key="key"
          class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
        >
          <span :class="val ? 'text-emerald-600' : 'text-amber-600'">{{ val ? '✓' : '○' }}</span>
          {{ key }}
        </li>
        <li v-if="!checklistEntries.length" class="text-sm text-gray-500">—</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';

const { t } = useI18n();
const dash = ref(null);
const loading = ref(false);
const error = ref('');

const q = computed(() => dash.value?.queue || {});
const checklistEntries = computed(() => {
  const c = dash.value?.checklist;
  if (!c || typeof c !== 'object') return [];
  return Object.entries(c);
});

function formatMs(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient('/connectors/tally/atip/dashboard', { method: 'GET' });
    dash.value = res?.data || res || null;
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.tallyLoadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
defineExpose({ load });
</script>
