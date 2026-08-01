<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyActivityTitle') }}</h2>
        <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.tallyActivityDesc') }}</p>
      </div>
      <button
        type="button"
        class="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
        :disabled="loading"
        @click="load"
      >
        {{ loading ? t('states.loading') : t('actions.refresh') }}
      </button>
    </div>

    <p v-if="error" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{{ error }}</p>

    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <ul class="divide-y divide-gray-100 dark:divide-gray-700">
        <li v-if="!items.length" class="px-4 py-10 text-center text-sm text-gray-500 sm:px-6">
          {{ t('settings.tallyActivityEmpty') }}
        </li>
        <li
          v-for="item in items"
          :key="item._key"
          class="px-4 py-3 sm:px-6"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="text-sm font-medium text-gray-900 dark:text-white">
                <span class="mr-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold uppercase text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                  {{ item.source }}
                </span>
                {{ item.title }}
              </div>
              <div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ item.detail }}</div>
            </div>
            <div class="shrink-0 text-xs tabular-nums text-gray-500">{{ formatDateTime(item.at) }}</div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { formatUserDateTime } from '@/utils/localeFormat';

const { t } = useI18n();
const items = ref([]);
const loading = ref(false);
const error = ref('');

function formatDateTime(iso) {
  if (!iso) return '—';
  return formatUserDateTime(iso);
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [eventsRes, auditRes, jobsRes] = await Promise.all([
      apiClient('/connectors/tally/events?limit=40', { method: 'GET' }).catch(() => null),
      apiClient('/connectors/tally/atip/audit?limit=40', { method: 'GET' }).catch(() => null),
      apiClient('/connectors/tally/sync/jobs?limit=40', { method: 'GET' }).catch(() => null),
    ]);

    const events = eventsRes?.data || eventsRes || [];
    const eventRows = Array.isArray(events) ? events : events?.rows || [];
    const audit = auditRes?.data || auditRes || [];
    const auditRows = Array.isArray(audit) ? audit : audit?.rows || audit?.events || [];
    const jobs = jobsRes?.data || jobsRes || [];
    const jobRows = Array.isArray(jobs) ? jobs : jobs?.rows || [];

    const merged = [
      ...eventRows.map((e, i) => ({
        _key: `ev-${e._id || i}`,
        source: 'event',
        title: e.message || e.code || t('settings.tallyActivityJobDetail'),
        detail: [e.level, e.code].filter(Boolean).join(' · '),
        at: e.createdAt || e.timestamp,
      })),
      ...auditRows.map((e, i) => ({
        _key: `au-${e._id || e.id || i}`,
        source: 'audit',
        title: e.message || e.action || e.eventType || 'Audit',
        detail: [e.level, e.moduleKey, e.correlationId].filter(Boolean).join(' · '),
        at: e.createdAt || e.timestamp || e.at,
      })),
      ...jobRows.map((j, i) => ({
        _key: `job-${j._id || i}`,
        source: 'job',
        title: j.jobType || t('settings.tallyActivityJobDetail'),
        detail: [j.status, j.companyGuid].filter(Boolean).join(' · '),
        at: j.updatedAt || j.createdAt,
      })),
    ];

    merged.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
    items.value = merged.slice(0, 80);
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.tallyLoadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
defineExpose({ load });
</script>
