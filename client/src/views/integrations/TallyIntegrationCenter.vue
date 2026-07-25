<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-auto bg-gray-50 dark:bg-gray-900">
    <div class="border-b border-gray-200 bg-white px-6 py-5 dark:border-gray-700 dark:bg-gray-800">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.tallyCenterTitle') }}</h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.tallyCenterDesc') }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="goSettings"
          >
            {{ t('settings.tallyBackSettings') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            :disabled="refreshing"
            @click="refreshAll"
          >
            {{ refreshing ? t('states.loading') : t('actions.refresh') }}
          </button>
        </div>
      </div>
    </div>

    <div class="mx-auto w-full max-w-6xl space-y-6 px-6 py-6">
      <div v-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
        <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
      </div>

      <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="card in healthCards"
          :key="card.key"
          class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
        >
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ card.label }}</p>
          <p class="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{{ card.value }}</p>
          <p v-if="card.hint" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ card.hint }}</p>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('settings.tallyQueue') }}</p>
          <p class="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{{ counts.queued }}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('settings.tallyFailed') }}</p>
          <p class="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{{ counts.failed }}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('settings.tallyConflicts') }}</p>
          <p class="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{{ counts.conflicts }}</p>
        </div>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyActivityTitle') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.tallyActivityDesc') }}</p>
        <ul v-if="activity.length" class="mt-4 divide-y divide-gray-100 dark:divide-gray-700">
          <li v-for="row in activity" :key="row.id" class="flex flex-wrap items-start justify-between gap-2 py-3">
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ row.title }}</p>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ row.detail }}</p>
            </div>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ formatDateTime(row.at) }}</span>
          </li>
        </ul>
        <p v-else class="mt-4 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.tallyActivityEmpty') }}</p>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyMappingTitle') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.tallyMappingDesc') }}</p>
        <ul v-if="lowConfidenceMappings.length" class="mt-4 space-y-3">
          <li
            v-for="map in lowConfidenceMappings"
            :key="map.id"
            class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20"
          >
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ map.label }}</p>
              <p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                {{ t('settings.tallyMappingConfidence', { value: Math.round(map.confidence * 100) }) }}
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg border border-amber-300 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/40"
              @click="reviewMapping(map)"
            >
              {{ t('settings.tallyMappingReview') }}
            </button>
          </li>
        </ul>
        <p v-else class="mt-4 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.tallyMappingEmpty') }}</p>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyValidationTitle') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.tallyValidationDesc') }}</p>
        <ul class="mt-4 space-y-2">
          <li
            v-for="item in validationChecklist"
            :key="item.key"
            class="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700"
          >
            <span
              class="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white"
              :class="item.ok ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'"
            >
              {{ item.ok ? '✓' : '·' }}
            </span>
            <span class="text-sm text-gray-800 dark:text-gray-200">{{ item.label }}</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

const { t } = useI18n();
const router = useRouter();
const notifications = useNotifications();

const refreshing = ref(false);
const error = ref('');
const dashboard = ref(null);
const jobs = ref([]);
const conflicts = ref([]);

const counts = computed(() => ({
  queued: dashboard.value?.queuedJobs ?? jobs.value.filter((j) => ['queued', 'running'].includes(j.status)).length,
  failed: jobs.value.filter((j) => j.status === 'failed').length,
  conflicts: dashboard.value?.openConflicts ?? conflicts.value.length,
}));

const healthCards = computed(() => {
  const d = dashboard.value || {};
  return [
    {
      key: 'connection',
      label: t('settings.tallyHealthConnection'),
      value: d.connectionStatus || '—',
      hint: d.heartbeatAt ? formatDateTime(d.heartbeatAt) : t('settings.tallyHealthNoHeartbeat'),
    },
    {
      key: 'agent',
      label: t('settings.tallyHealthAgent'),
      value: d.agentVersion || '—',
      hint: d.health?.mode || null,
    },
    {
      key: 'companies',
      label: t('settings.tallyHealthCompanies'),
      value: d.companyCount ?? 0,
      hint: null,
    },
    {
      key: 'health',
      label: t('settings.tallyHealthOk'),
      value: d.health?.ok ? t('settings.tallyHealthOkValue') : t('settings.tallyHealthDegradedValue'),
      hint: d.health?.tallyVersion || null,
    },
  ];
});

const activity = computed(() => {
  if (!jobs.value.length) {
    return [
      {
        id: 'stub-ready',
        title: t('settings.tallyActivityStubReady'),
        detail: t('settings.tallyActivityStubReadyDetail'),
        at: new Date().toISOString(),
      },
    ];
  }
  return jobs.value.slice(0, 20).map((job) => ({
    id: String(job._id),
    title: `${job.jobType || 'sync'} · ${job.status}`,
    detail: job.lastError || job.companyGuid || t('settings.tallyActivityJobDetail'),
    at: job.updatedAt || job.createdAt,
  }));
});

const lowConfidenceMappings = computed(() => [
  {
    id: 'stub-map-1',
    label: t('settings.tallyMappingStubLabel'),
    confidence: 0.72,
  },
]);

const validationChecklist = computed(() => {
  const d = dashboard.value || {};
  const checks = d.health?.checks || {};
  return [
    { key: 'agent', label: t('settings.tallyCheckAgent'), ok: Boolean(d.connectionStatus && d.connectionStatus !== 'none') },
    { key: 'tally', label: t('settings.tallyCheckTally'), ok: Boolean(checks.tallyRunning ?? d.health?.ok) },
    { key: 'xml', label: t('settings.tallyCheckXml'), ok: Boolean(checks.xmlEnabled ?? false) },
    { key: 'company', label: t('settings.tallyCheckCompany'), ok: (d.companyCount || 0) > 0 },
    { key: 'fy', label: t('settings.tallyCheckFy'), ok: Boolean(checks.financialYear ?? false) },
  ];
});

function formatDateTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function goSettings() {
  router.push({ path: '/settings', query: { tab: 'addons', addonView: 'tally' } });
}

function reviewMapping(map) {
  notifications.info(t('settings.tallyMappingReviewSoon', { label: map.label }));
}

async function refreshAll() {
  refreshing.value = true;
  error.value = '';
  try {
    const [dashRes, jobsRes, conflictsRes] = await Promise.all([
      apiClient('/connectors/tally/dashboard', { method: 'GET' }).catch(() => null),
      apiClient('/connectors/tally/sync/jobs?limit=25', { method: 'GET' }).catch(() => null),
      apiClient('/connectors/tally/conflicts?status=open&limit=25', { method: 'GET' }).catch(() => null),
    ]);
    dashboard.value = dashRes?.data || {
      connectionStatus: 'none',
      queuedJobs: 0,
      openConflicts: 0,
      companyCount: 0,
      health: { ok: false, stub: true },
      stub: true,
    };
    jobs.value = Array.isArray(jobsRes?.data) ? jobsRes.data : [];
    conflicts.value = Array.isArray(conflictsRes?.data) ? conflictsRes.data : [];
  } catch (err) {
    error.value = err?.message || t('settings.tallyLoadFailed');
  } finally {
    refreshing.value = false;
  }
}

onMounted(refreshAll);
</script>
