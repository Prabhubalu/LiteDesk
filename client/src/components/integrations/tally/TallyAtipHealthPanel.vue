<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyTabOverview') }}</h2>
        <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.tallyOverviewDesc') }}</p>
      </div>
      <button
        type="button"
        class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
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
        <div class="mt-1.5">
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold"
            :class="healthPillClass"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {{ healthLabel }}
          </span>
        </div>
        <div class="mt-2 text-xs text-gray-500">
          {{ t('settings.tallyHealthConnection') }}: {{ dash?.connectionStatus || '—' }}
        </div>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div class="text-xs font-semibold uppercase tracking-wider text-gray-500">{{ t('settings.tallyQueue') }}</div>
        <div class="mt-1 text-sm text-gray-800 dark:text-gray-200">
          {{ t('settings.tallyQueuePending') }} {{ q.pending ?? 0 }}
          · {{ t('settings.tallyQueueActive') }} {{ q.active ?? 0 }}
        </div>
        <div class="mt-1 text-sm text-gray-800 dark:text-gray-200">
          {{ t('settings.tallyFailed') }} {{ q.failed ?? 0 }}
          · {{ t('settings.tallyQueueRetry') }} {{ q.retryQueue ?? 0 }}
        </div>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div class="text-xs font-semibold uppercase tracking-wider text-gray-500">{{ t('settings.tallyConflicts') }}</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">{{ dash?.conflicts?.open ?? 0 }}</div>
        <div class="mt-1 text-xs text-gray-500">{{ t('settings.tallyConflictsOpenHint') }}</div>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div class="text-xs font-semibold uppercase tracking-wider text-gray-500">{{ t('settings.tallySyncTiming') }}</div>
        <div class="mt-1 text-sm text-gray-800 dark:text-gray-200">
          {{ t('settings.tallySyncAvg') }} {{ formatMs(dash?.averageSyncTimeMs) }}
        </div>
        <div class="mt-1 text-xs text-gray-500">
          {{ t('settings.tallySyncLast') }} {{ formatDateTime(dash?.lastSynchronisation) }}
        </div>
      </div>
    </div>

    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div class="border-b border-gray-200 px-4 py-3.5 sm:px-6 dark:border-gray-700">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyHealthCompanies') }}</h2>
      </div>
      <ul class="divide-y divide-gray-100 dark:divide-gray-700">
        <li v-if="!(dash?.connectedCompanies || []).length" class="px-4 py-8 text-center text-sm text-gray-500 sm:px-6">
          {{ t('settings.tallyCompaniesEmpty') }}
        </li>
        <li
          v-for="c in dash?.connectedCompanies || []"
          :key="c.companyGuid"
          class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm sm:px-6"
        >
          <div>
            <div class="font-medium text-gray-900 dark:text-white">{{ c.companyName || c.companyGuid }}</div>
            <div class="text-xs text-gray-500">
              {{ formatHealthState(c.healthState) }} · {{ t('settings.tallySyncLast') }} {{ formatDateTime(c.lastSyncAt) }}
            </div>
          </div>
        </li>
      </ul>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
      <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyValidationTitle') }}</h2>
      <p class="mt-1 text-sm text-gray-500">{{ t('settings.tallyValidationDesc') }}</p>
      <ul class="mt-3 grid gap-2 sm:grid-cols-2">
        <li
          v-for="item in checklistEntries"
          :key="item.key"
          class="flex items-start gap-2.5 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700/80"
        >
          <span
            class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
            :class="item.ok
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'"
          >
            {{ item.ok ? '✓' : '!' }}
          </span>
          <div class="min-w-0">
            <div class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ item.label }}</div>
            <div v-if="item.message" class="text-xs text-gray-500">{{ item.message }}</div>
          </div>
        </li>
        <li v-if="!checklistEntries.length" class="text-sm text-gray-500">{{ t('settings.tallyChecklistEmpty') }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';

const { t, te } = useI18n();
const dash = ref(null);
const loading = ref(false);
const error = ref('');

const CHECKLIST_KEYS = [
  'tallyRunning',
  'portListening',
  'versionSupported',
  'companyOpen',
  'tdlLoaded',
  'xmlPermissions',
  'licenseOk',
];

const HEALTH_I18N = {
  searching: 'settings.tallyHealthStateSearching',
  found: 'settings.tallyHealthStateFound',
  metadata_pending: 'settings.tallyHealthStateMetadata',
  ready: 'settings.tallyHealthStateReady',
  degraded: 'settings.tallyHealthStateDegraded',
  offline: 'settings.tallyHealthStateOffline',
};

const q = computed(() => dash.value?.queue || {});

const checklistEntries = computed(() => {
  const c = dash.value?.checklist;
  if (!c || typeof c !== 'object') return [];
  return CHECKLIST_KEYS.filter((k) => c[k] != null).map((key) => {
    const val = c[key];
    const ok = typeof val === 'object' ? Boolean(val?.ok) : Boolean(val);
    const labelKey = `settings.tallyCheck${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    return {
      key,
      ok,
      label: te(labelKey) ? t(labelKey) : key,
      message: typeof val === 'object' ? val?.message : null,
    };
  });
});

function formatHealthState(state) {
  const key = HEALTH_I18N[state];
  if (key && te(key)) return t(key);
  return state || '—';
}

const healthLabel = computed(() => formatHealthState(dash.value?.healthState));

const healthPillClass = computed(() => {
  const state = dash.value?.healthState;
  if (state === 'ready') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200';
  if (state === 'offline' || state === 'degraded') return 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
  return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200';
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
