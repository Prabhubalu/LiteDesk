<template>
  <div class="mx-auto w-full px-6 py-8">
    <div class="mb-6">
      <button type="button" class="mb-2 text-sm text-primary-600 hover:underline" @click="goSchedules">
        ← {{ t('analytics.schedulesTitle') }}
      </button>
      <h1 class="text-2xl font-semibold text-neutral-900 dark:text-white">
        {{ t('analytics.snapshotsTitle') }}
      </h1>
      <p class="mt-1 text-sm text-neutral-500">{{ t('analytics.snapshotsDescription') }}</p>
    </div>

    <div v-if="loading && !snapshot" class="py-16 text-center text-sm text-neutral-500">
      {{ t('states.loading') }}
    </div>

    <template v-else-if="snapshotId && snapshot">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="grid flex-1 gap-3 sm:grid-cols-4">
        <div class="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
          <p class="text-xs text-neutral-500">{{ t('analytics.colStatus') }}</p>
          <p class="mt-1 text-sm font-medium capitalize">{{ snapshot.status }}</p>
        </div>
        <div class="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
          <p class="text-xs text-neutral-500">{{ t('analytics.snapshotsCapturedAt') }}</p>
          <p class="mt-1 text-sm font-medium">{{ formatDate(snapshot.capturedAt) }}</p>
        </div>
        <div class="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
          <p class="text-xs text-neutral-500">{{ t('analytics.snapshotsRowCount') }}</p>
          <p class="mt-1 text-sm font-medium">{{ snapshot.rowCount ?? '—' }}</p>
        </div>
        <div class="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
          <p class="text-xs text-neutral-500">{{ t('analytics.snapshotsEmailSent') }}</p>
          <p class="mt-1 text-sm font-medium">{{ snapshot.emailSent ? t('analytics.snapshotsEmailYes') : t('analytics.snapshotsEmailNo') }}</p>
        </div>
        </div>
        <button
          v-if="snapshot.status === 'success' && snapshot.result"
          type="button"
          class="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-600"
          @click="exportSnapshotCsv"
        >
          {{ t('analytics.exportCsv') }}
        </button>
      </div>

      <p v-if="snapshot.error" class="mb-4 text-sm text-red-600">{{ snapshot.error }}</p>

      <section class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
        <ReportPreviewPanel
          :result="snapshot.result || null"
          :empty-message="t('analytics.previewEmpty')"
        />
      </section>
    </template>

    <template v-else>
      <div
        v-if="snapshots.length === 0"
        class="rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center dark:border-neutral-600"
      >
        <p class="text-sm text-neutral-500">{{ t('analytics.snapshotsEmpty') }}</p>
      </div>

      <div v-else class="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700">
        <table class="min-w-full divide-y divide-neutral-200 text-sm dark:divide-neutral-700">
          <thead class="bg-neutral-50 dark:bg-neutral-800/60">
            <tr>
              <th class="px-4 py-3 text-left font-medium">{{ t('analytics.snapshotsCapturedAt') }}</th>
              <th class="px-4 py-3 text-left font-medium">{{ t('analytics.colStatus') }}</th>
              <th class="px-4 py-3 text-left font-medium">{{ t('analytics.snapshotsRowCount') }}</th>
              <th class="px-4 py-3 text-left font-medium">{{ t('analytics.snapshotsEmailSent') }}</th>
              <th class="px-4 py-3 text-right font-medium">{{ t('analytics.colActions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-200 dark:divide-neutral-700">
            <tr v-for="row in snapshots" :key="row._id">
              <td class="px-4 py-3">{{ formatDate(row.capturedAt) }}</td>
              <td class="px-4 py-3 capitalize">{{ row.status }}</td>
              <td class="px-4 py-3">{{ row.rowCount ?? '—' }}</td>
              <td class="px-4 py-3">{{ row.emailSent ? t('analytics.snapshotsEmailYes') : t('analytics.snapshotsEmailNo') }}</td>
              <td class="px-4 py-3 text-right">
                <button type="button" class="text-primary-600 hover:underline" @click="openSnapshot(row._id)">
                  {{ t('actions.view') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import ReportPreviewPanel from '@/components/analytics/ReportPreviewPanel.vue';
import { useAnalyticsSchedules } from '@/composables/useAnalyticsSchedules';
import { analyticsResultToCsv, downloadAnalyticsCsv } from '@/utils/analyticsExport';
import { captureAnalyticsModuleVisited, captureAnalyticsSnapshotExported } from '@/config/posthogAnalytics';
import { formatUserDateTime } from '@/utils/localeFormat';

const props = defineProps({
  id: { type: String, default: null },
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { snapshots, snapshot, loading, fetchSnapshots, fetchSnapshot } = useAnalyticsSchedules();

const snapshotId = computed(() => props.id || route.params.id || null);

function goSchedules() {
  router.push({ name: 'analytics-schedules' });
}

function formatDate(value) {
  if (!value) return '—';
  return formatUserDateTime(value);
}

function openSnapshot(id) {
  router.push({ name: 'analytics-snapshot-detail', params: { id } });
}

function exportSnapshotCsv() {
  if (!snapshot.value?.result) return;
  const reportName =
    typeof snapshot.value.reportId === 'object'
      ? snapshot.value.reportId.apiName || snapshot.value.reportId.name
      : 'snapshot';
  const csv = analyticsResultToCsv(snapshot.value.result);
  downloadAnalyticsCsv(`${reportName}_${snapshot.value._id}.csv`, csv);
  captureAnalyticsSnapshotExported({ snapshot_id: snapshot.value._id });
}

async function loadList() {
  const params = {};
  if (route.query.scheduleId) params.scheduleId = String(route.query.scheduleId);
  if (route.query.reportId) params.reportId = String(route.query.reportId);
  await fetchSnapshots(params);
}

async function loadDetail(id) {
  await fetchSnapshot(String(id));
}

watch(
  () => snapshotId.value,
  (id) => {
    if (id) void loadDetail(id);
    else void loadList();
  },
  { immediate: true }
);

onMounted(() => {
  captureAnalyticsModuleVisited({ surface: snapshotId.value ? 'analytics_snapshot_detail' : 'analytics_snapshots' });
});
</script>
